/* Draws the whole scene: terrain, buildings, villagers and overlays. */
(function (Game) {

  var R = {};
  var sprites = Game.render.sprites;
  var map = Game.core.map;

  var canvas, ctx, dpr = 1;

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

  /* ------------------------------------------------------- wandelaars ---- */

  /* Purely decorative villagers walking between their workplace and their
     resource. They carry no simulation weight at all. */
  R.verversWandelaars = function (s) {
    var lijst = [];
    var plein = s.gebouwen.filter(function (g) { return g.type === 'dorpsplein'; })[0];
    var pleinX = plein ? plein.x + 1 : s.start.x;
    var pleinY = plein ? plein.y + 1 : s.start.y;

    for (var i = 0; i < s.gebouwen.length && lijst.length < 70; i++) {
      var g = s.gebouwen[i];
      if (!g.gebouwd) continue;
      var d = Game.core.state.def(g);
      if (!d.banen || g.werkers <= 0) continue;

      var aantal = Math.max(1, Math.round(g.werkers / 2));
      var doelX = pleinX, doelY = pleinY;

      if (d.wint) {
        var t = map.zoekNode(s.kaart, g.x, g.y, d.wint.node, d.wint.straal);
        if (t) {
          var idx = s.kaart.tegels.indexOf(t);
          doelX = idx % s.kaart.b;
          doelY = Math.floor(idx / s.kaart.b);
        }
      }

      for (var n = 0; n < aantal && lijst.length < 70; n++) {
        lijst.push({
          hx: g.x + d.grootte / 2, hy: g.y + d.grootte / 2,
          tx: doelX + 0.5, ty: doelY + 0.5,
          p: Math.random(), richting: Math.random() < 0.5 ? 1 : -1,
          snelheid: 0.09 + Math.random() * 0.07,
          baan: d.banen.baan
        });
      }
    }
    s.wandelaars = lijst;
  };

  R.tickWandelaars = function (s, dt) {
    if (!s.wandelaars) return;
    for (var i = 0; i < s.wandelaars.length; i++) {
      var w = s.wandelaars[i];
      w.p += w.richting * w.snelheid * dt;
      if (w.p > 1) { w.p = 1; w.richting = -1; }
      if (w.p < 0) { w.p = 0; w.richting = 1; }
    }
  };

  /* ------------------------------------------------------------ tekenen -- */

  R.teken = function (s, cam, ui) {
    if (!ctx) return;
    var p = cam.px();

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cam.breedte, cam.hoogte);

    /* Beyond the map edge: deep sea. The map already fades into water at its
       borders, so this reads as open ocean around an island. */
    ctx.fillStyle = ['#27506b', '#295473', '#254a64', '#2b4a5e'][s.seizoen];
    ctx.fillRect(0, 0, cam.breedte, cam.hoogte);

    var zicht = cam.zichtbaar(s.kaart);
    var tijd = s.tijd;

    /* --- terrein --- */
    for (var y = zicht.y0; y < zicht.y1; y++) {
      for (var x = zicht.x0; x < zicht.x1; x++) {
        var tegel = map.tegel(s.kaart, x, y);
        if (!tegel) continue;
        var sp = cam.wereldNaarScherm(x * Game.render.TEGEL, y * Game.render.TEGEL);
        sprites.tekenTegel(ctx, tegel, sp.x, sp.y, p, s.seizoen, tijd);
      }
    }

    /* --- rasterlijnen bij het plaatsen --- */
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

    /* --- gebouwen (van boven naar beneden zodat ze netjes overlappen) --- */
    var gesorteerd = s.gebouwen.slice().sort(function (a, b) { return a.y - b.y; });
    for (var i = 0; i < gesorteerd.length; i++) {
      var g = gesorteerd[i];
      var d = Game.core.state.def(g);
      if (g.x + d.grootte < zicht.x0 || g.x > zicht.x1) continue;
      if (g.y + d.grootte < zicht.y0 || g.y > zicht.y1) continue;

      var sp2 = cam.wereldNaarScherm(g.x * Game.render.TEGEL, g.y * Game.render.TEGEL);
      var w = p * d.grootte, h = p * d.grootte;

      if (g.gebouwd) {
        sprites.tekenGebouw(ctx, d, sp2.x, sp2.y, w, h, { tijd: tijd });
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

    /* --- wandelaars --- */
    if (p > 15) tekenWandelaars(s, cam, p);

    /* --- plaatsings-spook --- */
    if (ui.plaatsType && ui.muisTegel) tekenSpook(s, cam, ui, p);

    /* --- winterse sluier --- */
    if (s.seizoen === 3) {
      ctx.fillStyle = 'rgba(200,220,240,.10)';
      ctx.fillRect(0, 0, cam.breedte, cam.hoogte);
    }
  };

  function tekenWandelaars(s, cam, p) {
    if (!s.wandelaars) return;
    for (var i = 0; i < s.wandelaars.length; i++) {
      var w = s.wandelaars[i];
      var wx = (w.hx + (w.tx - w.hx) * w.p) * Game.render.TEGEL;
      var wy = (w.hy + (w.ty - w.hy) * w.p) * Game.render.TEGEL;
      var sp = cam.wereldNaarScherm(wx, wy);
      if (sp.x < -20 || sp.y < -20 || sp.x > cam.breedte + 20 || sp.y > cam.hoogte + 20) continue;

      var baan = Game.config.jobs[w.baan] || Game.config.jobs.werkloos;
      ctx.fillStyle = 'rgba(0,0,0,.25)';
      ctx.beginPath();
      ctx.ellipse(sp.x, sp.y + p * 0.10, p * 0.09, p * 0.04, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = baan.kleur;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, p * 0.075, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f0e0c0';
      ctx.beginPath();
      ctx.arc(sp.x, sp.y - p * 0.09, p * 0.05, 0, Math.PI * 2);
      ctx.fill();
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
    sprites.tekenGebouw(ctx, d, sp.x, sp.y, w, w, { tijd: s.tijd });
    ctx.globalAlpha = 1;

    ctx.strokeStyle = check.ok ? '#8fdc6a' : '#e0604a';
    ctx.fillStyle = check.ok ? 'rgba(143,220,106,.18)' : 'rgba(224,96,74,.22)';
    ctx.lineWidth = 2;
    ctx.fillRect(sp.x, sp.y, w, w);
    ctx.strokeRect(sp.x + 1, sp.y + 1, w - 2, w - 2);

    /* Show the working radius so you can see whether the trees are in reach. */
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

    ui.plaatsCheck = check;
  }

  /* Tooltip text for a tile, used by the info line under the cursor. */
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
