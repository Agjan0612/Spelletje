/* What a travelling merchant thinks your goods are worth, in coins per unit.
   He sells dearer than he buys — that spread is the whole point of the
   caravan, and a marketplace or trading house narrows it in your favour. */
(function (Game) {

  Game.config.handelWaarde = {
    vlees: 1.1,
    hout: 0.5,
    steen: 0.8,
    ijzer: 2.2,
    koper: 2.4,
    edelsteen: 6.5,
    graan: 0.7,
    brood: 1.5,
    gereedschap: 3.2
  };

  Game.config.handel = {
    /* Multipliers on the base value. */
    koopFactor: 1.55,        /* you buy from him at this markup */
    verkoopFactor: 0.70,     /* he buys from you at this discount */

    /* Buildings that make the merchant friendlier, and by how much the spread
       shrinks per copy (capped in handel.js). */
    marge: { marktplaats: 0.07, handelshuis: 0.10, gildehuis: 0.04 },
    margeMax: 0.26,

    verblijf: 110,           /* seconds the caravan stays */
    rust: [280, 420]         /* seconds between visits (random in this range) */
  };

})(window.Game);
