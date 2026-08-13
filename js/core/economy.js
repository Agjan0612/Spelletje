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
      if (!d.banen || g.werkers === 0) {
        if (d.banen) g.waarschuwing = 'Geen werkers toegewezen';
        continue;
      }

      /* Happiness matters, but never enough to be self-reinforcing: a hungry
         village would otherwise produce less food, go hungrier still, and
         spiral into nothing. The floor of 0.75 keeps a bad patch recoverable. */
      var mult = s.bonus.productie * (0.75 + 0.25 * (s.tevredenheid / 100));

      /* --- extraction --------------------------------------------------- */
      if (d.wint) {
        var w = d.wint;
        var tempo = w.tempo * g.werkers * mult * s.bonus.mijnbouw;
        if (d.seizoensgevoelig) tempo *= seizoen.factor(s, 'jacht');
        if (g.type === 'vissershut') tempo *= havenBonus(s, g);

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
        if (g.type === 'boerderij') factor *= molenBonus(s, g);

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
              var maak = d.maakt.uit[uitRes] * factor * deel * dt;
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

    E.natuurGroeit(s, dt);
    meldVolleOpslag(s, dt);

    /* Smooth the flow numbers a little so the HUD does not flicker. */
    Game.config.resourceOrder.forEach(function (r) {
      s.stroom[r] = s.stroom[r] * 0.8 + flux[r] * 0.2;
    });
  };

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

  /* A windmill within range makes nearby farms noticeably more productive. */
  function molenBonus(s, boerderij) {
    var bonus = 1;
    for (var i = 0; i < s.gebouwen.length; i++) {
      var g = s.gebouwen[i];
      if (g.type !== 'molen' || !g.gebouwd || g.uit) continue;
      var d = Game.core.state.def(g);
      var dx = g.x - boerderij.x, dy = g.y - boerderij.y;
      if (dx * dx + dy * dy <= d.boerderijStraal * d.boerderijStraal) {
        bonus = Math.max(bonus, 1 + d.boerderijBonus);
      }
    }
    return bonus;
  }

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
