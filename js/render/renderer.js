/* Draws the whole scene in one clear stack:
 *
 *   deep sea → terrain (+ relief) → roads → buildings (shadow + body,
 *   y-sorted) → walkers + raiders → particles → overlays (grid, ghost)
 *   → the light of the world (js/render/sfeer.js: grade, windows, haze,
 *     vignette)
 *
 * Later steps read what earlier ones drew, so the order is deliberate. All of
 * the lively extras (walkers, roads, raiders, particles) are decorative: they
 * are derived from Game.state but never stored in it, so saves stay pure JSON. */
(function (Game) {

  var R = {};
  var sprites = Game.render.sprites;
  var map = Game.core.map;

  var canvas, ctx, dpr = 1;

  /* A short screen shake, set by schok() and decayed on real time. */
  var schud = 0, schudX = 0, schudY = 0;

  /* Age-up "construction sweep" that wipes across the town on advancement. */
  var sweep = { actief: false, t: 0, duur: 2.8, gepoft: {} };

  /* Throttles the ambient work smoke so emitters run a few times a second,
     not every frame. */
  var rookTimer = 0;

  /* A brief full-screen colour flash for the big moments (raid hit, age-up). */
  var flits = 0, flitsKleur = '255,255,255';

  /* Ambient world life, all real-time and never stored in Game.state:
       - wolken: a few soft shadow blobs drifting over the ground (B5)
       - vogels: the odd flock crossing the sky (B2)
       - weerAccu: throttles the seasonal leaf/snow emitter (B3) */
  var wolken = null;
  var vogels = null;
  var weerAccu = 0;
  var vogelKans = 0;

  R.init = function (el) {
    canvas = el;
    ctx = canvas.getContext('2d');
    R.pasMaatAan();
  };

  R.pasMaatAan = function () {
    if (!canvas) return;
    dpr = window.devicePixelRatio || 1;
    var b = canvas.clientWidth || 800;
    var h = canvas.clientHeight || 600;
    canvas.width = Math.floor(b * dpr);
    canvas.height = Math.floor(h * dpr);
    return { b: b, h: h };
  };

  /* Called when a new world is loaded/started: pre-compute the derived render
     data (terrain relief cache, road network) once instead of per frame. */
  R.verversWereld = function (s) {
    if (sprites.bereidTerreinVoor) sprites.bereidTerreinVoor(s.kaart);
    if (Game.render.paths) Game.render.paths.ververs(s);
    if (Game.render.props) Game.render.props.ververs(s);
    if (Game.render.wildlife) Game.render.wildlife.ververs(s);
    if (Game.render.floaters) Game.render.floaters.reset();
    R.verversWandelaars(s);
    if (Game.render.raiders) Game.render.raiders.synchroniseer(s);
    /* Ambient life is tied to this map's size — rebuild it for the new world. */
    wolken = null;
    vogels = null;
  };

  /* Lighter hook for when only the buildings changed (placed / finished /
     demolished / damaged): rebuild the roads and walkers, leave the terrain
     cache alone. */
  R.verversGebouwen = function (s) {
    if (Game.render.paths) Game.render.paths.ververs(s);
    if (Game.render.props) Game.render.props.ververs(s);
    if (Game.render.wildlife) Game.render.wildlife.ververs(s);
    R.verversWandelaars(s);
  };

  R.schok = function (kracht) { schud = Math.max(schud, kracht || 6); };

  R.flits = function (kleur) { flits = 1; flitsKleur = kleur || '255,255,255'; };

  /* Kick off the age-up sweep: a scaffolding + dust wave rolling across the
     city, after which the buildings read as their new tier. */
  R.tijdperkSweep = function (s) {
    sweep.actief = true;
    sweep.t = 0;
    sweep.gepoft = {};
    R.schok(4);
    R.flits('225,190,110');
  };

  /* ------------------------------------------------------- wandelaars ---- */

  /* Decorative villagers walking their building's road to a resource and back.
     They carry no simulation weight. Rebuilt by reconciliation (not from
     scratch) so nobody teleports when the list refreshes. */
  R.verversWandelaars = function (s) {
    var oud = {};
    if (s.wandelaars) {
      for (var k = 0; k < s.wandelaars.length; k++) oud[s.wandelaars[k].sleutel] = s.wandelaars[k];
    }

    var plein = s.gebouwen.filter(function (g) { return g.type === 'dorpsplein'; })[0];
    var pleinX = plein ? plein.x + 1 : (s.start ? s.start.x : s.kaart.b / 2);
    var pleinY = plein ? plein.y + 1 : (s.start ? s.start.y : s.kaart.h / 2);

    /* A busier town has more life on its streets, tied to population and not
       just to filled workplaces. */
    var drukte = Game.util.clamp(1 + Math.floor((s.bevolking.totaal || 0) / 14), 1, 4);
    var lijst = [];
    var limiet = 90;

    for (var i = 0; i < s.gebouwen.length && lijst.length < limiet; i++) {
      var g = s.gebouwen[i];
      if (!g.gebouwd) continue;
      var d = Game.core.state.def(g);
      if (!d.banen || g.werkers <= 0) continue;

      /* Crafters and gatherers alike haul to the depot the simulation says
         they deliver to, so the carts you see on the street are the carts the
         economy is actually paying for. */
      var doelX = pleinX, doelY = pleinY;
      var bij = Game.core.logistiek.dichtstbijDepot(s, g);
      if (bij && bij.depot) { doelX = Math.round(bij.depot.x); doelY = Math.round(bij.depot.y); }
      if (d.wint) {
        var t = map.zoekNode(s.kaart, g.x, g.y, d.wint.node, d.wint.straal);
        if (t) {
          var idx = s.kaart.tegels.indexOf(t);
          doelX = idx % s.kaart.b;
          doelY = Math.floor(idx / s.kaart.b);
        }
      }

      var hx = g.x + d.grootte / 2, hy = g.y + d.grootte / 2;
      var aantal = Math.max(1, Math.round(g.werkers / 2)) + (drukte - 1);

      /* What this walker hauls, and on which leg of the trip. A gatherer walks
         out empty, works at the resource and carries the load home; a crafter
         carries the finished goods to the square and comes back empty. */
      var draagt = null, draagtOp = 'terug';
      if (d.wint) {
        draagt = d.wint.res;
      } else if (d.maakt) {
        for (var uitR in d.maakt.uit) { draagt = uitR; break; }
        draagtOp = 'heen';
      }

      var route = Game.render.paths ? Game.render.paths.route(s, g.x, g.y, doelX, doelY) : null;
      if (!route) route = [{ x: hx, y: hy }, { x: doelX + 0.5, y: doelY + 0.5 }];

      var lengte = routeLengte(route);
      for (var n = 0; n < aantal && lijst.length < limiet; n++) {
        var sleutel = g.id + ':' + n;
        var bestaand = oud[sleutel];
        if (bestaand) {
          /* Keep position/gait so nobody teleports; only the derived route,
             its length and the job (colour) refresh. */
          bestaand.route = route;
          bestaand.routeLen = lengte;
          bestaand.baan = d.banen.baan;
          bestaand.draagt = draagt;
          bestaand.draagtOp = draagtOp;
          bestaand.werkt = !!d.wint;
          lijst.push(bestaand);
        } else {
          lijst.push({
            sleutel: sleutel,
            route: route,
            routeLen: lengte,
            baan: d.banen.baan,
            p: Math.random(),
            richting: Math.random() < 0.5 ? 1 : -1,
            /* Constant *world* speed (tiles/sec): long and short routes now
               walk at the same pace instead of the old fraction-per-second,
               which made long routes sprint and short ones crawl. */
            snelheidT: 0.55 + Math.random() * 0.35,
            draagt: draagt,
            draagtOp: draagtOp,
            werkt: !!d.wint,          /* gatherers actually work at the far end */
            klok: Math.random() * 6.28,
            afgelegd: Math.random() * 6,   /* seeds the gait so feet aren't in lockstep */
            wachtT: 0,
            fase: (g.id * 7 + n * 13) % 100 / 100
          });
        }
      }
    }
    s.wandelaars = lijst;
  };

  /* Total length of a route in tile units, for constant-speed walking. */
  function routeLengte(route) {
    var t = 0;
    for (var i = 0; i < route.length - 1; i++) {
      var dx = route[i + 1].x - route[i].x, dy = route[i + 1].y - route[i].y;
      t += Math.sqrt(dx * dx + dy * dy);
    }
    return t || 1e-6;
  }

  R.tickWandelaars = function (s, dt) {
    if (!s.wandelaars) return;
    for (var i = 0; i < s.wandelaars.length; i++) {
      var w = s.wandelaars[i];
      /* Pause + turn at the ends of the route instead of instantly bouncing. */
      w.klok = (w.klok || 0) + dt;
      if (w.wachtT > 0) {
        w.wachtT -= dt;
        /* Chips, splashes and dust while the axe is actually swinging. */
        if (w.werkt && w.p >= 1) werkDeeltjes(s, w, dt);
        continue;
      }
      var len = w.routeLen || 1;
      var stap = (w.snelheidT || 0.6) * dt;      /* tiles moved this frame */
      w.p += (w.richting * stap) / len;
      w.afgelegd = (w.afgelegd || 0) + stap;      /* drives the gait cadence */
      /* A gatherer lingers at the resource: that pause *is* the work. */
      if (w.p >= 1) { w.p = 1; w.richting = -1; w.wachtT = w.werkt ? 1.6 + Math.random() * 1.6 : 0.4 + Math.random() * 0.9; }
      else if (w.p <= 0) { w.p = 0; w.richting = 1; w.wachtT = 0.4 + Math.random() * 0.9; }
    }
  };

  /* A few particles on every downstroke of the tool, matched to the trade:
     wood chips, a splash, or rock dust. */
  function werkDeeltjes(s, w, dt) {
    if (!Game.render.particles) return;
    w.slagTimer = (w.slagTimer || 0) - dt;
    if (w.slagTimer > 0) return;
    w.slagTimer = 0.55;
    var eind = w.route[w.route.length - 1];
    var wx = eind.x * Game.render.TEGEL, wy = eind.y * Game.render.TEGEL;
    if (w.draagt === 'hout') {
      Game.render.particles.emit('stof', wx, wy, 2, { spreiding: 5, kleur: '196,158,96', grootte: 0.7 });
    } else if (w.draagt === 'vlees') {
      Game.render.particles.emit('stof', wx, wy, 1, { spreiding: 5, kleur: '150,170,140', grootte: 0.6 });
    } else {
      Game.render.particles.emit('stof', wx, wy, 2, { spreiding: 4, grootte: 0.8 });
    }
  }

  /* Point at fraction `f` (0..1) along a multi-segment route, in tile coords. */
  function langsRoute(route, f) {
    if (route.length === 1) return { x: route[0].x, y: route[0].y, dx: 1 };
    var lengtes = [], totaal = 0;
    for (var i = 0; i < route.length - 1; i++) {
      var ddx = route[i + 1].x - route[i].x, ddy = route[i + 1].y - route[i].y;
      var l = Math.sqrt(ddx * ddx + ddy * ddy) || 1e-6;
      lengtes.push(l); totaal += l;
    }
    var doel = Game.util.clamp(f, 0, 1) * totaal, gelopen = 0;
    for (var j = 0; j < lengtes.length; j++) {
      if (gelopen + lengtes[j] >= doel || j === lengtes.length - 1) {
        var lok = (doel - gelopen) / lengtes[j];
        var a = route[j], b = route[j + 1];
        return {
          x: a.x + (b.x - a.x) * lok,
          y: a.y + (b.y - a.y) * lok,
          dx: b.x - a.x
        };
      }
      gelopen += lengtes[j];
    }
    var e = route[route.length - 1];
    return { x: e.x, y: e.y, dx: 1 };
  }

  /* ------------------------------------------------------------ tekenen -- */

  R.teken = function (s, cam, ui) {
    if (!ctx) return;
    var p = cam.px();

    /* Screen shake: offset the whole transform by a decaying jitter. */
    if (schud > 0.05) {
      schudX = (Math.random() - 0.5) * schud;
      schudY = (Math.random() - 0.5) * schud;
    } else { schudX = schudY = 0; }
    ctx.setTransform(dpr, 0, 0, dpr, schudX * dpr, schudY * dpr);
    ctx.clearRect(-4, -4, cam.breedte + 8, cam.hoogte + 8);

    /* Beyond the map edge: deep sea. */
    ctx.fillStyle = ['#27506b', '#295473', '#254a64', '#2b4a5e'][s.seizoen];
    ctx.fillRect(-4, -4, cam.breedte + 8, cam.hoogte + 8);

    var zicht = cam.zichtbaar(s.kaart);
    var tijd = s.tijd;

    /* --- flat ground: the tile diamonds and everything in the tile plane.
       Raised features (trees, rocks, mountains) are drawn later, depth-sorted
       together with the buildings and walkers. --- */
    var TEGEL = Game.render.TEGEL;
    for (var y = zicht.y0; y < zicht.y1; y++) {
      for (var x = zicht.x0; x < zicht.x1; x++) {
        var tegel = map.tegel(s.kaart, x, y);
        if (!tegel) continue;
        var sp = cam.wereldNaarScherm(x * TEGEL, y * TEGEL);
        sprites.tekenGrond(ctx, tegel, sp.x, sp.y, p, s.seizoen, tijd, s.kaart, x, y);
      }
    }

    /* --- cloud shadows gliding over the ground, beneath everything upright --- */
    tekenWolken(ctx, cam, s, p);

    /* --- seasonal weather: spawn leaves (autumn) / snow (winter) over the view --- */
    spawnWeer(s, cam);

    /* --- roads, drawn under the buildings --- */
    if (Game.render.paths && p > 12) Game.render.paths.teken(ctx, cam, s, p);

    /* --- map overlay: tints the ground to answer one question at a time.
       Above the roads, below everything that stands up. --- */
    if (Game.render.lagen) Game.render.lagen.teken(ctx, cam, s, p);

    /* --- placement grid --- */
    if (ui.plaatsType && p > 14) {
      ctx.strokeStyle = 'rgba(255,255,255,.10)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (var gx = zicht.x0; gx <= zicht.x1; gx++) {
        var a = cam.wereldNaarScherm(gx * Game.render.TEGEL, zicht.y0 * Game.render.TEGEL);
        var b = cam.wereldNaarScherm(gx * Game.render.TEGEL, zicht.y1 * Game.render.TEGEL);
        ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      }
      for (var gy = zicht.y0; gy <= zicht.y1; gy++) {
        var c = cam.wereldNaarScherm(zicht.x0 * Game.render.TEGEL, gy * Game.render.TEGEL);
        var e = cam.wereldNaarScherm(zicht.x1 * Game.render.TEGEL, gy * Game.render.TEGEL);
        ctx.moveTo(c.x, c.y); ctx.lineTo(e.x, e.y);
      }
      ctx.stroke();
      markeerBronnen(s, cam, ui, p);
    }

    /* --- one back-to-front pass over everything that stands above the ground:
       raised terrain features, buildings and walkers, sorted by iso depth
       (footprint centre x+y) so nearer things correctly overlap farther ones.
       soort: 0 = feature, 1 = building, 2 = walker (ties break to that order). */
    var laag = [];

    for (var fy = zicht.y0; fy < zicht.y1; fy++) {
      for (var fx = zicht.x0; fx < zicht.x1; fx++) {
        var ft = map.tegel(s.kaart, fx, fy);
        if (ft && sprites.heeftKenmerk(ft)) {
          laag.push({ d: fx + fy + 1, yy: fy, soort: 0, tegel: ft, x: fx, y: fy });
        }
      }
    }

    for (var bi = 0; bi < s.gebouwen.length; bi++) {
      var g = s.gebouwen[bi];
      var gd = Game.core.state.def(g);
      if (g.x + gd.grootte < zicht.x0 || g.x > zicht.x1) continue;
      if (g.y + gd.grootte < zicht.y0 || g.y > zicht.y1) continue;
      laag.push({ d: g.x + g.y + gd.grootte, yy: g.y + gd.grootte / 2, soort: 1, g: g, def: gd });
    }

    if (p > 14 && Game.render.props) Game.render.props.verzamel(zicht, laag);
    if (p > 14 && Game.render.wildlife) Game.render.wildlife.verzamel(zicht, laag);

    if (p > 15 && s.wandelaars) {
      for (var wi = 0; wi < s.wandelaars.length; wi++) {
        var w = s.wandelaars[wi];
        var pos = langsRoute(w.route, w.p);
        if (pos.x < zicht.x0 - 1 || pos.x > zicht.x1 + 1 || pos.y < zicht.y0 - 1 || pos.y > zicht.y1 + 1) continue;
        laag.push({ d: pos.x + pos.y, yy: pos.y, soort: 2, w: w, pos: pos });
      }
    }

    laag.sort(function (a, b) {
      return a.d !== b.d ? a.d - b.d : (a.yy !== b.yy ? a.yy - b.yy : a.soort - b.soort);
    });

    for (var li = 0; li < laag.length; li++) {
      var e = laag[li];
      if (e.soort === 0) {
        var fsp = cam.wereldNaarScherm(e.x * TEGEL, e.y * TEGEL);
        sprites.tekenKenmerk(ctx, e.tegel, fsp.x, fsp.y, p, s.seizoen, tijd);
      } else if (e.soort === 0.5) {
        Game.render.props.teken(ctx, cam, p, e.prop);
      } else if (e.soort === 0.6) {
        Game.render.wildlife.teken(ctx, cam, p, e);
      } else if (e.soort === 1) {
        tekenGebouwEntry(ctx, cam, s, ui, e.g, e.def, p, tijd);
      } else {
        tekenWandelaar(ctx, cam, s, p, e.w, e.pos);
      }
    }

    /* --- bunting over the square while a festival is on --- */
    if (Game.render.props) Game.render.props.tekenFeest(ctx, cam, s, p);

    /* --- birds crossing the sky, above the town --- */
    tekenVogels(ctx, cam, s, p);

    /* --- age-up construction sweep, over the buildings --- */
    if (sweep.actief) tekenSweep(s, cam, p);

    /* --- raiders (a transient overlay, always on top of the town) --- */
    if (Game.render.raiders) Game.render.raiders.teken(ctx, cam, s, p);

    /* --- particles (smoke, fire, dust, sparks) --- */
    if (Game.render.particles) Game.render.particles.teken(ctx, cam);

    /* --- floating yields (+🪵) out of the working buildings --- */
    if (Game.render.floaters) Game.render.floaters.teken(ctx, cam, p);

    /* --- defence corridor while a raid is announced --- */
    if (Game.render.raiders && Game.render.raiders.tekenCorridor) {
      Game.render.raiders.tekenCorridor(ctx, cam, s, p);
    }

    /* --- placement ghost --- */
    if (ui.plaatsType && ui.muisTegel) tekenSpook(s, cam, ui, p);

    /* --- overlays: the light of the world (js/render/sfeer.js) + event flash.
       Order matters: the windows glow *through* the night wash, the haze sits
       over everything to push the horizon back, and the vignette closes the
       frame. --- */
    if (Game.render.sfeer) {
      Game.render.sfeer.tekenGradatie(ctx, cam, s);
      Game.render.sfeer.tekenVensters(ctx, cam, s, p);
      Game.render.sfeer.tekenNevel(ctx, cam, s);
      Game.render.sfeer.tekenVignet(ctx, cam);
    }
    if (flits > 0.01) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(' + flitsKleur + ',' + (flits * 0.3).toFixed(3) + ')';
      ctx.fillRect(0, 0, cam.breedte, cam.hoogte);
      ctx.restore();
    }
  };

  /* Real-time bits that are not the fixed simulation: particles, raiders,
     screen shake, the age-up sweep, ambient work smoke and scorch decay. */
  R.tickEffecten = function (s, dt) {
    if (Game.render.particles) Game.render.particles.tick(dt);
    if (Game.render.raiders) Game.render.raiders.tick(s, dt);
    if (schud > 0) schud = Math.max(0, schud - dt * 22);
    if (flits > 0) flits = Math.max(0, flits - dt * 2.2);

    tickSweep(s, dt);
    tickWerkrook(s, dt);
    if (Game.render.wildlife) Game.render.wildlife.tick(s, dt);
    if (Game.render.floaters) Game.render.floaters.tick(s, dt);
    vervaagSchroei(s, dt);

    /* Ambient world life, all real-time (never in the fixed step). */
    weerAccu += dt;
    tickWolken(s, dt);
    tickVogels(s, dt);
  }

  /* ------------------------------------------------- wolken (B5) --------- */

  function zorgWolken(s) {
    if (wolken) return;
    var W = s.kaart.b * Game.render.TEGEL, H = s.kaart.h * Game.render.TEGEL;
    wolken = [];
    for (var i = 0; i < 3; i++) {
      wolken.push({
        x: Math.random() * W, y: Math.random() * H,
        r: (5.5 + Math.random() * 4.5) * Game.render.TEGEL,   /* world px */
        vx: 7 + Math.random() * 5, vy: 3 + Math.random() * 4
      });
    }
  }

  function tickWolken(s, dt) {
    zorgWolken(s);
    var m = 10 * Game.render.TEGEL;
    var W = s.kaart.b * Game.render.TEGEL, H = s.kaart.h * Game.render.TEGEL;
    for (var i = 0; i < wolken.length; i++) {
      var c = wolken[i];
      c.x += c.vx * dt; c.y += c.vy * dt;
      if (c.x > W + m) { c.x = -m; c.y = Math.random() * H; }
      if (c.y > H + m) { c.y = -m; c.x = Math.random() * W; }
    }
  }

  function tekenWolken(ctx, cam, s, p) {
    zorgWolken(s);
    var zoom = p / Game.render.TEGEL;
    for (var i = 0; i < wolken.length; i++) {
      var c = wolken[i];
      var sp = cam.wereldNaarScherm(c.x, c.y);
      var R = c.r * zoom;
      if (sp.x < -R || sp.y < -R || sp.x > cam.breedte + R || sp.y > cam.hoogte + R) continue;
      var g = ctx.createRadialGradient(sp.x, sp.y, R * 0.15, sp.x, sp.y, R);
      g.addColorStop(0, 'rgba(16,20,26,.09)');
      g.addColorStop(1, 'rgba(16,20,26,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(sp.x, sp.y, R, R * 0.5, 0, 0, Math.PI * 2);   /* iso-flattened */
      ctx.fill();
    }
  }

  /* ------------------------------------------------- vogels (B2) --------- */

  function tickVogels(s, dt) {
    if (!vogels) vogels = [];
    vogelKans -= dt;
    if (vogelKans <= 0) {
      vogelKans = 12 + Math.random() * 20;
      if (vogels.length < 2) spawnVlucht(s);
    }
    var m = 12 * Game.render.TEGEL;
    var W = s.kaart.b * Game.render.TEGEL, H = s.kaart.h * Game.render.TEGEL;
    for (var i = vogels.length - 1; i >= 0; i--) {
      var f = vogels[i];
      f.x += f.vx * dt; f.y += f.vy * dt; f.klap += dt * 11;
      if (f.x < -m || f.x > W + m || f.y < -m || f.y > H + m) vogels.splice(i, 1);
    }
  }

  function spawnVlucht(s) {
    var W = s.kaart.b * Game.render.TEGEL, H = s.kaart.h * Game.render.TEGEL;
    var links = Math.random() < 0.5;
    vogels.push({
      x: links ? -6 * Game.render.TEGEL : W + 6 * Game.render.TEGEL,
      y: Math.random() * H,
      vx: (links ? 1 : -1) * (16 + Math.random() * 10),
      vy: (Math.random() - 0.5) * 8,
      n: 3 + Math.floor(Math.random() * 4),
      klap: Math.random() * 6.28
    });
  }

  function tekenVogels(ctx, cam, s, p) {
    if (!vogels || !vogels.length || p < 12) return;
    ctx.strokeStyle = 'rgba(38,42,50,.6)';
    ctx.lineWidth = Math.max(1, p * 0.028);
    ctx.lineCap = 'round';
    for (var i = 0; i < vogels.length; i++) {
      var f = vogels[i];
      var dir = f.vx >= 0 ? 1 : -1;
      for (var k = 0; k < f.n; k++) {
        var back = k;
        var side = (k % 2 === 0 ? 1 : -1) * Math.ceil(k / 2);
        var wx = f.x - dir * back * Game.render.TEGEL * 0.8;
        var wy = f.y + side * Game.render.TEGEL * 0.6;
        var sp = cam.wereldNaarScherm(wx, wy);
        sp.y -= p * 1.6;                                   /* lift into the sky */
        if (sp.x < -20 || sp.y < -20 || sp.x > cam.breedte + 20 || sp.y > cam.hoogte + 20) continue;
        var flap = Math.sin(f.klap + k * 0.7) * p * 0.05;
        ctx.beginPath();
        ctx.moveTo(sp.x - p * 0.06, sp.y + flap);
        ctx.lineTo(sp.x, sp.y - flap * 0.6);
        ctx.lineTo(sp.x + p * 0.06, sp.y + flap);
        ctx.stroke();
      }
    }
  }

  /* ------------------------------------------------- weer (B3) ----------- */

  function spawnWeer(s, cam) {
    if (!Game.render.particles) return;
    var soort = s.seizoen === 2 ? 'blad' : (s.seizoen === 3 ? 'sneeuw' : null);
    if (!soort) { weerAccu = 0; return; }
    if (weerAccu < 0.09) return;
    weerAccu = 0;
    var zicht = cam.zichtbaar(s.kaart);
    var TEGEL = Game.render.TEGEL;
    for (var k = 0; k < 3; k++) {
      var tx = zicht.x0 - 2 + Math.random() * (zicht.x1 - zicht.x0 + 2);
      var ty = zicht.y0 - 2 + Math.random() * (zicht.y1 - zicht.y0 + 2);
      Game.render.particles.weer(soort, tx * TEGEL, ty * TEGEL);
    }
  };

  /* Advance the age-up wave and puff dust off each building as it passes. */
  function tickSweep(s, dt) {
    if (!sweep.actief) return;
    sweep.t += dt;
    var front = sweep.t / sweep.duur;
    var TEGEL = Game.render.TEGEL, breedte = s.kaart.b;
    for (var i = 0; i < s.gebouwen.length; i++) {
      var g = s.gebouwen[i];
      if (!g.gebouwd) continue;
      var d = Game.core.state.def(g);
      var fx = (g.x + d.grootte / 2) / breedte;
      if (fx <= front && !sweep.gepoft[g.id]) {
        sweep.gepoft[g.id] = true;
        if (Game.render.particles) {
          Game.render.particles.stof((g.x + d.grootte / 2) * TEGEL, (g.y + d.grootte / 2) * TEGEL, 5 + d.grootte * 2);
        }
      }
    }
    if (sweep.t >= sweep.duur) sweep.actief = false;
  }

  /* Ambient smoke/dust off active production buildings — bakery, smithy,
     quarry — a few puffs a second, purely cosmetic. */
  function tickWerkrook(s, dt) {
    if (!Game.render.particles) return;
    rookTimer -= dt;
    if (rookTimer > 0) return;
    rookTimer = 0.55;
    var TEGEL = Game.render.TEGEL;
    for (var i = 0; i < s.gebouwen.length; i++) {
      var g = s.gebouwen[i];
      if (!g.gebouwd || g.uit || g.waarschuwing) continue;
      var d = Game.core.state.def(g);

      /* Cosy hearth smoke from homes / inns / bakery — no workers required,
         kept sparse (a chance per cycle) so a large town never floods the
         particle budget. */
      if ((d.woonruimte || g.type === 'herberg' || g.type === 'bakkerij') && Math.random() < 0.22) {
        var hx = (g.x + d.grootte * 0.62) * TEGEL, hy = (g.y + d.grootte * 0.22) * TEGEL;
        Game.render.particles.emit('rook', hx, hy, 1, { grootte: 0.62, levenSchaal: 1.3, spreiding: 2, begin: 0.2 });
      }

      /* Work smoke / sparks / dust only when the workplace is staffed. */
      if (g.werkers <= 0) continue;
      var cx = (g.x + d.grootte * 0.66) * TEGEL, cy = (g.y + d.grootte * 0.2) * TEGEL;
      if (d.maakt && (d.id === 'bakkerij' || d.id === 'smederij' || d.id === 'wapensmid')) {
        Game.render.particles.rook(cx, cy, 1);
        if (d.id !== 'bakkerij') Game.render.particles.vonken(cx, cy, 1);
      } else if (d.wint && (d.wint.node === 'steen' || d.wint.node === 'ijzer' ||
                 d.wint.node === 'koper' || d.wint.node === 'edelsteen')) {
        Game.render.particles.stof((g.x + d.grootte / 2) * TEGEL, (g.y + d.grootte * 0.7) * TEGEL, 1);
      }
    }
  }

  /* Fade the raid scorch on damaged buildings; a plain state field so it
     survives saves as JSON. */
  function vervaagSchroei(s, dt) {
    for (var i = 0; i < s.gebouwen.length; i++) {
      var g = s.gebouwen[i];
      if (g.geschroeid > 0) {
        g.geschroeid -= dt;
        if (g.geschroeid <= 0) delete g.geschroeid;
      }
    }
  }

  /* Scaffolding overlay on the buildings the sweep front is passing over. */
  function tekenSweep(s, cam, p) {
    if (!sweep.actief) return;
    var front = sweep.t / sweep.duur;
    var breedte = s.kaart.b, TEGEL = Game.render.TEGEL;
    for (var i = 0; i < s.gebouwen.length; i++) {
      var g = s.gebouwen[i];
      if (!g.gebouwd) continue;
      var d = Game.core.state.def(g);
      var fx = (g.x + d.grootte / 2) / breedte;
      var afst = front - fx;
      if (afst < 0 || afst > 0.16) continue;         /* only the active band */
      var sp = cam.wereldNaarScherm(g.x * TEGEL, g.y * TEGEL);
      var foot = Game.render.diamant(sp.x, sp.y, p * d.grootte);
      var Hh = p * d.grootte * 0.6;
      var alpha = 0.55 * (1 - afst / 0.16);
      ctx.strokeStyle = 'rgba(190,150,90,' + alpha.toFixed(3) + ')';
      ctx.lineWidth = Math.max(1, p * 0.05);
      ctx.beginPath();
      /* poles at the footprint corners */
      [foot.left, foot.right, foot.top, foot.bottom].forEach(function (c) {
        ctx.moveTo(c.x, c.y); ctx.lineTo(c.x, c.y - Hh);
      });
      /* a scaffolding ring at mid height */
      var m = Hh * 0.55;
      ctx.moveTo(foot.left.x, foot.left.y - m); ctx.lineTo(foot.top.x, foot.top.y - m);
      ctx.lineTo(foot.right.x, foot.right.y - m); ctx.lineTo(foot.bottom.x, foot.bottom.y - m);
      ctx.closePath();
      ctx.stroke();
    }
  }

  /* Is the mouse over this building's footprint? Pointing at a thing should
     look like pointing at it, not only feel like it after the click. */
  function onderMuis(ui, g, d) {
    if (!ui.muisTegel || ui.plaatsType) return false;
    return ui.muisTegel.x >= g.x && ui.muisTegel.x < g.x + d.grootte &&
           ui.muisTegel.y >= g.y && ui.muisTegel.y < g.y + d.grootte;
  }

  /* One building, from a depth-sorted entry: body (or construction site),
     raid warning, and selection outline. */
  function tekenGebouwEntry(ctx, cam, s, ui, g, d, p, tijd) {
    var sp2 = cam.wereldNaarScherm(g.x * Game.render.TEGEL, g.y * Game.render.TEGEL);
    var gekozen = ui.geselecteerd === g.id;
    var gewezen = onderMuis(ui, g, d);

    /* A warm pool of light on the ground under the building you have selected
       — the dashed outline alone gets lost in a crowded street. */
    if (gekozen || gewezen) {
      var gd = Game.render.diamant(sp2.x, sp2.y, p * d.grootte);
      var straal = gd.hw * 1.35;
      var gl = ctx.createRadialGradient(gd.cx, gd.cy, straal * 0.2, gd.cx, gd.cy, straal);
      var sterkte = gekozen ? 0.34 : 0.16;
      gl.addColorStop(0, 'rgba(240,205,127,' + sterkte + ')');
      gl.addColorStop(1, 'rgba(240,205,127,0)');
      ctx.fillStyle = gl;
      ctx.beginPath();
      ctx.ellipse(gd.cx, gd.cy, straal, straal * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    if (g.gebouwd) {
      sprites.tekenGebouw(ctx, d, sp2.x, sp2.y, p, d.grootte,
        { tijd: tijd, tijdperk: s.tijdperk, geschroeid: g.geschroeid,
          seizoen: s.seizoen, zaad: g.id });
      if (g.waarschuwing && p > 16) {
        var fc = Game.render.diamant(sp2.x, sp2.y, p * d.grootte);
        ctx.font = Math.round(p * 0.34) + 'px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚠️', fc.cx, fc.cy - p * (0.6 + d.grootte * 0.5));
      }
    } else {
      sprites.tekenBouwplaats(ctx, d, sp2.x, sp2.y, p, d.grootte, g.voortgang / d.bouwtijd);
    }

    if (gekozen) {
      var sd = Game.render.diamant(sp2.x, sp2.y, p * d.grootte);
      /* Marching ants: the dashes crawl around the footprint, which separates
         "this one is selected" from "this one happens to be outlined". */
      ctx.save();
      ctx.strokeStyle = 'rgba(20,13,6,.5)';
      ctx.lineWidth = 4;
      Game.render.padDiamant(ctx, sd);
      ctx.stroke();
      ctx.strokeStyle = '#f6d896';
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 5]);
      /* Real time, not game time: the ants keep crawling while paused. */
      ctx.lineDashOffset = -(Date.now() * 0.02) % 12;
      Game.render.padDiamant(ctx, sd);
      ctx.stroke();
      ctx.restore();
    } else if (gewezen) {
      var hd = Game.render.diamant(sp2.x, sp2.y, p * d.grootte);
      ctx.strokeStyle = 'rgba(240,205,127,.55)';
      ctx.lineWidth = 1.5;
      Game.render.padDiamant(ctx, hd);
      ctx.stroke();
    }
  }

  /* One decorative walker at a precomputed route position: a procedural
     villager (js/render/villagers.js) whose gait is driven by distance walked,
     not the clock, so it strides at any game speed instead of vibrating. */
  function tekenWandelaar(ctx, cam, s, p, w, pos) {
    var sp = cam.wereldNaarScherm(pos.x * Game.render.TEGEL, pos.y * Game.render.TEGEL);
    if (sp.x < -20 || sp.y < -20 || sp.x > cam.breedte + 20 || sp.y > cam.hoogte + 20) return;

    var kijk = (pos.dx * w.richting) >= 0 ? 1 : -1;
    var wandelt = !(w.wachtT > 0);
    var stapFase = (w.afgelegd || 0) * 7.5 + w.fase * 6.28;

    var opties = {};
    /* Working: standing still at the resource end with a tool in hand. */
    if (w.werkt && !wandelt && w.p >= 1) opties.werktFase = (w.klok || 0) * 5.5;
    /* Loaded: on the leg of the trip where this job hauls something. */
    var geladen = w.draagtOp === 'heen' ? (w.richting > 0) : (w.richting < 0);
    if (w.draagt && geladen && p > 20) opties.draagt = w.draagt;

    Game.render.villagers.teken(ctx, sp.x, sp.y, p, w.baan, kijk, stapFase, wandelt, opties);
  }

  /* Highlights the resource tiles a building needs while you are placing it. */
  function markeerBronnen(s, cam, ui, p) {
    var d = Game.config.gebouw(ui.plaatsType);
    if (!d || !d.plaats || !d.plaats.nabij) return;
    var node = d.plaats.nabij.node;
    var zicht = cam.zichtbaar(s.kaart);

    ctx.fillStyle = 'rgba(240,205,127,.28)';
    for (var y = zicht.y0; y < zicht.y1; y++) {
      for (var x = zicht.x0; x < zicht.x1; x++) {
        var t = map.tegel(s.kaart, x, y);
        if (!t || t.n !== node || t.amt <= 0) continue;
        var sp = cam.wereldNaarScherm(x * Game.render.TEGEL, y * Game.render.TEGEL);
        Game.render.padDiamant(ctx, Game.render.diamant(sp.x, sp.y, p));
        ctx.fill();
      }
    }
  }

  function tekenSpook(s, cam, ui, p) {
    var TEGEL = Game.render.TEGEL;
    var d = Game.config.gebouw(ui.plaatsType);
    var tx = ui.muisTegel.x, ty = ui.muisTegel.y;

    /* While a row is being dragged out, show every tile it would fill. */
    if (ui.lijn) { tekenLijn(s, cam, ui, p); return; }

    var bezig = ui.verplaatst ? Game.core.state.gebouw(s, ui.verplaatst) : null;
    var check = bezig
      ? Game.core.construction.controleerVerplaatsing(s, bezig, tx, ty)
      : Game.core.construction.controleer(s, ui.plaatsType, tx, ty);
    var sp = cam.wereldNaarScherm(tx * TEGEL, ty * TEGEL);
    var foot = Game.render.diamant(sp.x, sp.y, p * d.grootte);

    /* Footprint patch, tinted by whether it can be placed here. */
    Game.render.padDiamant(ctx, foot);
    ctx.fillStyle = check.ok ? 'rgba(143,220,106,.2)' : 'rgba(224,96,74,.24)';
    ctx.fill();
    ctx.strokeStyle = check.ok ? '#8fdc6a' : '#e0604a';
    ctx.lineWidth = 2;
    ctx.stroke();

    /* Translucent preview of the building itself. */
    ctx.globalAlpha = 0.6;
    sprites.tekenGebouw(ctx, d, sp.x, sp.y, p, d.grootte, { tijd: s.tijd, tijdperk: s.tijdperk, seizoen: s.seizoen });
    ctx.globalAlpha = 1;

    if (d.plaats && d.plaats.nabij) {
      var straal = d.plaats.nabij.straal;
      var rsp = cam.wereldNaarScherm((tx - straal) * TEGEL, (ty - straal) * TEGEL);
      ctx.strokeStyle = check.ok ? 'rgba(143,220,106,.5)' : 'rgba(224,96,74,.5)';
      ctx.setLineDash([5, 5]);
      Game.render.padDiamant(ctx, Game.render.diamant(rsp.x, rsp.y, p * (d.grootte + straal * 2)));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    /* Defence buildings show their coverage radius (an iso ground ellipse). */
    if (d.dekking && d.dekking.straal) {
      var dr = d.dekking.straal;
      ctx.strokeStyle = 'rgba(120,180,240,.55)';
      ctx.fillStyle = 'rgba(120,180,240,.10)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.ellipse(foot.cx, foot.cy, dr * p, dr * p * 0.5, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.setLineDash([]);
    }

    ui.plaatsCheck = check;
  }

  /* The preview of a shift-dragged row: a footprint per tile, tinted by
     whether that particular tile would take the building. */
  function tekenLijn(s, cam, ui, p) {
    var TEGEL = Game.render.TEGEL;
    var l = ui.lijn;
    var stapX = Math.sign(l.x1 - l.x0), stapY = Math.sign(l.y1 - l.y0);
    var aantal = Math.max(Math.abs(l.x1 - l.x0), Math.abs(l.y1 - l.y0)) + 1;

    for (var i = 0; i < aantal; i++) {
      var x = l.x0 + stapX * i, y = l.y0 + stapY * i;
      var check = Game.core.construction.controleer(s, ui.plaatsType, x, y);
      var sp = cam.wereldNaarScherm(x * TEGEL, y * TEGEL);
      var foot = Game.render.diamant(sp.x, sp.y, p);
      Game.render.padDiamant(ctx, foot);
      ctx.fillStyle = check.ok ? 'rgba(143,220,106,.22)' : 'rgba(224,96,74,.24)';
      ctx.fill();
      ctx.strokeStyle = check.ok ? '#8fdc6a' : '#e0604a';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  R.tegelInfo = function (s, tx, ty) {
    var t = map.tegel(s.kaart, tx, ty);
    if (!t) return '';
    var tekst = map.terreinNaam[t.t];
    if (t.n && t.amt > 0 && t.amt < map.ONEINDIG) {
      tekst += ' — ' + map.nodeNaam[t.n] + ' (' + Math.round(t.amt) + ')';
    } else if (t.n && t.amt >= map.ONEINDIG) {
      tekst += ' — ' + map.nodeNaam[t.n];
    } else if (t.n && t.amt <= 0) {
      tekst += ' — uitgeput';
    }
    return tekst;
  };

  Game.render.renderer = R;

})(window.Game);
