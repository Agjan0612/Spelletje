/* Streken — land blessings and curses that make every map play differently.
 *
 * Pure data plus two tiny accessors. When a new game starts, `rol()` picks a
 * combination deterministically from the seed, so the same seed always yields
 * the same land (which keeps the daily challenge fair and shareable). The
 * chosen ids live in s.streken (a plain array — JSON-safe); the simulation
 * reads their multipliers through streekMult()/streekVlag().
 *
 * Effect keys the rest of the game looks up:
 *   akker         farm output          (economy)
 *   jacht         hunting & fishing     (economy)
 *   hout          woodcutting           (economy)
 *   mijn          mines & quarries      (economy)
 *   groei         population growth     (population)
 *   winterHonger  extra winter eating   (population)
 *   koopman       trade caravan chance  (handel)
 * A missing key means "no effect" (multiplier 1). */
(function (Game) {

  var STREKEN = [
    /* --- blessings --- */
    { id: 'delta',      naam: 'Vruchtbare delta', emoji: '🌱', goed: true,
      effect: { akker: 1.30, mijn: 0.90 },
      beschrijving: 'Rijke rivierklei: je akkers bloeien, maar erts is er schaars.' },
    { id: 'aders',      naam: 'Rijke aders',      emoji: '⛏️', goed: true,
      effect: { mijn: 1.35 },
      beschrijving: 'De bergen zitten vol metaal — mijnen en groeven leveren royaal.' },
    { id: 'oerbos',     naam: 'Dichte bossen',    emoji: '🌲', goed: true,
      effect: { hout: 1.35, jacht: 1.10 },
      beschrijving: 'Eindeloze wouden vol hout en wild.' },
    { id: 'wildrijk',   naam: 'Wildrijk land',    emoji: '🦌', goed: true,
      effect: { jacht: 1.40 },
      beschrijving: 'Herten en vis in overvloed — jagers en vissers boffen.' },
    { id: 'handelsweg', naam: 'Kruispunt van wegen', emoji: '🐴', goed: true,
      effect: { koopman: 1.7 },
      beschrijving: 'Karavanen trekken hier vaak langs — de koopman komt geregeld.' },
    { id: 'mildklimaat', naam: 'Mild klimaat',    emoji: '☀️', goed: true,
      effect: { winterHonger: 0.80, groei: 1.10 },
      beschrijving: 'Zachte winters en een tevreden volk dat gestaag groeit.' },

    /* --- curses / challenges --- */
    { id: 'barrewinter', naam: 'Barre winters',   emoji: '❄️', goed: false,
      effect: { winterHonger: 1.40, jacht: 0.90 },
      beschrijving: 'De winters bijten hard: er wordt fors meer gegeten. Hamster in de herfst.' },
    { id: 'karig',      naam: 'Karige grond',     emoji: '🪨', goed: false,
      effect: { akker: 0.80 },
      beschrijving: 'Stugge grond — je akkers geven minder. Leun op jacht en visserij.' },
    { id: 'afgelegen',  naam: 'Afgelegen streek', emoji: '🧭', goed: false,
      effect: { koopman: 0.45, groei: 0.95 },
      beschrijving: 'Ver van de bewoonde wereld: kooplieden verdwalen hier zelden naartoe.' },
    { id: 'ertsarm',    naam: 'Ertsarme bodem',   emoji: '🕳️', goed: false,
      effect: { mijn: 0.80 },
      beschrijving: 'De aders zijn dun — metaal delven kost meer moeite.' }
  ];

  var perId = {};
  STREKEN.forEach(function (x) { perId[x.id] = x; });

  Game.config.streken = STREKEN;
  Game.config.streek = function (id) { return perId[id]; };

  /* Deterministically pick one blessing and, half the time, one challenge. */
  Game.config.rolStreken = function (seed) {
    var rng = new Game.core.Rng((seed >>> 0) ^ 0x9e3779b9);
    var goed = STREKEN.filter(function (x) { return x.goed; });
    var slecht = STREKEN.filter(function (x) { return !x.goed; });
    var uit = [rng.kies(goed).id];
    if (rng.kans(0.55)) uit.push(rng.kies(slecht).id);
    return uit;
  };

  /* Product of the effect for `sleutel` across the town's active streken. */
  Game.config.streekMult = function (s, sleutel) {
    var m = 1;
    var lijst = s && s.streken;
    if (!lijst) return m;
    for (var i = 0; i < lijst.length; i++) {
      var st = perId[lijst[i]];
      if (st && st.effect && st.effect[sleutel] != null) m *= st.effect[sleutel];
    }
    return m;
  };

  /* Short "🌱 Vruchtbare delta · ❄️ Barre winters" label for the UI. */
  Game.config.streekLabel = function (s) {
    if (!s || !s.streken || !s.streken.length) return '';
    return s.streken.map(function (id) {
      var st = perId[id];
      return st ? st.emoji + ' ' + st.naam : id;
    }).join(' · ');
  };

})(window.Game);
