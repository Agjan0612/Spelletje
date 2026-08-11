/* Orders from the lord — recurring objectives with a deadline that give the
   game direction beyond the tutorial quests. An order asks you to deliver
   (hand over) an amount of some good before a date; do it and you earn coins
   and a little goodwill. It reuses the calendar (s.dag) for the deadline and
   never touches resources on its own — delivery only happens when the player
   presses the button, so nothing here can quietly starve a village. */
(function (Game) {

  var O = {};

  O.COOLDOWN = 50;           /* sim-seconds between orders */

  /* Which goods the lord asks for, per age, with a base amount and reward.
     The amount scales gently with population so it stays meaningful. */
  var VRAAG = [
    { res: 'hout',        basis: 120, tijdperk: 2, dagen: 6, munten: 60 },
    { res: 'brood',       basis: 80,  tijdperk: 2, dagen: 6, munten: 70 },
    { res: 'steen',       basis: 100, tijdperk: 2, dagen: 7, munten: 70 },
    { res: 'vlees',       basis: 90,  tijdperk: 2, dagen: 6, munten: 60 },
    { res: 'gereedschap', basis: 40,  tijdperk: 3, dagen: 8, munten: 110 },
    { res: 'ijzer',       basis: 80,  tijdperk: 3, dagen: 8, munten: 90 },
    { res: 'edelsteen',   basis: 20,  tijdperk: 4, dagen: 9, munten: 160 }
  ];

  function start(s) {
    var poel = VRAAG.filter(function (v) { return v.tijdperk <= s.tijdperk; });
    if (!poel.length) return;
    var v = poel[Math.floor(Math.random() * poel.length)];
    var schaal = 1 + s.bevolking.totaal / 60;
    var doel = Math.round(v.basis * schaal);
    var beloningMunten = Math.round(v.munten * schaal);
    var naam = Game.config.resources[v.res].naam.toLowerCase();

    s.opdracht = {
      actief: true,
      res: v.res,
      doel: doel,
      deadlineDag: s.dag + v.dagen,
      beloning: { munten: beloningMunten },
      cooldown: 0,
      tekst: 'Lever ' + doel + ' ' + naam + ' aan de heer'
    };
    Game.ui.log.schrijf(s, '📜 De heer vraagt: ' + s.opdracht.tekst +
      ' (binnen ' + v.dagen + ' dagen).');
    Game.ui.toast('📜 Nieuwe opdracht van de heer');
  }

  O.resterendeDagen = function (s) {
    if (!s.opdracht || !s.opdracht.actief) return 0;
    return Math.max(0, s.opdracht.deadlineDag - s.dag);
  };

  O.lever = function (s) {
    var o = s.opdracht;
    if (!o || !o.actief) return { ok: false, reden: 'Er is geen opdracht' };
    if (s.res[o.res] < o.doel) {
      return { ok: false, reden: 'Je hebt nog niet genoeg ' + Game.config.resources[o.res].naam.toLowerCase() };
    }
    s.res[o.res] -= o.doel;
    for (var r in o.beloning) Game.core.state.voegToe(s, r, o.beloning[r]);
    s.moreel = (s.moreel || 0) + 6;
    var delen = [];
    for (var r2 in o.beloning) delen.push(o.beloning[r2] + ' ' + Game.config.resources[r2].naam.toLowerCase());
    Game.ui.log.schrijf(s, '📜 Opdracht voltooid: ' + o.tekst + '. Beloning: +' + delen.join(', ') + '.', 'goed');
    Game.ui.toast('📜 De heer is tevreden!');
    o.actief = false;
    o.cooldown = O.COOLDOWN;
    return { ok: true };
  };

  O.tick = function (s, dt) {
    if (s.tijdperk < 2) return;
    if (!s.opdracht) s.opdracht = { actief: false, cooldown: O.COOLDOWN };

    var o = s.opdracht;
    if (!o.actief) {
      o.cooldown = (o.cooldown || 0) - dt;
      if (o.cooldown <= 0) start(s);
      return;
    }

    /* Deadline passed. No resource penalty — a missed order simply lapses, so
       an unattended village is never punished into a spiral. */
    if (s.dag >= o.deadlineDag) {
      Game.ui.log.schrijf(s, '⌛ De opdracht van de heer is verlopen: ' + o.tekst + '.');
      o.actief = false;
      o.cooldown = O.COOLDOWN;
    }
  };

  Game.core.opdrachten = O;

})(window.Game);
