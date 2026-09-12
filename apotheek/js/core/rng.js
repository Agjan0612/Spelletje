/* Seeded pseudo-random generator (mulberry32).
 *
 * Anders dan bij het buurspel loopt de toestand van de generator *in* de
 * speltoestand mee (s.rngS, een gewoon getal). Dat kost niets in JSON en het
 * levert twee dingen op: een save hervat exact dezelfde toekomst, en het
 * balansharnas kan een dag byte-voor-byte herhalen. Math.random komt in dit
 * spel nergens voor — de waarschuwing in CLAUDE.md over ruis meten begint hier. */
(function (A) {

  function stap(s) {
    s.rngS = (s.rngS + 0x6D2B79F5) >>> 0;
    var t = s.rngS;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  A.core.rng = {
    trek: stap,
    tussen: function (s, lo, hi) { return lo + stap(s) * (hi - lo); },
    heel: function (s, lo, hi) { return Math.floor(lo + stap(s) * (hi - lo + 1)); },
    kans: function (s, p) { return stap(s) < p; },
    kies: function (s, arr) { return arr[Math.floor(stap(s) * arr.length)]; }
  };

})(window.Apotheek);
