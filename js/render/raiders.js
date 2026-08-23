/* Raiders you can actually see — a decorative layer on top of the abstract
 * raid simulation in js/core/raids.js. The sim still decides everything (a
 * countdown, then beslecht() weighs defence against strength); this module only
 * *shows* the already-decided outcome, exactly as the walkers are cosmetic.
 *
 * What changed (fase 6): the band no longer floats as one plate of tinted
 * sprites. Each member walks on the shared steering model (js/render/beweging.js),
 * navigating to its own place around the captain, so stragglers fall behind and
 * the formation breathes. When a tower fires (s.raid.beschoten), an arrow volley
 * flies and a raider drops — the number of standing raiders follows r.kracht, so
 * the 45-second approach is a fight you can watch. The four raid choices and the
 * siege camp each get a picture of their own.
 *
 * Nothing here is stored in Game.state. The band is rebuilt from s.raid, so a
 * save made mid-raid stays pure JSON and reloads consistently. */
(function (Game) {

  var R = {};

  var WAARSCHUWING = 45;     /* mirrors raids.WAARSCHUWING for the march timing */
  var UITSLAG_DUUR = 2.6;    /* seconds the resolution animation plays */
  var TEGEL = function () { return Game.render.TEGEL; };

  /* Local (render-only) state machine. */
  var lok = {
    nummer: -1, fase: 'geen', timer: 0,
    bende: [],          /* the raiders, each steered to its own spot */
    pijlen: [],         /* arrow volleys in flight */
    vallend: [],        /* raiders in the middle of falling */
    plunderaars: [],    /* on a breakthrough: raiders scattering with loot */
    kamp: null,         /* siege camp layout */
    gezien: {},         /* which building's volley we have already shown */
    gebrand: false
  };

  R.synchroniseer = function (s) {
    lok.nummer = -1;
    lok.fase = 'geen';
    lok.bende = [];
    lok.pijlen = [];
    lok.vallend = [];
    lok.plunderaars = [];
    lok.kamp = null;
    lok.gezien = {};
  };

  function plein(s) {
    var g = s.gebouwen.filter(function (b) { return b.type === 'dorpsplein'; })[0];
    return { x: g ? g.x + 1 : Math.floor(s.kaart.b / 2), y: g ? g.y + 1 : Math.floor(s.kaart.h / 2) };
  }

  /* Where the band waits just outside town: 18% of the way in from the edge. */
  function perimeter(entry, pl) {
    return { x: pl.x + (entry.x - pl.x) * 0.18, y: pl.y + (entry.y - pl.y) * 0.18 };
  }

  function spawn(s) {
    var r = s.raid;
    if (!r.vanaf) return;
    var aantal = Game.util.clamp(Math.round(r.kracht / 12), 3, 14);
    lok.bende = [];
    for (var i = 0; i < aantal; i++) {
      /* A loose diamond around the captain; index 0 leads with the banner. */
      var rij = Math.floor(i / 3);
      lok.bende.push({
        leider: i === 0,
        /* Formation offset (tiles) behind and beside the captain. */
        fx: (i === 0 ? 0.6 : -rij * 0.9 + (Game.render.rng() - 0.5) * 0.4),
        fy: (i === 0 ? 0 : (i % 3 - 1) * 0.8 + (Game.render.rng() - 0.5) * 0.4),
        x: entryPos(s).x, y: entryPos(s).y,
        koers: 0, snelheid: 0,
        traag: 0.8 + Game.render.rng() * 0.5,      /* stragglers lag */
        fakkel: i % 3 === 0,                    /* every third carries a torch */
        klok: Game.render.rng() * 6.28,
        gevallen: false
      });
    }
    lok.nummer = r.nummer;
    lok.fase = 'marcheren';
    lok.pijlen = [];
    lok.vallend = [];
    lok.plunderaars = [];
    lok.kamp = null;
    lok.gezien = {};
    lok.gebrand = false;
  }

  function entryPos(s) { return { x: s.raid.vanaf.x, y: s.raid.vanaf.y }; }

  R.tick = function (s, dt) {
    if (!s.raid || s.tijdperk < 2) { R.synchroniseer(s); lok.fase = 'geen'; return; }
    var r = s.raid;

    if (r.fase === 'waarschuwing') {
      if (lok.nummer !== r.nummer || lok.fase === 'geen') spawn(s);
      if (lok.fase === 'beleg') lok.fase = 'marcheren';
      lok.fase = 'marcheren';
      stuurBende(s, dt);
      beschieting(s, dt);
      return;
    }

    if (r.fase === 'beleg') {
      if (lok.nummer !== r.nummer) spawn(s);
      lok.fase = 'beleg';
      if (!lok.kamp) maakKamp(s);
      stuurKamp(s, dt);
      stapDeeltjes(dt);
      return;
    }

    /* r.fase === 'rust' */
    if ((lok.fase === 'marcheren' || lok.fase === 'beleg') && lok.nummer === r.nummer) {
      lok.fase = 'uitslag';
      lok.timer = UITSLAG_DUUR;
      lok.gebrand = false;
      if (r.uitslag === 'vernietigd') meleeStof(s);
    } else if (lok.fase === 'uitslag') {
      lok.timer -= dt;
      stuurUitslag(s, dt);
      if (lok.timer <= 0) { lok.fase = 'geen'; lok.bende = []; }
    }
    stapDeeltjes(dt);
  };

  /* --------------------------------------------------------- de opmars ---- */

  /* Current lead position of the band, in tile coords. */
  function leiderPos(s) {
    var r = s.raid;
    var entry = r.vanaf, pl = plein(s), perim = perimeter(entry, pl);
    var voort = Game.util.clamp(1 - r.timer / WAARSCHUWING, 0, 1);
    return { x: entry.x + (perim.x - entry.x) * voort, y: entry.y + (perim.y - entry.y) * voort };
  }

  /* Steer each raider toward its place in the formation around the captain. */
  function stuurBende(s, dt) {
    var bew = Game.render.beweging;
    var L = leiderPos(s);
    /* Formation basis: forward is from entry toward the square. */
    var pl = plein(s), entry = s.raid.vanaf;
    var vx = pl.x - entry.x, vy = pl.y - entry.y;
    var len = Math.sqrt(vx * vx + vy * vy) || 1;
    vx /= len; vy /= len;
    var rx = -vy, ry = vx;      /* right of the marching direction */

    for (var i = 0; i < lok.bende.length; i++) {
      var b = lok.bende[i];
      b.klok += dt;
      if (b.gevallen) continue;
      var doelX = L.x + vx * b.fx + rx * b.fy;
      var doelY = L.y + vy * b.fx + ry * b.fy;
      var dx = doelX - b.x, dy = doelY - b.y;
      var afst = Math.sqrt(dx * dx + dy * dy);
      var koers = Math.atan2(dy, dx);
      var snel = Math.min(afst * 2.5, 1.4) * b.traag;
      bew.stuur(b, afst > 0.02 ? koers : b.koers, snel, dt);
      b.x += Math.cos(b.koers) * b.snelheid * dt;
      b.y += Math.sin(b.koers) * b.snelheid * dt;
    }
  }

  /* Fase 6.3: watch the sim's beschoten map. When a new piece of cover fires,
     send an arrow volley from it to the band and drop a raider — and keep the
     number of standing raiders in step with r.kracht, so the crowd visibly
     thins as the towers wear them down. */
  function beschieting(s, dt) {
    var r = s.raid;
    for (var id in r.beschoten) {
      if (lok.gezien[id]) continue;
      lok.gezien[id] = true;
      var g = Game.core.state.gebouw(s, parseInt(id, 10));
      if (g) {
        var d = Game.core.state.def(g);
        var gx = g.x + d.grootte / 2, gy = g.y + d.grootte / 2;
        var doel = staandeRover();
        if (doel) {
          for (var k = 0; k < 4; k++) {
            lok.pijlen.push({
              x0: gx, y0: gy - 0.4,
              x1: doel.x + (Game.render.rng() - 0.5) * 0.8, y1: doel.y + (Game.render.rng() - 0.5) * 0.8,
              t: 0, duur: 0.5 + Game.render.rng() * 0.2
            });
          }
          velRover(doel);
        }
      }
    }

    /* Cap the standing count to what the strength implies. */
    var wil = Game.util.clamp(Math.round(r.kracht / 12), 0, lok.bende.length);
    var staan = 0;
    for (var i = 0; i < lok.bende.length; i++) if (!lok.bende[i].gevallen) staan++;
    while (staan > wil) {
      var extra = staandeRover();
      if (!extra) break;
      velRover(extra);
      staan--;
    }
  }

  function staandeRover() {
    var kandidaten = lok.bende.filter(function (b) { return !b.gevallen && !b.leider; });
    if (!kandidaten.length) kandidaten = lok.bende.filter(function (b) { return !b.gevallen; });
    return kandidaten.length ? kandidaten[Math.floor(Game.render.rng() * kandidaten.length)] : null;
  }

  function velRover(b) {
    b.gevallen = true;
    lok.vallend.push({ x: b.x, y: b.y, t: 0, duur: 1.1, koers: b.koers });
    if (Game.render.particles) Game.render.particles.stof(b.x * TEGEL(), b.y * TEGEL(), 3);
  }

  /* --------------------------------------------------------- projectielen -- */

  function stapDeeltjes(dt) {
    var i;
    for (i = lok.pijlen.length - 1; i >= 0; i--) {
      lok.pijlen[i].t += dt;
      if (lok.pijlen[i].t >= lok.pijlen[i].duur) lok.pijlen.splice(i, 1);
    }
    for (i = lok.vallend.length - 1; i >= 0; i--) {
      lok.vallend[i].t += dt;
      if (lok.vallend[i].t >= lok.vallend[i].duur) lok.vallend.splice(i, 1);
    }
    for (i = 0; i < lok.plunderaars.length; i++) {
      var pl = lok.plunderaars[i];
      pl.klok += dt;
      pl.x += Math.cos(pl.koers) * pl.snelheid * dt;
      pl.y += Math.sin(pl.koers) * pl.snelheid * dt;
    }
  }

  /* ------------------------------------------------------------- het beleg -- */

  function maakKamp(s) {
    var entry = s.raid.vanaf, pl = plein(s), perim = perimeter(entry, pl);
    lok.kamp = { x: perim.x, y: perim.y, tenten: [], vuurFase: Game.render.rng() * 6.28 };
    for (var i = 0; i < 3; i++) {
      var a = i / 3 * Math.PI * 2;
      lok.kamp.tenten.push({ x: perim.x + Math.cos(a) * 1.2, y: perim.y + Math.sin(a) * 1.2 });
    }
    /* Position the band around the camp fire. */
    for (var k = 0; k < lok.bende.length; k++) {
      var b = lok.bende[k];
      var ang = k / lok.bende.length * Math.PI * 2;
      b.fx = 0; b.fy = 0;
      b.kampX = perim.x + Math.cos(ang) * 0.8;
      b.kampY = perim.y + Math.sin(ang) * 0.8;
    }
  }

  function stuurKamp(s, dt) {
    var bew = Game.render.beweging;
    for (var i = 0; i < lok.bende.length; i++) {
      var b = lok.bende[i];
      b.klok += dt;
      if (b.gevallen) continue;
      /* Now and then a raider gets up and paces the perimeter, then sits again. */
      var dx = (b.kampX || b.x) - b.x, dy = (b.kampY || b.y) - b.y;
      var afst = Math.sqrt(dx * dx + dy * dy);
      bew.stuur(b, Math.atan2(dy, dx), Math.min(afst * 2, 0.5), dt);
      b.x += Math.cos(b.koers) * b.snelheid * dt;
      b.y += Math.sin(b.koers) * b.snelheid * dt;
    }
    if (lok.kamp) lok.kamp.vuurFase += dt;
  }

  /* ------------------------------------------------------------- uitslag --- */

  function stuurUitslag(s, dt) {
    var r = s.raid;
    var t = 1 - Game.util.clamp(lok.timer / UITSLAG_DUUR, 0, 1);
    var entry = r.vanaf, pl = plein(s), perim = perimeter(entry, pl);
    var doel;
    if (r.uitslag === 'doorgebroken') {
      if (t < 0.5) doel = { x: perim.x + (pl.x - perim.x) * (t / 0.5), y: perim.y + (pl.y - perim.y) * (t / 0.5) };
      else doel = { x: pl.x + (entry.x - pl.x) * ((t - 0.5) / 0.5), y: pl.y + (entry.y - pl.y) * ((t - 0.5) / 0.5) };
    } else {
      /* Driven off / bought off: fall back to the edge, faster and messier. */
      doel = { x: perim.x + (entry.x - perim.x) * t, y: perim.y + (entry.y - perim.y) * t };
    }
    var bew = Game.render.beweging;
    for (var i = 0; i < lok.bende.length; i++) {
      var b = lok.bende[i];
      b.klok += dt;
      if (b.gevallen) continue;
      var dx = doel.x + b.fy - b.x, dy = doel.y - b.y;
      var afst = Math.sqrt(dx * dx + dy * dy);
      bew.stuur(b, Math.atan2(dy, dx), Math.min(afst * 2.5, 1.6), dt);
      b.x += Math.cos(b.koers) * b.snelheid * dt;
      b.y += Math.sin(b.koers) * b.snelheid * dt;
    }
  }

  function meleeStof(s) {
    if (!Game.render.particles) return;
    var L = leiderPos(s);
    for (var i = 0; i < 6; i++) {
      Game.render.particles.stof((L.x + (Game.render.rng() - 0.5) * 2) * TEGEL(),
                                 (L.y + (Game.render.rng() - 0.5) * 2) * TEGEL(), 3);
    }
  }

  /* ---------------------------------------------------------------- tekenen */

  R.teken = function (ctx, cam, s, p) {
    if (lok.fase === 'geen') return;
    var r = s.raid;
    if (!r || (!r.vanaf && lok.fase !== 'geen')) { /* no route: nothing to draw */ }

    /* Breakthrough: set the reached building alight (once) and scatter looters. */
    if (lok.fase === 'uitslag' && r.uitslag === 'doorgebroken' && !lok.gebrand) {
      var doel = r.doel || plein(s);
      var t = 1 - Game.util.clamp(lok.timer / UITSLAG_DUUR, 0, 1);
      if (t >= 0.5) {
        if (Game.render.particles) {
          Game.render.particles.vuur(doel.x * TEGEL(), doel.y * TEGEL(), 10);
          Game.render.particles.rook(doel.x * TEGEL(), doel.y * TEGEL(), 6);
        }
        Game.render.renderer.schok(7);
        Game.render.renderer.flits('224,80,60');
        if (Game.ui.audio) Game.ui.audio.dreun();
        maakPlunderaars(s);
        lok.gebrand = true;
      }
    }

    if (lok.fase === 'beleg') tekenKamp(ctx, cam, s, p);

    tekenPijlen(ctx, cam, p);
    tekenBende(ctx, cam, s, p);
    tekenVallend(ctx, cam, p);
    tekenPlunderaars(ctx, cam, s, p);

    /* The four choices, each with a picture (fase 6.4). */
    if (lok.fase === 'marcheren') tekenKeuzes(ctx, cam, s, p);
  };

  /* One arrow, a fast dark streak with a light head. */
  function tekenPijlen(ctx, cam, p) {
    if (!lok.pijlen.length) return;
    ctx.strokeStyle = 'rgba(40,32,24,.85)';
    ctx.lineWidth = Math.max(1, p * 0.03);
    ctx.lineCap = 'round';
    for (var i = 0; i < lok.pijlen.length; i++) {
      var a = lok.pijlen[i];
      var f = a.t / a.duur;
      var x = a.x0 + (a.x1 - a.x0) * f, y = a.y0 + (a.y1 - a.y0) * f;
      var boog = Math.sin(f * Math.PI) * 0.6;   /* a little arc */
      var sp = cam.wereldNaarScherm(x * TEGEL(), y * TEGEL());
      sp.y -= boog * p;
      var dx = (a.x1 - a.x0), dy = (a.y1 - a.y0);
      var dl = Math.sqrt(dx * dx + dy * dy) || 1;
      ctx.beginPath();
      ctx.moveTo(sp.x, sp.y);
      ctx.lineTo(sp.x - dx / dl * p * 0.3, sp.y - dy / dl * p * 0.3 - boog * p * 0.3);
      ctx.stroke();
    }
  }

  function tekenBende(ctx, cam, s, p) {
    for (var i = 0; i < lok.bende.length; i++) {
      var b = lok.bende[i];
      if (b.gevallen) continue;
      var sp = cam.wereldNaarScherm(b.x * TEGEL(), b.y * TEGEL());
      if (sp.x < -30 || sp.y < -30 || sp.x > cam.breedte + 30 || sp.y > cam.hoogte + 30) continue;

      var bew = Game.render.beweging;
      var kijk = bew.kijkrichting(b.koers);
      var wandelt = b.snelheid > 0.05;
      var stapFase = b.klok * 6;

      /* A torch glows in the night wash (fase 6.6). */
      if (b.fakkel) torenLicht(ctx, cam, s, b, p);

      Game.render.villagers.teken(ctx, sp.x, sp.y, p * 0.95, 'soldaat', kijk, stapFase, wandelt,
        { rover: true, fakkel: b.fakkel });

      /* The captain flies a ragged banner. */
      if (b.leider) banier(ctx, sp.x, sp.y, p, b.klok);
    }
  }

  function banier(ctx, x, y, p, klok) {
    ctx.strokeStyle = '#2a2018';
    ctx.lineWidth = Math.max(1, p * 0.03);
    ctx.beginPath();
    ctx.moveTo(x - p * 0.14, y - p * 0.1); ctx.lineTo(x - p * 0.14, y - p * 0.62);
    ctx.stroke();
    var wap = Math.sin(klok * 3) * p * 0.04;
    ctx.fillStyle = '#7a1f22';
    ctx.beginPath();
    ctx.moveTo(x - p * 0.14, y - p * 0.6);
    ctx.lineTo(x - p * 0.14 + p * 0.2, y - p * 0.55 + wap);
    ctx.lineTo(x - p * 0.14 + p * 0.16, y - p * 0.46);
    ctx.lineTo(x - p * 0.14, y - p * 0.44);
    ctx.closePath();
    ctx.fill();
  }

  /* A warm pool of torchlight on the ground, additive so it reads at night. */
  function torenLicht(ctx, cam, s, b, p) {
    var L = Game.render.sfeer ? Game.render.sfeer.licht(s) : { nacht: 0 };
    if (L.nacht < 0.3) return;
    var sp = cam.wereldNaarScherm(b.x * TEGEL(), b.y * TEGEL());
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var g = ctx.createRadialGradient(sp.x, sp.y - p * 0.1, 0, sp.x, sp.y - p * 0.1, p * 0.9);
    var sterkte = 0.4 * L.nacht;
    g.addColorStop(0, 'rgba(255,180,90,' + sterkte.toFixed(3) + ')');
    g.addColorStop(1, 'rgba(255,150,60,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(sp.x, sp.y, p * 0.9, p * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function tekenVallend(ctx, cam, p) {
    for (var i = 0; i < lok.vallend.length; i++) {
      var v = lok.vallend[i];
      var f = v.t / v.duur;
      var sp = cam.wereldNaarScherm(v.x * TEGEL(), v.y * TEGEL());
      ctx.save();
      ctx.globalAlpha = 1 - f;
      ctx.translate(sp.x, sp.y);
      ctx.rotate((Math.cos(v.koers) >= 0 ? 1 : -1) * f * 1.4);   /* topples over */
      Game.render.villagers.teken(ctx, 0, 0, p * 0.9, 'soldaat', 1, 0, false, { rover: true });
      ctx.restore();
    }
  }

  /* Fase 6.6: on a breakthrough the raiders spread out, pause at a building and
     run off with a sack. */
  function maakPlunderaars(s) {
    lok.plunderaars = [];
    var pl = plein(s), entry = s.raid.vanaf;
    var doelen = s.gebouwen.filter(function (g) { return g.gebouwd && g.type !== 'dorpsplein'; });
    var n = Math.min(4, lok.bende.filter(function (b) { return !b.gevallen; }).length);
    for (var i = 0; i < n; i++) {
      var g = doelen.length ? doelen[Math.floor(Game.render.rng() * doelen.length)] : null;
      var gx = g ? g.x : pl.x, gy = g ? g.y : pl.y;
      var koers = Math.atan2(entry.y - gy, entry.x - gx);
      lok.plunderaars.push({ x: gx, y: gy, koers: koers, snelheid: 1.2, klok: Game.render.rng() * 6, buit: true });
    }
  }

  function tekenPlunderaars(ctx, cam, s, p) {
    for (var i = 0; i < lok.plunderaars.length; i++) {
      var pl = lok.plunderaars[i];
      var sp = cam.wereldNaarScherm(pl.x * TEGEL(), pl.y * TEGEL());
      var kijk = Game.render.beweging.kijkrichting(pl.koers);
      Game.render.villagers.teken(ctx, sp.x, sp.y, p * 0.95, 'soldaat', kijk, pl.klok * 8, true,
        { rover: true, draagt: 'hout' });
    }
  }

  /* ------------------------------------------------------------- het kamp -- */

  function tekenKamp(ctx, cam, s, p) {
    if (!lok.kamp) return;
    var k = lok.kamp;
    /* Tents. */
    for (var i = 0; i < k.tenten.length; i++) {
      var t = k.tenten[i];
      var sp = cam.wereldNaarScherm(t.x * TEGEL(), t.y * TEGEL());
      ctx.fillStyle = '#4a3d34';
      ctx.beginPath();
      ctx.moveTo(sp.x, sp.y - p * 0.4);
      ctx.lineTo(sp.x - p * 0.28, sp.y + p * 0.05);
      ctx.lineTo(sp.x + p * 0.28, sp.y + p * 0.05);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#5a4c40';
      ctx.beginPath();
      ctx.moveTo(sp.x, sp.y - p * 0.4);
      ctx.lineTo(sp.x + p * 0.28, sp.y + p * 0.05);
      ctx.lineTo(sp.x + p * 0.1, sp.y + p * 0.05);
      ctx.closePath(); ctx.fill();
    }
    /* Camp fire. */
    var fp = cam.wereldNaarScherm(k.x * TEGEL(), k.y * TEGEL());
    var flikker = 0.7 + 0.3 * Math.sin(k.vuurFase * 6);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var g = ctx.createRadialGradient(fp.x, fp.y, 0, fp.x, fp.y, p * 0.7 * flikker);
    g.addColorStop(0, 'rgba(255,190,90,.8)');
    g.addColorStop(1, 'rgba(230,110,40,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(fp.x, fp.y, p * 0.7 * flikker, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (Game.render.particles && Game.render.rng() < 0.3) Game.render.particles.rook(k.x * TEGEL(), k.y * TEGEL(), 1);
  }

  /* --------------------------------------------------------- de vier keuzes */

  function tekenKeuzes(ctx, cam, s, p) {
    var r = s.raid;
    var pl = plein(s);
    var t = s.tijd || 0;

    /* Sortie: the garrison marches out and forms up between town and band. */
    if (s.leger && s.leger.uitval) {
      var L = leiderPos(s);
      var mx = (pl.x + L.x) / 2, my = (pl.y + L.y) / 2;
      var voor = Game.util.clamp(1 - r.timer / WAARSCHUWING, 0, 1);
      var n = Game.util.clamp(Math.round(Game.core.raids.legerKracht(s) / 14), 2, 6);
      for (var i = 0; i < n; i++) {
        var off = (i - (n - 1) / 2) * 0.6;
        var gx = pl.x + (mx - pl.x) * voor - off * (L.y - pl.y) / 6;
        var gy = pl.y + (my - pl.y) * voor + off * (L.x - pl.x) / 6;
        var sp = cam.wereldNaarScherm(gx * TEGEL(), gy * TEGEL());
        Game.render.villagers.teken(ctx, sp.x, sp.y, p * 0.95, 'soldaat',
          (L.x >= pl.x ? 1 : -1), t * 5 + i, voor < 0.98, {});
      }
    }

    /* Militia: idle townsfolk line up on the corridor with pitchforks. */
    if (r.keuze && r.keuze.burgerwacht) {
      var cor = Game.core.raids.corridor(s);
      if (cor) {
        var n2 = Game.util.clamp(Math.round((s.bevolking.werkloos || 0) / 2), 2, 6);
        var midx = pl.x + (cor.ax - pl.x) * 0.35, midy = pl.y + (cor.ay - pl.y) * 0.35;
        var perp = Math.atan2(cor.by - cor.ay, cor.bx - cor.ax) + Math.PI / 2;
        for (var m = 0; m < n2; m++) {
          var o = (m - (n2 - 1) / 2) * 0.7;
          var bx = midx + Math.cos(perp) * o, by = midy + Math.sin(perp) * o;
          var sp2 = cam.wereldNaarScherm(bx * TEGEL(), by * TEGEL());
          Game.render.villagers.teken(ctx, sp2.x, sp2.y, p * 0.85, 'boer',
            (cor.ax >= pl.x ? 1 : -1), 0, false, { werktFase: 0.1 });
        }
      }
    }

    /* Evacuation: a few figures streaming in toward the square. */
    if (r.keuze && r.keuze.evacuatie) {
      for (var e = 0; e < 4; e++) {
        var a = e / 4 * Math.PI * 2;
        var f = (t * 0.3 + e * 0.25) % 1;
        var ex = pl.x + Math.cos(a) * (3 - f * 2.4), ey = pl.y + Math.sin(a) * (3 - f * 2.4);
        var sp3 = cam.wereldNaarScherm(ex * TEGEL(), ey * TEGEL());
        Game.render.villagers.teken(ctx, sp3.x, sp3.y, p * 0.8, 'werkloos',
          (Math.cos(a) < 0 ? 1 : -1), t * 8 + e, true, {});
      }
    }
  }

  /* The edge marker + invasion corridor, shown only while a raid is announced.
     Honest telegraphing that also teaches the positional-defence mechanic. */
  R.tekenCorridor = function (ctx, cam, s, p) {
    if (!s.raid || s.raid.fase !== 'waarschuwing' || !s.raid.vanaf) return;
    var cor = Game.core.raids.corridor(s);
    if (!cor) return;

    var a = cam.wereldNaarScherm(cor.ax * TEGEL(), cor.ay * TEGEL());
    var b = cam.wereldNaarScherm(cor.bx * TEGEL(), cor.by * TEGEL());

    var puls = 0.08 + 0.04 * Math.sin(s.tijd * 3);
    ctx.save();
    ctx.strokeStyle = 'rgba(224,96,74,' + puls.toFixed(3) + ')';
    ctx.lineWidth = cor.breedte * p;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(224,96,74,.55)';
    ctx.lineWidth = Math.max(1.5, p * 0.05);
    ctx.setLineDash([p * 0.4, p * 0.3]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    ctx.fillStyle = 'rgba(224,96,74,.85)';
    ctx.font = Math.round(p * 0.7) + 'px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚔️', a.x, a.y);
  };

  Game.render.raiders = R;

})(window.Game);
