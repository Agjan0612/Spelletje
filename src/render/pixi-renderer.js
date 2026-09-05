/* Pixi-renderlaag — fase 1..3.
 *
 * Vervangt de canvas-2D-renderer (Game.render.renderer) door een PixiJS-scene.
 * De simulatie blijft ongewijzigd: alles wordt gelezen uit Game.state, precies
 * zoals de oude renderer deed. De iso-projectie uit camera.js komt één-op-één
 * terug — maar in plaats van elk object per frame te herprojecteren, staat alles
 * op zijn iso-coördinaat in één wereld-container en worden pan en zoom
 * container-transformaties (scale + position). Dat is de kern van de winst: het
 * GPU-werk zit in de compositie, niet in duizenden ctx-aanroepen per frame.
 *
 * Fase 1  toolchain + camera-container
 * Fase 2  terrein (heightmap-tint, kust, rivier, straten) uit echte state
 * Fase 3  gebouwen als iso-volumes (muren + dak + emoji-badge), diepte-sortering
 *
 * Nog niet geport (volgende fases): wandelaars/props/wildlife/raiders,
 * overlays, weer, dag-nacht, floaters/particles. Die functies zijn hier
 * voorlopig veilige no-ops zodat main.js en de rest van de code niet breken;
 * de bijbehorende legacy-modules (minimap, sprites-miniaturen, lagen-data)
 * blijven intussen gewoon meelopen.
 */
