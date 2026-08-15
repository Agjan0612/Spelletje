/* Beleid — town edicts, the strategic-identity layer. Each edict is a
 * permanent choice with a real trade-off; edicts in the same `groep` are
 * mutually exclusive, so you commit to a direction. Pure data: the runtime
 * (js/core/beleid.js) spends Invloed to enact them and reads their effects.
 *
 * Effect keys (all optional, default = no effect):
 *   productie   global production multiplier
 *   groei       population-growth multiplier
 *   koopman     trade-caravan frequency multiplier
 *   tevredenheid  flat happiness added
 */
(function (Game) {

  Game.config.beleid = [
    /* --- Economie: richer output vs a happier people --- */
    { id: 'gilden', groep: 'economie', naam: 'Gildenbrief', emoji: '🏦',
      kosten: 25, effect: { productie: 1.12, tevredenheid: -4 },
      beschrijving: 'Erken de gilden: +12% productie in de hele stad, maar de gildendwang drukt het humeur (−4 tevredenheid).' },
    { id: 'ethos', groep: 'economie', naam: 'Strenge werkethos', emoji: '💪',
      kosten: 25, effect: { productie: 1.08, groei: 0.94 },
      beschrijving: 'Hard werken staat voorop: +8% productie, maar mensen krijgen minder kinderen (−6% groei).' },

    /* --- Volk: mood vs pace --- */
    { id: 'feest', groep: 'volk', naam: 'Feestdagen', emoji: '🎉',
      kosten: 25, effect: { tevredenheid: 9, productie: 0.96 },
      beschrijving: 'Vaste feestdagen: +9 tevredenheid, maar de stad ligt af en toe stil (−4% productie).' },
    { id: 'kolonisatie', groep: 'volk', naam: 'Kolonisatiedrang', emoji: '🧭',
      kosten: 25, effect: { groei: 1.18, tevredenheid: -3 },
      beschrijving: 'Trek nieuwe kolonisten aan: +18% bevolkingsgroei, tegen wat lichte krapte (−3 tevredenheid).' },

    /* --- Handel & bestuur --- */
    { id: 'marktrecht', groep: 'bestuur', naam: 'Marktrecht', emoji: '⚖️',
      kosten: 30, effect: { koopman: 1.6, tevredenheid: 2 },
      beschrijving: 'Verleen stadsrechten: de koopman komt veel vaker langs en biedt betere koersen (+2 tevredenheid).' },
    { id: 'welvaart', groep: 'bestuur', naam: 'Welvaartsbeleid', emoji: '🏛️',
      kosten: 30, effect: { productie: 1.06, groei: 0.94, tevredenheid: 3 },
      beschrijving: 'Investeer in de stad zelf: +6% productie en +3 tevredenheid, tegen wat tragere groei.' }
  ];

  var perId = {};
  Game.config.beleid.forEach(function (b) { perId[b.id] = b; });
  Game.config.beleidsEdict = function (id) { return perId[id]; };

})(window.Game);
