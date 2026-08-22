/* The street network — a minimum spanning tree over the town square and every
 * building centre, drawn as dirt paths *under* the buildings. Walkers follow it
 * as waypoints (see renderer.js) so points 2 and 7 of the roadmap reinforce
 * each other.
 *
 * Nothing here is stored in Game.state: the network is fully derived from the
 * building positions and cached on a signature (the same handtekening trick
 * panel.js/buildmenu.js use), so it is only rebuilt when something moved. */
(function (Game) {

  var P = {};

  var netwerk = { handtekening: '', nodes: [], randen: [], buur: [] };

  function handtekening(s) {
    var d = '';
    for (var i = 0; i < s.gebouwen.length; i++) {
      var g = s.gebouwen[i];
      if (!g.gebouwd) continue;
      d += g.id + ',' + g.x + ',' + g.y + ';';
    }
    return d;
  }

  /* Rebuild the tree if the buildings changed. */
  P.ververs = function (s) {
    var h = handtekening(s);
    if (h === netwerk.handtekening) return;
    netwerk.handtekening = h;
    bouw(s);
  };

  function bouw(s) {
    var nodes = [];
    /* The town square is the root so the tree radiates from the heart. */
    var plein = null;
    for (var i = 0; i < s.gebouwen.length; i++) {
      var g = s.gebouwen[i];
      if (!g.gebouwd) continue;
      var d = Game.core.state.def(g);
      var node = {
        ox: g.x, oy: g.y,
        x: g.x + d.grootte / 2, y: g.y + d.grootte / 2,
        id: g.id
      };
      if (g.type === 'dorpsplein') plein = nodes.length;
      nodes.push(node);
    }

    netwerk.nodes = nodes;
    netwerk.randen = [];
    netwerk.buur = [];
    for (var b = 0; b < nodes.length; b++) netwerk.buur.push([]);
    if (nodes.length < 2) return;

    /* Prim's algorithm from the town square (or node 0). */
    var wortel = plein != null ? plein : 0;
    var inBoom = new Array(nodes.length);
    var afstand = new Array(nodes.length);
    var ouder = new Array(nodes.length);
    for (var k = 0; k < nodes.length; k++) { inBoom[k] = false; afstand[k] = Infinity; ouder[k] = -1; }
    afstand[wortel] = 0;

    for (var stap = 0; stap < nodes.length; stap++) {
      var beste = -1, besteD = Infinity;
      for (var a = 0; a < nodes.length; a++) {
        if (!inBoom[a] && afstand[a] < besteD) { besteD = afstand[a]; beste = a; }
      }
      if (beste < 0) break;
      inBoom[beste] = true;
      if (ouder[beste] >= 0) {
        netwerk.randen.push([ouder[beste], beste]);
        netwerk.buur[ouder[beste]].push(beste);
        netwerk.buur[beste].push(ouder[beste]);
      }
      for (var c = 0; c < nodes.length; c++) {
        if (inBoom[c]) continue;
        var dx = nodes[beste].x - nodes[c].x, dy = nodes[beste].y - nodes[c].y;
        var d2 = dx * dx + dy * dy;
        if (d2 < afstand[c]) { afstand[c] = d2; ouder[c] = beste; }
      }
    }
  }

  /* --------------------------------------------------------------- routes */

  function zoekNodeOp(ox, oy) {
    for (var i = 0; i < netwerk.nodes.length; i++) {
      if (netwerk.nodes[i].ox === ox && netwerk.nodes[i].oy === oy) return i;
    }
    return -1;
  }

  function dichtstbijNode(x, y) {
    var beste = -1, besteD = Infinity;
    for (var i = 0; i < netwerk.nodes.length; i++) {
      var dx = netwerk.nodes[i].x - x, dy = netwerk.nodes[i].y - y;
      var d = dx * dx + dy * dy;
      if (d < besteD) { besteD = d; beste = i; }
    }
    return beste;
  }

  /* Tree path (list of node indices) between two nodes, via a parent BFS. */
  function boompad(van, naar) {
    if (van === naar) return [van];
    var wachtrij = [van], gezien = {}, ouder = {};
    gezien[van] = true;
    while (wachtrij.length) {
      var n = wachtrij.shift();
      var buren = netwerk.buur[n];
      for (var i = 0; i < buren.length; i++) {
        var m = buren[i];
        if (gezien[m]) continue;
        gezien[m] = true; ouder[m] = n;
        if (m === naar) {
          var pad = [naar], cur = naar;
          while (cur !== van) { cur = ouder[cur]; pad.push(cur); }
          pad.reverse();
          return pad;
        }
        wachtrij.push(m);
      }
    }
    return null;
  }

  /* A route (array of {x,y} tile points) from the building at (ox,oy) to the
     target tile, following the road tree where it can. Returns null if there
     is no usable network, so the caller falls back to a straight line. */
  P.route = function (s, ox, oy, toX, toY) {
    if (netwerk.nodes.length < 2) return null;
    var start = zoekNodeOp(ox, oy);
    if (start < 0) return null;

    var doelNode = dichtstbijNode(toX + 0.5, toY + 0.5);
    var pad = boompad(start, doelNode);
    if (!pad) return null;

    var punten = [];
    for (var i = 0; i < pad.length; i++) {
      punten.push({ x: netwerk.nodes[pad[i]].x, y: netwerk.nodes[pad[i]].y });
    }
    punten.push({ x: toX + 0.5, y: toY + 0.5 });
    return punten;
  };

  /* --------------------------------------------------------------- drawing */

  /* Player-laid streets: real tiles with `t.weg`, drawn as paved diamonds
     under the buildings. These are the ones that shorten the haul to a depot
     (see js/core/logistiek.js); the tree below is only where feet wore the
     grass down by themselves. */
  P.tekenWegen = function (ctx, cam, s, p) {
    var TEGEL = Game.render.TEGEL;
    var zicht = cam.zichtbaar(s.kaart);
    for (var y = zicht.y0; y < zicht.y1; y++) {
      for (var x = zicht.x0; x < zicht.x1; x++) {
        var t = Game.core.map.tegel(s.kaart, x, y);
        if (!t || !t.weg) continue;
        var sp = cam.wereldNaarScherm(x * TEGEL, y * TEGEL);
        var dia = Game.render.diamant(sp.x, sp.y, p);
        ctx.fillStyle = 'rgba(132,113,86,.94)';
        Game.render.padDiamant(ctx, dia);
        ctx.fill();
        /* A lighter core so a long street reads as cobbles, not a flat slab. */
        if (p > 16) {
          ctx.fillStyle = 'rgba(176,157,123,.55)';
          Game.render.padDiamant(ctx, Game.render.diamant(sp.x, sp.y, p * 0.62));
          ctx.fill();
        }
        if (p > 22) {
          kasseien(ctx, dia, t, p);
          stoeprand(ctx, dia, s, x, y, p);
        }
      }
    }
  };

  /* A handful of stones per tile, placed from the tile's own stable random so
     they never crawl between frames. Cheap, and it is the difference between a
     paved street and a tan stripe. */
  function kasseien(ctx, dia, t, p) {
    ctx.fillStyle = 'rgba(96,82,62,.34)';
    for (var i = 0; i < 5; i++) {
      var u = ((i * 43 + t.v * 130) % 90) / 90 - 0.5;
      var v = ((i * 71 + t.v * 70) % 80) / 80 - 0.5;
      ctx.beginPath();
      ctx.ellipse(dia.cx + u * dia.hw * 1.1, dia.cy + v * dia.hh * 1.1,
                  p * 0.05, p * 0.026, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* A kerb along every edge where the street stops: the outline is what makes
     a road look laid rather than painted on. */
  var KANTEN = [
    { dx: -1, dy: 0, a: 'top',   b: 'left'   },
    { dx: 0, dy: -1, a: 'top',   b: 'right'  },
    { dx: 1, dy: 0,  a: 'right', b: 'bottom' },
    { dx: 0, dy: 1,  a: 'left',  b: 'bottom' }
  ];

  function stoeprand(ctx, dia, s, x, y, p) {
    ctx.strokeStyle = 'rgba(74,62,45,.5)';
    ctx.lineWidth = Math.max(1, p * 0.035);
    ctx.beginPath();
    for (var i = 0; i < KANTEN.length; i++) {
      var b = Game.core.map.tegel(s.kaart, x + KANTEN[i].dx, y + KANTEN[i].dy);
      if (b && b.weg) continue;
      var a1 = dia[KANTEN[i].a], a2 = dia[KANTEN[i].b];
      ctx.moveTo(a1.x, a1.y); ctx.lineTo(a2.x, a2.y);
    }
    ctx.stroke();
  }

  P.teken = function (ctx, cam, s, p) {
    P.tekenWegen(ctx, cam, s, p);
    if (!netwerk.randen.length) return;
    var TEGEL = Game.render.TEGEL;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    /* Two passes: a wider earthy base, then a lighter trodden centre. Fainter
       than they used to be, so real paved streets read as the stronger line. */
    for (var laag = 0; laag < 2; laag++) {
      ctx.strokeStyle = laag === 0 ? 'rgba(92,72,48,.30)' : 'rgba(150,126,90,.28)';
      ctx.lineWidth = laag === 0 ? p * 0.28 : p * 0.14;
      ctx.beginPath();
      for (var i = 0; i < netwerk.randen.length; i++) {
        var a = netwerk.nodes[netwerk.randen[i][0]];
        var b = netwerk.nodes[netwerk.randen[i][1]];
        var sa = cam.wereldNaarScherm(a.x * TEGEL, a.y * TEGEL);
        var sb = cam.wereldNaarScherm(b.x * TEGEL, b.y * TEGEL);
        ctx.moveTo(sa.x, sa.y);
        ctx.lineTo(sb.x, sb.y);
      }
      ctx.stroke();
    }
  };

  Game.render.paths = P;

})(window.Game);
