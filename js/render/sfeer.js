/* Sfeer: het licht van de wereld.
 *
 * One place decides what time of day it is and what that does to the colour of
 * everything: the day/night ramp, the warm dawn and dusk washes, the haze that
 * gives the isometric view its distance, and the vignette. Everything here is
 * derived from s.tijd and s.seizoen and is never stored in Game.state.
 *
 * The sun's *colour* moves through the day; the sun's *direction* does not. The
 * hillshade baked into the terrain (sprites.bereidTerreinVoor) is lit from the
 * top-left, so every cast shadow in the game falls to the bottom-right, all day
 * long. A wandering shadow would fight a fixed hillshade and the ground would
 * come apart. */
(function (Game) {

  var Sf = {};

  /* Fixed light direction, shared by every shadow in the game. In iso screen
     space the sun sits top-left, so shadows lean down and to the right. */
  Sf.SCHADUW = { x: 0.62, y: 0.30 };

  /* Cached gradients: they only depend on the canvas size, and rebuilding a
     radial gradient every frame is the one genuinely expensive thing here. */
  var cache = { b: 0, h: 0, vignet: null, nevel: null, nevelSleutel: '' };

  /* ------------------------------------------------------------------ licht */

  /* The state of the light right now.
       f       0..1 through the day — 0 is midday, 0.5 is midnight
       nacht   0 at midday, 1 at midnight
       avond   1 around dusk, 0 elsewhere
       ochtend 1 around dawn, 0 elsewhere
       dag     1 in broad daylight (used to fade daytime-only sparkle) */
  Sf.licht = function (s) {
    var dag = (Game.core.state && Game.core.state.DAG) || 10;
    var f = ((s.tijd % dag) + dag) % dag / dag;
    var nacht = 0.5 - 0.5 * Math.cos(f * Math.PI * 2);
    return {
      f: f,
      nacht: nacht,
      dag: 1 - nacht,
      avond: piek(f, 0.26, 0.17),
      ochtend: piek(f, 0.76, 0.15)
    };
  };

  /* A soft triangular peak of width `br` around `mid`, wrapping at 0/1. */
  function piek(f, mid, br) {
    var d = Math.abs(f - mid);
    if (d > 0.5) d = 1 - d;
    return Math.max(0, 1 - d / br);
  }

  /* Per-season tint of the daylight itself: spring is fresh, summer golden,
     autumn amber, winter blue and low. [r, g, b, sterkte] */
  var SEIZOENSLICHT = [
    [140, 190, 120, 0.05],
    [255, 224, 150, 0.06],
    [235, 170, 90, 0.08],
    [170, 200, 240, 0.10]
  ];

  /* --------------------------------------------------------------- hemel --- */

  /* Everything beyond the map edge.
   *
   * This used to be one vertical gradient from sky-blue at the top to sea-blue
   * at the bottom, across the whole screen — so "outside the map" was sky where
   * water belonged, and the map sat on it as a diamond raft on a backdrop. The
   * map generator pushes its heights down at the border (js/core/map.js), so a
   * map always ends in sea; the honest thing to paint out there is *more sea*,
   * in exactly the colour the deepest water tile gets. That colour comes from
   * sprites.diepZeeKleur, which runs the tiles' own waterKleur(): two tables
   * would drift, and a shade of difference is all it takes to see the edge.
   *
   * Above it a sky, but only in the top band, because in an isometric view the
   * top of the screen is the far distance and that is the only place a horizon
   * can honestly be. It fades down into the sea rather than meeting it on a
   * line. Drawn first of all, so the terrain paints over it. */
  var ZEE = ['#27506b', '#295473', '#254a64', '#2b4a5e'];

  Sf.HORIZON = 0.3;   /* fraction of the screen height the sky occupies */

  Sf.tekenHemel = function (ctx, cam, s) {
    var L = Sf.licht(s);
    var b = cam.breedte, h = cam.hoogte;
    var sprites = Game.render.sprites;
    var zee = (sprites && sprites.diepZeeKleur) ? sprites.diepZeeKleur(s.seizoen)
                                                : (ZEE[s.seizoen] || ZEE[0]);

    ctx.fillStyle = zee;
    ctx.fillRect(-4, -4, b + 8, h + 8);

    verreZee(ctx, b, h, s);

    /* The sky band, ending in exactly the sea colour so the two are continuous
       where they meet. */
    var horizon = h * Sf.HORIZON;
    var lucht = luchtKleur(L);
    var g = ctx.createLinearGradient(0, -h * 0.06, 0, horizon);
    g.addColorStop(0, lucht);
    g.addColorStop(0.6, meng(lucht, zee, 0.42));
    g.addColorStop(1, zee);
    ctx.fillStyle = g;
    ctx.fillRect(-4, -4, b + 8, horizon + 4);

    /* Haze sitting on the horizon itself, which is what stops the sky and the
       sea from reading as two flat fields stacked on each other. */
    var damp = ctx.createLinearGradient(0, horizon - h * 0.16, 0, horizon + h * 0.1);
    var dampK = L.nacht > 0.5 ? '120,140,190' : '214,230,242';
    damp.addColorStop(0, 'rgba(' + dampK + ',0)');
    damp.addColorStop(0.62, 'rgba(' + dampK + ',' + (0.20 * L.dag + 0.05).toFixed(3) + ')');
    damp.addColorStop(1, 'rgba(' + dampK + ',0)');
    ctx.fillStyle = damp;
    ctx.fillRect(-4, horizon - h * 0.16, b + 8, h * 0.26);

    /* Dawn and dusk: a warm glow low on the horizon, on the side the light
       comes from. Not a disc — the sun used to hang in the sky as a white blob
       in screen space, drifting with the clock while every shadow in the game
       fell the other way (Sf.SCHADUW is fixed, deliberately). A glow says the
       same thing without contradicting the ground. */
    var warm = L.avond * 0.9 + L.ochtend * 0.6;
    if (warm > 0.02) {
      var zonX = b * (0.5 - Sf.SCHADUW.x * 0.42);   /* light comes from the left */
      var gl = ctx.createRadialGradient(zonX, horizon, 0, zonX, horizon, b * 0.42);
      var gk = L.avond >= L.ochtend ? '255,168,84' : '255,196,158';
      gl.addColorStop(0, 'rgba(' + gk + ',' + (warm * 0.5).toFixed(3) + ')');
      gl.addColorStop(0.5, 'rgba(' + gk + ',' + (warm * 0.16).toFixed(3) + ')');
      gl.addColorStop(1, 'rgba(' + gk + ',0)');
      ctx.fillStyle = gl;
      ctx.fillRect(-4, -4, b + 8, horizon + h * 0.14);
    }

    /* The moon does stay a disc: a moon in the sky is a thing you look at, and
       it gives the night an anchor the way a floating sun never did. */
    if (L.nacht > 0.45) {
      var mA = (L.nacht - 0.45) / 0.55;
      var mx = b * (0.18 + ((L.f + 0.5) % 1) * 0.64);
      var my = horizon * (0.62 - Math.sin(L.f * Math.PI * 2) * 0.28);
      var mr = Math.min(b, h) * 0.018;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      var disc = ctx.createRadialGradient(mx, my, 0, mx, my, mr * 4);
      disc.addColorStop(0, 'rgba(230,236,250,' + (0.85 * mA).toFixed(3) + ')');
      disc.addColorStop(0.2, 'rgba(214,224,246,' + (0.5 * mA).toFixed(3) + ')');
      disc.addColorStop(1, 'rgba(200,214,240,0)');
      ctx.fillStyle = disc;
      ctx.beginPath();
      ctx.arc(mx, my, mr * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  };

  /* Glints on the open water beyond the map. Twenty-odd short strokes at
     positions hashed from their index (never from a random source, or they
     would crawl about between frames) drifting slowly sideways with the clock.
     Drawn under everything, so on any normal zoom most of them are covered by
     land — it only has to hold up in the rim around the island. */
  function verreZee(ctx, b, h, s) {
    var t = s.tijd || 0;
    ctx.save();
    ctx.strokeStyle = 'rgba(206,232,244,.075)';
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (var i = 0; i < 26; i++) {
      var hx = ((i * 2654435761) % 1000) / 1000;
      var hy = ((i * 40503) % 997) / 997;
      var breed = 26 + hy * 54;
      var x = ((hx * b + t * (6 + hy * 8)) % (b + 160)) - 80;
      var y = h * (0.3 + hy * 0.72) + Math.sin(t * 0.6 + i) * 4;
      ctx.lineWidth = 1 + hy * 1.6;
      ctx.moveTo(x - breed / 2, y);
      ctx.lineTo(x + breed / 2, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function luchtKleur(L) {
    var nacht = [26, 34, 68], dag = [138, 176, 210];
    var c = [
      Math.round(nacht[0] + (dag[0] - nacht[0]) * L.dag),
      Math.round(nacht[1] + (dag[1] - nacht[1]) * L.dag),
      Math.round(nacht[2] + (dag[2] - nacht[2]) * L.dag)
    ];
    /* Warm the horizon at dawn and dusk. */
    var warm = L.avond * 0.8 + L.ochtend * 0.5;
    if (warm > 0.02) {
      c[0] = Math.min(255, Math.round(c[0] + warm * 90));
      c[1] = Math.round(c[1] + warm * 30);
      c[2] = Math.max(0, Math.round(c[2] - warm * 30));
    }
    return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
  }

  function meng(a, b, t) {
    var ca = ontleedKleur(a), cb = ontleedKleur(b);
    return 'rgb(' + Math.round(ca[0] + (cb[0] - ca[0]) * t) + ',' +
                    Math.round(ca[1] + (cb[1] - ca[1]) * t) + ',' +
                    Math.round(ca[2] + (cb[2] - ca[2]) * t) + ')';
  }

  function ontleedKleur(k) {
    var m = k.match(/^#(\w\w)(\w\w)(\w\w)$/);
    if (m) return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
    m = k.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    return m ? [+m[1], +m[2], +m[3]] : [40, 60, 90];
  }

  /* ------------------------------------------------------------- gradatie -- */

  /* The full-screen colour grade: one wash for the night, one for the warm
     hour, one for the season. Drawn over the town, under the UI. */
  Sf.tekenGradatie = function (ctx, cam, s) {
    var L = Sf.licht(s);
    var b = cam.breedte, h = cam.hoogte;

    /* Night (a deep blue that never goes fully opaque, so the map stays
       readable at 3am) and the season tint are both flat washes, so they are
       composited into one rgba here rather than costing two full-screen fills
       a frame. */
    var sl = SEIZOENSLICHT[s.seizoen] || SEIZOENSLICHT[0];
    var wash = overElkaar([12, 20, 54, L.nacht * 0.56],
                          [sl[0], sl[1], sl[2], sl[3] * (0.4 + L.dag * 0.6)]);
    if (wash[3] > 0.004) {
      ctx.fillStyle = 'rgba(' + wash[0] + ',' + wash[1] + ',' + wash[2] + ',' + wash[3].toFixed(3) + ')';
      ctx.fillRect(0, 0, b, h);
    }

    /* Dusk and dawn: a low warm band that is strongest at the horizon (the top
       of an iso screen) and fades out downwards. */
    var warm = L.avond * 0.85 + L.ochtend * 0.5;
    if (warm > 0.02) {
      var g = ctx.createLinearGradient(0, 0, 0, h);
      var kleur = L.avond >= L.ochtend ? '255,150,70' : '255,175,150';
      g.addColorStop(0, 'rgba(' + kleur + ',' + (warm * 0.26).toFixed(3) + ')');
      g.addColorStop(0.55, 'rgba(' + kleur + ',' + (warm * 0.10).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(' + kleur + ',0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, b, h);
    }
  };

  /* ---------------------------------------------------------- curve ------

     There is no full-frame grade here, and that is a measured decision rather
     than an omission.

     Everything in this file lays colour *onto* the picture, and source-over can
     only pull an image towards a colour — which is contrast reduction. No
     amount of washing gives a screenshot the snap that separates a game from a
     drawing; for that you have to pull the picture's own contrast and
     saturation apart. The canvas way to do that is ctx.filter over a copy of
     the canvas onto itself, and it was built and measured: on presented frames
     in headless Chromium it cost +440 ms at playing zoom and +870 ms zoomed
     out, against a whole frame of about 200 ms. A filtered self-copy defeats
     the deferred rasterisation the rest of the frame depends on, so it does not
     merely add its own cost — it makes everything already drawn cost more.

     The grade lives in js/render/sprites.js instead, baked into the ground
     palette per season at build time (SEIZOENSGRADATIE), where it costs
     nothing at all: the ground is most of the screen, and a lookup table can
     carry a curve just as well as a filter can.

  /* Source-over of two translucent colours, so two washes can be laid on the
     screen in a single fill. [r, g, b, a] in, [r, g, b, a] out. */
  function overElkaar(onder, boven) {
    var a = boven[3] + onder[3] * (1 - boven[3]);
    if (a <= 0) return [0, 0, 0, 0];
    var f = function (i) {
      return Math.round((boven[i] * boven[3] + onder[i] * onder[3] * (1 - boven[3])) / a);
    };
    return [f(0), f(1), f(2), a];
  }

  /* ---------------------------------------------------------------- nevel -- */

  /* Distance haze. In an isometric view the top of the screen is the far
     distance, so a soft wash that thickens upwards reads as depth for free.
     Its colour follows the light, so at night it is a blue mist and at dusk a
     warm one. */
  Sf.tekenNevel = function (ctx, cam, s) {
    var L = Sf.licht(s);
    var kleur = nevelKleur(s, L);
    var sleutel = cam.breedte + 'x' + cam.hoogte + '|' + kleur;
    if (cache.nevelSleutel !== sleutel) {
      var g = ctx.createLinearGradient(0, 0, 0, cam.hoogte * 0.5);
      g.addColorStop(0, 'rgba(' + kleur + ',0.14)');
      g.addColorStop(0.45, 'rgba(' + kleur + ',0.06)');
      g.addColorStop(1, 'rgba(' + kleur + ',0)');
      cache.nevel = g;
      cache.nevelSleutel = sleutel;
    }
    ctx.fillStyle = cache.nevel;
    ctx.fillRect(0, 0, cam.breedte, cam.hoogte * 0.5);
  };

  function nevelKleur(s, L) {
    if (L.nacht > 0.55) return '34,44,86';
    if (L.avond > 0.35) return '226,158,104';
    if (L.ochtend > 0.35) return '218,196,198';
    return s.seizoen === 3 ? '208,222,238' : '172,198,220';
  }

  /* -------------------------------------------------------------- vignet --- */

  /* A soft darkening towards the corners. Keeps the eye in the middle of the
     stage and stops the map from bleeding into the wooden bars. */
  Sf.tekenVignet = function (ctx, cam) {
    if (cache.b !== cam.breedte || cache.h !== cam.hoogte || !cache.vignet) {
      var cx = cam.breedte / 2, cy = cam.hoogte / 2;
      var r = Math.sqrt(cx * cx + cy * cy);
      var g = ctx.createRadialGradient(cx, cy, r * 0.62, cx, cy, r);
      g.addColorStop(0, 'rgba(12,8,4,0)');
      g.addColorStop(1, 'rgba(12,8,4,0.26)');
      cache.vignet = g;
      cache.b = cam.breedte;
      cache.h = cam.hoogte;
    }
    ctx.fillStyle = cache.vignet;
    ctx.fillRect(0, 0, cam.breedte, cam.hoogte);
  };

  /* ------------------------------------------------------------- vensters -- */

  /* Warm window light on the buildings that hold people, once it is dark
     enough. Lives here because it is part of the same lamp as the grade. */
  Sf.tekenVensters = function (ctx, cam, s, p) {
    var L = Sf.licht(s);
    if (L.nacht < 0.42 || p < 18) return;
    var sterkte = (L.nacht - 0.42) / 0.58;
    var zicht = cam.zichtbaar(s.kaart);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < s.gebouwen.length; i++) {
      var g = s.gebouwen[i];
      if (!g.gebouwd) continue;
      if (g.x < zicht.x0 - 2 || g.x > zicht.x1 + 2 || g.y < zicht.y0 - 2 || g.y > zicht.y1 + 2) continue;
      var d = Game.core.state.def(g);
      if (!d.woonruimte && !d.tevredenheid && g.type !== 'herberg') continue;
      var sp = cam.wereldNaarScherm((g.x + d.grootte / 2) * Game.render.TEGEL,
                                    (g.y + d.grootte * 0.6) * Game.render.TEGEL);
      var straal = p * (0.2 + d.grootte * 0.06) * (0.6 + sterkte * 0.6);
      var grad = ctx.createRadialGradient(sp.x, sp.y - p * 0.2, 0, sp.x, sp.y - p * 0.2, straal);
      grad.addColorStop(0, 'rgba(255,198,104,' + (0.55 * sterkte).toFixed(3) + ')');
      grad.addColorStop(0.5, 'rgba(255,176,80,' + (0.2 * sterkte).toFixed(3) + ')');
      grad.addColorStop(1, 'rgba(255,170,70,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y - p * 0.2, straal, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  Game.render.sfeer = Sf;

})(window.Game);
