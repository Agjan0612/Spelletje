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
  D.tick = function (s, dt) {
    if (!s.dorpelingen) s.dorpelingen = [];
    var lijst = s.dorpelingen;
    var doel = s.bevolking.totaal;

    while (lijst.length < doel) lijst.push({ naam: verzinNaam(), sinds: s.jaar });
    if (lijst.length > doel) lijst.length = doel;   /* someone moved on */

    wensen(s, lijst, dt || 0);
  };

  /* --------------------------------------------------------------- wensen --

     Now and then one of them asks for something, by name. The request is
     always something the player can actually act on and that the game can
     check for itself: a household living too far from any well, chapel or
     tavern asks for one nearby. Fulfilling it lifts the mood a little.

     Still no simulation weight: a wish is a pointer at a house that already
     has poor coverage, so the underlying problem is one the happiness maths
     was going to charge for anyway. This just gives it a face. */
  D.WENS_RUST = 220;          /* seconds between requests */
  D.WENS_DREMPEL = 0.5;       /* below this coverage a household speaks up */
  D.WENS_BELONING = 6;        /* morale for granting one */

  function wensen(s, lijst, dt) {
    if (!s.wens) s.wens = { actief: null, rust: 160, vervuld: 0 };
    var w = s.wens;

    if (w.actief) {
      var huis = Game.core.state.gebouw(s, w.actief.gebouwId);
      if (!huis) { w.actief = null; w.rust = D.WENS_RUST; return; }
      var d = Game.core.state.def(huis);
      var mid = (d.grootte - 1) / 2;
      var dekking = Game.core.buurt.dienstenOp(s, huis.x + mid, huis.y + mid) /
        Game.core.buurt.VOLLEDIG;
      w.actief.dekking = dekking;
      if (dekking >= w.actief.doel) {
        s.moreel = (s.moreel || 0) + D.WENS_BELONING;
        w.vervuld++;
        Game.ui.log.schrijf(s, '💚 ' + w.actief.naam + ' is er blij mee — de buurt is nu voorzien.', 'goed');
        Game.ui.toast('💚 ' + w.actief.naam + ' is tevreden');
        w.actief = null;
        w.rust = D.WENS_RUST;
      }
      return;
    }

    w.rust -= dt;
    if (w.rust > 0) return;
    w.rust = D.WENS_RUST;
    if (!lijst.length || s.bevolking.totaal < 8) return;

    /* The worst-served house in town, so the request always points somewhere
       worth acting on. */
    var slechtste = null, slechtsteDekking = 1;
    for (var i = 0; i < s.gebouwen.length; i++) {
      var g = s.gebouwen[i];
      if (!g.gebouwd) continue;
      var def = Game.core.state.def(g);
      if (!def.woonruimte || g.type === 'dorpsplein') continue;
      var m = (def.grootte - 1) / 2;
      var dek = Game.core.buurt.dienstenOp(s, g.x + m, g.y + m) / Game.core.buurt.VOLLEDIG;
      if (dek < slechtsteDekking) { slechtsteDekking = dek; slechtste = g; }
    }
    if (!slechtste || slechtsteDekking >= D.WENS_DREMPEL) return;

    var mens = lijst[Math.floor(Math.random() * lijst.length)];
    w.actief = {
      naam: mens.naam,
      gebouwId: slechtste.id,
      x: slechtste.x, y: slechtste.y,
      dekking: slechtsteDekking,
      doel: Math.min(1, slechtsteDekking + 0.3),
      tekst: mens.naam + ' woont te ver van alles vandaan en vraagt om een waterput, ' +
        'kapel of herberg in de buurt.'
    };
    Game.ui.log.schrijf(s, '🙋 ' + w.actief.tekst);
  }

  D.wens = function (s) { return s.wens && s.wens.actief; };

  /* A snapshot for the register view: each person with the job they currently
     hold, worked out from the worker slots (display only, never stored). */
  D.boek = function (s) {
    D.tick(s, 0);
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
