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
  var overlayLaag, particleLaag, floaterLaag, gloedLaag;
  var schoorstenen = [];              /* iso-rookpunten van gebouwen met een haard */
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
      gloedLaag = new PIXI.Graphics();             /* warme avondgloed (additief) */
      gloedLaag.blendMode = 'add';
      particleLaag = new PIXI.Graphics();          /* stof/rook, boven de gebouwen */
      floaterLaag = new PIXI.Container();          /* opbrengst-cijfertjes */
      wereld.addChild(waterLaag);
      wereld.addChild(terreinLaag);
      wereld.addChild(rasterLaag);
      wereld.addChild(overlayLaag);
      wereld.addChild(gebouwLaag);
      wereld.addChild(gloedLaag);
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

  /* Afstand van elke watertegel tot het dichtstbijzijnde land (flood fill vanaf
     de kust), zodat ondiep water turquoise wordt en open water donker. Land = 0.
     Eén keer per kaart-seed. */
  var diepteCache = { seed: null, arr: null };
  function berekenDiepte(kaart) {
    if (diepteCache.seed === kaart.seed && diepteCache.arr && diepteCache.arr.length === kaart.tegels.length) return diepteCache.arr;
    var b = kaart.b, h = kaart.h, T = kaart.tegels, N = b * h;
    var d = new Int16Array(N), rij = [];
    var i, x, y;
    for (i = 0; i < N; i++) {
      if (T[i].t !== 'water') { d[i] = 0; continue; }
      x = i % b; y = (i / b) | 0;
      var kust = false;
      if (x > 0 && T[i - 1].t !== 'water') kust = true;
      else if (x < b - 1 && T[i + 1].t !== 'water') kust = true;
      else if (y > 0 && T[i - b].t !== 'water') kust = true;
      else if (y < h - 1 && T[i + b].t !== 'water') kust = true;
      if (kust) { d[i] = 1; rij.push(i); }
    }
    for (var q = 0; q < rij.length; q++) {
      i = rij[q]; x = i % b; y = (i / b) | 0;
      var buren = [x > 0 ? i - 1 : -1, x < b - 1 ? i + 1 : -1, y > 0 ? i - b : -1, y < h - 1 ? i + b : -1];
      for (var k = 0; k < 4; k++) {
        var j = buren[k];
        if (j >= 0 && T[j].t === 'water' && d[j] === 0) { d[j] = d[i] + 1; rij.push(j); }
      }
    }
    diepteCache = { seed: kaart.seed, arr: d };
    return d;
  }

  /* Welke twee ruit-hoeken een tegel deelt met elke 4-buur. */
  var BUUR = [[-1, 0, 'top', 'left'], [0, -1, 'top', 'right'], [1, 0, 'right', 'bottom'], [0, 1, 'left', 'bottom']];

  function bouwTerrein(s) {
    var kaart = s.kaart, T = kaart.tegels, b = kaart.b, h = kaart.h;
    var seizoen = s.seizoen || 0;
    var hw = TEGEL / 2, hh = TEGEL / 4;
    var g = terreinLaag;
    var diepte = berekenDiepte(kaart);
    g.clear();
    waterLaag.clear();
    for (var ty = 0; ty < h; ty++) {
      for (var tx = 0; tx < b; tx++) {
        var idx = ty * b + tx;
        var t = T[idx];
        if (!t) continue;
        var rij = TERREIN[t.t] || TERREIN.gras;
        var kleur = hexNum(rij[seizoen] || rij[0]);
        var isWater = t.t === 'water';
        var doel = isWater ? waterLaag : g;
        if (!isWater) {
          var hc = t.h || 0;
          var ul = tegelHoogte(T, b, h, tx - 1, ty - 1, hc);
          var u = tegelHoogte(T, b, h, tx, ty - 1, hc);
          var l = tegelHoogte(T, b, h, tx - 1, ty, hc);
          var dh = hc - (ul * 0.5 + u * 0.25 + l * 0.25);
          var relief = Game.util.clamp(1 + dh * 2.4, 0.8, 1.22);
          kleur = schaal(kleur, relief * (0.9 + (t.v || 0) * 0.2));
        } else {
          /* Ondiep (turquoise) → diep (donkerblauw) naar afstand tot de kust. */
          var tf = Game.util.clamp((diepte[idx] - 1) / 6, 0, 1);
          kleur = mengNum(0x79c6c0, kleur, tf);
          kleur = schaal(kleur, ((tx + ty) & 1) ? 1.03 : 0.97);
        }
        var wx = tx * TEGEL, wy = ty * TEGEL;
        var sx = isoX(wx, wy), sy = isoY(wx, wy);
        var hoek = {
          top: { x: sx, y: sy }, right: { x: sx + hw, y: sy + hh },
          bottom: { x: sx, y: sy + hh * 2 }, left: { x: sx - hw, y: sy + hh }
        };
        doel.poly([hoek.top.x, hoek.top.y, hoek.right.x, hoek.right.y, hoek.bottom.x, hoek.bottom.y, hoek.left.x, hoek.left.y]).fill(kleur);

        /* Kust: op watertegels schuim langs de land-randen, op landtegels een
           zandrand langs de water-randen — samen een strand in plaats van een
           harde ruit-grens. */
        for (var e = 0; e < 4; e++) {
          var nx = tx + BUUR[e][0], ny = ty + BUUR[e][1];
          if (nx < 0 || ny < 0 || nx >= b || ny >= h) continue;
          var buur = T[ny * b + nx];
          if (!buur) continue;
          var buurWater = buur.t === 'water';
          var a = hoek[BUUR[e][2]], c2 = hoek[BUUR[e][3]];
          var mcx = sx, mcy = sy + hh;
          if (isWater !== buurWater) {
            /* Kust: schuim aan de waterkant, zandstrand aan de landkant. */
            if (isWater) {
              waterLaag.moveTo(a.x, a.y).lineTo(c2.x, c2.y).stroke({ width: hw * 0.16, color: 0xd7efe9, alpha: 0.55 });
            } else {
              var ai = { x: a.x + (mcx - a.x) * 0.35, y: a.y + (mcy - a.y) * 0.35 };
              var ci = { x: c2.x + (mcx - c2.x) * 0.35, y: c2.y + (mcy - c2.y) * 0.35 };
              g.poly([a.x, a.y, c2.x, c2.y, ci.x, ci.y, ai.x, ai.y]).fill({ color: 0xd8c48a, alpha: 0.55 });
            }
          } else if (!isWater && buur.t !== t.t) {
            /* Zachte overgang: de buurkleur bloedt een stukje deze tegel in, zodat
               gras/bos/akker/rots niet met een harde ruit-grens tegen elkaar staan. */
            var brij = TERREIN[buur.t] || TERREIN.gras;
            var bk = schaal(hexNum(brij[seizoen] || brij[0]), 0.98);
            var bi = { x: a.x + (mcx - a.x) * 0.4, y: a.y + (mcy - a.y) * 0.4 };
            var bj = { x: c2.x + (mcx - c2.x) * 0.4, y: c2.y + (mcy - c2.y) * 0.4 };
            g.poly([a.x, a.y, c2.x, c2.y, bj.x, bj.y, bi.x, bi.y]).fill({ color: bk, alpha: 0.4 });
          }
        }

        /* Straten en bruggen: een smaller ruitje boven op de grond. */
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
    /* Ook de nacht-emmer en het seizoen: bij dag↔nacht gaan de raampjes aan,
       en de winter zet sneeuw op de daken — dus dan opnieuw opbouwen. */
    var nachtBucket = lichtStand(s).nacht > 0.5 ? 1 : 0;
    var uit = s.gebouwen.length + '|' + (s.wegTeller || 0) + '|n' + nachtBucket + '|s' + (s.seizoen || 0) + '|';
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

  /* ISO-tabel: per gebouw-id de vorm. Gekopieerd uit de oude sprites.js zodat de
     silhouetten kloppen — muurhoogte, daktype (schuin/punt/plat/geen), dakhoogte,
     muur-/dakkleur, en toeters (vlag, kruis, kantelen, torens, wieken, luifel,
     schoorsteen, smal = smallere footprint voor torens/molens/putten). */
  var ISO_D = { muurH: 0.55, stijl: 'schuin', dakH: 0.46, muur: '#c9b491', dak: '#7c4b2e' };
  var ISO = {
    dorpsplein: { muurH: 0.42, stijl: 'schuin', dakH: 0.4, muur: '#d8cba6', dak: '#7a5236', vlag: true },
    huisje: { muurH: 0.52, stijl: 'schuin', dakH: 0.48 },
    herenhuis: { muurH: 0.64, stijl: 'schuin', dakH: 0.48 },
    vakwerkhuis: { muurH: 0.6, stijl: 'schuin', dakH: 0.5 },
    boerderij: { muurH: 0.4, stijl: 'schuin', dakH: 0.34, muur: '#cdb98d', dak: '#8a5a34' },
    herberg: { muurH: 0.52, stijl: 'schuin', dakH: 0.5, uithang: true },
    stadhuis: { muurH: 0.72, stijl: 'schuin', dakH: 0.55, muur: '#d8cba6', dak: '#7a5236', vlag: true },
    handelshuis: { muurH: 0.66, stijl: 'schuin', dakH: 0.5, muur: '#d3c39c', dak: '#7a5236', vlag: true },
    universiteit: { muurH: 0.72, stijl: 'schuin', dakH: 0.52, muur: '#d8cba6', dak: '#5f5852', vlag: true },
    gildehuis: { muurH: 0.64, stijl: 'schuin', dakH: 0.5, muur: '#d3c39c', dak: '#6a5240' },
    marktplaats: { muurH: 0.3, stijl: 'plat', dakH: 0.12, muur: '#c7b083', dak: '#9c6a3a', luifel: true },
    voorraadschuur: { muurH: 0.42, stijl: 'schuin', dakH: 0.44, muur: '#b99a6a', dak: '#6e4a2c' },
    graanschuur: { muurH: 0.44, stijl: 'schuin', dakH: 0.46, muur: '#b99a6a', dak: '#6e4a2c' },
    pakhuis: { muurH: 0.5, stijl: 'schuin', dakH: 0.46, muur: '#b99a6a', dak: '#5f4530' },
    waterput: { muurH: 0.3, stijl: 'schuin', dakH: 0.4, smal: 0.5, muur: '#a9a094', dak: '#6a4a30' },
    kapel: { muurH: 0.62, stijl: 'punt', dakH: 0.95, muur: '#e2dac4', dak: '#6a6258', kruis: true },
    kerk: { muurH: 0.74, stijl: 'punt', dakH: 1.2, muur: '#e2dac4', dak: '#616058', kruis: true },
    kathedraal: { muurH: 0.9, stijl: 'punt', dakH: 1.5, muur: '#e6dfca', dak: '#5a5a54', kruis: true },
    wachttoren: { muurH: 1.15, stijl: 'punt', dakH: 0.7, smal: 0.5, muur: '#a49a8c', dak: '#7a3b2c' },
    kazerne: { muurH: 0.6, stijl: 'schuin', dakH: 0.44, muur: '#b0a692', dak: '#5f4a3a' },
    smederij: { muurH: 0.5, stijl: 'schuin', dakH: 0.44, muur: '#b8a483', dak: '#5a4636' },
    wapensmid: { muurH: 0.56, stijl: 'schuin', dakH: 0.46, muur: '#b0a08a', dak: '#5a4636' },
    kasteel: { muurH: 1.05, stijl: 'plat', dakH: 0.1, muur: '#b8b0a2', dak: '#5a3a30', kantelen: true, torens: true },
    stadsmuur: { muurH: 0.55, stijl: 'geen', dakH: 0, muur: '#9aa0a6', kantelen: true },
    poort: { muurH: 0.8, stijl: 'plat', dakH: 0.12, muur: '#8f8578', dak: '#6a3b2c', kantelen: true },
    haven: { muurH: 0.34, stijl: 'schuin', dakH: 0.38, muur: '#b0a184', dak: '#3f5a6a', vlag: true, luifel: true },
    oefenveld: { muurH: 0.24, stijl: 'geen', dakH: 0, muur: '#a7a488', vlag: true },
    molen: { muurH: 0.72, stijl: 'schuin', dakH: 0.44, smal: 0.62, muur: '#d5c7a4', dak: '#7c4b2e', wieken: true },
    steengroeve: { muurH: 0.34, stijl: 'schuin', dakH: 0.4, muur: '#b0a894', dak: '#6a5a44' },
    kopermijn: { muurH: 0.34, stijl: 'schuin', dakH: 0.4, muur: '#b0a894', dak: '#6a5a44' },
    ijzermijn: { muurH: 0.34, stijl: 'schuin', dakH: 0.4, muur: '#b0a894', dak: '#6a5a44' },
    edelsteenmijn: { muurH: 0.34, stijl: 'schuin', dakH: 0.4, muur: '#b0a894', dak: '#6a5a44' },
    houthakkershut: { muurH: 0.44, stijl: 'schuin', dakH: 0.46, muur: '#b99a6a', dak: '#5f4530' },
    jachthut: { muurH: 0.42, stijl: 'schuin', dakH: 0.46, muur: '#b99a6a', dak: '#5f4530' },
    vissershut: { muurH: 0.42, stijl: 'schuin', dakH: 0.46, muur: '#b99a6a', dak: '#5f4530' },
    bakkerij: { muurH: 0.5, stijl: 'schuin', dakH: 0.46, muur: '#cdb98d', dak: '#8a5a34', schoorsteen: true },
    brouwerij: { muurH: 0.54, stijl: 'schuin', dakH: 0.46, muur: '#cdb98d', dak: '#7a5236', schoorsteen: true },
    weverij: { muurH: 0.52, stijl: 'schuin', dakH: 0.46, muur: '#d3c39c', dak: '#6a5240' },
    schaapskooi: { muurH: 0.4, stijl: 'schuin', dakH: 0.4, muur: '#cdb98d', dak: '#8a5a34' },
    juwelier: { muurH: 0.56, stijl: 'schuin', dakH: 0.5, muur: '#d3c39c', dak: '#6a5240' }
  };
  var SCHOORSTEEN = { huisje: 1, vakwerkhuis: 1, herenhuis: 1, boerderij: 1, herberg: 1, bakkerij: 1, brouwerij: 1, smederij: 1, wapensmid: 1 };

  function isoCfg(d) {
    var b = ISO[d.id] || ISO_D;
    return {
      muurH: b.muurH != null ? b.muurH : ISO_D.muurH,
      stijl: b.stijl || ISO_D.stijl,
      dakH: b.dakH != null ? b.dakH : ISO_D.dakH,
      muur: hexNum(b.muur || ISO_D.muur),
      dak: hexNum(b.dak || ISO_D.dak),
      smal: b.smal || 0,
      vlag: b.vlag, kruis: b.kruis, kantelen: b.kantelen, torens: b.torens,
      wieken: b.wieken, luifel: b.luifel, uithang: b.uithang,
      schoorsteen: b.schoorsteen || SCHOORSTEEN[d.id]
    };
  }

  function diamantH(cx, cy, hw, hh) {
    return { top: { x: cx, y: cy - hh }, right: { x: cx + hw, y: cy }, bottom: { x: cx, y: cy + hh }, left: { x: cx - hw, y: cy }, cx: cx, cy: cy, hw: hw, hh: hh };
  }

  /* Eén iso-volume (muren + dak naar type + toeters + slagschaduw + contour +
     emoji-badge) voor een gebouw-def op tegel (gx,gy). Gedeeld door de
     gebouwlaag en het bouw-spook. opties: { id, ratio, uit, spook, badge, seizoen }. */
  function maakVolume(d, gx, gy, opties) {
    opties = opties || {};
    var G = d.grootte || 1;
    var cfg = isoCfg(d);
    var zf = zaadFactor(opties.id || (gx * 131 + gy));

    /* Footprint-ruit in iso-ruimte. */
    var t0 = isoTegel(gx, gy), r0 = isoTegel(gx + G, gy), b0 = isoTegel(gx + G, gy + G), l0 = isoTegel(gx, gy + G);
    var cx = (t0.x + b0.x) / 2, cy = (t0.y + b0.y) / 2;
    var hw = (r0.x - l0.x) / 2, hh = (b0.y - t0.y) / 2;
    var smalF = 1 - cfg.smal * 0.5;
    var foot = diamantH(cx, cy, hw * smalF, hh * smalF);

    var ratio = opties.ratio == null ? 1 : Game.util.clamp(opties.ratio, 0.12, 1);
    var H = TEGEL * cfg.muurH * (0.8 + 0.2 * G) * (0.5 + 0.5 * ratio);
    var dakH = TEGEL * cfg.dakH * (0.85 + 0.08 * G);

    var muur = schaal(cfg.muur, zf);
    var dak = schaal(cfg.dak, zf * 0.96 + 0.04);
    if (ratio < 1) { muur = 0xb7a98a; dak = 0xa89873; }   /* steiger-tint */

    var c = new PIXI.Graphics();
    var ric = schaduwRichting();

    /* 1. Slagschaduw: de footprint langs de lichtrichting uitgeveegd. */
    var sh = (H + dakH * 0.55), ox = sh * ric.x, oy = sh * ric.y;
    c.poly([foot.top.x, foot.top.y, foot.right.x, foot.right.y,
      foot.right.x + ox, foot.right.y + oy, foot.bottom.x + ox, foot.bottom.y + oy,
      foot.left.x + ox, foot.left.y + oy, foot.left.x, foot.left.y]).fill({ color: 0x18140e, alpha: 0.22 });
    /* zachte AO onder het gebouw */
    c.ellipse(cx + hw * 0.12, cy + hh * 0.3, hw * 1.02, hh * 1.0).fill({ color: 0x000000, alpha: 0.14 });

    /* 2. Muren: muurtop-ruit op hoogte H, twee voorvlakken. */
    var top = diamantH(cx, cy - H, hw * smalF, hh * smalF);
    c.poly([foot.left.x, foot.left.y, foot.bottom.x, foot.bottom.y, top.bottom.x, top.bottom.y, top.left.x, top.left.y]).fill(schaal(muur, 0.72));
    c.poly([foot.bottom.x, foot.bottom.y, foot.right.x, foot.right.y, top.right.x, top.right.y, top.bottom.x, top.bottom.y]).fill(schaal(muur, 0.9));

    /* Gevel: deuren en ramen op de muurvlakken (niet op een open muur). */
    if (cfg.stijl !== 'geen' && !cfg.wieken && G <= 4 && ratio >= 0.6) gevel(c, foot, top, G, !!opties.nacht);

    /* 3. Dak naar type. Overstek: de dakvoet is iets breder dan de muurtop. */
    if (cfg.stijl === 'schuin' || cfg.stijl === 'punt') {
      var over = diamantH(cx, cy - H, hw * smalF * 1.16, hh * smalF * 1.16);
      var apex = { x: cx, y: cy - H - dakH };
      c.poly([over.left.x, over.left.y, over.bottom.x, over.bottom.y, apex.x, apex.y]).fill(schaal(dak, 1.0));
      c.poly([over.bottom.x, over.bottom.y, over.right.x, over.right.y, apex.x, apex.y]).fill(schaal(dak, 0.88));
      c.poly([over.top.x, over.top.y, over.left.x, over.left.y, apex.x, apex.y]).fill(schaal(dak, 0.76));
      c.poly([over.right.x, over.right.y, over.top.x, over.top.y, apex.x, apex.y]).fill(schaal(dak, 0.68));
      if ((opties.seizoen | 0) === 3) {   /* sneeuwkap */
        var sd = 0.46, sa = { x: apex.x, y: apex.y };
        var sl = lerpP(sa, over.left, sd), sr = lerpP(sa, over.right, sd), sb = lerpP(sa, over.bottom, sd);
        c.poly([sa.x, sa.y, sl.x, sl.y, sb.x, sb.y]).fill({ color: 0xeef5fb, alpha: 0.85 });
        c.poly([sa.x, sa.y, sb.x, sb.y, sr.x, sr.y]).fill({ color: 0xf6fbff, alpha: 0.9 });
      }
    } else if (cfg.stijl === 'plat') {
      c.poly([top.top.x, top.top.y, top.right.x, top.right.y, top.bottom.x, top.bottom.y, top.left.x, top.left.y]).fill(schaal(muur, 0.98));
    } else { /* geen dak (muur) */
      c.poly([top.top.x, top.top.y, top.right.x, top.right.y, top.bottom.x, top.bottom.y, top.left.x, top.left.y]).fill(schaal(muur, 0.9));
    }

    /* 4. Contour over het silhouet. */
    c.moveTo(foot.left.x, foot.left.y).lineTo(foot.bottom.x, foot.bottom.y).lineTo(foot.right.x, foot.right.y)
      .moveTo(foot.left.x, foot.left.y).lineTo(top.left.x, top.left.y)
      .moveTo(foot.bottom.x, foot.bottom.y).lineTo(top.bottom.x, top.bottom.y)
      .moveTo(foot.right.x, foot.right.y).lineTo(top.right.x, top.right.y)
      .stroke({ width: Math.max(0.6, hw * 0.03), color: 0x1c140c, alpha: 0.42 });

    /* 5. Toeters. */
    var apexY = cy - H - dakH;
    if (cfg.kantelen) kantelen(c, top);
    if (cfg.torens) torens(c, foot, H, muur);
    if (cfg.luifel) luifel(c, foot, H);
    if (cfg.kruis) kruisTop(c, cx, apexY);
    if (cfg.vlag) vlagTop(c, cx, (cfg.stijl === 'plat' || cfg.stijl === 'geen') ? cy - H : apexY);
    if (cfg.wieken) wieken(c, cx, cy - H * 0.7, TEGEL, opties.tijd || 0);
    if (cfg.schoorsteen && cfg.stijl !== 'geen') c._rookpunt = schoorsteen(c, top, dakH);

    /* 6. Emoji-badge boven de nok. */
    if (d.emoji && opties.badge !== false && !cfg.wieken) {
      var badge = new PIXI.Text({ text: d.emoji, style: { fontSize: 15 } });
      badge.anchor.set(0.5, 1);
      var by = (cfg.stijl === 'plat' || cfg.stijl === 'geen') ? cy - H - 3 : apexY + dakH * 0.4;
      badge.position.set(cx, by);
      c.addChild(badge);
    }

    if (opties.spook) c.alpha = 0.6;
    else if (opties.uit) c.alpha = 0.55;
    c.zIndex = (gx + G / 2) + (gy + G / 2);
    return c;
  }

  function lerpP(a, b, t) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }

  /* Kantelen: tandjes langs de twee voor-randen van de muurtop. */
  function kantelen(c, top) {
    var randen = [[top.left, top.bottom], [top.bottom, top.right]];
    for (var e = 0; e < 2; e++) {
      var a = randen[e][0], b = randen[e][1];
      for (var i = 0; i < 3; i++) {
        var p = lerpP(a, b, 0.18 + i * 0.32);
        c.rect(p.x - 1.5, p.y - 4.5, 3, 4.5).fill(0x9aa0a6);
      }
    }
  }
  function torens(c, foot, H, muur) {
    var hoeken = [foot.left, foot.top, foot.right];
    for (var i = 0; i < hoeken.length; i++) {
      var h = hoeken[i], th = H * 1.25, tw = foot.hw * 0.28;
      c.rect(h.x - tw, h.y - th, tw * 2, th).fill(schaal(muur, 0.86));
      c.poly([h.x - tw, h.y - th, h.x + tw, h.y - th, h.x, h.y - th - tw * 1.6]).fill(0x6a4a3a);
    }
  }
  function luifel(c, foot, H) {
    c.poly([foot.left.x, foot.left.y - H * 0.5, foot.bottom.x, foot.bottom.y - H * 0.5,
      foot.bottom.x, foot.bottom.y - H * 0.5 + 4, foot.left.x, foot.left.y - H * 0.5 + 4]).fill({ color: 0xc0503a, alpha: 0.9 });
  }
  function kruisTop(c, cx, apexY) {
    c.rect(cx - 0.9, apexY - 9, 1.8, 9).fill(0xf0e6c8);
    c.rect(cx - 3.2, apexY - 6.5, 6.4, 1.8).fill(0xf0e6c8);
  }
  function vlagTop(c, cx, y) {
    c.rect(cx - 0.7, y - 13, 1.4, 13).fill(0x6a5030);
    c.poly([cx + 0.7, y - 13, cx + 9, y - 10.5, cx + 0.7, y - 8]).fill(0xc0392b);
  }
  function wieken(c, cx, cy, p, tijd) {
    var hub = { x: cx, y: cy };
    var hoek = tijd * 0.6;
    c.circle(hub.x, hub.y, 2).fill(0x4a3320);
    for (var i = 0; i < 4; i++) {
      var a = hoek + i * Math.PI / 2;
      var ex = hub.x + Math.cos(a) * p * 0.34, ey = hub.y + Math.sin(a) * p * 0.34;
      c.moveTo(hub.x, hub.y).lineTo(ex, ey).stroke({ width: 2, color: 0x6a5236, alpha: 0.95 });
    }
  }
  function schoorsteen(c, top, dakH) {
    var x = top.cx + top.hw * 0.3, y = top.cy - dakH * 0.3;
    c.rect(x - 2, y - 7, 4, 7).fill(0x7a5040);
    c.rect(x - 2.6, y - 8, 5.2, 1.6).fill(0x5f3d30);
    return { x: x, y: y - 8 };   /* rookpunt boven de schoorsteen */
  }

  /* Deuren en ramen op de twee zichtbare muurvlakken. Elk vlak is een
     parallellogram: u loopt langs de grond, v omhoog langs de muur; een raam is
     een rechthoekje in die (s,t)-ruimte. 's Nachts gloeien de ramen warm. */
  function vlakPunt(bl, u, v, s, t) { return { x: bl.x + u.x * s + v.x * t, y: bl.y + u.y * s + v.y * t }; }
  function raam(c, bl, u, v, s0, t0, w, hgt, nacht) {
    var p1 = vlakPunt(bl, u, v, s0, t0), p2 = vlakPunt(bl, u, v, s0 + w, t0),
      p3 = vlakPunt(bl, u, v, s0 + w, t0 + hgt), p4 = vlakPunt(bl, u, v, s0, t0 + hgt);
    c.poly([p1.x, p1.y, p2.x, p2.y, p3.x, p3.y, p4.x, p4.y]).fill(nacht ? 0xffcf72 : 0x41545c);
    c.poly([p1.x, p1.y, p2.x, p2.y, p3.x, p3.y, p4.x, p4.y]).stroke({ width: 0.8, color: 0x2a1f14, alpha: 0.55 });
  }
  function gevel(c, foot, top, G, nacht) {
    var faces = [
      { bl: foot.bottom, br: foot.right, tl: top.bottom, voor: true },   /* rechtervlak (voorkant) */
      { bl: foot.left, br: foot.bottom, tl: top.left, voor: false }      /* linkervlak */
    ];
    var aantal = Game.util.clamp(G, 1, 3);
    for (var f = 0; f < faces.length; f++) {
      var F = faces[f];
      var u = { x: F.br.x - F.bl.x, y: F.br.y - F.bl.y };
      var v = { x: F.tl.x - F.bl.x, y: F.tl.y - F.bl.y };
      /* ramen verdeeld over de breedte, halverwege de muur */
      for (var i = 0; i < aantal; i++) {
        var s = (i + 0.5) / aantal - 0.075;
        if (F.voor && aantal === 1) s = 0.66;   /* laat plek voor de deur */
        raam(c, F.bl, u, v, s, 0.34, 0.15, 0.3, nacht);
      }
      if (F.voor) {
        /* deur onderaan het voorvlak */
        var p1 = vlakPunt(F.bl, u, v, 0.16, 0), p2 = vlakPunt(F.bl, u, v, 0.16 + 0.15, 0),
          p3 = vlakPunt(F.bl, u, v, 0.16 + 0.15, 0.42), p4 = vlakPunt(F.bl, u, v, 0.16, 0.42);
        c.poly([p1.x, p1.y, p2.x, p2.y, p3.x, p3.y, p4.x, p4.y]).fill(0x5a3d26);
        c.poly([p1.x, p1.y, p2.x, p2.y, p3.x, p3.y, p4.x, p4.y]).stroke({ width: 0.8, color: 0x2a1c10, alpha: 0.5 });
      }
    }
  }

  function bouwGebouwen(s) {
    /* Alleen gebouwen en hun props opnieuw; wandelaars, dieren en rovers leven
       verder in dezelfde laag en blijven staan (ze worden apart bijgehouden). */
    var kinderen = gebouwLaag.children.slice();
    for (var k = 0; k < kinderen.length; k++) {
      var c = kinderen[k];
      if (c._soort === 'gebouw' || c._soort === 'prop') { gebouwLaag.removeChild(c); c.destroy({ children: true }); }
    }
    var nacht = lichtStand(s).nacht > 0.5;
    var seizoen = s.seizoen || 0;
    schoorstenen = [];
    for (var i = 0; i < s.gebouwen.length; i++) {
      var g = s.gebouwen[i];
      var d = Game.config.gebouw(g.type);
      if (!d) continue;
      var ratio = 1;
      if (!g.gebouwd && d.bouwtijd) ratio = (g.voortgang || 0) / d.bouwtijd;
      var vol = maakVolume(d, g.x, g.y, { id: g.id, ratio: ratio, uit: g.uit, nacht: nacht, seizoen: seizoen });
      vol._soort = 'gebouw';
      gebouwLaag.addChild(vol);
      if (vol._rookpunt && g.gebouwd && !g.uit) schoorstenen.push(vol._rookpunt);
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

  /* ---------------------------------- terreinkenmerken (bomen/rotsen/bergen) */

  function schaduwRichting() { return (Game.render.sfeer && Game.render.sfeer.SCHADUW) || { x: 0.62, y: 0.30 }; }

  /* De grondschaduw van een staand ding: een donkere ellips, weggeleund langs de
     ene lichtrichting die de hele scène deelt. */
  function grondschaduw(g, cx, cy, straal, hoogte, alpha) {
    var ric = schaduwRichting();
    g.ellipse(cx + hoogte * ric.x * 0.5, cy + hoogte * ric.y * 0.5, straal + hoogte * 0.28, straal * 0.55)
      .fill({ color: 0x181410, alpha: alpha });
  }

  /* Iso-ruit van tegel (x,y) in wereld-ruimte: middelpunt + halve maten. */
  function tegelDiamant(x, y) {
    var sx = isoX(x * TEGEL, y * TEGEL), sy = isoY(x * TEGEL, y * TEGEL);
    return { cx: sx, cy: sy + TEGEL / 4, hw: TEGEL / 2, hh: TEGEL / 4, topx: sx, topy: sy };
  }

  var BLADKLEUR = [0x3a6b2f, 0x356428, 0x8a5f1e, 0x51624e];

  function boomVorm(g, ox, oy, deel, seizoen, seed) {
    var blad = BLADKLEUR[seizoen] || BLADKLEUR[0];
    var r = TEGEL * (0.15 + deel * 0.08);
    /* stam */
    g.rect(ox - TEGEL * 0.028, oy - TEGEL * 0.16, TEGEL * 0.056, TEGEL * 0.18).fill(0x4a3320);
    var lagen = [
      { y: oy - TEGEL * 0.16, rr: r, k: schaal(blad, 0.78) },
      { y: oy - TEGEL * 0.30, rr: r * 0.82, k: blad },
      { y: oy - TEGEL * 0.42, rr: r * 0.6, k: schaal(blad, 1.12) }
    ];
    for (var i = 0; i < lagen.length; i++) {
      var L = lagen[i];
      var dx = ((((seed * 40 + i * 17) % 6) / 6) - 0.5) * TEGEL * 0.05;
      g.ellipse(ox + dx, L.y, L.rr, L.rr * 0.92).fill(L.k);
    }
    if (seizoen === 3) g.ellipse(ox, oy - TEGEL * 0.42, r * 0.6, r * 0.28).fill({ color: 0xf8fcff, alpha: 0.72 });
  }

  function maakBoom(t, x, y, seizoen) {
    var c = new PIXI.Graphics();
    var d = tegelDiamant(x, y);
    var deel = t.max > 0 ? Game.util.clamp(t.amt / t.max, 0, 1) : 0.7;
    var aantal = Math.max(1, Math.round(1 + deel * 2));
    for (var i = 0; i < aantal; i++) {
      var ox = d.cx + TEGEL * (((i * 37 + t.v * 100) % 46) / 100 - 0.23);
      var oy = d.cy + TEGEL * (((i * 61 + t.v * 70) % 20) / 100 - 0.06);
      grondschaduw(c, ox, oy + TEGEL * 0.03, TEGEL * 0.11, TEGEL * (0.34 + deel * 0.16), 0.2);
      boomVorm(c, ox, oy, deel, seizoen, t.v + i);
    }
    return c;
  }

  function maakRots(t, x, y) {
    var c = new PIXI.Graphics();
    var d = tegelDiamant(x, y);
    var aantal = 1 + Math.floor(((t.v * 5.7) % 1) * 3);
    for (var i = 0; i < aantal; i++) {
      var ox = d.cx + TEGEL * (((i * 41 + t.v * 90) % 50) / 100 - 0.25);
      var oy = d.cy + TEGEL * (((i * 67 + t.v * 60) % 26) / 100 - 0.1);
      grondschaduw(c, ox, oy + TEGEL * 0.05, TEGEL * 0.1, TEGEL * 0.14, 0.18);
      var r = TEGEL * (0.1 + ((i * 13 + t.v * 30) % 8) / 100);
      c.poly([ox - r, oy + r * 0.5, ox - r * 0.4, oy - r, ox + r * 0.6, oy - r * 0.8, ox + r, oy + r * 0.5]).fill(0x7f7b72);
      c.poly([ox - r * 0.4, oy - r, ox + r * 0.6, oy - r * 0.8, ox + r * 0.15, oy + r * 0.1]).fill(0xb3afa4);
    }
    return c;
  }

  function maakBerg(t, x, y) {
    var c = new PIXI.Graphics();
    var d = tegelDiamant(x, y);
    var top = { x: d.topx, y: d.topy }, bottom = { x: d.cx, y: d.cy + d.hh };
    var left = { x: d.cx - d.hw, y: d.cy }, right = { x: d.cx + d.hw, y: d.cy };
    var r1 = (t.v * 7.31) % 1, r2 = (t.v * 13.77) % 1;
    var H = TEGEL * (0.55 + r1 * 1.25);
    var apex = { x: d.cx + (r2 - 0.5) * TEGEL * 0.34, y: d.cy - H };
    grondschaduw(c, d.cx, d.cy + d.hh * 0.2, d.hw * 0.8, H * 0.5, 0.2);
    function tri(a, b, e, k) { c.poly([a.x, a.y, b.x, b.y, e.x, e.y]).fill(k); }
    if (r2 > 0.3) {
      var kant = r1 > 0.5 ? 1 : -1;
      var sub = { x: d.cx + kant * d.hw * 0.5, y: d.cy - H * (0.4 + r2 * 0.3) };
      tri(left, bottom, sub, 0x4e4941); tri(bottom, right, sub, 0x63594c);
    }
    tri(left, bottom, apex, 0x5e574d); tri(bottom, right, apex, 0x7d7365);
    tri(top, left, apex, 0x484238); tri(top, right, apex, 0x665e52);
    /* Sneeuwkap op de hogere toppen (of elke top in de winter). */
    if (r1 > 0.45) {
      var kapY = apex.y + H * 0.28;
      var sl = { x: apex.x + (left.x - apex.x) * 0.28, y: kapY };
      var sr = { x: apex.x + (right.x - apex.x) * 0.28, y: kapY };
      var sb = { x: apex.x + (bottom.x - apex.x) * 0.28, y: apex.y + H * 0.34 };
      tri(apex, sl, sb, 0xeef4fa); tri(apex, sb, sr, 0xf6fbff);
    }
    return c;
  }

  function maakHert(t, x, y) {
    var c = new PIXI.Graphics();
    var d = tegelDiamant(x, y);
    var ox = d.cx, oy = d.cy + TEGEL * 0.04;
    grondschaduw(c, ox, oy + TEGEL * 0.02, TEGEL * 0.1, TEGEL * 0.06, 0.16);
    c.ellipse(ox, oy - TEGEL * 0.12, TEGEL * 0.11, TEGEL * 0.07).fill(0x8a6a44);   /* romp */
    c.rect(ox + TEGEL * 0.06, oy - TEGEL * 0.2, TEGEL * 0.025, TEGEL * 0.1).fill(0x8a6a44); /* nek */
    c.circle(ox + TEGEL * 0.09, oy - TEGEL * 0.22, TEGEL * 0.035).fill(0x9a7a52);   /* kop */
    c.rect(ox + TEGEL * 0.1, oy - TEGEL * 0.28, TEGEL * 0.012, TEGEL * 0.06).fill(0x5a4630); /* gewei */
    return c;
  }

  function wisKenmerken() {
    if (!gebouwLaag) return;
    var k = gebouwLaag.children.slice();
    for (var i = 0; i < k.length; i++) if (k[i]._soort === 'kenmerk') { gebouwLaag.removeChild(k[i]); k[i].destroy({ children: true }); }
  }

  function bouwKenmerken(s) {
    wisKenmerken();
    var kaart = s.kaart, T = kaart.tegels, b = kaart.b, h = kaart.h, seizoen = s.seizoen || 0;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < b; x++) {
        var t = T[y * b + x]; if (!t) continue;
        var c = null;
        if (t.t === 'bos') c = maakBoom(t, x, y, seizoen);
        else if (t.t === 'rots') c = maakRots(t, x, y);
        else if (t.t === 'berg') c = maakBerg(t, x, y);
        else if (t.t === 'gras' && t.n === 'wild' && t.amt > 0) c = maakHert(t, x, y);
        if (c) { c._soort = 'kenmerk'; c.zIndex = x + y + 1; gebouwLaag.addChild(c); }
      }
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
  var rookTimer = 0;
  var Deeltjes = {
    reset: function () { deeltjes.length = 0; if (particleLaag) particleLaag.clear(); },
    stof: function (wx, wy, kracht) {
      var tx = wx / 40, ty = wy / 40;
      var ix = isoX(tx * TEGEL, ty * TEGEL), iy = isoY(tx * TEGEL, ty * TEGEL);
      var n = kracht || 3;
      for (var i = 0; i < n; i++) {
        deeltjes.push({ x: ix + (rnd() - 0.5) * 6, y: iy - 3, vx: (rnd() - 0.5) * 22, vy: -10 - rnd() * 16, leven: 0.5 + rnd() * 0.6, t: 0, r: 2 + rnd() * 3, kleur: 0xb0966e, zwaarte: 30, alpha0: 0.5, groei: 2 });
      }
    },
    emit: function () {}
  };

  /* Rook uit de schoorstenen: stijgt langzaam, dijt uit, vervaagt, met wat wind. */
  function tickRook(dt) {
    if (!schoorstenen.length) return;
    rookTimer -= dt;
    if (rookTimer > 0) return;
    rookTimer = 0.35;
    for (var i = 0; i < schoorstenen.length; i++) {
      var r = schoorstenen[i];
      deeltjes.push({ x: r.x + (rnd() - 0.5) * 2, y: r.y, vx: 4 + rnd() * 4, vy: -7 - rnd() * 5, leven: 1.8 + rnd() * 1.2, t: 0, r: 1.6 + rnd() * 1.4, kleur: 0xc4c2bd, zwaarte: -3, alpha0: 0.3, groei: 3 });
    }
  }

  function tickDeeltjes(dt) {
    if (!particleLaag) return;
    particleLaag.clear();
    for (var i = deeltjes.length - 1; i >= 0; i--) {
      var p = deeltjes[i];
      p.t += dt;
      if (p.t >= p.leven) { deeltjes.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.zwaarte || 30) * dt;
      var a = 1 - p.t / p.leven;
      particleLaag.circle(p.x, p.y, p.r * (1 + p.t * (p.groei || 2))).fill({ color: p.kleur || 0xb0966e, alpha: a * (p.alpha0 || 0.5) });
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
      bouwKenmerken(s);              /* bomen, rotsen, bergen, herten */
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
    tekenGloed(s);
    tekenHemel(s, cam);
    tekenLicht(s, cam);
    if (dispSprite) { dispSprite.x = (klok * 7) % 128; dispSprite.y = (klok * 4) % 128; }

    app.render();
  };

  /* Warme avondgloed rond de gebouwen (additief), sterker naarmate het donkerder
     wordt — samen met de verlichte ramen leest een stad 's nachts als bewoond. */
  function tekenGloed(s) {
    if (!gloedLaag) return;
    gloedLaag.clear();
    var nachtN = lichtStand(s).nacht;
    if (nachtN < 0.28) return;
    var a = (nachtN - 0.28) / 0.72;
    for (var i = 0; i < s.gebouwen.length; i++) {
      var g = s.gebouwen[i];
      if (!g.gebouwd || g.uit) continue;
      var d = Game.config.gebouw(g.type); if (!d) continue;
      var G = d.grootte || 1;
      var wx = (g.x + G / 2) * TEGEL, wy = (g.y + G / 2) * TEGEL;
      var ix = isoX(wx, wy), iy = isoY(wx, wy) - TEGEL * 0.2;
      gloedLaag.circle(ix, iy, TEGEL * (0.55 + G * 0.18)).fill({ color: 0xff8a2c, alpha: 0.05 * a });
      gloedLaag.circle(ix, iy, TEGEL * (0.3 + G * 0.1)).fill({ color: 0xffbf6a, alpha: 0.06 * a });
    }
  }

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
  R.tickEffecten = function (s, dt) { if (!klaar) return; tickRook(dt); tickDeeltjes(dt); tickFloaters(s, dt); };

  /* --------------------------------------------- nog te porten (no-ops) ---- */
  R.tijdperkSweep = function () {};
  R.schok = function () {};
  R.flits = function () {};

  Game.render.renderer = R;
  Game.render.particles = Deeltjes;   /* stof() uit construction/raids landt nu hier */

})(window.Game);
