/* Production, crafting, upkeep and storage limits. */
(function (Game) {

  var E = {};
  var map = Game.core.map;

  /* Regrowth per second per tile, in the growing seasons only.
     Woodland grows back and game animals breed; ore does not. */
  var BOSGROEI = 0.13;
  var WILDGROEI = 0.05;

  E.tick = function (s, dt) {
    var flux = {};
    Game.config.resourceOrder.forEach(function (r) { flux[r] = 0; });

    var seizoen = Game.core.seasons;

    for (var i = 0; i < s.gebouwen.length; i++) {
      var g = s.gebouwen[i];
      if (!g.gebouwd) continue;
      var d = Game.core.state.def(g);
      g.waarschuwing = '';

      /* --- upkeep ------------------------------------------------------- */
      if (d.onderhoud) {
        var betaald = true;
        for (var r in d.onderhoud) {
          var nodig = d.onderhoud[r] * dt;
          if (s.res[r] >= nodig) {
            s.res[r] -= nodig;
            flux[r] -= d.onderhoud[r];
          } else {
            betaald = false;
          }
        }
        if (!betaald) {
          g.waarschuwing = 'Geen onderhoud — dit gebouw ligt stil';
          continue;
        }
      }

      if (g.uit) { g.waarschuwing = 'Handmatig stilgelegd'; continue; }

      /* Evacuated outskirts and besieged fields simply do not work today. */
      var onderbroken = Game.core.raids.werkOnderbroken(s, g);
      if (onderbroken) { g.waarschuwing = onderbroken; continue; }
      if (!d.banen || g.werkers === 0) {
        if (d.banen) g.waarschuwing = 'Geen werkers toegewezen';
        continue;
      }

      /* Happiness matters, but never enough to be self-reinforcing: a hungry
         village would otherwise produce less food, go hungrier still, and
         spiral into nothing. The floor of 0.75 keeps a bad patch recoverable. */
      var mult = s.bonus.productie * (0.75 + 0.25 * (s.tevredenheid / 100));

      /* And the haul home: a workplace far from any barn loses part of its
         day to walking. Floored at 0.5 in logistiek.js for the same reason
         the happiness multiplier is floored — a bad spot is a bad decision,
         never a dead end. */
      var vracht = Game.core.logistiek.factor(s, g);
      mult *= vracht;

      /* A greying workforce, and the practised hands of a crew that has been
         doing the same job in the same place for a while. */
      mult *= (s.bonus.arbeid || 1);
      mult *= 1 + E.ERVARING_BONUS * (g.ervaring || 0);
      if (vracht < 0.85) {
        g.waarschuwing = 'Ver van je opslag — maar ' + Math.round(vracht * 100) +
          '% komt aan. Bouw een voorraadschuur dichterbij of leg een straat.';
      }

      /* --- extraction --------------------------------------------------- */
      if (d.wint) {
        var w = d.wint;
        var tempo = w.tempo * g.werkers * mult * s.bonus.mijnbouw;
        if (Game.config.resources[w.res].voedsel) tempo *= (s.bonus.voedsel || 1);
        if (d.seizoensgevoelig) tempo *= seizoen.factor(s, 'jacht');
        if (g.type === 'vissershut') tempo *= havenBonus(s, g) * vorstBonus(s, g);

        var wil = tempo * dt;
        var gehaald = 0;
        var pogingen = 0;
        while (wil - gehaald > 1e-6 && pogingen < 6) {
          var tegel = map.zoekNode(s.kaart, g.x, g.y, w.node, w.straal);
          if (!tegel) break;
          var pak = Math.min(wil - gehaald, tegel.amt);
          tegel.amt -= pak;
          gehaald += pak;
          pogingen++;
        }
        if (gehaald > 0) {
          Game.core.state.voegToe(s, w.res, gehaald);
          flux[w.res] += gehaald / dt;
        }
        if (gehaald < wil - 1e-6) {
          g.waarschuwing = map.nodeNaam[w.node] + ' in de omgeving is uitgeput';
        }
      }

      /* --- crafting ----------------------------------------------------- */
      if (d.maakt) {
        var factor = g.werkers * mult;
        if (d.seizoensgevoelig) factor *= seizoen.factor(s, 'akker');
        if (isAkker(d)) factor *= molenBonus(s, g) * akkerBonus(s, g, d);

        if (factor > 0) {
          /* Scale the recipe down to what the inputs allow. */
          var deel = 1;
          for (var inRes in d.maakt.in) {
            var wens = d.maakt.in[inRes] * factor * dt;
            if (wens > 0) deel = Math.min(deel, s.res[inRes] / wens);
          }
          deel = Game.util.clamp(deel, 0, 1);

          if (deel < 0.999) {
            var mist = Object.keys(d.maakt.in).filter(function (rr) {
              return s.res[rr] < d.maakt.in[rr] * factor * dt;
            });
            if (mist.length) {
              g.waarschuwing = 'Te weinig ' + mist.map(function (rr) {
                return Game.config.resources[rr].naam.toLowerCase();
              }).join(' en ');
            }
          }

          if (deel > 0) {
            for (var inRes2 in d.maakt.in) {
              var op = d.maakt.in[inRes2] * factor * deel * dt;
              s.res[inRes2] -= op;
              flux[inRes2] -= op / dt;
            }
            for (var uitRes in d.maakt.uit) {
              var voedselBonus = Game.config.resources[uitRes].voedsel ? (s.bonus.voedsel || 1) : 1;
              var maak = d.maakt.uit[uitRes] * factor * deel * dt * voedselBonus;
              var werkelijk = Game.core.state.voegToe(s, uitRes, maak);
              flux[uitRes] += werkelijk / dt;
            }
          } else if (d.seizoensgevoelig && seizoen.factor(s, 'akker') === 0) {
            g.waarschuwing = 'De akkers liggen onder de sneeuw';
          }
        } else if (d.seizoensgevoelig && seizoen.factor(s, 'akker') === 0) {
          g.waarschuwing = 'De akkers liggen onder de sneeuw';
        }
      }
    }

    ervaringGroeit(s, dt);
    brandhout(s, dt);
    bederf(s, dt);
    E.natuurGroeit(s, dt);
    meldVolleOpslag(s, dt);

    /* Smooth the flow numbers a little so the HUD does not flicker. */
    Game.config.resourceOrder.forEach(function (r) {
      s.stroom[r] = s.stroom[r] * 0.8 + flux[r] * 0.2;
    });
  };

  /* Firewood. Every winter the town burns timber simply to stay alive, which
     turns wood from a starter resource into a standing worry and makes autumn
     the season you actually plan for. Running out is miserable and, in time,
     deadly — but never instantly, so a bad winter is survivable. */
  function brandhout(s, dt) {
    var w = Game.config.winter;
    if (s.seizoen !== 3 || s.bevolking.totaal <= 0) {
      s.koud = false;
      s.koudeTimer = Math.max(0, (s.koudeTimer || 0) - dt * 2);
      return;
    }

    var nodig = s.bevolking.totaal * w.houtPerInwoner * dt * (s.bonus.winter === undefined ? 1 : s.bonus.winter);
    var gestookt = Math.min(s.res.hout, nodig);
    s.res.hout -= gestookt;

    if (gestookt >= nodig - 1e-9) {
      s.koud = false;
      s.koudeTimer = Math.max(0, (s.koudeTimer || 0) - dt);
      return;
    }

    s.koud = true;
    s.koudeTimer = (s.koudeTimer || 0) + dt;
    if (s.koudeTimer > w.koudeZiekteNa) {
      s.koudeTimer = 0;
      if (s.bevolking.totaal > 1) {
        Game.core.population.verwijderDorpeling(s);
        Game.ui.log.schrijf(s, '🥶 Iemand is bezweken aan de kou. Je hebt hout nodig om te stoken!', 'slecht');
      }
    } else if (!s.koudeGemeld || s.tijd - s.koudeGemeld > 60) {
      s.koudeGemeld = s.tijd;
      Game.ui.log.schrijf(s, '🥶 Er is geen hout meer om te stoken. Je dorpelingen zitten in de kou.', 'slecht');
    }
  }

  /* Food does not keep. A granary stops most of it; without one a big autumn
     harvest quietly bleeds away before the winter it was meant for. */
  function bederf(s, dt) {
    var w = Game.config.winter;
    var tempo = w.bederfPerSec * (1 - (s.bederfRem || 0));
    if (tempo <= 0) return;
    if (s.seizoen === 1) tempo *= w.bederfZomer;   /* summer heat */
    if (s.seizoen === 3) tempo *= 0.4;             /* the cold preserves */

    var totaal = 0;
    Game.config.voedselSoorten.forEach(function (r) {
      var weg = s.res[r] * tempo * dt;
      if (weg <= 0) return;
      s.res[r] -= weg;
      totaal += weg;
    });

    s.bedorven = (s.bedorven || 0) * 0.995 + totaal;
    if (totaal > 0 && !s.bederfGemeld && s.bedorven > 40) {
      s.bederfGemeld = true;
      Game.ui.log.schrijf(s, '🪰 Er bederft voedsel in je voorraad. Bouw een graanschuur.', 'slecht');
    }
  }

  /* Practice. A workplace that keeps the same crew on the same job gets
     steadily better at it, up to ERVARING_BONUS. Pulling people off knocks it
     back (see population.zetWerkers), which is the point: constantly
     reshuffling your villagers should cost you something.
     One number per building, so the save stays plain. */
  E.ERVARING_TIJD = 320;     /* seconds of full staffing to become expert */
  E.ERVARING_BONUS = 0.15;

  function ervaringGroeit(s, dt) {
    for (var i = 0; i < s.gebouwen.length; i++) {
      var g = s.gebouwen[i];
      if (!g.gebouwd) continue;
      var d = Game.core.state.def(g);
      if (!d.banen) continue;
      if (typeof g.ervaring !== 'number') g.ervaring = 0;

      if (g.werkers > 0 && !g.uit) {
        var bezetting = g.werkers / d.banen.aantal;
        g.ervaring = Math.min(1, g.ervaring + (dt / E.ERVARING_TIJD) * bezetting);
      } else {
        /* Skills fade in an idle workshop, but slowly. */
        g.ervaring = Math.max(0, g.ervaring - dt / (E.ERVARING_TIJD * 4));
      }
    }
  }

  /* Production silently vanishing into a full warehouse is confusing, so say
     it out loud — but at most once a minute. */
  function meldVolleOpslag(s, dt) {
    s.volTimer = (s.volTimer || 0) - dt;
    if (!s.opslagVol) return;
    var res = s.opslagVol;
    s.opslagVol = null;
    if (s.volTimer > 0) return;
    s.volTimer = 60;
    Game.ui.log.schrijf(s, '📦 Je opslag voor ' + Game.config.resources[res].naam.toLowerCase() +
      ' zit vol (' + Math.round(s.capaciteit) + '). Bouw een voorraadschuur of pakhuis.');
  }

  /* Does this building grow grain in the open field? Both the farm and the
     hall it upgrades into do, and both care about the lie of the land. */
  function isAkker(d) {
    return !!(d.seizoensgevoelig && d.maakt && d.maakt.uit && d.maakt.uit.graan);
  }

  /* A windmill within range makes nearby farms noticeably more productive —
     and a mill on a rise catches far more wind than one in a hollow. */
  function molenBonus(s, boerderij) {
    var bonus = 1;
    for (var i = 0; i < s.gebouwen.length; i++) {
      var g = s.gebouwen[i];
      if (g.type !== 'molen' || !g.gebouwd || g.uit) continue;
      var d = Game.core.state.def(g);
      var dx = g.x - boerderij.x, dy = g.y - boerderij.y;
      if (dx * dx + dy * dy > d.boerderijStraal * d.boerderijStraal) continue;
      var wind = 1 + 0.5 * Game.core.buurt.relief(s, g.x, g.y);
      bonus = Math.max(bonus, 1 + d.boerderijBonus * wind);
    }
    return bonus;
  }

  /* The lie of the land under a field. Low, well-watered ground irrigates
     itself; a field carved into a hillside is thin and dries out. The floor
     keeps a badly placed farm workable — never worthless. */
  E.AKKER_WATER = 0.15;
  E.AKKER_HELLING = 0.18;
  function akkerBonus(s, g, d) {
    var mid = (d.grootte - 1) / 2;
    var f = 1;
    if (Game.core.buurt.bijWater(s, g.x + mid, g.y + mid, 5)) f += E.AKKER_WATER;
    f -= E.AKKER_HELLING * Game.core.buurt.relief(s, g.x + mid, g.y + mid);
    return Math.max(0.7, f);
  }
  E.akkerBonus = akkerBonus;
  E.isAkker = isAkker;

  /* In winter the shallows freeze and the catch collapses — unless a harbour
     nearby keeps a channel open. That is what turns the harbour from a nice
     extra into the thing that carries your town through the cold. */
  function vorstBonus(s, vissershut) {
    if (s.seizoen !== 3) return 1;
    var w = Game.config.winter;
    for (var i = 0; i < s.gebouwen.length; i++) {
      var g = s.gebouwen[i];
      if (g.type !== 'haven' || !g.gebouwd || g.uit) continue;
      var dx = g.x - vissershut.x, dy = g.y - vissershut.y;
      if (dx * dx + dy * dy <= w.havenStraal * w.havenStraal) return 1;
    }
    return w.visVorst;
  }
  E.vorstBonus = vorstBonus;

  /* A harbour within range makes nearby fishing huts land a bigger catch. */
  function havenBonus(s, vissershut) {
    var bonus = 1;
    for (var i = 0; i < s.gebouwen.length; i++) {
      var g = s.gebouwen[i];
      if (g.type !== 'haven' || !g.gebouwd || g.uit) continue;
      var d = Game.core.state.def(g);
      var dx = g.x - vissershut.x, dy = g.y - vissershut.y;
      if (dx * dx + dy * dy <= d.visserijStraal * d.visserijStraal) {
        bonus = Math.max(bonus, 1 + d.visserijBonus);
      }
    }
    return bonus;
  }

  /* Woodland and game slowly recover, but not in winter. */
  E.natuurGroeit = function (s, dt) {
    if (s.seizoen === 3) return;
    s.bosTimer = (s.bosTimer || 0) + dt;
    if (s.bosTimer < 1) return;
    var stap = s.bosTimer;
    s.bosTimer = 0;

    var kaart = s.kaart;
    /* Only walk a slice of the map per second — cheap and unnoticeable. */
    var start = (s.bosCursor || 0);
    var eind = Math.min(kaart.tegels.length, start + 900);
    for (var i = start; i < eind; i++) {
      var t = kaart.tegels[i];
      if (t.amt >= t.max) continue;
      var tempo = t.n === 'hout' ? BOSGROEI : (t.n === 'wild' ? WILDGROEI : 0);
      if (tempo === 0) continue;
      t.amt = Math.min(t.max, t.amt + tempo * stap * (kaart.tegels.length / 900));
    }
    s.bosCursor = eind >= kaart.tegels.length ? 0 : eind;
  };

  Game.core.economy = E;

})(window.Game);
