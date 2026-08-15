/* The calendar: days, seasons and years, plus what the season does to work. */
(function (Game) {

  var Z = {};

  /* Lente, Zomer, Herfst, Winter */
  var AKKER = [0.75, 1.25, 1.35, 0.0];
  var JACHT = [1.05, 1.00, 1.15, 0.50];

  var BOODSCHAP = [
    '🌱 De lente breekt aan. De akkers komen weer tot leven.',
    '☀️ Het is zomer. De oogst staat er goed bij.',
    '🍂 De herfst begint — dé tijd om voorraad aan te leggen voor de winter.',
    '❄️ De winter valt in. De akkers leveren niets meer en er wordt meer gegeten.'
  ];

  Z.factor = function (s, soort) {
    return (soort === 'akker' ? AKKER : JACHT)[s.seizoen] || 0;
  };

  Z.tick = function (s, dt) {
    var S = Game.core.state;
    s.tijd += dt;

    var totaalDagen = Math.floor(s.tijd / S.DAG);
    if (totaalDagen === s.dag) return;
    s.dag = totaalDagen;

    var seizoen = Math.floor(totaalDagen / S.DAGEN_PER_SEIZOEN) % 4;
    var jaar = Math.floor(totaalDagen / (S.DAGEN_PER_SEIZOEN * 4)) + 1;

    if (seizoen !== s.seizoen) {
      var vorig = s.seizoen;
      s.seizoen = seizoen;
      Game.ui.log.schrijf(s, BOODSCHAP[seizoen], seizoen === 3 ? 'slecht' : '');

      if (seizoen === 3) {
        s.hongerDitWinter = false;   /* start the winter with a clean slate */
        var dagen = Game.core.population.voedselDagen(s);
        if (dagen < 4) {
          Game.ui.toast('❄️ De winter is er — en je voorraad is krap!');
        }
      }

      /* Leaving winter for spring: a whole winter without a famine is a real
         achievement — reward the streak, the moment the game most tests you. */
      if (vorig === 3 && seizoen === 0 && s.bevolking.totaal > 3) {
        if (!s.hongerDitWinter) {
          s.wintersOverleefd = (s.wintersOverleefd || 0) + 1;
          s.hongervrijeWinters = (s.hongervrijeWinters || 0) + 1;
          s.moreel = (s.moreel || 0) + 3;
          if (s.hongervrijeWinters % 3 === 0) {
            Game.ui.toast('❄️ → 🌱 ' + s.hongervrijeWinters + ' winters op rij zonder honger!');
            if (Game.ui.audio && Game.ui.audio.fanfare) Game.ui.audio.fanfare();
            Game.ui.log.schrijf(s, '🌱 Alweer een winter goed doorstaan — je dorp bloeit op. (' +
              s.hongervrijeWinters + ' op rij)', 'goed');
          }
        } else {
          s.hongervrijeWinters = 0;
        }
      }
    }

    if (jaar !== s.jaar) {
      s.jaar = jaar;
      Game.ui.log.schrijf(s, '📜 Er breekt een nieuw jaar aan: jaar ' + jaar + '.');
    }
  };

  Z.naam = function (s) {
    return Game.core.state.SEIZOENEN[s.seizoen] + ', jaar ' + s.jaar;
  };

  Z.emoji = function (s) {
    return Game.core.state.SEIZOEN_EMOJI[s.seizoen];
  };

  Game.core.seasons = Z;

})(window.Game);
