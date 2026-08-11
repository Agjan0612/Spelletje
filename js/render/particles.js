/* Mini particle system — smoke, sparks, fire and dust.
 *
 * Purely a render-layer effect: particles live only in this module, run on
 * real time (never the fixed simulation step) and are never written to
 * Game.state, so saves stay pure JSON. Reused by the raid visuals (fase 3),
 * the age-up sweep (fase 5) and the work/ambient touches (fase 6).
 *
 * World coordinates here are world *pixels* (tileX * Game.render.TEGEL), the
 * same space the walkers use, so cam.wereldNaarScherm() converts them. */
(function (Game) {

  var P = {};

  var deeltjes = [];
  var MAX = 420;              /* hard cap so a runaway emitter can't choke rAF */

  /* Per-type defaults; individual emits can override via opts. */
  var SOORT = {
    rook:  { leven: [1.4, 2.6], grootte: [3, 6],  vy: [-11, -20], vx: [-4, 4],  groei: 7,   kleur: '210,205,195', begin: 0.34, zwaarte: 0 },
    stof:  { leven: [0.5, 1.1], grootte: [2, 5],  vy: [-6, -16],  vx: [-14, 14], groei: 5,  kleur: '175,150,110', begin: 0.42, zwaarte: 26 },
    vonk:  { leven: [0.4, 0.9], grootte: [1, 2.4], vy: [-24, -46], vx: [-26, 26], groei: -1, kleur: '255,196,96', begin: 0.95, zwaarte: 60 },
    vuur:  { leven: [0.5, 1.0], grootte: [3, 7],  vy: [-14, -30], vx: [-7, 7],  groei: -3,  kleur: '255,150,60', begin: 0.9,  zwaarte: -6 }
  };

  function rnd(a, b) { return a + Math.random() * (b - a); }

  /* Spawn `aantal` particles of a type at a world-pixel position. */
  P.emit = function (soort, wx, wy, aantal, opts) {
    var def = SOORT[soort] || SOORT.rook;
    opts = opts || {};
    aantal = aantal || 1;
    for (var i = 0; i < aantal; i++) {
      if (deeltjes.length >= MAX) break;
      var maxLeven = rnd(def.leven[0], def.leven[1]) * (opts.levenSchaal || 1);
      deeltjes.push({
        soort: soort,
        x: wx + (opts.spreiding ? rnd(-opts.spreiding, opts.spreiding) : 0),
        y: wy + (opts.spreidingY ? rnd(-opts.spreidingY, opts.spreidingY) : 0),
        vx: rnd(def.vx[0], def.vx[1]) + (opts.vx || 0),
        vy: rnd(def.vy[0], def.vy[1]) + (opts.vy || 0),
        zwaarte: def.zwaarte,
        groei: def.groei,
        r: rnd(def.grootte[0], def.grootte[1]) * (opts.grootte || 1),
        leven: maxLeven,
        maxLeven: maxLeven,
        begin: opts.begin != null ? opts.begin : def.begin,
        kleur: opts.kleur || def.kleur
      });
    }
  };

  /* Convenience emitters used around the game. */
  P.rook = function (wx, wy, kracht) { P.emit('rook', wx, wy, kracht || 1, { spreiding: 3 }); };
  P.stof = function (wx, wy, kracht) { P.emit('stof', wx, wy, kracht || 3, { spreiding: 6, spreidingY: 3 }); };
  P.vonken = function (wx, wy, kracht) { P.emit('vonk', wx, wy, kracht || 4, { spreiding: 2 }); };
  P.vuur = function (wx, wy, kracht) { P.emit('vuur', wx, wy, kracht || 3, { spreiding: 5, spreidingY: 4 }); };

  /* Small burst of dust + sparks, e.g. a raider hitting a building. */
  P.klap = function (wx, wy) {
    P.emit('stof', wx, wy, 10, { spreiding: 7, spreidingY: 5 });
    P.emit('vonk', wx, wy, 6, { spreiding: 3 });
  };

  P.reset = function () { deeltjes.length = 0; };
  P.aantal = function () { return deeltjes.length; };

  P.tick = function (dt) {
    if (dt <= 0) return;
    for (var i = deeltjes.length - 1; i >= 0; i--) {
      var d = deeltjes[i];
      d.leven -= dt;
      if (d.leven <= 0) { deeltjes.splice(i, 1); continue; }
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.vy += d.zwaarte * dt;
      d.vx *= (1 - 1.1 * dt);           /* drag, so sideways motion settles */
      d.r += d.groei * dt;
      if (d.r < 0.3) d.r = 0.3;
    }
  };

  /* Draw everything. `p` is pixels-per-tile so particles scale with zoom. */
  P.teken = function (ctx, cam) {
    if (!deeltjes.length) return;
    var schaal = cam.px() / Game.render.TEGEL;
    var vorigeComp = ctx.globalCompositeOperation;

    for (var i = 0; i < deeltjes.length; i++) {
      var d = deeltjes[i];
      var sp = cam.wereldNaarScherm(d.x, d.y);
      if (sp.x < -30 || sp.y < -30 || sp.x > cam.breedte + 30 || sp.y > cam.hoogte + 30) continue;

      var t = d.leven / d.maxLeven;               /* 1 → 0 over its life */
      var alpha = d.begin * Game.util.clamp(t, 0, 1);
      var r = Math.max(0.4, d.r * schaal);

      /* Sparks and fire glow additively; smoke and dust just fade. */
      ctx.globalCompositeOperation =
        (d.soort === 'vonk' || d.soort === 'vuur') ? 'lighter' : 'source-over';

      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(' + d.kleur + ',1)';
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = vorigeComp;
  };

  Game.render.particles = P;

})(window.Game);
