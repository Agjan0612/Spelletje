/* Draws the whole scene in one clear stack:
 *
 *   deep sea → terrain (+ relief) → roads → buildings (shadow + body,
 *   y-sorted) → age-up sweep → wildlife → walkers → work-chips →
 *   raiders → particles → floaters → corridor → ghost →
 *   overlays (grid, winter veil, day/night, flash)
 *
 * Later steps read what earlier ones drew, so the order is deliberate. Every
 * lively extra here (walkers, roads, raiders, particles, wildlife, floaters) is
 * decorative: derived from Game.state, never stored in it, so saves stay pure
 * JSON. The walkers run a cosmetic loop — walk the road out → swing a tool with
 * flying chips → carry the goods home → deliver a floater. */
(function (Game) {

  var R = {};
  var sprites = Game.render.sprites;
  var map = Game.core.map;

  var canvas, ctx, dpr = 1;

  var TEGEL = Game.render.TEGEL;

  /* Real-time clock (seconds) driving the decorative animation: footstep bob,
     tool swings and the chimney smoke phase. Never part of the saved state. */
  var klok = 0;

  /* A short screen shake, set by schok() and decayed on real time. */
  var schud = 0, schudX = 0, schudY = 0;

  /* Age-up "construction sweep" that wipes across the town on advancement. */
  var sweep = { actief: false, t: 0, duur: 2.8, gepoft: {} };

  /* Throttles the ambient work sparks/dust so emitters run a few times a
     second, not every frame. */
  var werkTimer = 0;

  /* A brief full-screen colour flash for the big moments (raid hit, age-up). */
  var flits = 0, flitsKleur = '255,255,255';

  /* Per-trade tool shown while a villager works at a resource, and the colour
     of the chips/splash/sparks that fly when they do. */
  var GEREEDSCHAP = {
    houthakker: '🪓', jager: '🏹', visser: '🎣',
    steenhouwer: '⛏️', mijnwerker: '⛏️', boer: '🌾'
  };
  var SPATKLEUR = {
    hout: '#8a6236', vis: 'rgba(150,205,235,.95)', steen: '#b7b2a6',
    wild: '#b5563f', ijzer: '#c7d0da', koper: '#d98a3e',
    edelsteen: '#7fe0ea', vruchtbaar: '#d9b45c'
  };

  /* Short-lived work chips (the flakes that fly off a swinging tool), in world
     pixels. Decorative and module-local — separate from the particles.js module
     which does the smoke/fire/dust for raids, the sweep and mines. */
  var deeltjes = [];

  function spatDeeltjes(wx, wy, kleur, n) {
    for (var i = 0; i < n; i++) {
      var a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      var kr = 22 + Math.random() * 26;
      deeltjes.push({
        x: wx + (Math.random() - 0.5) * 4, y: wy,
        vx: Math.cos(a) * kr, vy: Math.sin(a) * kr,
        leven: 0, duur: 0.35 + Math.random() * 0.3, kleur: kleur
      });
    }
    if (deeltjes.length > 220) deeltjes.splice(0, deeltjes.length - 220);
  }

  function tickDeeltjes(dt) {
    for (var i = deeltjes.length - 1; i >= 0; i--) {
      var d = deeltjes[i];
      d.leven += dt;
      d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 90 * dt;   /* gravity */
      if (d.leven >= d.duur) deeltjes.splice(i, 1);
    }
  }

  function tekenDeeltjes(cam, p) {
    if (!deeltjes.length) return;
    for (var i = 0; i < deeltjes.length; i++) {
      var d = deeltjes[i];
      var sp = cam.wereldNaarScherm(d.x, d.y);
      if (sp.x < -10 || sp.y < -10 || sp.x > cam.breedte + 10 || sp.y > cam.hoogte + 10) continue;
      ctx.globalAlpha = Math.max(0, 1 - d.leven / d.duur);
      ctx.fillStyle = d.kleur;
      var r = Math.max(1.5, p * 0.035);
      ctx.fillRect(sp.x - r / 2, sp.y - r / 2, r, r);
    }
    ctx.globalAlpha = 1;
  }

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
    R.verversWandelaars(s);
    if (Game.render.raiders) Game.render.raiders.synchroniseer(s);
  };

  /* Lighter hook for when only the buildings changed (placed / finished /
     demolished / damaged): rebuild the roads and walkers, leave the terrain
     cache alone. */
  R.verversGebouwen = function (s) {
    if (Game.render.paths) Game.render.paths.ververs(s);
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
     Rebuilt by reconciliation (not from scratch) so nobody teleports when the
     list refreshes; each keeps its work-loop state across refreshes. */
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

      var doelX = pleinX, doelY = pleinY;
      var heeftBron = false, node = null, res = null;
      if (d.wint) {
        var t = map.zoekNode(s.kaart, g.x, g.y, d.wint.node, d.wint.straal);
        if (t) {
          var idx = s.kaart.tegels.indexOf(t);
          doelX = idx % s.kaart.b;
          doelY = Math.floor(idx / s.kaart.b);
          heeftBron = true; node = d.wint.node; res = d.wint.res;
        }
      }

      var hx = g.x + d.grootte / 2, hy = g.y + d.grootte / 2;
      var aantal = Math.max(1, Math.round(g.werkers / 2)) + (drukte - 1);

      var route = Game.render.paths ? Game.render.paths.route(s, g.x, g.y, doelX, doelY) : null;
      if (!route) route = [{ x: hx, y: hy }, { x: doelX + 0.5, y: doelY + 0.5 }];

      for (var n = 0; n < aantal && lijst.length < limiet; n++) {
        var sleutel = g.id + ':' + n;
        var bestaand = oud[sleutel];
        if (bestaand) {
          /* Keep p/fase/work state; refresh what may have moved. */
          bestaand.route = route;
          bestaand.baan = d.banen.baan;
          bestaand.heeftBron = heeftBron;
          bestaand.node = node;
          bestaand.res = res;
          lijst.push(bestaand);
        } else {
          lijst.push({
            sleutel: sleutel,
            route: route,
            baan: d.banen.baan,
            variant: g.id * 7 + n * 3,
            heeftBron: heeftBron, node: node, res: res,
            p: Math.random(),
            snelheid: 0.08 + Math.random() * 0.06,
            fase: Math.random() < 0.5 ? 'heen' : 'terug',
            werkTimer: 0, slag: 0, spatTimer: 0, draagt: false,
            bob: Math.random() * 6.283
          });
        }
      }
    }
    s.wandelaars = lijst;

    if (Game.render.wildlife) Game.render.wildlife.ververs(s);
  };

  R.tickWandelaars = function (s, dt) {
    klok += dt;
    tickDeeltjes(dt);
    if (!s.wandelaars) return;

    for (var i = 0; i < s.wandelaars.length; i++) {
      var w = s.wandelaars[i];

      if (w.fase === 'werk') {
        w.werkTimer -= dt;
        w.slag += dt;
        if (w.heeftBron) {
          w.spatTimer -= dt;
          if (w.spatTimer <= 0) {
            w.spatTimer = 0.32;
            var eind = w.route[w.route.length - 1];
            spatDeeltjes(eind.x * TEGEL, eind.y * TEGEL - TEGEL * 0.2,
              SPATKLEUR[w.node] || '#cfcfcf', 3);
          }
        }
        if (w.werkTimer <= 0) { w.fase = 'terug'; w.draagt = !!w.res; }
        continue;
      }

      var richting = w.fase === 'terug' ? -1 : 1;
      w.p += richting * w.snelheid * dt;

      if (w.p >= 1) {
        w.p = 1;
        if (w.heeftBron) { w.fase = 'werk'; w.werkTimer = 0.7 + Math.random() * 0.8; w.slag = 0; }
        else w.fase = 'terug';
      } else if (w.p <= 0) {
        w.p = 0;
        if (w.draagt && w.res && Game.render.floaters) {
          var em = (Game.config.resources[w.res] || {}).emoji || '';
          var begin = w.route[0];
          Game.render.floaters.spat(begin.x * TEGEL, begin.y * TEGEL - TEGEL * 0.5, '+' + em, '#f3e7c6');
        }
        w.draagt = false;
        w.fase = 'heen';
      }
    }
  };

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
        return { x: a.x + (b.x - a.x) * lok, y: a.y + (b.y - a.y) * lok, dx: b.x - a.x };
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

    if (schud > 0.05) {
      schudX = (Math.random() - 0.5) * schud;
      schudY = (Math.random() - 0.5) * schud;
    } else { schudX = schudY = 0; }
    ctx.setTransform(dpr, 0, 0, dpr, schudX * dpr, schudY * dpr);
    ctx.clearRect(-4, -4, cam.breedte + 8, cam.hoogte + 8);

    ctx.fillStyle = ['#27506b', '#295473', '#254a64', '#2b4a5e'][s.seizoen];
    ctx.fillRect(-4, -4, cam.breedte + 8, cam.hoogte + 8);

    var zicht = cam.zichtbaar(s.kaart);
    var tijd = s.tijd;
    var nacht = nachtFactor(s);

    /* --- terrain (+ relief, handled inside tekenTegel) --- */
    for (var y = zicht.y0; y < zicht.y1; y++) {
      for (var x = zicht.x0; x < zicht.x1; x++) {
        var tegel = map.tegel(s.kaart, x, y);
        if (!tegel) continue;
        var sp = cam.wereldNaarScherm(x * Game.render.TEGEL, y * Game.render.TEGEL);
        sprites.tekenTegel(ctx, tegel, sp.x, sp.y, p, s.seizoen, tijd, s.kaart, x, y);
      }
    }

    /* --- roads, drawn under the buildings --- */
    if (Game.render.paths && p > 12) Game.render.paths.teken(ctx, cam, s, p);

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

    /* --- buildings (top to bottom so they overlap cleanly) --- */
    var gesorteerd = s.gebouwen.slice().sort(function (a, b) { return a.y - b.y; });
    for (var i = 0; i < gesorteerd.length; i++) {
      var g = gesorteerd[i];
      var d = Game.core.state.def(g);
      if (g.x + d.grootte < zicht.x0 || g.x > zicht.x1) continue;
      if (g.y + d.grootte < zicht.y0 || g.y > zicht.y1) continue;

      var sp2 = cam.wereldNaarScherm(g.x * Game.render.TEGEL, g.y * Game.render.TEGEL);
      var w = p * d.grootte, h = p * d.grootte;

      if (g.gebouwd) {
        sprites.tekenGebouw(ctx, d, sp2.x, sp2.y, w, h,
          { tijd: tijd, tijdperk: s.tijdperk, geschroeid: g.geschroeid, nacht: nacht, klok: klok, id: g.id });
        if (g.waarschuwing && p > 16) {
          ctx.font = Math.round(p * 0.34) + 'px serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('⚠️', sp2.x + w * 0.82, sp2.y + h * 0.16);
        }
      } else {
        sprites.tekenBouwplaats(ctx, d, sp2.x, sp2.y, w, h, g.voortgang / d.bouwtijd);
      }

      if (ui.geselecteerd === g.id) {
        ctx.strokeStyle = '#f0cd7f';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(sp2.x + 1, sp2.y + 1, w - 2, h - 2);
        ctx.setLineDash([]);
      }
    }

    /* --- age-up construction sweep, over the buildings --- */
    if (sweep.actief) tekenSweep(s, cam, p);

    /* --- wildlife, walkers, work-chips --- */
    if (p > 15 && Game.render.wildlife) Game.render.wildlife.teken(ctx, cam, p);
    if (p > 15) tekenWandelaars(s, cam, p);
    if (p > 15) tekenDeeltjes(cam, p);

    /* --- raiders + particles (smoke/fire/dust) + floaters --- */
    if (Game.render.raiders) Game.render.raiders.teken(ctx, cam, s, p);
    if (Game.render.particles) Game.render.particles.teken(ctx, cam);
    if (Game.render.floaters) Game.render.floaters.teken(ctx, cam);

    /* --- defence corridor while a raid is announced --- */
    if (Game.render.raiders && Game.render.raiders.tekenCorridor) {
      Game.render.raiders.tekenCorridor(ctx, cam, s, p);
    }

    /* --- placement ghost --- */
    if (ui.plaatsType && ui.muisTegel) tekenSpook(s, cam, ui, p);

    /* --- overlays: day/night dusk + winter veil + event flash --- */
    if (nacht > 0.04) {
      ctx.fillStyle = 'rgba(20,26,58,' + (nacht * 0.34).toFixed(3) + ')';
      ctx.fillRect(0, 0, cam.breedte, cam.hoogte);
    }
    if (s.seizoen === 3) {
      ctx.fillStyle = 'rgba(200,220,240,.10)';
      ctx.fillRect(0, 0, cam.breedte, cam.hoogte);
    }
    if (flits > 0.01) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(' + flitsKleur + ',' + (flits * 0.3).toFixed(3) + ')';
      ctx.fillRect(0, 0, cam.breedte, cam.hoogte);
      ctx.restore();
    }
  };

  /* Night level (0 at midday → 1 at midnight) from the in-game clock, shared by
     the dusk wash and the per-building window glow in sprites.sfeer. */
  function nachtFactor(s) {
    var dagLengte = Game.core.state.DAG;
    var f = (s.tijd % dagLengte) / dagLengte;
    return 0.5 - 0.5 * Math.cos(f * Math.PI * 2);
  }

  /* Real-time bits that are not the fixed simulation: particles, raiders,
     screen shake, the age-up sweep, ambient work sparks and scorch decay. */
  R.tickEffecten = function (s, dt) {
    if (Game.render.particles) Game.render.particles.tick(dt);
    if (Game.render.raiders) Game.render.raiders.tick(s, dt);
    if (schud > 0) schud = Math.max(0, schud - dt * 22);
    if (flits > 0) flits = Math.max(0, flits - dt * 2.2);

    tickSweep(s, dt);
    tickWerk(s, dt);
    vervaagSchroei(s, dt);
  };

  function tickSweep(s, dt) {
    if (!sweep.actief) return;
    sweep.t += dt;
    var front = sweep.t / sweep.duur;
    var breedte = s.kaart.b;
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

  /* Industrial activity cues on working buildings — sparks at a smithy, dust at
     a mine. The homely chimney smoke on houses/bakeries is handled by
     sprites.sfeer, so we deliberately do not double it here. */
  function tickWerk(s, dt) {
    if (!Game.render.particles) return;
    werkTimer -= dt;
    if (werkTimer > 0) return;
    werkTimer = 0.55;
    for (var i = 0; i < s.gebouwen.length; i++) {
      var g = s.gebouwen[i];
      if (!g.gebouwd || g.uit || g.werkers <= 0 || g.waarschuwing) continue;
      var d = Game.core.state.def(g);
      if (d.id === 'smederij' || d.id === 'wapensmid') {
        Game.render.particles.vonken((g.x + d.grootte * 0.66) * TEGEL, (g.y + d.grootte * 0.2) * TEGEL, 1);
      } else if (d.wint && (d.wint.node === 'steen' || d.wint.node === 'ijzer' ||
                 d.wint.node === 'koper' || d.wint.node === 'edelsteen')) {
        Game.render.particles.stof((g.x + d.grootte / 2) * TEGEL, (g.y + d.grootte * 0.7) * TEGEL, 1);
      }
    }
  }

  function vervaagSchroei(s, dt) {
    for (var i = 0; i < s.gebouwen.length; i++) {
      var g = s.gebouwen[i];
      if (g.geschroeid > 0) {
        g.geschroeid -= dt;
        if (g.geschroeid <= 0) delete g.geschroeid;
      }
    }
  }

  function tekenSweep(s, cam, p) {
    var front = sweep.t / sweep.duur;
    var breedte = s.kaart.b;
    for (var i = 0; i < s.gebouwen.length; i++) {
      var g = s.gebouwen[i];
      if (!g.gebouwd) continue;
      var d = Game.core.state.def(g);
      var fx = (g.x + d.grootte / 2) / breedte;
      var afst = front - fx;
      if (afst < 0 || afst > 0.16) continue;
      var sp = cam.wereldNaarScherm(g.x * TEGEL, g.y * TEGEL);
      var w = p * d.grootte;
      var alpha = 0.55 * (1 - afst / 0.16);
      ctx.strokeStyle = 'rgba(190,150,90,' + alpha.toFixed(3) + ')';
      ctx.lineWidth = Math.max(1, w * 0.04);
      ctx.beginPath();
      ctx.moveTo(sp.x + w * 0.12, sp.y + w * 0.95); ctx.lineTo(sp.x + w * 0.12, sp.y + w * 0.1);
      ctx.moveTo(sp.x + w * 0.88, sp.y + w * 0.95); ctx.lineTo(sp.x + w * 0.88, sp.y + w * 0.1);
      ctx.moveTo(sp.x + w * 0.05, sp.y + w * 0.4); ctx.lineTo(sp.x + w * 0.95, sp.y + w * 0.34);
      ctx.moveTo(sp.x + w * 0.05, sp.y + w * 0.68); ctx.lineTo(sp.x + w * 0.95, sp.y + w * 0.62);
      ctx.stroke();
    }
  }

  function tekenWandelaars(s, cam, p) {
    if (!s.wandelaars) return;
    var atlas = Game.render.atlas;
    for (var i = 0; i < s.wandelaars.length; i++) {
      var w = s.wandelaars[i];
      var pos = langsRoute(w.route, w.p);
      var wx = pos.x * TEGEL, wy = pos.y * TEGEL;
      var sp = cam.wereldNaarScherm(wx, wy);
      if (sp.x < -20 || sp.y < -20 || sp.x > cam.breedte + 20 || sp.y > cam.hoogte + 20) continue;

      /* Face the way they walk, and give a footstep bob while moving. */
      var dir = w.fase === 'terug' ? -1 : 1;
      var flip = (pos.dx * dir) < 0 ? -1 : 1;
      var stap = w.fase === 'werk' ? 0 : Math.abs(Math.sin(klok * 6 + w.bob)) * p * 0.05;
      var vy = sp.y - stap;

      ctx.fillStyle = 'rgba(0,0,0,.25)';
      ctx.beginPath();
      ctx.ellipse(sp.x, sp.y + p * 0.10, p * 0.09, p * 0.04, 0, 0, Math.PI * 2);
      ctx.fill();

      var img = atlas && atlas.werker(w.baan, w.variant);
      if (img) {
        var us = p * 0.62;
        if (flip < 0) {
          ctx.save();
          ctx.translate(sp.x, vy);
          ctx.scale(-1, 1);
          ctx.drawImage(img, -us / 2, -us * 0.78, us, us);
          ctx.restore();
        } else {
          ctx.drawImage(img, sp.x - us / 2, vy - us * 0.78, us, us);
        }
      } else {
        var baan = Game.config.jobs[w.baan] || Game.config.jobs.werkloos;
        ctx.fillStyle = baan.kleur;
        ctx.beginPath();
        ctx.arc(sp.x, vy, p * 0.075, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f0e0c0';
        ctx.beginPath();
        ctx.arc(sp.x, vy - p * 0.09, p * 0.05, 0, Math.PI * 2);
        ctx.fill();
      }

      /* Tool swing while working at the resource. */
      if (w.fase === 'werk' && GEREEDSCHAP[w.baan]) {
        ctx.save();
        ctx.translate(sp.x + flip * p * 0.15, vy - p * 0.2);
        ctx.rotate(Math.sin(w.slag * 9) * 0.7 * flip);
        ctx.font = Math.round(p * 0.3) + 'px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(GEREEDSCHAP[w.baan], 0, 0);
        ctx.restore();
      }

      /* The goods carried home on the way back. */
      if (w.draagt && w.res) {
        var em2 = (Game.config.resources[w.res] || {}).emoji;
        if (em2) {
          ctx.font = Math.round(p * 0.26) + 'px serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(em2, sp.x, vy - p * 0.62);
        }
      }
    }
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
        ctx.fillRect(sp.x, sp.y, p, p);
      }
    }
  }

  function tekenSpook(s, cam, ui, p) {
    var d = Game.config.gebouw(ui.plaatsType);
    var tx = ui.muisTegel.x, ty = ui.muisTegel.y;
    var check = Game.core.construction.controleer(s, ui.plaatsType, tx, ty);
    var sp = cam.wereldNaarScherm(tx * Game.render.TEGEL, ty * Game.render.TEGEL);
    var w = p * d.grootte;

    ctx.globalAlpha = 0.75;
    sprites.tekenGebouw(ctx, d, sp.x, sp.y, w, w, { tijd: s.tijd, tijdperk: s.tijdperk });
    ctx.globalAlpha = 1;

    ctx.strokeStyle = check.ok ? '#8fdc6a' : '#e0604a';
    ctx.fillStyle = check.ok ? 'rgba(143,220,106,.18)' : 'rgba(224,96,74,.22)';
    ctx.lineWidth = 2;
    ctx.fillRect(sp.x, sp.y, w, w);
    ctx.strokeRect(sp.x + 1, sp.y + 1, w - 2, w - 2);

    if (d.plaats && d.plaats.nabij) {
      var straal = d.plaats.nabij.straal;
      ctx.strokeStyle = check.ok ? 'rgba(143,220,106,.5)' : 'rgba(224,96,74,.5)';
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(
        sp.x - straal * p, sp.y - straal * p,
        w + straal * p * 2, w + straal * p * 2
      );
      ctx.setLineDash([]);
    }

    /* Defence buildings show their coverage radius while placing. */
    if (d.dekking && d.dekking.straal) {
      var dr = d.dekking.straal;
      ctx.strokeStyle = 'rgba(120,180,240,.55)';
      ctx.fillStyle = 'rgba(120,180,240,.10)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(sp.x + w / 2, sp.y + w / 2, dr * p, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.setLineDash([]);
    }

    ui.plaatsCheck = check;
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
