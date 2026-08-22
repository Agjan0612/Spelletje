/* Bandit raids.
 *
 * Deliberately abstract: there are no units to micromanage. Your defence
 * total is weighed against the raiders' strength, and the outcome is
 * resources lost, buildings damaged or a proud victory. A raid is always
 * announced with a countdown so it never feels unfair.
 */
(function (Game) {

  var R = {};

  R.WAARSCHUWING = 45;   /* seconds of warning before they arrive */

  /* Make sure the army bookkeeping exists, also for saves from before it. */
  R.zorgLeger = function (s) {
    if (!s.leger) s.leger = { overwinningen: 0, uitval: false };
    if (typeof s.leger.overwinningen !== 'number') s.leger.overwinningen = 0;
    if (typeof s.leger.uitval !== 'boolean') s.leger.uitval = false;
  };

  R.tick = function (s, dt) {
    if (s.tijdperk < 2) return;          /* bandits ignore a hamlet */
    R.zorgLeger(s);
    var r = s.raid;

    if (r.fase === 'rust') {
      r.timer -= dt;
      if (r.timer <= 0) {
        r.nummer++;
        r.fase = 'waarschuwing';
        r.timer = R.WAARSCHUWING;
        r.kracht = berekenKracht(s);
        r.vanaf = kiesInval(s);   /* flat approach point — used by the raid
                                     visuals (fase 3) and positional defence (fase 4) */
        r.uitslag = null;
        r.routBonus = 0;
        s.leger.uitval = false;   /* the player orders a new sortie each raid */
        Game.ui.log.schrijf(s, '⚔️ Rovers gesignaleerd! Ze vallen over ' + R.WAARSCHUWING + ' seconden aan.', 'slecht');
        Game.ui.toast('⚔️ Rovers op komst!');
        if (Game.ui.audio) Game.ui.audio.hoorn();
      }
      return;
    }

    if (r.fase === 'waarschuwing') {
      r.timer -= dt;
      if (r.timer <= 0) {
        beslecht(s);
        r.fase = 'rust';
        /* A rout buys extra peace: the survivors have to find new men. */
        r.timer = volgendeRust(s) + (r.routBonus || 0);
        s.leger.uitval = false;
      }
    }
  };

  /* ------------------------------------------------------------- het leger

     Soldiers and keeps form a field army. It always defends, but you can also
     order it *out* while the raiders are on their way: win in the open field
     and the band is destroyed instead of merely turned away — lose and you
     have thrown away men you badly needed on the walls. */
  R.zetUitval = function (s, aan) {
    R.zorgLeger(s);
    if (s.raid.fase !== 'waarschuwing') return false;
    if (R.legerKracht(s) <= 0) return false;
    s.leger.uitval = aan == null ? !s.leger.uitval : !!aan;
    return true;
  };

  R.uitvalMogelijk = function (s) {
    return s.tijdperk >= 2 && s.raid.fase === 'waarschuwing' && R.legerKracht(s) > 0;
  };

  /* Everything that can march: the garrison half of the defence total. */
  R.legerKracht = function (s) {
    return Math.round(R.verdedigingSplit(s).garnizoen);
  };

  R.legerStatus = function (s) {
    R.zorgLeger(s);
    return {
      kracht: R.legerKracht(s),
      soldaten: s.bevolking.soldaten || 0,
      uitval: s.leger.uitval,
      overwinningen: s.leger.overwinningen
    };
  };

  /* How rough this town has it, from the difficulty chosen at the start. */
  function zwaarte(s) { return Game.config.moeilijkheid(s.moeilijkheid); }

  function volgendeRust(s) {
    var basis = 340 - s.tijdperk * 30;
    /* Every decisive victory makes the bandits think twice: they regroup for
       longer. Capped so raids never fizzle out entirely. */
    basis += Math.min(140, (s.leger ? s.leger.overwinningen : 0) * 12);
    return (basis + Math.random() * 90) * zwaarte(s).raidRust;
  }
  R.volgendeRust = volgendeRust;

  /* Centre tile of the town square (the raiders' goal). */
  function pleinPositie(s) {
    var plein = s.gebouwen.filter(function (g) { return g.type === 'dorpsplein'; })[0];
    return {
      x: plein ? plein.x + 1 : Math.floor(s.kaart.b / 2),
      y: plein ? plein.y + 1 : Math.floor(s.kaart.h / 2)
    };
  }
  R.pleinPositie = pleinPositie;

  /* Picks the map-edge tile the raiders approach from, roughly aligned with
     the town so they march across the map toward it. Plain JSON. */
  function kiesInval(s) {
    var pl = pleinPositie(s);
    var b = s.kaart.b, h = s.kaart.h;
    var jit = Math.floor((Math.random() - 0.5) * 14);
    var zijden = ['noord', 'oost', 'zuid', 'west'];
    var z = zijden[Math.floor(Math.random() * 4)];
    var x, y;
    if (z === 'noord') { y = 0; x = Game.util.clamp(pl.x + jit, 1, b - 2); }
    else if (z === 'zuid') { y = h - 1; x = Game.util.clamp(pl.x + jit, 1, b - 2); }
    else if (z === 'west') { x = 0; y = Game.util.clamp(pl.y + jit, 1, h - 2); }
    else { x = b - 1; y = Game.util.clamp(pl.y + jit, 1, h - 2); }
    return { x: x, y: y, zijde: z };
  }

  /* The invasion corridor: a band from the approach edge to the town square.
     Positional defence (fase 4) counts only the cover that touches it. */
  R.corridor = function (s) {
    if (!s.raid || !s.raid.vanaf) return null;
    var pl = pleinPositie(s);
    return { ax: s.raid.vanaf.x, ay: s.raid.vanaf.y, bx: pl.x, by: pl.y, breedte: 6 };
  };

  /* Shortest distance from tile (px,py) to the corridor's centre line. */
  R.afstandTotCorridor = function (cor, px, py) {
    var vx = cor.bx - cor.ax, vy = cor.by - cor.ay;
    var len2 = vx * vx + vy * vy || 1e-6;
    var t = Game.util.clamp(((px - cor.ax) * vx + (py - cor.ay) * vy) / len2, 0, 1);
    var cx = cor.ax + vx * t, cy = cor.ay + vy * t;
    var dx = px - cx, dy = py - cy;
    return Math.sqrt(dx * dx + dy * dy);
  };

  /* Positional defence: a garrison (soldiers, a keep) always counts, but a
     watchtower or wall only pulls its weight if its coverage reaches the
     corridor the raiders take. Deliberately generous — the corridor is wide
     and coverage counts within radius + half the corridor width — so a
     sensibly walled town is barely affected while a lopsided one is.
     Without a known approach it falls back to the plain total. */
  R.verdedigingSplit = function (s) {
    var cor = (s.tijdperk >= 2 && s.raid && s.raid.vanaf) ? R.corridor(s) : null;
    var garnizoen = 0, positioneel = 0;

    for (var i = 0; i < s.gebouwen.length; i++) {
      var g = s.gebouwen[i];
      if (!g.gebouwd) continue;
      var d = Game.core.state.def(g);

      if (d.verdPerWerker && !g.uit) garnizoen += d.verdPerWerker * g.werkers;

      if (d.verdediging) {
        if (d.dekking && d.dekking.straal) {
          if (!cor) { positioneel += d.verdediging; continue; }
          var bx = g.x + d.grootte / 2, by = g.y + d.grootte / 2;
          if (R.afstandTotCorridor(cor, bx, by) <= R.dekkingStraal(s, g, d) + cor.breedte * 0.5) {
            positioneel += d.verdediging;
          }
        } else {
          garnizoen += d.verdediging;   /* keep / stronghold: always counts */
        }
      }
    }
    var o = Game.core.onderzoek ? Game.core.onderzoek.bonus(s).verdediging : 1;
    return { garnizoen: garnizoen * o, positioneel: positioneel * o };
  };

  /* How far a tower or wall segment actually watches. A watchtower on high
     ground sees half again as far as one down in the valley — the height map
     was already there for the hillshade, this makes it matter. */
  R.dekkingStraal = function (s, g, d) {
    d = d || Game.core.state.def(g);
    if (!d.dekking || !d.dekking.straal) return 0;
    var mid = (d.grootte - 1) / 2;
    return d.dekking.straal * (1 + 0.5 * Game.core.buurt.relief(s, g.x + mid, g.y + mid));
  };

  R.effectieveVerdediging = function (s) {
    var sp = R.verdedigingSplit(s);
    return Math.round(sp.garnizoen + sp.positioneel);
  };

  /* Scales with how much there is to plunder right now — the size of your
     town — instead of with everything you ever gathered. That keeps late
     raids challenging without ever becoming hopeless. */
  function berekenKracht(s) {
    var gebouwd = 0;
    for (var i = 0; i < s.gebouwen.length; i++) if (s.gebouwen[i].gebouwd) gebouwd++;

    var kracht = 20
      + s.bevolking.totaal * 1.8
      + gebouwd * 1.2
      + (s.tijdperk - 1) * 35
      + s.raid.nummer * 8;
    kracht -= Math.min(35, (s.leger ? s.leger.overwinningen : 0) * 6);
    return Math.round(kracht * (0.85 + Math.random() * 0.3) * zwaarte(s).raid);
  }

  /* The band is destroyed rather than chased off: the best possible outcome. */
  function rout(s, kracht, viaUitval) {
    s.raid.uitslag = 'vernietigd';
    s.leger.overwinningen++;
    s.moreel = Math.min(Game.core.feesten.MOREEL_MAX, (s.moreel || 0) + 12);
    s.raid.routBonus = viaUitval ? 150 : 90;
    Game.ui.log.schrijf(s, (viaUitval
      ? '🏆 Je leger trok uit en heeft de roversbende vernietigd! ('
      : '🏆 Je garnizoen heeft de roversbende volledig gebroken! (') +
      R.legerKracht(s) + ' tegen ' + kracht + ')', 'goed');
    Game.ui.toast('🏆 Roversbende vernietigd!');
    if (Game.ui.audio && Game.ui.audio.zege) Game.ui.audio.zege();
    if (viaUitval && Math.random() < 0.35) verliesSoldaat(s);
  }

  function beslecht(s) {
    R.zorgLeger(s);
    var split = R.verdedigingSplit(s);
    var leger = Math.round(split.garnizoen);
    var verdediging = Math.round(split.garnizoen + split.positioneel);
    var kracht = s.raid.kracht;
    var verhouding = verdediging / Math.max(1, kracht);

    /* Sortie: the player sent the army out to meet them in the field. */
    if (s.leger.uitval && leger > 0) {
      if (leger >= kracht * 0.85) { rout(s, kracht, true); return; }
      /* Too weak for the open field: the sortie is mauled and falls back. */
      Game.ui.log.schrijf(s, '⚔️ De uitval was te gewaagd — je leger werd teruggedreven en verloor mannen.', 'slecht');
      verliesSoldaat(s);
      if (Math.random() < 0.5) verliesSoldaat(s);
      verdediging = R.effectieveVerdediging(s);
      leger = R.legerKracht(s);
      verhouding = verdediging / Math.max(1, kracht);
    }

    /* A commanding garrison breaks the band outright, even on the defensive. */
    if (leger > 0 && verdediging >= kracht * 1.5) { rout(s, kracht, false); return; }

    if (verhouding >= 1) {
      s.raid.uitslag = 'verjaagd';
      Game.ui.log.schrijf(s, '🛡️ Je wacht heeft de rovers verjaagd! (' + verdediging + ' tegen ' + kracht + ')', 'goed');
      Game.ui.toast('🛡️ De rovers zijn verjaagd!');
      s.moreel = (s.moreel || 0) + 7;
      if (Math.random() < 0.3) verliesSoldaat(s);
      return;
    }

    if (verhouding >= 0.6) {
      s.raid.uitslag = 'ternauwernood';
      var buit = steel(s, 0.10);
      Game.ui.log.schrijf(s, '⚔️ Zware strijd! De rovers zijn teruggeslagen, maar namen ' + buit + ' mee.', 'slecht');
      Game.ui.toast('⚔️ Ternauwernood standgehouden');
      s.moreel = (s.moreel || 0) - 4;
      verliesSoldaat(s);
      return;
    }

    s.raid.uitslag = 'doorgebroken';
    var buit2 = steel(s, 0.28);
    var schade = beschadigGebouw(s);
    var tekst = '🔥 De rovers braken door je verdediging (' + verdediging + ' tegen ' + kracht + ') en roofden ' + buit2 + '.';
    if (schade) tekst += ' ' + schade + ' is zwaar beschadigd.';
    Game.ui.log.schrijf(s, tekst, 'slecht');
    Game.ui.toast('🔥 De rovers hebben toegeslagen!');
    s.moreel = (s.moreel || 0) - 12;
    if (s.bevolking.totaal > 4 && Math.random() < 0.5) {
      Game.core.population.verwijderDorpeling(s);
      Game.ui.log.schrijf(s, '💀 Een dorpeling kwam om bij de overval.', 'slecht');
    }
  }

  function steel(s, deel) {
    var buit = [];
    Game.config.resourceOrder.forEach(function (r) {
      var weg = s.res[r] * deel;
      if (weg < 1) return;
      s.res[r] -= weg;
      buit.push(Math.round(weg) + ' ' + Game.config.resources[r].naam.toLowerCase());
    });
    if (!buit.length) return 'nauwelijks iets';
    if (buit.length > 3) buit = buit.slice(0, 3).concat(['en meer']);
    return buit.join(', ');
  }

  function verliesSoldaat(s) {
    var kazernes = s.gebouwen.filter(function (g) {
      var d = Game.core.state.def(g);
      return g.gebouwd && d.banen && d.banen.baan === 'soldaat' && g.werkers > 0;
    });
    if (!kazernes.length) return;
    kazernes[0].werkers--;
    s.bevolking.totaal = Math.max(0, s.bevolking.totaal - 1);
    Game.core.state.herbereken(s);
    Game.ui.log.schrijf(s, '🪦 Een soldaat sneuvelde in het gevecht.', 'slecht');
  }

  /* Knocks a random building back to a construction site instead of deleting
     it — losing progress stings, losing your quarry outright would sour the
     whole game. */
  function beschadigGebouw(s) {
    var kandidaten = s.gebouwen.filter(function (g) {
      return g.gebouwd && g.type !== 'dorpsplein';
    });
    if (!kandidaten.length) return null;
    var g = kandidaten[Math.floor(Math.random() * kandidaten.length)];
    var d = Game.core.state.def(g);
    g.gebouwd = false;
    g.voortgang = d.bouwtijd * 0.45;
    g.werkers = 0;
    g.geschroeid = 26;        /* scorch decal timer (fase 6), plain number */
    /* Remember where it happened so the raid visuals can burn it (fase 3). */
    s.raid.doel = { x: g.x + d.grootte / 2, y: g.y + d.grootte / 2 };
    Game.core.state.herbereken(s);
    return d.naam;
  }

  R.statusTekst = function (s) {
    if (s.tijdperk < 2 || s.raid.fase !== 'waarschuwing') return null;
    R.zorgLeger(s);
    return {
      seconden: Math.ceil(s.raid.timer),
      kracht: s.raid.kracht,
      verdediging: R.effectieveVerdediging(s),
      totaal: s.verdediging,
      leger: R.legerKracht(s),
      uitval: s.leger.uitval,
      kanUitval: R.legerKracht(s) > 0
    };
  };

  Game.core.raids = R;

})(window.Game);
