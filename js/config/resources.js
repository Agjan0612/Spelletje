/* Resource definitions.
   `primary` resources are the six the player gathers from the land and are
   shown big in the HUD; the rest are crafted and shown in a smaller row. */
(function (Game) {

  Game.config.resources = {
    vlees:     { naam: 'Vlees',      emoji: '🥩', kleur: '#b5563f', primair: true,  voedsel: true,  start: 60 },
    hout:      { naam: 'Hout',       emoji: '🪵', kleur: '#8a6236', primair: true,  start: 120 },
    steen:     { naam: 'Steen',      emoji: '🪨', kleur: '#9aa0a6', primair: true,  start: 40 },
    ijzer:     { naam: 'IJzer',      emoji: '⛓️', kleur: '#8794a3', primair: true,  start: 0 },
    koper:     { naam: 'Koper',      emoji: '🟠', kleur: '#c47b3a', primair: true,  start: 0 },
    edelsteen: { naam: 'Edelstenen', emoji: '💎', kleur: '#63c6d6', primair: true,  start: 0 },

    /* Graan is edible as porridge, so the starting farm feeds the village
       right away; bread is the better food and unlocks in age 2. */
    graan:       { naam: 'Graan',       emoji: '🌾', kleur: '#d9b45c', voedsel: true, start: 40 },
    brood:       { naam: 'Brood',       emoji: '🍞', kleur: '#d2a05a', voedsel: true, start: 0 },
    gereedschap: { naam: 'Gereedschap', emoji: '🔨', kleur: '#b0895c', start: 0 },
    munten:      { naam: 'Munten',      emoji: '🪙', kleur: '#e0c05a', start: 30 }
  };

  /* Stable display order. */
  Game.config.resourceOrder = [
    'vlees', 'hout', 'steen', 'ijzer', 'koper', 'edelsteen',
    'graan', 'brood', 'gereedschap', 'munten'
  ];

  /* Eaten in this order of preference: bread first (best), grain last. */
  Game.config.voedselSoorten = ['brood', 'vlees', 'graan'];

  /* Storage capacity that the town has before any warehouse is built. */
  Game.config.basisOpslag = 300;

  Game.config.res = function (id) { return Game.config.resources[id]; };

})(window.Game);
