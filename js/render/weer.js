/* Weather as a render-only state machine.
 *
 * Before this, the only weather was seasonal leaves and snow. A passing rain
 * shower is one timer that lives here in the render layer — never in
 * Game.state, so a save made mid-downpour reloads with no odd state to restore
 * (there is none). It buys, for almost nothing: a darker, bluer wash while it
 * rains, drizzle streaks, a wet sheen the roads and roofs can read
 * (weer.natheid), and puddles that dry up afterwards. A low morning mist rides
 * the dawn on top of the same module.
 *
 * Everything runs on real time in tickEffecten, like the particles and the
 * ambient life around it. */
(function (Game) {

  var W = {};

  var fase = 'droog';       /* droog | regen | wegtrekken */
  var faseTimer = 40 + Game.render.rng() * 60;
  var intensiteit = 0;      /* 0..1 how hard it is coming down right now */
  var nat = 0;              /* 0..1 wetness — lags the rain and lingers after */
  var mist = 0;             /* 0..1 low morning fog */
  var druppels = [];        /* rain streaks in normalised screen space */

  W.fase = function () { return fase; };
  W.natheid = function () { return nat; };
  W.mistNiveau = function () { return mist; };
  W.regent = function () { return intensiteit > 0.05; };

  /* How likely a shower is, by season: wettest in spring and autumn. */
  var REGENKANS = [0.55, 0.3, 0.6, 0.35];

  W.tick = function (s, dt) {
    if (dt <= 0) return;
    faseTimer -= dt;

    if (fase === 'droog') {
      if (faseTimer <= 0) {
        var kans = REGENKANS[s.seizoen] || 0.4;
        if (Game.render.rng() < kans) { fase = 'regen'; faseTimer = 25 + Game.render.rng() * 45; }
        else faseTimer = 40 + Game.render.rng() * 60;
      }
    } else if (fase === 'regen') {
      if (faseTimer <= 0) { fase = 'wegtrekken'; faseTimer = 8 + Game.render.rng() * 6; }
    } else if (fase === 'wegtrekken') {
      if (faseTimer <= 0) { fase = 'droog'; faseTimer = 60 + Game.render.rng() * 90; }
    }

    /* Snow, not rain, when it freezes: leave winter to the seasonal emitter. */
    var doel = (fase === 'regen' && s.seizoen !== 3) ? 1 : (fase === 'wegtrekken' ? 0.25 : 0);
    intensiteit += (doel - intensiteit) * Math.min(1, dt * 0.6);
    if (intensiteit < 0.01) intensiteit = 0;

    /* Wetness rises with the rain and dries slowly once it stops. */
    if (intensiteit > nat) nat += (intensiteit - nat) * Math.min(1, dt * 0.5);
    else nat = Math.max(0, nat - dt * 0.03);

    /* Morning mist rides the dawn, thinning through the day. */
    var L = Game.render.sfeer ? Game.render.sfeer.licht(s) : { ochtend: 0 };
    var mistDoel = Math.min(0.8, (L.ochtend || 0) * 0.9 + (s.seizoen === 3 ? 0.15 : 0));
    mist += (mistDoel - mist) * Math.min(1, dt * 0.4);

    /* Advance the rain streaks (normalised screen coords: they fall down-right). */
    var wil = Math.round(intensiteit * 140);
    while (druppels.length < wil) {
      druppels.push({ x: Game.render.rng(), y: Game.render.rng(), v: 0.9 + Game.render.rng() * 0.7, l: 0.04 + Game.render.rng() * 0.05 });
    }
    if (druppels.length > wil) druppels.length = wil;
    for (var i = 0; i < druppels.length; i++) {
      var d = druppels[i];
      d.y += d.v * dt; d.x += d.v * 0.28 * dt;
      if (d.y > 1.05) { d.y = -0.05; d.x = Game.render.rng(); }
      if (d.x > 1.05) d.x -= 1.1;
    }
  };

  /* Low fog, drawn before the buildings so it sits between the far trees and
     the town. A soft pale band that thickens toward the top (the distance in an
     iso view), plus a faint ground haze. */
  W.tekenVoor = function (ctx, cam, s) {
    if (mist < 0.02) return;
    var kleur = s.seizoen === 3 ? '224,232,240' : '210,220,224';
    var g = ctx.createLinearGradient(0, 0, 0, cam.hoogte * 0.7);
    g.addColorStop(0, 'rgba(' + kleur + ',' + (0.28 * mist).toFixed(3) + ')');
    g.addColorStop(0.5, 'rgba(' + kleur + ',' + (0.12 * mist).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(' + kleur + ',0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cam.breedte, cam.hoogte * 0.7);
  };

  /* The rain itself, drawn over the town (after particles, under the light
     grade): a cool wash and slanted streaks. */
  W.tekenNa = function (ctx, cam, s) {
    if (intensiteit < 0.02) return;
    var b = cam.breedte, h = cam.hoogte;

    /* A cool, slightly darker wash while it pours. */
    ctx.fillStyle = 'rgba(58,74,102,' + (0.16 * intensiteit).toFixed(3) + ')';
    ctx.fillRect(0, 0, b, h);

    /* Slanted drizzle. One path, stroked once. */
    ctx.strokeStyle = 'rgba(200,214,230,' + (0.34 * intensiteit).toFixed(3) + ')';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var i = 0; i < druppels.length; i++) {
      var d = druppels[i];
      var x = d.x * b, y = d.y * h;
      ctx.moveTo(x, y);
      ctx.lineTo(x - d.l * b * 0.28, y - d.l * h);
    }
    ctx.stroke();
  };

  Game.render.weer = W;

})(window.Game);
