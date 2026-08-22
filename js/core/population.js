/* Villagers: eating, happiness, growth and job assignment.
   Individual people are not simulated — the village is a headcount plus the
   worker slots they occupy. That keeps the game readable and fast. */
(function (Game) {

  var P = {};

  /* Food eaten per villager per second. */
  var HONGER = 0.05;

  /* Days of food in store before the village dares to grow. */
  var GROEI_VOORRAAD = 3;

  P.tick = function (s, dt) {
    eten(s, dt);
    tevredenheid(s, dt);
    groei(s, dt);
  };

  /* ------------------------------------------------------------------ eten */

  /* Mouths to feed, weighted: a child does not eat a grown portion. Used both
     for consumption and for the days-of-supply figure, so the growth gate and
     the larder always speak about the same thing. */
  P.monden = function (s) {
    var b = s.bevolking;
    var kind = b.kinderen || 0;
    var rest = Math.max(0, (b.totaal || 0) - kind);
    return rest + kind * Game.config.leeftijd.kinderEten;
  };

  function eten(s, dt) {
    var nodig = P.monden(s) * HONGER * dt;
    /* Winter costs extra fuel; the wintervoorraad study softens that. */
    if (s.seizoen === 3) nodig *= 1 + 0.3 * (s.bonus.winter === undefined ? 1 : s.bonus.winter);
    if (nodig <= 0) { s.voedselTekort = 0; return; }

    var soorten = Game.config.voedselSoorten;
    var gegeten = 0;
    var variatie = 0;

    for (var i = 0; i < soorten.length && gegeten < nodig; i++) {
      var r = soorten[i];
      if (s.res[r] <= 0) continue;
      /* Spread consumption over the available kinds so variety is real. */
      var deel = Math.min(s.res[r], (nodig - gegeten) * (i === soorten.length - 1 ? 1 : 0.75));
      if (deel <= 0) continue;
      s.res[r] -= deel;
      s.stroom[r] -= (deel / dt) * 0.2;
      gegeten += deel;
      variatie++;
    }
    /* Second pass: top up from whatever is left. */
    for (var j = 0; j < soorten.length && gegeten < nodig - 1e-9; j++) {
      var r2 = soorten[j];
      if (s.res[r2] <= 0) continue;
      var rest = Math.min(s.res[r2], nodig - gegeten);
      s.res[r2] -= rest;
      gegeten += rest;
    }

    s.voedselVariatie = variatie;
    s.voedselTekort = Math.max(0, nodig - gegeten);

    if (s.voedselTekort > 1e-6) {
      s.hongerTimer += dt;
      if (s.hongerTimer > 12) {
        s.hongerTimer = 0;
        if (s.bevolking.totaal > 1) {
          verwijderDorpeling(s);
          Game.ui.log.schrijf(s, '💀 Een dorpeling is van honger vertrokken. Bouw meer voedsel!', 'slecht');
        }
      }
    } else {
      s.hongerTimer = Math.max(0, s.hongerTimer - dt * 0.5);
    }

    waarschuwVoorHonger(s, dt);
  }

  /* One clear warning per season when the larder runs low, so a famine never
     arrives out of nowhere. */
  function waarschuwVoorHonger(s, dt) {
    s.voedselWaarschuwing = (s.voedselWaarschuwing || 0) - dt;
    if (s.voedselWaarschuwing > 0) return;

    var dagen = P.voedselDagen(s);
    if (dagen < 2 && s.bevolking.totaal > 3) {
      s.voedselWaarschuwing = 45;
      Game.ui.log.schrijf(s, '🍽️ Je voedselvoorraad raakt op (' + dagen.toFixed(1) +
        ' dagen). Zet meer mensen op jacht, visserij of de akkers.', 'slecht');
    }
  }

  /* Total food in store, expressed in days of supply. */
  P.voedselVoorraad = function (s) {
    var totaal = 0;
    Game.config.voedselSoorten.forEach(function (r) { totaal += s.res[r]; });
    return totaal;
  };

  P.voedselDagen = function (s) {
    var perDag = Math.max(0.001, P.monden(s) * HONGER * Game.core.state.DAG);
    return P.voedselVoorraad(s) / perDag;
  };

  /* ---------------------------------------------------------- tevredenheid */

  /* Town-wide service total. Kept for the overview screens; the happiness
     calculation itself uses the *local* coverage from core/buurt.js, because
     a chapel only comforts the people who can walk to it. */
  P.dienstenPunten = function (s) {
    var perType = {};
    for (var i = 0; i < s.gebouwen.length; i++) {
      var g = s.gebouwen[i];
      if (!g.gebouwd || g.uit) continue;
      var d = Game.core.state.def(g);
      if (!d.tevredenheid) continue;
      perType[g.type] = (perType[g.type] || 0) + 1;
    }
    var punten = 0;
    for (var type in perType) {
      /* Diminishing returns: the fourth chapel is worth much less than the first. */
      punten += Game.config.gebouw(type).tevredenheid * Math.sqrt(perType[type]);
    }
    return punten;
  };

  P.tevredenheidDetail = function (s) {
    var dagen = P.voedselDagen(s);
    var voedsel = Game.util.clamp(dagen / 4, 0, 1) * 26;
    var variatie = ({ 0: 0, 1: 0, 2: 6, 3: 10 })[Math.min(3, s.voedselVariatie || 0)] || 0;

    var over = s.bevolking.ruimte - s.bevolking.totaal;
    var wonen = over >= 0 ? Math.min(8, over * 1.5) : Math.max(-30, over * 4);

    /* Services count where they stand. core/buurt.js walks every home, adds
       up what it can reach, and averages that over the town weighted by how
       many people live in each house. A city therefore scales naturally: the
       further it sprawls, the harder its edges are to serve.
       Falls back to the live computation for a state that has not been
       through herbereken yet. */
    var dekking = typeof s.dienstdekking === 'number'
      ? s.dienstdekking : Game.core.buurt.dekking(s).diensten;
    var diensten = dekking * 40;

    /* And how pleasant those homes stand: a fountain on the square lifts the
       street, a tannery or a quarry at the end of it does the opposite. */
    var sfeerWaarde = typeof s.sfeer === 'number'
      ? s.sfeer : Game.core.buurt.dekking(s).aantrekkelijkheid;
    var sfeer = Game.util.clamp(sfeerWaarde * 0.6, -12, 10);

    /* A town with children playing in the street and grandparents on the
       bench feels like a place, not a work camp. */
    var lft = Game.config.leeftijd;
    var totaalMensen = Math.max(1, s.bevolking.totaal);
    var generaties =
      lft.tevredenheidKinderen * Math.min(1, (s.bevolking.kinderen || 0) / (totaalMensen * 0.22)) +
      lft.tevredenheidOuderen * Math.min(1, (s.bevolking.ouderen || 0) / (totaalMensen * 0.12));

    /* Burghers and patricians who are not getting the variety and the
       services their standing calls for make that felt. */
    var stand = -14 * (s.standOntevreden || 0);

    /* A close-knit, compactly built town lifts everyone's spirits a little.
       Worth less than it was: local services now do most of that work, and
       counting compactness twice would double-charge the same virtue. */
    var samen = (s.samenhorigheid || 0) * 5;

    var honger = s.voedselTekort > 1e-6 ? -22 : 0;
    var moreel = s.moreel || 0;
    var onderzoek = s.bonus.tevredenheid || 0;

    return {
      basis: 20, voedsel: voedsel, variatie: variatie, wonen: wonen,
      diensten: diensten, sfeer: sfeer, samen: samen, honger: honger,
      moreel: moreel, onderzoek: onderzoek,
      generaties: generaties, stand: stand,
      dekking: dekking,
      doel: Game.util.clamp(20 + voedsel + variatie + wonen + diensten + sfeer + samen +
        generaties + stand + honger + moreel + onderzoek, 0, 100)
    };
  };

  function tevredenheid(s, dt) {
    var det = P.tevredenheidDetail(s);
    var richting = det.doel - s.tevredenheid;
    s.tevredenheid += Game.util.clamp(richting, -6 * dt, 6 * dt);
    s.tevredenheid = Game.util.clamp(s.tevredenheid, 0, 100);

    /* Morale from raids fades away over a couple of minutes. */
    if (s.moreel) {
      s.moreel += (s.moreel > 0 ? -1 : 1) * Math.min(Math.abs(s.moreel), dt * 0.12);
      if (Math.abs(s.moreel) < 0.05) s.moreel = 0;
    }
  }

  /* ------------------------------------------------------------------ groei */

  function groei(s, dt) {
    var vrij = s.bevolking.ruimte - s.bevolking.totaal;

    if (s.tevredenheid < 25 && s.bevolking.totaal > 3) {
      s.krimpTimer = (s.krimpTimer || 0) + dt;
      if (s.krimpTimer > 25) {
        s.krimpTimer = 0;
        verwijderDorpeling(s);
        Game.ui.log.schrijf(s, '😞 Een ontevreden dorpeling heeft je dorp verlaten.', 'slecht');
      }
      return;
    }
    s.krimpTimer = 0;

    if (vrij <= 0) { s.groeiVoortgang = Math.min(s.groeiVoortgang, 0.9); return; }
    if (s.tevredenheid < 45) return;

    /* Grow only on a real buffer, not on the last crumbs. The stock is a
       direct mirror of production minus consumption, so this stops the
       village from outgrowing its farms and starving afterwards. */
    if (P.voedselDagen(s) < GROEI_VOORRAAD) return;

    var tempo = ((s.tevredenheid - 45) / 55) * 0.05 * (1 + Math.sqrt(s.bevolking.totaal) * 0.5);
    s.groeiVoortgang += tempo * dt;

    while (s.groeiVoortgang >= 1 && s.bevolking.ruimte - s.bevolking.totaal > 0) {
      s.groeiVoortgang -= 1;
      s.bevolking.totaal++;
      /* Some newcomers are families moving in, some are born here — and the
         latter cannot work for a couple of years. The headcount growth itself
         is unchanged, so the food and housing balance carries over. */
      var soort = Game.core.demografie.nieuweInwoner(s);
      Game.core.state.herbereken(s);
      Game.ui.log.schrijf(s, soort === 'kind'
        ? '👶 Er is een kind geboren in je dorp.'
        : '🧳 Een nieuwe dorpeling heeft zich gevestigd.', 'goed');
    }
  }

  /* Does this building put food on the table? */
  function isVoedselgebouw(d) {
    if (d.wint && Game.config.resources[d.wint.res].voedsel) return true;
    if (d.maakt) {
      for (var r in d.maakt.uit) if (Game.config.resources[r].voedsel) return true;
    }
    return false;
  }
  P.isVoedselgebouw = isVoedselgebouw;

  /* Removes one villager, taking them off a job if needed.
     Order matters enormously: if hunger took the farmers first, one bad
     winter would snowball into a wiped-out village. Food workers are the
     very last to go, so the village shrinks to a size it can feed and
     then holds there. */
  function verwijderDorpeling(s, stil) {
    if (s.bevolking.werkloos <= 0) {
      var kandidaten = s.gebouwen.filter(function (g) {
        var d = Game.core.state.def(g);
        return g.gebouwd && d.banen && g.werkers > 0;
      });
      kandidaten.sort(function (a, b) { return rang(a) - rang(b); });
      if (kandidaten.length) kandidaten[0].werkers--;
    }
    s.bevolking.totaal = Math.max(0, s.bevolking.totaal - 1);
    Game.core.state.herbereken(s);
    return !stil;
  }

  function rang(g) {
    var d = Game.core.state.def(g);
    if (isVoedselgebouw(d)) return 3;
    if (d.banen.baan === 'soldaat') return 2;
    return 1;
  }
  P.verwijderDorpeling = verwijderDorpeling;

  /* ------------------------------------------------------------------ banen */

  P.zetWerkers = function (s, g, aantal) {
    var d = Game.core.state.def(g);
    if (!d.banen) return;
    aantal = Game.util.clamp(Math.round(aantal), 0, d.banen.aantal);
    var verschil = aantal - g.werkers;
    if (verschil > 0) verschil = Math.min(verschil, s.bevolking.werkloos);
    /* Taking practised hands off a workbench loses part of the practice, so
       shuffling villagers around every few minutes has a price. */
    if (verschil < 0 && g.ervaring) g.ervaring *= 0.75;
    g.werkers += verschil;
    Game.core.state.herbereken(s);
  };

  /* Fills a freshly finished building from the idle pool, but always leaves
     someone free: idle villagers are the builders, and a village where every
     single person has a job would never finish anything again. */
  P.autoBemannen = function (s, g) {
    var d = Game.core.state.def(g);
    if (!d.banen) return;
    var vrij = s.bevolking.werkloos;
    if (vrij <= 0) return;
    var aantal = Math.min(d.banen.aantal, vrij, Math.max(1, vrij - 1));
    P.zetWerkers(s, g, aantal);
  };

  /* Safety net: never keep more workers assigned than there are villagers. */
  P.corrigeer = function (s) {
    var teveel = s.bevolking.werkend - s.bevolking.totaal;
    if (teveel <= 0) return;
    for (var i = s.gebouwen.length - 1; i >= 0 && teveel > 0; i--) {
      var g = s.gebouwen[i];
      var d = Game.core.state.def(g);
      if (!d.banen || g.werkers <= 0) continue;
      var af = Math.min(g.werkers, teveel);
      g.werkers -= af;
      teveel -= af;
    }
    Game.core.state.herbereken(s);
  };

  Game.core.population = P;

})(window.Game);
