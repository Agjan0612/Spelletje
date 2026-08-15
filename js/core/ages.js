/* Age progression: what is still missing, and the step to the next age. */
(function (Game) {

  var A = {};

  /* Builds a checklist for the next age. Each entry is
     { tekst, klaar, nu, doel }. Returns null once you are in the last age. */
  A.eisen = function (s) {
    var volgende = Game.config.ages[s.tijdperk];   /* ages[] is 0-based */
    if (!volgende || !volgende.eisen) return null;

    var e = volgende.eisen;
    var lijst = [];

    if (e.bevolking) {
      lijst.push({
        tekst: 'Inwoners',
        nu: s.bevolking.totaal, doel: e.bevolking,
        klaar: s.bevolking.totaal >= e.bevolking
      });
    }
    if (e.tevredenheid) {
      lijst.push({
        tekst: 'Tevredenheid',
        nu: Math.round(s.tevredenheid), doel: e.tevredenheid, procent: true,
        klaar: s.tevredenheid >= e.tevredenheid
      });
    }
    for (var r in e.verzameld) {
      lijst.push({
        tekst: Game.config.resources[r].emoji + ' ' + Game.config.resources[r].naam + ' verzameld',
        nu: Math.floor(s.verzameld[r]), doel: e.verzameld[r],
        klaar: s.verzameld[r] >= e.verzameld[r]
      });
    }
    for (var b in e.gebouwen) {
      var def = Game.config.gebouw(b);
      var aantal = Game.core.state.telType(s, b);
      lijst.push({
        tekst: def.emoji + ' ' + def.naam,
        nu: aantal, doel: e.gebouwen[b],
        klaar: aantal >= e.gebouwen[b]
      });
    }
    return { tijdperk: volgende, lijst: lijst };
  };

  A.kanBevorderen = function (s) {
    var eisen = A.eisen(s);
    if (!eisen) return false;
    for (var i = 0; i < eisen.lijst.length; i++) if (!eisen.lijst[i].klaar) return false;
    return Game.core.state.kanBetalen(s, eisen.tijdperk.kosten || {});
  };

  A.bevorder = function (s) {
    if (!A.kanBevorderen(s)) return false;
    var volgende = Game.config.ages[s.tijdperk];
    Game.core.state.betaal(s, volgende.kosten || {});
    s.tijdperk++;

    Game.ui.log.schrijf(s, volgende.emoji + ' Je nederzetting is nu een ' + volgende.naam + '!', 'goed');
    /* Show the newly unlocked buildings straight away. */
    Game.ui.buildmenu.toon(s.tijdperk);
    Game.ui.overlay.tijdperk(volgende);

    /* The whole city visibly matures: a construction sweep, then the new tier
       look (cosmetic — the mechanical weight is in the new buildings). */
    if (Game.render.renderer.tijdperkSweep) Game.render.renderer.tijdperkSweep(s);
    if (Game.render.renderer.flits) Game.render.renderer.flits('255,240,200');
    if (Game.ui.audio) { Game.ui.audio.klok(); Game.ui.audio.fanfare(); }

    /* The bandits start paying attention from age 2 on. */
    if (s.tijdperk === 2 && s.raid.fase === 'rust') {
      s.raid.timer = Math.max(s.raid.timer, 150);
    }
    return true;
  };

  /* The victory check for the finished city. */
  A.eindDoelLijst = function (s) {
    var d = Game.config.eindDoel;
    var lijst = [{
      tekst: 'Inwoners', nu: s.bevolking.totaal, doel: d.bevolking,
      klaar: s.bevolking.totaal >= d.bevolking
    }, {
      tekst: 'Tevredenheid', nu: Math.round(s.tevredenheid), doel: d.tevredenheid, procent: true,
      klaar: s.tevredenheid >= d.tevredenheid
    }];
    for (var b in d.gebouwen) {
      var def = Game.config.gebouw(b);
      var aantal = Game.core.state.telType(s, b);
      lijst.push({
        tekst: def.emoji + ' ' + def.naam, nu: aantal, doel: d.gebouwen[b],
        klaar: aantal >= d.gebouwen[b]
      });
    }
    return lijst;
  };

  A.controleerOverwinning = function (s) {
    if (s.gewonnen || s.tijdperk < 4) return;
    var lijst = A.eindDoelLijst(s);
    for (var i = 0; i < lijst.length; i++) if (!lijst[i].klaar) return;
    s.gewonnen = true;
    Game.ui.overlay.overwinning(s);
    Game.ui.log.schrijf(s, '👑 Je stad is voltooid! ' + s.dorpsnaam + ' is een echte middeleeuwse stad.', 'goed');
    if (Game.ui.audio) Game.ui.audio.zege();
  };

  Game.core.ages = A;

})(window.Game);
