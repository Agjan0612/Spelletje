/* Social standing, and the pace of a human life.
 *
 * Two knobs that turn "a headcount" into "a town of people":
 *
 *   standen  — what kind of household lives in a house. A cottage holds
 *              farmers who ask almost nothing and pay almost nothing; a
 *              half-timbered house holds burghers who want variety on the
 *              table and services on the corner, and pay for the privilege;
 *              a mansion holds patricians who want a great deal and pay a
 *              great deal. This is what the housing upgrade chain was always
 *              implying — now it means something.
 *
 *   leeftijd — how long it takes to grow up, grow old and die. Children eat
 *              but cannot work, which makes a baby boom a real investment.
 */
(function (Game) {

  Game.config.standen = {
    boeren: {
      naam: 'Boeren', emoji: '🌾',
      /* Coins per inhabitant per second at full contentment. */
      belasting: 0.008,
      eisen: {},
      beschrijving: 'Vragen weinig en geven weinig. Het fundament van je dorp.'
    },
    burgers: {
      naam: 'Burgers', emoji: '🏘️',
      belasting: 0.026,
      eisen: { variatie: 2, diensten: 0.45 },
      beschrijving: 'Willen afwisseling op tafel en voorzieningen om de hoek. Betalen daar ook naar.'
    },
    poorters: {
      naam: 'Poorters', emoji: '🎩',
      belasting: 0.058,
      eisen: { variatie: 3, diensten: 0.70 },
      beschrijving: 'Veeleisend en vermogend. Een stad met poorters is een rijke stad.'
    }
  };

  Game.config.standOrde = ['boeren', 'burgers', 'poorters'];

  Game.config.stand = function (id) {
    return Game.config.standen[id] || Game.config.standen.boeren;
  };

  Game.config.leeftijd = {
    /* Seconds of simulated time. One in-game year is 4 x 12 x DAG = 480s. */
    kindDuur: 700,          /* about a year and a half of childhood */
    volwassenDuur: 5200,    /* roughly eleven years of working life */
    ouderdomDuur: 2400,     /* about five years of old age */

    /* An elderly villager still takes a job, but does not get through as much. */
    ouderenArbeid: 0.6,

    /* Of every new villager, this share is a child born in the town and the
       rest is a family moving in. Keeping the headcount growth itself
       unchanged is deliberate: the food and housing balance carries over,
       and what the split adds is the delay before a newcomer can work.
       Tuned against a headless run: at 0.4 the town reached age 3 half again
       as late, which is a bigger change to the pace of the game than this
       feature was meant to make. */
    geboorteAandeel: 0.25,

    /* A child eats, but not a grown man's portion. */
    kinderEten: 0.7,

    /* Children and grandparents are what makes a place feel lived in. */
    tevredenheidKinderen: 4,
    tevredenheidOuderen: 3
  };

})(window.Game);
