/* Job definitions. A building points at one job id; the job carries the name
   and icon used in the UI and in the villager drawings on the map. */
(function (Game) {

  Game.config.jobs = {
    boer:        { naam: 'Boer',        emoji: '👨‍🌾', kleur: '#c9b458' },
    houthakker:  { naam: 'Houthakker',  emoji: '🪓',   kleur: '#8a6236' },
    jager:       { naam: 'Jager',       emoji: '🏹',   kleur: '#7d5b3a' },
    visser:      { naam: 'Visser',      emoji: '🎣',   kleur: '#5c8fa8' },
    steenhouwer: { naam: 'Steenhouwer', emoji: '⛏️',   kleur: '#9aa0a6' },
    mijnwerker:  { naam: 'Mijnwerker',  emoji: '👷',   kleur: '#a08050' },
    bakker:      { naam: 'Bakker',      emoji: '🥖',   kleur: '#d2a05a' },
    molenaar:    { naam: 'Molenaar',    emoji: '🌬️',   kleur: '#cfc2a0' },
    smid:        { naam: 'Smid',        emoji: '🔨',   kleur: '#8794a3' },
    wapensmid:   { naam: 'Wapensmid',   emoji: '⚔️',   kleur: '#b04a3a' },
    handelaar:   { naam: 'Handelaar',   emoji: '🪙',   kleur: '#e0c05a' },
    schipper:    { naam: 'Schipper',    emoji: '⛵',   kleur: '#3f7a8c' },
    waard:       { naam: 'Waard',       emoji: '🍺',   kleur: '#c98a4a' },
    priester:    { naam: 'Priester',    emoji: '✝️',   kleur: '#e8e0cc' },
    juwelier:    { naam: 'Juwelier',    emoji: '💍',   kleur: '#63c6d6' },
    geleerde:    { naam: 'Geleerde',    emoji: '📚',   kleur: '#9a7fc0' },
    soldaat:     { naam: 'Soldaat',     emoji: '🛡️',   kleur: '#a63a2a' },
    bouwer:      { naam: 'Bouwer',      emoji: '🧰',   kleur: '#d7a94b' },
    werkloos:    { naam: 'Werkloos',    emoji: '🧍',   kleur: '#b0a08c' }
  };

})(window.Game);