(function (Game) {
  var PIXI = window.PIXI;
  var R = {};

  var TEGEL = 34;                 /* moet gelijk zijn aan camera.js */

  /* Terreinpalet — dezelfde waarden als de oude sprites.js, zodat de wereld
     herkenbaar blijft. Vier varianten per terrein; t.v kiest er een. */
  var TERREIN = {
    gras:       ['#6f8f4a', '#6b8b41', '#8a8a3f', '#c9cfc4'],
    vruchtbaar: ['#8a7a3e', '#9a8437', '#a88a35', '#bfc0b0'],
    bos:        ['#3f6033', '#3a5c2c', '#5c5f2a', '#7f8c7a'],
    rots:       ['#7d7a72', '#7d7a72', '#7a766c', '#9d9d9a'],
    berg:       ['#5f5a52', '#5f5a52', '#5c5750', '#8d8d8d'],
    water:      ['#3f6f8f', '#42749a', '#3c6a89', '#4a6f85']
  };
  var WEGKLEUR = 0xbfa878;         /* aangestampt zand */
  var BRUGKLEUR = 0xa9865b;        /* houten dek */
  var LUCHT = 0x8fb3cf;            /* off-map = zee/lucht */

  /* --------------------------------------------------------------- helpers */

  function hexNum(hex) { return parseInt(hex.slice(1), 16); }

  /* rgb * f, per kanaal geklemd op 0..255. */
  function schaal(num, f) {
    var r = (num >> 16 & 255) * f, g = (num >> 8 & 255) * f, b = (num & 255) * f;
    r = r > 255 ? 255 : r | 0; g = g > 255 ? 255 : g | 0; b = b > 255 ? 255 : b | 0;
    return (r << 16) | (g << 8) | b;
  }

  /* Iso-projectie van een wereld-pixelpunt naar de ongezoomde iso-ruimte.
     Identiek aan camera.js isoX/isoY, hier lokaal zodat de renderlaag niet van
     een camera-instantie afhangt om zijn scene op te bouwen. */
  function isoX(wx, wy) { return (wx - wy) * 0.5; }
  function isoY(wx, wy) { return (wx + wy) * 0.25; }

  /* --------------------------------------------------------------- toestand */

  var app = null;
  var klaar = false;
  var canvasEl = null;
  var wachtMaat = null;           /* pasMaatAan die vóór app-init binnenkwam */

  var wereld, terreinLaag, gebouwLaag;

  var kaartSeed = null;
  var gebouwSig = '';
  var wereldDirty = false;

  /* --------------------------------------------------------------- init ---- */

  R.init = function (el) {
    canvasEl = el;
    app = new PIXI.Application();
    app.init({
      canvas: el,
      antialias: true,
      background: LUCHT,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2)
    }).then(function () {
      wereld = new PIXI.Container();
      terreinLaag = new PIXI.Graphics();
      gebouwLaag = new PIXI.Container();
      gebouwLaag.sortableChildren = true;      /* diepte-sortering op zIndex */
      wereld.addChild(terreinLaag);
      wereld.addChild(gebouwLaag);
      app.stage.addChild(wereld);

      /* Wij tekenen zelf, gestuurd door de vaste game-lus in main.js, in plaats
         van op Pixi's eigen ticker — zo weerspiegelt het beeld altijd de state
         van precies dit frame. */
      app.stop();

      klaar = true;
      wereldDirty = true;
      if (wachtMaat) { R.pasMaatAan(); wachtMaat = null; }
    });
  };

  R.pasMaatAan = function () {
    if (!canvasEl) return null;
    var host = canvasEl.parentElement || canvasEl;
    var b = host.clientWidth || canvasEl.clientWidth || 800;
    var h = host.clientHeight || canvasEl.clientHeight || 600;
    if (app && app.renderer) app.renderer.resize(b, h);
    else wachtMaat = true;
    return { b: b, h: h };
  };

  /* --------------------------------------------------------------- wereld -- */

  /* Volledige wereld opnieuw opbouwen wordt uitgesteld tot het volgende teken,
     zodat het ook werkt als het vóór de async app-init wordt aangevraagd. */
  R.verversWereld = function (s) {
    wereldDirty = true;
    kaartSeed = null;              /* forceer herbouw van het terrein */
  };

  R.verversGebouwen = function (s) {
    gebouwSig = '';                /* forceer herbouw van de gebouwlaag */
  };

  /* ---------------------------------------------------------- terrein bouw - */

  /* Hoogte van een tegel, met terugval buiten de kaart — voor de hillshade. */
  function tegelHoogte(T, b, h, x, y, terug) {
    if (x < 0 || y < 0 || x >= b || y >= h) return terug;
    var t = T[y * b + x];
    return t ? (t.h || 0) : terug;
  }

  function bouwTerrein(s) {
    var kaart = s.kaart, T = kaart.tegels, b = kaart.b, h = kaart.h;
    var seizoen = s.seizoen || 0;
    var hw = TEGEL / 2, hh = TEGEL / 4;
    var g = terreinLaag;
    g.clear();
    for (var ty = 0; ty < h; ty++) {
      for (var tx = 0; tx < b; tx++) {
        var t = T[ty * b + tx];
        if (!t) continue;
        var rij = TERREIN[t.t] || TERREIN.gras;
        var kleur = hexNum(rij[seizoen] || rij[0]);
        var isWater = t.t === 'water';
        if (!isWater) {
          /* Hillshade als in de oude sprites.js: hoogteverschil met de buren
             linksboven, alsof het licht van linksboven komt. Plus de per-tegel
             detailschakering uit t.v, zodat een grasveld niet één vlakke kleur is. */
          var hc = t.h || 0;
          var ul = tegelHoogte(T, b, h, tx - 1, ty - 1, hc);
          var u = tegelHoogte(T, b, h, tx, ty - 1, hc);
          var l = tegelHoogte(T, b, h, tx - 1, ty, hc);
          var dh = hc - (ul * 0.5 + u * 0.25 + l * 0.25);
          var relief = Game.util.clamp(1 + dh * 2.4, 0.8, 1.22);
          kleur = schaal(kleur, relief * (0.9 + (t.v || 0) * 0.2));
        } else {
          /* Subtiele deining zodat een watervlak niet één platte kleur is. */
          kleur = schaal(kleur, ((tx + ty) & 1) ? 1.04 : 0.96);
        }
        var wx = tx * TEGEL, wy = ty * TEGEL;
        var sx = isoX(wx, wy), sy = isoY(wx, wy);
        g.poly([sx, sy, sx + hw, sy + hh, sx, sy + hh * 2, sx - hw, sy + hh]).fill(kleur);

        /* Straten en bruggen zijn tegelvlaggen, geen gebouwen — teken ze als
           een smaller ruitje boven op de grond. */
        if (t.weg) {
          var q = 0.82, qw = hw * q, qh = hh * q;
          g.poly([sx, sy + hh - qh, sx + qw, sy + hh, sx, sy + hh + qh, sx - qw, sy + hh])
            .fill(t.brug ? BRUGKLEUR : WEGKLEUR);
        }
      }
    }
  }

  /* --------------------------------------------------------- gebouwen bouw - */

  /* Lichte handtekening: verandert zodra er een gebouw bijkomt, verdwijnt,
     verplaatst of afgebouwd raakt. Honderden gebouwen (straten zitten er niet
     bij), dus dit per frame samenstellen is goedkoop. */
  function gebouwHandtekening(s) {
    var uit = s.gebouwen.length + '|' + (s.wegTeller || 0) + '|';
    for (var i = 0; i < s.gebouwen.length; i++) {
      var g = s.gebouwen[i];
      uit += g.id + ',' + g.type + ',' + g.x + ',' + g.y + ',' +
        (g.gebouwd ? 1 : 0) + ',' + (g.uit ? 1 : 0) + ';';
    }
    return uit;
  }

  /* Dakkleur naar wat het gebouw dóét — grofweg: wonen terracotta, opslag hout,
     verdediging leisteen, de rest bruin. Verfijnde silhouetten volgen later. */
  function dakVoor(d) {
    if (d.verdediging || d.verdPerWerker) return 0x6b7078;
    if (d.woonruimte) return 0x9c4b34;
    if (d.opslag || d.opslagPer) return 0x7a5a3a;
    return 0x86603f;
  }

  /* Kleine, stabiele variatie per gebouw-id zodat een rij huisjes niet één
     lange schuur is (zoals opties.zaad in de oude sprites.js). */
  function zaadFactor(id) {
    var n = (id * 2654435761) >>> 0;
    return 0.94 + (n % 1000) / 1000 * 0.12;   /* 0.94..1.06 */
  }

  function bouwGebouwVolume(g, d) {
    var G = d.grootte || 1;
    var gx = g.x, gy = g.y;
    /* Vier grondhoeken van de footprint in iso-ruimte. */
    var top = { x: isoX(gx * TEGEL, gy * TEGEL), y: isoY(gx * TEGEL, gy * TEGEL) };
    var rechts = { x: isoX((gx + G) * TEGEL, gy * TEGEL), y: isoY((gx + G) * TEGEL, gy * TEGEL) };
    var onder = { x: isoX((gx + G) * TEGEL, (gy + G) * TEGEL), y: isoY((gx + G) * TEGEL, (gy + G) * TEGEL) };
    var links = { x: isoX(gx * TEGEL, (gy + G) * TEGEL), y: isoY(gx * TEGEL, (gy + G) * TEGEL) };

    var ratio = 1;
    if (!g.gebouwd && d.bouwtijd) ratio = Game.util.clamp((g.voortgang || 0) / d.bouwtijd, 0.12, 1);
    var hoogte = (16 + (G - 1) * 11 + (d.verdediging ? 16 : 0)) * (0.5 + 0.5 * ratio);

    var zf = zaadFactor(g.id);
    var muur = schaal(0xcbb79a, zf);
    var dak = schaal(dakVoor(d), zf);
    if (!g.gebouwd) { muur = 0xb7a98a; dak = 0xa89873; }   /* steiger-tint */

    var c = new PIXI.Graphics();

    function op(p) { return { x: p.x, y: p.y - hoogte }; }
    var tB = op(top), rB = op(rechts), oB = op(onder), lB = op(links);

    /* Muurvlakken: links donker, rechts iets lichter (licht van linksboven). */
    c.poly([links.x, links.y, onder.x, onder.y, oB.x, oB.y, lB.x, lB.y]).fill(schaal(muur, 0.72));
    c.poly([onder.x, onder.y, rechts.x, rechts.y, rB.x, rB.y, oB.x, oB.y]).fill(schaal(muur, 0.9));

    /* Piramidedak: apex boven het midden, vier driehoekvlakken. */
    var piek = 10 + G * 6;
    var mx = (tB.x + oB.x) / 2, my = (tB.y + oB.y) / 2;
    var apex = { x: mx, y: my - piek };
    c.poly([lB.x, lB.y, oB.x, oB.y, apex.x, apex.y]).fill(schaal(dak, 1.0)); /* voor-links */
    c.poly([oB.x, oB.y, rB.x, rB.y, apex.x, apex.y]).fill(schaal(dak, 0.9)); /* voor-rechts */
    c.poly([tB.x, tB.y, lB.x, lB.y, apex.x, apex.y]).fill(schaal(dak, 0.78));/* achter-links */
    c.poly([rB.x, rB.y, tB.x, tB.y, apex.x, apex.y]).fill(schaal(dak, 0.7)); /* achter-rechts */

    /* Emoji-badge boven de nok — ver weg het enige dat een dak identificeert. */
    if (d.emoji) {
      var badge = new PIXI.Text({ text: d.emoji, style: { fontSize: 16 } });
      badge.anchor.set(0.5, 1);
      badge.position.set(apex.x, apex.y - 2);
      c.addChild(badge);
    }

    if (g.uit) c.alpha = 0.55;
    /* Diepte: footprint-midden (x+y), zodat gebouwen elkaar juist overlappen. */
    c.zIndex = (gx + G / 2) + (gy + G / 2);
    return c;
  }

  function bouwGebouwen(s) {
    var oud = gebouwLaag.removeChildren();
    for (var k = 0; k < oud.length; k++) oud[k].destroy({ children: true });
    for (var i = 0; i < s.gebouwen.length; i++) {
      var g = s.gebouwen[i];
      var d = Game.config.gebouw(g.type);
      if (!d) continue;
      gebouwLaag.addChild(bouwGebouwVolume(g, d));
    }
  }

  /* --------------------------------------------------------------- tekenen - */

  R.teken = function (s, cam, ui) {
    if (!klaar || !s) return;

    if (kaartSeed !== s.kaart.seed) wereldDirty = true;
    if (wereldDirty) {
      bouwTerrein(s);
      wereldDirty = false;
      kaartSeed = s.kaart.seed;
      gebouwSig = '';                /* nieuw terrein → gebouwen ook opnieuw */
    }
    var sig = gebouwHandtekening(s);
    if (sig !== gebouwSig) { bouwGebouwen(s); gebouwSig = sig; }

    /* Camera → container-transform. Zie camera.wereldNaarScherm: een kind op
       iso-coördinaat (isoX,isoY) landt na deze scale+translate exact waar de
       oude renderer het tekende. */
    var z = cam.zoom;
    wereld.scale.set(z);
    var cx = isoX(cam.x, cam.y), cy = isoY(cam.x, cam.y);
    wereld.position.set(-cx * z + cam.breedte / 2, -cy * z + cam.hoogte / 2);

    app.render();
  };

  /* Zelfde tekst als de oude renderer, voor de toast bij een klik op een node. */
  R.tegelInfo = function (s, tx, ty) {
    var map = Game.core.map;
    var t = map.tegel(s.kaart, tx, ty);
    if (!t) return '';
    var tekst = map.terreinNaam[t.t];
    if (t.n && t.amt > 0 && t.amt < map.ONEINDIG) {
      tekst += ' — ' + map.nodeNaam[t.n] + ' (' + Math.round(t.amt) + ')';
    } else if (t.n && t.amt >= map.ONEINDIG) {
      tekst += ' — ' + map.nodeNaam[t.n];
    } else if (t.n && t.amt <= 0) {
      tekst += ' — uitgeput';
    }
    return tekst;
  };

  /* --------------------------------------------- nog te porten (no-ops) ---- */
  R.verversWandelaars = function () {};
  R.tickWandelaars = function () {};
  R.tickEffecten = function () {};
  R.tijdperkSweep = function () {};
  R.schok = function () {};
  R.flits = function () {};
  R.wandelaars = function () { return []; };

  Game.render.renderer = R;

})(window.Game);
