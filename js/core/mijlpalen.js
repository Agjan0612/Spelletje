/* Mijlpalen runtime: checks the achievement predicates each tick, awards the
 * Faam once, celebrates it, and keeps a permanent record in localStorage so
 * the trophy cabinet fills up across many games. Nothing here goes into the
 * save except the plain per-game bookkeeping (which milestones this town has
 * hit, and the Faam they added). */
(function (Game) {

  var M = {};
  var SLEUTEL = 'dorp-tot-stad-mijlpalen';   /* { id: true } — all-time earned */

  function leesKast() {
    try {
      var t = window.localStorage.getItem(SLEUTEL);
      return t ? JSON.parse(t) : {};
    } catch (e) { return {}; }
  }
  function bewaarKast(kast) {
    try { window.localStorage.setItem(SLEUTEL, JSON.stringify(kast)); } catch (e) { /* ignore */ }
  }

  M.controleer = function (s) {
    if (!s.mijlpalenGedaan) s.mijlpalenGedaan = {};
    var lijst = Game.config.mijlpalen || [];
    var kast = null;
    for (var i = 0; i < lijst.length; i++) {
      var m = lijst[i];
      if (s.mijlpalenGedaan[m.id]) continue;
      if (!m.klaar(s)) continue;

      s.mijlpalenGedaan[m.id] = true;
      s.mijlpaalFaam = (s.mijlpaalFaam || 0) + (m.faam || 0);

      if (kast === null) kast = leesKast();
      kast[m.id] = true;

      Game.ui.log.schrijf(s, '🏅 Mijlpaal behaald: ' + m.emoji + ' ' + m.titel +
        ' (+' + m.faam + ' faam)', 'goed');
      Game.ui.toast('🏅 ' + m.emoji + ' ' + m.titel);
      if (Game.ui.audio && Game.ui.audio.mijlpaal) Game.ui.audio.mijlpaal();
    }
    if (kast !== null) bewaarKast(kast);
  };

  /* Cabinet view for the UI: every milestone plus whether it was ever earned. */
  M.kast = function (s) {
    var kast = leesKast();
    return (Game.config.mijlpalen || []).map(function (m) {
      return {
        emoji: m.emoji, titel: m.titel, beschrijving: m.beschrijving, faam: m.faam,
        behaald: !!kast[m.id],
        ditSpel: !!(s && s.mijlpalenGedaan && s.mijlpalenGedaan[m.id])
      };
    });
  };

  M.aantalBehaald = function () {
    var kast = leesKast();
    var n = 0;
    for (var k in kast) if (kast[k]) n++;
    return n;
  };

  Game.core.mijlpalen = M;

})(window.Game);
