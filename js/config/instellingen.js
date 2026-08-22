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
