/* Scenarios: the same simulation, a different problem.
 *
 * Everything the game already had — map sizes, difficulties, seeds, the age
 * ladder — was one long build-up to the same ending. A scenario keeps all of
 * that and changes only the starting position and what counts as winning, so
 * a handful of lines here buys a whole new evening.
 *
 * Fields:
 *   start        overrides for state.nieuw: resources, extra buildings,
 *                headcount, season, starting age
 *   regels       rules the simulation reads: forbidden buildings, a fixed
 *                difficulty, a map that must contain (or lack) something
 *   doel         { tekst, klaar(s), faal(s) } — klaar wins it, faal loses it
 *   tijdslimiet  in-game years, optional
 */
(function (Game) {

  function telGebouw(s, id) { return Game.core.state.telType(s, id); }

  Game.config.scenarios = [
    {
      id: 'vrij', naam: 'Vrij spel', emoji: '🏞️',
      korte: 'Bouw je stad zoals je wilt.',
      beschrijving: 'Het spel zoals het bedoeld is: begin met een boerderij en een huisje, ' +
        'en bouw door tot je stad af is. Geen klok, geen extra regels.',
      doel: null
    },

    {
      id: 'kust', naam: 'Vijf winters aan de kust', emoji: '❄️',
      korte: 'Geen vruchtbare grond. Leef van de zee.',
      beschrijving: 'Je bent gestrand op een kale kust. Er is geen akkerland dat de moeite waard is: ' +
        'alles moet van het water komen, en elke winter bevriest dat water. Houd het vijf jaar vol ' +
        'met minstens dertig inwoners.',
      start: { res: { hout: 260, steen: 120, vlees: 140, munten: 80 }, bevolking: 8 },
      regels: { verboden: ['boerderij', 'hoeve'], moeilijkheid: 'rustig', kaart: 'klein' },
      doel: {
        tekst: 'Overleef tot jaar 6 met 30 inwoners',
        klaar: function (s) { return s.jaar >= 6 && s.bevolking.totaal >= 30; },
        faal: function (s) { return s.bevolking.totaal <= 2; }
      }
    },

    {
      id: 'kathedraal', naam: 'De kathedraal van Sint-Alwin', emoji: '⛪',
      korte: 'Eén bouwwerk, twintig jaar.',
      beschrijving: 'De bisschop heeft je stad uitverkoren. Bouw de kathedraal binnen twintig jaar — ' +
        'je begint met een dorp dat al staat, maar de klok loopt vanaf het eerste ogenblik.',
      start: {
        res: { hout: 500, steen: 400, graan: 200, vlees: 150, munten: 150 },
        bevolking: 18, tijdperk: 2,
        gebouwen: ['huisje', 'huisje', 'huisje', 'houthakkershut', 'steengroeve', 'waterput']
      },
      tijdslimiet: 20,
      doel: {
        tekst: 'Voltooi de kathedraal vóór jaar 21',
        klaar: function (s) { return telGebouw(s, 'kathedraal') >= 1; }
      }
    },

    {
      id: 'wolven', naam: 'Het jaar van de wolven', emoji: '🐺',
      korte: 'Drie keer zoveel rovers. Hou stand.',
      beschrijving: 'De streek is vergeven van roversbenden en ze weten je te vinden. Je bouwt geen ' +
        'handelsstad — je bouwt een bolwerk. Versla tien bendes.',
      start: { res: { hout: 350, steen: 250, vlees: 120, ijzer: 60, munten: 100 }, bevolking: 14, tijdperk: 2 },
      regels: { moeilijkheid: 'pittig', roverTempo: 0.35 },
      doel: {
        tekst: 'Versla tien roversbendes',
        klaar: function (s) { return (s.leger && s.leger.overwinningen >= 10); },
        faal: function (s) { return s.bevolking.totaal <= 3; }
      }
    },

    {
      id: 'vluchtelingen', naam: 'De vluchtelingen', emoji: '🧳',
      korte: 'Veertig monden, niets om ze te voeden.',
      beschrijving: 'Er zijn veertig mensen aan komen lopen met niets dan wat ze droegen. Er is nauwelijks ' +
        'voorraad en er staat bijna niets. Breng ze door het eerste jaar heen zonder dat er meer dan ' +
        'vijf omkomen.',
      start: { res: { hout: 200, steen: 60, vlees: 90, graan: 60, munten: 20 }, bevolking: 40 },
      regels: { moeilijkheid: 'rustig' },
      doel: {
        tekst: 'Bereik jaar 3 met minstens 35 inwoners',
        klaar: function (s) { return s.jaar >= 3 && s.bevolking.totaal >= 35; },
        faal: function (s) { return s.bevolking.totaal < 35 && s.jaar >= 3; }
      }
    }
  ];

  Game.config.scenario = function (id) {
    var l = Game.config.scenarios;
    for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
    return l[0];
  };

})(window.Game);
