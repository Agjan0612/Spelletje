/* Het handvest van de vrijstad — wat er te doen is nádat je gewonnen hebt.
 *
 * Tot nu toe eindigde het spel met "je kunt gewoon doorspelen", zonder één
 * reden om dat te doen: de kathedraal stond er, en daarmee was elke knop in
 * het spel een knop zonder doel. Dit is die reden. De kroon verleent je stad
 * een handvest, en dat handvest moet elke termijn opnieuw verdiend worden:
 * een levering én een norm waar de stad aan moet blijven voldoen.
 *
 * Het is bewust geen nieuwe lijst vinkjes maar een ritme: er is altijd een
 * volgende termijn, hij schaalt met je stad, en de rangen die je ermee
 * verdient werken als onderzoek — blijvende vermenigvuldigers die
 * state.herbereken() afleidt en nooit opslaat.
 */
(function (Game) {

  /* De rangen. `drempel` is het aantal faampunten dat je ervoor nodig hebt;
     `effect` heeft exact de vorm van een onderzoekseffect (js/core/onderzoek.js),
     zodat beide door dezelfde molen gaan. */
  Game.config.faamRangen = [
    {
      nr: 0, naam: 'Stad met stadsrechten', emoji: '🏙️', drempel: 0, effect: {},
      tekst: 'De kroon heeft je stadsrechten verleend. Wat je daarmee doet, moet nog blijken.'
    },
    {
      nr: 1, naam: 'Vrijstad', emoji: '🕊️', drempel: 3, effect: { tevredenheid: 3 },
      tekst: 'Je stad antwoordt aan niemand dan de kroon. Dat weten je burgers, en het bevalt ze.'
    },
    {
      nr: 2, naam: 'Hanzestad', emoji: '⚓', drempel: 8, effect: { productie: 1.06, opslag: 1.1 },
      tekst: 'Je koopvaarders varen onder eigen vlag. De pakhuizen langs de kade zijn dieper dan ooit.'
    },
    {
      nr: 3, naam: 'Rijksstad', emoji: '🦅', drempel: 15, effect: { verdediging: 1.12, tevredenheid: 3 },
      tekst: 'De adelaar van het rijk hangt boven je poort. Rovers kijken voortaan wel twee keer.'
    },
    {
      nr: 4, naam: 'Keizerlijke Vrijstad', emoji: '👑', drempel: 25,
      effect: { productie: 1.08, voedsel: 1.08, tevredenheid: 4 },
      tekst: 'De keizer noemt je stad bij naam. Verder komt een middeleeuwse stad niet.'
    }
  ];

  /* Wat de kroon per termijn kan vragen. Net als bij de opdrachten van de heer
     schaalt het gevraagde met de stad, zodat het een inspanning blijft:
       aantal = (basis + perInwoner * inwoners) * (1 + 0,35 * rang)
     `nodig` houdt een eis tegen die je onmogelijk kunt vullen. */
  Game.config.faamEisen = [
    {
      id: 'brood', res: 'brood', basis: 120, perInwoner: 1.4, nodig: 'bakkerij',
      tekst: 'Het hof trekt door je gewest en verwacht dat de stad de tafels dekt.'
    },
    {
      id: 'kleding', res: 'kleding', basis: 40, perInwoner: 0.5, nodig: 'weverij',
      tekst: 'De kanselarij bestelt laken voor de hofhouding — jouw weefgetouwen hebben naam gemaakt.'
    },
    {
      id: 'bier', res: 'bier', basis: 60, perInwoner: 0.8, nodig: 'brouwerij',
      tekst: 'Er wordt een rijksdag gehouden. Er is bier nodig, en niet zuinig ook.'
    },
    {
      id: 'gereedschap', res: 'gereedschap', basis: 50, perInwoner: 0.6, nodig: 'smederij',
      tekst: 'De kroon rust een expeditie uit en vraagt om het beste gereedschap dat je smidse maakt.'
    },
    {
      id: 'munten', res: 'munten', basis: 250, perInwoner: 3.2,
      tekst: 'De schatkist van het rijk is leeg. Een vrijstad betaalt haar aandeel.'
    },
    {
      id: 'steen', res: 'steen', basis: 300, perInwoner: 4, nodig: 'steengroeve',
      tekst: 'Er wordt aan een rijksburcht gebouwd. Jouw groeven leveren de steen.'
    }
  ];

  /* De norm waar de stad zélf aan moet voldoen op het moment van leveren.
     Leveren mag altijd; de norm halen is een extra punt waard. Zo blijft het
     handvest gaan over hoe goed de stad gebouwd is, en niet alleen over hoe
     groot je stapel is. */
  Game.config.faam = {
    dagen: 40,                 /* looptijd van een termijn, ruim drie seizoenen */
    rustNa: 90,                /* seconden adem tussen twee termijnen */
    bevolkingBasis: 100,       /* norm bij rang 0 */
    bevolkingPerRang: 25,
    tevredenheidNorm: 65,
    muntenBasis: 160,          /* beloning, schaalt mee met de rang */
    muntenPerRang: 90,
    moreelGoed: 8,
    moreelSlecht: 9
  };

})(window.Game);
