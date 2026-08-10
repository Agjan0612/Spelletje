/* All drawing of terrain and buildings. Shapes are the baseline; where the
   image atlas (js/render/atlas.js) has a sprite loaded it is drawn instead
   (buildings, trees, rocks), otherwise these shapes are the fallback so the
   game still runs straight from a folder even without the assets. */
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

  /* Slight per-tile brightness so a field of grass is not a flat colour. */
  function schakering(kleur, v) {
    var m = kleur.match(/^#(\w\w)(\w\w)(\w\w)$/);
    if (!m) return kleur;
    var f = 0.88 + v * 0.24;
    var r = Game.util.clamp(Math.round(parseInt(m[1], 16) * f), 0, 255);
    var g = Game.util.clamp(Math.round(parseInt(m[2], 16) * f), 0, 255);
    var b = Game.util.clamp(Math.round(parseInt(m[3], 16) * f), 0, 255);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }
  S.schakering = schakering;

  /* -------------------------------------------------------------- terrein */

  S.tekenTegel = function (ctx, tegel, sx, sy, p, seizoen, tijd) {
    ctx.fillStyle = schakering(S.terreinKleur(tegel, seizoen), tegel.v);
    ctx.fillRect(sx, sy, p + 1, p + 1);

    if (p < 12) return;   /* too far zoomed out for detail */

    switch (tegel.t) {
      case 'water': water(ctx, tegel, sx, sy, p, tijd); break;
      case 'bos': bomen(ctx, tegel, sx, sy, p, seizoen); break;
      case 'rots': rotsen(ctx, tegel, sx, sy, p); break;
      case 'berg': berg(ctx, tegel, sx, sy, p); break;
      case 'vruchtbaar': akker(ctx, tegel, sx, sy, p, seizoen); break;
      case 'gras': if (tegel.n === 'wild') wild(ctx, tegel, sx, sy, p); break;
    }

    if (tegel.t === 'berg' && tegel.n && ADERKLEUR[tegel.n]) {
      ader(ctx, tegel, sx, sy, p);
    }
  };

  function water(ctx, t, x, y, p, tijd) {
    ctx.strokeStyle = 'rgba(255,255,255,.18)';
    ctx.lineWidth = Math.max(1, p * 0.05);
    var golf = Math.sin(tijd * 1.3 + t.v * 9) * p * 0.06;
    ctx.beginPath();
    ctx.moveTo(x + p * 0.18, y + p * 0.42 + golf);
    ctx.lineTo(x + p * 0.48, y + p * 0.42 + golf);
    ctx.moveTo(x + p * 0.55, y + p * 0.68 - golf);
    ctx.lineTo(x + p * 0.85, y + p * 0.68 - golf);
    ctx.stroke();
  }

  function bomen(ctx, t, x, y, p, seizoen) {
    var deel = t.max > 0 ? Game.util.clamp(t.amt / t.max, 0, 1) : 0;
    var aantal = Math.max(1, Math.round(1 + deel * 2));
    var bladKleur = ['#2f5c2a', '#2b5526', '#7a5a1e', '#4a5a4a'][seizoen];
    var stam = '#4a3320';

    var atlas = Game.render.atlas;
    for (var i = 0; i < aantal; i++) {
      var ox = x + p * (0.24 + ((i * 37 + t.v * 100) % 55) / 100);
      var oy = y + p * (0.28 + ((i * 61 + t.v * 70) % 45) / 100);

      var img = atlas && atlas.boom(t.v, i);
      if (img) {
        var st = p * (0.62 + deel * 0.24);
        ctx.drawImage(img, ox - st / 2, oy - st * 0.72, st, st);
        continue;
      }

      var r = p * (0.15 + deel * 0.07);
      ctx.fillStyle = stam;
      ctx.fillRect(ox - p * 0.025, oy, p * 0.05, p * 0.16);

      ctx.fillStyle = bladKleur;
      ctx.beginPath();
      ctx.moveTo(ox, oy - r * 1.5);
      ctx.lineTo(ox + r, oy + r * 0.35);
      ctx.lineTo(ox - r, oy + r * 0.35);
      ctx.closePath();
      ctx.fill();
    }

    /* A cleared patch shows as stumps. */
    if (deel < 0.25) {
      ctx.fillStyle = 'rgba(70,50,30,.55)';
      ctx.beginPath();
      ctx.arc(x + p * 0.72, y + p * 0.74, p * 0.06, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function rotsen(ctx, t, x, y, p) {
    var atlas = Game.render.atlas;
    ctx.fillStyle = '#9a968c';
    for (var i = 0; i < 3; i++) {
      var ox = x + p * (0.2 + ((i * 41 + t.v * 90) % 60) / 100);
      var oy = y + p * (0.25 + ((i * 67 + t.v * 60) % 50) / 100);

      var img = atlas && atlas.rots(t.v, i);
      if (img) {
        var rs = p * (0.34 + ((i * 13 + t.v * 30) % 10) / 100);
        ctx.drawImage(img, ox - rs / 2, oy - rs * 0.6, rs, rs);
        continue;
      }

      var r = p * (0.1 + ((i * 13 + t.v * 30) % 8) / 100);
      ctx.beginPath();
      ctx.moveTo(ox - r, oy + r * 0.7);
      ctx.lineTo(ox - r * 0.4, oy - r);
      ctx.lineTo(ox + r * 0.6, oy - r * 0.8);
      ctx.lineTo(ox + r, oy + r * 0.7);
      ctx.closePath();
      ctx.fill();
    }
  }

  function berg(ctx, t, x, y, p) {
    ctx.fillStyle = '#736d63';
    ctx.beginPath();
    ctx.moveTo(x + p * 0.5, y + p * 0.12);
    ctx.lineTo(x + p * 0.95, y + p * 0.9);
    ctx.lineTo(x + p * 0.05, y + p * 0.9);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#cfd4d8';
    ctx.beginPath();
    ctx.moveTo(x + p * 0.5, y + p * 0.12);
    ctx.lineTo(x + p * 0.66, y + p * 0.4);
    ctx.lineTo(x + p * 0.34, y + p * 0.4);
    ctx.closePath();
    ctx.fill();
  }

  function ader(ctx, t, x, y, p) {
    var leeg = t.max > 0 ? Game.util.clamp(t.amt / t.max, 0, 1) : 0;
    if (leeg <= 0.02) return;
    ctx.fillStyle = ADERKLEUR[t.n];
    ctx.globalAlpha = 0.5 + leeg * 0.5;
    for (var i = 0; i < 3; i++) {
      var ox = x + p * (0.3 + ((i * 29 + t.v * 80) % 45) / 100);
      var oy = y + p * (0.45 + ((i * 53 + t.v * 50) % 40) / 100);
      ctx.beginPath();
      ctx.arc(ox, oy, p * 0.055, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function akker(ctx, t, x, y, p, seizoen) {
    if (seizoen === 3) return;
    ctx.strokeStyle = ['rgba(150,180,90,.5)', 'rgba(210,190,80,.6)', 'rgba(220,190,70,.7)', ''][seizoen];
    ctx.lineWidth = Math.max(1, p * 0.045);
    ctx.beginPath();
    for (var i = 1; i < 4; i++) {
      ctx.moveTo(x + p * 0.12, y + p * (i / 4));
      ctx.lineTo(x + p * 0.88, y + p * (i / 4));
    }
    ctx.stroke();
  }

  function wild(ctx, t, x, y, p) {
    if (t.amt <= 0) return;
    ctx.font = Math.round(p * 0.5) + 'px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🦌', x + p * 0.5, y + p * 0.55);
  }

  /* -------------------------------------------------------------- gebouwen */

  /* Draws a building filling the given pixel box. */
  S.tekenGebouw = function (ctx, def, x, y, w, h, opties) {
    opties = opties || {};
    var schaduw = 'rgba(0,0,0,.28)';

    ctx.fillStyle = schaduw;
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h * 0.93, w * 0.42, h * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();

    /* Pretty sprite if the atlas has one loaded; otherwise fall through to the
       hand-drawn shapes below (which also cover the assets-missing case). */
    var img = Game.render.atlas && Game.render.atlas.gebouw(def.id);
    if (img) {
      var teken = w * 1.12;                 /* lift so the roof clears the tile */
      ctx.drawImage(img, x + (w - teken) / 2, y + h - teken, teken, teken);
      return;
    }

    switch (def.id) {
      case 'kasteel': kasteel(ctx, def, x, y, w, h); break;
      case 'kathedraal':
      case 'kerk':
      case 'kapel': kerk(ctx, def, x, y, w, h); break;
      case 'molen': molen(ctx, def, x, y, w, h, opties.tijd || 0); break;
      case 'wachttoren': toren(ctx, def, x, y, w, h); break;
      case 'stadsmuur': muur(ctx, def, x, y, w, h); break;
      case 'universiteit':
      case 'stadhuis':
      case 'dorpsplein': hal(ctx, def, x, y, w, h); break;
      default: huis(ctx, def, x, y, w, h); break;
    }

    /* Icon badge so every building stays recognisable at a glance. */
    if (w >= 26 && def.id !== 'stadsmuur') {
      ctx.font = Math.round(w * 0.34) + 'px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(def.emoji, x + w * 0.5, y + h * 0.34);
    }
  };

  function huis(ctx, def, x, y, w, h) {
    var muurH = h * 0.45;
    ctx.fillStyle = def.muur || '#d8c39a';
    ctx.fillRect(x + w * 0.12, y + h * 0.45, w * 0.76, muurH);
    ctx.strokeStyle = 'rgba(0,0,0,.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + w * 0.12, y + h * 0.45, w * 0.76, muurH);

    ctx.fillStyle = def.dak || '#7c4b2e';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.5, y + h * 0.08);
    ctx.lineTo(x + w * 0.96, y + h * 0.5);
    ctx.lineTo(x + w * 0.04, y + h * 0.5);
    ctx.closePath();
    ctx.fill();

    if (w > 28) {
      ctx.fillStyle = 'rgba(50,30,15,.65)';
      ctx.fillRect(x + w * 0.44, y + h * 0.62, w * 0.13, h * 0.28);
    }
  }

  function hal(ctx, def, x, y, w, h) {
    ctx.fillStyle = def.muur || '#c8b48c';
    ctx.fillRect(x + w * 0.08, y + h * 0.4, w * 0.84, h * 0.5);
    ctx.fillStyle = def.dak || '#8a5a3a';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.02, y + h * 0.44);
    ctx.lineTo(x + w * 0.5, y + h * 0.1);
    ctx.lineTo(x + w * 0.98, y + h * 0.44);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(60,40,20,.6)';
    for (var i = 0; i < 3; i++) {
      ctx.fillRect(x + w * (0.2 + i * 0.23), y + h * 0.58, w * 0.11, h * 0.2);
    }
    ctx.fillStyle = '#d7a94b';
    ctx.fillRect(x + w * 0.47, y + h * 0.02, w * 0.03, h * 0.12);
  }

  function kerk(ctx, def, x, y, w, h) {
    ctx.fillStyle = def.muur || '#e2dac4';
    ctx.fillRect(x + w * 0.2, y + h * 0.42, w * 0.62, h * 0.48);
    ctx.fillStyle = def.dak || '#6a6258';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.16, y + h * 0.45);
    ctx.lineTo(x + w * 0.51, y + h * 0.2);
    ctx.lineTo(x + w * 0.86, y + h * 0.45);
    ctx.closePath();
    ctx.fill();

    /* Bell tower. */
    ctx.fillStyle = def.muur || '#e2dac4';
    ctx.fillRect(x + w * 0.06, y + h * 0.24, w * 0.18, h * 0.66);
    ctx.fillStyle = def.dak || '#6a6258';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.02, y + h * 0.26);
    ctx.lineTo(x + w * 0.15, y + h * 0.02);
    ctx.lineTo(x + w * 0.28, y + h * 0.26);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#d7a94b';
    ctx.lineWidth = Math.max(1, w * 0.025);
    ctx.beginPath();
    ctx.moveTo(x + w * 0.15, y - h * 0.02);
    ctx.lineTo(x + w * 0.15, y + h * 0.1);
    ctx.moveTo(x + w * 0.1, y + h * 0.04);
    ctx.lineTo(x + w * 0.2, y + h * 0.04);
    ctx.stroke();
  }

  function kasteel(ctx, def, x, y, w, h) {
    ctx.fillStyle = def.muur || '#b8b0a2';
    ctx.fillRect(x + w * 0.1, y + h * 0.35, w * 0.8, h * 0.55);
    /* Kantelen */
    ctx.fillStyle = def.muur || '#b8b0a2';
    for (var i = 0; i < 5; i++) {
      ctx.fillRect(x + w * (0.1 + i * 0.17), y + h * 0.26, w * 0.1, h * 0.1);
    }
    /* Torens */
    [0.04, 0.79].forEach(function (fx) {
      ctx.fillStyle = def.muur || '#b8b0a2';
      ctx.fillRect(x + w * fx, y + h * 0.2, w * 0.17, h * 0.7);
      ctx.fillStyle = def.dak || '#5a3a30';
      ctx.beginPath();
      ctx.moveTo(x + w * (fx + 0.085), y + h * 0.02);
      ctx.lineTo(x + w * (fx + 0.19), y + h * 0.22);
      ctx.lineTo(x + w * (fx - 0.01), y + h * 0.22);
      ctx.closePath();
      ctx.fill();
    });
    ctx.fillStyle = 'rgba(50,35,20,.7)';
    ctx.fillRect(x + w * 0.43, y + h * 0.6, w * 0.14, h * 0.3);
  }

  function toren(ctx, def, x, y, w, h) {
    ctx.fillStyle = def.muur || '#a49a8c';
    ctx.fillRect(x + w * 0.28, y + h * 0.24, w * 0.44, h * 0.66);
    ctx.fillStyle = def.dak || '#7a3b2c';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.5, y + h * 0.02);
    ctx.lineTo(x + w * 0.82, y + h * 0.28);
    ctx.lineTo(x + w * 0.18, y + h * 0.28);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(40,25,15,.6)';
    ctx.fillRect(x + w * 0.44, y + h * 0.45, w * 0.12, h * 0.16);
  }

  function muur(ctx, def, x, y, w, h) {
    ctx.fillStyle = def.muur || '#9aa0a6';
    ctx.fillRect(x + w * 0.05, y + h * 0.35, w * 0.9, h * 0.5);
    ctx.fillStyle = def.dak || '#7e848a';
    for (var i = 0; i < 3; i++) {
      ctx.fillRect(x + w * (0.06 + i * 0.32), y + h * 0.22, w * 0.2, h * 0.16);
    }
    ctx.strokeStyle = 'rgba(0,0,0,.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.05, y + h * 0.6);
    ctx.lineTo(x + w * 0.95, y + h * 0.6);
    ctx.stroke();
  }

  function molen(ctx, def, x, y, w, h, tijd) {
    ctx.fillStyle = def.muur || '#d5c7a4';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.34, y + h * 0.3);
    ctx.lineTo(x + w * 0.66, y + h * 0.3);
    ctx.lineTo(x + w * 0.76, y + h * 0.9);
    ctx.lineTo(x + w * 0.24, y + h * 0.9);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = def.dak || '#7c4b2e';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.5, y + h * 0.08);
    ctx.lineTo(x + w * 0.72, y + h * 0.32);
    ctx.lineTo(x + w * 0.28, y + h * 0.32);
    ctx.closePath();
    ctx.fill();

    /* Turning sails. */
    var cx = x + w * 0.5, cy = y + h * 0.34, r = w * 0.36;
    ctx.strokeStyle = '#5c4326';
    ctx.lineWidth = Math.max(1.5, w * 0.05);
    for (var i = 0; i < 4; i++) {
      var a = tijd * 0.9 + i * Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      ctx.stroke();
    }
  }

  /* Construction site: scaffolding plus a progress bar. */
  S.tekenBouwplaats = function (ctx, def, x, y, w, h, deel) {
    ctx.fillStyle = 'rgba(120,95,60,.35)';
    ctx.fillRect(x + w * 0.1, y + h * 0.3, w * 0.8, h * 0.6);

    ctx.strokeStyle = '#a07b46';
    ctx.lineWidth = Math.max(1, w * 0.04);
    ctx.beginPath();
    ctx.moveTo(x + w * 0.14, y + h * 0.9); ctx.lineTo(x + w * 0.14, y + h * 0.25);
    ctx.moveTo(x + w * 0.86, y + h * 0.9); ctx.lineTo(x + w * 0.86, y + h * 0.25);
    ctx.moveTo(x + w * 0.1, y + h * 0.45); ctx.lineTo(x + w * 0.9, y + h * 0.38);
    ctx.moveTo(x + w * 0.1, y + h * 0.7); ctx.lineTo(x + w * 0.9, y + h * 0.66);
    ctx.stroke();

    if (w >= 22) {
      ctx.font = Math.round(w * 0.3) + 'px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = 0.75;
      ctx.fillText(def.emoji, x + w * 0.5, y + h * 0.55);
      ctx.globalAlpha = 1;
    }

    var bx = x + w * 0.12, by = y + h * 0.02, bw = w * 0.76, bh = Math.max(3, h * 0.08);
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = '#d7a94b';
    ctx.fillRect(bx, by, bw * Game.util.clamp(deel, 0, 1), bh);
  };

  Game.render.sprites = S;

})(window.Game);
