/* Contracts from the lord: a running goal with a deadline.
 *
 * The quest list in js/config/quests.js walks a new player through the first
 * hour and then falls silent. This keeps that same panel alive for the rest
 * of the game: one open contract at a time, tied to the calendar that
 * seasons.js already keeps. Everything stored is plain JSON. */
(function (Game) {

  var O = {};

  O.tick = function (s, dt) {
    if (s.tijdperk < 2) return;
    var o = s.opdracht;
    if (!o) return;

    if (o.actief) {
      if (s.dag > o.actief.eindDag) mislukt(s);
      return;
    }

    o.rust -= dt;
    if (o.rust <= 0) nieuweOpdracht(s);
  };

  /* Only ask for what this town can actually make. */
  function geschikt(s, sjabloon) {
    if (sjabloon.tijdperk > s.tijdperk) return false;
    if (sjabloon.nodig && Game.core.state.telType(s, sjabloon.nodig) === 0) return false;
    /* Something must already be flowing in, otherwise the contract is a trap. */
    return s.verzameld[sjabloon.res] > 0;
  }

  O.aantalVoor = function (s, sjabloon) {
    var ruw = sjabloon.basis + sjabloon.perInwoner * s.bevolking.totaal;
    return Math.max(10, Math.round(ruw / 10) * 10);
  };

  function nieuweOpdracht(s) {
    var mogelijk = Game.config.opdrachten.filter(function (sj) { return geschikt(s, sj); });
    if (!mogelijk.length) { s.opdracht.rust = 60; return; }

    /* Avoid handing out the same errand twice in a row. */
    var keuze = mogelijk[Math.floor(Math.random() * mogelijk.length)];
    if (mogelijk.length > 1 && keuze.id === s.opdracht.laatste) {
      keuze = mogelijk[(mogelijk.indexOf(keuze) + 1) % mogelijk.length];
    }

    var aantal = O.aantalVoor(s, keuze);
    s.opdracht.actief = {
      id: keuze.id,
      res: keuze.res,
      aantal: aantal,
      eindDag: s.dag + keuze.dagen,
      munten: keuze.munten,
      moreel: keuze.moreel,
      tekst: keuze.tekst
    };
    s.opdracht.laatste = keuze.id;

    Game.ui.log.schrijf(s, '📜 Nieuwe opdracht van de heer: ' + aantal + ' ' +
      Game.config.resources[keuze.res].naam.toLowerCase() + ' binnen ' + keuze.dagen + ' dagen.', 'goed');
    Game.ui.toast('📜 De heer vraagt om ' + Game.config.resources[keuze.res].emoji + ' ' + aantal);
  }

  function mislukt(s) {
    var a = s.opdracht.actief;
    s.opdracht.actief = null;
    s.opdracht.gefaald++;
    s.opdracht.rust = 150 + Math.random() * 90;
    s.moreel = Math.max(-Game.core.feesten.MOREEL_MAX, (s.moreel || 0) - 6);
    Game.ui.log.schrijf(s, '📜 De opdracht voor ' + a.aantal + ' ' +
      Game.config.resources[a.res].naam.toLowerCase() + ' is verlopen. De heer is niet blij.', 'slecht');
  }

  O.dagenOver = function (s) {
    if (!s.opdracht || !s.opdracht.actief) return 0;
    return Math.max(0, s.opdracht.actief.eindDag - s.dag);
  };

  O.kanLeveren = function (s) {
    var a = s.opdracht && s.opdracht.actief;
    return !!a && s.res[a.res] >= a.aantal;
  };

  O.lever = function (s) {
    if (!O.kanLeveren(s)) return false;
    var a = s.opdracht.actief;

    s.res[a.res] -= a.aantal;
    Game.core.state.voegToe(s, 'munten', a.munten);
    s.moreel = Math.min(Game.core.feesten.MOREEL_MAX, (s.moreel || 0) + a.moreel);

    s.opdracht.actief = null;
    s.opdracht.gedaan++;
    s.opdracht.rust = 130 + Math.random() * 110;

    Game.ui.log.schrijf(s, '📜 Opdracht geleverd! De heer stuurt ' + a.munten + ' munten terug.', 'goed');
    Game.ui.toast('📜 Opdracht voltooid (+🪙 ' + a.munten + ')');
    Game.core.state.herbereken(s);
    return true;
  };

  Game.core.opdrachten = O;

})(window.Game);
