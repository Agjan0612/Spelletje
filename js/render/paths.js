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

  var netwerk = { handtekening: '', nodes: [], randen: [], buur: [], wegen: null };

  function handtekening(s) {
    var d = 'w' + (s.wegTeller || 0) + ';';   /* streets changed → rebuild too */
    for (var i = 0; i < s.gebouwen.length; i++) {
      var g = s.gebouwen[i];
      if (!g.gebouwd) continue;
      d += g.id + ',' + g.x + ',' + g.y + ';';
    }
    return d;
  }

  /* Rebuild the tree if the buildings or the streets changed. */
  P.ververs = function (s) {
    var h = handtekening(s);
    if (h === netwerk.handtekening) return;
    netwerk.handtekening = h;
    bouw(s);
    bouwWegen(s);
  };

  /* Index the player-laid street tiles (t.weg) so walkers can be routed over
     them — the same tiles logistiek.js shortens the haul along. Kept here in the
     render layer and rebuilt only when s.wegTeller changes. */
  function bouwWegen(s) {
    var set = {};
    var lijst = [];
    var b = s.kaart.b, h = s.kaart.h, tegels = s.kaart.tegels;
    for (var i = 0; i < tegels.length; i++) {
      if (!tegels[i].weg) continue;
      var x = i % b, y = (i - x) / b;
      set[x + ',' + y] = true;
      lijst.push({ x: x, y: y });
    }
    netwerk.wegen = lijst.length ? { set: set, lijst: lijst, b: b, h: h } : null;
  }

  /* Nearest street tile to a point, searched in a small outward ring. */
  function dichtstbijWeg(x, y) {
    var w = netwerk.wegen;
    if (!w) return null;
    var cx = Math.round(x), cy = Math.round(y);
    for (var r = 0; r <= 5; r++) {
      for (var dy = -r; dy <= r; dy++) {
        for (var dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          var k = (cx + dx) + ',' + (cy + dy);
          if (w.set[k]) return { x: cx + dx, y: cy + dy };
        }
      }
    }
    return null;
  }

  /* BFS over the street graph (4-neighbours) from one street tile to another,
     returning the list of tile centres, or null if they are not connected. */
  var WEGBUUR = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  function wegPad(van, naar) {
    var w = netwerk.wegen;
    if (!w) return null;
    var startK = van.x + ',' + van.y, doelK = naar.x + ',' + naar.y;
    if (startK === doelK) return [{ x: van.x + 0.5, y: van.y + 0.5 }];
    var wachtrij = [van], gezien = {}, ouder = {};
    gezien[startK] = true;
    var grens = 0;
    while (grens < wachtrij.length && grens < 4000) {
      var n = wachtrij[grens++];
      for (var i = 0; i < WEGBUUR.length; i++) {
        var nx = n.x + WEGBUUR[i][0], ny = n.y + WEGBUUR[i][1];
        var k = nx + ',' + ny;
        if (!w.set[k] || gezien[k]) continue;
        gezien[k] = true; ouder[k] = n;
        if (k === doelK) {
          var pad = [], cur = { x: nx, y: ny };
          while (cur) { pad.push({ x: cur.x + 0.5, y: cur.y + 0.5 }); cur = ouder[cur.x + ',' + cur.y]; }
          pad.reverse();
          return pad;
        }
        wachtrij.push({ x: nx, y: ny });
      }
    }
    return null;
  }

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

    var van = netwerk.nodes[start];

    /* Fase 2.2: if laid streets can carry most of this trip, walk them instead
       of the worn MST path — the same tiles the economy already rewards, so the
       carts on screen are the carts logistiek.js pays for. */
    var straatRoute = wegRoute(van, toX, toY);
    if (straatRoute) return straatRoute;

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

  /* A route from a building centre to a target tile that runs along the street
     network: building → nearest street tile → along the street → street tile
     nearest the target → target. Returns null (fall back to the MST) when there
     are no streets, the endpoints are not near one, or they are not connected.
     The returned array carries `.straat = true` so the walker cruises a touch
     faster on it. */
  function wegRoute(van, toX, toY) {
    if (!netwerk.wegen) return null;
    var a = dichtstbijWeg(van.x, van.y);
    var b = dichtstbijWeg(toX + 0.5, toY + 0.5);
    if (!a || !b) return null;
    var over = wegPad(a, b);
    if (!over || over.length < 2) return null;
    var punten = [{ x: van.x, y: van.y }];
    for (var i = 0; i < over.length; i++) punten.push(over[i]);
    punten.push({ x: toX + 0.5, y: toY + 0.5 });
    punten.straat = true;
    return punten;
  }

  /* --------------------------------------------------------------- drawing */

  /* Player-laid streets: real tiles with `t.weg`, drawn as paved diamonds
     under the buildings. These are the ones that shorten the haul to a depot
     (see js/core/logistiek.js); the tree below is only where feet wore the
     grass down by themselves. */
  P.tekenWegen = function (ctx, cam, s, p) {
    var TEGEL = Game.render.TEGEL;
    var zicht = cam.zichtbaar(s.kaart);
    /* A dirt track in the early ages, cobbled from the trading city on (fase
       4.2). Rain leaves the surface wet and dotted with puddles. */
    var kassei = s.tijdperk >= 3;
    var nat = Game.render.weer ? Game.render.weer.natheid() : 0;
    var basis = kassei ? 'rgba(132,113,86,.94)' : 'rgba(120,96,64,.95)';
    for (var y = zicht.y0; y < zicht.y1; y++) {
      for (var x = zicht.x0; x < zicht.x1; x++) {
        var t = Game.core.map.tegel(s.kaart, x, y);
        if (!t || !t.weg) continue;
        if (t.brug) continue;              /* planks over water, drawn below */
        var sp = cam.wereldNaarScherm(x * TEGEL, y * TEGEL);
        var dia = Game.render.diamant(sp.x, sp.y, p);
        ctx.fillStyle = basis;
        Game.render.padDiamant(ctx, dia);
        ctx.fill();
        /* A lighter core so a long street reads as a worn track / cobbles. */
        if (p > 16) {
          ctx.fillStyle = kassei ? 'rgba(176,157,123,.55)' : 'rgba(150,124,86,.5)';
          Game.render.padDiamant(ctx, Game.render.diamant(sp.x, sp.y, p * 0.62));
          ctx.fill();
        }
        if (p > 22) {
          if (kassei) kasseien(ctx, dia, t, p);
          else karrensporen(ctx, dia, p);
          stoeprand(ctx, dia, s, x, y, p);
        }
        /* Wet sheen + puddles after rain. */
        if (nat > 0.12) natteWeg(ctx, dia, t, p, nat);
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

  /* Two worn wheel ruts down a dirt track, where the carts keep passing. */
  function karrensporen(ctx, dia, p) {
    ctx.strokeStyle = 'rgba(80,60,40,.35)';
    ctx.lineWidth = Math.max(1, p * 0.03);
    for (var s = -1; s <= 1; s += 2) {
      var off = s * dia.hh * 0.35;
      ctx.beginPath();
      ctx.moveTo(dia.left.x, dia.left.y + off);
      ctx.lineTo(dia.right.x, dia.right.y + off);
      ctx.stroke();
    }
  }

  /* A wet street: a cool sheen over the whole tile plus a puddle or two, placed
     from the tile's stable random so they sit still. */
  function natteWeg(ctx, dia, t, p, nat) {
    ctx.fillStyle = 'rgba(90,110,130,' + (0.16 * nat).toFixed(3) + ')';
    Game.render.padDiamant(ctx, dia);
    ctx.fill();
    if (p > 20 && (t.v * 5.3 % 1) < 0.5) {
      var u = ((t.v * 130) % 60) / 60 - 0.5;
      var v = ((t.v * 70) % 50) / 50 - 0.5;
      ctx.fillStyle = 'rgba(150,175,200,' + (0.3 * nat).toFixed(3) + ')';
      ctx.beginPath();
      ctx.ellipse(dia.cx + u * dia.hw, dia.cy + v * dia.hh, p * 0.14, p * 0.07, 0, 0, Math.PI * 2);
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

  /* Bridges. A bridge tile is still water — the fishing ground under it is
     untouched — so it cannot be drawn as a paved diamond: it needs a deck that
     visibly stands above the surface. Planks across the span, a shadow on the
     water beneath, and a rail on the two sides that have water next to them,
     so a bridge across a river reads as a crossing and not as a raft. */
  P.tekenBruggen = function (ctx, cam, s, p) {
    var TEGEL = Game.render.TEGEL;
    var zicht = cam.zichtbaar(s.kaart);
    var hoogte = p * 0.14;                 /* how far the deck sits above water */

    for (var y = zicht.y0; y < zicht.y1; y++) {
      for (var x = zicht.x0; x < zicht.x1; x++) {
        var t = Game.core.map.tegel(s.kaart, x, y);
        if (!t || !t.brug) continue;
        var sp = cam.wereldNaarScherm(x * TEGEL, y * TEGEL);

        /* The shadow the deck throws on the water. */
        ctx.fillStyle = 'rgba(18,32,44,.34)';
        Game.render.padDiamant(ctx, Game.render.diamant(sp.x, sp.y + hoogte * 0.5, p * 0.92));
        ctx.fill();

        var dek = Game.render.diamant(sp.x, sp.y - hoogte, p * 0.94);
        ctx.fillStyle = 'rgba(146,116,74,.98)';
        Game.render.padDiamant(ctx, dek);
        ctx.fill();

        if (p > 20) {
          /* Planks: a handful of lines across the deck. */
          ctx.strokeStyle = 'rgba(96,72,44,.45)';
          ctx.lineWidth = Math.max(1, p * 0.022);
          for (var i = -2; i <= 2; i++) {
            var f = i / 3;
            ctx.beginPath();
            ctx.moveTo(dek.cx + f * dek.hw, dek.cy + f * dek.hh);
            ctx.lineTo(dek.cx + f * dek.hw + dek.hw, dek.cy + f * dek.hh - dek.hh);
            ctx.stroke();
          }
          /* A rail on every side that faces open water. */
          ctx.strokeStyle = 'rgba(112,86,54,.9)';
          ctx.lineWidth = Math.max(1, p * 0.035);
          relingen(ctx, s, x, y, dek);
        }
      }
    }
  };

  /* Only the sides with water next to them get a rail: the ends of the bridge
     have to stay open, or you would be fencing off the road onto the bank.
     The four edges of the diamond, in world directions: +x is the right-bottom
     edge, -x the left-top one, +y bottom-left and -y top-right. */
  function relingen(ctx, s, x, y, dek) {
    var hw = dek.hw, hh = dek.hh;
    var zijden = [
      { dx: 1, dy: 0, van: [hw, 0], naar: [0, hh] },
      { dx: -1, dy: 0, van: [-hw, 0], naar: [0, -hh] },
      { dx: 0, dy: 1, van: [0, hh], naar: [-hw, 0] },
      { dx: 0, dy: -1, van: [0, -hh], naar: [hw, 0] }
    ];
    var op = hh * 0.55;                    /* rail height above the deck */
    for (var i = 0; i < zijden.length; i++) {
      var z = zijden[i];
      var buur = Game.core.map.tegel(s.kaart, x + z.dx, y + z.dy);
      if (!buur || buur.t !== 'water' || buur.brug) continue;
      ctx.beginPath();
      ctx.moveTo(dek.cx + z.van[0], dek.cy + z.van[1] - op);
      ctx.lineTo(dek.cx + z.naar[0], dek.cy + z.naar[1] - op);
      ctx.stroke();
      /* Two posts, so the rail is attached to something. */
      ctx.beginPath();
      ctx.moveTo(dek.cx + z.van[0], dek.cy + z.van[1]);
      ctx.lineTo(dek.cx + z.van[0], dek.cy + z.van[1] - op);
      ctx.moveTo(dek.cx + z.naar[0], dek.cy + z.naar[1]);
      ctx.lineTo(dek.cx + z.naar[0], dek.cy + z.naar[1] - op);
      ctx.stroke();
    }
  }

  P.teken = function (ctx, cam, s, p) {
    P.tekenWegen(ctx, cam, s, p);
    P.tekenBruggen(ctx, cam, s, p);
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
