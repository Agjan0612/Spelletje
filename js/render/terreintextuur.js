/* Terreintextuur — geschilderde grond in AoE2-stijl.
 *
 * De renderlaag vulde terrein-diamanten vroeger met een platte kleur. Dit
 * module bakt per terreinsoort × seizoen een naadloze ruistextuur in een
 * offscreen-canvas en levert die als PIXI.Texture (adres-modus 'repeat'), zodat
 * pixi-renderer.js de grond met korrel, vlekken en materiaal kan vullen in
 * plaats van egaal. Eén keer gebakken en gecachet — de per-frame-kost blijft nul.
 *
 * Determinisme: de ruis gebruikt een eigen lokale seed (niet Math.random en
 * niet de sim-RNG), zodat de textuur reproduceerbaar is en de simulatie-RNG
 * ongemoeid blijft. Niets hier raakt Game.state. Zonder PIXI of canvas valt
 * alles stil terug op null → de renderer vult dan gewoon met platte kleur. */
(function (Game) {

  var T = {};
  var MAAT = 128;                 /* power-of-two, naadloos herhaalbaar */
  var cache = {};                 /* "soort|seizoen" -> PIXI.Texture (of null) */

  var P = Game.render.palet;

  function schaal(num, f) { return P ? P.schaal(num, f) : num; }
  function hexStr(num) {
    var s = (num & 0xffffff).toString(16);
    return '#' + '000000'.slice(s.length) + s;
  }

  /* Kleine, snelle, deterministische PRNG (mulberry32) met eigen seed per
     terrein, zodat elke soort z'n eigen korrel krijgt maar altijd hetzelfde. */
  function prng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ s >>> 15, 1 | s);
      t = (t + Math.imul(t ^ t >>> 7, 61 | t)) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* Een vlek op (x,y) — en ook op de vier ±MAAT-buren zodat hij over de rand
     wrapt en de textuur naadloos tegelt. */
  function vlek(ctx, x, y, r, kleur, alpha) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = kleur;
    for (var dx = -1; dx <= 1; dx++) {
      for (var dy = -1; dy <= 1; dy++) {
        if ((dx && Math.abs(x + dx * MAAT - MAAT / 2) > MAAT) ||
            (dy && Math.abs(y + dy * MAAT - MAAT / 2) > MAAT)) continue;
        ctx.beginPath();
        ctx.arc(x + dx * MAAT, y + dy * MAAT, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /* Bouw het canvas voor één terreinsoort in de gegeven basiskleur.
     `stijl` bepaalt de korrel: gras krijgt polletjes, aarde/akker voren,
     rots/berg grove brokken, water niets (dat regelt de renderer zelf). */
  function bakCanvas(basis, stijl, seed) {
    var c = document.createElement('canvas');
    c.width = c.height = MAAT;
    var ctx = c.getContext('2d');
    ctx.fillStyle = hexStr(basis);
    ctx.fillRect(0, 0, MAAT, MAAT);
    var r = prng(seed);

    if (stijl === 'akker') {
      /* Ploegvoren: horizontale banden, licht/donker afgewisseld. */
      var rijen = 8, hh = MAAT / rijen;
      for (var i = 0; i < rijen; i++) {
        vlekRij(ctx, i * hh, hh, schaal(basis, i % 2 ? 1.08 : 0.9), 0.5);
      }
    }

    /* Algemene korrel: veel kleine vlekjes, donker en licht. */
    var n = stijl === 'rots' ? 90 : 150;
    for (var k = 0; k < n; k++) {
      var x = r() * MAAT, y = r() * MAAT;
      var licht = r() < 0.5;
      var f = stijl === 'rots' ? (licht ? 1.2 : 0.78) : (licht ? 1.1 : 0.86);
      var rad = stijl === 'rots' ? 2 + r() * 6 : 1 + r() * 3.5;
      vlek(ctx, x, y, rad, hexStr(schaal(basis, f)), 0.12 + r() * 0.16);
    }
    /* Een paar grotere zachte clumps voor grote-schaal-variatie. */
    for (var m = 0; m < 10; m++) {
      vlek(ctx, r() * MAAT, r() * MAAT, 10 + r() * 22,
        hexStr(schaal(basis, r() < 0.5 ? 1.06 : 0.92)), 0.06 + r() * 0.06);
    }
    ctx.globalAlpha = 1;
    return c;
  }

  function vlekRij(ctx, y, h, kleur, alpha) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = kleur;
    ctx.fillRect(0, y, MAAT, h * 0.6);
  }

  var STIJL = { gras: 'gras', bos: 'gras', vruchtbaar: 'akker', rots: 'rots', berg: 'rots' };
  var SEED = { gras: 1234567, bos: 7654321, vruchtbaar: 2468013, rots: 1357924, berg: 9182736 };

  /* PIXI.Texture voor (soort, seizoen), gebakken en gecachet. null als er geen
     palet/PIXI/canvas is → renderer valt terug op platte kleur. */
  T.get = function (soort, seizoen) {
    var PIXI = window.PIXI;
    if (!PIXI || !P || !TERREINKLEUR(soort)) return null;
    var sl = soort + '|' + (seizoen | 0);
    if (cache[sl] !== undefined) return cache[sl];
    var tex = null;
    try {
      var rij = P.terrein[soort];
      var basis = rij[seizoen] != null ? rij[seizoen] : rij[0];
      var canvas = bakCanvas(basis, STIJL[soort] || 'gras', (SEED[soort] || 111) + (seizoen | 0) * 97);
      tex = PIXI.Texture.from(canvas);
      if (tex.source && tex.source.style) {
        tex.source.style.addressMode = 'repeat';
        if (tex.source.style.update) tex.source.style.update();
      }
    } catch (e) { tex = null; }
    cache[sl] = tex;
    return tex;
  };

  function TERREINKLEUR(soort) { return P && P.terrein && P.terrein[soort]; }

  /* Bij een themawissel (nooit nodig nu) kan de cache leeg. */
  T.wis = function () { cache = {}; };

  Game.render.terreintextuur = T;

})(window.Game);
