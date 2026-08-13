/* Little events that make the town feel lived-in and whole: a travelling
   merchant who drops by now and then, and festivals the player can throw on
   the town square. All state here is plain JSON (timers and counters), and
   nothing blocks the simulation, so headless playtests keep running. */
(function (Game) {

  var E = {};

  /* A festival: bread and coin spent on a village-wide celebration, repaid in
     a burst of morale that then fades like any other. */
  E.FEEST_KOSTEN = { munten: 20, graan: 40 };
  E.FEEST_COOLDOWN = 120;   /* seconds before you can throw the next one */
  E.MOREEL_PLAFOND = 30;    /* morale never piles up past this from feasting */

  E.tick = function (s, dt) {
    zorg(s);

    if (s.feest.cooldown > 0) s.feest.cooldown = Math.max(0, s.feest.cooldown - dt);

    /* Traders only bother once there is a village worth the trip. */
    if (s.tijdperk < 2) return;
    s.koopman.timer -= dt;
    if (s.koopman.timer <= 0) {
      s.koopman.timer = 240 + Math.random() * 180;
      bezoek(s);
    }
  };

  function zorg(s) {
    if (!s.feest) s.feest = { cooldown: 0 };
    if (typeof s.feest.cooldown !== 'number') s.feest.cooldown = 0;
    if (!s.koopman) s.koopman = { timer: 120 + Math.random() * 120 };
    if (typeof s.koopman.timer !== 'number') s.koopman.timer = 180;
  }
  E.zorg = zorg;

  /* The merchant either buys up whatever you have too much of, or — if your
     stores are lean — arrives with a small gift and good cheer. */
  function bezoek(s) {
    var overschot = grootsteOverschot(s);
    if (overschot) {
      var res = overschot.res;
      var weg = Math.min(s.res[res], Math.round(overschot.hoeveelheid));
      s.res[res] -= weg;
      var prijs = Game.config.resources[res].primair ? 0.5 : 0.8;
      var munten = Math.max(1, Math.round(weg * prijs));
      Game.core.state.voegToe(s, 'munten', munten);
      s.moreel = clampMoreel((s.moreel || 0) + 4);
      Game.ui.log.schrijf(s, '🧳 Een reizende koopman kocht ' + weg + ' ' +
        Game.config.resources[res].naam.toLowerCase() + ' voor ' + munten + ' munten.', 'goed');
      Game.ui.toast('🧳 De koopman is langs geweest');
      return;
    }

    /* Lean stores: a friendly caravan leaves a modest gift behind. */
    var gift = Game.config.resources.gereedschap && s.tijdperk >= 3 ? 'gereedschap' : 'hout';
    var aantal = gift === 'gereedschap' ? 8 : 40;
    Game.core.state.voegToe(s, gift, aantal);
    s.moreel = clampMoreel((s.moreel || 0) + 5);
    Game.ui.log.schrijf(s, '🧳 Een reizende koopman deelde nieuws en liet ' + aantal + ' ' +
      Game.config.resources[gift].naam.toLowerCase() + ' achter.', 'goed');
    Game.ui.toast('🧳 De koopman is langs geweest');
  }

  /* The primary good you are most drowning in (over ~60% of the cap), if any. */
  function grootsteOverschot(s) {
    var beste = null;
    Game.config.resourceOrder.forEach(function (r) {
      if (r === 'munten') return;
      if (!Game.config.resources[r].primair) return;
      var deel = s.res[r] / Math.max(1, s.capaciteit);
      if (deel < 0.6) return;
      if (!beste || s.res[r] > beste.amt) beste = { res: r, amt: s.res[r] };
    });
    if (!beste) return null;
    return { res: beste.res, hoeveelheid: beste.amt * 0.25 };
  }

  function clampMoreel(m) {
    return Math.min(E.MOREEL_PLAFOND, m);
  }

  /* ---- festival, triggered from the town-square panel --------------------- */

  E.kanFeest = function (s) {
    zorg(s);
    if (s.feest.cooldown > 0) return { ok: false, reden: 'Nog even wachten (' + Math.ceil(s.feest.cooldown) + 's)' };
    if (!Game.core.state.kanBetalen(s, E.FEEST_KOSTEN)) return { ok: false, reden: 'Te weinig munten of graan' };
    return { ok: true };
  };

  E.feest = function (s) {
    var check = E.kanFeest(s);
    if (!check.ok) return check;
    Game.core.state.betaal(s, E.FEEST_KOSTEN);
    s.feest.cooldown = E.FEEST_COOLDOWN;
    s.feest.aantal = (s.feest.aantal || 0) + 1;
    s.moreel = clampMoreel((s.moreel || 0) + 16);
    Game.ui.log.schrijf(s, '🎉 Feest op het dorpsplein! De hele gemeenschap viert samen.', 'goed');
    Game.ui.toast('🎉 Er wordt feestgevierd!');
    if (Game.ui.audio && Game.ui.audio.klok) Game.ui.audio.klok();
    return { ok: true };
  };

  Game.core.events = E;

})(window.Game);
