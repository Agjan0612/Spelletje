/* The bandits who keep coming back.
 *
 * A raid used to be an anonymous number. Giving the band a captain who
 * remembers what you did last time costs one small object in state and turns
 * a dice roll into a running feud: pay him off and he returns greedier,
 * destroy his band and his successor arrives with a grudge.
 */
(function (Game) {

  Game.config.roverNamen = [
    'Wolfram de Zwarte', 'Gerlach Eenoog', 'Reinout de Wolf', 'Balder Hamerhand',
    'Sigward de Kale', 'Egbert Roodbaard', 'Volkert de Kraai', 'Hilbrand de Stille',
    'Dietger Bijlvoet', 'Marbod de Gier', 'Sweder Grauwmantel', 'Onno IJzertand'
  ];

  Game.config.rovers = {
    /* Attrition: how much of a covering tower's strength is spent thinning the
       band as it marches past. At 1.0 the arithmetic is identical to the old
       "positional defence adds to your total" rule — the fight is the same,
       but you now watch it happen and can see which tower did the work. */
    attritie: 1.0,

    /* Tribute: coins to make them turn around, as a multiple of their
       strength. Cheap in the moment, expensive as a habit. */
    schattingPerKracht: 1.6,
    schattingWrok: 2,
    /* Every tribute already paid makes the next band this much bolder. */
    schattingOpslag: 0.08,

    /* Militia: every idle villager called to the walls is worth this much,
       but nothing gets built while they stand there. */
    burgerwachtPerMan: 4,
    burgerwachtMax: 24,

    /* Evacuation: work stops outside this radius of the square, and in return
       the raiders find far less worth taking. */
    evacuatieStraal: 9,
    evacuatieBuit: 0.35,      /* multiplier on what they can steal */

    /* Siege (age 4 and up): instead of one charge they settle in and starve
       you out. Fields beyond the walls yield nothing until it is broken. */
    belegVanafTijdperk: 4,
    belegKans: 0.35,
    belegDuur: 260,
    belegStraal: 10,
    belegMoreelPerSec: 0.035
  };

})(window.Game);
