/* Decorative animals that wander the map near the places villagers work:
   deer by the hunting grounds, fish jumping by the fishing huts, sheep around
   the town square. Like the walkers they carry no simulation weight and live
   only in this module, so a save stays pure JSON. Everything guards on the
   module existing, so the game runs fine without this file. */
(function (Game) {

  var W = {};
  var dieren = [];         /* { x, y (tile coords), bx, by, faze, snelheid, soort } */
  var map = Game.core.map;

  var SOORT = {
    hert:  { emoji: '🦌', straal: 2.4, schaal: 0.5 },
    vis:   { emoji: '🐟', straal: 0.6, schaal: 0.42 },
    schaap:{ emoji: '🐑', straal: 1.8, schaal: 0.46 }
  };

  /* Rebuild the herd from the current buildings. Called on the same slow
     cadence as the walkers, so it stays cheap. */
  W.ververs = function (s) {
    dieren = [];
    if (!s || !s.gebouwen) return;

    var plein = s.gebouwen.filter(function (g) { return g.type === 'dorpsplein' && g.gebouwd; })[0];
    if (plein) {
      for (var k = 0; k < 3; k++) voegToe(plein.x + 1 + (Math.random() - 0.5) * 2,
        plein.y + 2.4 + Math.random() * 1.4, 'schaap');
    }

    for (var i = 0; i < s.gebouwen.length && dieren.length < 40; i++) {
      var g = s.gebouwen[i];
      if (!g.gebouwd) continue;
      var d = Game.core.state.def(g);
      if (!d.wint) continue;

      var soort = d.wint.node === 'wild' ? 'hert' : (d.wint.node === 'vis' ? 'vis' : null);
      if (!soort) continue;

      var t = map.zoekNode(s.kaart, g.x, g.y, d.wint.node, d.wint.straal);
      if (!t) continue;
      var idx = s.kaart.tegels.indexOf(t);
      var nx = idx % s.kaart.b, ny = Math.floor(idx / s.kaart.b);

      var aantal = soort === 'vis' ? 2 : 2;
      for (var n = 0; n < aantal && dieren.length < 40; n++) {
        voegToe(nx + 0.5 + (Math.random() - 0.5), ny + 0.5 + (Math.random() - 0.5), soort);
      }
    }
  };

  function voegToe(x, y, soort) {
    dieren.push({
      x: x, y: y, bx: x, by: y,
      faze: Math.random() * Math.PI * 2,
      snelheid: 0.5 + Math.random() * 0.6,
      soort: soort
    });
  }

  W.tick = function (dt) {
    for (var i = 0; i < dieren.length; i++) {
      var a = dieren[i];
      a.faze += dt * a.snelheid;
      var s = SOORT[a.soort];
      if (a.soort === 'vis') {
        /* fish only shift sideways a touch; the jump is drawn, not moved */
        a.x = a.bx + Math.sin(a.faze * 0.5) * 0.25;
      } else {
        a.x = a.bx + Math.cos(a.faze) * s.straal;
        a.y = a.by + Math.sin(a.faze * 0.7) * s.straal * 0.6;
      }
    }
  };

  W.teken = function (ctx, cam, p) {
    if (!dieren.length || p < 15) return;
    var TEGEL = Game.render.TEGEL;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var i = 0; i < dieren.length; i++) {
      var a = dieren[i];
      var s = SOORT[a.soort];
      var sprong = a.soort === 'vis' ? Math.max(0, Math.sin(a.faze)) : 0;
      var sp = cam.wereldNaarScherm(a.x * TEGEL, (a.y - sprong * 0.4) * TEGEL);
      if (sp.x < -20 || sp.y < -20 || sp.x > cam.breedte + 20 || sp.y > cam.hoogte + 20) continue;

      if (a.soort === 'vis' && sprong < 0.05) continue;   /* under water, unseen */

      /* little shadow so it sits on the ground */
      if (a.soort !== 'vis') {
        ctx.fillStyle = 'rgba(0,0,0,.18)';
        ctx.beginPath();
        ctx.ellipse(sp.x, sp.y + p * 0.06, p * 0.09, p * 0.035, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.font = Math.round(p * s.schaal) + 'px serif';
      ctx.fillText(s.emoji, sp.x, sp.y);
    }
  };

  Game.render.wildlife = W;

})(window.Game);
