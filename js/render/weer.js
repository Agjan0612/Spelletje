/* Weather as a render-only state machine — placeholder, filled in fase 3. */
(function (Game) {
  var W = { fase: 'droog' };
  W.tick = function () {};
  W.tekenVoor = function () {};
  W.tekenNa = function () {};
  W.natheid = function () { return 0; };
  Game.render.weer = W;
})(window.Game);
