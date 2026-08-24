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

  /* `opties` comes from the new-game screen: { kaart: 'normaal',
     moeilijkheid: 'normaal' }. Both are ids from js/config/instellingen.js. */
  S.nieuw = function (seed, dorpsnaam, opties) {
    seed = seed || Math.floor(Math.random() * 1e9);
    opties = opties || {};

    /* A scenario may override the map size, the difficulty and the starting
       position; everything else about the world is generated as always. */
    var scenario = Game.config.scenario(opties.scenario);
    var regels = scenario.regels || {};
    var maat = Game.config.kaartmaat(regels.kaart || opties.kaart);
    var zwaarte = Game.config.moeilijkheid(regels.moeilijkheid || opties.moeilijkheid);

    var kaart = Game.core.map.genereer(seed, maat.b, maat.h);
    var start = Game.core.map.kiesStartplek(kaart);
    Game.core.map.maakStartplekVrij(kaart, start.x, start.y);

    var s = {
      versie: S.VERSIE,
      seed: seed,
      dorpsnaam: dorpsnaam || 'Nieuw Dorp',
      kaartmaat: maat.id,
      moeilijkheid: zwaarte.id,
      scenario: scenario.id,
      /* Set once a scenario is decided, so the end screen knows which it was. */
      scenarioAf: false, scenarioVerloren: false,

      tijd: 0,
      dag: 0,
      seizoen: 0,
      jaar: 1,

      tijdperk: 1,
      gewonnen: false,
      /* De andere afloop: gezet zodra de laatste inwoner weg is. */
      uitgestorven: false,

      snelheid: 1,

      kaart: kaart,
      start: start,
      gebouwen: [],
      volgendId: 1,

      res: {},
      verzameld: {},
      capaciteit: Game.config.basisOpslag,
      /* Per-resource ceilings, derived in herbereken from the storehouses. */
      capaciteiten: {},
      bederfRem: 0,

      /* How hard the lord squeezes: an id from config/instellingen.js. */
      belastingtarief: 'normaal',
      /* Winter firewood: how long the town has been going without. */
      koudeTimer: 0,
      koud: false,

      /* totaal stays the authority on how many mouths there are; the three
         cohorts next to it say who they are (core/demografie.js). */
      bevolking: {
        totaal: 0, werkend: 0, werkloos: 0, soldaten: 0, ruimte: 0,
        kinderen: 0, volwassenen: 0, ouderen: 0
      },
      /* Fractional accumulators for growing up, growing old and dying. */
      leeftijd: { rijp: 0, oud: 0, dood: 0 },

      /* Cached each tick by core/standen.js for the HUD and the happiness
         formula: coins per second from taxes, and the share of townsfolk
         whose standing is not being lived up to. */
      belasting: 0,
      standOntevreden: 0,
      groeiVoortgang: 0,
      tevredenheid: 60,
      hongerTimer: 0,

      /* Cached per-second flows, refreshed each tick for the HUD. */
      stroom: {},
      bonus: { productie: 1, mijnbouw: 1, voedsel: 1, bouw: 1, winter: 1, tevredenheid: 0, arbeid: 1 },
      onderzoek: {},
      verdediging: 0,

      raid: {
        fase: 'rust', timer: 90, kracht: 0, nummer: 0,
        /* Filled in when a band is on its way: how far it has marched, which
           cover already fired at it, and what the player chose to do. */
        voortgang: 0, beschoten: {}, afgeslagen: 0, beginKracht: 0,
        keuze: { evacuatie: false, burgerwacht: false }
      },

      /* The bandit captain across the field and what he remembers about you.
         Plain JSON; core/raids.js fills in the name on the first raid. */
      rovers: { naam: '', wrok: 0, ontmoetingen: 0, schattingen: 0, verslagen: 0 },

      /* The field army: how often it beat a raiding party, and whether a
         sortie is ordered for the raid that is on its way. */
      leger: { overwinningen: 0, uitval: false },

      /* How compactly the town is built around its square (0..1, derived). */
      samenhorigheid: 0,

      /* Derived in herbereken from core/buurt.js: the share of the town's
         homes that has services within reach (0..1), and the average
         desirability of the spots they stand on. */
      dienstdekking: 0,
      sfeer: 0,

      /* The village register: named inhabitants, kept in step with the
         headcount by core/dorpelingen.js. Flavour only, never authoritative. */
      dorpelingen: [],

      /* Morale: the swing that raids, feasts, contracts and events write to.
         population.js reads it as part of the happiness target and lets it
         fade back to zero on its own. */
      moreel: 0,

      /* City life. All four are plain data with a phase or a timer, in the
         same spirit as `raid` above. */
      feest: { id: null, resterend: 0, rust: 0, boost: 0 },
      handel: { fase: 'weg', timer: 240, nummer: 0, aanbod: [] },
      opdracht: { actief: null, rust: 200, gedaan: 0, gefaald: 0, laatste: null },
      gebeurtenis: { timer: 280, actief: null, ctx: null, gedaan: 0, laatste: null },

      questsGedaan: {},
      log: [],

      /* Eén meting per seizoen, zestig jaar diep (core/historie.js). */
      historie: [],

      /* Het handvest van de vrijstad — pas in werking ná de overwinning.
         core/faam.js vult het in; alleen de punten worden bewaard, de rang en
         zijn bonussen zijn afgeleid, net als bij onderzoek. */
      faam: null,

      /* Bumped whenever a street is laid or lifted, so core/logistiek.js
         knows its cached hauling distances went stale. The streets themselves
         live on the map tiles as `t.weg`. */
      wegTeller: 0,

      /* Labour policy: what kind of work gets the idle hands first, and how
         many are kept free as builders (core/arbeid.js). */
      arbeid: null,
      arbeidTimer: 0,

      /* Towns beyond the map edge: reputation, trade routes and requests.
         Generated on the first tick by core/buren.js. */
      buren: [],
      burenTimer: 0,

      /* Which resources the town has actually met: one gained, one produced
         somewhere, or one a building of yours wants. The HUD shows only these,
         so a new village is not staring at eight counters stuck on zero.
         Plain `{ id: true }`, exactly like `s.onderzoek`. */
      gezien: {}
    };

    Game.config.resourceOrder.forEach(function (id) {
      s.res[id] = Game.config.resources[id].start || 0;
      s.verzameld[id] = 0;
      s.stroom[id] = 0;
      if (s.res[id] > 0) s.gezien[id] = true;
    });

    /* Starting village: a town square, a farm and one cottage. */
    plaatsStart(s, 'dorpsplein', start.x - 1, start.y - 1);
    var boerderijPlek = zoekVrijePlek(s, start.x, start.y, 2, function (x, y) {
      return Game.core.map.nodeInBereik(s.kaart, x, y, 'vruchtbaar', 3) > 0;
    });
    if (boerderijPlek) plaatsStart(s, 'boerderij', boerderijPlek.x, boerderijPlek.y);
    var huisPlek = zoekVrijePlek(s, start.x, start.y, 1, null);
    if (huisPlek) plaatsStart(s, 'huisje', huisPlek.x, huisPlek.y);

    /* --- scenario opening position --- */
    var begin = scenario.start || {};
    if (begin.tijdperk) s.tijdperk = begin.tijdperk;
    if (begin.res) {
      for (var br in begin.res) if (s.res[br] !== undefined) s.res[br] = begin.res[br];
    }
    (begin.gebouwen || []).forEach(function (type) {
      var def = Game.config.gebouw(type);
      if (!def) return;
      var plek = zoekVrijePlek(s, start.x, start.y, def.grootte, function (x, y) {
        if (!def.plaats || !def.plaats.nabij) return true;
        return Game.core.map.nodeInBereik(s.kaart, x, y, def.plaats.nabij.node,
          def.plaats.nabij.straal) > 0;
      });
      if (plek) plaatsStart(s, type, plek.x, plek.y);
    });

    s.bevolking.totaal = begin.bevolking || 5;
    if (Game.core.faam) Game.core.faam.zorg(s);
    if (Game.core.historie) Game.core.historie.zorg(s);
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
      ervaring: 0,
      bouwPrio: 0,
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
  /* Every resource this building wins, makes, eats or burns is one the
     player now has a reason to watch. */
  function merkOp(s, d) {
    if (!s.gezien) s.gezien = {};
    var r;
    if (d.wint) s.gezien[d.wint.res] = true;
    if (d.maakt) {
      for (r in d.maakt.in) s.gezien[r] = true;
      for (r in d.maakt.uit) s.gezien[r] = true;
    }
    for (r in (d.onderhoud || {})) s.gezien[r] = true;
  }
  S.merkOp = merkOp;

  S.herbereken = function (s) {
    var ruimte = 0, opslag = Game.config.basisOpslag, verdediging = 0;
    var prodBonus = 1, werkend = 0, soldaten = 0;
    /* Per storehouse, on top of whatever the general stores hold. */
    var perSoort = { voedsel: 0, goed: 0, schat: 0 };
    var bederfRem = 0;

    for (var i = 0; i < s.gebouwen.length; i++) {
      var g = s.gebouwen[i];
      if (!g.gebouwd) continue;
      var d = S.def(g);

      ruimte += d.woonruimte || 0;
      opslag += d.opslag || 0;
      if (d.opslagPer) {
        for (var soort in d.opslagPer) perSoort[soort] = (perSoort[soort] || 0) + d.opslagPer[soort];
      }
      /* Several granaries do not stack to more than "nothing spoils". */
      if (d.bederfRem) bederfRem = Math.max(bederfRem, d.bederfRem);
      verdediging += d.verdediging || 0;
      if (d.productieBonus && !g.uit) prodBonus += d.productieBonus;

      if (d.banen) {
        werkend += g.werkers;
        if (d.banen.baan === 'soldaat') soldaten += g.werkers;
        if (d.verdPerWerker && !g.uit) verdediging += d.verdPerWerker * g.werkers;
      }

      /* A resource counts as known the moment something of yours handles it —
         so the counter for iron appears when you place the mine, not when the
         first bar comes in. */
      merkOp(s, d);
    }

    /* Research multiplies what the buildings already give. It is derived
       like everything else here — `s.onderzoek` only stores which studies
       were bought. The rank of a free city works exactly the same way and
       goes through the same mill: core/faam.js stores nothing but points. */
    var o = Game.core.onderzoek.bonus(s);
    if (Game.core.faam) o = Game.core.faam.meng(o, Game.core.faam.bonus(s));

    s.bevolking.ruimte = ruimte;
    s.capaciteit = Math.round(opslag * o.opslag);

    /* Every resource gets its own ceiling: the general stores plus whatever
       storehouse holds that kind of thing. Keeping s.capaciteit alongside it
       means the older UI and the merchant keep reading a sensible number. */
    s.capaciteiten = {};
    Game.config.resourceOrder.forEach(function (r) {
      var soort = Game.config.resSoort(r);
      s.capaciteiten[r] = Math.round((opslag + (perSoort[soort] || 0)) * o.opslag);
    });
    s.bederfRem = bederfRem;
    s.verdediging = Math.round(verdediging * o.verdediging);
    s.bonus.productie = prodBonus * o.productie;

    /* Tools speed up every mine and quarry, up to +35%. */
    s.bonus.mijnbouw = (1 + Math.min(0.35, s.res.gereedschap / 900)) * o.mijnbouw;

    s.bonus.voedsel = o.voedsel;
    s.bonus.bouw = o.bouw;
    s.bonus.winter = o.winter;
    s.bonus.tevredenheid = o.tevredenheid;

    /* Cohorts must always add up to the headcount, whatever else changed it. */
    Game.core.demografie.zorg(s);

    s.bevolking.werkend = werkend;
    s.bevolking.soldaten = soldaten;
    /* Children are mouths, not hands: only grown-ups can take a job, so the
       idle pool (which is also the building crew) counts from the workforce. */
    s.bevolking.handen = Game.core.demografie.arbeidskracht(s);
    s.bevolking.werkloos = Math.max(0, s.bevolking.handen - werkend);
    /* A greying town gets less done per pair of hands. */
    s.bonus.arbeid = Game.core.demografie.arbeidFactor(s);

    s.samenhorigheid = S.samenhorigheid(s);

    /* How well the town's homes are served by what stands near them, and how
       pleasant those spots are. Both are derived in core/buurt.js and only
       recomputed when a building actually moved. */
    var buurt = Game.core.buurt.dekking(s);
    s.dienstdekking = buurt.diensten;
    s.sfeer = buurt.aantrekkelijkheid;
  };

  /* How much the town reads as one whole rather than scattered outposts:
     the share of buildings clustered around the town square. Rewards a
     compact, lived-in village and feeds a happiness bonus. Plain 0..1. */
  S.SAMEN_STRAAL = 8;
  S.samenhorigheid = function (s) {
    var plein = null;
    for (var i = 0; i < s.gebouwen.length; i++) {
      if (s.gebouwen[i].type === 'dorpsplein') { plein = s.gebouwen[i]; break; }
    }
    if (!plein) return 0;
    var cx = plein.x + 1, cy = plein.y + 1, straal2 = S.SAMEN_STRAAL * S.SAMEN_STRAAL;
    var totaal = 0, dichtbij = 0;
    for (var j = 0; j < s.gebouwen.length; j++) {
      var g = s.gebouwen[j];
      if (!g.gebouwd || g.type === 'dorpsplein') continue;
      var d = S.def(g);
      totaal++;
      var gx = g.x + (d.grootte - 1) / 2, gy = g.y + (d.grootte - 1) / 2;
      var dx = gx - cx, dy = gy - cy;
      if (dx * dx + dy * dy <= straal2) dichtbij++;
    }
    if (totaal < 3) return 0;   /* too small to speak of a town yet */
    return Game.util.clamp(dichtbij / totaal, 0, 1);
  };

  /* Adds a resource, respecting the storage cap, and books it as gathered.
     Returns how much actually fitted. */
  S.plafond = function (s, res) {
    if (s.capaciteiten && typeof s.capaciteiten[res] === 'number') return s.capaciteiten[res];
    return s.capaciteit;
  };

  S.voegToe = function (s, res, hoeveelheid) {
    if (hoeveelheid <= 0) return 0;
    if (s.gezien && !s.gezien[res]) s.gezien[res] = true;
    var ruimte = S.plafond(s, res) - s.res[res];
    var werkelijk = Math.min(hoeveelheid, Math.max(0, ruimte));
    s.res[res] += werkelijk;
    s.verzameld[res] += werkelijk;
    if (werkelijk < hoeveelheid) s.opslagVol = res;
    return werkelijk;
  };

  /* A snapshot of the town in numbers, plus a score and the title that goes
     with it. Used by the statistics screen and the victory screen. */
  S.statistiek = function (s) {
    var verzameld = 0;
    Game.config.resourceOrder.forEach(function (r) { verzameld += s.verzameld[r] || 0; });

    var gebouwd = 0;
    for (var i = 0; i < s.gebouwen.length; i++) if (s.gebouwen[i].gebouwd) gebouwd++;

    var onderzoek = Object.keys(s.onderzoek || {}).length;
    var opdrachten = (s.opdracht && s.opdracht.gedaan) || 0;
    /* Faam telt zwaar mee: het is het enige dat ná de overwinning nog groeit,
       en zonder dat zou de score daar stil blijven staan. */
    var faam = (s.gewonnen && s.faam) ? s.faam.punten : 0;

    var punten = Math.round(
      s.bevolking.totaal * 8 +
      gebouwd * 6 +
      s.tevredenheid +
      (s.tijdperk - 1) * 120 +
      onderzoek * 60 +
      opdrachten * 30 +
      faam * 90 +
      verzameld / 50 +
      (s.gewonnen ? 500 : 0)
    );

    return {
      bevolking: s.bevolking.totaal,
      gebouwen: gebouwd,
      jaar: s.jaar,
      tevredenheid: Math.round(s.tevredenheid),
      verzameld: Math.round(verzameld),
      onderzoek: onderzoek,
      opdrachten: opdrachten,
      rooftochten: (s.raid && s.raid.nummer) || 0,
      faam: faam,
      punten: punten,
      rang: rang(punten)
    };
  };

  function rang(punten) {
    if (punten < 350) return 'Gehucht in de wildernis';
    if (punten < 800) return 'Dorp met een naam';
    if (punten < 1500) return 'Bloeiende handelsstad';
    if (punten < 2400) return 'Vrije stad met stadsrechten';
    return 'Parel van het rijk';
  }

  S.kanBetalen = function (s, kosten) {
    for (var r in kosten) if (s.res[r] < kosten[r]) return false;
    return true;
  };

  S.betaal = function (s, kosten) {
    for (var r in kosten) s.res[r] -= kosten[r];
  };

  Game.core.state = S;

})(window.Game);
