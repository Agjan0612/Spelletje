/* Beleid runtime: accrue Invloed over time and spend it on permanent edicts.
 *
 * Invloed (influence) is a slow currency so edicts are a mid-game reward you
 * build toward, not something you spam turn one. It ticks up faster with a
 * town hall and guild halls. Active edicts live in s.beleid (a plain
 * {id:true} map — JSON-safe); their effects are read through mult()/add(),
 * the same shape as the streken helpers. */
(function (Game) {

  var B = {};

  /* Influence per second: a slow trickle, quicker once you have a seat of
     government. DAG = 10s, so the base is roughly +1 influence per in-game day. */
  B.tempo = function (s) {
    var t = 0.09;
    t += Game.core.state.telType(s, 'stadhuis') * 0.10;
    t += Game.core.state.telType(s, 'gildehuis') * 0.05;
    t += Game.core.state.telType(s, 'marktplaats') * 0.02;
    return t;
  };

  B.tick = function (s, dt) {
    if (s.invloed == null) s.invloed = 0;
    s.invloed += B.tempo(s) * dt;
  };

  function actief(s) { return s.beleid || (s.beleid = {}); }

  /* Product of an effect key across all enacted edicts (multiplier effects). */
  B.mult = function (s, sleutel) {
    var m = 1, a = s && s.beleid;
    if (!a) return m;
    for (var id in a) {
      if (!a[id]) continue;
      var e = Game.config.beleidsEdict(id);
      if (e && e.effect && e.effect[sleutel] != null && sleutel !== 'tevredenheid') m *= e.effect[sleutel];
    }
    return m;
  };

  /* Sum of an additive effect key (only tevredenheid today). */
  B.add = function (s, sleutel) {
    var v = 0, a = s && s.beleid;
    if (!a) return v;
    for (var id in a) {
      if (!a[id]) continue;
      var e = Game.config.beleidsEdict(id);
      if (e && e.effect && e.effect[sleutel] != null && sleutel === 'tevredenheid') v += e.effect[sleutel];
    }
    return v;
  };

  /* Which edict (if any) is enacted in a group — a group holds one choice. */
  B.inGroep = function (s, groep) {
    var a = s && s.beleid;
    if (!a) return null;
    for (var id in a) {
      if (!a[id]) continue;
      var e = Game.config.beleidsEdict(id);
      if (e && e.groep === groep) return id;
    }
    return null;
  };

  B.kanKiezen = function (s, id) {
    var e = Game.config.beleidsEdict(id);
    if (!e) return { ok: false, reden: 'Onbekend edict' };
    if (actief(s)[id]) return { ok: false, reden: 'Al van kracht' };
    if (B.inGroep(s, e.groep)) return { ok: false, reden: 'Je hebt in deze groep al gekozen' };
    if ((s.invloed || 0) < e.kosten) return { ok: false, reden: 'Te weinig invloed (' + Math.floor(s.invloed || 0) + '/' + e.kosten + ')' };
    return { ok: true };
  };

  B.kies = function (s, id) {
    var check = B.kanKiezen(s, id);
    if (!check.ok) return check;
    var e = Game.config.beleidsEdict(id);
    s.invloed -= e.kosten;
    actief(s)[id] = true;
    Game.core.state.herbereken(s);
    Game.ui.log.schrijf(s, '📜 Edict afgekondigd: ' + e.emoji + ' ' + e.naam + '.', 'goed');
    if (Game.ui.toast) Game.ui.toast('📜 ' + e.emoji + ' ' + e.naam);
    if (Game.ui.audio && Game.ui.audio.fanfare) Game.ui.audio.fanfare();
    return { ok: true };
  };

  Game.core.beleid = B;

})(window.Game);
