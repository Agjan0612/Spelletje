/* All drawing of terrain and buildings, in an isometric (2:1 diamond) view.
   The camera (js/render/camera.js) does the projection; this module draws the
   shapes that sit on that grid.

   Terrain tiles are drawn as diamonds. Buildings are drawn as procedural
   isometric volumes (walls + roof) rather than from the image atlas: the Kenney
   sprites are top-down and would clash with the tilted ground, so in iso they
   are bypassed here. Trees and rocks stay as upright billboards from the atlas
   (with a hand-drawn fallback) so the game still runs without the assets. */
(function (Game) {

  var S = {};

  /* Base colours per terrain, per season (lente, zomer, herfst, winter). */
  var TERREIN = {
    gras:       ['#6f8f4a', '#6b8b41', '#8a8a3f', '#c9cfc4'],
    vruchtbaar: ['#8a7a3e', '#9a8437', '#a88a35', '#bfc0b0'],
    bos:        ['#3f6033', '#3a5c2c', '#5c5f2a', '#7f8c7a'],
    rots:       ['#7d7a72', '#7d7a72', '#7a766c', '#9d9d9a'],
    berg:       ['#5f5a52', '#5f5a52', '#5c5750', '#8d8d8d'],
    water:      ['#3f6f8f', '#42749a', '#3c6a89', '#4a6f85']
  };

  var ADERKLEUR = {
    ijzer: '#b7c2cf', koper: '#d98a3e', edelsteen: '#63d6e0', steen: '#c9c6bd'
  };

  S.terreinKleur = function (tegel, seizoen) {
    var rij = TERREIN[tegel.t] || TERREIN.gras;
    return rij[seizoen] || rij[0];
  };

  /* ----------------------------------------------------------- relief cache

     A per-tile hillshade factor (~0.8..1.22) from the height difference with
     the up/left neighbours, as if lit from the top-left. Computed once per map
     and kept in this module (never in Game.state) so saves stay pure JSON. */

  var schaduwCache = { seed: null, arr: null };

  function tegelH(kaart, x, y, terug) {
    var t = Game.core.map.tegel(kaart, x, y);
    return t ? (t.h || 0) : terug;
  }

  S.bereidTerreinVoor = function (kaart) {
    if (!kaart || !kaart.tegels) return;
    if (schaduwCache.seed === kaart.seed && schaduwCache.arr &&
        schaduwCache.arr.length === kaart.tegels.length) return;

    var b = kaart.b, h = kaart.h;
    var arr = new Float32Array(b * h);
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < b; x++) {
        var i = y * b + x;
        var hc = kaart.tegels[i].h || 0;
        var ul = tegelH(kaart, x - 1, y - 1, hc);
        var u = tegelH(kaart, x, y - 1, hc);
        var l = tegelH(kaart, x - 1, y, hc);
        var dh = hc - (ul * 0.5 + u * 0.25 + l * 0.25);
        arr[i] = Game.util.clamp(1 + dh * 2.4, 0.8, 1.22);
      }
    }
    schaduwCache = { seed: kaart.seed, arr: arr };
  };

  function schaduwFactor(kaart, i) {
    return (kaart && schaduwCache.arr && schaduwCache.seed === kaart.seed) ? schaduwCache.arr[i] : 1;
  }

  /* -------------------------------------------------------- colour helpers */

  function ontleed(kleur) {
    var m = kleur.match(/^#(\w\w)(\w\w)(\w\w)$/);
    if (m) return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
    m = kleur.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (m) return [+m[1], +m[2], +m[3]];
    return [200, 200, 200];
  }

  /* Multiply a colour by a brightness factor, returning an rgb() string. */
  function verf(kleur, f) {
    var c = ontleed(kleur);
    return 'rgb(' + Game.util.clamp(Math.round(c[0] * f), 0, 255) + ',' +
                    Game.util.clamp(Math.round(c[1] * f), 0, 255) + ',' +
                    Game.util.clamp(Math.round(c[2] * f), 0, 255) + ')';
  }

  /* Final tile colour: base hex, per-tile brightness `v`, and the hillshade. */
  function eindKleur(hex, v, shade) {
    return verf(hex, (0.88 + v * 0.24) * shade);
  }

  /* Slight per-tile brightness so a field of grass is not a flat colour. */
  function schakering(kleur, v) {
    return verf(kleur, 0.88 + v * 0.24);
  }
  S.schakering = schakering;

  /* ------------------------------------------------------- iso primitives */

  function lerp(a, b, t) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }
  function omhoog(pt, H) { return { x: pt.x, y: pt.y - H }; }

  function diamantVan(cx, cy, hw, hh) {
    return {
      top:    { x: cx,      y: cy - hh },
      right:  { x: cx + hw, y: cy },
      bottom: { x: cx,      y: cy + hh },
      left:   { x: cx - hw, y: cy },
      cx: cx, cy: cy, hw: hw, hh: hh
    };
  }

  function vulDiamant(ctx, d, kleur) {
    Game.render.padDiamant(ctx, d);
    ctx.fillStyle = kleur;
    ctx.fill();
  }

  function quad(ctx, a, b, c, d, kleur) {
    ctx.fillStyle = kleur;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y);
    ctx.closePath();
    ctx.fill();
  }

  function tri(ctx, a, b, c, kleur) {
    ctx.fillStyle = kleur;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y);
    ctx.closePath();
    ctx.fill();
  }

  /* -------------------------------------------------------------- terrein */

  /* Flat ground: the tile diamond plus everything that lies in the tile plane
     (coastline, water sparkle, field furrows). Raised features — trees, rocks,
     mountains, the deer — are drawn separately by tekenKenmerk so the renderer
     can depth-sort them against buildings and walkers. */
  S.tekenGrond = function (ctx, tegel, sx, sy, p, seizoen, tijd, kaart, x, y) {
    var d = Game.render.diamant(sx, sy, p);
    var idx = kaart ? y * kaart.b + x : 0;
    var kleur = eindKleur(S.terreinKleur(tegel, seizoen), tegel.v, schaduwFactor(kaart, idx));
    vulDiamant(ctx, d, kleur);
    /* Hairline-seam guard: a 1px stroke in the same colour closes the sub-pixel
       cracks between neighbouring diamonds without changing the look. */
    Game.render.padDiamant(ctx, d);
    ctx.strokeStyle = kleur; ctx.lineWidth = 1; ctx.stroke();

    if (tegel.t === 'water' && kaart) {
      if (p >= 12) water(ctx, d, tegel, p, tijd, kaart, x, y); else kust(ctx, d, kaart, x, y);
      if (seizoen === 3) ijs(ctx, d, tegel, p, kaart, x, y);
      return;
    }

    /* Winter really lies on the land: a mottled snow cover whose depth varies
       per tile (from the tile's stable `v`, so it never flickers), with a
       brighter drift on the light-facing half. */
    if (seizoen === 3) { sneeuwdek(ctx, d, tegel, p); return; }

    if (p >= 12 && tegel.t === 'vruchtbaar') akker(ctx, d, tegel, p, seizoen);

    /* Fine detail so a field of grass or rock is not one flat colour. Only when
       zoomed in and never under a building footprint (it would be hidden). */
    else if (p >= 24 && !tegel.b) {
      if (tegel.t === 'gras' && seizoen !== 3) grasplukjes(ctx, d, tegel, p, tijd, seizoen);
      else if (tegel.t === 'rots') grondspikkels(ctx, d, tegel, p);
    }
  };

  /* Snow cover on a land tile. Bare rock and mountains keep more of their own
     colour; fields and grass go nearly white. */
  function sneeuwdek(ctx, d, t, p) {
    var basis = (t.t === 'rots' || t.t === 'berg') ? 0.2 : (t.t === 'bos' ? 0.3 : 0.46);
    var alpha = basis + (t.v % 0.4) * 0.35;
    vulDiamant(ctx, d, 'rgba(244,248,252,' + alpha.toFixed(3) + ')');

    /* A brighter drift on the up-light (top-left) half of the diamond. */
    if (p >= 14 && !t.b) {
      ctx.fillStyle = 'rgba(255,255,255,' + (0.10 + (t.v % 0.3) * 0.2).toFixed(3) + ')';
      ctx.beginPath();
      ctx.moveTo(d.top.x, d.top.y);
      ctx.lineTo(d.left.x, d.left.y);
      ctx.lineTo(d.cx, d.cy);
      ctx.closePath();
      ctx.fill();
    }

    /* Stubble poking through a snowy field. */
    if (p >= 26 && t.t === 'vruchtbaar' && !t.b) {
      ctx.strokeStyle = 'rgba(150,132,86,.45)';
      ctx.lineWidth = Math.max(1, p * 0.016);
      for (var i = 0; i < 3; i++) {
        var bx = d.cx + (((i * 47 + t.v * 110) % 70) / 70 - 0.5) * d.hw;
        var by = d.cy + (((i * 31 + t.v * 60) % 50) / 50 - 0.5) * d.hh;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + p * 0.01, by - p * 0.05);
        ctx.stroke();
      }
    }
  }

  /* Ice on the water in winter: a pale sheen plus a couple of floes, and a
     frozen white rim wherever the water meets land. */
  function ijs(ctx, d, t, p, kaart, tx, ty) {
    vulDiamant(ctx, d, 'rgba(214,232,240,' + (0.2 + (t.v % 0.3) * 0.4).toFixed(3) + ')');
    if (p < 14) return;

    for (var i = 0; i < 2; i++) {
      var fx = d.cx + (((i * 43 + t.v * 90) % 60) / 60 - 0.5) * d.hw * 0.9;
      var fy = d.cy + (((i * 67 + t.v * 40) % 50) / 50 - 0.5) * d.hh * 0.9;
      ctx.fillStyle = 'rgba(240,248,252,.55)';
      ctx.beginPath();
      ctx.ellipse(fx, fy, p * (0.09 + (t.v % 0.2) * 0.2), p * (0.05 + (t.v % 0.1) * 0.2), 0, 0, Math.PI * 2);
      ctx.fill();
    }

    /* Frozen rim on the shoreline edges. */
    ctx.strokeStyle = 'rgba(250,253,255,.75)';
    ctx.lineWidth = Math.max(1, p * 0.05);
    for (var b = 0; b < BUUREDGE.length; b++) {
      var e = BUUREDGE[b];
      var buur = Game.core.map.tegel(kaart, tx + e.dx, ty + e.dy);
      if (!buur || buur.t === 'water') continue;
      ctx.beginPath();
      ctx.moveTo(d[e.a].x, d[e.a].y);
      ctx.lineTo(d[e.b].x, d[e.b].y);
      ctx.stroke();
    }
  }

  /* A few wind-bent grass blades, deterministic from the tile's `v` so they
     never flicker between frames. */
  function grasplukjes(ctx, d, t, p, tijd, seizoen) {
    ctx.strokeStyle = seizoen === 2 ? 'rgba(150,132,64,.45)' : 'rgba(96,132,60,.42)';
    ctx.lineWidth = Math.max(1, p * 0.018);
    ctx.lineCap = 'round';
    for (var i = 0; i < 4; i++) {
      var bx = d.cx + (((i * 53 + t.v * 130) % 80) / 80 - 0.5) * d.hw * 1.1;
      var by = d.cy + (((i * 29 + t.v * 90) % 60) / 60 - 0.5) * d.hh * 1.1;
      var sway = Math.sin(tijd * 1.5 + t.v * 6.28 + i) * p * 0.03;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx + sway * 0.5, by - p * 0.05, bx + sway, by - p * 0.09);
      ctx.stroke();
    }
  }

  /* Scattered pebbles on bare rock ground. */
  function grondspikkels(ctx, d, t, p) {
    ctx.fillStyle = 'rgba(74,72,66,.35)';
    for (var i = 0; i < 4; i++) {
      var bx = d.cx + (((i * 61 + t.v * 120) % 80) / 80 - 0.5) * d.hw * 0.9;
      var by = d.cy + (((i * 37 + t.v * 70) % 60) / 60 - 0.5) * d.hh * 0.9;
      ctx.beginPath();
      ctx.arc(bx, by, p * 0.016, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* Whether a tile carries a raised feature worth its own depth-sorted draw. */
  S.heeftKenmerk = function (tegel) {
    return tegel.t === 'bos' || tegel.t === 'rots' || tegel.t === 'berg' ||
           (tegel.t === 'gras' && tegel.n === 'wild' && tegel.amt > 0);
  };

  S.tekenKenmerk = function (ctx, tegel, sx, sy, p, seizoen, tijd) {
    if (p < 12) return;
    tijd = tijd || 0;
    var d = Game.render.diamant(sx, sy, p);
    switch (tegel.t) {
      case 'bos': bomen(ctx, d, tegel, p, seizoen, tijd); break;
      case 'rots': rotsen(ctx, d, tegel, p); break;
      case 'berg':
        berg(ctx, d, tegel, p, seizoen);
        if (tegel.n && ADERKLEUR[tegel.n]) ader(ctx, d, tegel, p);
        break;
      case 'gras': if (tegel.n === 'wild') wild(ctx, d, tegel, p, tijd); break;
    }
  };

  /* Which diamond edge a tile shares with each 4-neighbour. */
  var BUUREDGE = [
    { dx: -1, dy: 0, a: 'top',   b: 'left'   },  /* west  */
    { dx: 0, dy: -1, a: 'top',   b: 'right'  },  /* north */
    { dx: 1, dy: 0,  a: 'right', b: 'bottom' },  /* east  */
    { dx: 0, dy: 1,  a: 'left',  b: 'bottom' }   /* south */
  ];

  /* Lighter shallow rim on the water-tile edges that face land, breathing in
     and out like a slow surf. */
  function kust(ctx, d, kaart, tx, ty, tijd) {
    var puls = 0.5 + 0.5 * Math.sin((tijd || 0) * 1.3 + (tx + ty) * 0.6);
    ctx.strokeStyle = 'rgba(168,214,219,' + (0.4 + puls * 0.28).toFixed(3) + ')';
    ctx.lineWidth = Math.max(1, d.hw * (0.11 + puls * 0.06));
    ctx.beginPath();
    for (var i = 0; i < BUUREDGE.length; i++) {
      var b = Game.core.map.tegel(kaart, tx + BUUREDGE[i].dx, ty + BUUREDGE[i].dy);
      if (!b || b.t === 'water') continue;
      var a = d[BUUREDGE[i].a], c = d[BUUREDGE[i].b];
      ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y);
    }
    ctx.stroke();
  }

  function water(ctx, d, t, p, tijd, kaart, tx, ty) {
    if (kaart) kust(ctx, d, kaart, tx, ty, tijd);

    /* Three drifting ripple lines instead of two static ones. */
    ctx.strokeStyle = 'rgba(255,255,255,.12)';
    ctx.lineWidth = Math.max(1, p * 0.035);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (var i = 0; i < 3; i++) {
      var ph = tijd * (1.0 + i * 0.33) + t.v * 9 + i * 2.1;
      var yy = d.cy + (i - 1) * d.hh * 0.42 + Math.sin(ph) * p * 0.045;
      var xx = d.cx + Math.cos(ph) * p * 0.05;
      ctx.moveTo(xx - p * 0.13, yy);
      ctx.lineTo(xx + p * 0.13, yy);
    }
    ctx.stroke();

    /* A sun glint that brightens by day and glides across the tile. */
    var dag = (Game.core.state && Game.core.state.DAG) || 1;
    var f = (tijd % dag) / dag;
    var licht = Game.util.clamp(0.5 - 0.5 * Math.cos(f * Math.PI * 2), 0, 1);   /* 1 at midday */
    var a = 0.04 + licht * (0.45 + 0.55 * Math.abs(Math.sin(tijd * 3 + t.v * 20))) * 0.34;
    if (a > 0.07) {
      ctx.fillStyle = 'rgba(255,248,222,' + a.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(d.cx + Math.sin(tijd * 0.7 + t.v * 12) * p * 0.13, d.cy - p * 0.02, p * 0.028, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* An upright billboard (sprite or richer fallback tree) at a point, bent by
     the wind: each tree is rotated a few degrees around its foot so the canopy
     sways while the trunk base stays planted. Sway is a slow sine keyed to the
     tile's stable `v` (and the tree index) so a wood ripples rather than moving
     as one block. */
  function bomen(ctx, d, t, p, seizoen, tijd) {
    var deel = t.max > 0 ? Game.util.clamp(t.amt / t.max, 0, 1) : 0;
    var aantal = Math.max(1, Math.round(1 + deel * 2));
    var atlas = Game.render.atlas;

    for (var i = 0; i < aantal; i++) {
      var ox = d.cx + p * (((i * 37 + t.v * 100) % 46) / 100 - 0.23);
      var oy = d.cy + p * (((i * 61 + t.v * 70) % 20) / 100 - 0.06);
      var wind = Math.sin(tijd * 0.9 + t.v * 6.28 + i * 1.3) * 0.05;   /* ~3° */

      ctx.fillStyle = 'rgba(0,0,0,.16)';
      ctx.beginPath();
      ctx.ellipse(ox, oy + p * 0.03, p * 0.11, p * 0.05, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.translate(ox, oy);
      ctx.rotate(wind);

      var img = atlas && atlas.boom(t.v, i);
      if (img) {
        var st = p * (0.6 + deel * 0.24);
        ctx.drawImage(img, -st / 2, -st * 0.82, st, st);
      } else {
        boomVorm(ctx, p, deel, seizoen, t.v + i);
      }
      ctx.restore();
    }

    if (deel < 0.25) {
      ctx.fillStyle = 'rgba(70,50,30,.5)';
      ctx.beginPath();
      ctx.arc(d.cx + p * 0.2, d.cy + p * 0.16, p * 0.06, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* Hand-drawn fallback tree (used when the atlas sprite has not loaded): a
     trunk and two-to-three layered canopy tufts instead of a flat triangle, so
     it holds up when the assets are missing. Drawn around a local origin at the
     foot; the caller has already applied the wind rotation. */
  function boomVorm(ctx, p, deel, seizoen, seed) {
    var bladKleur = ['#3a6b2f', '#356428', '#8a5f1e', '#51624e'][seizoen];
    var donker = verf(bladKleur, 0.78);
    var r = p * (0.15 + deel * 0.08);

    ctx.fillStyle = '#4a3320';
    ctx.fillRect(-p * 0.028, -p * 0.16, p * 0.056, p * 0.18);

    var lagen = [
      { y: -p * 0.16, rr: r,        k: donker },
      { y: -p * 0.30, rr: r * 0.82, k: bladKleur },
      { y: -p * 0.42, rr: r * 0.6,  k: verf(bladKleur, 1.12) }
    ];
    for (var i = 0; i < lagen.length; i++) {
      var L = lagen[i];
      ctx.fillStyle = L.k;
      ctx.beginPath();
      ctx.ellipse((((seed * 40 + i * 17) % 6) / 6 - 0.5) * p * 0.05, L.y, L.rr, L.rr * 0.92, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function rotsen(ctx, d, t, p) {
    var atlas = Game.render.atlas;
    for (var i = 0; i < 3; i++) {
      var ox = d.cx + p * (((i * 41 + t.v * 90) % 50) / 100 - 0.25);
      var oy = d.cy + p * (((i * 67 + t.v * 60) % 26) / 100 - 0.1);

      ctx.fillStyle = 'rgba(0,0,0,.15)';
      ctx.beginPath();
      ctx.ellipse(ox, oy + p * 0.05, p * 0.1, p * 0.045, 0, 0, Math.PI * 2);
      ctx.fill();

      var img = atlas && atlas.rots(t.v, i);
      if (img) {
        var rs = p * (0.34 + ((i * 13 + t.v * 30) % 10) / 100);
        ctx.drawImage(img, ox - rs / 2, oy - rs * 0.62, rs, rs);
        continue;
      }

      var r = p * (0.1 + ((i * 13 + t.v * 30) % 8) / 100);
      /* Two-tone boulder (shadow body + lit top facet) rather than a flat
         pentagon, so it reads as a rock when the atlas sprite is missing. */
      ctx.fillStyle = '#7f7b72';
      ctx.beginPath();
      ctx.moveTo(ox - r, oy + r * 0.5);
      ctx.lineTo(ox - r * 0.4, oy - r);
      ctx.lineTo(ox + r * 0.6, oy - r * 0.8);
      ctx.lineTo(ox + r, oy + r * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#b3afa4';
      ctx.beginPath();
      ctx.moveTo(ox - r * 0.4, oy - r);
      ctx.lineTo(ox + r * 0.6, oy - r * 0.8);
      ctx.lineTo(ox + r * 0.15, oy + r * 0.1);
      ctx.closePath();
      ctx.fill();
    }
  }

  /* An iso mountain: a shaded pyramid rising out of the tile diamond. Height
     varies with the tile's stable random `v`, and only the taller peaks (or any
     peak in winter) wear a snow cap, so a range reads as a mix rather than a
     field of identical spikes. */
  function berg(ctx, d, t, p, seizoen) {
    /* Two stable pseudo-randoms per tile so neighbouring peaks differ in both
       height and lean; a field of identical spikes was the giveaway that this
       was one repeated shape. */
    var r1 = (t.v * 7.31) % 1;
    var r2 = (t.v * 13.77) % 1;

    var H = p * (0.42 + r1 * 1.05);
    var lean = (r2 - 0.5) * p * 0.3;
    var apex = { x: d.cx + lean, y: d.cy - H };

    /* A lower shoulder peak against the main one turns a lone cone into a
       ridge, especially where several mountain tiles meet. */
    if (r2 > 0.38) {
      var kant = r1 > 0.5 ? 1 : -1;
      var sub = { x: d.cx + kant * d.hw * 0.44, y: d.cy - H * (0.42 + r2 * 0.25) };
      tri(ctx, d.left, d.bottom, sub, '#5f5a51');
      tri(ctx, d.bottom, d.right, sub, '#736c61');
    }

    /* Two front flanks (near, bottom corner splits them) then the two back
       flanks a touch darker for silhouette against neighbours. */
    tri(ctx, d.left, d.bottom, apex, '#6a645a');
    tri(ctx, d.bottom, d.right, apex, '#847d70');
    tri(ctx, d.top, d.left, apex, '#565049');
    tri(ctx, d.top, d.right, apex, '#726b60');

    /* Snow lies on what is high, not on what is random: tall peaks keep a cap
       all year, low ones only get one in winter. */
    var hoogte = (H / p - 0.42) / 1.05;
    var sneeuw = (seizoen === 3 ? 0.3 : 0) + (hoogte > 0.45 ? (hoogte - 0.45) * 1.1 : 0);
    if (sneeuw < 0.08) return;
    sneeuw = Math.min(0.75, sneeuw);
    var snL = lerp(apex, d.left, sneeuw), snR = lerp(apex, d.right, sneeuw);
    var snB = lerp(apex, d.bottom, sneeuw);
    tri(ctx, apex, snL, snB, '#dfe6ea');
    tri(ctx, apex, snB, snR, '#eef3f6');
  }

  function ader(ctx, d, t, p) {
    var leeg = t.max > 0 ? Game.util.clamp(t.amt / t.max, 0, 1) : 0;
    if (leeg <= 0.02) return;
    ctx.fillStyle = ADERKLEUR[t.n];
    ctx.globalAlpha = 0.5 + leeg * 0.5;
    for (var i = 0; i < 3; i++) {
      var ox = d.cx + p * (((i * 29 + t.v * 80) % 30) / 100 - 0.15);
      var oy = d.cy + p * (((i * 53 + t.v * 50) % 24) / 100 - 0.04);
      ctx.beginPath();
      ctx.arc(ox, oy, p * 0.05, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* Field furrows running along the tile's world-x rows. */
  function akker(ctx, d, t, p, seizoen) {
    if (seizoen === 3) return;
    ctx.strokeStyle = ['rgba(150,180,90,.5)', 'rgba(210,190,80,.6)', 'rgba(220,190,70,.7)', ''][seizoen];
    ctx.lineWidth = Math.max(1, p * 0.04);
    ctx.beginPath();
    for (var i = 1; i < 4; i++) {
      var f = i / 4;
      var a = lerp(d.top, d.left, f), b = lerp(d.right, d.bottom, f);
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
  }

  /* A deer that grazes and drifts within its tile instead of standing frozen.
     Position is a slow function of time (+ the tile's stable `v`), so it needs
     no per-animal state and survives the pure-JSON rule. It faces the way it
     is drifting and dips its head now and then. */
  function wild(ctx, d, t, p, tijd) {
    if (t.amt <= 0) return;
    var fx = Math.sin(tijd * 0.35 + t.v * 6.28);
    var fy = Math.cos(tijd * 0.27 + t.v * 4.0);
    var ox = d.cx + fx * p * 0.2;
    var oy = d.cy - p * 0.14 + fy * p * 0.08;
    var kijk = Math.cos(tijd * 0.35 + t.v * 6.28) >= 0 ? 1 : -1;   /* d/dt of fx */
    var graas = Math.max(0, Math.sin(tijd * 0.9 + t.v * 3)) * p * 0.03;

    ctx.fillStyle = 'rgba(0,0,0,.16)';
    ctx.beginPath();
    ctx.ellipse(ox, oy + p * 0.16, p * 0.11, p * 0.045, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(ox, oy + graas);
    ctx.scale(kijk, 1);
    ctx.font = Math.round(p * 0.46) + 'px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🦌', 0, 0);
    ctx.restore();
  }

  /* -------------------------------------------------------------- gebouwen */

  /* Per-age palette for the tiered houses/halls, so a village visibly matures:
     daub → timber → stone → half-timber, thatch → tile. */
  var TIER_PALET = {
    1: { muur: '#d8c39a', dak: '#7c4b2e' },
    2: { muur: '#c9b487', dak: '#8a5a3a' },
    3: { muur: '#c6c2b6', dak: '#6a6258' },
    4: { muur: '#e6dcc0', dak: '#7a4030' }
  };
  var TIER_SHAPES = { dorpsplein: 1, huisje: 1, herenhuis: 1, herberg: 1, marktplaats: 1 };

  /* Per-building iso shape: wall height & roof style/height (as fractions of a
     tile), plus optional flourishes and colours. Anything not listed uses the
     house default. `stijl`: schuin (hip roof) | punt (steep spire) |
     plat (flat top) | geen (open top). */
  var ISO = {
    _default:    { muurH: 0.55, stijl: 'schuin', dakH: 0.46, muur: '#c9b491', dak: '#7c4b2e' },

    dorpsplein:  { muurH: 0.42, stijl: 'schuin', dakH: 0.4, vlag: true },
    huisje:      { muurH: 0.52, stijl: 'schuin', dakH: 0.48 },
    herenhuis:   { muurH: 0.64, stijl: 'schuin', dakH: 0.48 },
    boerderij:   { muurH: 0.4,  stijl: 'schuin', dakH: 0.34, muur: '#cdb98d', dak: '#8a5a34' },
    herberg:     { muurH: 0.52, stijl: 'schuin', dakH: 0.5, uithang: true },

    stadhuis:    { muurH: 0.72, stijl: 'schuin', dakH: 0.55, muur: '#d8cba6', dak: '#7a5236', vlag: true },
    handelshuis: { muurH: 0.66, stijl: 'schuin', dakH: 0.5, muur: '#d3c39c', dak: '#7a5236', vlag: true },
    universiteit:{ muurH: 0.72, stijl: 'schuin', dakH: 0.52, muur: '#d8cba6', dak: '#5f5852', vlag: true },
    gildehuis:   { muurH: 0.64, stijl: 'schuin', dakH: 0.5, muur: '#d3c39c', dak: '#6a5240' },

    marktplaats: { muurH: 0.3,  stijl: 'plat',   dakH: 0.12, muur: '#c7b083', dak: '#9c6a3a', luifel: true },
    voorraadschuur:{ muurH: 0.42, stijl: 'schuin', dakH: 0.44, muur: '#b99a6a', dak: '#6e4a2c' },
    pakhuis:     { muurH: 0.5,  stijl: 'schuin', dakH: 0.46, muur: '#b99a6a', dak: '#5f4530' },
    waterput:    { muurH: 0.3,  stijl: 'schuin', dakH: 0.4,  smal: 0.5, muur: '#a9a094', dak: '#6a4a30' },

    kapel:       { muurH: 0.62, stijl: 'punt',   dakH: 0.95, muur: '#e2dac4', dak: '#6a6258', kruis: true },
    kerk:        { muurH: 0.74, stijl: 'punt',   dakH: 1.2,  muur: '#e2dac4', dak: '#616058', kruis: true },
    kathedraal:  { muurH: 0.9,  stijl: 'punt',   dakH: 1.5,  muur: '#e6dfca', dak: '#5a5a54', kruis: true },

    wachttoren:  { muurH: 1.15, stijl: 'punt',   dakH: 0.7,  smal: 0.5, muur: '#a49a8c', dak: '#7a3b2c' },
    kazerne:     { muurH: 0.6,  stijl: 'schuin', dakH: 0.44, muur: '#b0a692', dak: '#5f4a3a' },
    smederij:    { muurH: 0.5,  stijl: 'schuin', dakH: 0.44, muur: '#b8a483', dak: '#5a4636' },
    wapensmid:   { muurH: 0.56, stijl: 'schuin', dakH: 0.46, muur: '#b0a08a', dak: '#5a4636' },

    kasteel:     { muurH: 1.05, stijl: 'plat',   dakH: 0.1,  muur: '#b8b0a2', dak: '#5a3a30', kantelen: true, torens: true },
    stadsmuur:   { muurH: 0.55, stijl: 'geen',   dakH: 0,    muur: '#9aa0a6', kantelen: true },
    molen:       { muurH: 0.72, stijl: 'schuin', dakH: 0.44, smal: 0.62, muur: '#d5c7a4', dak: '#7c4b2e', wieken: true },

    steengroeve: { muurH: 0.34, stijl: 'schuin', dakH: 0.4,  muur: '#b0a894', dak: '#6a5a44' },
    kopermijn:   { muurH: 0.34, stijl: 'schuin', dakH: 0.4,  muur: '#b0a894', dak: '#6a5a44' },
    ijzermijn:   { muurH: 0.34, stijl: 'schuin', dakH: 0.4,  muur: '#b0a894', dak: '#6a5a44' },
    edelsteenmijn:{ muurH: 0.34, stijl: 'schuin', dakH: 0.4, muur: '#b0a894', dak: '#6a5a44' },
    houthakkershut:{ muurH: 0.44, stijl: 'schuin', dakH: 0.46, muur: '#b99a6a', dak: '#5f4530' },
    jachthut:    { muurH: 0.42, stijl: 'schuin', dakH: 0.46, muur: '#b99a6a', dak: '#5f4530' },
    vissershut:  { muurH: 0.42, stijl: 'schuin', dakH: 0.46, muur: '#b99a6a', dak: '#5f4530' },
    bakkerij:    { muurH: 0.5,  stijl: 'schuin', dakH: 0.46, muur: '#cdb98d', dak: '#8a5a34' },
    juwelier:    { muurH: 0.56, stijl: 'schuin', dakH: 0.5, muur: '#d3c39c', dak: '#6a5240' }
  };

  function isoCfg(def, tier) {
    var basis = ISO[def.id] || ISO._default;
    var cfg = {
      muurH: basis.muurH != null ? basis.muurH : ISO._default.muurH,
      stijl: basis.stijl || ISO._default.stijl,
      dakH: basis.dakH != null ? basis.dakH : ISO._default.dakH,
      muur: basis.muur || ISO._default.muur,
      dak: basis.dak || ISO._default.dak,
      smal: basis.smal || 0,
      vlag: basis.vlag, kruis: basis.kruis, kantelen: basis.kantelen,
      torens: basis.torens, wieken: basis.wieken, luifel: basis.luifel,
      uithang: basis.uithang
    };
    /* Tiered houses recolour with the age palette; at the top tier they gain a
       half-timber frame so the town's maturing reads at a glance. */
    if (tier && tier > 1 && TIER_SHAPES[def.id]) {
      var pal = TIER_PALET[Game.util.clamp(tier, 1, 4)];
      cfg.muur = pal.muur; cfg.dak = pal.dak;
    }
    cfg.vakwerk = tier === 4 && !!TIER_SHAPES[def.id];
    return cfg;
  }

  /* Draws a building. (sx, sy) is the projected *top corner* of its footprint,
     which spans `grootte` tiles; p is pixels-per-tile. */
  S.tekenGebouw = function (ctx, def, sx, sy, p, grootte, opties) {
    opties = opties || {};

    /* Spoor D: a registered, loaded iso sprite replaces the procedural volume;
       otherwise we draw the volume below exactly as before. */
    var atlas = Game.render.atlas;
    var isoImg = atlas && atlas.isoGebouw && atlas.isoGebouw(def.id);
    if (isoImg) { tekenGebouwSprite(ctx, isoImg, def, sx, sy, p, grootte, opties); return; }

    var cfg = isoCfg(def, opties.tijdperk);
    var foot = Game.render.diamant(sx, sy, p * grootte);
    if (cfg.smal) foot = diamantVan(foot.cx, foot.cy, foot.hw * (1 - cfg.smal * 0.5), foot.hh * (1 - cfg.smal * 0.5));

    /* Soft ambient-occlusion shadow (a radial gradient, so its edge feathers
       into the ground instead of a hard ellipse), offset to the light-away
       side. */
    var scx = foot.cx + foot.hw * 0.12, scy = foot.cy + foot.hh * 0.28, sr = foot.hw * 1.08;
    var sg = ctx.createRadialGradient(scx, scy, sr * 0.35, scx, scy, sr);
    sg.addColorStop(0, 'rgba(0,0,0,.26)');
    sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.ellipse(scx, scy, sr, sr * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    var H = p * cfg.muurH * (0.8 + 0.2 * grootte);
    var top = isoMuren(ctx, foot, H, cfg.muur);

    /* Door + shuttered windows on the visible wall faces. */
    if (!NOGEVEL[def.id] && p * grootte >= 30) gevel(ctx, foot, top, cfg);

    /* Half-timber frame over the plaster on the top-tier houses. */
    if (cfg.vakwerk && p * grootte >= 26) vakwerk(ctx, foot, top);

    if (cfg.kantelen) kantelen(ctx, top, p, cfg.muur);

    /* Roofs stay proportionate as footprints grow (a big hall gets a broad,
       not a towering, roof). */
    var dakH = p * cfg.dakH * (0.85 + 0.08 * grootte);
    if (cfg.stijl === 'schuin' || cfg.stijl === 'punt') dakSchuin(ctx, top, dakH, cfg.dak);
    else if (cfg.stijl === 'plat') vulDiamant(ctx, top, verf(cfg.muur, 0.98));
    else vulDiamant(ctx, top, verf(cfg.muur, 0.9));   /* 'geen': open wall top */

    if (opties.seizoen === 3) dakSneeuw(ctx, top, dakH, cfg);

    if (cfg.torens) kasteelTorens(ctx, foot, H, dakH, cfg);
    if (cfg.kruis) kruisTop(ctx, top, dakH, p);
    if (cfg.vlag) vlag(ctx, top, dakH, p);
    if (cfg.wieken) wieken(ctx, foot, H, p, opties.tijd || 0, cfg.dak);
    if (cfg.uithang) uithangbord(ctx, foot, H, p);

    if (opties.geschroeid) schroei(ctx, foot, H, dakH, opties.geschroeid);

    /* Icon badge so every building stays recognisable at a glance. */
    if (p * grootte >= 26 && def.id !== 'stadsmuur' && !cfg.wieken) {
      ctx.font = Math.round(p * grootte * 0.3) + 'px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(def.emoji, top.cx, top.cy - (cfg.stijl === 'plat' ? p * 0.1 : dakH * 0.42));
    }
  };

  /* Snow settling on a roof in winter: a white cap over the upper part of the
     two front roof faces, or a full white top on a flat roof. The single
     cheapest thing that makes winter read as winter in the town itself. */
  function dakSneeuw(ctx, t, dakH, cfg) {
    if (cfg.stijl === 'plat' || cfg.stijl === 'geen') {
      vulDiamant(ctx, t, 'rgba(240,247,252,.72)');
      return;
    }
    var apex = { x: t.cx, y: t.cy - dakH };
    var deel = 0.46;
    var sL = lerp(apex, t.left, deel), sR = lerp(apex, t.right, deel);
    var sB = lerp(apex, t.bottom, deel), sT = lerp(apex, t.top, deel);
    tri(ctx, apex, sL, sB, 'rgba(238,245,250,.85)');
    tri(ctx, apex, sB, sR, 'rgba(248,252,255,.9)');
    tri(ctx, apex, sT, sL, 'rgba(230,238,245,.7)');
    tri(ctx, apex, sT, sR, 'rgba(236,243,249,.75)');
  }

  /* Draw a registered iso building sprite in place of the procedural volume,
     anchored with its base at the front corner of the footprint so it sits on
     the tile and depth-sorts correctly. Keeps the soft ground shadow and the
     raid scorch so it matches the rest of the town. */
  function tekenGebouwSprite(ctx, img, def, sx, sy, p, grootte, opties) {
    var foot = Game.render.diamant(sx, sy, p * grootte);

    var scx = foot.cx + foot.hw * 0.12, scy = foot.cy + foot.hh * 0.28, sr = foot.hw * 1.08;
    var sg = ctx.createRadialGradient(scx, scy, sr * 0.35, scx, scy, sr);
    sg.addColorStop(0, 'rgba(0,0,0,.26)');
    sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.ellipse(scx, scy, sr, sr * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    var w = p * grootte * 1.5;
    var ratio = (img.naturalHeight && img.naturalWidth) ? img.naturalHeight / img.naturalWidth : 1;
    var h = w * ratio;
    ctx.drawImage(img, foot.cx - w / 2, foot.cy + foot.hh - h, w, h);

    if (opties.geschroeid) schroei(ctx, foot, p * grootte * 0.6, h * 0.4, opties.geschroeid);
  }

  /* Left + right visible walls; returns the raised top-face diamond. The dark
     (left) face is lifted a touch by a soft fill light so the shadow side does
     not crush to a flat block. */
  function isoMuren(ctx, foot, H, muur) {
    var top = diamantVan(foot.cx, foot.cy - H, foot.hw, foot.hh);
    quad(ctx, foot.left, foot.bottom, top.bottom, top.left, verf(muur, 0.72));    /* left face  */
    quad(ctx, foot.bottom, foot.right, top.right, top.bottom, verf(muur, 0.88));  /* right face */
    return top;
  }

  /* Hip / spire roof rising from a top-face diamond to an apex, with a lit
     ridge line so the two front faces read as a proper roof, plus a few faint
     courses parallel to the eaves that suggest tiles / thatch (C1). */
  function dakSchuin(ctx, t, dakH, dak, stijl) {
    var apex = { x: t.cx, y: t.cy - dakH };
    tri(ctx, t.top, t.left, apex, verf(dak, 0.7));    /* back-left  (far)  */
    tri(ctx, t.top, t.right, apex, verf(dak, 0.84));  /* back-right */
    tri(ctx, t.left, t.bottom, apex, verf(dak, 0.92)); /* front-left */
    tri(ctx, t.bottom, t.right, apex, verf(dak, 1.08));/* front-right (lit) */

    dakLagen(ctx, t.left, t.bottom, apex, dak, 0.9);   /* front-left courses  */
    dakLagen(ctx, t.bottom, t.right, apex, dak, 1.06); /* front-right courses */

    ctx.strokeStyle = verf(dak, 1.22);
    ctx.lineWidth = Math.max(1, dakH * 0.03);
    ctx.beginPath();
    ctx.moveTo(t.bottom.x, t.bottom.y); ctx.lineTo(apex.x, apex.y);
    ctx.stroke();
  }

  /* Courses parallel to a roof face's eave (edge a→b), from eave up to the
     apex. Thin darker lines that read as tile rows / thatch bands. */
  function dakLagen(ctx, a, b, apex, dak, licht) {
    ctx.strokeStyle = verf(dak, licht * 0.82);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var i = 1; i <= 3; i++) {
      var u = i / 4;
      var p1 = lerp(a, apex, u), p2 = lerp(b, apex, u);
      ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
    }
    ctx.stroke();
  }

  /* Buildings whose walls stay plain (fortifications, towers, mills, mines). */
  var NOGEVEL = {
    stadsmuur: 1, wachttoren: 1, molen: 1, waterput: 1, kasteel: 1,
    steengroeve: 1, kopermijn: 1, ijzermijn: 1, edelsteenmijn: 1
  };

  function gevelPunt(bl, br, tl, tr, u, v) {
    return lerp(lerp(bl, br, u), lerp(tl, tr, u), v);
  }

  /* Door on the lit face + shuttered windows on both visible faces. */
  function gevel(ctx, foot, top, cfg) {
    gevelVlak(ctx, foot.bottom, foot.right, top.bottom, top.right, cfg, true);
    gevelVlak(ctx, foot.left, foot.bottom, top.left, top.bottom, cfg, false);
  }

  function gevelVlak(ctx, bl, br, tl, tr, cfg, lit) {
    if (lit) {
      quad(ctx,
        gevelPunt(bl, br, tl, tr, 0.44, 0.02), gevelPunt(bl, br, tl, tr, 0.6, 0.02),
        gevelPunt(bl, br, tl, tr, 0.6, 0.5),  gevelPunt(bl, br, tl, tr, 0.44, 0.5),
        verf(cfg.dak, 0.55));
    }
    var raam = lit ? 'rgba(42,30,18,.9)' : 'rgba(30,22,14,.92)';
    var us = lit ? [0.2, 0.82] : [0.32, 0.68];
    for (var i = 0; i < us.length; i++) {
      var u = us[i];
      quad(ctx,
        gevelPunt(bl, br, tl, tr, u - 0.07, 0.56), gevelPunt(bl, br, tl, tr, u + 0.07, 0.56),
        gevelPunt(bl, br, tl, tr, u + 0.07, 0.82), gevelPunt(bl, br, tl, tr, u - 0.07, 0.82),
        raam);
    }
  }

  /* Half-timber framing on the two visible faces: corner posts, top plate,
     sill and a pair of diagonal braces, in dark oak over the plaster. */
  function vakwerk(ctx, foot, top) {
    var balk = '#5a4030';
    ctx.strokeStyle = balk;
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1, foot.hw * 0.06);
    ctx.beginPath();
    ctx.moveTo(foot.left.x, foot.left.y); ctx.lineTo(top.left.x, top.left.y);
    ctx.moveTo(foot.bottom.x, foot.bottom.y); ctx.lineTo(top.bottom.x, top.bottom.y);
    ctx.moveTo(foot.right.x, foot.right.y); ctx.lineTo(top.right.x, top.right.y);
    ctx.moveTo(top.left.x, top.left.y); ctx.lineTo(top.bottom.x, top.bottom.y); ctx.lineTo(top.right.x, top.right.y);
    ctx.moveTo(foot.left.x, foot.left.y); ctx.lineTo(foot.bottom.x, foot.bottom.y); ctx.lineTo(foot.right.x, foot.right.y);
    ctx.stroke();
    ctx.lineWidth = Math.max(1, foot.hw * 0.04);
    ctx.beginPath();
    ctx.moveTo(foot.bottom.x, foot.bottom.y); ctx.lineTo(top.left.x, top.left.y);
    ctx.moveTo(foot.bottom.x, foot.bottom.y); ctx.lineTo(top.right.x, top.right.y);
    ctx.stroke();
  }

  /* Crenellated parapet along the two near top edges. */
  function kantelen(ctx, t, p, muur) {
    var n = 4, h = p * 0.16;
    for (var s = 0; s < 2; s++) {
      var a = s === 0 ? t.left : t.bottom;
      var b = s === 0 ? t.bottom : t.right;
      for (var i = 0; i < n; i += 2) {
        var q0 = lerp(a, b, i / n), q1 = lerp(a, b, (i + 1) / n);
        quad(ctx, q0, q1, omhoog(q1, h), omhoog(q0, h), verf(muur, s === 0 ? 0.72 : 0.9));
      }
    }
  }

  function kasteelTorens(ctx, foot, H, dakH, cfg) {
    var th = H * 1.18, r = foot.hw * 0.26;
    [foot.left, foot.top, foot.right].forEach(function (c, i) {
      var base = diamantVan(c.x, c.y, r, r * 0.5);
      var top = isoMuren(ctx, base, th, cfg.muur);
      dakSchuin(ctx, top, dakH * 1.1, cfg.dak);
    });
  }

  function kruisTop(ctx, t, dakH, p) {
    var apex = t.cy - dakH;
    ctx.strokeStyle = '#d7a94b';
    ctx.lineWidth = Math.max(1.4, p * 0.045);
    ctx.beginPath();
    ctx.moveTo(t.cx, apex - p * 0.02); ctx.lineTo(t.cx, apex - p * 0.28);
    ctx.moveTo(t.cx - p * 0.09, apex - p * 0.2); ctx.lineTo(t.cx + p * 0.09, apex - p * 0.2);
    ctx.stroke();
  }

  function vlag(ctx, t, dakH, p) {
    var apex = t.cy - dakH;
    ctx.strokeStyle = '#6a5030';
    ctx.lineWidth = Math.max(1, p * 0.03);
    ctx.beginPath();
    ctx.moveTo(t.cx, apex); ctx.lineTo(t.cx, apex - p * 0.34);
    ctx.stroke();
    ctx.fillStyle = '#c85a4a';
    ctx.beginPath();
    ctx.moveTo(t.cx, apex - p * 0.34);
    ctx.lineTo(t.cx + p * 0.2, apex - p * 0.28);
    ctx.lineTo(t.cx, apex - p * 0.22);
    ctx.closePath();
    ctx.fill();
  }

  /* Turning windmill sails on the front (lower-right) face. */
  function wieken(ctx, foot, H, p, tijd, dak) {
    var cx = foot.cx + foot.hw * 0.22, cy = foot.cy - H * 0.72, r = p * 0.42;
    ctx.strokeStyle = '#5c4326';
    ctx.lineWidth = Math.max(1.5, p * 0.05);
    for (var i = 0; i < 4; i++) {
      var a = tijd * 0.9 + i * Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.62);
      ctx.stroke();
    }
  }

  function uithangbord(ctx, foot, H, p) {
    var x = foot.right.x + p * 0.02, y = foot.right.y - H * 0.6;
    ctx.strokeStyle = '#5a4126';
    ctx.lineWidth = Math.max(1, p * 0.03);
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x, y + p * 0.22);
    ctx.stroke();
    ctx.fillStyle = '#8a5a34';
    ctx.fillRect(x - p * 0.07, y + p * 0.08, p * 0.14, p * 0.12);
  }

  /* A smoky scorch wash on a building the raiders damaged (fase 6). */
  function schroei(ctx, foot, H, dakH, timer) {
    var t = Game.util.clamp(timer / 26, 0, 1);
    ctx.save();
    ctx.globalAlpha = t * 0.55;
    ctx.fillStyle = 'rgba(30,24,20,1)';
    ctx.beginPath();
    ctx.ellipse(foot.cx, foot.cy - H * 0.5, foot.hw * 0.9, (H + dakH) * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /* Construction site: a low iso stub grown by progress, plus scaffolding and a
     floating progress bar. */
  S.tekenBouwplaats = function (ctx, def, sx, sy, p, grootte, deel) {
    var foot = Game.render.diamant(sx, sy, p * grootte);
    deel = Game.util.clamp(deel, 0, 1);

    ctx.fillStyle = 'rgba(0,0,0,.2)';
    ctx.beginPath();
    ctx.ellipse(foot.cx, foot.cy + foot.hh * 0.25, foot.hw * 0.98, foot.hh * 0.98, 0, 0, Math.PI * 2);
    ctx.fill();

    var H = p * grootte * 0.4 * deel + 1;
    var top = isoMuren(ctx, foot, H, '#b89a6a');
    vulDiamant(ctx, top, 'rgba(150,120,80,.85)');

    /* Scaffolding poles at the footprint corners. */
    var poleH = p * grootte * 0.5;
    ctx.strokeStyle = '#a07b46';
    ctx.lineWidth = Math.max(1, p * 0.04);
    ctx.beginPath();
    [foot.left, foot.right, foot.top, foot.bottom].forEach(function (c) {
      ctx.moveTo(c.x, c.y); ctx.lineTo(c.x, c.y - poleH);
    });
    ctx.stroke();

    if (p * grootte >= 24) {
      ctx.font = Math.round(p * grootte * 0.28) + 'px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = 0.8;
      ctx.fillText(def.emoji, foot.cx, foot.cy - H - p * 0.1);
      ctx.globalAlpha = 1;
    }

    /* Progress bar floating above the site. */
    var bw = foot.hw * 1.1, bx = foot.cx - bw / 2, by = foot.cy - poleH - p * 0.2, bh = Math.max(3, p * 0.09);
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = '#d7a94b';
    ctx.fillRect(bx, by, bw * deel, bh);
  };

  Game.render.sprites = S;

})(window.Game);
