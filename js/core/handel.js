/* The travelling merchant. Every so often a caravan arrives at the market and
   stays for a while, offering one trade: surplus for coins, or coins for a
   scarce good. It follows the same rest→arrive→leave rhythm as raids.js, but
   the choice is the player's — the caravan never forces a modal popup, it just
   lights up a button they can open when they like. */
(function (Game) {

  var H = {};

  H.DUUR = 90;               /* sim-seconds the caravan lingers */

  function volgende(s) {
    return 240 - s.tijdperk * 20 + Math.random() * 120;
  }
  H.volgende = volgende;

  /* Possible trades. `geef` is paid by the player, `krijg` is received. */
  var AANBOD = [
    { geef: { hout: 120 }, krijg: { munten: 70 } },
    { geef: { steen: 100 }, krijg: { munten: 80 } },
    { geef: { graan: 150 }, krijg: { munten: 60 } },
    { geef: { munten: 60 }, krijg: { ijzer: 50 } },
    { geef: { munten: 70 }, krijg: { koper: 50 } },
    { geef: { munten: 120 }, krijg: { gereedschap: 35 } },
    { geef: { munten: 160 }, krijg: { edelsteen: 12 } }
  ];

  function maakAanbod() {
    return AANBOD[Math.floor(Math.random() * AANBOD.length)];
  }

  H.aanwezig = function (s) {
    return s.handel && s.handel.fase === 'aanwezig' && !!s.handel.aanbod;
  };

  /* "🪵 120, 🪙 70" for a resource map. */
  H.deelTekst = function (map) {
    var delen = [];
    for (var r in map) {
      var def = Game.config.resources[r];
      delen.push((def ? def.emoji : '') + ' ' + map[r]);
    }
    return delen.join(', ');
  };

  H.accepteer = function (s) {
    var a = s.handel.aanbod;
    if (!a) return { ok: false, reden: 'Er is geen koopman in het dorp' };
    if (!Game.core.state.kanBetalen(s, a.geef)) {
      return { ok: false, reden: 'Je hebt niet genoeg om te ruilen' };
    }
    Game.core.state.betaal(s, a.geef);
    for (var r in a.krijg) Game.core.state.voegToe(s, r, a.krijg[r]);
    s.handel.fase = 'rust';
    s.handel.timer = volgende(s);
    s.handel.aanbod = null;
    Game.ui.log.schrijf(s, '🤝 Geruild met de koopman: ' + H.deelTekst(a.geef) +
      ' voor ' + H.deelTekst(a.krijg) + '.', 'goed');
    Game.ui.toast('🤝 Ruil gesloten');
    return { ok: true };
  };

  H.tick = function (s, dt) {
    if (s.tijdperk < 2) return;             /* the market opens in age 2 */
    if (!s.handel) s.handel = { fase: 'rust', timer: volgende(s), aanbod: null };
    var h = s.handel;

    if (h.fase === 'rust') {
      h.timer -= dt;
      if (h.timer <= 0) {
        h.fase = 'aanwezig';
        h.timer = H.DUUR;
        h.aanbod = maakAanbod();
        Game.ui.log.schrijf(s, '🐴 Een reizende koopman is aangekomen op de marktplaats.');
        Game.ui.toast('🐴 Er is een koopman in het dorp');
      }
      return;
    }

    /* aanwezig */
    h.timer -= dt;
    if (h.timer <= 0) {
      h.fase = 'rust';
      h.timer = volgende(s);
      h.aanbod = null;
      Game.ui.log.schrijf(s, '🐴 De koopman is weer verder getrokken.');
    }
  };

  Game.core.handel = H;

})(window.Game);
