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

  /* The state of the light this frame (js/render/sfeer.js). Worked out once at
     the top of R.teken instead of per building: half the drawing wants to know
     how dark it is, and sfeer.licht is pure maths on s.tijd. */
  var licht = null;

  /* Scratch for sprites.deelPositie, so enumerating a few thousand trees a
     frame allocates nothing. Read and used immediately, never held. */
  var deelSchets = { dx: 0, dy: 0 };

  /* Ambient world life, all real-time and never stored in Game.state:
       - wolken: a few soft shadow blobs drifting over the ground (B5)
       - vogels: the odd flock crossing the sky (B2)
       - weerAccu: throttles the seasonal leaf/snow emitter (B3) */
  var wolken = null;
  var vogels = null;
  var weerAccu = 0;
  var vogelKans = 0;

  /* The decorative walkers. Kept here in the render layer (like props and
     wildlife) rather than in Game.state: they carry no simulation weight, so a
     save has no business storing them and stays smaller and purely JSON. */
  var wandelaars = [];
  R.wandelaars = function () { return wandelaars; };
  var ontmoetTimer = 0;

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
    /* The era just reached, for the parchment banner (fase 7.2). */
    var age = Game.config.ages[Game.util.clamp(s.tijdperk - 1, 0, Game.config.ages.length - 1)];
    sweep.naam = age ? age.naam : '';
    sweep.emoji = age ? age.emoji : '';
    sweep.nr = s.tijdperk;
    R.schok(4);
    R.flits('225,190,110');
  };

  /* ------------------------------------------------------- wandelaars ---- */

  var BEW = function () { return Game.render.beweging; };

  /* Decorative villagers walking their building's road to a resource and back,
     builders on the sites, soldiers on patrol and children by the square. They
     carry no simulation weight. Rebuilt by reconciliation (not from scratch) so
     nobody teleports when the list refreshes. */
  R.verversWandelaars = function (s) {
    var oud = {};
    for (var k = 0; k < wandelaars.length; k++) oud[wandelaars[k].sleutel] = wandelaars[k];

    var plein = s.gebouwen.filter(function (g) { return g.type === 'dorpsplein'; })[0];
    var pleinX = plein ? plein.x + 1 : (s.start ? s.start.x : s.kaart.b / 2);
    var pleinY = plein ? plein.y + 1 : (s.start ? s.start.y : s.kaart.h / 2);

    /* A busier town has more life on its streets, tied to population and not
       just to filled workplaces. */
    var drukte = Game.util.clamp(1 + Math.floor((s.bevolking.totaal || 0) / 14), 1, 4);
    var lijst = [];
    var limiet = 90;

    /* Cohort mix, so the street reads as the register: mostly grown-ups, a few
       elderly, and children milling near the square. */
    var bev = s.bevolking || {};
    var handen = Math.max(1, (bev.volwassenen || 0) + (bev.ouderen || 0));
    var oudDeel = Game.util.clamp((bev.ouderen || 0) / handen, 0, 0.6);

    for (var i = 0; i < s.gebouwen.length && lijst.length < limiet; i++) {
      var g = s.gebouwen[i];
      if (!g.gebouwd) {
        /* Fase 2.1: a construction site the crew is working pulls builders. */
        if (bouwtActief(s, g)) maakBouwers(s, g, oud, lijst, limiet);
        continue;
      }
      var d = Game.core.state.def(g);
      if (!d.banen || g.werkers <= 0) continue;

      /* Fase 5.1: soldiers patrol the walls instead of running errands. */
      if (d.banen.baan === 'soldaat') { maakPatrouille(s, g, d, oud, lijst, limiet); continue; }

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
      var opStraat = !!route.straat;

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
          bestaand.werkTempo = g.ervaring || 0;
          bestaand.straat = opStraat;
          lijst.push(bestaand);
        } else {
          var nw = nieuweWandelaar(sleutel, route, lengte, d.banen.baan, {
            draagt: draagt, draagtOp: draagtOp, werkt: !!d.wint, werkTempo: g.ervaring || 0,
            cohort: (hash1(g.id * 7 + n * 13) < oudDeel) ? 'oud' : 'volwassen'
          }, g.id * 7 + n * 13);
          nw.straat = opStraat;
          lijst.push(nw);
        }
      }
    }

    /* Fase 2.5 + 2.6: children playing near the square. */
    maakKinderen(s, pleinX, pleinY, oud, lijst, limiet);

    wandelaars = lijst;
    /* No longer stored in the save; kept off Game.state on purpose. */
    if (s.wandelaars) delete s.wandelaars;
  };

  /* A stable pseudo-random in [0,1) from an integer seed. */
  function hash1(n) { var x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); }

  /* One fresh walker with the steering + state-machine fields. */
  function nieuweWandelaar(sleutel, route, lengte, baan, opt, seed) {
    opt = opt || {};
    return {
      sleutel: sleutel,
      route: route,
      routeLen: lengte,
      baan: baan,
      soort: opt.soort || 'dorp',
      cohort: opt.cohort || 'volwassen',
      p: opt.p != null ? opt.p : Game.render.rng(),
      richting: Game.render.rng() < 0.5 ? 1 : -1,
      rond: !!opt.rond,                 /* patrols loop instead of bouncing */
      /* Constant *world* speed (tiles/sec): long and short routes walk at the
         same pace instead of the old fraction-per-second. */
      snelheidT: (opt.snelheidT || 0.55) + Game.render.rng() * 0.35,
      snelheid: 0,                      /* eased by the steering model */
      koers: 0,
      draagt: opt.draagt || null,
      draagtOp: opt.draagtOp || 'terug',
      werkt: !!opt.werkt,               /* gatherers actually work at the far end */
      werkTempo: opt.werkTempo || 0,    /* 0..1 from g.ervaring: a skilled crew works visibly quicker */
      bezig: BEW().LOPEN,
      toestandT: 0,
      klok: Game.render.rng() * 6.28,
      afgelegd: Game.render.rng() * 6,      /* seeds the gait so feet aren't in lockstep */
      verborgen: false,
      /* A fixed lateral offset so walkers of one building don't share a line. */
      zijoffset: 0.1 + hash1((seed || 0) + 3) * 0.14,
      fase: ((seed || 0) * 1 % 100) / 100
    };
  }

  /* Total length of a route in tile units, for constant-speed walking. */
  function routeLengte(route) {
    var t = 0;
    for (var i = 0; i < route.length - 1; i++) {
      var dx = route[i + 1].x - route[i].x, dy = route[i + 1].y - route[i].y;
      t += Math.sqrt(dx * dx + dy * dy);
    }
    return t || 1e-6;
  }

  /* --- fase 2.1: builders on an active construction site --- */

  function bouwtActief(s, g) {
    if (g.gebouwd) return false;
    if (Game.core.raids && Game.core.raids.bouwStilgelegd && Game.core.raids.bouwStilgelegd(s)) return false;
    /* Only the sites the crew is actually working (construction.PLOEGEN caps
       how many at once) draw builders. voortgang creeping up is the tell. */
    return (g.voortgang || 0) > 0.01 || !!g.actief;
  }

  function maakBouwers(s, g, oud, lijst, limiet) {
    var d = Game.core.state.def(g);
    var cx = g.x + d.grootte / 2, cy = g.y + d.grootte / 2;
    /* Shuttle between a material stack just outside a corner and the scaffold. */
    var stapel = { x: g.x - 0.4, y: g.y + d.grootte + 0.3 };
    var steiger = { x: cx, y: cy };
    var route = [stapel, steiger];
    var lengte = routeLengte(route);
    var aantal = 2 + (d.grootte >= 2 ? 1 : 0);
    /* Carry the stuff the building is made of, toward the scaffold. */
    var last = null;
    for (var kr in (d.kosten || {})) { last = kr; break; }
    for (var n = 0; n < aantal && lijst.length < limiet; n++) {
      var sleutel = 'b' + g.id + ':' + n;
      var bestaand = oud[sleutel];
      if (bestaand) { bestaand.route = route; bestaand.routeLen = lengte; lijst.push(bestaand); }
      else lijst.push(nieuweWandelaar(sleutel, route, lengte, 'bouwer', {
        soort: 'bouwer', werkt: true, snelheidT: 0.6, draagt: last, draagtOp: 'heen'
      }, g.id * 17 + n * 5));
    }
  }

  /* --- fase 5.1: a patrol loop for soldiers --- */

  function maakPatrouille(s, g, d, oud, lijst, limiet) {
    var route = patrouilleRoute(s, g, d);
    var lengte = routeLengte(route);
    var aantal = Math.min(3, g.werkers);
    for (var n = 0; n < aantal && lijst.length < limiet; n++) {
      var sleutel = 'p' + g.id + ':' + n;
      var bestaand = oud[sleutel];
      if (bestaand) { bestaand.route = route; bestaand.routeLen = lengte; bestaand.rond = true; lijst.push(bestaand); }
      else lijst.push(nieuweWandelaar(sleutel, route, lengte, 'soldaat', {
        rond: true, snelheidT: 0.5, p: n / Math.max(1, aantal)
      }, g.id * 23 + n * 9));
    }
  }

  /* A closed loop from the barracks along the nearest few pieces of positional
     cover on the side the last raid came from, then back. */
  function patrouilleRoute(s, g, d) {
    var mid = d.grootte / 2;
    var start = { x: g.x + mid, y: g.y + mid };
    var vanaf = s.raid && s.raid.vanaf ? s.raid.vanaf : { x: s.kaart.b / 2, y: 0 };
    var muren = [];
    for (var i = 0; i < s.gebouwen.length; i++) {
      var b = s.gebouwen[i];
      if (!b.gebouwd) continue;
      var bd = Game.core.state.def(b);
      if (!bd.dekking || !bd.dekking.straal || !bd.verdediging) continue;
      var bm = bd.grootte / 2;
      var bx = b.x + bm, by = b.y + bm;
      /* Prefer cover that sits toward the invasion side. */
      var richting = (bx - start.x) * (vanaf.x - start.x) + (by - start.y) * (vanaf.y - start.y);
      muren.push({ x: bx, y: by, d: (bx - start.x) * (bx - start.x) + (by - start.y) * (by - start.y), bias: richting });
    }
    muren.sort(function (a, b) { return (a.d - a.bias * 0.4) - (b.d - b.bias * 0.4); });
    var route = [start];
    for (var m = 0; m < muren.length && route.length < 4; m++) route.push({ x: muren[m].x, y: muren[m].y });
    if (route.length < 2) {
      /* No walls yet: pace toward the edge the raiders favour and back. */
      route.push({ x: start.x + (vanaf.x - start.x) * 0.3, y: start.y + (vanaf.y - start.y) * 0.3 });
    }
    return route;
  }

  /* --- fase 2.5: children milling by the square --- */

  function maakKinderen(s, px, py, oud, lijst, limiet) {
    var n = Game.util.clamp(Math.floor((s.bevolking.kinderen || 0) / 2), 0, 6);
    for (var i = 0; i < n && lijst.length < limiet; i++) {
      var a = (i / Math.max(1, n)) * Math.PI * 2;
      var r = 1.4 + (i % 3) * 0.7;
      var route = [
        { x: px + Math.cos(a) * r, y: py + Math.sin(a) * r },
        { x: px + Math.cos(a + 2) * r, y: py + Math.sin(a + 2) * r }
      ];
      var sleutel = 'k' + i;
      var bestaand = oud[sleutel];
      if (bestaand) { bestaand.route = route; bestaand.routeLen = routeLengte(route); lijst.push(bestaand); }
      else lijst.push(nieuweWandelaar(sleutel, route, routeLengte(route), 'werkloos', {
        soort: 'kind', cohort: 'kind', snelheidT: 0.7
      }, 900 + i * 11));
    }
  }

  /* Advance every walker on the steering model: they accelerate away from a
     stop, brake into the next one, and turn toward the route rather than
     snapping. `bezig` says what they are doing (walking, working, resting…). */
  R.tickWandelaars = function (s, dt) {
    var bew = BEW();
    /* Fase 2.6: how much of the town is out and about, following the sun. */
    var L = Game.render.sfeer ? Game.render.sfeer.licht(s) : { dag: 1 };
    var actief = 0.4 + 0.6 * L.dag;

    for (var i = 0; i < wandelaars.length; i++) {
      var w = wandelaars[i];
      w.klok = (w.klok || 0) + dt;

      /* Day rhythm: at dusk a share of the townsfolk head home and vanish;
         at dawn they come back. Children and patrols keep their own hours. */
      var welkom = w.soort === 'kind' || w.baan === 'soldaat' || (w.fase < actief);
      if (!welkom && w.bezig !== bew.HUISWAARTS && !w.verborgen) w.bezig = bew.HUISWAARTS;
      if (welkom && (w.verborgen || w.bezig === bew.HUISWAARTS)) { w.verborgen = false; if (w.bezig === bew.HUISWAARTS) w.bezig = bew.LOPEN; }
      if (w.verborgen) continue;

      /* In a stationary state: run its clock, emit work particles, then move on. */
      if (w.bezig !== bew.LOPEN && w.bezig !== bew.HUISWAARTS) {
        w.snelheid = Math.max(0, w.snelheid - bew.VERSNEL * dt);
        w.toestandT -= dt;
        if ((w.bezig === bew.WERKEN) && Game.render.particles) werkDeeltjes(s, w, dt);
        if (w.toestandT <= 0) { w.bezig = bew.LOPEN; w.richting = (w.p >= 1 ? -1 : 1); }
        continue;
      }

      var len = w.routeLen || 1;
      /* Ease speed toward cruise, but brake as we near a route end (LOPEN only;
         a HUISWAARTS walker keeps pace until it is home). */
      var restT = w.richting > 0 ? (1 - w.p) : w.p;      /* fraction of route left */
      var nabij = Game.util.clamp(restT * len / 0.8, 0.25, 1);   /* slow in the last ~0.8 tile */
      var doelSnel = w.snelheidT * (w.rond ? 1 : nabij) * (w.straat ? 1.2 : 1);
      bew.stuur(w, headingVan(w), doelSnel, dt);
      var stap = w.snelheid * dt;
      w.p += (w.richting * stap) / len;
      w.afgelegd = (w.afgelegd || 0) + stap;

      if (w.p >= 1) {
        if (w.rond) { w.p -= 1; }                        /* patrols wrap and keep going */
        else { w.p = 1; w.richting = -1; enterToestand(s, w, bew, true); }
      } else if (w.p <= 0) {
        w.p = 0;
        if (w.bezig === bew.HUISWAARTS) { w.verborgen = true; continue; }
        w.richting = 1; enterToestand(s, w, bew, false);
      }
    }

    /* Fase 2.7: two walkers passing close may stop for a chat. Throttled and
       bucketed on a coarse tile grid so it never becomes O(n²). */
    ontmoetTimer -= dt;
    if (ontmoetTimer <= 0) { ontmoetTimer = 0.5; ontmoetingen(s, bew); }
  };

  /* Bucket the walking figures by tile and let close pairs strike up a chat. */
  function ontmoetingen(s, bew) {
    var raster = {};
    for (var i = 0; i < wandelaars.length; i++) {
      var w = wandelaars[i];
      if (w.verborgen || w.bezig !== bew.LOPEN) continue;
      var pos = wandelaarPositie(w);
      w._ex = pos.x; w._ey = pos.y;
      var sleutel = Math.round(pos.x) + ',' + Math.round(pos.y);
      var bak = raster[sleutel] || (raster[sleutel] = []);
      for (var j = 0; j < bak.length; j++) {
        var o = bak[j];
        var dx = o._ex - pos.x, dy = o._ey - pos.y;
        if (dx * dx + dy * dy < 0.25 && Game.render.rng() < 0.35) {
          w.bezig = bew.PRATEN; w.toestandT = bew.duur(bew.PRATEN);
          o.bezig = bew.PRATEN; o.toestandT = w.toestandT;
        }
      }
      bak.push(w);
    }
  }

  /* The heading (tile-space angle) a walker should steer toward: the tangent of
     its route at the current point, signed by travel direction. */
  function headingVan(w) {
    var pos = langsRoute(w.route, Game.util.clamp(w.p, 0, 1));
    var dx = pos.dx, dy = pos.dy != null ? pos.dy : 0;
    if (w.richting < 0) { dx = -dx; dy = -dy; }
    return Math.atan2(dy || 0, dx || (w.richting >= 0 ? 1 : -1));
  }

  /* Pick the state a walker drops into on reaching a route end. */
  function enterToestand(s, w, bew, verEind) {
    if (w.soort === 'bouwer') { w.bezig = verEind ? bew.WERKEN : bew.LADEN; w.toestandT = bew.duur(w.bezig); return; }
    if (w.soort === 'kind') { w.bezig = Game.render.rng() < 0.5 ? bew.RUSTEN : bew.PRATEN; w.toestandT = bew.duur(w.bezig); return; }
    /* Gatherers work at the resource (far end). Crafters (draagtOp 'heen') carry
       goods out and come home to their bench — that homecoming is their work
       stroke, so a baker or a smith visibly does something too (fase 2.4). */
    if (verEind && w.werkt) { w.bezig = bew.WERKEN; w.toestandT = bew.duur(bew.WERKEN); return; }
    if (!verEind && w.draagtOp === 'heen') { w.bezig = bew.WERKEN; w.toestandT = bew.duur(bew.WERKEN); return; }
    w.bezig = verEind ? bew.LADEN : bew.LOSSEN;
    w.toestandT = bew.duur(w.bezig);
  }

  /* A few particles on every downstroke of the tool, matched to the trade:
     wood chips, a splash, or rock dust. */
  function werkDeeltjes(s, w, dt) {
    if (!Game.render.particles) return;
    w.slagTimer = (w.slagTimer || 0) - dt;
    if (w.slagTimer > 0) return;
    w.slagTimer = 0.55;
    var hier = langsRoute(w.route, Game.util.clamp(w.p, 0, 1));
    var wx = hier.x * Game.render.TEGEL, wy = hier.y * Game.render.TEGEL;
    if (w.draagt === 'hout') {
      Game.render.particles.emit('stof', wx, wy, 2, { spreiding: 5, kleur: '196,158,96', grootte: 0.7 });
    } else if (w.draagt === 'vlees') {
      Game.render.particles.emit('stof', wx, wy, 1, { spreiding: 5, kleur: '150,170,140', grootte: 0.6 });
    } else {
      Game.render.particles.emit('stof', wx, wy, 2, { spreiding: 4, grootte: 0.8 });
    }
  }

  /* Point at fraction `f` (0..1) along a multi-segment route, in tile coords,
     plus the tangent (dx, dy) of the segment it lies on. */
  function langsRoute(route, f) {
    if (route.length === 1) return { x: route[0].x, y: route[0].y, dx: 1, dy: 0 };
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
          dx: b.x - a.x,
          dy: b.y - a.y
        };
      }
      gelopen += lengtes[j];
    }
    var e = route[route.length - 1];
    return { x: e.x, y: e.y, dx: 1, dy: 0 };
  }

  /* Where a walker actually stands: the route point plus a lateral offset along
     the right-hand normal of travel, so the two directions of traffic keep to
     their own side of the lane instead of walking down one line through each
     other (fase 0.3). */
  function wandelaarPositie(w) {
    var pos = langsRoute(w.route, Game.util.clamp(w.p, 0, 1));
    var tx = pos.dx * w.richting, ty = pos.dy * w.richting;
    var len = Math.sqrt(tx * tx + ty * ty) || 1;
    /* Right-hand normal of (tx,ty). */
    var nx = ty / len, ny = -tx / len;
    var off = (w.zijoffset || 0.16);
    return { x: pos.x + nx * off, y: pos.y + ny * off, dx: pos.dx, dy: pos.dy };
  }

  /* ------------------------------------------------------------ tekenen -- */

  R.teken = function (s, cam, ui) {
    if (!ctx) return;
    var p = cam.px();
    licht = Game.render.sfeer ? Game.render.sfeer.licht(s) : null;

    /* Screen shake: offset the whole transform by a decaying jitter. */
    if (schud > 0.05) {
      schudX = (Game.render.rng() - 0.5) * schud;
      schudY = (Game.render.rng() - 0.5) * schud;
    } else { schudX = schudY = 0; }
    ctx.setTransform(dpr, 0, 0, dpr, schudX * dpr, schudY * dpr);
    ctx.clearRect(-4, -4, cam.breedte + 8, cam.hoogte + 8);

    /* Beyond the map edge: the sky fading down into the sea, with the sun or
       moon riding it (fase 3.2). Falls back to a flat deep-sea fill. */
    if (Game.render.sfeer && Game.render.sfeer.tekenHemel) {
      Game.render.sfeer.tekenHemel(ctx, cam, s);
    } else {
      ctx.fillStyle = ['#27506b', '#295473', '#254a64', '#2b4a5e'][s.seizoen];
      ctx.fillRect(-4, -4, cam.breedte + 8, cam.hoogte + 8);
    }

    var zicht = cam.zichtbaar(s.kaart);
    var tijd = s.tijd;

    /* Anchor the terrain textures to the world for this frame (see
       sprites.stelPatronenIn) before anything asks for one. */
    sprites.stelPatronenIn(ctx, cam, s.seizoen);

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

    /* --- one grain over the whole ground, roads included: the ground stops
       being an even fill for the cost of a single blended fillRect. It goes
       here, above the roads and below the map overlay and everything that
       stands up — the overlay is information and the buildings have material
       of their own. --- */
    sprites.tekenKorrel(ctx, cam);

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

    /* Trees and boulders are enumerated one by one rather than per tile: they
       now stand up to half a tile off their tile's centre (sprites.deelPositie),
       so an item has to be sorted where it actually is. Sorting them by their
       tile would put a tree that wandered towards the camera behind the house
       it visibly stands in front of. */
    for (var fy = zicht.y0; fy < zicht.y1; fy++) {
      for (var fx = zicht.x0; fx < zicht.x1; fx++) {
        var ft = map.tegel(s.kaart, fx, fy);
        if (!ft || !sprites.heeftKenmerk(ft)) continue;
        var nDelen = sprites.aantalDelen(ft);
        for (var di = 0; di < nDelen; di++) {
          var off = sprites.deelPositie(ft, di, deelSchets);
          laag.push({ d: fx + fy + 1 + off.dx + off.dy, yy: fy + off.dy,
                      soort: 0, tegel: ft, x: fx, y: fy, deel: di });
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

    /* Low morning fog, laid between the far country and the town (fase 3.4). */
    if (Game.render.weer) Game.render.weer.tekenVoor(ctx, cam, s);

    if (p > 15) {
      for (var wi = 0; wi < wandelaars.length; wi++) {
        var w = wandelaars[wi];
        if (w.verborgen) continue;
        var pos = wandelaarPositie(w);
        if (pos.x < zicht.x0 - 1 || pos.x > zicht.x1 + 1 || pos.y < zicht.y0 - 1 || pos.y > zicht.y1 + 1) continue;
        laag.push({ d: pos.x + pos.y, yy: pos.y, soort: 2, w: w, pos: pos });
      }
    }

    laag.sort(function (a, b) {
      return a.d !== b.d ? a.d - b.d : (a.yy !== b.yy ? a.yy - b.yy : a.soort - b.soort);
    });

    /* Every ground shadow of the terrain features, before any of their bodies.
       They all lie in the same plane, so unlike the things casting them they
       need no sorting among themselves — and going down first means a shadow
       can never land on top of the trunk of a tree drawn earlier in the pass.
       (One path filled once was tried here and measured slower; see the note in
       js/render/sprites.js.) */
    if (p >= 12) {
      sprites.zetLicht(licht);
      for (var si = 0; si < laag.length; si++) {
        var se = laag[si];
        if (se.soort === 0) {
          var ssp = cam.wereldNaarScherm(se.x * TEGEL, se.y * TEGEL);
          sprites.deelSchaduw(ctx, se.tegel, ssp.x, ssp.y, p, se.deel);
        } else if (se.soort === 1 && se.g.gebouwd) {
          /* The yard a building stands in. Here rather than in tekenGebouw
             because it reaches past its own footprint: drawn from inside the
             depth-sorted pass it would paint over the building behind it. */
          var esp = cam.wereldNaarScherm(se.g.x * TEGEL, se.g.y * TEGEL);
          sprites.tekenErf(ctx, se.def, esp.x, esp.y, p, se.def.grootte, se.g.id, s.seizoen);
        }
      }
    }

    for (var li = 0; li < laag.length; li++) {
      var e = laag[li];
      if (e.soort === 0) {
        var fsp = cam.wereldNaarScherm(e.x * TEGEL, e.y * TEGEL);
        sprites.tekenDeel(ctx, e.tegel, fsp.x, fsp.y, p, s.seizoen, tijd, e.deel);
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

    /* --- rain: a cool wash and drizzle over the whole town (fase 3.4) --- */
    if (Game.render.weer) Game.render.weer.tekenNa(ctx, cam, s);

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

    /* --- a parchment banner announcing the new era, over everything --- */
    if (sweep.actief) tekenTijdperkBanier(cam);
  };

  /* The age-up wipe: a strip of parchment unrolls across the middle of the
     screen with the new era's name, holds, and fades — turning a log line into
     a milestone (fase 7.2). */
  function tekenTijdperkBanier(cam) {
    var f = sweep.t / sweep.duur;          /* 0..1 over the sweep */
    var b = cam.breedte, h = cam.hoogte;
    var bh = Math.min(96, h * 0.16);
    var by = h * 0.4;

    /* Unroll in, hold, fade out. */
    var breed = Game.util.clamp(f / 0.22, 0, 1);          /* how far it unrolled */
    var alpha = f < 0.72 ? 1 : Game.util.clamp((1 - f) / 0.28, 0, 1);
    if (alpha <= 0.01) return;
    var bw = b * (0.2 + 0.7 * breed);
    var bx = (b - bw) / 2;

    ctx.save();
    ctx.globalAlpha = alpha;
    /* Parchment strip with rolled ends. */
    var g = ctx.createLinearGradient(0, by, 0, by + bh);
    g.addColorStop(0, '#e8d7ac');
    g.addColorStop(0.5, '#dcc794');
    g.addColorStop(1, '#c9b177');
    ctx.fillStyle = g;
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = '#8a6a3a';
    ctx.fillRect(bx - Math.min(14, bw * 0.03), by - 4, Math.min(14, bw * 0.03), bh + 8);
    ctx.fillRect(bx + bw, by - 4, Math.min(14, bw * 0.03), bh + 8);
    ctx.strokeStyle = 'rgba(120,92,50,.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, bw, bh);

    if (breed > 0.85) {
      ctx.fillStyle = '#4a3418';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '600 ' + Math.round(bh * 0.34) + 'px "Iowan Old Style", Georgia, serif';
      ctx.fillText((sweep.emoji || '') + '  Tijdperk ' + (sweep.nr || '') + '  ' + (sweep.emoji || ''), b / 2, by + bh * 0.36);
      ctx.font = '700 ' + Math.round(bh * 0.42) + 'px "Iowan Old Style", Georgia, serif';
      ctx.fillText(sweep.naam || '', b / 2, by + bh * 0.72);
    }
    ctx.restore();
  }

  /* Real-time bits that are not the fixed simulation: particles, raiders,
     screen shake, the age-up sweep, ambient work smoke and scorch decay. */
  R.tickEffecten = function (s, dt) {
    if (Game.render.particles) Game.render.particles.tick(dt);
    if (Game.render.raiders) Game.render.raiders.tick(s, dt);
    if (schud > 0) schud = Math.max(0, schud - dt * 22);
    if (flits > 0) flits = Math.max(0, flits - dt * 2.2);

    tickSweep(s, dt);
    tickWerkrook(s, dt);
    if (Game.render.weer) Game.render.weer.tick(s, dt);
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
        x: Game.render.rng() * W, y: Game.render.rng() * H,
        r: (5.5 + Game.render.rng() * 4.5) * Game.render.TEGEL,   /* world px */
        vx: 7 + Game.render.rng() * 5, vy: 3 + Game.render.rng() * 4
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
      if (c.x > W + m) { c.x = -m; c.y = Game.render.rng() * H; }
      if (c.y > H + m) { c.y = -m; c.x = Game.render.rng() * W; }
    }
  }

  function tekenWolken(ctx, cam, s, p) {
    zorgWolken(s);
    var zoom = p / Game.render.TEGEL;
    for (var i = 0; i < wolken.length; i++) {
      var c = wolken[i];
      var sp = cam.wereldNaarScherm(c.x, c.y);
      var R = c.r * zoom;
      if (sp.x < -R || sp.y < -R - p * 4 || sp.x > cam.breedte + R || sp.y > cam.hoogte + R) continue;

      /* The shadow on the ground. */
      var g = ctx.createRadialGradient(sp.x, sp.y, R * 0.15, sp.x, sp.y, R);
      g.addColorStop(0, 'rgba(16,20,26,.09)');
      g.addColorStop(1, 'rgba(16,20,26,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(sp.x, sp.y, R, R * 0.5, 0, 0, Math.PI * 2);   /* iso-flattened */
      ctx.fill();

      /* And the cloud itself, lifted above its shadow with a little parallax so
         the motion reads (fase 3.3). A couple of soft lobes, lit by the day. */
      var L = Game.render.sfeer ? Game.render.sfeer.licht(s) : { dag: 1 };
      var licht = 0.14 + 0.16 * (L.dag != null ? L.dag : 1);
      var cy = sp.y - p * 2.6;                     /* parallax lift into the sky */
      var cx = sp.x + p * 0.6;
      for (var k = 0; k < 3; k++) {
        var ox = (k - 1) * R * 0.44, oy = (k === 1 ? -R * 0.16 : 0);
        var cg = ctx.createRadialGradient(cx + ox, cy + oy, R * 0.05, cx + ox, cy + oy, R * 0.6);
        cg.addColorStop(0, 'rgba(245,247,250,' + licht.toFixed(3) + ')');
        cg.addColorStop(1, 'rgba(245,247,250,0)');
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.ellipse(cx + ox, cy + oy, R * 0.6, R * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /* ------------------------------------------------- vogels (B2) --------- */

  function tickVogels(s, dt) {
    if (!vogels) vogels = [];
    vogelKans -= dt;
    if (vogelKans <= 0) {
      vogelKans = 12 + Game.render.rng() * 20;
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
    var links = Game.render.rng() < 0.5;
    vogels.push({
      x: links ? -6 * Game.render.TEGEL : W + 6 * Game.render.TEGEL,
      y: Game.render.rng() * H,
      vx: (links ? 1 : -1) * (16 + Game.render.rng() * 10),
      vy: (Game.render.rng() - 0.5) * 8,
      n: 3 + Math.floor(Game.render.rng() * 4),
      klap: Game.render.rng() * 6.28
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
      var tx = zicht.x0 - 2 + Game.render.rng() * (zicht.x1 - zicht.x0 + 2);
      var ty = zicht.y0 - 2 + Game.render.rng() * (zicht.y1 - zicht.y0 + 2);
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

      /* Cosy hearth smoke, anchored to the chimney on the roof. In winter
         (economy.brandhout is burning timber then) every inhabited home smokes;
         the rest of the year it stays sparse so a big town never floods the
         particle budget. */
      var thuis = d.woonruimte || g.type === 'herberg' || g.type === 'bakkerij';
      var winterHaard = s.seizoen === 3 && d.woonruimte;
      if (thuis && (winterHaard ? Game.render.rng() < 0.5 : Game.render.rng() < 0.22)) {
        var hx = (g.x + d.grootte * 0.62) * TEGEL, hy = (g.y + d.grootte * 0.30) * TEGEL;
        Game.render.particles.emit('rook', hx, hy, 1, { grootte: 0.6, levenSchaal: 1.3, spreiding: 2, begin: winterHaard ? 0.26 : 0.2 });
      }

      /* Work smoke / sparks / dust only when the workplace is staffed. A working
         forge or bakery draws a thicker column than a house does. */
      if (g.werkers <= 0) continue;
      var cx = (g.x + d.grootte * 0.62) * TEGEL, cy = (g.y + d.grootte * 0.28) * TEGEL;
      if (d.maakt && (d.id === 'bakkerij' || d.id === 'smederij' || d.id === 'wapensmid')) {
        Game.render.particles.emit('rook', cx, cy, d.id === 'bakkerij' ? 1 : 2, { spreiding: 3, grootte: 0.9 });
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

  /* A building that is stuck. This used to be a full-strength ⚠️ emoji at a
     third of a tile, and with ten stuck buildings the town became a field of
     yellow triangles with houses somewhere underneath. The information is not
     wrong, only far too loud: the *decision* is made from ui/stad.problemen,
     which lists them sorted by urgency with a click that takes you there, so
     out here a marker only has to say "look at me sometime".

     So: a small amber pennant, half transparent, breathing slowly (real time,
     like the marching ants — it keeps breathing while paused). Pointing at it
     or selecting it makes it full strength, because then it *is* the subject. */
  function waarschuwingsMerk(ctx, cx, cy, p, sterk) {
    var puls = Game.render.beweging.rustig ? 0 : Math.sin(Date.now() * 0.004) * 0.5 + 0.5;
    var r = p * (sterk ? 0.16 : 0.105) * (1 + puls * 0.08);
    ctx.save();
    ctx.globalAlpha = sterk ? 0.95 : 0.4 + puls * 0.14;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r * 0.92, cy + r * 0.72);
    ctx.lineTo(cx - r * 0.92, cy + r * 0.72);
    ctx.closePath();
    ctx.fillStyle = '#f0b429';
    ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.16);
    ctx.strokeStyle = 'rgba(48,32,6,.75)';
    ctx.stroke();
    /* The bar of the exclamation mark, only once the triangle is big enough
       for it to be a mark rather than a smudge. */
    if (r >= 5) {
      ctx.fillStyle = 'rgba(48,32,6,.85)';
      ctx.fillRect(cx - r * 0.09, cy - r * 0.34, r * 0.18, r * 0.62);
      ctx.fillRect(cx - r * 0.09, cy + r * 0.4, r * 0.18, r * 0.16);
    }
    ctx.restore();
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
      /* Whether shutters should be closed: the same darkness at which the warm
         window glow (sfeer.tekenVensters) comes on. `nachtF` is the same light
         as a number, so the icon badge can dim with it instead of shining
         through the night wash. */
      var nachtF = licht ? licht.nacht : 0;
      sprites.tekenGebouw(ctx, d, sp2.x, sp2.y, p, d.grootte,
        { tijd: tijd, tijdperk: s.tijdperk, geschroeid: g.geschroeid,
          seizoen: s.seizoen, zaad: g.id, nacht: nachtF > 0.42, nachtF: nachtF,
          toonBordje: gekozen || gewezen || !!ui.namen });
      if (g.waarschuwing && p > 19) {
        var fc = Game.render.diamant(sp2.x, sp2.y, p * d.grootte);
        waarschuwingsMerk(ctx, fc.cx, fc.cy - p * (0.6 + d.grootte * 0.5), p, gewezen || gekozen);
      }
      /* Fase 5.2: a figure standing watch on the towers/walls/gates that sit on
         the raiders' route — sleepy in peacetime, fully manned once a raid is
         announced. Fase 5.3: sparring on the training ground. */
      if (p > 20) {
        if (d.verdediging && d.dekking && d.dekking.straal) tekenWacht(ctx, cam, s, g, d, p);
        if (g.werkers > 0 && (g.type === 'oefenveld' || g.type === 'kazerne')) tekenExercitie(ctx, cam, s, g, d, p);
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

    var bew = BEW();
    /* Facing follows the eased heading, so the figure turns rather than flips. */
    var kijk = bew.kijkrichting(w.koers != null ? w.koers : Math.atan2(pos.dy || 0, pos.dx || 1));
    var wandelt = w.bezig === bew.LOPEN || w.bezig === bew.HUISWAARTS;
    var stapFase = (w.afgelegd || 0) * 7.5 + w.fase * 6.28;

    var opties = { cohort: w.cohort, bezig: w.bezig };
    /* Working: standing still with a tool, tool cadence sped up by practice. */
    if (w.bezig === bew.WERKEN) opties.werktFase = (w.klok || 0) * (5.5 + w.werkTempo * 3);
    if (w.bezig === bew.PRATEN) opties.praat = (w.klok || 0);
    /* Loaded: on the leg of the trip where this job hauls something. */
    var geladen = w.draagtOp === 'heen' ? (w.richting > 0) : (w.richting < 0);
    if (w.draagt && geladen && p > 20 && w.bezig !== bew.WERKEN) opties.draagt = w.draagt;

    Game.render.villagers.teken(ctx, sp.x, sp.y, p, w.baan, kijk, stapFase, wandelt, opties);
  }

  /* Approximate wall-top height per defence building, mirroring the muurH the
     sprite volume uses, so a figure stands on the parapet and not in mid-air. */
  var MUURH = { wachttoren: 1.15, bergfried: 1.2, stadsmuur: 0.55, poort: 0.8, kasteel: 1.05 };

  /* Fase 5.2 + 5.4: a watch on the walls. Off-raid, one sentinel dozes at the
     post; during the warning it is fully manned (a spearman keeping lookout, an
     archer on a broad enough wall). At dawn and dusk a relief guard walks up —
     the changing of the watch. */
  function tekenWacht(ctx, cam, s, g, d, p) {
    var sp = cam.wereldNaarScherm(g.x * Game.render.TEGEL, g.y * Game.render.TEGEL);
    var foot = Game.render.diamant(sp.x, sp.y, p * d.grootte);
    var muurH = (MUURH[g.type] || 0.6) * (0.8 + 0.2 * d.grootte);
    var topY = foot.cy - p * muurH;
    var pw = p * 0.7;

    var raid = s.raid && (s.raid.fase === 'waarschuwing' || s.raid.fase === 'beleg');
    var L = Game.render.sfeer ? Game.render.sfeer.licht(s) : { avond: 0, ochtend: 0 };
    var t = s.tijd || 0;

    /* The sentinel, slowly scanning left and right. */
    var kijk = Math.sin(t * 0.6 + g.id) >= 0 ? 1 : -1;
    Game.render.villagers.teken(ctx, foot.cx - pw * 0.1, topY, pw, 'soldaat', kijk,
      t * 1.2 + g.id, false, {});

    if (raid) {
      /* Full manning: an archer on a wide enough parapet, loosing if this piece
         has already fired at the band. */
      if (d.grootte >= 1) {
        var beschoten = s.raid.beschoten && s.raid.beschoten[g.id];
        Game.render.villagers.teken(ctx, foot.cx + pw * 0.35, topY - p * 0.04, pw, 'jager',
          -kijk, t * 2 + g.id, false, beschoten ? { werktFase: t * 8 } : {});
      }
    } else if (L.avond > 0.4 || L.ochtend > 0.4) {
      /* Changing of the guard: a relief walks up the side toward the post. */
      var nadert = (Math.sin(t * 0.8 + g.id) * 0.5 + 0.5);
      Game.render.villagers.teken(ctx, foot.cx - p * 0.5 + nadert * p * 0.4, foot.cy - p * muurH * 0.5,
        pw, 'soldaat', 1, t * 6, true, {});
    }
  }

  /* Fase 5.3: drill on the training ground — two soldiers sparring with staves
     and one striking a pell (a training post). Pure decor, but it gives the
     building a reason to be looked at. */
  function tekenExercitie(ctx, cam, s, g, d, p) {
    var basis = cam.wereldNaarScherm((g.x + d.grootte * 0.5) * Game.render.TEGEL,
                                     (g.y + d.grootte * 0.9) * Game.render.TEGEL);
    var t = s.tijd || 0;
    var pw = p * 0.7;

    /* Two sparring: step in and out in antiphase, arms swinging. */
    var stap = Math.sin(t * 2.2) * p * 0.12;
    Game.render.villagers.teken(ctx, basis.x - p * 0.3 + stap, basis.y, pw, 'soldaat', 1, t * 5, false, { werktFase: t * 5 });
    Game.render.villagers.teken(ctx, basis.x + p * 0.3 - stap, basis.y - p * 0.02, pw, 'soldaat', -1, t * 5 + 3, false, { werktFase: t * 5 + 1.6 });

    /* The pell and the soldier drilling on it. */
    var px = basis.x + p * 0.75, py = basis.y + p * 0.04;
    ctx.strokeStyle = '#6a4a2c';
    ctx.lineWidth = Math.max(1, p * 0.05);
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py - p * 0.4); ctx.stroke();
    ctx.fillStyle = '#9a7048';
    ctx.beginPath(); ctx.arc(px, py - p * 0.42, p * 0.06, 0, Math.PI * 2); ctx.fill();
    Game.render.villagers.teken(ctx, px - p * 0.28, py, pw, 'soldaat', 1, t * 6, false, { werktFase: t * 7 });
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
