/* Terreintextuur — geschilderde grond in AoE2-stijl.
 *
 * De renderlaag vulde terrein-diamanten vroeger met een platte kleur, wat er
 * vlak en cartoonesk uitzag. Dit module bakt per terreinsoort × seizoen een
 * naadloze, gelaagde textuur in een offscreen-canvas en levert die als
 * PIXI.Texture (adres-modus 'repeat'), zodat pixi-renderer.js de grond met
 * grote kleurvlekken, korrel én terrein-eigen detail (graspollen, voren,
 * rotsscheuren) kan vullen. Eén keer gebakken en gecachet — per-frame nul kost.
 *
 * De rijkdom zit in meerdere schalen: grote zachte vlekken (de "clumps" die
 * grond breken), middenkorrel, fijne spikkels, en soort-specifieke trekjes.
 *
 * Determinisme: eigen lokale mulberry32-seed per terrein — niet Math.random en
 * niet de sim-RNG. Niets hier raakt Game.state. Zonder PIXI/canvas valt alles
 * terug op null → de renderer vult dan gewoon met platte kleur. */
(function (Game) {

  var T = {};
  var MAAT = 256;                 /* power-of-two, naadloos herhaalbaar */
  var cache = {};                 /* "soort|seizoen" -> PIXI.Texture (of null) */

  var P = Game.render.palet;

  function schaal(num, f) { return P ? P.schaal(num, f) : num; }
  function meng(a, b, t) { return P ? P.meng(a, b, t) : a; }
  function hexStr(num) {
    var s = (num & 0xffffff).toString(16);
    return '#' + '000000'.slice(s.length) + s;
  }

  function prng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ s >>> 15, 1 | s);
      t = (t + Math.imul(t ^ t >>> 7, 61 | t)) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* Een gevulde vlek op (x,y) die over de rand wrapt (±MAAT), zodat de textuur
     naadloos tegelt. Gebruikt voor cirkels. */
  function vlek(ctx, x, y, r, kleur, alpha) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = kleur;
    for (var dx = -1; dx <= 1; dx++) {
      for (var dy = -1; dy <= 1; dy++) {
        if ((dx && x + dx * MAAT + r < 0) || (dx && x + dx * MAAT - r > MAAT)) continue;
        if ((dy && y + dy * MAAT + r < 0) || (dy && y + dy * MAAT - r > MAAT)) continue;
        ctx.beginPath();
        ctx.arc(x + dx * MAAT, y + dy * MAAT, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /* Een korte streep (grashalm, voor, scheur), wrappend. */
  function streep(ctx, x, y, dx, dy, w, kleur, alpha) {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = kleur;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    for (var ox = -1; ox <= 1; ox++) {
      for (var oy = -1; oy <= 1; oy++) {
        ctx.beginPath();
        ctx.moveTo(x + ox * MAAT, y + oy * MAAT);
        ctx.lineTo(x + dx + ox * MAAT, y + dy + oy * MAAT);
        ctx.stroke();
      }
    }
  }

  /* Terrein-accenten: waar de grote vlekken naartoe mengen. Twee kanten op —
     een warme/lichte en een koele/donkere — geeft de geschilderde variatie. */
  var ACCENT = {
    gras:       { licht: 0xb6c25a, donker: 0x4c6f2f, vlek: 0x8a7a3a },   /* geelgroen / mosgroen / droge plek */
    bos:        { licht: 0x5c7a3e, donker: 0x274421, vlek: 0x3a5230 },
    vruchtbaar: { licht: 0xc4a860, donker: 0x6f5a26, vlek: 0x8a6a30 },
    rots:       { licht: 0xa9a496, donker: 0x5f5b52, vlek: 0x6f6a5e },
    berg:       { licht: 0x8f8a80, donker: 0x484238, vlek: 0x5c5750 }
  };

  var STIJL = { gras: 'gras', bos: 'gras', vruchtbaar: 'akker', rots: 'rots', berg: 'rots' };
  var SEED = { gras: 1234567, bos: 7654321, vruchtbaar: 2468013, rots: 1357924, berg: 9182736 };

  function bakCanvas(soort, basis, seizoen) {
    var c = document.createElement('canvas');
    c.width = c.height = MAAT;
    var ctx = c.getContext('2d');
    var stijl = STIJL[soort] || 'gras';
    var acc = ACCENT[soort] || { licht: schaal(basis, 1.2), donker: schaal(basis, 0.75), vlek: schaal(basis, 0.9) };
    var r = prng((SEED[soort] || 111) + (seizoen | 0) * 97);
    var winter = seizoen === 3;

    ctx.fillStyle = hexStr(basis);
    ctx.fillRect(0, 0, MAAT, MAAT);

    /* 1. Grote zachte vlekken — de belangrijkste laag tegen vlakheid: brede
       velden lichter/donkerder en een enkele droge/mos-plek. */
    var groot = 16;
    for (var i = 0; i < groot; i++) {
      var kant = r();
      var kl = kant < 0.4 ? acc.licht : (kant < 0.8 ? acc.donker : acc.vlek);
      vlek(ctx, r() * MAAT, r() * MAAT, 40 + r() * 60, hexStr(meng(basis, kl, 0.6)), 0.1 + r() * 0.14);
    }
    /* 2. Middenvlekken. */
    for (var m = 0; m < 40; m++) {
      var kl2 = r() < 0.5 ? acc.licht : acc.donker;
      vlek(ctx, r() * MAAT, r() * MAAT, 10 + r() * 22, hexStr(meng(basis, kl2, 0.55)), 0.08 + r() * 0.12);
    }

    if (stijl === 'akker') {
      /* Ploegvoren: diagonale banden licht/donker, plus kluiten. */
      ctx.save();
      ctx.translate(MAAT / 2, MAAT / 2); ctx.rotate(0.5); ctx.translate(-MAAT / 2, -MAAT / 2);
      for (var v = -MAAT; v < MAAT * 2; v += 10) {
        streep(ctx, v, -MAAT, 0, MAAT * 3, 4, hexStr(schaal(basis, 1.1)), 0.22);
        streep(ctx, v + 5, -MAAT, 0, MAAT * 3, 4, hexStr(schaal(basis, 0.86)), 0.2);
      }
      ctx.restore();
    }

    /* 3. Fijne korrel: veel kleine spikkels, licht en donker. */
    var n = stijl === 'rots' ? 260 : 420;
    for (var k = 0; k < n; k++) {
      var x = r() * MAAT, y = r() * MAAT;
      var licht = r() < 0.5;
      var f = stijl === 'rots' ? (licht ? 1.28 : 0.72) : (licht ? 1.18 : 0.82);
      var rad = stijl === 'rots' ? 1.5 + r() * 5 : 0.7 + r() * 2.2;
      vlek(ctx, x, y, rad, hexStr(schaal(basis, f)), 0.1 + r() * 0.18);
    }

    /* 4. Soort-eigen trekjes. */
    if (stijl === 'gras') {
      /* Graspollen: korte opstaande halmen, donker en licht; soms een bloem. */
      var halmen = soort === 'bos' ? 90 : 150;
      for (var h = 0; h < halmen; h++) {
        var hx = r() * MAAT, hy = r() * MAAT, len = 2 + r() * 4;
        var groen = r() < 0.5 ? schaal(basis, 0.7) : meng(basis, acc.licht, 0.7);
        streep(ctx, hx, hy, (r() - 0.5) * 2, -len, 1, hexStr(groen), 0.35 + r() * 0.3);
      }
      if (!winter) {
        var bloemen = soort === 'bos' ? 4 : 12;
        var kleuren = [0xf2e6a0, 0xe8f0f4, 0xe8a6c8, 0xf0c060];
        for (var b = 0; b < bloemen; b++) {
          vlek(ctx, r() * MAAT, r() * MAAT, 1.1 + r() * 1.1, hexStr(kleuren[(r() * kleuren.length) | 0]), 0.7);
        }
      }
    } else if (stijl === 'rots') {
      /* Rotsscheuren + brokken: donkere hoekige lijnen en lichte facetten. */
      for (var s2 = 0; s2 < 40; s2++) {
        var rx = r() * MAAT, ry = r() * MAAT, a = r() * Math.PI, ln = 6 + r() * 16;
        streep(ctx, rx, ry, Math.cos(a) * ln, Math.sin(a) * ln, 1 + r(), hexStr(schaal(basis, 0.6)), 0.3);
      }
    }

    ctx.globalAlpha = 1;
    return c;
  }

  T.get = function (soort, seizoen) {
    var PIXI = window.PIXI;
    if (!PIXI || !P || !TERREINKLEUR(soort)) return null;
    var sl = soort + '|' + (seizoen | 0);
    if (cache[sl] !== undefined) return cache[sl];
    var tex = null;
    try {
      var rij = P.terrein[soort];
      var basis = rij[seizoen] != null ? rij[seizoen] : rij[0];
      var canvas = bakCanvas(soort, basis, seizoen | 0);
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

  T.wis = function () { cache = {}; };

  Game.render.terreintextuur = T;

})(window.Game);
