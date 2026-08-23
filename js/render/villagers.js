/* Procedural villagers — the little people that walk the streets.
 *
 * Replaces the top-down Kenney unit billboards (which read as flat, floating
 * blobs when stood upright in the iso view) with a small hand-built figure in
 * the same shaded-volume style as the buildings: two legs with a real walk
 * cycle, a torso in the job colour, a head, and a per-job cap and carried
 * tool. Everything is pure canvas, so — like the procedural buildings — it
 * needs no assets and can never fail to load. Nothing here touches Game.state. */
(function (Game) {

  var V = {};

  /* --- colour helpers (local; sprites.verf is private to that module) --- */
  function ontleed(kleur) {
    var m = kleur.match(/^#(\w\w)(\w\w)(\w\w)$/);
    if (m) return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
    m = kleur.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (m) return [+m[1], +m[2], +m[3]];
    return [200, 200, 200];
  }
  function verf(kleur, f) {
    var c = ontleed(kleur);
    return 'rgb(' + Game.util.clamp(Math.round(c[0] * f), 0, 255) + ',' +
                    Game.util.clamp(Math.round(c[1] * f), 0, 255) + ',' +
                    Game.util.clamp(Math.round(c[2] * f), 0, 255) + ')';
  }

  var HUID = '#e3b088';               /* one warm skin tone for every villager */

  /* Per-job flourishes: a cap colour (or a wide straw hat / metal helm) and an
     optional carried tool, so a woodcutter reads differently from a soldier at
     a glance. Anything not listed gets a plain brown hair tuft. */
  var ACCENT = {
    houthakker:  { hoed: '#6a4a2c', gereedschap: 'bijl' },
    jager:       { hoed: '#6a5230', gereedschap: 'boog' },
    visser:      { hoed: '#4a6a7a', gereedschap: 'hengel' },
    boer:        { hoed: '#d8c37a', stro: true, gereedschap: 'mand' },
    steenhouwer: { helm: '#8b9096', gereedschap: 'houweel' },
    mijnwerker:  { helm: '#8b9096', gereedschap: 'houweel' },
    smid:        { hoed: '#4a4038', gereedschap: 'hamer' },
    wapensmid:   { helm: '#8b9096', gereedschap: 'zwaard' },
    soldaat:     { helm: '#a2a7ad', gereedschap: 'speer' },
    bakker:      { hoed: '#efe7d4' },
    molenaar:    { hoed: '#e6ddc4' },
    handelaar:   { hoed: '#7a5a24' },
    waard:       { hoed: '#7a4a24' },
    priester:    { kap: '#d9d2bd', gereedschap: 'staf' },
    juwelier:    { hoed: '#3a6a72' },
    geleerde:    { kap: '#6a5490', gereedschap: 'boek' },
    bouwer:      { hoed: '#b98a34', gereedschap: 'hamer' }
  };

  function tekenGereedschap(ctx, soort, hx, hy, p, kijk) {
    ctx.lineCap = 'round';
    switch (soort) {
      case 'bijl':
        ctx.strokeStyle = '#6a4a2c'; ctx.lineWidth = Math.max(1, p * 0.028);
        ctx.beginPath(); ctx.moveTo(hx, hy + p * 0.06); ctx.lineTo(hx, hy - p * 0.14); ctx.stroke();
        ctx.fillStyle = '#cfd4d8';
        ctx.beginPath();
        ctx.moveTo(hx, hy - p * 0.14); ctx.lineTo(hx + kijk * p * 0.07, hy - p * 0.11);
        ctx.lineTo(hx + kijk * p * 0.06, hy - p * 0.05); ctx.lineTo(hx, hy - p * 0.08);
        ctx.closePath(); ctx.fill();
        break;
      case 'houweel':
        ctx.strokeStyle = '#6a4a2c'; ctx.lineWidth = Math.max(1, p * 0.028);
        ctx.beginPath(); ctx.moveTo(hx, hy + p * 0.06); ctx.lineTo(hx, hy - p * 0.14); ctx.stroke();
        ctx.strokeStyle = '#9aa0a6'; ctx.lineWidth = Math.max(1, p * 0.03);
        ctx.beginPath(); ctx.moveTo(hx - p * 0.07, hy - p * 0.1); ctx.lineTo(hx + p * 0.07, hy - p * 0.16); ctx.stroke();
        break;
      case 'hamer':
        ctx.strokeStyle = '#6a4a2c'; ctx.lineWidth = Math.max(1, p * 0.028);
        ctx.beginPath(); ctx.moveTo(hx, hy + p * 0.05); ctx.lineTo(hx, hy - p * 0.12); ctx.stroke();
        ctx.fillStyle = '#7a8088';
        ctx.fillRect(hx - p * 0.05, hy - p * 0.15, p * 0.1, p * 0.05);
        break;
      case 'zwaard':
      case 'speer':
        ctx.strokeStyle = soort === 'speer' ? '#6a4a2c' : '#c9ccd0';
        ctx.lineWidth = Math.max(1, p * 0.03);
        ctx.beginPath(); ctx.moveTo(hx, hy + p * 0.08); ctx.lineTo(hx, hy - p * 0.2); ctx.stroke();
        if (soort === 'speer') {
          ctx.fillStyle = '#c9ccd0';
          ctx.beginPath();
          ctx.moveTo(hx, hy - p * 0.26); ctx.lineTo(hx + p * 0.03, hy - p * 0.19);
          ctx.lineTo(hx - p * 0.03, hy - p * 0.19); ctx.closePath(); ctx.fill();
        }
        break;
      case 'staf':
        ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = Math.max(1, p * 0.03);
        ctx.beginPath(); ctx.moveTo(hx, hy + p * 0.08); ctx.lineTo(hx, hy - p * 0.22); ctx.stroke();
        break;
      case 'boog':
        ctx.strokeStyle = '#7a5a30'; ctx.lineWidth = Math.max(1, p * 0.025);
        ctx.beginPath(); ctx.arc(hx, hy - p * 0.04, p * 0.12, -1.1, 1.1); ctx.stroke();
        break;
      case 'hengel':
        ctx.strokeStyle = '#7a5a30'; ctx.lineWidth = Math.max(1, p * 0.022);
        ctx.beginPath(); ctx.moveTo(hx, hy + p * 0.06); ctx.lineTo(hx + kijk * p * 0.02, hy - p * 0.22); ctx.stroke();
        break;
      case 'mand':
        ctx.fillStyle = '#9a6f3a';
        ctx.beginPath(); ctx.ellipse(hx, hy, p * 0.06, p * 0.045, 0, 0, Math.PI * 2); ctx.fill();
        break;
      case 'boek':
        ctx.fillStyle = '#8a4438';
        ctx.fillRect(hx - p * 0.05, hy - p * 0.03, p * 0.1, p * 0.07);
        break;
    }
  }

  /* Draw one villager. (x, y) is the ground point at the feet; p is pixels per
     tile so the figure scales with zoom. `stapFase` advances with distance
     walked (not the clock), so the gait keeps its cadence at any speed; when
     `wandelt` is false the legs settle and the figure just breathes. */
  V.teken = function (ctx, x, y, p, baan, kijk, stapFase, wandelt, opties) {
    var job = Game.config.jobs[baan] || Game.config.jobs.werkloos;
    var body = job.kleur;
    opties = opties || {};

    /* Cohort (fase 2.5): a child is smaller and carries no tool; an old villager
       is a touch smaller, greyer and stooped. Scaling the pixels-per-tile keeps
       the figure anchored at the same feet, so the whole body shrinks together. */
    var cohort = opties.cohort;
    var kind = cohort === 'kind', oud = cohort === 'oud';
    if (kind) p *= 0.66; else if (oud) p *= 0.92;

    var acc = kind ? {} : (ACCENT[baan] || {});
    if (oud && !acc.helm && !acc.kap) acc = { hoed: '#b9b4ac' };   /* grey hair */

    /* At the far end of their route villagers stop and actually work: the arm
       swings a full stroke and the body leans into it. `werktFase` runs on
       real time, so the axe keeps chopping while the figure stands still. */
    var werkt = opties.werktFase != null;
    var slag = werkt ? Math.max(0, Math.sin(opties.werktFase)) : 0;
    var praat = opties.praat != null;

    var legLen = p * 0.15, torsoH = p * 0.17, torsoW = p * 0.15, headR = p * 0.072;
    var broek = verf(body, 0.5);

    /* A stooped lean for the elderly: shift the upper body forward along facing. */
    var stoop = oud ? kijk * p * 0.03 : 0;

    /* Gait: legs swing fore/aft; a very small body bob (twice per stride) so it
       reads as walking, not hopping — the old sprite's big vertical jump was
       the main "springerige" complaint. */
    var swing = wandelt ? Math.sin(stapFase) : 0;
    var armSwing = wandelt ? Math.sin(stapFase + Math.PI) : Math.sin(stapFase * 0.5) * 0.15;
    if (werkt) armSwing = 1.1 - slag * 2.3;
    if (praat) armSwing = Math.sin(opties.praat * 4) * 0.6;   /* small gesturing */
    var bob = wandelt ? -Math.abs(Math.sin(stapFase)) * p * 0.012 : Math.sin(stapFase * 0.6) * p * 0.004;
    if (werkt) bob += slag * p * 0.02;
    var legAmp = p * 0.055;

    var hipY = y - legLen + bob;
    var shoulderY = hipY - torsoH;
    var headY = shoulderY - headR * 0.85;

    /* --- contact shadow, tight to the feet --- */
    ctx.fillStyle = 'rgba(0,0,0,.24)';
    ctx.beginPath();
    ctx.ellipse(x, y + p * 0.01, p * 0.085, p * 0.032, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineCap = 'round';

    /* --- back leg + back arm (a touch darker for depth) --- */
    ctx.strokeStyle = verf(broek, 0.82);
    ctx.lineWidth = Math.max(1.2, p * 0.05);
    ctx.beginPath();
    ctx.moveTo(x, hipY); ctx.lineTo(x - swing * legAmp, y);
    ctx.stroke();

    ctx.strokeStyle = verf(body, 0.7);
    ctx.lineWidth = Math.max(1, p * 0.04);
    ctx.beginPath();
    ctx.moveTo(x, shoulderY + torsoH * 0.15);
    ctx.lineTo(x - armSwing * legAmp * 0.8, shoulderY + torsoH * 0.9);
    ctx.stroke();

    /* --- torso (rounded), with a lit edge on the facing side --- */
    var tx = x - torsoW / 2;
    ctx.fillStyle = body;
    rond(ctx, tx, shoulderY, torsoW, torsoH + p * 0.02, p * 0.05);
    ctx.fill();
    ctx.fillStyle = verf(body, 1.14);
    rond(ctx, x + kijk * torsoW * 0.18, shoulderY + p * 0.01, torsoW * 0.32, torsoH, p * 0.04);
    ctx.fill();

    /* --- front leg + front arm --- */
    ctx.strokeStyle = broek;
    ctx.lineWidth = Math.max(1.2, p * 0.05);
    ctx.beginPath();
    ctx.moveTo(x, hipY); ctx.lineTo(x + swing * legAmp, y);
    ctx.stroke();

    var handX = x + armSwing * legAmp * 0.8 + kijk * p * 0.02;
    var handY = shoulderY + torsoH * 0.95;
    ctx.strokeStyle = verf(body, 1.02);
    ctx.lineWidth = Math.max(1, p * 0.04);
    ctx.beginPath();
    ctx.moveTo(x, shoulderY + torsoH * 0.15);
    ctx.lineTo(handX, handY);
    ctx.stroke();

    /* hand */
    ctx.fillStyle = HUID;
    ctx.beginPath(); ctx.arc(handX, handY, p * 0.022, 0, Math.PI * 2); ctx.fill();

    /* carried tool in the front hand — swung down during a work stroke */
    if (acc.gereedschap) {
      if (werkt) {
        ctx.save();
        ctx.translate(handX, handY);
        ctx.rotate(kijk * (-0.5 + slag * 1.7));
        tekenGereedschap(ctx, acc.gereedschap, 0, 0, p, kijk);
        ctx.restore();
      } else {
        tekenGereedschap(ctx, acc.gereedschap, handX, handY, p, kijk);
      }
    }

    /* --- neck + head (leaning forward a touch for the elderly) --- */
    var hx = x + stoop;
    ctx.strokeStyle = verf(HUID, 0.9);
    ctx.lineWidth = Math.max(1, p * 0.03);
    ctx.beginPath(); ctx.moveTo(x, shoulderY); ctx.lineTo(hx, shoulderY - p * 0.02); ctx.stroke();

    ctx.fillStyle = HUID;
    ctx.beginPath(); ctx.arc(hx, headY, headR, 0, Math.PI * 2); ctx.fill();
    /* soft shading on the away side of the face */
    ctx.fillStyle = verf(HUID, 0.86);
    ctx.beginPath(); ctx.arc(hx - kijk * headR * 0.35, headY, headR * 0.7, 0, Math.PI * 2); ctx.fill();

    /* --- headwear --- */
    hoofddeksel(ctx, hx, headY, headR, kijk, acc);

    /* A walking stick for the old. */
    if (oud) {
      ctx.strokeStyle = '#7a5a34';
      ctx.lineWidth = Math.max(1, p * 0.026);
      ctx.beginPath();
      ctx.moveTo(x + kijk * p * 0.11, y);
      ctx.lineTo(x + kijk * p * 0.09, shoulderY + torsoH * 0.5);
      ctx.stroke();
    }

    /* What they are hauling home, held above the head on the way back. */
    if (opties.draagt && !werkt) vracht(ctx, x, headY - headR * 1.5, p, opties.draagt, opties.bezig);
  };

  /* The load a walker is carrying, shaped to fit it: a rounded sack for grain
     and flour, a bucket for water, a rough lump for stone and ore, a crate for
     everything else. Same resource colour and (zoomed in) its emoji, so you can
     still read what it is. */
  var ZAKKEN = { graan: 1, meel: 1, brood: 1, wol: 1, hop: 1 };
  var LOMPEN = { steen: 1, ijzer: 1, koper: 1, edelsteen: 1, erts: 1 };
  function vracht(ctx, x, y, p, res, bezig) {
    var def = Game.config.resources[res];
    if (!def) return;
    var w = p * 0.15, h = p * 0.1;

    if (ZAKKEN[res]) {
      /* A bulging sack. */
      ctx.fillStyle = verf(def.kleur, 0.82);
      ctx.beginPath();
      ctx.ellipse(x, y - h * 0.5, w * 0.5, h * 0.62, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = verf(def.kleur, 1.08);
      ctx.beginPath();
      ctx.ellipse(x - w * 0.12, y - h * 0.7, w * 0.22, h * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (res === 'water') {
      /* A bucket. */
      ctx.fillStyle = '#6a5030';
      ctx.beginPath();
      ctx.moveTo(x - w * 0.4, y - h); ctx.lineTo(x + w * 0.4, y - h);
      ctx.lineTo(x + w * 0.3, y); ctx.lineTo(x - w * 0.3, y);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(120,180,220,.8)';
      ctx.fillRect(x - w * 0.34, y - h, w * 0.68, h * 0.28);
    } else if (LOMPEN[res]) {
      /* A rough lump / block. */
      ctx.fillStyle = verf(def.kleur, 0.8);
      ctx.beginPath();
      ctx.moveTo(x - w * 0.5, y); ctx.lineTo(x - w * 0.34, y - h);
      ctx.lineTo(x + w * 0.4, y - h * 0.86); ctx.lineTo(x + w * 0.5, y);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = verf(def.kleur, 1.12);
      ctx.beginPath();
      ctx.moveTo(x - w * 0.34, y - h); ctx.lineTo(x + w * 0.4, y - h * 0.86);
      ctx.lineTo(x + w * 0.1, y - h * 0.5); ctx.closePath(); ctx.fill();
    } else {
      ctx.fillStyle = verf(def.kleur, 0.75);
      ctx.fillRect(x - w / 2, y - h, w, h);
      ctx.fillStyle = verf(def.kleur, 1.1);
      ctx.fillRect(x - w / 2, y - h, w, h * 0.32);
    }

    if (p >= 26) {
      ctx.font = Math.round(p * 0.13) + 'px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(def.emoji, x, y - h * 0.45);
    }
  }

  function hoofddeksel(ctx, x, hy, r, kijk, acc) {
    if (acc.helm) {
      ctx.fillStyle = acc.helm;
      ctx.beginPath();
      ctx.arc(x, hy - r * 0.15, r * 1.05, Math.PI, 0);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.2)';
      ctx.lineWidth = Math.max(1, r * 0.14);
      ctx.beginPath(); ctx.moveTo(x, hy - r * 1.2); ctx.lineTo(x, hy - r * 0.2); ctx.stroke();
      return;
    }
    if (acc.stro) {                              /* wide straw hat */
      ctx.fillStyle = acc.hoed;
      ctx.beginPath();
      ctx.ellipse(x, hy - r * 0.35, r * 1.7, r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x, hy - r * 0.7, r * 0.7, r * 0.55, 0, 0, Math.PI * 2); ctx.fill();
      return;
    }
    if (acc.kap) {                               /* monk / scholar hood */
      ctx.fillStyle = acc.kap;
      ctx.beginPath();
      ctx.arc(x, hy - r * 0.05, r * 1.15, Math.PI * 0.92, Math.PI * 0.08);
      ctx.closePath(); ctx.fill();
      return;
    }
    /* cap (job colour) or a default brown hair tuft */
    ctx.fillStyle = acc.hoed || '#5a3f28';
    ctx.beginPath();
    ctx.arc(x, hy - r * 0.2, r * 0.95, Math.PI, 0);
    ctx.closePath(); ctx.fill();
  }

  /* Minimal rounded-rect path (no ctx.roundRect: keep old-browser / file:// safe). */
  function rond(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  Game.render.villagers = V;

})(window.Game);
