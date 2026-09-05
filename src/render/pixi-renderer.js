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

  var wereld, terreinLaag, waterLaag, rasterLaag, gebouwLaag, spookLaag;
  var overlayLaag, particleLaag, floaterLaag;
  var hemelLaag, lichtLaag;
  var dispSprite = null, waterFilter = null, vignetDoek = null;
  var klokVorig = 0, klok = 0;             /* interne render-klok in seconden */
  var hemelSig = '';                        /* alleen lucht opnieuw tekenen bij verandering */

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
      hemelLaag = new PIXI.Graphics();            /* lucht + zon/maan, achter alles */
      app.stage.addChild(hemelLaag);

      wereld = new PIXI.Container();
      waterLaag = new PIXI.Graphics();            /* water apart, voor de shimmer-filter */
      terreinLaag = new PIXI.Graphics();
      rasterLaag = new PIXI.Graphics();          /* plaatsingsraster, onder de gebouwen */
      gebouwLaag = new PIXI.Container();
      gebouwLaag.sortableChildren = true;        /* diepte-sortering op zIndex */
      spookLaag = new PIXI.Container();           /* bouw-spook + selectie, bovenop */
      overlayLaag = new PIXI.Graphics();          /* kaartlaag-tint, boven grond, onder gebouwen */
      particleLaag = new PIXI.Graphics();          /* stof e.d., boven de gebouwen */
      floaterLaag = new PIXI.Container();          /* opbrengst-cijfertjes */
      wereld.addChild(waterLaag);
      wereld.addChild(terreinLaag);
      wereld.addChild(rasterLaag);
      wereld.addChild(overlayLaag);
      wereld.addChild(gebouwLaag);
      wereld.addChild(particleLaag);
      wereld.addChild(floaterLaag);
      wereld.addChild(spookLaag);
      app.stage.addChild(wereld);

      lichtLaag = new PIXI.Graphics();            /* dag/nacht-was, bovenop */
      app.stage.addChild(lichtLaag);
      maakVignet();
      if (vignetDoek) app.stage.addChild(vignetDoek);

      stelWaterFilterIn();

      /* Wij tekenen zelf, gestuurd door de vaste game-lus in main.js, in plaats
         van op Pixi's eigen ticker — zo weerspiegelt het beeld altijd de state
         van precies dit frame. */
      app.stop();

      klaar = true;
      wereldDirty = true;
      klokVorig = performance.now();
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
    waterLaag.clear();
    for (var ty = 0; ty < h; ty++) {
      for (var tx = 0; tx < b; tx++) {
        var t = T[ty * b + tx];
        if (!t) continue;
        var rij = TERREIN[t.t] || TERREIN.gras;
        var kleur = hexNum(rij[seizoen] || rij[0]);
        var isWater = t.t === 'water';
        var doel = isWater ? waterLaag : g;
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
        doel.poly([sx, sy, sx + hw, sy + hh, sx, sy + hh * 2, sx - hw, sy + hh]).fill(kleur);

        /* Straten en bruggen zijn tegelvlaggen, geen gebouwen — teken ze als
           een smaller ruitje boven op de grond (altijd op de landlaag, ook een
           brug boven water). */
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

  /* Eén iso-volume (muren + piramidedak + emoji-badge) voor een gebouw-def op
     tegel (gx,gy). Wordt gedeeld door de echte gebouwlaag en het bouw-spook.
     opties: { id, ratio (0..1 bij aanbouw), uit, spook, badge }. */
  function maakVolume(d, gx, gy, opties) {
    opties = opties || {};
    var G = d.grootte || 1;
    /* Vier grondhoeken van de footprint in iso-ruimte. */
    var top = { x: isoX(gx * TEGEL, gy * TEGEL), y: isoY(gx * TEGEL, gy * TEGEL) };
    var rechts = { x: isoX((gx + G) * TEGEL, gy * TEGEL), y: isoY((gx + G) * TEGEL, gy * TEGEL) };
    var onder = { x: isoX((gx + G) * TEGEL, (gy + G) * TEGEL), y: isoY((gx + G) * TEGEL, (gy + G) * TEGEL) };
    var links = { x: isoX(gx * TEGEL, (gy + G) * TEGEL), y: isoY(gx * TEGEL, (gy + G) * TEGEL) };

    var ratio = opties.ratio == null ? 1 : Game.util.clamp(opties.ratio, 0.12, 1);
    var hoogte = (16 + (G - 1) * 11 + (d.verdediging ? 16 : 0)) * (0.5 + 0.5 * ratio);

    var zf = zaadFactor(opties.id || (gx * 131 + gy));
    var muur = schaal(0xcbb79a, zf);
    var dak = schaal(dakVoor(d), zf);
    if (ratio < 1) { muur = 0xb7a98a; dak = 0xa89873; }   /* steiger-tint */

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
    if (d.emoji && opties.badge !== false) {
      var badge = new PIXI.Text({ text: d.emoji, style: { fontSize: 16 } });
      badge.anchor.set(0.5, 1);
      badge.position.set(apex.x, apex.y - 2);
      c.addChild(badge);
    }

    if (opties.spook) c.alpha = 0.6;
    else if (opties.uit) c.alpha = 0.55;
    /* Diepte: footprint-midden (x+y), zodat gebouwen elkaar juist overlappen. */
    c.zIndex = (gx + G / 2) + (gy + G / 2);
    return c;
  }

  function bouwGebouwen(s) {
    /* Alleen gebouwen en hun props opnieuw; wandelaars, dieren en rovers leven
       verder in dezelfde laag en blijven staan (ze worden apart bijgehouden). */
    var kinderen = gebouwLaag.children.slice();
    for (var k = 0; k < kinderen.length; k++) {
      var c = kinderen[k];
      if (c._soort === 'gebouw' || c._soort === 'prop') { gebouwLaag.removeChild(c); c.destroy({ children: true }); }
    }
    for (var i = 0; i < s.gebouwen.length; i++) {
      var g = s.gebouwen[i];
      var d = Game.config.gebouw(g.type);
      if (!d) continue;
      var ratio = 1;
      if (!g.gebouwd && d.bouwtijd) ratio = (g.voortgang || 0) / d.bouwtijd;
      var vol = maakVolume(d, g.x, g.y, { id: g.id, ratio: ratio, uit: g.uit });
      vol._soort = 'gebouw';
      gebouwLaag.addChild(vol);
      if (g.gebouwd) maakProps(g, d);
    }
  }

  /* Wat erfrommel rond een afgebouwd gebouw: vaten en kratten bij opslag/markt,
     een houtstapel bij de houthakker, een struik bij een huis. Statisch, dus
     samen met de gebouwen opnieuw opgebouwd. Afgeleid van de buildings, nooit
     in Game.state (net als de oude props.js). */
  function maakProps(g, d) {
    var G = d.grootte || 1;
    var mx = (g.x + G / 2) * TEGEL, my = (g.y + G / 2) * TEGEL;
    var rnd = zaadFactor(g.id * 7 + 3);
    function plaats(gfx, ox, oy) {
      var wx = mx + ox, wy = my + oy;
      gfx.position.set(isoX(wx, wy), isoY(wx, wy));
      gfx._soort = 'prop';
      gfx.zIndex = (g.x + G / 2 + ox / TEGEL) + (g.y + G / 2 + oy / TEGEL) - 0.05;
      gebouwLaag.addChild(gfx);
    }
    var rand = G * TEGEL * 0.42;
    if (d.opslag || d.opslagPer || /markt/.test(d.id)) {
      plaats(maakVat(), -rand, rand * 0.4);
      plaats(maakVat(), -rand * 0.6, rand * 0.7);
    } else if (/hout/.test(d.id)) {
      plaats(maakHoutstapel(), rand * 0.6, rand * 0.5);
    } else if (d.woonruimte && rnd > 0.99) {
      plaats(maakStruik(), rand * 0.7, rand * 0.3);
    } else if (d.woonruimte) {
      plaats(maakStruik(), -rand * 0.7, rand * 0.5);
    }
  }

  /* --------------------------------------------- bouw-spook + raster (fase 4) */

  function isoTegel(tx, ty) { return { x: isoX(tx * TEGEL, ty * TEGEL), y: isoY(tx * TEGEL, ty * TEGEL) }; }

  /* Footprint-ruit van een gebouw van grootte G op tegel (tx,ty), als vlakke
     poly-puntenlijst in iso-ruimte. */
  function voetPoly(tx, ty, G) {
    var a = isoTegel(tx, ty), b = isoTegel(tx + G, ty), c = isoTegel(tx + G, ty + G), d = isoTegel(tx, ty + G);
    return [a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y];
  }

  /* Het lichte witte plaatsingsraster over de zichtbare tegels. */
  function tekenRaster(s, cam, ui) {
    rasterLaag.clear();
    if (!ui || !ui.plaatsType || cam.px() <= 14) return;
    var z = cam.zichtbaar(s.kaart), a, b;
    for (var gx = z.x0; gx <= z.x1; gx++) { a = isoTegel(gx, z.y0); b = isoTegel(gx, z.y1); rasterLaag.moveTo(a.x, a.y).lineTo(b.x, b.y); }
    for (var gy = z.y0; gy <= z.y1; gy++) { a = isoTegel(z.x0, gy); b = isoTegel(z.x1, gy); rasterLaag.moveTo(a.x, a.y).lineTo(b.x, b.y); }
    rasterLaag.stroke({ width: 1 / cam.zoom, color: 0xffffff, alpha: 0.10 });
  }

  /* Een rij die met shift wordt uitgesleept: een footprint per tegel, groen of
     rood al naar gelang die tegel het gebouw aankan. */
  function tekenLijnSpook(s, cam, ui) {
    var l = ui.lijn;
    var sx = Math.sign(l.x1 - l.x0), sy = Math.sign(l.y1 - l.y0);
    var n = Math.max(Math.abs(l.x1 - l.x0), Math.abs(l.y1 - l.y0)) + 1;
    var g = new PIXI.Graphics();
    for (var i = 0; i < n; i++) {
      var x = l.x0 + sx * i, y = l.y0 + sy * i;
      var ch = Game.core.construction.controleer(s, ui.plaatsType, x, y);
      var ok = ch && ch.ok;
      g.poly(voetPoly(x, y, 1)).fill({ color: ok ? 0x8fdc6a : 0xe0604a, alpha: ok ? 0.22 : 0.24 })
        .stroke({ width: 1.5 / cam.zoom, color: ok ? 0x8fdc6a : 0xe0604a, alpha: 1 });
    }
    spookLaag.addChild(g);
  }

  function tekenSpook(s, cam, ui) {
    var oud = spookLaag.removeChildren();
    for (var k = 0; k < oud.length; k++) oud[k].destroy({ children: true });
    if (!ui) return;

    /* Gouden omlijning om het geselecteerde gebouw. */
    if (ui.geselecteerd != null) {
      var gsel = Game.core.state.gebouw(s, ui.geselecteerd);
      if (gsel) {
        var dd = Game.core.state.def(gsel);
        var sg = new PIXI.Graphics();
        sg.poly(voetPoly(gsel.x, gsel.y, dd.grootte || 1))
          .stroke({ width: 2.5 / cam.zoom, color: 0xffd873, alpha: 0.95 });
        spookLaag.addChild(sg);
      }
    }

    if (!ui.plaatsType || !ui.muisTegel) return;
    if (ui.lijn) { tekenLijnSpook(s, cam, ui); return; }

    var d = Game.config.gebouw(ui.plaatsType);
    if (!d) return;
    var tx = ui.muisTegel.x, ty = ui.muisTegel.y;
    var bezig = ui.verplaatst != null ? Game.core.state.gebouw(s, ui.verplaatst) : null;
    var check = bezig
      ? Game.core.construction.controleerVerplaatsing(s, bezig, tx, ty)
      : Game.core.construction.controleer(s, ui.plaatsType, tx, ty);
    var ok = check && check.ok;

    var patch = new PIXI.Graphics();
    patch.poly(voetPoly(tx, ty, d.grootte || 1))
      .fill({ color: ok ? 0x8fdc6a : 0xe0604a, alpha: ok ? 0.2 : 0.24 })
      .stroke({ width: 2 / cam.zoom, color: ok ? 0x8fdc6a : 0xe0604a, alpha: 1 });
    spookLaag.addChild(patch);

    spookLaag.addChild(maakVolume(d, tx, ty, { spook: true, badge: false, ratio: 1 }));

    /* Straal-hint voor gebouwen die dicht bij een node moeten staan. */
    if (d.plaats && d.plaats.nabij) {
      var straal = d.plaats.nabij.straal;
      var rg = new PIXI.Graphics();
      rg.poly(voetPoly(tx - straal, ty - straal, (d.grootte || 1) + straal * 2))
        .stroke({ width: 1.5 / cam.zoom, color: ok ? 0x8fdc6a : 0xe0604a, alpha: 0.5 });
      spookLaag.addChild(rg);
    }
  }

  /* ---------------------------------------------- licht, lucht, water (fase 5) */

  var ZEE = [0x27506b, 0x295473, 0x254a64, 0x2b4a5e];

  /* Meng twee rgb-getallen; t=0 → a, t=1 → b. */
  function mengNum(a, b, t) {
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    var ar = a >> 16 & 255, ag = a >> 8 & 255, ab = a & 255;
    var br = b >> 16 & 255, bg = b >> 8 & 255, bb = b & 255;
    return ((ar + (br - ar) * t) | 0) << 16 | ((ag + (bg - ag) * t) | 0) << 8 | ((ab + (bb - ab) * t) | 0);
  }

  /* De dagfase, bij voorkeur uit de canonieke sfeer.js (blijft meelopen), met
     een gelijkwaardige terugval als die er niet is. */
  function lichtStand(s) {
    if (Game.render.sfeer && Game.render.sfeer.licht) return Game.render.sfeer.licht(s);
    var dag = (Game.core.state && Game.core.state.DAG) || 10;
    var f = (((s.tijd % dag) + dag) % dag) / dag;
    var nacht = 0.5 - 0.5 * Math.cos(f * Math.PI * 2);
    var piek = function (m, br) { var d = Math.abs(f - m); if (d > 0.5) d = 1 - d; return Math.max(0, 1 - d / br); };
    return { f: f, nacht: nacht, dag: 1 - nacht, avond: piek(0.26, 0.17), ochtend: piek(0.76, 0.15) };
  }

  /* Lucht + zon/maan achter de wereld. Alleen opnieuw tekenen als de tijd-emmer,
     het seizoen of de schermmaat verandert (een verloop per frame is zonde). */
  function tekenHemel(s, cam) {
    var L = lichtStand(s);
    var sig = cam.breedte + 'x' + cam.hoogte + '|' + s.seizoen + '|' + (L.nacht * 40 | 0) + '|' + (L.f * 60 | 0);
    if (sig === hemelSig) return;
    hemelSig = sig;
    var lucht = mengNum(0xa8cae2, 0x141d33, L.nacht);       /* helderblauw → nachtblauw */
    lucht = mengNum(lucht, 0xf0a860, Math.max(L.avond, L.ochtend) * 0.5);  /* warme rand */
    var zee = ZEE[s.seizoen] || ZEE[0];
    hemelLaag.clear();
    var N = 16, band = Math.ceil((cam.hoogte + 8) / N);
    for (var i = 0; i < N; i++) {
      var f = i / (N - 1);
      hemelLaag.rect(-4, -4 + i * band, cam.breedte + 8, band + 1).fill(mengNum(lucht, zee, Math.min(1, f * 1.3)));
    }
    /* Zon of maan, hoog rond de middag, laag bij dageraad/schemer. */
    var maan = L.nacht > 0.5;
    var dx = ((L.f + 0.25) % 1) * cam.breedte;
    var hoog = 0.5 - 0.5 * Math.cos(L.f * Math.PI * 2);
    var dy = cam.hoogte * (0.08 + hoog * 0.22);
    var r = Math.min(cam.breedte, cam.hoogte) * 0.045;
    hemelLaag.circle(dx, dy, r).fill({ color: maan ? 0xdfe6f0 : 0xffe08a, alpha: maan ? 0.85 : 0.95 });
    hemelLaag.circle(dx, dy, r * 1.8).fill({ color: maan ? 0xdfe6f0 : 0xffe08a, alpha: 0.12 });
  }

  /* De dag/nacht-was over de wereld plus een zachte vignet. De wereld zelf wordt
     getint (goedkoop, raakt elk kind), de was legt de warme schemer eroverheen. */
  function tekenLicht(s, cam) {
    var L = lichtStand(s);
    /* Basis: overdag wit, 's nachts een donkere blauwe tint over alles. */
    wereld.tint = mengNum(0xffffff, 0x3a4a72, L.nacht * 0.72);

    lichtLaag.clear();
    var warm = Math.max(L.avond, L.ochtend);
    if (warm > 0.01) {
      lichtLaag.rect(0, 0, cam.breedte, cam.hoogte).fill({ color: L.avond > L.ochtend ? 0xff9040 : 0xffb060, alpha: warm * 0.16 });
    }
    if (L.nacht > 0.02) {
      lichtLaag.rect(0, 0, cam.breedte, cam.hoogte).fill({ color: 0x0a1230, alpha: L.nacht * 0.22 });
    }
    /* Vignet die de rand van het frame afsluit — sterker 's nachts. */
    if (vignetDoek) {
      vignetDoek.width = cam.breedte; vignetDoek.height = cam.hoogte;
      vignetDoek.alpha = 0.28 + L.nacht * 0.22;
    }
  }

  /* Radiale vignet als Sprite: doorschijnend hart, donkere randen. Eén keer
     gemaakt, daarna alleen op schermmaat geschaald en op alpha gezet. */
  function maakVignet() {
    try {
      var n = 256, c = document.createElement('canvas'); c.width = c.height = n;
      var x = c.getContext('2d');
      var grad = x.createRadialGradient(n / 2, n / 2, n * 0.28, n / 2, n / 2, n * 0.62);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,1)');
      x.fillStyle = grad; x.fillRect(0, 0, n, n);
      vignetDoek = new PIXI.Sprite(PIXI.Texture.from(c));
    } catch (e) { vignetDoek = null; }
  }

  /* Displacement-shimmer op de waterlaag. Procedurele ruistextuur, geen assets.
     Alles in een try/catch: mislukt het, dan blijft het water simpelweg stil. */
  function stelWaterFilterIn() {
    try {
      var c = document.createElement('canvas'); c.width = c.height = 128;
      var x = c.getContext('2d'); var img = x.createImageData(128, 128);
      for (var i = 0; i < 128 * 128; i++) {
        var px = i % 128, py = (i / 128) | 0;
        img.data[i * 4] = 128 + 70 * Math.sin(px / 8) * Math.cos(py / 12);
        img.data[i * 4 + 1] = 128 + 70 * Math.sin((px + py) / 10);
        img.data[i * 4 + 2] = 128;
        img.data[i * 4 + 3] = 255;
      }
      x.putImageData(img, 0, 0);
      var tex = PIXI.Texture.from(c);
      if (tex.source && tex.source.style) { tex.source.style.addressMode = 'repeat'; if (tex.source.style.update) tex.source.style.update(); }
      dispSprite = new PIXI.Sprite(tex);
      dispSprite.renderable = false;
      wereld.addChild(dispSprite);
      waterFilter = new PIXI.DisplacementFilter({ sprite: dispSprite, scale: 9 });
      waterLaag.filters = [waterFilter];
    } catch (e) { dispSprite = null; waterFilter = null; }
  }

  /* -------------------------------------------------- leven (fase 6) -------- */

  /* Decoratieve willekeur mag NOOIT Math.random gebruiken: de simulatie trekt
     daar zelf uit (raids/gebeurtenissen/geboortes), dus dat zou de
     determinisme breken. Game.render.rng (mulberry32, uit beweging.js) is de
     render-only stroom; met een eigen mulberry als terugval. */
  var _rs = 0x9e3779b9 >>> 0;
  function rlokaal() {
    _rs = (_rs + 0x6D2B79F5) | 0;
    var t = Math.imul(_rs ^ _rs >>> 15, 1 | _rs);
    t = (t + Math.imul(t ^ t >>> 7, 61 | t)) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  function rnd() { return (Game.render && Game.render.rng) ? Game.render.rng() : rlokaal(); }
  function kies(arr) { return arr.length ? arr[(rnd() * arr.length) | 0] : null; }

  /* -- prop-vormpjes (klein, in iso-ruimte, voeten op y=0) -- */
  function maakVat() {
    var c = new PIXI.Graphics();
    c.ellipse(0, 0, 2.6, 1.2).fill({ color: 0x000000, alpha: 0.16 });
    c.roundRect(-2.2, -5, 4.4, 5, 1).fill(0x7a5a34);
    c.rect(-2.2, -3.4, 4.4, 0.8).fill(0x5c4326);
    return c;
  }
  function maakHoutstapel() {
    var c = new PIXI.Graphics();
    c.ellipse(0, 0, 4, 1.6).fill({ color: 0x000000, alpha: 0.16 });
    c.roundRect(-4, -2.4, 8, 2.4, 1).fill(0x8a6a40);
    c.roundRect(-3, -4.4, 6, 2.2, 1).fill(0x9a774a);
    return c;
  }
  function maakStruik() {
    var c = new PIXI.Graphics();
    c.ellipse(0, 0, 3, 1.3).fill({ color: 0x000000, alpha: 0.14 });
    c.circle(-1.4, -3, 2.4).fill(0x4f7a38);
    c.circle(1.4, -3, 2.4).fill(0x568238);
    c.circle(0, -5, 2.6).fill(0x5f8c40);
    return c;
  }

  /* -- figuren -- */
  var WANDELKLEUR = [0x8a5a3c, 0x6b7a9a, 0x9a8a4a, 0x7a4a4a, 0x5a7a5a, 0x8a6a8a];
  function maakPersoon(kleur) {
    var c = new PIXI.Graphics();
    c.ellipse(0, 0, 3, 1.3).fill({ color: 0x000000, alpha: 0.2 });
    c.roundRect(-2, -8, 4, 7, 1.6).fill(kleur);
    c.circle(0, -9.4, 2).fill(0xf1c9a5);
    return c;
  }
  function maakSchaap() {
    var c = new PIXI.Graphics();
    c.ellipse(0, 0, 3.2, 1.4).fill({ color: 0x000000, alpha: 0.16 });
    c.ellipse(0, -3, 3.4, 2.4).fill(0xf0ece2);
    c.circle(2.6, -3.6, 1.5).fill(0x4a4038);
    return c;
  }
  function maakRover() {
    var c = new PIXI.Graphics();
    c.ellipse(0, 0, 3, 1.3).fill({ color: 0x000000, alpha: 0.24 });
    c.roundRect(-2.2, -8.5, 4.4, 7.5, 1.4).fill(0x3a2f33);
    c.circle(0, -10, 2).fill(0xcf9f86);
    c.rect(2, -11, 1, 8).fill(0x9a9aa0);       /* speer */
    return c;
  }

  /* -- toestand van de levende laag (render-only, nooit in Game.state) -- */
  var wandelaars = [], dieren = [], rovers = [];
  var levenPunten = [], weiPunten = [];

  function wisLeven() {
    [wandelaars, dieren, rovers].forEach(function (lijst) {
      for (var i = 0; i < lijst.length; i++) if (lijst[i].sprite) lijst[i].sprite.destroy({ children: true });
      lijst.length = 0;
    });
  }

  function verzamelPunten(s) {
    levenPunten = []; weiPunten = [];
    for (var i = 0; i < s.gebouwen.length; i++) {
      var g = s.gebouwen[i];
      if (!g.gebouwd) continue;
      var d = Game.config.gebouw(g.type); if (!d) continue;
      var G = d.grootte || 1;
      var cx = (g.x + G / 2) * TEGEL, cy = (g.y + G / 2) * TEGEL;
      levenPunten.push({ x: cx, y: cy });
      if (/schaap/.test(d.id) || d.id === 'boerderij') weiPunten.push({ x: cx, y: cy, r: G * TEGEL * 0.9 });
    }
  }

  function spawnWandelaar() {
    var p = kies(levenPunten); if (!p) return;
    var sp = maakPersoon(WANDELKLEUR[(rnd() * WANDELKLEUR.length) | 0]);
    sp._soort = 'wandelaar';
    gebouwLaag.addChild(sp);
    wandelaars.push({ sprite: sp, wx: p.x, wy: p.y, doel: kies(levenPunten), snel: 13 + rnd() * 10, faze: rnd() * 6 });
  }
  function spawnSchaap() {
    var p = kies(weiPunten); if (!p) return;
    var sp = maakSchaap();
    sp._soort = 'dier';
    gebouwLaag.addChild(sp);
    dieren.push({ sprite: sp, thuis: p, wx: p.x + (rnd() - 0.5) * p.r, wy: p.y + (rnd() - 0.5) * p.r, doel: null, snel: 5 + rnd() * 4, faze: rnd() * 6, wacht: rnd() * 3 });
  }

  function verversRovers(s) {
    var actief = s.raid && s.raid.fase && s.raid.fase !== 'klaar' && s.raid.fase !== 'voorbij';
    if (!actief) { while (rovers.length) { var r = rovers.pop(); r.sprite.destroy(); } return; }
    var doelN = 5;
    var mid = s.start ? { x: (s.start.x + 0.5) * TEGEL, y: (s.start.y + 0.5) * TEGEL } : { x: s.kaart.b * TEGEL / 2, y: s.kaart.h * TEGEL / 2 };
    while (rovers.length < doelN) {
      var hoek = rnd() * Math.PI * 2, straal = (s.kaart.b + s.kaart.h) * TEGEL * 0.4;
      var sp = maakRover(); sp._soort = 'rover'; gebouwLaag.addChild(sp);
      rovers.push({ sprite: sp, wx: mid.x + Math.cos(hoek) * straal, wy: mid.y + Math.sin(hoek) * straal, doel: mid, snel: 16 + rnd() * 6, faze: rnd() * 6 });
    }
    while (rovers.length > doelN) { var rr = rovers.pop(); rr.sprite.destroy(); }
  }

  function verversLeven(s) {
    if (!klaar) return;
    verzamelPunten(s);
    var doelW = levenPunten.length ? Game.util.clamp(Math.round((s.bevolking.totaal || 0) * 0.5), 2, 45) : 0;
    while (wandelaars.length < doelW) spawnWandelaar();
    while (wandelaars.length > doelW) { var w = wandelaars.pop(); w.sprite.destroy(); }
    var doelD = Game.util.clamp(weiPunten.length * 3, 0, 24);
    while (dieren.length < doelD && weiPunten.length) spawnSchaap();
    while (dieren.length > doelD) { var a = dieren.pop(); a.sprite.destroy(); }
    verversRovers(s);
  }

  function stapFiguur(w, dt) {
    var dx = w.doel.x - w.wx, dy = w.doel.y - w.wy;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 3) { w.doel = kies(levenPunten) || w.doel; }
    else { var v = w.snel * dt; if (v > dist) v = dist; w.wx += dx / dist * v; w.wy += dy / dist * v; }
    w.faze += dt * 7;
    var bob = Math.abs(Math.sin(w.faze)) * 1.2;
    w.sprite.position.set(isoX(w.wx, w.wy), isoY(w.wx, w.wy) - bob);
    w.sprite.zIndex = (w.wx + w.wy) / TEGEL + 0.02;
  }

  function tickLeven(s, dt) {
    if (!klaar || dt <= 0) return;
    var i;
    for (i = 0; i < wandelaars.length; i++) stapFiguur(wandelaars[i], dt);
    for (i = 0; i < rovers.length; i++) stapFiguur(rovers[i], dt);
    for (i = 0; i < dieren.length; i++) {
      var a = dieren[i];
      a.wacht -= dt;
      if (!a.doel || a.wacht <= 0) {
        a.doel = { x: a.thuis.x + (rnd() - 0.5) * a.thuis.r, y: a.thuis.y + (rnd() - 0.5) * a.thuis.r };
        a.wacht = 2 + rnd() * 4;
      }
      var dx = a.doel.x - a.wx, dy = a.doel.y - a.wy, dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 2) { var v = a.snel * dt; if (v > dist) v = dist; a.wx += dx / dist * v; a.wy += dy / dist * v; }
      a.sprite.position.set(isoX(a.wx, a.wy), isoY(a.wx, a.wy));
      a.sprite.zIndex = (a.wx + a.wy) / TEGEL + 0.01;
    }
  }

  /* ------------------------------------ overlays, stof, floaters (fase 7) --- */

  /* Zelfde rood → amber → groen ramp als de oude lagen.js, als kleurgetal. */
  function laagKleur(v) {
    var r, g;
    if (v < 0.5) { r = 214; g = Math.round(60 + v * 2 * 130); }
    else { r = Math.round(214 - (v - 0.5) * 2 * 150); g = 190; }
    return (r << 16) | (g << 8) | 70;
  }

  /* De actieve kaartlaag als getinte ruiten. De waarden komen uit de canonieke
     lagen.js (blijft meelopen), zo kan de kaart nooit van de simulatie afdrijven. */
  function tekenOverlay(s, cam) {
    overlayLaag.clear();
    var lg = Game.render.lagen;
    if (!lg || !lg.actief) return;
    if (lg.ververs) lg.ververs(s);
    var z = cam.zichtbaar(s.kaart), hw = TEGEL / 2, hh = TEGEL / 4;
    for (var y = z.y0; y < z.y1; y++) {
      for (var x = z.x0; x < z.x1; x++) {
        var v = lg.waardeOp ? lg.waardeOp(s, x, y) : -1;
        if (v < 0) continue;
        var wx = x * TEGEL, wy = y * TEGEL, sx = isoX(wx, wy), sy = isoY(wx, wy);
        overlayLaag.poly([sx, sy, sx + hw, sy + hh, sx, sy + hh * 2, sx - hw, sy + hh]).fill({ color: laagKleur(v), alpha: 0.42 });
      }
    }
  }

  /* -- stofdeeltjes. Vervangt Game.render.particles zodat de bestaande stof()-
     aanroepen uit construction/raids in Pixi landen. Let op: die callers rekenen
     in tegels*40 (een oude tegelmaat), niet TEGEL — dus delen door 40. -- */
  var deeltjes = [];
  var Deeltjes = {
    reset: function () { deeltjes.length = 0; if (particleLaag) particleLaag.clear(); },
    stof: function (wx, wy, kracht) {
      var tx = wx / 40, ty = wy / 40;
      var ix = isoX(tx * TEGEL, ty * TEGEL), iy = isoY(tx * TEGEL, ty * TEGEL);
      var n = kracht || 3;
      for (var i = 0; i < n; i++) {
        deeltjes.push({ x: ix + (rnd() - 0.5) * 6, y: iy - 3, vx: (rnd() - 0.5) * 22, vy: -10 - rnd() * 16, leven: 0.5 + rnd() * 0.6, t: 0, r: 2 + rnd() * 3 });
      }
    },
    emit: function () {}   /* de oude API had emit(); niet nodig hier */
  };

  function tickDeeltjes(dt) {
    if (!particleLaag) return;
    particleLaag.clear();
    for (var i = deeltjes.length - 1; i >= 0; i--) {
      var p = deeltjes[i];
      p.t += dt;
      if (p.t >= p.leven) { deeltjes.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 30 * dt;
      var a = 1 - p.t / p.leven;
      particleLaag.circle(p.x, p.y, p.r * (1 + p.t * 2)).fill({ color: 0xb0966e, alpha: a * 0.5 });
    }
  }

  /* -- floaters: opbrengst-emoji's die boven werkende gebouwen opstijgen en
     vervagen. Mirrort niets uit economy.js exact; het is een levensteken, geen
     boekhouding. -- */
  var floaters = [];
  var floaterTimer = 0;

  function opbrengstEmoji(d) {
    var res = null;
    if (d.wint && d.wint.res) res = d.wint.res;
    else if (d.maakt && d.maakt.uit) { for (var k in d.maakt.uit) { res = k; break; } }
    if (!res) return null;
    var rc = Game.config.resources[res];
    return rc ? rc.emoji : null;
  }

  function spawnFloater(s) {
    var kandidaten = [];
    for (var i = 0; i < s.gebouwen.length; i++) {
      var g = s.gebouwen[i];
      if (!g.gebouwd || (g.werkers || 0) <= 0) continue;
      var d = Game.config.gebouw(g.type); if (!d) continue;
      if (opbrengstEmoji(d)) kandidaten.push(g);
    }
    if (!kandidaten.length) return;
    var g2 = kandidaten[(rnd() * kandidaten.length) | 0];
    var d2 = Game.config.gebouw(g2.type);
    var G = d2.grootte || 1;
    var wx = (g2.x + G / 2) * TEGEL, wy = (g2.y + G / 2) * TEGEL;
    var t = new PIXI.Text({ text: opbrengstEmoji(d2), style: { fontSize: 13 } });
    t.anchor.set(0.5, 1);
    t.position.set(isoX(wx, wy), isoY(wx, wy) - 24);
    floaterLaag.addChild(t);
    floaters.push({ sprite: t, x0: t.x, y0: t.y, t: 0, leven: 1.6 });
  }

  function tickFloaters(s, dt) {
    floaterTimer -= dt;
    if (floaterTimer <= 0) { spawnFloater(s); floaterTimer = 0.7 + rnd() * 0.8; }
    for (var i = floaters.length - 1; i >= 0; i--) {
      var f = floaters[i];
      f.t += dt;
      if (f.t >= f.leven) { f.sprite.destroy(); floaters.splice(i, 1); continue; }
      var p = f.t / f.leven;
      f.sprite.y = f.y0 - p * 22;
      f.sprite.alpha = p < 0.15 ? p / 0.15 : (1 - (p - 0.15) / 0.85);
    }
  }

  /* --------------------------------------------------------------- tekenen - */

  R.teken = function (s, cam, ui) {
    if (!klaar || !s) return;

    if (kaartSeed !== s.kaart.seed) wereldDirty = true;
    if (wereldDirty) {
      bouwTerrein(s);
      wisLeven();                    /* nieuwe wereld → begin met leeg leven */
      wereldDirty = false;
      kaartSeed = s.kaart.seed;
      gebouwSig = '';                /* nieuw terrein → gebouwen ook opnieuw */
    }
    var sig = gebouwHandtekening(s);
    if (sig !== gebouwSig) { bouwGebouwen(s); verversLeven(s); gebouwSig = sig; }

    /* Camera → container-transform. Zie camera.wereldNaarScherm: een kind op
       iso-coördinaat (isoX,isoY) landt na deze scale+translate exact waar de
       oude renderer het tekende. */
    var z = cam.zoom;
    wereld.scale.set(z);
    var cx = isoX(cam.x, cam.y), cy = isoY(cam.x, cam.y);
    wereld.position.set(-cx * z + cam.breedte / 2, -cy * z + cam.hoogte / 2);

    /* Bouw-spook, plaatsingsraster en selectie — veranderen met muis/camera,
       dus elke frame opnieuw (goedkoop; alleen gevuld tijdens plaatsen/selectie). */
    tekenRaster(s, cam, ui);
    tekenSpook(s, cam, ui);

    /* Interne render-klok (teken krijgt geen dt) voor de water-animatie. */
    var nu = performance.now();
    var dt = Math.min(0.05, (nu - klokVorig) / 1000);
    klokVorig = nu; klok += dt;

    tekenOverlay(s, cam);
    tekenHemel(s, cam);
    tekenLicht(s, cam);
    if (dispSprite) { dispSprite.x = (klok * 7) % 128; dispSprite.y = (klok * 4) % 128; }

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

  R.verversWandelaars = function (s) { verversLeven(s); };
  R.tickWandelaars = function (s, dt) { tickLeven(s, dt); };
  R.wandelaars = function () { return wandelaars; };
  R.tickEffecten = function (s, dt) { if (!klaar) return; tickDeeltjes(dt); tickFloaters(s, dt); };

  /* --------------------------------------------- nog te porten (no-ops) ---- */
  R.tijdperkSweep = function () {};
  R.schok = function () {};
  R.flits = function () {};

  Game.render.renderer = R;
  Game.render.particles = Deeltjes;   /* stof() uit construction/raids landt nu hier */

})(window.Game);
