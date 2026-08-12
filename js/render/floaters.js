/* Floating "+🪵" numbers that rise out of a building when a villager delivers
   what they gathered. Purely decorative: nothing here touches Game.state, the
   list lives only in this module, so a save stays pure JSON. Callers guard on
   Game.render.floaters existing, so the game runs fine without this file. */
(function (Game) {

  var F = {};
  var lijst = [];          /* { wx, wy, tekst, kleur, leven, duur } in world px */
  var MAX = 60;

  /* Spawn one floater at a world-pixel position. */
  F.spat = function (wx, wy, tekst, kleur) {
    lijst.push({ wx: wx, wy: wy, tekst: tekst, kleur: kleur || '#f0e6cc', leven: 0, duur: 1.1 });
    if (lijst.length > MAX) lijst.splice(0, lijst.length - MAX);
  };

  F.tick = function (dt) {
    for (var i = lijst.length - 1; i >= 0; i--) {
      var f = lijst[i];
      f.leven += dt;
      f.wy -= dt * 16;                      /* drift upwards */
      if (f.leven >= f.duur) lijst.splice(i, 1);
    }
  };

  F.teken = function (ctx, cam) {
    if (!lijst.length) return;
    var p = cam.px();
    if (p < 15) return;                     /* too far out to read numbers */
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = Math.round(p * 0.34) + 'px system-ui, sans-serif';
    for (var i = 0; i < lijst.length; i++) {
      var f = lijst[i];
      var sp = cam.wereldNaarScherm(f.wx, f.wy);
      if (sp.x < -30 || sp.y < -30 || sp.x > cam.breedte + 30 || sp.y > cam.hoogte + 30) continue;
      var t = f.leven / f.duur;
      ctx.globalAlpha = t < 0.15 ? t / 0.15 : (1 - (t - 0.15) / 0.85);
      ctx.lineWidth = Math.max(2, p * 0.06);
      ctx.strokeStyle = 'rgba(0,0,0,.45)';
      ctx.strokeText(f.tekst, sp.x, sp.y);
      ctx.fillStyle = f.kleur;
      ctx.fillText(f.tekst, sp.x, sp.y);
    }
    ctx.globalAlpha = 1;
  };

  F.leeg = function () { lijst.length = 0; };

  Game.render.floaters = F;

})(window.Game);
