/* Festivals — the friendly mirror of a raid. The player spends food and coins
   to throw a feast that lifts the whole village's mood for a while. It reuses
   the existing `moreel` field (which population.js already folds into the
   happiness target and lets fade away over a couple of minutes), so no new
   happiness machinery is needed. */
(function (Game) {

  var F = {};

  F.COOLDOWN = 120;          /* sim-seconds before another feast can be held */
  F.MOREEL = 16;             /* happiness bump; decays away on its own */

  /* Cost scales with the town so a feast stays a real choice as you grow. */
  F.kosten = function (s) {
    var f = 1 + s.bevolking.totaal / 40;
    return { graan: Math.round(30 * f), munten: Math.round(15 * f) };
  };

  F.cooldown = function (s) { return Math.max(0, (s.feest && s.feest.cooldown) || 0); };

  F.kanVieren = function (s) {
    return F.cooldown(s) <= 0 && Game.core.state.kanBetalen(s, F.kosten(s));
  };

  F.vier = function (s) {
    if (!F.kanVieren(s)) return false;
    Game.core.state.betaal(s, F.kosten(s));
    s.moreel = (s.moreel || 0) + F.MOREEL;
    s.feest.cooldown = F.COOLDOWN;
    s.feest.aantal = (s.feest.aantal || 0) + 1;   /* lets the objectives track "held a feast" */
    Game.ui.log.schrijf(s, '🎉 Er wordt feest gevierd in ' + s.dorpsnaam +
      '! De dorpelingen dansen op het plein.', 'goed');
    Game.ui.toast('🎉 Feest! De tevredenheid stijgt.');
    return true;
  };

  F.tick = function (s, dt) {
    if (!s.feest) s.feest = { cooldown: 0 };
    if (s.feest.cooldown > 0) s.feest.cooldown = Math.max(0, s.feest.cooldown - dt);
  };

  Game.core.feesten = F;

})(window.Game);
