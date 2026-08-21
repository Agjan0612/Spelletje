/* Floating yields: the little "+🪵 6" that drifts up out of a working building.
 *
 * It is the cheapest possible answer to "is this building actually doing
 * anything?" — and it is honest: the number is what that building really
 * produced since its last floater, using the same rates economy.js uses.
 *
 * Lives entirely in the render layer, on real time, never in Game.state. */
(function (Game) {

  var F = {};

  var lijst = [];
  var opgespaard = {};        /* building id -> production since its last floater */
  var MAX = 26;
  var DREMPEL = 4;            /* units that have to add up before one shows */
  var RUST = 2.2;             /* seconds a building waits before the next one */

  F.reset = function () {
    lijst.length = 0;
    opgespaard = {};
  };

  /* What this building is making per second right now, and of what.
     Mirrors economy.js closely enough that the number on screen matches what
     the stock does; it is a display, not a second source of truth. */
  function opbrengst(s, g, d) {
    if (!g.gebouwd || g.uit || g.werkers <= 0 || g.waarschuwing) return null;

    var mult = s.bonus.productie * (0.75 + 0.25 * (s.tevredenheid / 100));
    var seizoen = Game.core.seasons;

    if (d.wint) {
      var tempo = d.wint.tempo * g.werkers * mult * s.bonus.mijnbouw;
      if (Game.config.resources[d.wint.res].voedsel) tempo *= (s.bonus.voedsel || 1);
      if (d.seizoensgevoelig) tempo *= seizoen.factor(s, 'jacht');
      return tempo > 0 ? { res: d.wint.res, tempo: tempo } : null;
    }

    if (d.maakt) {
      var factor = g.werkers * mult;
      if (d.seizoensgevoelig) factor *= seizoen.factor(s, 'akker');
      if (factor <= 0) return null;
      for (var r in d.maakt.uit) {
        var uit = d.maakt.uit[r] * factor;
        if (Game.config.resources[r].voedsel) uit *= (s.bonus.voedsel || 1);
        if (uit > 0) return { res: r, tempo: uit };
      }
    }
    return null;
  }

  F.tick = function (s, dt) {
    /* Age the ones already in the air. */
    for (var i = lijst.length - 1; i >= 0; i--) {
      var f = lijst[i];
      f.leven -= dt;
      f.stijg += dt * 16;
      if (f.leven <= 0) lijst.splice(i, 1);
    }

    for (var b = 0; b < s.gebouwen.length; b++) {
      var g = s.gebouwen[b];
      var d = Game.core.state.def(g);
      var op = opbrengst(s, g, d);
      var pot = opgespaard[g.id];

      if (!op) { if (pot) pot.aantal = 0; continue; }
      if (!pot) pot = opgespaard[g.id] = { aantal: 0, rust: Math.random() * RUST };

      pot.aantal += op.tempo * dt;
      pot.rust -= dt;
      if (pot.rust > 0 || pot.aantal < DREMPEL || lijst.length >= MAX) continue;

      pot.rust = RUST;
      lijst.push({
        wx: (g.x + d.grootte / 2) * Game.render.TEGEL,
        wy: (g.y + d.grootte * 0.35) * Game.render.TEGEL,
        res: op.res,
        aantal: Math.round(pot.aantal),
        leven: 1.9,
        maxLeven: 1.9,
        stijg: 0
      });
      pot.aantal = 0;
    }
  };

  F.teken = function (ctx, cam, p) {
    if (!lijst.length || p < 16) return;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '600 ' + Math.round(Math.max(10, p * 0.26)) + 'px "Iowan Old Style", Georgia, serif';

    for (var i = 0; i < lijst.length; i++) {
      var f = lijst[i];
      var sp = cam.wereldNaarScherm(f.wx, f.wy);
      var y = sp.y - p * 0.7 - f.stijg * (p / Game.render.TEGEL);
      if (sp.x < -40 || y < -20 || sp.x > cam.breedte + 40 || y > cam.hoogte + 20) continue;

      var alpha = Game.util.clamp(f.leven / f.maxLeven, 0, 1);
      var tekst = '+' + f.aantal + ' ' + Game.config.resources[f.res].emoji;

      ctx.globalAlpha = alpha * 0.75;
      ctx.fillStyle = '#1a120b';
      ctx.fillText(tekst, sp.x + 1, y + 1);

      ctx.globalAlpha = alpha;
      ctx.fillStyle = Game.config.resources[f.res].kleur;
      ctx.fillText(tekst, sp.x, y);
    }
    ctx.restore();
  };

  Game.render.floaters = F;

})(window.Game);
