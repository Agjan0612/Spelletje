/* One steering model for everything that moves — villagers, soldiers, raiders,
 * sheep. Before this, a walker was a fraction that bounced between 0 and 1 and a
 * raider was a fixed offset from one leader position: nothing turned, nothing
 * slowed down, nobody stepped around anybody. Every "onecht" feeling in the town
 * came out of that.
 *
 * A steered figure carries a heading (`koers`, radians in *tile* space) and a
 * `snelheid` (tiles/sec). Both ease toward a target rather than snapping, so you
 * get bends at corners, a real turn at the end of a route instead of a sprite
 * that mirrors in one frame, and an accelerate/brake at departure and arrival.
 *
 * Pure render maths on fields that already exist — nothing here is stored in
 * Game.state, and nothing here reads a path per frame. */
(function (Game) {

  var B = {};

  /* The render layer's own random source. Everything decorative — walkers,
     raiders, weather, particles, the clouds and the birds — draws from this
     instead of the global Game.render.rng, so the decoration can never perturb the
     simulation's RNG stream. That is the first principle of the whole plan:
     "Decor stuurt de simulatie niet." A mulberry32 over Math.imul, never
     touching Game.render.rng. */
  var zaad = 0x9e3779b9 >>> 0;
  B.rng = function () {
    zaad |= 0; zaad = (zaad + 0x6D2B79F5) | 0;
    var t = Math.imul(zaad ^ (zaad >>> 15), 1 | zaad);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  Game.render.rng = B.rng;

  /* How fast a figure may turn and change speed. Deliberately gentle: the point
     is that motion has weight, not that it is snappy. */
  B.DRAAI = 3.4;     /* rad/s — max turn rate */
  B.VERSNEL = 2.2;   /* tiles/s² — max change in speed */

  var TAU = Math.PI * 2;

  /* Smallest signed angle from a to b, wrapped to (-PI, PI]. */
  B.hoekVerschil = function (a, b) {
    var d = (b - a) % TAU;
    if (d > Math.PI) d -= TAU;
    if (d < -Math.PI) d += TAU;
    return d;
  };

  /* Rotate `huidig` toward `doel` by at most `max` radians. */
  B.draaiNaar = function (huidig, doel, max) {
    var d = B.hoekVerschil(huidig, doel);
    if (d > max) d = max;
    else if (d < -max) d = -max;
    return huidig + d;
  };

  /* The core: ease a figure's heading and speed toward their targets. `f` is any
     object with `koers` and `snelheid`; it is mutated in place. */
  B.stuur = function (f, doelKoers, doelSnelheid, dt) {
    if (f.koers == null) f.koers = doelKoers;
    if (f.snelheid == null) f.snelheid = 0;
    f.koers = B.draaiNaar(f.koers, doelKoers, B.DRAAI * dt);
    var ds = doelSnelheid - f.snelheid;
    var max = B.VERSNEL * dt;
    if (ds > max) ds = max; else if (ds < -max) ds = -max;
    f.snelheid += ds;
  };

  /* Heading of a world-tile delta, in the same space the camera projects. */
  B.koersVan = function (dx, dy) { return Math.atan2(dy, dx); };

  /* Which way a figure with this heading faces on screen: the iso x of the
     heading vector. isoX = (dx - dy)/2, so a figure heading "east+south" still
     reads as facing right. Returns +1 (right) or -1 (left). */
  B.kijkrichting = function (koers) {
    var dx = Math.cos(koers), dy = Math.sin(koers);
    return (dx - dy) >= 0 ? 1 : -1;
  };

  /* ------------------------------------------------------------- toestanden --

     A moving figure is in one `bezig` state at a time, each with its own
     behaviour and animation. This replaces the old richting+wachtT pair: it is
     what makes "doing a job" possible at all, because now there is a state to
     hang an animation on for a baker as well as for a woodcutter. */
  B.LOPEN = 'lopen';
  B.WERKEN = 'werken';
  B.LADEN = 'laden';
  B.LOSSEN = 'lossen';
  B.PRATEN = 'praten';
  B.RUSTEN = 'rusten';
  B.HUISWAARTS = 'huiswaarts';

  /* How long a figure lingers in a non-walking state before moving on. */
  B.duur = function (bezig) {
    switch (bezig) {
      case B.WERKEN: return 1.6 + Game.render.rng() * 1.6;
      case B.LADEN: return 0.5 + Game.render.rng() * 0.5;
      case B.LOSSEN: return 0.4 + Game.render.rng() * 0.5;
      case B.PRATEN: return 2.0 + Game.render.rng() * 1.4;
      case B.RUSTEN: return 3.0 + Game.render.rng() * 3.0;
      default: return 0.4 + Game.render.rng() * 0.9;
    }
  };

  Game.render.beweging = B;

})(window.Game);
