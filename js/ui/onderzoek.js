/* The research dialog behind the 📚 button in the top bar. */
(function (Game) {

  var U = {};
  var spel = null;

  U.init = function (hetSpel) { spel = hetSpel; };

  U.menu = function () {
    var s = spel.state;
    var kern = Game.core.onderzoek;

    Game.ui.overlay.open('📚 Onderzoek', function (el) {
      var gilde = Game.core.state.telType(s, 'gildehuis');
      var uni = Game.core.state.telType(s, 'universiteit');

      if (!gilde && !uni) {
        el.appendChild(Game.util.el('p', '', 'Je hebt nog geen plek waar geleerd wordt. ' +
          'Bouw een gildehuis (tijdperk 3) voor het praktische werk, en later een universiteit ' +
          '(tijdperk 4) voor de rest.'));
      } else {
        el.appendChild(Game.util.el('p', '', 'Onderzoek kost eenmalig munten en werkt daarna voor altijd. ' +
          'Dit is waar je volle schatkist voor bedoeld is.'));
      }

      Game.config.onderzoek.forEach(function (def) {
        var klaar = kern.klaar(s, def.id);
        var reden = kern.reden(s, def);
        var kaart = Game.util.el('div', 'onderzoekkaart' + (klaar ? ' gedaan' : (reden ? ' kan-niet' : '')));

        kaart.appendChild(Game.util.el('div', 'onderzoekkop', def.emoji + '  ' + def.naam));
        kaart.appendChild(Game.util.el('div', 'cursief', def.beschrijving));

        var info = Game.util.el('div', 'onderzoekinfo');
        info.innerHTML = 'Kosten: <b>' + Game.ui.stad.kostenTekst(def.kosten) + '</b> · ' +
          'Nodig: <b>' + Game.config.gebouw(def.nodig).naam + '</b>';
        kaart.appendChild(info);

        if (klaar) {
          kaart.appendChild(Game.util.el('div', 'onderzoekklaar', '✔ Afgerond'));
        } else {
          var knop = Game.util.el('button', 'feestknop', reden || 'Onderzoek starten');
          knop.disabled = !!reden;
          knop.addEventListener('click', function () {
            Game.core.onderzoek.koop(spel.state, def.id);
            U.menu();                                  /* redraw with the new state */
            Game.ui.hud.ververs(spel.state);
          });
          kaart.appendChild(knop);
        }
        el.appendChild(kaart);
      });
    }, [{ tekst: '← Terug', primair: true, actie: function () { Game.ui.overlay.sluit(); } }]);
  };

  Game.ui.onderzoek = U;

})(window.Game);
