/* Research: what the guild hall and the university can work out for you.
 *
 * Every entry is bought once with coins (and sometimes materials) and then
 * applies forever. This is what late-game coins are *for*: without it a full
 * treasury has nothing left to buy once the last building stands.
 *
 * The effect keys are read by js/core/onderzoek.js:
 *   productie      multiplier on all production
 *   voedsel        multiplier on everything edible
 *   mijnbouw       multiplier on mines and quarries
 *   bouw           multiplier on building speed
 *   verdediging    multiplier on defence
 *   winter         multiplier on the *extra* food eaten in winter
 *   opslag         multiplier on storage capacity
 *   tevredenheid   flat happiness points
 */
(function (Game) {

  Game.config.onderzoek = [
    {
      id: 'ijzerenPloeg', naam: 'IJzeren ploeg', emoji: '🌾', nodig: 'gildehuis',
      kosten: { munten: 120, gereedschap: 20 },
      effect: { voedsel: 1.15 },
      beschrijving: 'Een ploeg met ijzeren schaar keert zwaardere grond. Alles wat eetbaar is levert 15% meer op.'
    },
    {
      id: 'diepeSchachten', naam: 'Diepe schachten', emoji: '⛏️', nodig: 'gildehuis',
      kosten: { munten: 150, gereedschap: 25 },
      effect: { mijnbouw: 1.18 },
      beschrijving: 'Stutten en ladders brengen de mijnwerkers bij rijkere aders. Mijnen en groeven +18%.'
    },
    {
      id: 'steigerbouw', naam: 'Steigerbouw', emoji: '🏗️', nodig: 'gildehuis',
      kosten: { munten: 110, hout: 80 },
      effect: { bouw: 1.35 },
      beschrijving: 'Steigers, katrollen en een vaste ploeg. Alles wat je bouwt staat er 35% sneller.'
    },
    {
      id: 'wintervoorraad', naam: 'Wintervoorraad', emoji: '❄️', nodig: 'gildehuis',
      kosten: { munten: 130, hout: 60 },
      effect: { winter: 0.45 },
      beschrijving: 'Rookhutten, pekelvaten en een diepe kelder. De winter kost minder dan de helft extra voedsel.'
    },
    {
      id: 'pakhuisbeheer', naam: 'Pakhuisbeheer', emoji: '📦', nodig: 'gildehuis',
      kosten: { munten: 180, steen: 80 },
      effect: { opslag: 1.25 },
      beschrijving: 'Stellingen tot aan het dak en een schrijver die bijhoudt wat waar ligt. +25% opslag.'
    },
    {
      id: 'wapenkunde', naam: 'Wapenkunde', emoji: '🛡️', nodig: 'universiteit',
      kosten: { munten: 200, ijzer: 60 },
      effect: { verdediging: 1.25 },
      beschrijving: 'Wachtroosters, betere harnassen en een plan voor als het misgaat. Verdediging +25%.'
    },
    {
      id: 'gildebrieven', naam: 'Gildebrieven', emoji: '📜', nodig: 'universiteit',
      kosten: { munten: 230 },
      effect: { tevredenheid: 7 },
      beschrijving: 'Rechten en vrijheden op perkament. Je stadsbewoners voelen zich burgers, geen onderdanen.'
    },
    {
      id: 'boekhouding', naam: 'Dubbele boekhouding', emoji: '📐', nodig: 'universiteit',
      kosten: { munten: 280, gereedschap: 40 },
      effect: { productie: 1.12 },
      beschrijving: 'Elke gulden en elke zak graan staat genoteerd. De hele stad werkt 12% doelmatiger.'
    }
  ];

})(window.Game);
