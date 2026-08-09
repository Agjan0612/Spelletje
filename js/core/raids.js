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

  R.tick = function (s, dt) {
    if (s.tijdperk < 2) return;          /* bandits ignore a hamlet */
    var r = s.raid;

    if (r.fase === 'rust') {
      r.timer -= dt;
      if (r.timer <= 0) {
        r.nummer++;
        r.fase = 'waarschuwing';
        r.timer = R.WAARSCHUWING;
        r.kracht = berekenKracht(s);
        Game.ui.log.schrijf(s, '⚔️ Rovers gesignaleerd! Ze vallen over ' + R.WAARSCHUWING + ' seconden aan.', 'slecht');
        Game.ui.toast('⚔️ Rovers op komst!');
      }
      return;
    }

    if (r.fase === 'waarschuwing') {
      r.timer -= dt;
      if (r.timer <= 0) {
        beslecht(s);
        r.fase = 'rust';
        r.timer = volgendeRust(s);
      }
    }
  };

  function volgendeRust(s) {
    var basis = 340 - s.tijdperk * 30;
    return basis + Math.random() * 90;
  }
  R.volgendeRust = volgendeRust;

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
    return Math.round(kracht * (0.85 + Math.random() * 0.3));
  }

  function beslecht(s) {
    var verdediging = s.verdediging;
    var kracht = s.raid.kracht;
    var verhouding = verdediging / Math.max(1, kracht);

    if (verhouding >= 1) {
      Game.ui.log.schrijf(s, '🛡️ Je wacht heeft de rovers verjaagd! (' + verdediging + ' tegen ' + kracht + ')', 'goed');
      Game.ui.toast('🛡️ De rovers zijn verjaagd!');
      s.moreel = (s.moreel || 0) + 7;
      if (Math.random() < 0.3) verliesSoldaat(s);
      return;
    }

    if (verhouding >= 0.6) {
      var buit = steel(s, 0.10);
      Game.ui.log.schrijf(s, '⚔️ Zware strijd! De rovers zijn teruggeslagen, maar namen ' + buit + ' mee.', 'slecht');
      Game.ui.toast('⚔️ Ternauwernood standgehouden');
      s.moreel = (s.moreel || 0) - 4;
      verliesSoldaat(s);
      return;
    }

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
    Game.core.state.herbereken(s);
    return d.naam;
  }

  R.statusTekst = function (s) {
    if (s.tijdperk < 2 || s.raid.fase !== 'waarschuwing') return null;
    return {
      seconden: Math.ceil(s.raid.timer),
      kracht: s.raid.kracht,
      verdediging: s.verdediging
    };
  };

  Game.core.raids = R;

})(window.Game);
