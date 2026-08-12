/* The complete game state plus the helpers that read it.
   Everything here is plain data so a save is just JSON.stringify(state). */
(function (Game) {

  var S = {};

  S.VERSIE = 1;

  /* Seconds of simulated time per in-game day. */
  S.DAG = 10;
  S.DAGEN_PER_SEIZOEN = 12;
  S.SEIZOENEN = ['Lente', 'Zomer', 'Herfst', 'Winter'];
  S.SEIZOEN_EMOJI = ['🌱', '☀️', '🍂', '❄️'];

  S.nieuw = function (seed, dorpsnaam) {
    seed = seed || Math.floor(Math.random() * 1e9);

    var kaart = Game.core.map.genereer(seed);
    var start = Game.core.map.kiesStartplek(kaart);
    Game.core.map.maakStartplekVrij(kaart, start.x, start.y);

    var s = {
      versie: S.VERSIE,
      seed: seed,
      dorpsnaam: dorpsnaam || 'Nieuw Dorp',

      tijd: 0,
      dag: 0,
      seizoen: 0,
      jaar: 1,

      tijdperk: 1,
      gewonnen: false,

      snelheid: 1,

      kaart: kaart,
      start: start,
      gebouwen: [],
      volgendId: 1,

      res: {},
      verzameld: {},
      capaciteit: Game.config.basisOpslag,

      bevolking: { totaal: 0, werkend: 0, werkloos: 0, soldaten: 0, ruimte: 0 },
      groeiVoortgang: 0,
      tevredenheid: 60,
      hongerTimer: 0,

      /* Cached per-second flows, refreshed each tick for the HUD. */
      stroom: {},
      bonus: { productie: 1, mijnbouw: 1 },
      verdediging: 0,

      raid: { fase: 'rust', timer: 90, kracht: 0, nummer: 0 },

      /* Age-2+ activities: festivals, the travelling merchant, the lord's
         orders and random events. All plain data so the save stays JSON. */
      feest: { cooldown: 0 },
      handel: { fase: 'rust', timer: 260, aanbod: null },
      opdracht: { actief: false, cooldown: 50 },
      gebeurtenisTimer: 200,

      /* The village register: named inhabitants, kept in step with the
         headcount by core/dorpelingen.js. Flavour only, never authoritative. */
      dorpelingen: [],

      questsGedaan: {},
      log: [],

      /* Purely cosmetic walkers on the map. */
      wandelaars: []
    };

    Game.config.resourceOrder.forEach(function (id) {
      s.res[id] = Game.config.resources[id].start || 0;
      s.verzameld[id] = 0;
      s.stroom[id] = 0;
    });

    /* Starting village: a town square, a farm and one cottage. */
    plaatsStart(s, 'dorpsplein', start.x - 1, start.y - 1);
    var boerderijPlek = zoekVrijePlek(s, start.x, start.y, 2, function (x, y) {
      return Game.core.map.nodeInBereik(s.kaart, x, y, 'vruchtbaar', 3) > 0;
    });
    if (boerderijPlek) plaatsStart(s, 'boerderij', boerderijPlek.x, boerderijPlek.y);
    var huisPlek = zoekVrijePlek(s, start.x, start.y, 1, null);
    if (huisPlek) plaatsStart(s, 'huisje', huisPlek.x, huisPlek.y);

    s.bevolking.totaal = 5;
    S.herbereken(s);

    /* Give the farm two workers so the village is alive from the first second. */
    var boerderij = s.gebouwen.filter(function (g) { return g.type === 'boerderij'; })[0];
    if (boerderij) boerderij.werkers = 2;
    S.herbereken(s);

    return s;
  };

  function plaatsStart(s, type, x, y) {
    var def = Game.config.gebouw(type);
    var g = {
      id: s.volgendId++,
      type: type,
      x: x, y: y,
      werkers: 0,
      voortgang: def.bouwtijd,
      gebouwd: true,
      uit: false,
      waarschuwing: ''
    };
    s.gebouwen.push(g);
    Game.core.construction.markeerTegels(s, g);
    return g;
  }

  /* Spiral outwards from (cx, cy) looking for a free spot of `grootte` tiles
     that also satisfies `extraEis` (may be null). */
  function zoekVrijePlek(s, cx, cy, grootte, extraEis) {
    for (var r = 1; r < 14; r++) {
      for (var dy = -r; dy <= r; dy++) {
        for (var dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          var x = cx + dx, y = cy + dy;
          if (!Game.core.construction.plekVrij(s, x, y, grootte)) continue;
          if (extraEis && !extraEis(x, y)) continue;
          return { x: x, y: y };
        }
      }
    }
    return null;
  }
  S.zoekVrijePlek = zoekVrijePlek;

  /* ---------------------------------------------------------------- lookups */

  S.gebouw = function (s, id) {
    for (var i = 0; i < s.gebouwen.length; i++) if (s.gebouwen[i].id === id) return s.gebouwen[i];
    return null;
  };

  S.telType = function (s, type) {
    var n = 0;
    for (var i = 0; i < s.gebouwen.length; i++) {
      if (s.gebouwen[i].type === type && s.gebouwen[i].gebouwd) n++;
    }
    return n;
  };

  S.def = function (g) { return Game.config.gebouw(g.type); };

  /* Recompute everything derived from the buildings: housing, storage,
     defence, global bonuses and the worker tally. */
  S.herbereken = function (s) {
    var ruimte = 0, opslag = Game.config.basisOpslag, verdediging = 0;
    var prodBonus = 1, werkend = 0, soldaten = 0;

    for (var i = 0; i < s.gebouwen.length; i++) {
      var g = s.gebouwen[i];
      if (!g.gebouwd) continue;
      var d = S.def(g);

      ruimte += d.woonruimte || 0;
      opslag += d.opslag || 0;
      verdediging += d.verdediging || 0;
      if (d.productieBonus && !g.uit) prodBonus += d.productieBonus;

      if (d.banen) {
        werkend += g.werkers;
        if (d.banen.baan === 'soldaat') soldaten += g.werkers;
        if (d.verdPerWerker && !g.uit) verdediging += d.verdPerWerker * g.werkers;
      }
    }

    s.bevolking.ruimte = ruimte;
    s.capaciteit = opslag;
    s.verdediging = Math.round(verdediging);
    s.bonus.productie = prodBonus;

    /* Tools speed up every mine and quarry, up to +35%. */
    s.bonus.mijnbouw = 1 + Math.min(0.35, s.res.gereedschap / 900);

    s.bevolking.werkend = werkend;
    s.bevolking.soldaten = soldaten;
    s.bevolking.werkloos = Math.max(0, s.bevolking.totaal - werkend);
  };

  /* Adds a resource, respecting the storage cap, and books it as gathered.
     Returns how much actually fitted. */
  S.voegToe = function (s, res, hoeveelheid) {
    if (hoeveelheid <= 0) return 0;
    var ruimte = s.capaciteit - s.res[res];
    var werkelijk = Math.min(hoeveelheid, Math.max(0, ruimte));
    s.res[res] += werkelijk;
    s.verzameld[res] += werkelijk;
    if (werkelijk < hoeveelheid) s.opslagVol = res;
    return werkelijk;
  };

  S.kanBetalen = function (s, kosten) {
    for (var r in kosten) if (s.res[r] < kosten[r]) return false;
    return true;
  };

  S.betaal = function (s, kosten) {
    for (var r in kosten) s.res[r] -= kosten[r];
  };

  Game.core.state = S;

})(window.Game);
