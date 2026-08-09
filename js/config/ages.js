/* The four ages and what it takes to reach them.
   `verzameld` looks at cumulative production, so spending resources never
   undoes progress towards the next age. */
(function (Game) {

  Game.config.ages = [
    {
      nr: 1, naam: 'Nederzetting', emoji: '🏕️',
      motto: 'Een handvol mensen, een boerderij en heel veel bos.'
    },
    {
      nr: 2, naam: 'Dorp', emoji: '🏘️',
      motto: 'Er staan huizen op een rij en de eerste rook kringelt uit de bakkerij.',
      eisen: {
        bevolking: 14,
        tevredenheid: 45,
        verzameld: { hout: 400, steen: 120, vlees: 150 },
        gebouwen: { huisje: 3, houthakkershut: 1, boerderij: 1, steengroeve: 1 }
      },
      kosten: { hout: 120, steen: 60 }
    },
    {
      nr: 3, naam: 'Handelsstad', emoji: '🏙️',
      motto: 'Kooplieden komen van ver, en de klokken van de kapel luiden over de daken.',
      eisen: {
        bevolking: 32,
        tevredenheid: 55,
        verzameld: { hout: 1400, steen: 800, brood: 300, ijzer: 120, koper: 120 },
        gebouwen: { bakkerij: 1, marktplaats: 1, kapel: 1, ijzermijn: 1, kopermijn: 1 }
      },
      kosten: { hout: 300, steen: 250, munten: 100 }
    },
    {
      nr: 4, naam: 'Middeleeuwse stad', emoji: '🏰',
      motto: 'Muren, gilden en een smidse die dag en nacht klinkt.',
      eisen: {
        bevolking: 60,
        tevredenheid: 60,
        verzameld: { steen: 2500, gereedschap: 150, edelsteen: 40, munten: 400 },
        gebouwen: { smederij: 1, kerk: 1, kazerne: 1, edelsteenmijn: 1, gildehuis: 1 }
      },
      kosten: { steen: 600, hout: 400, gereedschap: 60, munten: 300 }
    }
  ];

  /* Final goal: once these are met in age 4 the player has "won"
     (and can happily keep building afterwards). */
  Game.config.eindDoel = {
    bevolking: 100,
    tevredenheid: 70,
    gebouwen: { kathedraal: 1, kasteel: 1, universiteit: 1, stadhuis: 1 }
  };

  Game.config.age = function (nr) {
    return Game.config.ages[Game.util.clamp(nr - 1, 0, Game.config.ages.length - 1)];
  };

})(window.Game);
