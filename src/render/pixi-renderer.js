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

  /* Terreinpalet komt uit js/render/palet.js (AoE2-geijkt, per seizoen), met een
     terugval hier zodat de renderlaag nooit stukloopt als palet niet geladen is.
     Vier varianten per terrein; t.v/het seizoen kiest er een. */
  var PAL = (Game.render && Game.render.palet) || null;
  var TERREIN = PAL ? PAL.terrein : {
    gras:       [0x6f9646, 0x74923c, 0x93923f, 0xc9cfc4],
    vruchtbaar: [0x8f7d3c, 0xa08636, 0xac8a33, 0xbfc0b0],
    bos:        [0x3f6033, 0x3a5c2c, 0x5c5f2a, 0x7f8c7a],
    rots:       [0x817d73, 0x817d73, 0x7d786d, 0x9d9d9a],
    berg:       [0x625d54, 0x625d54, 0x5e5850, 0x8d8d8d],
    water:      [0x3f6f8f, 0x42749a, 0x3c6a89, 0x4a6f85]
  };
  var WEGKLEUR = PAL ? PAL.weg : 0xbfa878;         /* aangestampt zand */
  var BRUGKLEUR = PAL ? PAL.brug : 0xa9865b;       /* houten dek */
  var LUCHT = PAL ? PAL.lucht : 0x8fb3cf;          /* off-map = zee/lucht */
  /* Spelerskleur (AoE2-blauw): vlaggen, banieren, daknok, deuren, unit-tunieken. */
  var SPELER = PAL ? PAL.speler : 0x2f57c8;
  var SPELER_LICHT = PAL ? PAL.spelerLicht : 0x5f83e0;
  var SPELER_DONKER = PAL ? PAL.spelerDonker : 0x1d3a94;

  /* Textuur-matrix voor de terreinvulling: de ruistextuur wordt in wereld-ruimte
     (textureSpace 'global') herhaald, zo klein geschaald dat de korrel natuurlijk
     aanvoelt en over de tegelgrenzen doorloopt. Lui opgebouwd (PIXI moet er zijn). */
  /* De multiply-tint die `basis` naar `doel` trekt: per kanaal 255*doel/basis.
     Vermenigvuldigen kan alleen donkerder maken, dus dit werkt zolang doel niet
     lichter is dan basis — bij water is basis de lichtste (ondiepe) kleur. */
  function deelKleur(doel, basis) {
    var o = 0, sch = [16, 8, 0];
    for (var i = 0; i < 3; i++) {
      var dv = (doel >> sch[i]) & 255, bv = (basis >> sch[i]) & 255;
      var v = bv ? Math.round(255 * dv / bv) : 255;
      o |= (v > 255 ? 255 : v < 0 ? 0 : v) << sch[i];
    }
    return o;
  }

  var TEXMAT = null;
  function terreinTex(soort, seizoen) {
    var tt = Game.render.terreintextuur;
    if (!tt) return null;
    var tex = tt.get(soort, seizoen);
    if (tex && !TEXMAT && window.PIXI) { TEXMAT = new PIXI.Matrix(); TEXMAT.scale(1.05, 1.05); }
    return TEXMAT ? tex : null;
  }

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
  var waterAnimLaag, wolkenLaag, vogelLaag, weerLaag;
  var schoorstenen = [];              /* iso-rookpunten van gebouwen met een haard */
  var weer = { fase: 'droog', t: 12, intens: 0, natheid: 0 };   /* render-only weerstaat */
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
      /* Echte bloom op de gloed (pixi-filters), met terugval op de kale gloed. */
      try {
        if (window.PIXIFilters && window.PIXIFilters.AdvancedBloomFilter) {
          gloedLaag.filters = [new window.PIXIFilters.AdvancedBloomFilter({ threshold: 0.05, bloomScale: 1.4, brightness: 1.05, blur: 7, quality: 4 })];
        }
      } catch (e) { /* geen bloom → gewoon de additieve gloed */ }
      particleLaag = new PIXI.Graphics();          /* stof/rook, boven de gebouwen */
      floaterLaag = new PIXI.Container();          /* opbrengst-cijfertjes */
      waterAnimLaag = new PIXI.Graphics();         /* rimpels + schittering op het water */
      wolkenLaag = new PIXI.Graphics();            /* drijvende wolkenschaduwen op het land */
      wereld.addChild(waterLaag);
      wereld.addChild(waterAnimLaag);
      wereld.addChild(terreinLaag);
      wereld.addChild(rasterLaag);
      wereld.addChild(overlayLaag);
      wereld.addChild(wolkenLaag);
      wereld.addChild(gebouwLaag);
      wereld.addChild(gloedLaag);
      wereld.addChild(particleLaag);
      wereld.addChild(floaterLaag);
      wereld.addChild(spookLaag);
      app.stage.addChild(wereld);

      vogelLaag = new PIXI.Graphics();             /* vogels, scherm-ruimte */
      app.stage.addChild(vogelLaag);
      weerLaag = new PIXI.Graphics();              /* regen + mist, scherm-ruimte */
      app.stage.addChild(weerLaag);

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
    /* De BFS levert hele stappen op, en dat gaf een zichtbaar getrapte
       dieptegradiënt: elke ruit een eigen tint. Twee box-blur-passes maken er
       een vloeiend veld van, zodat ondiep→diep geleidelijk verloopt in plaats
       van per tegel te springen. Land blijft 0 (de kustlijn). */
    var z = new Float32Array(N), z2 = new Float32Array(N);
    for (i = 0; i < N; i++) z[i] = d[i];
    for (var pas = 0; pas < 2; pas++) {
      for (i = 0; i < N; i++) {
        if (T[i].t !== 'water') { z2[i] = 0; continue; }
        x = i % b; y = (i / b) | 0;
        var som = z[i], tel = 1;
        if (x > 0) { som += z[i - 1]; tel++; }
        if (x < b - 1) { som += z[i + 1]; tel++; }
        if (y > 0) { som += z[i - b]; tel++; }
        if (y < h - 1) { som += z[i + b]; tel++; }
        z2[i] = som / tel;
      }
      z.set(z2);
    }
    diepteCache = { seed: kaart.seed, arr: z };
    return z;
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
        var kleur = rij[seizoen] != null ? rij[seizoen] : rij[0];
        var isWater = t.t === 'water';
        var doel = isWater ? waterLaag : g;
        var tint = 0xffffff, tex = null;
        if (!isWater) {
          var hc = t.h || 0;
          var ul = tegelHoogte(T, b, h, tx - 1, ty - 1, hc);
          var u = tegelHoogte(T, b, h, tx, ty - 1, hc);
          var l = tegelHoogte(T, b, h, tx - 1, ty, hc);
          var dh = hc - (ul * 0.5 + u * 0.25 + l * 0.25);
          var relief = Game.util.clamp(1 + dh * 2.4, 0.8, 1.22);
          /* De geschilderde terreintextuur draagt kleur én variatie; alleen de
             hillshade wordt er als multiply-tint overheen gelegd. Bewust géén
             per-tegel-ruis meer in de tint: die maakte een zichtbaar dambord,
             terwijl de textuur (global textureSpace) juist naadloos doorloopt.
             Zonder textuur valt alles terug op platte kleur (mét t.v-ruis). */
          var mul = Game.util.clamp(relief * 0.94 + 0.05, 0.62, 1);
          tex = terreinTex(t.t, seizoen);
          if (tex) tint = schaal(0xffffff, mul);
          else kleur = schaal(kleur, relief * (0.9 + (t.v || 0) * 0.2));
        } else {
          /* Ondiep (turquoise) → diep (donkerblauw) over het vloeiend gemaakte
             diepteveld. Bewust géén per-tegel-ruis meer: het oude
             ((tx+ty)&1)-trucje was letterlijk een dambord over de zee. */
          var tf = Game.util.clamp((diepte[idx] - 0.4) / 4.2, 0, 1);
          tf = tf * tf * (3 - 2 * tf);                     /* smoothstep */
          kleur = mengNum(PAL ? PAL.waterOndiep : 0x8fd0c8, kleur, tf);
        }
        var wx = tx * TEGEL, wy = ty * TEGEL;
        var sx = isoX(wx, wy), sy = isoY(wx, wy);
        var hoek = {
          top: { x: sx, y: sy }, right: { x: sx + hw, y: sy + hh },
          bottom: { x: sx, y: sy + hh * 2 }, left: { x: sx - hw, y: sy + hh }
        };
        var poly = [hoek.top.x, hoek.top.y, hoek.right.x, hoek.right.y, hoek.bottom.x, hoek.bottom.y, hoek.left.x, hoek.left.y];
        if (isWater) {
          /* Water: één vulling met de golftextuur (gebakken in de ondiep-kleur),
             met een multiply-tint die hem naar de juiste diepte trekt. Omdat de
             textuur in wereld-ruimte ligt (textureSpace 'global') loopt het
             golfdetail over de tegelgrenzen door en verdwijnen de ruit-naden. */
          var wtex = terreinTex('water', seizoen);
          if (wtex) doel.poly(poly).fill({ texture: wtex, color: deelKleur(kleur, PAL ? PAL.waterOndiep : 0x93d6cd), matrix: TEXMAT, textureSpace: 'global' });
          else doel.poly(poly).fill(kleur);
        } else if (tex) doel.poly(poly).fill({ texture: tex, color: tint, matrix: TEXMAT, textureSpace: 'global' });
        else doel.poly(poly).fill(kleur);

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
              /* Branding: een brede zachte band met een smalle heldere kam erop. */
              waterLaag.moveTo(a.x, a.y).lineTo(c2.x, c2.y).stroke({ width: hw * 0.34, color: 0xbfe6e2, alpha: 0.3 });
              waterLaag.moveTo(a.x, a.y).lineTo(c2.x, c2.y).stroke({ width: hw * 0.13, color: 0xecfbf7, alpha: 0.65 });
            } else {
              var ai = { x: a.x + (mcx - a.x) * 0.42, y: a.y + (mcy - a.y) * 0.42 };
              var ci = { x: c2.x + (mcx - c2.x) * 0.42, y: c2.y + (mcy - c2.y) * 0.42 };
              g.poly([a.x, a.y, c2.x, c2.y, ci.x, ci.y, ai.x, ai.y]).fill({ color: 0xd8c48a, alpha: 0.5 });
              /* Nat zand: een donkerder, verzadigder randje pal aan het water. */
              var aw = { x: a.x + (mcx - a.x) * 0.16, y: a.y + (mcy - a.y) * 0.16 };
              var cw = { x: c2.x + (mcx - c2.x) * 0.16, y: c2.y + (mcy - c2.y) * 0.16 };
              g.poly([a.x, a.y, c2.x, c2.y, cw.x, cw.y, aw.x, aw.y]).fill({ color: 0xa8905c, alpha: 0.45 });
            }
          } else if (!isWater && buur.t !== t.t) {
            /* Zachte overgang: de buurkleur bloedt in twee lagen deze tegel in —
               een brede zwakke en een smalle sterke band — zodat gras/bos/akker/
               rots niet met een harde ruit-grens tegen elkaar staan maar in elkaar
               overvloeien. Textuur van de buur gebruiken als die er is. */
            var brij = TERREIN[buur.t] || TERREIN.gras;
            var btex = terreinTex(buur.t, seizoen);
            var bk = schaal(brij[seizoen] != null ? brij[seizoen] : brij[0], 0.98);
            var diep = [0.6, 0.32], alfa = [0.34, 0.5];
            for (var bl = 0; bl < 2; bl++) {
              var bi = { x: a.x + (mcx - a.x) * diep[bl], y: a.y + (mcy - a.y) * diep[bl] };
              var bj = { x: c2.x + (mcx - c2.x) * diep[bl], y: c2.y + (mcy - c2.y) * diep[bl] };
              var band = [a.x, a.y, c2.x, c2.y, bj.x, bj.y, bi.x, bi.y];
              if (btex) g.poly(band).fill({ texture: btex, color: schaal(0xffffff, mul), matrix: TEXMAT, textureSpace: 'global', alpha: alfa[bl] });
              else g.poly(band).fill({ color: bk, alpha: alfa[bl] });
            }
          }
        }

        /* Grond-strooisel: keitjes, graspollen en bloemen bovenop de grond,
           ingebakken in de statische terreinlaag (geen per-frame kost). Breekt
           de vlakte bij middel-zoom. Alleen op open gras/akker zonder weg. */
        if (!isWater && !t.weg && (t.t === 'gras' || t.t === 'vruchtbaar')) {
          strooiGrond(g, t, sx, sy + hh, hw, hh, seizoen);
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

  /* Deterministische per-tegel LCG uit t.v (niet Math.random, niet de sim-RNG),
     zodat het strooisel elke keer identiek is en de simulatie ongemoeid blijft. */
  function tegelRng(t) {
    var s = ((t.v * 233280) | 0) + 1;
    return function () { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  }

  /* Strooi 0..3 kleine grond-elementen binnen de ruit (cx,cy = ruitmidden). */
  function strooiGrond(g, t, cx, cy, hw, hh, seizoen) {
    var r = tegelRng(t);
    if (r() > 0.62) return;                       /* ~38% van de tegels */
    var n = 1 + (r() < 0.5 ? 1 : 0);
    var winter = seizoen === 3;
    for (var i = 0; i < n; i++) {
      /* punt binnen de ruit: schaal de offset zodat het in de diamant valt */
      var u = (r() - 0.5), v = (r() - 0.5);
      var px = cx + (u - v) * hw * 0.7;
      var py = cy + (u + v) * hh * 0.7;
      var soort = r();
      if (soort < 0.4) {
        /* keitje */
        var br = 1.1 + r() * 1.6;
        blob(g, px, py + br * 0.3, br * 1.1, br * 0.5, { color: 0x000000, alpha: 0.12 });
        g.poly([px - br, py, px - br * 0.4, py - br, px + br * 0.6, py - br * 0.7, px + br, py]).fill(0x8b8478);
        g.poly([px - br * 0.4, py - br, px + br * 0.6, py - br * 0.7, px + br * 0.1, py - br * 0.15]).fill(0x969084);
      } else if (soort < 0.82 || winter) {
        /* graspol: een paar korte opstaande sprietjes */
        var kl = winter ? 0x9a9576 : (t.t === 'vruchtbaar' ? 0x8a9a4a : (seizoen === 2 ? 0x93923f : 0x5f8038));
        var kt = r() * 1.2 - 0.6;
        for (var k = -1; k <= 1; k++) {
          g.moveTo(px + k * 1.1, py).quadraticCurveTo(px + k * 1.1 + kt, py - 2.4, px + k * 1.1 + kt * 1.6, py - 4 - r() * 1.5)
            .stroke({ width: 0.9, color: kl, alpha: 0.85 });
        }
      } else {
        /* bloempje: steel + gekleurde kop */
        var bkl = [0xe8dd9a, 0xdce4dd, 0xdb9cba, 0xe4b658][(r() * 4) | 0];
        g.moveTo(px, py).lineTo(px + (r() - 0.5) * 1.4, py - 3.5).stroke({ width: 0.8, color: 0x4c6f2f, alpha: 0.8 });
        g.circle(px + (r() - 0.5) * 1.4, py - 4, 0.85).fill({ color: bkl, alpha: 0.9 });
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
  /* Dakmateriaal per gebouw: riet voor hutten/schuren/boerderijen, lei voor
     kerken/vestingwerk/hallen, pan (dakpannen) voor de rest. */
  var LEIDAK = { kapel: 1, kerk: 1, kathedraal: 1, wachttoren: 1, poort: 1, kasteel: 1, stadhuis: 1, universiteit: 1, gildehuis: 1 };
  var RIETDAK = { huisje: 1, boerderij: 1, herberg: 1, voorraadschuur: 1, graanschuur: 1, pakhuis: 1, schaapskooi: 1, houthakkershut: 1, jachthut: 1, vissershut: 1, steengroeve: 1, kopermijn: 1, ijzermijn: 1, edelsteenmijn: 1 };
  /* Huizen met een half-timber gevel (vakwerk). */
  var VAKWERK = { vakwerkhuis: 1, herenhuis: 1, herberg: 1 };
  function dakstijlVoor(id) { return LEIDAK[id] ? 'lei' : (RIETDAK[id] ? 'riet' : 'pan'); }

  function isoCfg(d) {
    var b = ISO[d.id] || ISO_D;
    return {
      muurH: b.muurH != null ? b.muurH : ISO_D.muurH,
      stijl: b.stijl || ISO_D.stijl,
      dakH: b.dakH != null ? b.dakH : ISO_D.dakH,
      muur: hexNum(b.muur || ISO_D.muur),
      dak: hexNum(b.dak || ISO_D.dak),
      smal: b.smal || 0,
      dakstijl: dakstijlVoor(d.id),
      vakwerk: !!VAKWERK[d.id],
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

    /* Muurmateriaal: steenverband op vesting-/kerkwerk, pleisternerf op de rest.
       Zonder dit blijft een muur een egaal kleurvlak, en dat is wat een gebouw
       plat en cartoonesk maakt. */
    if (ratio >= 0.7) muurTextuur(c, foot, top, muur, !!(cfg.kantelen || LEIDAK[d.id]));

    /* Gevel: deuren en ramen op de muurvlakken (niet op een open muur). */
    if (cfg.stijl !== 'geen' && !cfg.wieken && G <= 4 && ratio >= 0.6) gevel(c, foot, top, G, !!opties.nacht);
    /* Vakwerk: donker houtskelet over de pleistermuren van de betere huizen. */
    if (cfg.vakwerk && ratio >= 0.8) vakwerk(c, foot, top);

    /* 3. Dak naar type. Overstek: de dakvoet is iets breder dan de muurtop. */
    if (cfg.stijl === 'schuin' || cfg.stijl === 'punt') {
      var over = diamantH(cx, cy - H, hw * smalF * 1.16, hh * smalF * 1.16);
      var apex = { x: cx, y: cy - H - dakH };
      c.poly([over.left.x, over.left.y, over.bottom.x, over.bottom.y, apex.x, apex.y]).fill(schaal(dak, 1.0));
      c.poly([over.bottom.x, over.bottom.y, over.right.x, over.right.y, apex.x, apex.y]).fill(schaal(dak, 0.88));
      c.poly([over.top.x, over.top.y, over.left.x, over.left.y, apex.x, apex.y]).fill(schaal(dak, 0.76));
      c.poly([over.right.x, over.right.y, over.top.x, over.top.y, apex.x, apex.y]).fill(schaal(dak, 0.68));
      /* Dakmateriaal-textuur op de twee voordak-vlakken (onder de sneeuw). */
      if (ratio >= 0.8) {
        dakTextuur(c, over.left, over.bottom, apex, cfg.dakstijl, dak);
        dakTextuur(c, over.bottom, over.right, apex, cfg.dakstijl, dak);
      }
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
    /* Spelerskleur: een blauwe banier tegen de voorgevel van vlag-dragende (dus
       civiele) gebouwen — het AoE2-detail dat een stad meteen 'van jou' maakt. */
    if (cfg.vlag && cfg.stijl !== 'geen' && ratio >= 0.8) banier(c, foot, top);
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

  /* Dakmateriaal-textuur: lijnen evenwijdig aan de dakvoet op een dakvlak.
     riet = weinig, warme banden; pan = dakpanrijen; lei = fijne donkere lijnen. */
  function dakTextuur(c, a, b, apex, stijl, dak) {
    /* Rijen evenwijdig aan de dakvoet. Een dak van één egale kleur is wat een
       gebouw plat maakt, dus: dakpannen krijgen om-en-om lichte/donkere banden
       met stootnaadjes, leien fijne donkere rijen, riet een paar dikke zachte
       banden. Plus een donkere dakvoet en een lichte nok. */
    var n = stijl === 'riet' ? 5 : (stijl === 'lei' ? 11 : 8);
    var don = schaal(dak, stijl === 'lei' ? 0.66 : 0.78);
    var lic = schaal(dak, stijl === 'riet' ? 1.1 : 1.16);
    for (var i = 1; i < n; i++) {
      var t = i / n;
      var p1 = lerpP(a, apex, t), p2 = lerpP(b, apex, t);
      if (stijl === 'pan') {
        /* pannenrij: donkere schaduwnaad met een lichte rand erboven */
        c.moveTo(p1.x, p1.y).lineTo(p2.x, p2.y).stroke({ width: 1.1, color: don, alpha: 0.42 });
        var q1 = lerpP(a, apex, t + 0.035), q2 = lerpP(b, apex, t + 0.035);
        c.moveTo(q1.x, q1.y).lineTo(q2.x, q2.y).stroke({ width: 0.7, color: lic, alpha: 0.3 });
        /* stootnaadjes tussen de pannen, per rij verspringend */
        var m = 5, off = (i % 2) * 0.5 / m;
        for (var k = 0; k <= m; k++) {
          var f = off + k / m;
          if (f <= 0.02 || f >= 0.98) continue;
          var s1 = { x: p1.x + (p2.x - p1.x) * f, y: p1.y + (p2.y - p1.y) * f };
          var s2 = { x: q1.x + (q2.x - q1.x) * f, y: q1.y + (q2.y - q1.y) * f };
          c.moveTo(s1.x, s1.y).lineTo(s2.x, s2.y).stroke({ width: 0.5, color: don, alpha: 0.3 });
        }
      } else if (stijl === 'lei') {
        c.moveTo(p1.x, p1.y).lineTo(p2.x, p2.y).stroke({ width: 0.7, color: don, alpha: 0.4 });
      } else {
        c.moveTo(p1.x, p1.y).lineTo(p2.x, p2.y).stroke({ width: 1.8, color: i % 2 ? don : lic, alpha: 0.3 });
      }
    }
    /* dakvoet donker (overstek-schaduw) en nok licht */
    c.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: 1.4, color: schaal(dak, 0.6), alpha: 0.5 });
    var r1 = lerpP(a, apex, 0.93), r2 = lerpP(b, apex, 0.93);
    c.moveTo(r1.x, r1.y).lineTo(r2.x, r2.y).stroke({ width: 1, color: lic, alpha: 0.4 });
  }

  /* Materiaal op de twee zichtbare muurvlakken. `steen` geeft horizontale
     lagen met om-en-om verspringende stootvoegen (blokverband); anders een
     fijne pleisternerf met een donkere plint. Elk vlak is een parallellogram:
     u loopt langs de grond, v omhoog — dezelfde (s,t)-ruimte als gevel(). */
  function muurTextuur(c, foot, top, muur, steen) {
    var faces = [
      { bl: foot.bottom, br: foot.right, tl: top.bottom, f: 0.9 },
      { bl: foot.left, br: foot.bottom, tl: top.left, f: 0.72 }
    ];
    for (var i = 0; i < faces.length; i++) {
      var F = faces[i];
      var u = { x: F.br.x - F.bl.x, y: F.br.y - F.bl.y };
      var v = { x: F.tl.x - F.bl.x, y: F.tl.y - F.bl.y };
      var voeg = schaal(muur, F.f * 0.74), hoog = schaal(muur, F.f * 1.1);
      if (steen) {
        var lagen = 5;
        for (var L = 1; L < lagen; L++) {
          var t0 = L / lagen;
          var a = vlakPunt(F.bl, u, v, 0.02, t0), b = vlakPunt(F.bl, u, v, 0.98, t0);
          c.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: 0.7, color: voeg, alpha: 0.5 });
          /* stootvoegen, per laag een halve steen verspringend */
          var n = 4, off = (L % 2) * 0.5 / n;
          for (var k = 0; k < n; k++) {
            var sx2 = 0.06 + off + k / n;
            if (sx2 > 0.95) continue;
            var p1 = vlakPunt(F.bl, u, v, sx2, t0), p2 = vlakPunt(F.bl, u, v, sx2, t0 - 1 / lagen);
            c.moveTo(p1.x, p1.y).lineTo(p2.x, p2.y).stroke({ width: 0.6, color: voeg, alpha: 0.34 });
          }
        }
      } else {
        /* pleister: een paar zachte banden + lichte bovenrand */
        for (var m = 1; m <= 2; m++) {
          var tm = m / 3;
          var q1 = vlakPunt(F.bl, u, v, 0.06, tm), q2 = vlakPunt(F.bl, u, v, 0.94, tm + 0.03);
          c.moveTo(q1.x, q1.y).lineTo(q2.x, q2.y).stroke({ width: 1.2, color: voeg, alpha: 0.16 });
        }
        var h1 = vlakPunt(F.bl, u, v, 0.03, 0.97), h2 = vlakPunt(F.bl, u, v, 0.97, 0.97);
        c.moveTo(h1.x, h1.y).lineTo(h2.x, h2.y).stroke({ width: 0.8, color: hoog, alpha: 0.4 });
      }
      /* donkere plint langs de grond — zet het gebouw op de grond */
      var pl1 = vlakPunt(F.bl, u, v, 0, 0.07), pl2 = vlakPunt(F.bl, u, v, 1, 0.07);
      c.moveTo(F.bl.x, F.bl.y).lineTo(F.br.x, F.br.y).lineTo(pl2.x, pl2.y).lineTo(pl1.x, pl1.y)
        .fill({ color: schaal(muur, F.f * 0.6), alpha: 0.5 });
    }
  }

  /* Vakwerk: een donker houtskelet over de pleistermuren (balken, posten en een
     schoorstut in het bovenvak). */
  function timberLijn(c, bl, u, v, s0, t0, s1, t1) {
    var p = vlakPunt(bl, u, v, s0, t0), q = vlakPunt(bl, u, v, s1, t1);
    c.moveTo(p.x, p.y).lineTo(q.x, q.y).stroke({ width: 1.4, color: 0x40301f, alpha: 0.82 });
  }
  function vakwerk(c, foot, top) {
    var faces = [
      { bl: foot.bottom, br: foot.right, tl: top.bottom },
      { bl: foot.left, br: foot.bottom, tl: top.left }
    ];
    for (var f = 0; f < faces.length; f++) {
      var F = faces[f];
      var u = { x: F.br.x - F.bl.x, y: F.br.y - F.bl.y };
      var v = { x: F.tl.x - F.bl.x, y: F.tl.y - F.bl.y };
      timberLijn(c, F.bl, u, v, 0.06, 0.92, 0.94, 0.92);
      timberLijn(c, F.bl, u, v, 0.06, 0.5, 0.94, 0.5);
      for (var i = 0; i <= 3; i++) { var s = 0.06 + i * 0.293; timberLijn(c, F.bl, u, v, s, 0.5, s, 0.92); }
      timberLijn(c, F.bl, u, v, 0.06, 0.5, 0.35, 0.92);
      timberLijn(c, F.bl, u, v, 0.64, 0.92, 0.94, 0.5);
    }
  }

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
    /* Gestreepte markt-/havenluifel in spelerskleur en room — de AoE2-marktkraam. */
    var y = foot.left.y - H * 0.5, y2 = y + 4;
    var lx = foot.left.x, bx = foot.bottom.x;
    var n = 6;
    for (var i = 0; i < n; i++) {
      var t0 = i / n, t1 = (i + 1) / n;
      var xa = lx + (bx - lx) * t0, xb = lx + (bx - lx) * t1;
      var ya = y + (foot.bottom.y - foot.left.y) * t0, yb = y + (foot.bottom.y - foot.left.y) * t1;
      c.poly([xa, ya, xb, yb, xb, yb + 4, xa, ya + 4]).fill({ color: i % 2 ? 0xf0e6cc : SPELER, alpha: 0.92 });
    }
  }
  function kruisTop(c, cx, apexY) {
    c.rect(cx - 0.9, apexY - 9, 1.8, 9).fill(0xf0e6c8);
    c.rect(cx - 3.2, apexY - 6.5, 6.4, 1.8).fill(0xf0e6c8);
  }
  function vlagTop(c, cx, y) {
    c.rect(cx - 0.7, y - 15, 1.4, 15).fill(0x6a5030);
    c.circle(cx, y - 15, 1.1).fill(0xd7a94b);                          /* gouden knop */
    c.poly([cx + 0.7, y - 15, cx + 10, y - 12.5, cx + 0.7, y - 9]).fill(SPELER);       /* spelerskleur-wimpel */
    c.poly([cx + 0.7, y - 15, cx + 10, y - 12.5, cx + 6, y - 12]).fill(SPELER_LICHT);  /* lichtvlak */
  }

  /* Een blauwe (spelerskleur) banier die tegen de voorgevel hangt: een lap doek
     met een lichte middenbaan en een gekartelde onderrand. */
  function banier(c, foot, top) {
    var bl = foot.bottom, br = foot.right, tl = top.bottom;
    var u = { x: br.x - bl.x, y: br.y - bl.y }, v = { x: tl.x - bl.x, y: tl.y - bl.y };
    var s0 = 0.62, w = 0.2, t0 = 0.28, t1 = 0.9;
    var p = function (s, t) { return { x: bl.x + u.x * s + v.x * t, y: bl.y + u.y * s + v.y * t }; };
    var a = p(s0, t1), b2 = p(s0 + w, t1), d = p(s0 + w, t0), e = p(s0, t0);
    c.poly([a.x, a.y, b2.x, b2.y, d.x, d.y, e.x, e.y]).fill(SPELER);
    var lm = p(s0 + w * 0.5, t1), lb = p(s0 + w * 0.5, t0);
    c.moveTo(lm.x, lm.y).lineTo(lb.x, lb.y).stroke({ width: 1.4, color: SPELER_LICHT, alpha: 0.8 });
    /* gekartelde onderrand */
    var mid = p(s0 + w * 0.5, t0 - 0.06);
    c.poly([e.x, e.y, mid.x, mid.y, d.x, d.y]).fill(SPELER_DONKER);
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

  /* Een ronde vlek als 7-hoek in plaats van een ellips. Pixi tesselleert een
     ellips in tientallen driehoeken; op de maat waarop wij ze gebruiken
     (bladpluken, grondschaduwen, keitjes) is een 7-hoek visueel niet te
     onderscheiden en kost hij een fractie. Dat scheelt honderdduizenden
     driehoeken op een kaart vol bos. */
  function blob(g, cx, cy, rx, ry, vulling) {
    var p = [];
    for (var i = 0; i < 7; i++) {
      var a = i / 7 * Math.PI * 2;
      p.push(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
    }
    g.poly(p).fill(vulling);
  }

  /* De grondschaduw van een staand ding: een donkere ellips, weggeleund langs de
     ene lichtrichting die de hele scène deelt. */
  function grondschaduw(g, cx, cy, straal, hoogte, alpha) {
    var ric = schaduwRichting();
    blob(g, cx + hoogte * ric.x * 0.5, cy + hoogte * ric.y * 0.5,
      straal + hoogte * 0.28, straal * 0.55, { color: 0x181410, alpha: alpha });
  }

  /* Iso-ruit van tegel (x,y) in wereld-ruimte: middelpunt + halve maten. */
  function tegelDiamant(x, y) {
    var sx = isoX(x * TEGEL, y * TEGEL), sy = isoY(x * TEGEL, y * TEGEL);
    return { cx: sx, cy: sy + TEGEL / 4, hw: TEGEL / 2, hh: TEGEL / 4, topx: sx, topy: sy };
  }

  var BLADKLEUR = PAL ? PAL.blad : [0x3f7233, 0x386a2b, 0x8a5f1e, 0x51624e];

  /* Eén boom. Twee soorten door elkaar — loofboom (grillige kruin van
     overlappende bladpluken) en naaldboom (gestapelde takkransen) — want een
     bos van één vorm leest als behang. De zon staat linksboven (sfeer.SCHADUW),
     dus de pluken linksboven zijn licht en die rechtsonder donker; dat geeft de
     kruin volume in plaats van een platte cirkel. Alles deterministisch uit
     `seed` (afgeleid van t.v), nooit uit een RNG-stroom. */
  function boomVorm(g, ox, oy, deel, seizoen, seed) {
    var blad = BLADKLEUR[seizoen] || BLADKLEUR[0];
    var s1 = ((seed * 9781) % 1000) / 1000;
    var s2 = ((seed * 3571 + 137) % 1000) / 1000;
    var s3 = ((seed * 6151 + 71) % 1000) / 1000;
    var winter = seizoen === 3;
    var naald = s3 > 0.62;                              /* ~38% naaldbomen */
    var basis = schaal(blad, 0.86 + s1 * 0.3);          /* groenvariatie per boom */
    var r = TEGEL * (0.15 + deel * 0.085);
    var jit = (s2 - 0.5) * r * 0.3;

    if (naald) {
      /* Naaldboom: korte stam, dan 4 kransen die naar boven versmallen. */
      var sh = TEGEL * 0.1;
      g.poly([ox - TEGEL * 0.02, oy, ox + TEGEL * 0.02, oy,
        ox + TEGEL * 0.015, oy - sh, ox - TEGEL * 0.015, oy - sh]).fill(0x43301d);
      var don = schaal(basis, winter ? 0.9 : 0.74), lic = schaal(basis, winter ? 1.05 : 1.2);
      for (var k = 0; k < 4; k++) {
        var f = k / 4;
        var kw = r * (1 - f * 0.62), ky = oy - sh - k * r * 0.42;
        var kh = r * (0.78 - f * 0.12);
        g.poly([ox - kw + jit * f, ky, ox + kw + jit * f, ky, ox + jit * f, ky - kh]).fill(don);
        g.poly([ox - kw + jit * f, ky, ox + jit * f, ky - kh, ox - kw * 0.12 + jit * f, ky - kh * 0.22]).fill(lic);
        if (winter) g.poly([ox - kw * 0.7 + jit * f, ky - kh * 0.18, ox + jit * f, ky - kh,
          ox + kw * 0.55 + jit * f, ky - kh * 0.2]).fill({ color: 0xeef5fb, alpha: 0.6 });
      }
      return;
    }

    /* Loofboom: getapte stam met twee takken, dan een kruin van pluken. */
    var st = TEGEL * 0.19;
    g.poly([ox - TEGEL * 0.032, oy, ox + TEGEL * 0.032, oy,
      ox + TEGEL * 0.019, oy - st, ox - TEGEL * 0.019, oy - st]).fill(0x4a3320);
    g.moveTo(ox, oy - st * 0.55).lineTo(ox - r * 0.34, oy - st * 0.95)
      .moveTo(ox, oy - st * 0.7).lineTo(ox + r * 0.3, oy - st * 1.05)
      .stroke({ width: 1, color: 0x3d2a18, alpha: 0.85 });

    var kruin = oy - st - r * 0.5;
    /* Pluken van donker (rechtsonder, in de schaduw) naar licht (linksboven). */
    var pluk = [
      [ 0.52,  0.30, 0.70, 0.70],
      [-0.52,  0.24, 0.68, 0.82],
      [ 0.28, -0.24, 0.66, 1.0],
      [ 0.00,  0.02, 0.80, 0.92],
      [-0.30, -0.46, 0.62, 1.2]
    ];
    for (var i = 0; i < pluk.length; i++) {
      var P4 = pluk[i];
      var px = ox + P4[0] * r + jit * (0.4 + P4[1]);
      var py = kruin + P4[1] * r;
      blob(g, px, py, P4[2] * r, P4[2] * r * 0.88, schaal(basis, P4[3]));
    }
    if (winter) {
      /* Winter: kale takken door de dunne kruin heen + wat sneeuw bovenop. */
      g.moveTo(ox, oy - st).lineTo(ox - r * 0.5, kruin - r * 0.5)
        .moveTo(ox, oy - st).lineTo(ox + r * 0.45, kruin - r * 0.35)
        .stroke({ width: 0.9, color: 0x4a3626, alpha: 0.7 });
      g.ellipse(ox - r * 0.1, kruin - r * 0.62, r * 0.44, r * 0.2).fill({ color: 0xf2f8fd, alpha: 0.8 });
    }
  }

  function maakBoom(t, x, y, seizoen) {
    var c = new PIXI.Graphics();
    var d = tegelDiamant(x, y);
    var deel = t.max > 0 ? Game.util.clamp(t.amt / t.max, 0, 1) : 0.7;
    /* Dichter bos, en per boom een eigen maat — een kluitje gelijke exemplaren
       leest als behang. Achterste (hoogste) bomen eerst, zodat de voorste
       overlappen en de kluit diepte krijgt. */
    var aantal = Math.max(2, Math.round(1.6 + deel * 1.4));
    var bomen = [];
    for (var i = 0; i < aantal; i++) {
      bomen.push({
        ox: d.cx + TEGEL * (((i * 37 + t.v * 100) % 52) / 100 - 0.26),
        oy: d.cy + TEGEL * (((i * 61 + t.v * 70) % 26) / 100 - 0.08),
        maat: deel * (0.7 + ((i * 23 + t.v * 55) % 60) / 100),
        seed: t.v + i * 1.7
      });
    }
    bomen.sort(function (a, b) { return a.oy - b.oy; });
    for (var j = 0; j < bomen.length; j++) {
      var B = bomen[j];
      grondschaduw(c, B.ox, B.oy + TEGEL * 0.03, TEGEL * 0.1, TEGEL * (0.3 + B.maat * 0.18), 0.2);
      boomVorm(c, B.ox, B.oy, B.maat, seizoen, B.seed);
    }
    return c;
  }

  function maakRots(t, x, y) {
    var c = new PIXI.Graphics();
    var d = tegelDiamant(x, y);
    var aantal = 2 + Math.floor(((t.v * 5.7) % 1) * 3);
    for (var i = 0; i < aantal; i++) {
      var ox = d.cx + TEGEL * (((i * 41 + t.v * 90) % 56) / 100 - 0.28);
      var oy = d.cy + TEGEL * (((i * 67 + t.v * 60) % 30) / 100 - 0.12);
      /* Elke kei een eigen breedte, hoogte en scheve top — anders is een
         rotsveld een raster van precies hetzelfde driehoekje. */
      var j1 = ((i * 13 + t.v * 30) % 10) / 10, j2 = ((i * 29 + t.v * 47) % 10) / 10;
      var r = TEGEL * (0.08 + j1 * 0.08);
      var br = r * (0.8 + j2 * 0.6), hg = r * (0.9 + j1 * 0.7);
      var tint = 0.92 + j2 * 0.18;
      grondschaduw(c, ox, oy + TEGEL * 0.04, br * 0.9, hg * 0.8, 0.2);
      var tx2 = ox + (j2 - 0.5) * br * 0.5;
      c.poly([ox - br, oy + r * 0.4, ox - br * 0.45, oy - hg * 0.75, tx2, oy - hg,
        ox + br * 0.6, oy - hg * 0.6, ox + br, oy + r * 0.4]).fill(schaal(0x7f7b72, tint));
      c.poly([ox - br * 0.45, oy - hg * 0.75, tx2, oy - hg, ox + br * 0.6, oy - hg * 0.6,
        ox + br * 0.1, oy - hg * 0.15]).fill(schaal(0xa39c90, tint));
      c.moveTo(tx2, oy - hg).lineTo(ox + br * 0.1, oy - hg * 0.15)
        .stroke({ width: 0.6, color: 0x5c584f, alpha: 0.4 });
    }
    return c;
  }

  /* Eén rotspiek. Twee grote facetten die de apex delen — links in de schaduw,
     rechts in het licht (de zon staat linksboven, sfeer.SCHADUW) — plus een
     donker achtervlak en horizontale richels. Dat leest als een kantige rots met
     volume, waar een egale kegel of een plat plateau juist vlak oogt.
     Bewust NIET breder dan de tegel: overlappende brede massieven liepen in
     elkaar over en hun verlichte toppen leken los te zweven. */
  function rotsPiek(c, cx, baseY, w, H, basis, j, j2, j3) {
    j2 = j2 == null ? 0.5 : j2; j3 = j3 == null ? 0.5 : j3;
    /* Asymmetrische voet en een geknikte flank: zonder deze variatie krijgt elke
       rots exact hetzelfde silhouet en leest een veld ervan als behang. */
    var ax = cx + (j - 0.5) * w * 0.42, ay = baseY - H * (0.9 + j2 * 0.2);
    var L = { x: cx - w * (0.78 + j2 * 0.44), y: baseY + H * (j3 - 0.5) * 0.06 };
    var R = { x: cx + w * (0.78 + j3 * 0.44), y: baseY + H * (j2 - 0.5) * 0.06 };
    var M = { x: cx + (j - 0.5) * w * 0.5, y: baseY + H * 0.03 };
    /* Knik in de linkerflank: een schouder halverwege, hoogte per rots anders. */
    var S = { x: ax + (L.x - ax) * (0.42 + j3 * 0.24), y: ay + (L.y - ay) * (0.34 + j2 * 0.3) };
    /* Achtervlak: een smalle donkere wig net achter de nok. Smal én ondiep
       gehouden — bij lage bulten liepen brede achtervlakken van buurtegels in
       elkaar over en vormden donkere stervormen op de grond. */
    c.poly([ax, ay, ax - w * 0.3, ay + H * 0.42, ax + w * 0.34, ay + H * 0.38]).fill(schaal(basis, 0.64));
    /* linkerflank (schaduw) en rechterflank (licht) */
    c.poly([L.x, L.y, M.x, M.y, ax, ay, S.x, S.y]).fill(schaal(basis, 0.78));
    c.poly([M.x, M.y, R.x, R.y, ax, ay]).fill(schaal(basis, 1.12));
    /* nokrand: lichte lijn over de scheiding, geeft de kant scherpte */
    c.moveTo(ax, ay).lineTo(M.x, M.y).stroke({ width: 0.8, color: schaal(basis, 1.3), alpha: 0.5 });
    /* horizontale richels op beide flanken */
    for (var i = 1; i <= 2; i++) {
      var f = i / 3;
      var a1 = { x: ax + (L.x - ax) * f, y: ay + (L.y - ay) * f };
      var a2 = { x: ax + (M.x - ax) * f, y: ay + (M.y - ay) * f };
      var a3 = { x: ax + (R.x - ax) * f, y: ay + (R.y - ay) * f };
      c.moveTo(a1.x, a1.y).lineTo(a2.x, a2.y).stroke({ width: 0.7, color: schaal(basis, 0.45), alpha: 0.35 });
      c.moveTo(a2.x, a2.y).lineTo(a3.x, a3.y).stroke({ width: 0.7, color: schaal(basis, 0.55), alpha: 0.28 });
    }
    return { ax: ax, ay: ay, L: L, R: R, M: M };
  }

  function maakBerg(t, x, y, seizoen) {
    var c = new PIXI.Graphics();
    var d = tegelDiamant(x, y);
    var r1 = (t.v * 7.31) % 1, r2 = (t.v * 13.77) % 1, r3 = (t.v * 23.9) % 1, r4 = (t.v * 31.3) % 1;
    var baseY = d.cy + d.hh * 0.8;
    /* De meeste bergtegels zijn een lage, brede rotsbult; alleen een minderheid
       is een echte top. Zou elke tegel een piek tekenen, dan wordt een cluster
       een veld gelijke spitsen — zo krijg je juist een grillig massief met een
       paar summits erboven. */
    var top = r1 > 0.7;
    var H = top ? TEGEL * (0.62 + (r1 - 0.7) / 0.3 * 0.5) : TEGEL * (0.24 + r1 * 0.42);
    var w = d.hw * (top ? 0.95 : 1.06);
    var basis = schaal(0x877d6d, 0.9 + r4 * 0.2);      /* tintvariatie per rots */
    grondschaduw(c, d.cx, d.cy + d.hh * 0.3, w * 0.85, H * 0.45, 0.24);
    /* Een lagere zijkam eerst (staat er achter), dan de hoofdpiek ervoor. */
    if (r2 > 0.4) {
      rotsPiek(c, d.cx + (r2 - 0.5) * w * 1.1, baseY - d.hh * 0.18, w * 0.6, H * 0.55, schaal(basis, 0.88), r3, r4, r1);
    }
    var P4 = rotsPiek(c, d.cx, baseY, w, H, basis, r2, r3, r4);
    /* Losse rotsblokken aan de voet. */
    if (r3 > 0.45) {
      var px = d.cx + (r3 - 0.5) * w * 1.5, py = baseY + d.hh * 0.12, br = 2.2 + r4 * 2.2;
      c.poly([px - br, py, px - br * 0.5, py - br, px + br * 0.6, py - br * 0.7, px + br, py]).fill(schaal(basis, 0.85));
      c.poly([px - br * 0.5, py - br, px + br * 0.6, py - br * 0.7, px + br * 0.1, py - br * 0.2]).fill(schaal(basis, 1.05));
    }
    /* Sneeuw alleen in de winter, en dan op de echte toppen. Buiten de winter
       las een witte kap op donkere rots als een losse vlek die boven de berg
       zweefde — en sneeuw in de lente op deze hoogte klopt ook niet. */
    if (seizoen === 3 && top) {
      var f = 0.22;
      var sl = { x: P4.ax + (P4.L.x - P4.ax) * f, y: P4.ay + (P4.L.y - P4.ay) * f };
      var sm = { x: P4.ax + (P4.M.x - P4.ax) * f * 1.2, y: P4.ay + (P4.M.y - P4.ay) * f * 1.2 };
      var sr = { x: P4.ax + (P4.R.x - P4.ax) * f, y: P4.ay + (P4.R.y - P4.ay) * f };
      c.poly([P4.ax, P4.ay, sl.x, sl.y, sm.x, sm.y]).fill({ color: 0xdae3ea, alpha: 0.85 });
      c.poly([P4.ax, P4.ay, sm.x, sm.y, sr.x, sr.y]).fill({ color: 0xeaf1f6, alpha: 0.9 });
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

  /* Riet/lisdodde langs de oever: een pol slanke halmen met een enkele bruine
     kolf, op landtegels die aan water grenzen. Deterministisch uit t.v. */
  function maakRiet(t, x, y, seizoen) {
    var c = new PIXI.Graphics();
    var d = tegelDiamant(x, y);
    var kl = seizoen === 3 ? 0x8f9174 : (seizoen === 2 ? 0x9a8a48 : 0x5f7f3a);
    var aantal = 3 + Math.floor((t.v * 17) % 4);
    for (var i = 0; i < aantal; i++) {
      var ox = d.cx + TEGEL * (((i * 29 + t.v * 80) % 40) / 100 - 0.2);
      var oy = d.cy + TEGEL * (((i * 53 + t.v * 50) % 24) / 100 - 0.02);
      var hh = TEGEL * (0.22 + ((i * 13 + t.v * 30) % 12) / 100);
      var buig = ((i * 7 + t.v * 40) % 10) / 10 - 0.5;
      c.moveTo(ox, oy).quadraticCurveTo(ox + buig * 4, oy - hh * 0.6, ox + buig * 7, oy - hh)
        .stroke({ width: 1.1, color: kl, alpha: 0.92 });
      if (i % 3 === 0) c.roundRect(ox + buig * 7 - 1, oy - hh - 3, 2, 4, 1).fill(0x6a4326);   /* kolf */
    }
    return c;
  }

  /* Waterlelies op ondiep water: een paar platte groene schijven, soms een
     roze bloem. Ze liggen plat, dus geen schaduw of hoogte. */
  function maakLelie(t, x, y) {
    var c = new PIXI.Graphics();
    var d = tegelDiamant(x, y);
    var aantal = 1 + Math.floor((t.v * 11) % 3);
    for (var i = 0; i < aantal; i++) {
      var ox = d.cx + TEGEL * (((i * 31 + t.v * 90) % 44) / 100 - 0.22);
      var oy = d.cy + TEGEL * (((i * 47 + t.v * 60) % 22) / 100 - 0.02);
      var r = TEGEL * (0.07 + ((i * 9 + t.v * 20) % 5) / 100);
      c.ellipse(ox, oy, r, r * 0.5).fill({ color: 0x3f7a44, alpha: 0.9 });
      c.ellipse(ox, oy, r, r * 0.5).stroke({ width: 0.6, color: 0x2c5a30, alpha: 0.5 });
      if (((i * 3 + t.v * 100) | 0) % 5 === 0) c.circle(ox, oy - r * 0.2, r * 0.28).fill(0xe8a6c8);
    }
    return c;
  }

  function grenstAanWater(T, b, h, x, y) {
    if (x > 0 && T[y * b + x - 1] && T[y * b + x - 1].t === 'water') return true;
    if (x < b - 1 && T[y * b + x + 1] && T[y * b + x + 1].t === 'water') return true;
    if (y > 0 && T[(y - 1) * b + x] && T[(y - 1) * b + x].t === 'water') return true;
    if (y < h - 1 && T[(y + 1) * b + x] && T[(y + 1) * b + x].t === 'water') return true;
    return false;
  }
  function grenstAanLand(T, b, h, x, y) {
    if (x > 0 && T[y * b + x - 1] && T[y * b + x - 1].t !== 'water') return true;
    if (x < b - 1 && T[y * b + x + 1] && T[y * b + x + 1].t !== 'water') return true;
    if (y > 0 && T[(y - 1) * b + x] && T[(y - 1) * b + x].t !== 'water') return true;
    if (y < h - 1 && T[(y + 1) * b + x] && T[(y + 1) * b + x].t !== 'water') return true;
    return false;
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
        var vh = (t.v * 100) | 0;
        if (t.t === 'bos') c = maakBoom(t, x, y, seizoen);
        else if (t.t === 'rots') c = maakRots(t, x, y);
        else if (t.t === 'berg') c = maakBerg(t, x, y, seizoen);
        else if (t.t === 'gras' && t.n === 'wild' && t.amt > 0) c = maakHert(t, x, y);
        else if (t.t === 'water' && !t.weg && grenstAanLand(T, b, h, x, y) && vh % 4 === 0) c = maakLelie(t, x, y);
        else if (t.t !== 'water' && !t.weg && grenstAanWater(T, b, h, x, y) && vh % 2 === 0) c = maakRiet(t, x, y, seizoen);
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

  var ZEE = PAL ? PAL.waterDiep : [0x27506b, 0x295473, 0x254a64, 0x2b4a5e];

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
    /* Basis: overdag een héél lichte warme tint (de geschilderde AoE2-ambient),
       's nachts een donkere blauwe tint over alles. */
    wereld.tint = mengNum(0xfff4e2, 0x3a4a72, L.nacht * 0.72);

    lichtLaag.clear();
    /* Altijd een vleugje warme, zonovergoten ambient overdag — bindt de scène. */
    if (L.dag > 0.02) {
      lichtLaag.rect(0, 0, cam.breedte, cam.hoogte).fill({ color: 0xffd9a0, alpha: L.dag * 0.05 });
    }
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
  function maakPersoon(kleur, kar) {
    var c = new PIXI.Graphics();
    if (kar) {
      /* Een handkar die achter de figuur aan hobbelt (naar schermlinks = 'achter'). */
      c.ellipse(-6, 0, 4.2, 1.5).fill({ color: 0x000000, alpha: 0.16 });
      c.rect(-9.5, -6, 6.5, 4.6).fill(0x8a6a40);
      c.rect(-9.5, -7.4, 6.5, 1.6).fill(0x6a4a2a);
      c.circle(-8.2, -0.6, 1.7).fill(0x3a2a18);
      c.circle(-4.2, -0.6, 1.7).fill(0x3a2a18);
      c.moveTo(-3, -4.5).lineTo(-1, -5.5).stroke({ width: 1, color: 0x5a4326, alpha: 0.8 });
    }
    c.ellipse(0, 0, 3, 1.3).fill({ color: 0x000000, alpha: 0.2 });
    c.roundRect(-2, -8, 4, 7, 1.6).fill(kleur);
    /* Spelerskleur: een blauw schoudersjaal-accent zodat een dorpeling als
       'jouw volk' leest, net als de spelerskleur op units in AoE2. */
    c.rect(-2, -6.4, 4, 1.4).fill(SPELER);
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
    var kar = rnd() < 0.28;
    var sp = maakPersoon(WANDELKLEUR[(rnd() * WANDELKLEUR.length) | 0], kar);
    sp._soort = 'wandelaar';
    gebouwLaag.addChild(sp);
    wandelaars.push({ sprite: sp, wx: p.x, wy: p.y, doel: kies(levenPunten), snel: (kar ? 9 : 13) + rnd() * 9, faze: rnd() * 6, pauze: 0, werkt: true });
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
    /* Aangekomen → even blijven staan en 'werken' (snellere bob), dan pas een
       nieuw doel kiezen. Rovers werken niet: die marcheren door. */
    if (w.pauze > 0) {
      w.pauze -= dt;
      if (w.pauze <= 0) w.doel = kies(levenPunten) || w.doel;
      w.faze += dt * 9;
      var wb = Math.abs(Math.sin(w.faze)) * 1.5;
      w.sprite.position.set(isoX(w.wx, w.wy), isoY(w.wx, w.wy) - wb);
      w.sprite.zIndex = (w.wx + w.wy) / TEGEL + 0.02;
      return;
    }
    var dx = w.doel.x - w.wx, dy = w.doel.y - w.wy;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 3) {
      if (w.werkt) w.pauze = 0.8 + rnd() * 2.2;
      else w.doel = kies(levenPunten) || w.doel;
    } else { var v = w.snel * dt; if (v > dist) v = dist; w.wx += dx / dist * v; w.wy += dy / dist * v; }
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
    tekenWaterLeven(s, cam);
    tekenWolken(s);
    tekenGloed(s);
    tekenVogels(cam);
    tekenWeer(s, cam);
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

  /* Drijvende rimpels en een zonneschittering op de zichtbare watertegels. */
  function tekenWaterLeven(s, cam) {
    if (!waterAnimLaag) return;
    waterAnimLaag.clear();
    if (cam.px() < 22) return;   /* rimpels alleen als redelijk ingezoomd (performance) */
    var z = cam.zichtbaar(s.kaart), T = s.kaart.tegels, b = s.kaart.b;
    var dag = lichtStand(s).dag;
    for (var y = z.y0; y < z.y1; y++) {
      for (var x = z.x0; x < z.x1; x++) {
        var t = T[y * b + x];
        if (!t || t.t !== 'water') continue;
        var ix = isoX(x * TEGEL, y * TEGEL), iy = isoY(x * TEGEL, y * TEGEL) + TEGEL / 4;
        for (var k = 0; k < 2; k++) {
          var ph = klok * (1 + k * 0.4) + t.v * 9 + k * 2.1;
          var yy = iy + (((t.v * 3.3 + k) % 1) - 0.5) * TEGEL * 0.3 + Math.sin(ph) * TEGEL * 0.04;
          var xx = ix + (((t.v * 7.9 + k * 0.4) % 1) - 0.5) * TEGEL * 0.25 + Math.cos(ph) * TEGEL * 0.05;
          var len = TEGEL * (0.08 + ((t.v * 11 + k) % 1) * 0.06);
          waterAnimLaag.moveTo(xx - len, yy).lineTo(xx + len, yy).stroke({ width: TEGEL * 0.03, color: 0xe2f4fa, alpha: 0.10 });
        }
        if (dag > 0.3) {
          var gx = ix + Math.sin(klok * 0.7 + t.v * 12) * TEGEL * 0.13;
          waterAnimLaag.circle(gx, iy - TEGEL * 0.02, TEGEL * 0.03).fill({ color: 0xfff8de, alpha: 0.04 + dag * 0.14 * Math.abs(Math.sin(klok * 3 + t.v * 20)) });
        }
      }
    }
  }

  /* Zachte wolkenschaduwen die over het land schuiven. */
  function tekenWolken(s) {
    if (!wolkenLaag) return;
    wolkenLaag.clear();
    var b = s.kaart.b, h = s.kaart.h, spanX = b * TEGEL + 600;
    for (var i = 0; i < 5; i++) {
      var cwx = ((klok * 22 + i * 430) % spanX) - 300;
      var cwy = (0.12 + i * 0.18) * h * TEGEL;
      wolkenLaag.ellipse(isoX(cwx, cwy), isoY(cwx, cwy), TEGEL * 3.4, TEGEL * 1.6).fill({ color: 0x0a1420, alpha: 0.05 });
    }
  }

  /* Een paar vogels die in scherm-ruimte overvliegen, vleugels op en neer. */
  function tekenVogels(cam) {
    if (!vogelLaag) return;
    vogelLaag.clear();
    var W = cam.breedte;
    for (var i = 0; i < 4; i++) {
      var x = ((klok * 45 + i * 360) % (W + 120)) - 60;
      var y = 60 + i * 26 + Math.sin(klok * 1.2 + i) * 8;
      var w = 5, dip = Math.sin(klok * 6 + i) * 1.5 + 3;
      vogelLaag.moveTo(x - w, y).lineTo(x, y + dip).lineTo(x + w, y).stroke({ width: 1.4, color: 0x2a2a2a, alpha: 0.5 });
    }
  }

  /* Weer als render-only state machine: droge perioden afgewisseld met een
     regenbui; intens en natheid easen ernaartoe. Nooit in Game.state. */
  function tickWeer(dt) {
    weer.t -= dt;
    if (weer.t <= 0) {
      if (weer.fase === 'droog') { weer.fase = 'regen'; weer.t = 6 + rnd() * 10; }
      else { weer.fase = 'droog'; weer.t = 30 + rnd() * 50; }
    }
    var doel = weer.fase === 'regen' ? 1 : 0;
    weer.intens += (doel - weer.intens) * Math.min(1, dt * 0.6);
    weer.natheid += (doel - weer.natheid) * Math.min(1, dt * 0.25);
  }

  /* Regenslierten + een grauwe waas tijdens de bui, en een lage ochtendmist als
     het droog is. Scherm-ruimte, dus los van de camera. */
  function tekenWeer(s, cam) {
    if (!weerLaag) return;
    weerLaag.clear();
    var W = cam.breedte, Hh = cam.hoogte;
    if (weer.intens > 0.02) {
      weerLaag.rect(0, 0, W, Hh).fill({ color: 0x6f7f8c, alpha: weer.intens * 0.12 });
      var n = Math.round(weer.intens * 170);
      for (var i = 0; i < n; i++) {
        var x = (rnd() * (W + 60)) - 30, y = rnd() * Hh;
        var len = 9 + rnd() * 9;
        weerLaag.moveTo(x, y).lineTo(x - len * 0.35, y + len).stroke({ width: 1, color: 0xcfe0ea, alpha: 0.35 });
      }
    }
    /* Ochtendmist: alleen droog, laag in beeld, sterker bij dageraad. */
    var mist = lichtStand(s).ochtend * (1 - weer.intens);
    if (mist > 0.05) {
      for (var b = 0; b < 3; b++) {
        var my = Hh * (0.62 + b * 0.13);
        weerLaag.rect(0, my, W, Hh * 0.16).fill({ color: 0xe8eef2, alpha: mist * (0.16 - b * 0.03) });
      }
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
  R.tickEffecten = function (s, dt) { if (!klaar) return; tickWeer(dt); tickRook(dt); tickDeeltjes(dt); tickFloaters(s, dt); };
  R.__weer = weer;   /* debug-handle om het weer te forceren (tests/console) */

  /* --------------------------------------------- nog te porten (no-ops) ---- */
  R.tijdperkSweep = function () {};
  R.schok = function () {};
  R.flits = function () {};

  Game.render.renderer = R;
  Game.render.particles = Deeltjes;   /* stof() uit construction/raids landt nu hier */

})(window.Game);
