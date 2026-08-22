/* Objectives that walk a first-time player through the opening hours.
   Each quest has a `klaar(state)` predicate; the UI shows the first few
   unfinished ones. Rewards are handed out once. */
(function (Game) {

  function telGebouw(s, id) {
    var n = 0;
    for (var i = 0; i < s.gebouwen.length; i++) {
      if (s.gebouwen[i].type === id && s.gebouwen[i].gebouwd) n++;
    }
    return n;
  }
  Game.config.telGebouw = telGebouw;

  Game.config.quests = [
    {
      id: 'hout',
      tekst: 'Bouw een Houthakkershut naast het bos',
      hint: 'Kies hem onderin het bouwmenu en plaats hem vlak bij bomen.',
      klaar: function (s) { return telGebouw(s, 'houthakkershut') >= 1; },
      beloning: { hout: 20 }
    },
    {
      id: 'werkers',
      tekst: 'Zet dorpelingen aan het werk',
      hint: 'Klik op een gebouw en gebruik de + knop om werkers toe te wijzen.',
      klaar: function (s) { return s.bevolking.werkend >= 3; }
    },
    {
      id: 'huizen',
      tekst: 'Bouw 3 Huisjes zodat je dorp kan groeien',
      hint: 'Nieuwe dorpelingen komen alleen als er woonruimte vrij is.',
      klaar: function (s) { return telGebouw(s, 'huisje') >= 3; },
      beloning: { hout: 40 }
    },
    {
      id: 'voedsel',
      tekst: 'Bouw een Jachthut of Vissershut voor vlees',
      hint: 'Van alleen graan worden je dorpelingen niet vrolijk.',
      klaar: function (s) { return telGebouw(s, 'jachthut') + telGebouw(s, 'vissershut') >= 1; }
    },
    {
      id: 'steen',
      tekst: 'Bouw een Steengroeve bij de rotsen',
      hint: 'Steen heb je nodig voor bijna alles in tijdperk 2.',
      klaar: function (s) { return telGebouw(s, 'steengroeve') >= 1; }
    },
    {
      id: 'winter',
      tekst: 'Ga de winter in met minstens 150 voedsel',
      hint: 'Boerderijen leveren niets in de winter. Vissers wél.',
      klaar: function (s) {
        if (s.seizoen !== 3) return false;
        return (s.res.graan + s.res.brood + s.res.vlees) >= 150;
      },
      beloning: { munten: 40 }
    },
    {
      id: 'tijdperk2',
      tekst: 'Bereik tijdperk 2: het Dorp',
      hint: 'Rechtsboven zie je precies wat je nog nodig hebt.',
      klaar: function (s) { return s.tijdperk >= 2; }
    },
    {
      id: 'brood',
      tekst: 'Bak je eerste brood',
      hint: 'Bouw een Bakkerij en wijs er een bakker aan toe.',
      klaar: function (s) { return s.verzameld.brood >= 1; }
    },
    {
      id: 'mijn',
      tekst: 'Open een IJzermijn en een Kopermijn',
      hint: 'Mijnen moeten dicht bij een ader in de bergen staan.',
      klaar: function (s) { return telGebouw(s, 'ijzermijn') >= 1 && telGebouw(s, 'kopermijn') >= 1; }
    },
    {
      id: 'verdediging',
      tekst: 'Bouw een Wachttoren voordat de rovers komen',
      hint: 'Vanaf tijdperk 2 duiken er bandieten op. Zet hem op de route die ze nemen.',
      klaar: function (s) { return telGebouw(s, 'wachttoren') >= 1; }
    },
    {
      id: 'haven',
      tekst: 'Bouw een Haven aan het water',
      hint: 'Een haven drijft handel over zee en laat vissershutten dichtbij meer vangen.',
      klaar: function (s) { return telGebouw(s, 'haven') >= 1; },
      beloning: { munten: 40 }
    },
    {
      id: 'leger',
      tekst: 'Vorm een leger op een Oefenveld',
      hint: 'Bouw een oefenveld en zet er soldaten op. Een leger kan rovers verslaan in plaats van alleen tegenhouden.',
      klaar: function (s) { return telGebouw(s, 'oefenveld') >= 1 && (s.bevolking.soldaten || 0) >= 1; }
    },
    {
      id: 'feest',
      tekst: 'Geef een feest in je dorp',
      hint: 'Klik op de 🎉-knop rechtsboven en kies een feest. Het tilt het humeur van het hele dorp op.',
      klaar: function (s) { return !!(s.feest && s.feest.aantal >= 1); }
    },
    {
      id: 'tijdperk3',
      tekst: 'Bereik tijdperk 3: de Handelsstad',
      klaar: function (s) { return s.tijdperk >= 3; }
    },
    {
      id: 'rovers_verslagen',
      tekst: 'Versla een roversbende met je leger',
      hint: 'Met genoeg legerkracht win je beslissend — of beveel een uitval tijdens de aanval.',
      klaar: function (s) { return !!(s.leger && s.leger.overwinningen >= 1); },
      beloning: { munten: 60 }
    },
    {
      id: 'samen',
      tekst: 'Bouw een hecht dorp (70% samenhorigheid)',
      hint: 'Bouw dicht om het dorpsplein heen in plaats van verspreid over de kaart.',
      klaar: function (s) { return (s.samenhorigheid || 0) >= 0.7; },
      beloning: { munten: 40 }
    },
    {
      id: 'gereedschap',
      tekst: 'Smeed gereedschap in de Smederij',
      hint: 'Gereedschap versnelt al je mijnen en groeven met tot 30%.',
      klaar: function (s) { return s.verzameld.gereedschap >= 20; }
    },
    {
      id: 'edelsteen',
      tekst: 'Delf je eerste edelstenen',
      klaar: function (s) { return s.verzameld.edelsteen >= 10; }
    },
    {
      id: 'tijdperk4',
      tekst: 'Bereik tijdperk 4: de Middeleeuwse stad',
      klaar: function (s) { return s.tijdperk >= 4; }
    },
    {
      id: 'kathedraal',
      tekst: 'Voltooi de Kathedraal',
      klaar: function (s) { return telGebouw(s, 'kathedraal') >= 1; }
    },
    {
      id: 'kasteel',
      tekst: 'Voltooi het Kasteel',
      klaar: function (s) { return telGebouw(s, 'kasteel') >= 1; }
    },
    {
      id: 'stad',
      tekst: 'Laat 100 inwoners in je stad wonen',
      klaar: function (s) { return s.bevolking.totaal >= 100; }
    }
  ];

})(window.Game);
