/* Research: turns the studies bought in the guild hall and the university
   into the multipliers the rest of the simulation already knows how to use.

   `s.onderzoek` is nothing but a set of ids ({ ijzerenPloeg: true }), so it
   survives JSON like everything else. The bonuses themselves are derived —
   recomputed by state.herbereken(), never stored authoritatively. */
(function (Game) {

  var O = {};

  var GEEN = {
    productie: 1, voedsel: 1, mijnbouw: 1, bouw: 1,
    verdediging: 1, winter: 1, opslag: 1, tevredenheid: 0
  };

  O.def = function (id) {
    var lijst = Game.config.onderzoek;
    for (var i = 0; i < lijst.length; i++) if (lijst[i].id === id) return lijst[i];
    return null;
  };

  O.klaar = function (s, id) { return !!(s.onderzoek && s.onderzoek[id]); };

  /* The combined effect of everything researched so far. */
  O.bonus = function (s) {
    var b = {
      productie: 1, voedsel: 1, mijnbouw: 1, bouw: 1,
      verdediging: 1, winter: 1, opslag: 1, tevredenheid: 0
    };
    if (!s.onderzoek) return b;

    for (var id in s.onderzoek) {
      var def = O.def(id);
      if (!def || !s.onderzoek[id]) continue;
      for (var sleutel in def.effect) {
        if (sleutel === 'tevredenheid') b.tevredenheid += def.effect[sleutel];
        else if (b[sleutel] !== undefined) b[sleutel] *= def.effect[sleutel];
      }
    }
    return b;
  };
  O.GEEN = GEEN;

  /* Which building has to stand before this study can be started. */
  O.heeftGebouw = function (s, def) {
    return Game.core.state.telType(s, def.nodig) > 0;
  };

  O.reden = function (s, def) {
    if (O.klaar(s, def.id)) return 'Al onderzocht';
    if (!O.heeftGebouw(s, def)) {
      return 'Vereist een ' + Game.config.gebouw(def.nodig).naam.toLowerCase();
    }
    if (!Game.core.state.kanBetalen(s, def.kosten)) return 'Te weinig grondstoffen';
    return null;
  };

  O.kanKopen = function (s, def) { return O.reden(s, def) === null; };

  O.koop = function (s, id) {
    var def = O.def(id);
    if (!def || !O.kanKopen(s, def)) return false;

    Game.core.state.betaal(s, def.kosten);
    s.onderzoek = s.onderzoek || {};
    s.onderzoek[id] = true;
    Game.core.state.herbereken(s);

    Game.ui.log.schrijf(s, def.emoji + ' Onderzoek afgerond: ' + def.naam + '.', 'goed');
    Game.ui.toast(def.emoji + ' ' + def.naam);
    if (Game.ui.audio && Game.ui.audio.klok) Game.ui.audio.klok(520);
    return true;
  };

  /* How many studies are open right now — used for the badge on the button. */
  O.beschikbaar = function (s) {
    return Game.config.onderzoek.filter(function (def) { return O.kanKopen(s, def); }).length;
  };

  Game.core.onderzoek = O;

})(window.Game);
