/* Fase III (light): a village register that gives the inhabitants names and a
   little identity — WITHOUT rewriting the simulation. The game still counts
   groups (s.bevolking is a headcount); this module keeps a plain-data list of
   named people the same length as that headcount, adding a newcomer when the
   village grows and waving one off when it shrinks. It reads the state but
   never changes the counts, so every food/happiness invariant is untouched and
   the save stays pure JSON. The current occupation shown in the book is worked
   out on the fly from the building worker slots, not stored. */
(function (Game) {

  var D = {};

  var VOORNAMEN = [
    'Aleid', 'Bertha', 'Diederik', 'Femke', 'Godfried', 'Hilde', 'Joost',
    'Katelijne', 'Lieven', 'Machteld', 'Neeltje', 'Otto', 'Reinout', 'Sanne',
    'Tewis', 'Willem', 'Griet', 'Floris', 'Aagje', 'Bram', 'Doede', 'Eefje',
    'Gerrit', 'Trijn', 'Wouter', 'Jorien', 'Mees', 'Roelof', 'Saskia', 'Hendrik'
  ];
  var BIJNAMEN = [
    'de Smid', 'van de Beek', 'Kortvoet', 'de Jonge', 'Roodhaar', 'met de Bijl',
    'van het Bos', 'de Wever', 'Langbeen', 'Stevast', 'uit het Veen', 'Groothand',
    'de Stille', 'Zwartoog', 'Goedhart', 'van de Heuvel', 'Snelvoet', 'de Oude'
  ];

  function verzinNaam() {
    return VOORNAMEN[Math.floor(Math.random() * VOORNAMEN.length)] + ' ' +
      BIJNAMEN[Math.floor(Math.random() * BIJNAMEN.length)];
  }

  /* Keep the register the same length as the headcount. */
  D.tick = function (s) {
    if (!s.dorpelingen) s.dorpelingen = [];
    var lijst = s.dorpelingen;
    var doel = s.bevolking.totaal;

    while (lijst.length < doel) lijst.push({ naam: verzinNaam(), sinds: s.jaar });
    if (lijst.length > doel) lijst.length = doel;   /* someone moved on */
  };

  /* A snapshot for the register view: each person with the job they currently
     hold, worked out from the worker slots (display only, never stored). */
  D.boek = function (s) {
    D.tick(s);
    var banen = [];
    for (var i = 0; i < s.gebouwen.length; i++) {
      var g = s.gebouwen[i];
      var d = Game.core.state.def(g);
      if (!g.gebouwd || !d.banen) continue;
      var jobNaam = (Game.config.jobs[d.banen.baan] || {}).naam || 'Werker';
      for (var w = 0; w < g.werkers; w++) banen.push(jobNaam);
    }

    var uit = [];
    for (var p = 0; p < s.dorpelingen.length; p++) {
      var mens = s.dorpelingen[p];
      uit.push({
        naam: mens.naam,
        sinds: mens.sinds,
        baan: p < banen.length ? banen[p] : 'Zonder werk'
      });
    }
    return uit;
  };

  Game.core.dorpelingen = D;

})(window.Game);
