/* Festivals — the friendly mirror image of a bandit raid.
 *
 * You spend food and coins on a party and the whole town cheers up for a
 * while. It reuses the morale field that raids already write to, so nothing
 * about the happiness maths changes: a feast is simply a big, temporary,
 * self-inflicted morale swing that you paid for. */
(function (Game) {

  var F = {};

  /* Morale never runs away in either direction. */
  F.MOREEL_MAX = 26;

  F.soorten = [
    {
      id: 'oogstfeest', naam: 'Oogstfeest', emoji: '🎉', tijdperk: 1,
      kosten: { graan: 70, vlees: 35 }, moreel: 11, duur: 70, rust: 200,
      beschrijving: 'Lange tafels op het plein, en iedereen eet zich rond. Kost voorraad, levert humeur.'
    },
    {
      id: 'marktdag', naam: 'Marktdag', emoji: '🎪', tijdperk: 2,
      kosten: { munten: 80, brood: 40 }, moreel: 14, duur: 80, rust: 220,
      beschrijving: 'Kramen, muzikanten en te veel bier. Een dure maar vrolijke dag.'
    },
    {
      id: 'toernooi', naam: 'Riddertoernooi', emoji: '🏇', tijdperk: 3,
      kosten: { munten: 180, brood: 90, vlees: 60 }, moreel: 20, duur: 100, rust: 260,
      beschrijving: 'Steekspel op het veld voor de muren. De hele streek praat erover.'
    }
  ];

  F.soort = function (id) {
    for (var i = 0; i < F.soorten.length; i++) if (F.soorten[i].id === id) return F.soorten[i];
    return null;
  };

  F.tick = function (s, dt) {
    var f = s.feest;
    if (!f) return;

    if (f.rust > 0) f.rust = Math.max(0, f.rust - dt);

    if (f.resterend > 0) {
      f.resterend -= dt;
      /* population.js lets morale fade every tick; while the party is on we
         simply hold it at the level you paid for. Runs after population in
         the step order, so this is the last word. */
      s.moreel = Math.max(s.moreel || 0, f.boost);
      if (f.resterend <= 0) {
        var soort = F.soort(f.id);
        f.resterend = 0;
        f.id = null;
        Game.ui.log.schrijf(s, (soort ? soort.emoji : '🎉') + ' Het feest is voorbij. Iedereen weer aan het werk.');
      }
    }
  };

  F.reden = function (s, soort) {
    if (soort.tijdperk > s.tijdperk) return 'Pas vanaf tijdperk ' + soort.tijdperk;
    if (s.feest.resterend > 0) return 'Er is al een feest aan de gang';
    if (s.feest.rust > 0) return 'De vorige keer is nog te kort geleden (' + Math.ceil(s.feest.rust) + 's)';
    if (!Game.core.state.kanBetalen(s, soort.kosten)) return 'Te weinig voorraad';
    return null;
  };

  F.kanVieren = function (s, soort) { return F.reden(s, soort) === null; };

  F.vier = function (s, id) {
    var soort = F.soort(id);
    if (!soort || !F.kanVieren(s, soort)) return false;

    Game.core.state.betaal(s, soort.kosten);
    s.feest = {
      id: soort.id,
      resterend: soort.duur,
      rust: soort.rust,
      boost: Math.min(F.MOREEL_MAX, (s.moreel || 0) + soort.moreel)
    };
    s.moreel = s.feest.boost;

    Game.ui.log.schrijf(s, soort.emoji + ' ' + soort.naam + '! Het hele dorp is op de been.', 'goed');
    Game.ui.toast(soort.emoji + ' ' + soort.naam + ' begonnen');
    if (Game.ui.audio && Game.ui.audio.feest) Game.ui.audio.feest();
    return true;
  };

  Game.core.feesten = F;

})(window.Game);
