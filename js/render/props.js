/* Yard clutter: the small things that turn a row of buildings into a village.
 *
 * Woodpiles, haystacks, market stalls, laundry lines, vegetable patches and
 * fences on the free tiles around your buildings. Everything here is derived
 * from the buildings and a stable hash of the tile coordinates — nothing is
 * stored in Game.state, and the same town always grows the same clutter.
 *
 * The list is rebuilt on the same hooks as the roads (placing, finishing,
 * demolishing) and cached on a signature of the buildings. */
(function (Game) {

  var P = {};

  var props = [];
  var teken = null;              /* signature of the buildings we built for */
  var MAX = 150;

  /* Stable pseudo-random in [0,1) from two integers. */
  function hash(x, y, zout) {
    var n = Math.sin(x * 127.1 + y * 311.7 + (zout || 0) * 74.7) * 43758.5453;
    return n - Math.floor(n);
  }

  /* Which kind of clutter belongs next to which building. */
  var BIJ = {
    huisje:        ['moestuin', 'waslijn', 'houtstapel', 'hek', 'kippen'],
    vakwerkhuis:   ['moestuin', 'waslijn', 'bloemen', 'hek', 'kippen'],
    herenhuis:     ['bloemen', 'hek', 'bank'],
    dorpsplein:    ['kraam', 'vaten', 'kist', 'bank'],
    marktplaats:   ['kraam', 'kist', 'vaten'],
    boerderij:     ['hooiberg', 'hek', 'kruiwagen'],
    hoeve:         ['hooiberg', 'hek', 'kruiwagen', 'kippen'],
    houthakkershut:['houtstapel', 'stammen'],
    houtzagerij:   ['houtstapel', 'stammen', 'kruiwagen'],
    steengroeve:   ['steenstapel', 'kruiwagen'],
    steenhouwerij: ['steenstapel', 'kruiwagen'],
    kopermijn:     ['steenstapel', 'kruiwagen'],
    ijzermijn:     ['steenstapel', 'kruiwagen'],
    edelsteenmijn: ['steenstapel', 'kist'],
    bakkerij:      ['zakken', 'kist'],
    herberg:       ['vaten', 'bank'],
    smederij:      ['vaten', 'steenstapel'],
    kazerne:       ['vaten', 'kist'],
    voorraadschuur:['kist', 'vaten'],
    pakhuis:       ['kist', 'vaten', 'zakken'],
    jachthut:      ['stammen', 'vaten'],
    vissershut:    ['vaten', 'kist']
  };
  var STANDAARD = ['bloemen', 'struik'];

  function handtekening(s) {
    var stukken = [s.gebouwen.length];
    for (var i = 0; i < s.gebouwen.length; i++) {
      var g = s.gebouwen[i];
      stukken.push(g.id + ':' + g.type + ':' + (g.gebouwd ? 1 : 0));
    }
    return stukken.join('|');
  }

  P.ververs = function (s) {
    var nu = handtekening(s);
    if (nu === teken) return;
    teken = nu;
    props = [];

    var map = Game.core.map;
    var bezet = {};

    for (var i = 0; i < s.gebouwen.length && props.length < MAX; i++) {
      var g = s.gebouwen[i];
      if (!g.gebouwd) continue;
      var d = Game.core.state.def(g);
      var soorten = BIJ[g.type] || STANDAARD;

      /* Walk the ring of tiles just outside the footprint. */
      for (var dy = -1; dy <= d.grootte && props.length < MAX; dy++) {
        for (var dx = -1; dx <= d.grootte; dx++) {
          var binnen = dx >= 0 && dx < d.grootte && dy >= 0 && dy < d.grootte;
          if (binnen) continue;
          var x = g.x + dx, y = g.y + dy;
          var sleutel = x + ',' + y;
          if (bezet[sleutel]) continue;

          var t = map.tegel(s.kaart, x, y);
          if (!t || t.b != null) continue;
          if (t.t !== 'gras' && t.t !== 'vruchtbaar') continue;
          if (t.n === 'wild' && t.amt > 0) continue;      /* leave the deer be */

          var kans = hash(x, y, 1);
          if (kans > 0.34) continue;                      /* keep it sparse */

          bezet[sleutel] = true;
          var soort = soorten[Math.floor(hash(x, y, 2) * soorten.length) % soorten.length];
          props.push({
            x: x + 0.2 + hash(x, y, 3) * 0.6,
            y: y + 0.2 + hash(x, y, 4) * 0.6,
            soort: soort,
            v: hash(x, y, 5)
          });
        }
      }
    }
  };

  /* Hand the visible props to the renderer's depth-sorted layer. */
  P.verzamel = function (zicht, uit) {
    for (var i = 0; i < props.length; i++) {
      var pr = props[i];
      if (pr.x < zicht.x0 - 1 || pr.x > zicht.x1 + 1 || pr.y < zicht.y0 - 1 || pr.y > zicht.y1 + 1) continue;
      uit.push({ d: pr.x + pr.y, yy: pr.y, soort: 0.5, prop: pr });
    }
  };

  /* ------------------------------------------------------------- tekenen -- */

  P.teken = function (ctx, cam, p, pr) {
    var sp = cam.wereldNaarScherm(pr.x * Game.render.TEGEL, pr.y * Game.render.TEGEL);
    if (sp.x < -30 || sp.y < -30 || sp.x > cam.breedte + 30 || sp.y > cam.hoogte + 30) return;

    /* Everything sits on a small contact shadow so it belongs to the ground. */
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.beginPath();
    ctx.ellipse(sp.x, sp.y + p * 0.02, p * 0.11, p * 0.045, 0, 0, Math.PI * 2);
    ctx.fill();

    switch (pr.soort) {
      case 'houtstapel': houtstapel(ctx, sp.x, sp.y, p, pr.v); break;
      case 'stammen': stammen(ctx, sp.x, sp.y, p, pr.v); break;
      case 'steenstapel': steenstapel(ctx, sp.x, sp.y, p, pr.v); break;
      case 'hooiberg': hooiberg(ctx, sp.x, sp.y, p, pr.v); break;
      case 'kraam': kraam(ctx, sp.x, sp.y, p, pr.v); break;
      case 'vaten': vaten(ctx, sp.x, sp.y, p, pr.v); break;
      case 'kist': kist(ctx, sp.x, sp.y, p, pr.v); break;
      case 'zakken': zakken(ctx, sp.x, sp.y, p, pr.v); break;
      case 'moestuin': moestuin(ctx, sp.x, sp.y, p, pr.v); break;
      case 'waslijn': waslijn(ctx, sp.x, sp.y, p, pr.v); break;
      case 'hek': hek(ctx, sp.x, sp.y, p, pr.v); break;
      case 'kippen': kippen(ctx, sp.x, sp.y, p, pr.v); break;
      case 'kruiwagen': kruiwagen(ctx, sp.x, sp.y, p, pr.v); break;
      case 'bank': bank(ctx, sp.x, sp.y, p, pr.v); break;
      case 'bloemen': bloemen(ctx, sp.x, sp.y, p, pr.v); break;
      default: struik(ctx, sp.x, sp.y, p, pr.v);
    }
  };

  function houtstapel(ctx, x, y, p, v) {
    var w = p * 0.09, h = p * 0.045;
    for (var rij = 0; rij < 2; rij++) {
      for (var i = 0; i < 3 - rij; i++) {
        ctx.fillStyle = rij === 0 ? '#8a6236' : '#9a6f3c';
        ctx.beginPath();
        ctx.ellipse(x - w + i * w + rij * w * 0.5, y - h * (0.6 + rij * 1.5), w * 0.5, h * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(60,40,22,.5)';
        ctx.lineWidth = Math.max(1, p * 0.008);
        ctx.stroke();
      }
    }
  }

  function stammen(ctx, x, y, p, v) {
    for (var i = 0; i < 2; i++) {
      var oy = y - i * p * 0.05;
      ctx.fillStyle = i ? '#8a6236' : '#7a5730';
      ctx.fillRect(x - p * 0.16, oy - p * 0.05, p * 0.32, p * 0.05);
      /* Sawn end, so it reads as a log and not a plank. */
      ctx.fillStyle = '#c3a271';
      ctx.beginPath();
      ctx.ellipse(x + p * 0.16, oy - p * 0.025, p * 0.014, p * 0.025, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function steenstapel(ctx, x, y, p, v) {
    var kleuren = ['#a8a49a', '#98948a', '#b4b0a6'];
    for (var i = 0; i < 4; i++) {
      var ox = x + (((i * 37 + v * 90) % 40) / 40 - 0.5) * p * 0.2;
      var oy = y - (i % 2) * p * 0.05;
      ctx.fillStyle = kleuren[i % 3];
      ctx.beginPath();
      ctx.ellipse(ox, oy, p * 0.055, p * 0.04, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function hooiberg(ctx, x, y, p, v) {
    var h = p * (0.22 + v * 0.08);
    ctx.fillStyle = '#d3b053';
    ctx.beginPath();
    ctx.moveTo(x - p * 0.13, y);
    ctx.quadraticCurveTo(x, y - h * 1.5, x + p * 0.13, y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(150,116,40,.5)';
    ctx.lineWidth = Math.max(1, p * 0.012);
    ctx.beginPath();
    ctx.moveTo(x - p * 0.07, y - h * 0.3);
    ctx.quadraticCurveTo(x, y - h * 0.55, x + p * 0.07, y - h * 0.3);
    ctx.stroke();
  }

  function kraam(ctx, x, y, p, v) {
    var w = p * 0.3, h = p * 0.2;
    /* poles */
    ctx.strokeStyle = '#7a5a34';
    ctx.lineWidth = Math.max(1, p * 0.02);
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y); ctx.lineTo(x - w / 2, y - h);
    ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y - h);
    ctx.stroke();
    /* striped canopy */
    var strepen = ['#c14a3a', '#efe3c8'];
    for (var i = 0; i < 4; i++) {
      ctx.fillStyle = strepen[i % 2];
      ctx.beginPath();
      ctx.moveTo(x - w / 2 + (i * w) / 4, y - h);
      ctx.lineTo(x - w / 2 + ((i + 1) * w) / 4, y - h);
      ctx.lineTo(x - w / 2 + ((i + 1) * w) / 4, y - h * 1.28);
      ctx.lineTo(x - w / 2 + (i * w) / 4, y - h * 1.28);
      ctx.closePath();
      ctx.fill();
    }
    /* goods on the counter */
    ctx.fillStyle = '#9a6f3a';
    ctx.fillRect(x - w / 2, y - h * 0.35, w, h * 0.12);
  }

  function vaten(ctx, x, y, p, v) {
    for (var i = 0; i < 2; i++) {
      var ox = x + (i - 0.5) * p * 0.12;
      ctx.fillStyle = '#8a6236';
      ctx.beginPath();
      ctx.ellipse(ox, y - p * 0.06, p * 0.05, p * 0.075, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(60,44,26,.6)';
      ctx.lineWidth = Math.max(1, p * 0.012);
      ctx.beginPath();
      ctx.moveTo(ox - p * 0.05, y - p * 0.06); ctx.lineTo(ox + p * 0.05, y - p * 0.06);
      ctx.stroke();
    }
  }

  function kist(ctx, x, y, p, v) {
    ctx.fillStyle = '#7c5a34';
    ctx.fillRect(x - p * 0.08, y - p * 0.1, p * 0.16, p * 0.1);
    ctx.fillStyle = '#9a7040';
    ctx.fillRect(x - p * 0.08, y - p * 0.12, p * 0.16, p * 0.03);
    ctx.strokeStyle = 'rgba(50,36,20,.6)';
    ctx.lineWidth = Math.max(1, p * 0.01);
    ctx.strokeRect(x - p * 0.08, y - p * 0.12, p * 0.16, p * 0.12);
  }

  function zakken(ctx, x, y, p, v) {
    for (var i = 0; i < 2; i++) {
      ctx.fillStyle = i ? '#d8ccab' : '#c9bd9a';
      ctx.beginPath();
      ctx.ellipse(x + (i - 0.5) * p * 0.1, y - p * 0.05, p * 0.05, p * 0.065, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function moestuin(ctx, x, y, p, v) {
    ctx.fillStyle = '#6a4f30';
    ctx.beginPath();
    ctx.ellipse(x, y, p * 0.17, p * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5f8f3a';
    for (var i = 0; i < 5; i++) {
      var ox = x - p * 0.12 + (i * p * 0.06);
      ctx.beginPath();
      ctx.ellipse(ox, y - p * 0.02 + ((i % 2) * p * 0.02), p * 0.02, p * 0.03, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function waslijn(ctx, x, y, p, v) {
    var w = p * 0.3;
    ctx.strokeStyle = '#8a6e4a';
    ctx.lineWidth = Math.max(1, p * 0.016);
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y); ctx.lineTo(x - w / 2, y - p * 0.2);
    ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y - p * 0.2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(230,220,200,.8)';
    ctx.lineWidth = Math.max(1, p * 0.008);
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y - p * 0.19);
    ctx.quadraticCurveTo(x, y - p * 0.14, x + w / 2, y - p * 0.19);
    ctx.stroke();
    var doeken = ['#d8d2c0', '#b8ccd8', '#d8c0b0'];
    for (var i = 0; i < 3; i++) {
      ctx.fillStyle = doeken[i];
      var ox = x - w * 0.3 + i * w * 0.3;
      ctx.fillRect(ox, y - p * 0.16, p * 0.05, p * 0.08);
    }
  }

  function hek(ctx, x, y, p, v) {
    ctx.strokeStyle = '#8a6e46';
    ctx.lineWidth = Math.max(1, p * 0.018);
    ctx.lineCap = 'round';
    var w = p * 0.34;
    for (var i = 0; i < 3; i++) {
      var ox = x - w / 2 + (i * w) / 2;
      ctx.beginPath();
      ctx.moveTo(ox, y + p * 0.02); ctx.lineTo(ox, y - p * 0.12);
      ctx.stroke();
    }
    ctx.lineWidth = Math.max(1, p * 0.012);
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y - p * 0.09); ctx.lineTo(x + w / 2, y - p * 0.09);
    ctx.stroke();
  }

  function kippen(ctx, x, y, p, v) {
    for (var i = 0; i < 2; i++) {
      var ox = x + (i - 0.5) * p * 0.13;
      var oy = y - p * 0.02 - (i % 2) * p * 0.01;
      ctx.fillStyle = i ? '#e8e2d4' : '#d8b088';
      ctx.beginPath();
      ctx.ellipse(ox, oy - p * 0.03, p * 0.032, p * 0.026, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(ox + p * 0.025, oy - p * 0.052, p * 0.016, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#c0442a';
      ctx.beginPath();
      ctx.arc(ox + p * 0.028, oy - p * 0.065, p * 0.006, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function kruiwagen(ctx, x, y, p, v) {
    ctx.fillStyle = '#8a6236';
    ctx.beginPath();
    ctx.moveTo(x - p * 0.09, y - p * 0.11);
    ctx.lineTo(x + p * 0.09, y - p * 0.11);
    ctx.lineTo(x + p * 0.06, y - p * 0.04);
    ctx.lineTo(x - p * 0.06, y - p * 0.04);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#6a4a28';
    ctx.lineWidth = Math.max(1, p * 0.014);
    ctx.beginPath();
    ctx.arc(x - p * 0.02, y - p * 0.02, p * 0.025, 0, Math.PI * 2);
    ctx.stroke();
  }

  function bank(ctx, x, y, p, v) {
    ctx.fillStyle = '#8a6e46';
    ctx.fillRect(x - p * 0.12, y - p * 0.07, p * 0.24, p * 0.025);
    ctx.fillStyle = '#7a5e38';
    ctx.fillRect(x - p * 0.1, y - p * 0.045, p * 0.02, p * 0.045);
    ctx.fillRect(x + p * 0.08, y - p * 0.045, p * 0.02, p * 0.045);
  }

  function bloemen(ctx, x, y, p, v) {
    var kleuren = ['#e8d05a', '#e07a9a', '#e8e8e8', '#c8a0e0'];
    for (var i = 0; i < 4; i++) {
      var ox = x + (((i * 41 + v * 80) % 40) / 40 - 0.5) * p * 0.24;
      var oy = y - (((i * 23 + v * 50) % 20) / 20) * p * 0.06;
      ctx.strokeStyle = '#5f8f3a';
      ctx.lineWidth = Math.max(1, p * 0.008);
      ctx.beginPath();
      ctx.moveTo(ox, oy); ctx.lineTo(ox, oy - p * 0.05);
      ctx.stroke();
      ctx.fillStyle = kleuren[Math.floor(v * 4 + i) % 4];
      ctx.beginPath();
      ctx.arc(ox, oy - p * 0.055, p * 0.014, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function struik(ctx, x, y, p, v) {
    ctx.fillStyle = '#4f7a34';
    ctx.beginPath();
    ctx.ellipse(x, y - p * 0.05, p * 0.08, p * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5f8f3e';
    ctx.beginPath();
    ctx.ellipse(x - p * 0.03, y - p * 0.07, p * 0.05, p * 0.04, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  /* --------------------------------------------------------------- feest -- */

  /* Bunting and lanterns over the town square while a festival is on. Drawn
     straight from s.feest, so it appears and disappears with the party. */
  P.tekenFeest = function (ctx, cam, s, p) {
    if (!s.feest || s.feest.resterend <= 0 || p < 14) return;
    var plein = null;
    for (var i = 0; i < s.gebouwen.length; i++) {
      if (s.gebouwen[i].type === 'dorpsplein') { plein = s.gebouwen[i]; break; }
    }
    if (!plein) return;

    var d = Game.core.state.def(plein);
    var cx = plein.x + d.grootte / 2, cy = plein.y + d.grootte / 2;
    var mid = cam.wereldNaarScherm(cx * Game.render.TEGEL, cy * Game.render.TEGEL);
    var breedte = p * (d.grootte + 1.2);
    var top = mid.y - p * 0.95;      /* just above the roofs of the square */
    var kleuren = ['#e0603a', '#e8c04a', '#5f9fc0', '#c07ac0'];

    /* A bonfire on the square, and villagers moving in a ring around it. At
       night lanterns and the fire join the warm-window glow (fase 7.1). */
    feestvuur(ctx, cam, s, cx, cy + d.grootte * 0.1, p);
    var nacht = Game.render.sfeer ? Game.render.sfeer.licht(s).nacht : 0;
    for (var r = 0; r < 6; r++) {
      var hoek = r / 6 * Math.PI * 2 + s.tijd * 0.5;
      var rx = cx + Math.cos(hoek) * (d.grootte * 0.5 + 1.1);
      var ry = cy + Math.sin(hoek) * (d.grootte * 0.28 + 0.6);
      var sp = cam.wereldNaarScherm(rx * Game.render.TEGEL, ry * Game.render.TEGEL);
      var kijk = Math.cos(hoek) >= 0 ? 1 : -1;
      Game.render.villagers.teken(ctx, sp.x, sp.y, p * 0.85,
        ['boer', 'werkloos', 'waard'][r % 3], kijk, s.tijd * 6 + r, true, {});
    }
    /* Lanterns strung with the bunting, glowing after dark. */
    if (nacht > 0.3) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (var l = 0; l < 6; l++) {
        var lx = mid.x - breedte / 2 + breedte * (l + 0.5) / 6;
        var ly = top - p * 0.1 + Math.sin(s.tijd * 2 + l) * p * 0.02;
        var g = ctx.createRadialGradient(lx, ly, 0, lx, ly, p * 0.28);
        g.addColorStop(0, 'rgba(255,200,110,' + (0.6 * nacht).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(255,180,80,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(lx, ly, p * 0.28, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    for (var k = -1; k <= 1; k += 2) {
      ctx.strokeStyle = 'rgba(230,220,190,.7)';
      ctx.lineWidth = Math.max(1, p * 0.012);
      ctx.beginPath();
      ctx.moveTo(mid.x - breedte / 2, top + p * 0.22 * k);
      ctx.quadraticCurveTo(mid.x, top + p * 0.55 * k, mid.x + breedte / 2, top + p * 0.22 * k);
      ctx.stroke();

      for (var v = 1; v < 8; v++) {
        var f = v / 8;
        var vx = mid.x - breedte / 2 + breedte * f;
        var vy = top + p * 0.22 * k + Math.sin(f * Math.PI) * p * 0.3 * k +
          Math.sin(s.tijd * 2 + v) * p * 0.01;
        ctx.fillStyle = kleuren[v % 4];
        ctx.beginPath();
        ctx.moveTo(vx - p * 0.05, vy);
        ctx.lineTo(vx + p * 0.05, vy);
        ctx.lineTo(vx, vy + p * 0.13);
        ctx.closePath();
        ctx.fill();
      }
    }
  };

  /* The bonfire itself: a stack of logs, a flickering flame and a warm pool of
     light, plus the odd smoke puff. */
  function feestvuur(ctx, cam, s, wx, wy, p) {
    var sp = cam.wereldNaarScherm(wx * Game.render.TEGEL, wy * Game.render.TEGEL);
    var flikker = 0.75 + 0.25 * Math.sin(s.tijd * 7) + 0.1 * Math.sin(s.tijd * 13);

    /* Warm light on the ground, additive. */
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var g = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, p * 1.1 * flikker);
    g.addColorStop(0, 'rgba(255,190,90,.7)');
    g.addColorStop(1, 'rgba(230,110,40,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(sp.x, sp.y, p * 1.1 * flikker, p * 0.55 * flikker, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    /* Logs. */
    ctx.strokeStyle = '#5a3d22';
    ctx.lineWidth = Math.max(1.5, p * 0.05);
    ctx.lineCap = 'round';
    for (var i = 0; i < 3; i++) {
      var a = i / 3 * Math.PI;
      ctx.beginPath();
      ctx.moveTo(sp.x - Math.cos(a) * p * 0.16, sp.y - Math.sin(a) * p * 0.08);
      ctx.lineTo(sp.x + Math.cos(a) * p * 0.16, sp.y + Math.sin(a) * p * 0.08);
      ctx.stroke();
    }
    /* Flame. */
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var vlam = ['rgba(255,120,40,.9)', 'rgba(255,180,70,.9)', 'rgba(255,230,150,.9)'];
    for (var k = 0; k < 3; k++) {
      ctx.fillStyle = vlam[k];
      var h = p * (0.5 - k * 0.13) * flikker;
      ctx.beginPath();
      ctx.moveTo(sp.x - p * (0.1 - k * 0.03), sp.y);
      ctx.quadraticCurveTo(sp.x + Math.sin(s.tijd * 6 + k) * p * 0.06, sp.y - h, sp.x, sp.y - h);
      ctx.quadraticCurveTo(sp.x - Math.sin(s.tijd * 6 + k) * p * 0.06, sp.y - h, sp.x + p * (0.1 - k * 0.03), sp.y);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    if (Game.render.particles && Math.random() < 0.25) {
      Game.render.particles.emit('vonk', wx * Game.render.TEGEL, wy * Game.render.TEGEL, 1, { spreiding: 3 });
    }
  }

  Game.render.props = P;

})(window.Game);
