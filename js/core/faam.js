/* Faam — one growing number that ties the whole game together.
 *
 * Faam is a *derived* score: it is never stored in state, it is recomputed
 * from what is already there (people, buildings, ages, milestones survived).
 * That keeps saves pure JSON. The only thing we persist is the personal best,
 * in localStorage, exactly like the sound preference — never in the save.
 *
 * The formula is deliberately steady-but-rising: a fresh hamlet sits near
 * zero, and every good decision nudges the number up, with a satisfying jump
 * on each age-up. */
(function (Game) {

  var F = {};

  var SLEUTEL = 'dorp-tot-stad-faam';        /* { beste } — the all-time record */
  var SLEUTEL_ZAAD = 'dorp-tot-stad-faam-zaad'; /* { seed: beste } — per map, for the daily challenge */

  /* Per-building worth: later ages are worth more, wonders most of all. */
  function gebouwGewicht(d) {
    if (!d) return 0;
    var basis = 2 + (d.tijdperk || 0) * 2;
    if (d.wonder) basis += 40;                 /* end-game wonders (idee 11) */
    return basis;
  }

  /* The breakdown, so the HUD tooltip can explain where Faam comes from. */
  F.detail = function (s) {
    var gebouwen = 0, aantal = 0;
    for (var i = 0; i < s.gebouwen.length; i++) {
      if (!s.gebouwen[i].gebouwd) continue;
      gebouwen += gebouwGewicht(Game.core.state.def(s.gebouwen[i]));
      aantal++;
    }

    var verzameldTotaal = 0;
    Game.config.resourceOrder.forEach(function (r) { verzameldTotaal += s.verzameld[r] || 0; });

    var d = {
      inwoners: s.bevolking.totaal * 12,
      gebouwen: Math.round(gebouwen),
      tijdperk: (s.tijdperk - 1) * 300,
      welvaart: Math.round(Math.sqrt(verzameldTotaal) * 3),
      tevredenheid: Math.round(Game.util.clamp(s.tevredenheid - 40, 0, 60) * 3),
      winters: (s.wintersOverleefd || 0) * 25,
      rovers: (s.raidsVerjaagd || 0) * 40,
      mijlpalen: (s.mijlpaalFaam || 0),
      voltooid: s.gewonnen ? 1000 : 0
    };
    return d;
  };

  F.bereken = function (s) {
    var d = F.detail(s);
    var som = 0;
    for (var k in d) som += d[k];
    return Math.max(0, Math.round(som));
  };

  /* --------------------------------------------------------------- records */

  function lees(sleutel) {
    try {
      var t = window.localStorage.getItem(sleutel);
      return t ? JSON.parse(t) : {};
    } catch (e) { return {}; }
  }
  function schrijf(sleutel, obj) {
    try { window.localStorage.setItem(sleutel, JSON.stringify(obj)); } catch (e) { /* ignore */ }
  }

  F.record = function () { return lees(SLEUTEL).beste || 0; };

  F.recordVoorZaad = function (seed) { return lees(SLEUTEL_ZAAD)[seed] || 0; };

  /* Books the current Faam as a record if it beats the previous best.
     Returns { nieuw, waarde, record } so the UI can celebrate a new high. */
  F.bewaarRecord = function (s) {
    var waarde = F.bereken(s);
    var alg = lees(SLEUTEL);
    var nieuwRecord = waarde > (alg.beste || 0);
    if (nieuwRecord) { alg.beste = waarde; schrijf(SLEUTEL, alg); }

    if (s.seed != null) {
      var perZaad = lees(SLEUTEL_ZAAD);
      if (waarde > (perZaad[s.seed] || 0)) { perZaad[s.seed] = waarde; schrijf(SLEUTEL_ZAAD, perZaad); }
    }
    return { nieuw: nieuwRecord, waarde: waarde, record: alg.beste || waarde };
  };

  Game.core.faam = F;

})(window.Game);
