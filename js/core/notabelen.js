/* Notabelen — a handful of named citizens with a face and a mood.
 *
 * This is deliberately NOT the big "every villager is an individual" rewrite
 * (that would mean gutting population.js). Instead a few notables are *derived*
 * from the buildings you already have — the smith of the smithy, the priest of
 * the church — with a name rolled deterministically from the seed and a
 * one-line mood read straight from real state. Nothing is stored: it is pure
 * flavour computed on demand, so saves stay untouched. */
(function (Game) {

  var N = {};

  /* Each role appears once its building stands. First match of `geb` wins. */
  var ROLLEN = [
    { sleutel: 'baljuw',   geb: ['stadhuis'],                titel: 'Baljuw',       emoji: '⚖️' },
    { sleutel: 'smid',     geb: ['smederij', 'wapensmid'],   titel: 'Meestersmid',  emoji: '🔨' },
    { sleutel: 'pastoor',  geb: ['kathedraal', 'kerk', 'kapel'], titel: 'Pastoor',  emoji: '✝️' },
    { sleutel: 'rector',   geb: ['universiteit'],            titel: 'Rector',       emoji: '📚' },
    { sleutel: 'waard',    geb: ['herberg'],                 titel: 'Waard',        emoji: '🍺' },
    { sleutel: 'koopman',  geb: ['handelshuis', 'marktplaats'], titel: 'Koopman',   emoji: '🪙' },
    { sleutel: 'gilde',    geb: ['gildehuis'],               titel: 'Gildemeester', emoji: '🏦' },
    { sleutel: 'hoofdman', geb: ['kazerne'],                 titel: 'Hoofdman',     emoji: '🛡️' },
    { sleutel: 'juwelier', geb: ['juwelier'],                titel: 'Juwelier',     emoji: '💍' }
  ];

  var VOORNAMEN = [
    'Aleid', 'Berta', 'Diederik', 'Floris', 'Geertrui', 'Hendrik', 'Ivo', 'Jutta',
    'Klaas', 'Lubbert', 'Machteld', 'Nout', 'Odilia', 'Pieter', 'Reinout', 'Sybrand',
    'Trude', 'Willem', 'Aagt', 'Godelieve', 'Everhard', 'Mabelie', 'Wouter', 'Griet'
  ];
  var TOENAMEN = [
    'de Oude', 'de Jonge', 'Langbeen', 'van de Beek', 'Roodbaard', 'de Vrome',
    'Zwartoog', 'met de Bijl', 'van Overmaas', 'de Stille', 'Krommenol', 'Goedhart',
    'Sterkarm', 'van de Molen', 'de Wijze', 'Groothand'
  ];

  function hash(str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 16777619); }
    return h >>> 0;
  }

  function naamVoor(seed, sleutel) {
    var h = hash(seed + ':' + sleutel);
    var voor = VOORNAMEN[h % VOORNAMEN.length];
    var toe = TOENAMEN[(h >>> 8) % TOENAMEN.length];
    return voor + ' ' + toe;
  }

  /* A short mood line, mostly from happiness, coloured by the moment. */
  function humeur(s, rol) {
    if (s.voedselTekort > 1e-6) return 'vreest de honger in de stad';
    if (s.tevredenheid >= 78) return 'straalt van trots op de stad';
    if (s.roversStreak >= 3 && rol.sleutel === 'hoofdman') return 'houdt de rovers met verve buiten';
    if (s.tevredenheid >= 58) return 'is tevreden met hoe het gaat';
    if (s.seizoen === 3 && s.tevredenheid < 55) return 'telt de dagen tot de lente';
    if (s.tevredenheid >= 38) return 'maakt zich lichte zorgen';
    return 'is somber gestemd';
  }

  N.lijst = function (s) {
    var uit = [];
    for (var i = 0; i < ROLLEN.length; i++) {
      var rol = ROLLEN[i];
      var heeft = rol.geb.some(function (t) { return Game.core.state.telType(s, t) >= 1; });
      if (!heeft) continue;
      uit.push({
        emoji: rol.emoji,
        titel: rol.titel,
        naam: naamVoor(s.seed, rol.sleutel),
        humeur: humeur(s, rol)
      });
    }
    return uit;
  };

  Game.core.notabelen = N;

})(window.Game);
