/* Raiders you can actually see — a decorative layer on top of the abstract
 * raid simulation in js/core/raids.js. The sim still decides everything (a
 * countdown, then beslecht() weighs defence against strength); this module only
 * *shows* the already-decided outcome, exactly as the walkers are cosmetic.
 *
 * Nothing here is stored in Game.state. The band is rebuilt from s.raid
 * (fase / timer / vanaf / uitslag), so a save made mid-raid stays pure JSON and
 * reloads consistently. */
(function (Game) {

  var R = {};

  var WAARSCHUWING = 45;     /* mirrors raids.WAARSCHUWING for the march timing */
  var UITSLAG_DUUR = 2.6;    /* seconds the resolution animation plays */

  /* Local (render-only) state machine. */
  var lok = { nummer: -1, fase: 'geen', timer: 0, bende: [], gebrand: false };

  R.synchroniseer = function (s) {
    /* Force a respawn on the next tick to match the loaded raid. */
    lok.nummer = -1;
    lok.fase = 'geen';
    lok.bende = [];
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
      lok.bende.push({
        ox: (Math.random() - 0.5) * 2.6,
        oy: (Math.random() - 0.5) * 2.6,
        fase: Math.random() * 6.28,
        traag: 0.85 + Math.random() * 0.3
      });
    }
    lok.nummer = r.nummer;
    lok.fase = 'marcheren';
    lok.gebrand = false;
  }

  R.tick = function (s, dt) {
    if (!s.raid || s.tijdperk < 2) { lok.bende = []; lok.fase = 'geen'; return; }
    var r = s.raid;

    if (r.fase === 'waarschuwing') {
      if (lok.nummer !== r.nummer || lok.fase === 'geen') spawn(s);
      lok.fase = 'marcheren';
      return;
    }

    /* r.fase === 'rust' */
    if (lok.fase === 'marcheren' && lok.nummer === r.nummer) {
      /* The sim just resolved this raid — start the outcome animation. */
      lok.fase = 'uitslag';
      lok.timer = UITSLAG_DUUR;
      lok.gebrand = false;
    } else if (lok.fase === 'uitslag') {
      lok.timer -= dt;
      if (lok.timer <= 0) { lok.fase = 'geen'; lok.bende = []; }
    }
  };

  /* Current lead position of the band, in tile coords, plus whether they are
     fleeing (so the sprites face the other way). */
  function leider(s) {
    var r = s.raid;
    var entry = r.vanaf;
    var pl = plein(s);
    var perim = perimeter(entry, pl);

    if (lok.fase === 'marcheren') {
      var voort = Game.util.clamp(1 - r.timer / WAARSCHUWING, 0, 1);
      return { x: entry.x + (perim.x - entry.x) * voort, y: entry.y + (perim.y - entry.y) * voort, vlucht: false };
    }
    /* uitslag */
    var t = 1 - Game.util.clamp(lok.timer / UITSLAG_DUUR, 0, 1);   /* 0..1 */
    if (r.uitslag === 'doorgebroken') {
      /* Push into the centre in the first half, then leave in the second. */
      if (t < 0.5) {
        var q = t / 0.5;
        return { x: perim.x + (pl.x - perim.x) * q, y: perim.y + (pl.y - perim.y) * q, vlucht: false, binnen: true };
      }
      var q2 = (t - 0.5) / 0.5;
      return { x: pl.x + (entry.x - pl.x) * q2, y: pl.y + (entry.y - pl.y) * q2, vlucht: true };
    }
    /* verjaagd / ternauwernood: fall back from the perimeter to the edge. */
    return { x: perim.x + (entry.x - perim.x) * t, y: perim.y + (entry.y - perim.y) * t, vlucht: true };
  }

  R.teken = function (ctx, cam, s, p) {
    if (lok.fase === 'geen' || !lok.bende.length || !s.raid || !s.raid.vanaf) return;
    var TEGEL = Game.render.TEGEL;
    var L = leider(s);

    /* Breakthrough: set the reached building alight (once). */
    if (lok.fase === 'uitslag' && s.raid.uitslag === 'doorgebroken' && L.binnen && !lok.gebrand && Game.render.particles) {
      var doel = s.raid.doel || plein(s);
      Game.render.particles.vuur(doel.x * TEGEL, doel.y * TEGEL, 10);
      Game.render.particles.rook(doel.x * TEGEL, doel.y * TEGEL, 6);
      Game.render.renderer.schok(7);
      Game.render.renderer.flits('224,80,60');
      if (Game.ui.audio) Game.ui.audio.dreun();
      lok.gebrand = true;
    }

    for (var i = 0; i < lok.bende.length; i++) {
      var b = lok.bende[i];
      var wx = (L.x + b.ox) * TEGEL, wy = (L.y + b.oy) * TEGEL;
      var sp = cam.wereldNaarScherm(wx, wy);
      if (sp.x < -30 || sp.y < -30 || sp.x > cam.breedte + 30 || sp.y > cam.hoogte + 30) continue;

      var wieg = Math.sin(s.tijd * 8 * b.traag + b.fase) * p * 0.03;

      /* shadow */
      ctx.fillStyle = 'rgba(0,0,0,.28)';
      ctx.beginPath();
      ctx.ellipse(sp.x, sp.y + p * 0.1, p * 0.1, p * 0.045, 0, 0, Math.PI * 2);
      ctx.fill();

      /* A soldier sprite, tinted dark, reads as a hostile band. Fall back to a
         hooded figure if the atlas is missing. */
      var img = Game.render.atlas && Game.render.atlas.werker('soldaat');
      if (img) {
        var us = p * 0.6;
        ctx.save();
        ctx.translate(sp.x, sp.y + wieg);
        ctx.scale(L.vlucht ? -1 : 1, 1);
        ctx.globalAlpha = 0.92;
        ctx.drawImage(img, -us / 2, -us * 0.78, us, us);
        ctx.globalAlpha = 1;
        /* dark wash so raiders don't look like your own soldiers */
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = 'rgba(60,20,26,.4)';
        ctx.fillRect(-us / 2, -us * 0.78, us, us);
        ctx.globalCompositeOperation = 'source-over';
        ctx.restore();
      } else {
        ctx.fillStyle = '#5a2230';
        ctx.beginPath();
        ctx.arc(sp.x, sp.y + wieg, p * 0.08, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#3a1620';
        ctx.beginPath();
        ctx.arc(sp.x, sp.y - p * 0.09 + wieg, p * 0.055, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

  /* The edge marker + invasion corridor, shown only while a raid is announced.
     Honest telegraphing that also teaches the positional-defence mechanic. */
  R.tekenCorridor = function (ctx, cam, s, p) {
    if (!s.raid || s.raid.fase !== 'waarschuwing' || !s.raid.vanaf) return;
    var TEGEL = Game.render.TEGEL;
    var cor = Game.core.raids.corridor(s);
    if (!cor) return;

    var a = cam.wereldNaarScherm(cor.ax * TEGEL, cor.ay * TEGEL);
    var b = cam.wereldNaarScherm(cor.bx * TEGEL, cor.by * TEGEL);

    /* Corridor band — a translucent lane, flat-capped so it doesn't blob at the
       ends. Width matches the corridor the defence check actually uses. */
    var puls = 0.08 + 0.04 * Math.sin(s.tijd * 3);
    ctx.save();
    ctx.strokeStyle = 'rgba(224,96,74,' + puls.toFixed(3) + ')';
    ctx.lineWidth = cor.breedte * p;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    /* Centre line + arrow-ish edge marker. */
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
