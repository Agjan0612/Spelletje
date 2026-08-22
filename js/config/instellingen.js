/* The choices you make before the first tree is felled: how big the world is
   and how rough life on it gets. Both are plain data; the chosen ids are
   stored in the save so a loaded town keeps playing by the same rules. */
(function (Game) {

  Game.config.kaartmaten = [
    {
      id: 'klein', naam: 'Klein', emoji: '🗺️', b: 48, h: 36,
      beschrijving: 'Alles dicht bij elkaar. Snel spelen, maar de aders zijn eerder op.'
    },
    {
      id: 'normaal', naam: 'Normaal', emoji: '🗺️', b: 64, h: 48,
      beschrijving: 'De maat waarop het spel is uitgebalanceerd.'
    },
    {
      id: 'groot', naam: 'Groot', emoji: '🗺️', b: 88, h: 64,
      beschrijving: 'Veel land, veel bos, verre mijnen. Voor de lange avond.'
    }
  ];

  Game.config.moeilijkheden = [
    {
      id: 'rustig', naam: 'Rustig', emoji: '🌤️', raid: 0.65, raidRust: 1.35, bereik: 1.35,
      beschrijving: 'Rovers zijn zwakker en komen minder vaak langs, en voorzieningen dragen verder. Bouwen zonder zorgen.'
    },
    {
      id: 'normaal', naam: 'Normaal', emoji: '⚖️', raid: 1, raidRust: 1, bereik: 1,
      beschrijving: 'Het spel zoals het bedoeld is: je moet op tijd verdediging bouwen én je stad netjes indelen.'
    },
    {
      id: 'pittig', naam: 'Pittig', emoji: '⚔️', raid: 1.4, raidRust: 0.75, bereik: 0.85,
      beschrijving: 'Sterkere bendes, vaker, en voorzieningen dragen minder ver. Een muur, een kazerne en een strak stratenplan zijn geen luxe meer.'
    }
  ];

  /* The winter used to be "farms yield nothing and everyone eats a bit more".
     That is a season you wait out. These three turn it into a season you
     prepare for, which is what makes autumn the tensest part of the year. */
  Game.config.winter = {
    /* Firewood burned per villager per second while it freezes. A town of 50
       gets through roughly 70 logs in a winter. */
    houtPerInwoner: 0.012,
    /* No firewood is miserable, and people fall ill. */
    koudeStraf: 20,
    koudeZiekteNa: 40,        /* seconds of cold before someone is lost */

    /* The shallows freeze over. A harbour keeps a channel open. */
    visVorst: 0.4,
    havenStraal: 8,

    /* Food rots all year, faster when it is warm. A granary stops most of it. */
    bederfPerSec: 0.0012,
    bederfZomer: 1.6
  };

  /* What the lord may be told to take. The middle setting is what the rest of
     the balance assumes. */
  Game.config.belastingtarieven = [
    { id: 'laag',    naam: 'Mild',    emoji: '🕊️', factor: 0.5, tevredenheid: 6,
      beschrijving: 'De helft van de gebruikelijke afdracht. Je burgers zijn je dankbaar.' },
    { id: 'normaal', naam: 'Gewoon',  emoji: '⚖️', factor: 1, tevredenheid: 0,
      beschrijving: 'De gebruikelijke afdracht.' },
    { id: 'hoog',    naam: 'Streng',  emoji: '💰', factor: 1.7, tevredenheid: -12,
      beschrijving: 'Bijna twee keer zoveel munten, en een stad die dat merkt.' }
  ];

  Game.config.belastingtarief = function (id) {
    var l = Game.config.belastingtarieven;
    for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
    return l[1];
  };

  Game.config.kaartmaat = function (id) {
    var lijst = Game.config.kaartmaten;
    for (var i = 0; i < lijst.length; i++) if (lijst[i].id === id) return lijst[i];
    return lijst[1];
  };

  Game.config.moeilijkheid = function (id) {
    var lijst = Game.config.moeilijkheden;
    for (var i = 0; i < lijst.length; i++) if (lijst[i].id === id) return lijst[i];
    return lijst[1];
  };

})(window.Game);
