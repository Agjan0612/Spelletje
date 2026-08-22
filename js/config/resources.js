/* Resource definitions.
   `primair` resources are the six the player gathers from the land and are
   shown big in the HUD; the rest are crafted and shown in a smaller row.

   `soort` says which storehouse holds it, so a granary is not the same thing
   as a warehouse (see `opslagPer` in buildings.js and `s.capaciteiten` in
   core/state.js):
     voedsel  perishable — spoils without a granary
     goed     timber, ore, cloth, tools
     schat    coins and gems, and the first thing raiders go for */
(function (Game) {

  Game.config.resources = {
    vlees:     { naam: 'Vlees',      emoji: '🥩', kleur: '#b5563f', primair: true, voedsel: true, soort: 'voedsel', start: 60 },
    hout:      { naam: 'Hout',       emoji: '🪵', kleur: '#8a6236', primair: true, soort: 'goed', start: 120 },
    steen:     { naam: 'Steen',      emoji: '🪨', kleur: '#9aa0a6', primair: true, soort: 'goed', start: 40 },
    ijzer:     { naam: 'IJzer',      emoji: '⛓️', kleur: '#8794a3', primair: true, soort: 'goed', start: 0 },
    koper:     { naam: 'Koper',      emoji: '🟠', kleur: '#c47b3a', primair: true, soort: 'goed', start: 0 },
    edelsteen: { naam: 'Edelstenen', emoji: '💎', kleur: '#63c6d6', primair: true, soort: 'schat', start: 0 },

    /* Graan is edible as porridge, so the starting farm feeds the village
       right away; bread is the better food and unlocks in age 2. */
    graan:       { naam: 'Graan',       emoji: '🌾', kleur: '#d9b45c', voedsel: true, soort: 'voedsel', start: 40 },
    brood:       { naam: 'Brood',       emoji: '🍞', kleur: '#d2a05a', voedsel: true, soort: 'voedsel', start: 0 },
    gereedschap: { naam: 'Gereedschap', emoji: '🔨', kleur: '#b0895c', soort: 'goed', start: 0 },

    /* Two chains that make a town more than a quarry with houses. Wool and
       cloth clothe the burghers; hops and beer keep the tavern open and the
       patricians civil. Both are demanded by the standing system, so they are
       what a *city* needs rather than what a village needs. */
    wol:     { naam: 'Wol',     emoji: '🐑', kleur: '#e2dccb', soort: 'goed', start: 0 },
    kleding: { naam: 'Kleding', emoji: '🧥', kleur: '#8a6a9a', soort: 'goed', start: 0 },
    hop:     { naam: 'Hop',     emoji: '🌿', kleur: '#7fa050', soort: 'goed', start: 0 },
    bier:    { naam: 'Bier',    emoji: '🍺', kleur: '#c98a2a', soort: 'goed', start: 0 },

    munten:      { naam: 'Munten',      emoji: '🪙', kleur: '#e0c05a', soort: 'schat', start: 30 }
  };

  /* Stable display order. */
  Game.config.resourceOrder = [
    'vlees', 'hout', 'steen', 'ijzer', 'koper', 'edelsteen',
    'graan', 'brood', 'gereedschap', 'wol', 'kleding', 'hop', 'bier', 'munten'
  ];

  /* Eaten in this order of preference: bread first (best), grain last. */
  Game.config.voedselSoorten = ['brood', 'vlees', 'graan'];

  /* The three storehouses, and what each of them holds. */
  Game.config.opslagSoorten = {
    voedsel: { naam: 'Voedsel', emoji: '🌾' },
    goed:    { naam: 'Goederen', emoji: '📦' },
    schat:   { naam: 'Schatkamer', emoji: '💰' }
  };

  Game.config.resSoort = function (id) {
    return (Game.config.resources[id] || {}).soort || 'goed';
  };

  /* Storage capacity that the town has before any warehouse is built. */
  Game.config.basisOpslag = 300;

  Game.config.res = function (id) { return Game.config.resources[id]; };

})(window.Game);
