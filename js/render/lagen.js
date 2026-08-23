/* Map overlays — a tinted layer over the ground that answers one question at
 * a time: which homes have services nearby, where the town is pleasant to
 * live, what your towers actually watch, and how far the veins are worked out.
 *
 * These are not decoration. Since core/buurt.js made services and desirability
 * local, a player without a way to *see* that is guessing; this is the eye.
 *
 * Nothing is stored in Game.state: the grid is derived and cached on the same
 * kind of signature paths.js uses, so panning and zooming stay free.
 */
(function (Game) {

  var L = {};

  L.LAGEN = [
    { id: 'diensten', naam: 'Voorzieningen', emoji: '⛪',
      uitleg: 'Groen = huizen hier hebben put, kapel, herberg en markt binnen loopafstand. Rood = deze buurt is aan zijn lot overgelaten.' },
    { id: 'sfeer', naam: 'Aantrekkelijkheid', emoji: '🌷',
      uitleg: 'Groen = een prettige plek om te wonen. Rood = rook, herrie en stof. Huisjes groeien alleen uit in het groen.' },
    { id: 'verdediging', naam: 'Verdediging', emoji: '🛡️',
      uitleg: 'Wat je torens, muren en poorten daadwerkelijk bestrijken. De rode baan is de route waarlangs de rovers binnenkomen.' },
    { id: 'logistiek', naam: 'Aanvoer', emoji: '🛣️',
      uitleg: 'Hoeveel van de opbrengst een werkplaats hier daadwerkelijk thuisbrengt. Rood = te ver van elke opslag: bouw een voorraadschuur dichterbij of leg een straat.' },
    { id: 'aders', naam: 'Grondstoffen', emoji: '⛏️',
      uitleg: 'Hoeveel er nog in de grond zit. Rood betekent bijna uitgeput — tijd om te verhuizen. Vruchtbare grond en visgronden raken nooit op en staan dus altijd groen.' }
  ];

  L.actief = null;

  L.zet = function (id) {
    L.actief = (L.actief === id) ? null : id;
    raster.handtekening = '';
    return L.actief;
  };

  L.laag = function (id) {
    for (var i = 0; i < L.LAGEN.length; i++) if (L.LAGEN[i].id === id) return L.LAGEN[i];
    return null;
  };

  /* --------------------------------------------------------------- raster */

  var raster = { handtekening: '', waarden: null, b: 0, h: 0 };

  function handtekening(s) {
    var d = L.actief + '|' + s.kaart.b + 'x' + s.kaart.h + '|';
    for (var i = 0; i < s.gebouwen.length; i++) {
      var g = s.gebouwen[i];
      if (!g.gebouwd) continue;
      d += g.id + ':' + g.type + ':' + g.x + ',' + g.y + (g.uit ? 'x' : '') + ';';
    }
    if (L.actief === 'verdediging' && s.raid && s.raid.vanaf) {
      d += '|inval' + s.raid.vanaf.x + ',' + s.raid.vanaf.y;
    }
    /* The ore layer changes continuously, so re-read it on a coarse clock
       instead of on the buildings. */
    if (L.actief === 'aders') d += '|t' + Math.floor(s.tijd / 3);
    if (L.actief === 'logistiek') d += '|w' + (s.wegTeller || 0);
    return d;
  }

  /* Values are 0..1, or -1 for "nothing to say here". */
  function bouwRaster(s) {
    var b = s.kaart.b, h = s.kaart.h;
    var w = new Float32Array(b * h);
    var buurt = Game.core.buurt;

    if (L.actief === 'diensten') {
      for (var y = 0; y < h; y++) {
        for (var x = 0; x < b; x++) {
          var t = Game.core.map.tegel(s.kaart, x, y);
          if (!t || t.t === 'water' || t.t === 'berg') { w[y * b + x] = -1; continue; }
          w[y * b + x] = Game.util.clamp(buurt.dienstenOp(s, x, y) / buurt.VOLLEDIG, 0, 1);
        }
      }
    } else if (L.actief === 'sfeer') {
      for (var y2 = 0; y2 < h; y2++) {
        for (var x2 = 0; x2 < b; x2++) {
          var t2 = Game.core.map.tegel(s.kaart, x2, y2);
          if (!t2 || t2.t === 'water' || t2.t === 'berg') { w[y2 * b + x2] = -1; continue; }
          /* -15..+25 maps onto the same 0..1 colour ramp as the rest. */
          w[y2 * b + x2] = Game.util.clamp((buurt.aantrekkelijkOp(s, x2, y2) + 15) / 40, 0, 1);
        }
      }
    } else if (L.actief === 'verdediging') {
      for (var i = 0; i < w.length; i++) w[i] = -1;
      var raids = Game.core.raids;
      for (var j = 0; j < s.gebouwen.length; j++) {
        var g = s.gebouwen[j];
        if (!g.gebouwd || g.uit) continue;
        var d = Game.core.state.def(g);
        if (!d.verdediging || !d.dekking || !d.dekking.straal) continue;
        var straal = raids.dekkingStraal(s, g, d);
        var mid = (d.grootte - 1) / 2;
        var cx = g.x + mid, cy = g.y + mid;
        var r = Math.ceil(straal);
        for (var dy = -r; dy <= r; dy++) {
          for (var dx = -r; dx <= r; dx++) {
            var px = Math.round(cx) + dx, py = Math.round(cy) + dy;
            if (px < 0 || py < 0 || px >= b || py >= h) continue;
            if (dx * dx + dy * dy > straal * straal) continue;
            var idx = py * b + px;
            /* Overlapping fields of fire stack, so a well-covered gate reads
               brighter than a lone wall segment. */
            w[idx] = Math.min(1, (w[idx] < 0 ? 0 : w[idx]) + d.verdediging / 60);
          }
        }
      }
    } else if (L.actief === 'logistiek') {
      /* Ask the real formula what a workplace on this tile would bring home,
         so the map cannot drift away from what the economy actually does. */
      var log = Game.core.logistiek;
      log.ververs(s);
      for (var y4 = 0; y4 < h; y4++) {
        for (var x4 = 0; x4 < b; x4++) {
          var t4 = Game.core.map.tegel(s.kaart, x4, y4);
          if (!t4 || t4.t === 'water' || t4.t === 'berg') { w[y4 * b + x4] = -1; continue; }
          /* Map the 0.5..1 range the formula can return onto the shared ramp. */
          var f = log.factorOpTegel(s, x4, y4);
          w[y4 * b + x4] = Game.util.clamp((f - log.MIN) / (1 - log.MIN), 0, 1);
        }
      }
    } else if (L.actief === 'aders') {
      for (var y3 = 0; y3 < h; y3++) {
        for (var x3 = 0; x3 < b; x3++) {
          var t3 = Game.core.map.tegel(s.kaart, x3, y3);
          var k = y3 * b + x3;
          if (!t3 || !t3.n || t3.max <= 0) { w[k] = -1; continue; }
          /* Endless nodes — fertile ground and fishing grounds — used to be
             left blank here, which meant the one layer called "Grondstoffen"
             hid exactly the two a new player is looking for. They cannot be
             depleted, so they simply stand at full. */
          if (t3.max >= Game.core.map.ONEINDIG) { w[k] = 1; continue; }
          w[k] = Game.util.clamp(t3.amt / t3.max, 0, 1);
        }
      }
    }

    raster.waarden = w; raster.b = b; raster.h = h;
  }

  L.ververs = function (s) {
    if (!L.actief) return;
    var hs = handtekening(s);
    if (hs === raster.handtekening) return;
    raster.handtekening = hs;
    bouwRaster(s);
  };

  L.waardeOp = function (s, x, y) {
    if (!L.actief || !raster.waarden) return -1;
    if (x < 0 || y < 0 || x >= raster.b || y >= raster.h) return -1;
    return raster.waarden[y * raster.b + x];
  };

  /* ------------------------------------------------------------- tekenen */

  /* Red → amber → green, the same ramp for every layer so the eye only has to
     learn it once. The corridor layer paints its warning band separately. */
  function kleur(v, alpha) {
    var r, g;
    if (v < 0.5) { r = 214; g = Math.round(60 + v * 2 * 130); }
    else { r = Math.round(214 - (v - 0.5) * 2 * 150); g = 190; }
    return 'rgba(' + r + ',' + g + ',70,' + alpha + ')';
  }

  L.teken = function (ctx, cam, s, p) {
    if (!L.actief) return;
    L.ververs(s);
    if (!raster.waarden) return;

    var TEGEL = Game.render.TEGEL;
    var zicht = cam.zichtbaar(s.kaart);

    ctx.save();
    for (var y = zicht.y0; y < zicht.y1; y++) {
      for (var x = zicht.x0; x < zicht.x1; x++) {
        var v = raster.waarden[y * raster.b + x];
        if (v < 0) continue;
        var sp = cam.wereldNaarScherm(x * TEGEL, y * TEGEL);
        ctx.fillStyle = kleur(v, 0.42);
        Game.render.padDiamant(ctx, Game.render.diamant(sp.x, sp.y, p));
        ctx.fill();
      }
    }

    /* The raiders' corridor, drawn on top of the defence layer so you can see
       at a glance whether your towers are actually looking the right way. */
    if (L.actief === 'verdediging' && s.raid && s.raid.vanaf && s.tijdperk >= 2) {
      var cor = Game.core.raids.corridor(s);
      if (cor) {
        var a = cam.wereldNaarScherm((cor.ax + 0.5) * TEGEL, (cor.ay + 0.5) * TEGEL);
        var bb = cam.wereldNaarScherm((cor.bx + 0.5) * TEGEL, (cor.by + 0.5) * TEGEL);
        ctx.strokeStyle = 'rgba(220,70,60,.55)';
        ctx.lineWidth = Math.max(3, p * cor.breedte * 0.5);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(bb.x, bb.y);
        ctx.stroke();
      }
    }
    ctx.restore();
  };

  Game.render.lagen = L;

})(window.Game);
