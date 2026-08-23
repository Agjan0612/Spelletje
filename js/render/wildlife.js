/* Livestock and fish — the part of the world that is alive but does not work.
 *
 * A small flock of sheep grazes on the meadows around town (it grows with the
 * number of homes), and fish jump in the fishing grounds your huts are working.
 * Both are decorative: they live in this module, run on real time and never
 * touch Game.state, so saves stay pure JSON. The deer on the hunting grounds
 * are drawn by sprites.js, straight from the map's `wild` nodes. */
(function (Game) {

  var W = {};

  var schapen = [];
  var visplekken = [];
  var teken = null;

  /* Rebuild the flock and the fishing spots for this town. */
  W.ververs = function (s) {
    var nu = handtekening(s);
    if (nu === teken) return;
    teken = nu;

    maakSchapen(s);
    zoekVisplekken(s);
  };

  function handtekening(s) {
    return [s.kaart.seed, s.gebouwen.length, s.bevolking.ruimte].join('|');
  }

  /* --------------------------------------------------------------- schapen */

  function maakSchapen(s) {
    var map = Game.core.map;
    var wil = Game.util.clamp(Math.floor(s.bevolking.ruimte / 8), 0, 8);
    schapen.length = 0;
    if (!wil) return;

    /* Graze near the town square, on free grass. */
    var plein = s.gebouwen.filter(function (g) { return g.type === 'dorpsplein'; })[0];
    var cx = plein ? plein.x + 1 : (s.start ? s.start.x : s.kaart.b / 2);
    var cy = plein ? plein.y + 1 : (s.start ? s.start.y : s.kaart.h / 2);

    for (var r = 3; r < 14 && schapen.length < wil; r++) {
      for (var hoek = 0; hoek < 12 && schapen.length < wil; hoek++) {
        var a = (hoek / 12) * Math.PI * 2 + r;
        var x = Math.round(cx + Math.cos(a) * r);
        var y = Math.round(cy + Math.sin(a) * r);
        var t = map.tegel(s.kaart, x, y);
        if (!t || t.t !== 'gras' || t.b != null || t.n) continue;
        schapen.push({
          x: x + 0.5, y: y + 0.5,
          thuisX: x + 0.5, thuisY: y + 0.5,
          fase: Game.render.rng() * 6.28,
          kijk: Game.render.rng() < 0.5 ? 1 : -1,
          traag: 0.25 + Game.render.rng() * 0.25
        });
      }
    }
  }

  /* ------------------------------------------------------------- visplekken */

  function zoekVisplekken(s) {
    var map = Game.core.map;
    visplekken.length = 0;

    for (var i = 0; i < s.gebouwen.length && visplekken.length < 8; i++) {
      var g = s.gebouwen[i];
      if (g.type !== 'vissershut' || !g.gebouwd) continue;
      var t = map.zoekNode(s.kaart, g.x, g.y, 'vis', 4);
      if (!t) continue;
      var idx = s.kaart.tegels.indexOf(t);
      visplekken.push({
        x: (idx % s.kaart.b) + 0.5,
        y: Math.floor(idx / s.kaart.b) + 0.5,
        timer: Game.render.rng() * 4,
        sprong: 0
      });
    }
  }

  /* ------------------------------------------------------------------ tick */

  W.tick = function (s, dt) {
    W.ververs(s);

    for (var i = 0; i < schapen.length; i++) {
      var sc = schapen[i];
      sc.fase += dt * sc.traag;
      /* A slow drift around the home tile — sheep wander, they don't march. */
      var nx = sc.thuisX + Math.sin(sc.fase) * 0.55;
      var ny = sc.thuisY + Math.cos(sc.fase * 0.77) * 0.4;
      sc.kijk = nx > sc.x ? 1 : (nx < sc.x ? -1 : sc.kijk);
      sc.x = nx; sc.y = ny;
    }

    for (var j = 0; j < visplekken.length; j++) {
      var v = visplekken[j];
      if (v.sprong > 0) { v.sprong = Math.max(0, v.sprong - dt * 1.6); continue; }
      v.timer -= dt;
      if (v.timer <= 0) {
        v.timer = 3 + Game.render.rng() * 6;
        v.sprong = 1;
        v.ox = (Game.render.rng() - 0.5) * 0.5;
        v.oy = (Game.render.rng() - 0.5) * 0.5;
      }
    }
  };

  /* Hand the visible animals to the renderer's depth-sorted layer. */
  W.verzamel = function (zicht, uit) {
    var i;
    for (i = 0; i < schapen.length; i++) {
      var sc = schapen[i];
      if (sc.x < zicht.x0 - 1 || sc.x > zicht.x1 + 1 || sc.y < zicht.y0 - 1 || sc.y > zicht.y1 + 1) continue;
      uit.push({ d: sc.x + sc.y, yy: sc.y, soort: 0.6, dier: sc, wat: 'schaap' });
    }
    for (i = 0; i < visplekken.length; i++) {
      var v = visplekken[i];
      if (v.sprong <= 0) continue;
      if (v.x < zicht.x0 - 1 || v.x > zicht.x1 + 1 || v.y < zicht.y0 - 1 || v.y > zicht.y1 + 1) continue;
      uit.push({ d: v.x + v.y, yy: v.y, soort: 0.6, dier: v, wat: 'vis' });
    }
  };

  /* --------------------------------------------------------------- tekenen */

  W.teken = function (ctx, cam, p, entry) {
    if (entry.wat === 'schaap') schaap(ctx, cam, p, entry.dier);
    else vis(ctx, cam, p, entry.dier);
  };

  function schaap(ctx, cam, p, sc) {
    var sp = cam.wereldNaarScherm(sc.x * Game.render.TEGEL, sc.y * Game.render.TEGEL);
    if (sp.x < -20 || sp.y < -20 || sp.x > cam.breedte + 20 || sp.y > cam.hoogte + 20) return;

    var graas = Math.max(0, Math.sin(sc.fase * 2.1)) * p * 0.02;

    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.beginPath();
    ctx.ellipse(sp.x, sp.y + p * 0.015, p * 0.09, p * 0.035, 0, 0, Math.PI * 2);
    ctx.fill();

    /* legs */
    ctx.strokeStyle = '#6a5a4a';
    ctx.lineWidth = Math.max(1, p * 0.016);
    for (var i = 0; i < 2; i++) {
      var lx = sp.x + (i - 0.5) * p * 0.09;
      ctx.beginPath();
      ctx.moveTo(lx, sp.y); ctx.lineTo(lx, sp.y - p * 0.05);
      ctx.stroke();
    }

    /* woolly body */
    ctx.fillStyle = '#eee9e0';
    ctx.beginPath();
    ctx.ellipse(sp.x, sp.y - p * 0.085, p * 0.085, p * 0.055, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f6f3ec';
    ctx.beginPath();
    ctx.ellipse(sp.x - sc.kijk * p * 0.03, sp.y - p * 0.1, p * 0.05, p * 0.035, 0, 0, Math.PI * 2);
    ctx.fill();

    /* head, dipping while grazing */
    ctx.fillStyle = '#4a4038';
    ctx.beginPath();
    ctx.ellipse(sp.x + sc.kijk * p * 0.085, sp.y - p * 0.09 + graas, p * 0.028, p * 0.024, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function vis(ctx, cam, p, v) {
    var sp = cam.wereldNaarScherm((v.x + (v.ox || 0)) * Game.render.TEGEL,
      (v.y + (v.oy || 0)) * Game.render.TEGEL);
    var f = 1 - v.sprong;                      /* 0 at the top of the jump */
    var boog = Math.sin(v.sprong * Math.PI) * p * 0.22;

    /* Ripple rings on the water. */
    ctx.strokeStyle = 'rgba(226,244,250,' + (0.5 * v.sprong).toFixed(3) + ')';
    ctx.lineWidth = Math.max(1, p * 0.012);
    for (var i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.ellipse(sp.x, sp.y, p * (0.06 + f * 0.16 + i * 0.05), p * (0.03 + f * 0.08 + i * 0.025), 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    /* The fish itself, arcing out of the water. */
    ctx.fillStyle = '#9fc0cc';
    ctx.save();
    ctx.translate(sp.x, sp.y - boog);
    ctx.rotate((0.5 - v.sprong) * 1.2);
    ctx.beginPath();
    ctx.ellipse(0, 0, p * 0.05, p * 0.022, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-p * 0.05, 0);
    ctx.lineTo(-p * 0.085, -p * 0.025);
    ctx.lineTo(-p * 0.085, p * 0.025);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  Game.render.wildlife = W;

})(window.Game);
