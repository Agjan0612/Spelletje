/* Mijlpalen — collectable achievements, the same klaar(state) pattern the
 * quests use, but permanent and worth Faam. Pure data: id, look, a predicate
 * and the Faam it awards. The trophy cabinet (menu) shows which are earned,
 * and earned badges persist across games in localStorage. */
(function (Game) {

  function telGebouwd(s) {
    var n = 0;
    for (var i = 0; i < s.gebouwen.length; i++) if (s.gebouwen[i].gebouwd) n++;
    return n;
  }

  Game.config.mijlpalen = [
    { id: 'eerste_winter', emoji: '🥶', titel: 'De eerste winter',
      beschrijving: 'Breng je dorp ongeschonden door zijn eerste winter.',
      faam: 30, klaar: function (s) { return (s.wintersOverleefd || 0) >= 1; } },
    { id: 'winterhard', emoji: '❄️', titel: 'Winterhard',
      beschrijving: 'Overleef vijf winters zonder ook maar één hongersnood.',
      faam: 70, klaar: function (s) { return (s.wintersOverleefd || 0) >= 5; } },
    { id: 'dorp', emoji: '🏘️', titel: 'Een echt dorp',
      beschrijving: 'Bereik tijdperk 2.',
      faam: 40, klaar: function (s) { return s.tijdperk >= 2; } },
    { id: 'handelsstad', emoji: '🏙️', titel: 'Handelsstad',
      beschrijving: 'Bereik tijdperk 3.',
      faam: 70, klaar: function (s) { return s.tijdperk >= 3; } },
    { id: 'metropool', emoji: '🏰', titel: 'Middeleeuwse stad',
      beschrijving: 'Bereik tijdperk 4.',
      faam: 120, klaar: function (s) { return s.tijdperk >= 4; } },
    { id: 'snelle_start', emoji: '⚡', titel: 'Voortvarend',
      beschrijving: 'Bereik tijdperk 2 vóór het einde van jaar 4.',
      faam: 90, klaar: function (s) { return s.tijdperk >= 2 && s.jaar <= 4; } },
    { id: 'honderd', emoji: '👥', titel: 'Honderd zielen',
      beschrijving: 'Laat honderd inwoners in je stad wonen.',
      faam: 90, klaar: function (s) { return s.bevolking.totaal >= 100; } },
    { id: 'bouwmeester', emoji: '🧱', titel: 'Bouwmeester',
      beschrijving: 'Heb dertig voltooide gebouwen tegelijk staan.',
      faam: 60, klaar: function (s) { return telGebouwd(s) >= 30; } },
    { id: 'verdediger', emoji: '🛡️', titel: 'Verdediger',
      beschrijving: 'Verjaag vijf roversaanvallen.',
      faam: 70, klaar: function (s) { return (s.raidsVerjaagd || 0) >= 5; } },
    { id: 'onaantastbaar', emoji: '⚔️', titel: 'Onaantastbaar',
      beschrijving: 'Sla tien aanvallen op rij af, zonder één doorbraak.',
      faam: 130, klaar: function (s) { return (s.roversStreak || 0) >= 10; } },
    { id: 'bosbouwer', emoji: '🌲', titel: 'Houtrijk',
      beschrijving: 'Verzamel in totaal 2000 hout.',
      faam: 40, klaar: function (s) { return (s.verzameld.hout || 0) >= 2000; } },
    { id: 'ambachtsman', emoji: '🔨', titel: 'Meestersmid',
      beschrijving: 'Smeed in totaal 500 gereedschap.',
      faam: 60, klaar: function (s) { return (s.verzameld.gereedschap || 0) >= 500; } },
    { id: 'rijk', emoji: '🪙', titel: 'Welgesteld',
      beschrijving: 'Verdien in totaal 1000 munten.',
      faam: 60, klaar: function (s) { return (s.verzameld.munten || 0) >= 1000; } },
    { id: 'juwelen', emoji: '💎', titel: 'Schatkamer',
      beschrijving: 'Delf in totaal 100 edelstenen.',
      faam: 70, klaar: function (s) { return (s.verzameld.edelsteen || 0) >= 100; } },
    { id: 'tevreden_volk', emoji: '😄', titel: 'Gelukzalig',
      beschrijving: 'Bereik 90% tevredenheid met minstens 40 inwoners.',
      faam: 80, klaar: function (s) { return s.tevredenheid >= 90 && s.bevolking.totaal >= 40; } },
    { id: 'voltooid', emoji: '👑', titel: 'De voltooide stad',
      beschrijving: 'Voltooi je stad en win het spel.',
      faam: 250, klaar: function (s) { return !!s.gewonnen; } }
  ];

})(window.Game);
