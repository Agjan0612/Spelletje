/* Minimap: a small overview of terrain, buildings, the current view and the
 * direction any raid is coming from. Click to move the camera.
 *
 * The terrain is rendered once to an offscreen canvas and cached (keyed on
 * seed + season) so refreshing only redraws the cheap dynamic overlays. Nothing
 * is stored in Game.state. */
(function (Game) {

  var M = {};

  var canvas, ctx, spel;
  var terrein = { seed: null, seizoen: -1, canvas: null };
  var schaal = 1, offX = 0, offY = 0, kaartB = 1, kaartH = 1;

  M.init = function (s) {
    spel = s;
    canvas = document.getElementById('minimap');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    /* Match the backing store to the CSS box for crisp pixels. */
    canvas.width = canvas.clientWidth || 172;
    canvas.height = canvas.clientHeight || 129;

    canvas.addEventListener('click', function (ev) {
      if (!spel.state) return;
      var r = canvas.getBoundingClientRect();
      var tx = (ev.clientX - r.left - offX) / schaal;
      var ty = (ev.clientY - r.top - offY) / schaal;
      spel.cam.centreerOpTegel(tx, ty);
      spel.cam.begrens(spel.state.kaart);
    });
  };

  function bouwTerrein(s) {
    var kaart = s.kaart;
    if (terrein.seed === kaart.seed && terrein.seizoen === s.seizoen && terrein.canvas) return;

    kaartB = kaart.b; kaartH = kaart.h;
    schaal = Math.min(canvas.width / kaart.b, canvas.height / kaart.h);
    offX = (canvas.width - kaart.b * schaal) / 2;
    offY = (canvas.height - kaart.h * schaal) / 2;

    var oc = terrein.canvas || document.createElement('canvas');
    oc.width = canvas.width; oc.height = canvas.height;
    var octx = oc.getContext('2d');
    octx.clearRect(0, 0, oc.width, oc.height);

    var ps = Math.ceil(schaal) + 1;
    for (var y = 0; y < kaart.h; y++) {
      for (var x = 0; x < kaart.b; x++) {
        var t = kaart.tegels[y * kaart.b + x];
        octx.fillStyle = Game.render.sprites.terreinKleur(t, s.seizoen);
        octx.fillRect(offX + x * schaal, offY + y * schaal, ps, ps);
      }
    }
    terrein = { seed: kaart.seed, seizoen: s.seizoen, canvas: oc };
  }

  M.ververs = function (s) {
    if (!ctx || !s) return;
    bouwTerrein(s);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(terrein.canvas, 0, 0);

    /* Buildings: the town square gold, others a soft parchment dot. */
    for (var i = 0; i < s.gebouwen.length; i++) {
      var g = s.gebouwen[i];
      if (!g.gebouwd) continue;
      var d = Game.core.state.def(g);
      ctx.fillStyle = g.type === 'dorpsplein' ? '#f0cd7f' : 'rgba(240,225,190,.9)';
      var sz = Math.max(1.5, d.grootte * schaal);
      ctx.fillRect(offX + g.x * schaal, offY + g.y * schaal, sz, sz);
    }

    /* Raid approach: a red line from the edge to the town while announced. */
    if (s.tijdperk >= 2 && s.raid && s.raid.fase === 'waarschuwing' && s.raid.vanaf) {
      var cor = Game.core.raids.corridor(s);
      if (cor) {
        ctx.strokeStyle = 'rgba(224,96,74,.9)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(offX + cor.ax * schaal, offY + cor.ay * schaal);
        ctx.lineTo(offX + cor.bx * schaal, offY + cor.by * schaal);
        ctx.stroke();
      }
    }

    /* Camera viewport outline. In iso the visible area is a rotated quad, so we
       trace the four screen corners un-projected into tile space rather than a
       single rectangle. */
    var cam = spel.cam;
    var TEGEL = Game.render.TEGEL;
    var hoeken = [
      cam.schermNaarWereld(0, 0),
      cam.schermNaarWereld(cam.breedte, 0),
      cam.schermNaarWereld(cam.breedte, cam.hoogte),
      cam.schermNaarWereld(0, cam.hoogte)
    ];
    ctx.strokeStyle = 'rgba(255,255,255,.85)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var h = 0; h < hoeken.length; h++) {
      var px = offX + (hoeken[h].x / TEGEL) * schaal;
      var py = offY + (hoeken[h].y / TEGEL) * schaal;
      if (h === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  };

  M.teken = function () {};   /* kept for API symmetry */

  Game.render.minimap = M;

})(window.Game);
