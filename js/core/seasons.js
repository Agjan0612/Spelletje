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
      s.seizoen = seizoen;
      Game.ui.log.schrijf(s, BOODSCHAP[seizoen], seizoen === 3 ? 'slecht' : '');

      if (seizoen === 3) {
        var dagen = Game.core.population.voedselDagen(s);
        if (dagen < 4) {
          Game.ui.toast('❄️ De winter is er — en je voorraad is krap!');
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
