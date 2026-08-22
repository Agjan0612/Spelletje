/* Labour policy: telling the town what matters instead of clicking + fifty times.
 *
 * Assigning workers one building at a time is fine for a hamlet and pure
 * repetitive strain for a city of a hundred. This lets the player say what
 * kind of work has priority and lets the villagers sort themselves out.
 *
 * Deliberately conservative: the automatic pass only ever *fills* empty slots
 * from the idle pool, in priority order, and always leaves builders free. It
 * never pulls someone off a bench — that would fight the practice bonus in
 * economy.js, which exists precisely to make stable crews worth something.
 * The one-off `herverdeel` is the exception, and the player has to ask for it.
 */
(function (Game) {

  var A = {};

  /* Which drawer a building belongs in. Derived from what it does, so a new
     building in config lands in the right category with no extra field. */
  A.SOORTEN = [
    { id: 'voedsel',   naam: 'Voedsel',      emoji: '🌾' },
    { id: 'grondstof', naam: 'Grondstoffen', emoji: '🪵' },
    { id: 'ambacht',   naam: 'Ambacht',      emoji: '🔨' },
    { id: 'handel',    naam: 'Handel',       emoji: '🪙' },
    { id: 'dienst',    naam: 'Voorzieningen', emoji: '⛪' },
    { id: 'leger',     naam: 'Leger',        emoji: '🛡️' }
  ];

  A.soortVan = function (d) {
    if (!d.banen) return null;
    if (d.banen.baan === 'soldaat') return 'leger';
    if (Game.core.population.isVoedselgebouw(d)) return 'voedsel';
    if (d.wint) return 'grondstof';
    if (d.maakt && d.maakt.uit && (d.maakt.uit.munten)) return 'handel';
    if (d.maakt) return 'ambacht';
    if (d.tevredenheid) return 'dienst';
    return 'ambacht';
  };

  /* 0 = leave empty, 1 = low, 2 = normal, 3 = first in line. */
  A.STANDAARD = { voedsel: 3, grondstof: 2, ambacht: 2, handel: 2, dienst: 2, leger: 1 };

  A.zorg = function (s) {
    if (!s.arbeid) s.arbeid = { auto: false, bouwers: 3, prioriteit: {} };
    if (typeof s.arbeid.auto !== 'boolean') s.arbeid.auto = false;
    if (typeof s.arbeid.bouwers !== 'number') s.arbeid.bouwers = 3;
    if (!s.arbeid.prioriteit) s.arbeid.prioriteit = {};
    A.SOORTEN.forEach(function (soort) {
      if (typeof s.arbeid.prioriteit[soort.id] !== 'number') {
        s.arbeid.prioriteit[soort.id] = A.STANDAARD[soort.id];
      }
    });
    if (typeof s.arbeidTimer !== 'number') s.arbeidTimer = 0;
  };

  /* Buildings with room, sorted by how much the player wants them staffed.
     Ties go to the emptiest building, so a new workshop is not left idle
     while an almost-full one gets the last hand. */
  function kandidaten(s) {
    A.zorg(s);
    var lijst = [];
    for (var i = 0; i < s.gebouwen.length; i++) {
      var g = s.gebouwen[i];
      if (!g.gebouwd || g.uit) continue;
      var d = Game.core.state.def(g);
      if (!d.banen || g.werkers >= d.banen.aantal) continue;
      var soort = A.soortVan(d);
      var prio = s.arbeid.prioriteit[soort];
      if (!prio) continue;                       /* 0 = deliberately unstaffed */
      lijst.push({ g: g, d: d, prio: prio, vulling: g.werkers / d.banen.aantal });
    }
    lijst.sort(function (a, b) {
      if (b.prio !== a.prio) return b.prio - a.prio;
      return a.vulling - b.vulling;
    });
    return lijst;
  }

  /* Hand out idle villagers, keeping `bouwers` free — idle people are the
     building crew, and a town where everyone has a job never finishes
     anything again. */
  A.vulAan = function (s) {
    A.zorg(s);
    var lijst = kandidaten(s);
    var gezet = 0;
    for (var i = 0; i < lijst.length; i++) {
      var k = lijst[i];
      while (s.bevolking.werkloos > s.arbeid.bouwers && k.g.werkers < k.d.banen.aantal) {
        Game.core.population.zetWerkers(s, k.g, k.g.werkers + 1);
        gezet++;
      }
      if (s.bevolking.werkloos <= s.arbeid.bouwers) break;
    }
    return gezet;
  };

  /* The one-off the player asks for: empty every bench and deal the whole
     workforce out again by priority. Costs practice, hence the button. */
  A.herverdeel = function (s) {
    A.zorg(s);
    for (var i = 0; i < s.gebouwen.length; i++) {
      var g = s.gebouwen[i];
      var d = Game.core.state.def(g);
      if (!d.banen || !g.werkers) continue;
      Game.core.population.zetWerkers(s, g, 0);
    }
    var gezet = A.vulAan(s);
    Game.ui.log.schrijf(s, '👥 De arbeid is opnieuw verdeeld: ' +
      Game.util.telwoord(gezet, 'dorpeling', 'dorpelingen') + ' aan het werk.');
    return gezet;
  };

  A.INTERVAL = 3;   /* seconds between automatic passes */

  A.tick = function (s, dt) {
    A.zorg(s);
    if (!s.arbeid.auto) return;
    s.arbeidTimer -= dt;
    if (s.arbeidTimer > 0) return;
    s.arbeidTimer = A.INTERVAL;
    if (s.bevolking.werkloos > s.arbeid.bouwers) A.vulAan(s);
  };

  /* For the panel: how many hands each category currently holds. */
  A.verdeling = function (s) {
    A.zorg(s);
    var per = {};
    A.SOORTEN.forEach(function (soort) { per[soort.id] = { werkers: 0, plekken: 0 }; });
    for (var i = 0; i < s.gebouwen.length; i++) {
      var g = s.gebouwen[i];
      if (!g.gebouwd) continue;
      var d = Game.core.state.def(g);
      if (!d.banen) continue;
      var soort = A.soortVan(d);
      if (!per[soort]) continue;
      per[soort].werkers += g.werkers;
      per[soort].plekken += d.banen.aantal;
    }
    return per;
  };

  Game.core.arbeid = A;

})(window.Game);
