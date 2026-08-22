/* Bandit raids.
 *
 * Still deliberately abstract — there are no units to micromanage — but no
 * longer a single dice roll. The 45 seconds of warning are now the most
 * interesting seconds in the game:
 *
 *   1. The band marches along a corridor from the map edge to your square.
 *      Every tower, wall and gate whose coverage it passes thins it out, once.
 *      That is what makes *where* you put a watchtower tactical rather than
 *      arithmetical: cover that is not on their route never fires.
 *   2. Meanwhile you pick from four verbs — sortie, evacuate, call the
 *      militia, or pay them off — each with a real price.
 *   3. What is left of the band meets what is left of your garrison.
 *
 * The attrition constant is 1.0 on purpose: the arithmetic of "does my
 * defence beat their strength" is identical to the old flat comparison, so
 * the balance carries over untouched. Everything new is in the telling and
 * in the choices, not in the odds.
 *
 * From age 4 a band may settle in for a siege instead of charging.
 */
(function (Game) {

  var R = {};

  R.WAARSCHUWING = 45;   /* seconds of warning before they arrive */

  function cfg() { return Game.config.rovers; }

  /* Make sure the army bookkeeping exists, also for saves from before it. */
  R.zorgLeger = function (s) {
    if (!s.leger) s.leger = { overwinningen: 0, uitval: false };
    if (typeof s.leger.overwinningen !== 'number') s.leger.overwinningen = 0;
    if (typeof s.leger.uitval !== 'boolean') s.leger.uitval = false;
  };

  /* The captain on the other side, and what he remembers about you. */
  R.zorgRovers = function (s) {
    if (!s.rovers) s.rovers = {};
    var r = s.rovers;
    if (!r.naam) r.naam = R.nieuweNaam(s);
    if (typeof r.wrok !== 'number') r.wrok = 0;
    if (typeof r.ontmoetingen !== 'number') r.ontmoetingen = 0;
    if (typeof r.schattingen !== 'number') r.schattingen = 0;
    if (typeof r.verslagen !== 'number') r.verslagen = 0;
  };

  R.nieuweNaam = function (s) {
    var lijst = Game.config.roverNamen;
    var vorige = s.rovers && s.rovers.naam;
    for (var poging = 0; poging < 8; poging++) {
      var naam = lijst[Math.floor(Math.random() * lijst.length)];
      if (naam !== vorige) return naam;
    }
    return lijst[0];
  };

  /* The choices the player may make while they are on their way. */
  function zorgKeuze(s) {
    if (!s.raid.keuze) s.raid.keuze = { evacuatie: false, burgerwacht: false };
    if (typeof s.raid.keuze.evacuatie !== 'boolean') s.raid.keuze.evacuatie = false;
    if (typeof s.raid.keuze.burgerwacht !== 'boolean') s.raid.keuze.burgerwacht = false;
  }
  R.zorgKeuze = zorgKeuze;

  R.tick = function (s, dt) {
    if (s.tijdperk < 2) return;          /* bandits ignore a hamlet */
    R.zorgLeger(s);
    R.zorgRovers(s);
    zorgKeuze(s);
    var r = s.raid;

    if (r.fase === 'rust') {
      r.timer -= dt;
      if (r.timer <= 0) begin(s);
      return;
    }

    if (r.fase === 'waarschuwing') {
      r.timer -= dt;
      marcheer(s, dt);
      if (r.timer <= 0) {
        beslecht(s);
        if (s.raid.fase === 'waarschuwing') eindig(s);
      }
      return;
    }

    if (r.fase === 'beleg') belegTick(s, dt);
  };

  /* ------------------------------------------------------------- opkomst -- */

  function begin(s) {
    var r = s.raid;
    r.nummer++;
    s.rovers.ontmoetingen++;
    r.fase = 'waarschuwing';
    r.timer = R.WAARSCHUWING;
    r.kracht = berekenKracht(s);
    r.beginKracht = r.kracht;
    r.afgeslagen = 0;
    r.voortgang = 0;
    r.beschoten = {};
    r.vanaf = kiesInval(s);
    r.uitslag = null;
    r.routBonus = 0;
    s.leger.uitval = false;
    r.keuze = { evacuatie: false, burgerwacht: false };

    Game.ui.log.schrijf(s, '⚔️ ' + s.rovers.naam + ' is gesignaleerd met een bende van ~' +
      r.kracht + ' man. Ze vallen aan over ' + R.WAARSCHUWING + ' seconden.', 'slecht');
    Game.ui.toast('⚔️ ' + s.rovers.naam + ' komt eraan!');
    if (Game.ui.audio) Game.ui.audio.hoorn();
  }

  function eindig(s) {
    var r = s.raid;
    r.fase = 'rust';
    r.timer = volgendeRust(s) + (r.routBonus || 0);
    r.voortgang = 0;
    s.leger.uitval = false;
    r.keuze = { evacuatie: false, burgerwacht: false };
  }
  R.eindig = eindig;

  /* --------------------------------------------------------- de opmars ---- */

  /* Walks the band down the corridor and lets each piece of cover it passes
     fire once. Attrition is booked straight off their strength, so the
     countdown visibly wears them down. */
  function marcheer(s, dt) {
    var r = s.raid;
    r.voortgang = Game.util.clamp(1 - (r.timer / R.WAARSCHUWING), 0, 1);
    var cor = R.corridor(s);
    if (!cor) return;

    var px = cor.ax + (cor.bx - cor.ax) * r.voortgang;
    var py = cor.ay + (cor.by - cor.ay) * r.voortgang;
    var o = Game.core.onderzoek ? Game.core.onderzoek.bonus(s).verdediging : 1;

    for (var i = 0; i < s.gebouwen.length; i++) {
      var g = s.gebouwen[i];
      if (!g.gebouwd || g.uit) continue;
      if (r.beschoten[g.id]) continue;
      var d = Game.core.state.def(g);
      if (!d.verdediging || !d.dekking || !d.dekking.straal) continue;

      var mid = (d.grootte - 1) / 2;
      var gx = g.x + mid, gy = g.y + mid;
      var dx = gx - px, dy = gy - py;
      var straal = R.dekkingStraal(s, g, d);
      if (dx * dx + dy * dy > straal * straal) continue;

      r.beschoten[g.id] = 1;
      var schade = d.verdediging * o * cfg().attritie;
      r.kracht = Math.max(0, r.kracht - schade);
      r.afgeslagen = (r.afgeslagen || 0) + schade;

      Game.ui.log.schrijf(s, '🏹 ' + d.naam + ' opent het vuur — de bende verliest ' +
        Math.round(schade) + ' man (nog ~' + Math.round(r.kracht) + ').');
      if (Game.render.particles && Game.render.particles.stof) {
        Game.render.particles.stof(px * 40, py * 40, 3);
      }
    }
  }

  /* ------------------------------------------------------------- keuzes --- */

  R.zetUitval = function (s, aan) {
    R.zorgLeger(s);
    if (s.raid.fase !== 'waarschuwing' && s.raid.fase !== 'beleg') return false;
    if (R.legerKracht(s) <= 0) return false;
    s.leger.uitval = aan == null ? !s.leger.uitval : !!aan;
    return true;
  };

  R.uitvalMogelijk = function (s) {
    return s.tijdperk >= 2 &&
      (s.raid.fase === 'waarschuwing' || s.raid.fase === 'beleg') &&
      R.legerKracht(s) > 0;
  };

  /* Send everyone outside the centre indoors: work stops out there, but the
     raiders find far less worth carrying off — and nobody is caught in the open. */
  R.zetEvacuatie = function (s, aan) {
    if (s.raid.fase !== 'waarschuwing') return false;
    zorgKeuze(s);
    s.raid.keuze.evacuatie = aan == null ? !s.raid.keuze.evacuatie : !!aan;
    if (s.raid.keuze.evacuatie) {
      Game.ui.log.schrijf(s, '🏃 De buitenwijken worden ontruimd. Daar ligt het werk stil.');
    }
    return true;
  };

  /* Hand every idle villager a spear. They are worth something on the wall,
     but nothing gets built while they stand there. */
  R.zetBurgerwacht = function (s, aan) {
    if (s.raid.fase !== 'waarschuwing') return false;
    zorgKeuze(s);
    s.raid.keuze.burgerwacht = aan == null ? !s.raid.keuze.burgerwacht : !!aan;
    if (s.raid.keuze.burgerwacht) {
      Game.ui.log.schrijf(s, '🔱 De burgerwacht is opgeroepen. Er wordt niet gebouwd zolang ze op de muur staan.');
    }
    return true;
  };

  R.burgerwachtKracht = function (s) {
    zorgKeuze(s);
    if (!s.raid.keuze.burgerwacht) return 0;
    var c = cfg();
    return Math.min(c.burgerwachtMax, s.bevolking.werkloos || 0) * c.burgerwachtPerMan;
  };

  R.schattingPrijs = function (s) {
    return Math.max(20, Math.round(s.raid.kracht * cfg().schattingPerKracht));
  };

  /* Buy them off. It works — and it teaches them exactly where the easy
     money lives. */
  R.betaalSchatting = function (s) {
    if (s.raid.fase !== 'waarschuwing' && s.raid.fase !== 'beleg') return false;
    var prijs = R.schattingPrijs(s);
    if (s.res.munten < prijs) return false;

    s.res.munten -= prijs;
    s.rovers.schattingen++;
    s.rovers.wrok += cfg().schattingWrok;
    s.raid.uitslag = 'afgekocht';
    s.moreel = (s.moreel || 0) - 5;

    Game.ui.log.schrijf(s, '💰 Je betaalde ' + prijs + ' munten aan ' + s.rovers.naam +
      '. Hij trekt af — en weet nu waar het geld ligt.', 'slecht');
    Game.ui.toast('💰 Afgekocht voor ' + prijs + ' munten');

    /* They leave quickly, and they come back sooner. */
    eindig(s);
    s.raid.timer *= 0.55;
    return true;
  };

  /* ---------------------------------------------------------- werkonderbreking

     Buildings the raid has shut down: evacuated outskirts during the warning,
     and everything beyond the walls during a siege. economy.js asks this. */
  R.werkOnderbroken = function (s, g) {
    if (!s.raid) return null;
    var c = cfg();
    var plein = pleinPositie(s);
    var d = Game.core.state.def(g);
    var mid = (d.grootte - 1) / 2;
    var dx = (g.x + mid) - plein.x, dy = (g.y + mid) - plein.y;
    var afstand2 = dx * dx + dy * dy;

    if (s.raid.fase === 'waarschuwing' && s.raid.keuze && s.raid.keuze.evacuatie) {
      if (afstand2 > c.evacuatieStraal * c.evacuatieStraal) {
        return 'Ontruimd — hier wordt niet gewerkt zolang de rovers komen';
      }
    }
    if (s.raid.fase === 'beleg') {
      if (afstand2 > c.belegStraal * c.belegStraal) {
        return 'Belegerd — de rovers houden dit veld bezet';
      }
    }
    return null;
  };

  /* Nothing is raised while the militia stands on the wall. */
  R.bouwStilgelegd = function (s) {
    return !!(s.raid && s.raid.fase === 'waarschuwing' &&
      s.raid.keuze && s.raid.keuze.burgerwacht);
  };

  /* --------------------------------------------------------------- leger -- */

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

  function zwaarte(s) { return Game.config.moeilijkheid(s.moeilijkheid); }

  function volgendeRust(s) {
    var basis = 340 - s.tijdperk * 30;
    basis += Math.min(140, (s.leger ? s.leger.overwinningen : 0) * 12);
    return (basis + Math.random() * 90) * zwaarte(s).raidRust;
  }
  R.volgendeRust = volgendeRust;

  function pleinPositie(s) {
    var plein = s.gebouwen.filter(function (g) { return g.type === 'dorpsplein'; })[0];
    return {
      x: plein ? plein.x + 1 : Math.floor(s.kaart.b / 2),
      y: plein ? plein.y + 1 : Math.floor(s.kaart.h / 2)
    };
  }
  R.pleinPositie = pleinPositie;

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

  R.corridor = function (s) {
    if (!s.raid || !s.raid.vanaf) return null;
    var pl = pleinPositie(s);
    return { ax: s.raid.vanaf.x, ay: s.raid.vanaf.y, bx: pl.x, by: pl.y, breedte: 6 };
  };

  R.afstandTotCorridor = function (cor, px, py) {
    var vx = cor.bx - cor.ax, vy = cor.by - cor.ay;
    var len2 = vx * vx + vy * vy || 1e-6;
    var t = Game.util.clamp(((px - cor.ax) * vx + (py - cor.ay) * vy) / len2, 0, 1);
    var cx = cor.ax + vx * t, cy = cor.ay + vy * t;
    var dx = px - cx, dy = py - cy;
    return Math.sqrt(dx * dx + dy * dy);
  };

  /* How far a tower or wall segment actually watches. A watchtower on high
     ground sees half again as far as one down in the valley. */
  R.dekkingStraal = function (s, g, d) {
    d = d || Game.core.state.def(g);
    if (!d.dekking || !d.dekking.straal) return 0;
    var mid = (d.grootte - 1) / 2;
    return d.dekking.straal * (1 + 0.5 * Game.core.buurt.relief(s, g.x + mid, g.y + mid));
  };

  /* The garrison is what fights at the walls; positional cover no longer joins
     that sum, because it already did its work thinning them on the way in.
     `positioneel` is kept for the HUD, which shows what is still waiting to
     fire along their route. */
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
          if (s.raid && s.raid.beschoten && s.raid.beschoten[g.id]) continue;  /* already fired */
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

  R.effectieveVerdediging = function (s) {
    var sp = R.verdedigingSplit(s);
    return Math.round(sp.garnizoen + sp.positioneel + R.burgerwachtKracht(s));
  };

  function berekenKracht(s) {
    var gebouwd = 0;
    for (var i = 0; i < s.gebouwen.length; i++) if (s.gebouwen[i].gebouwd) gebouwd++;

    var kracht = 20
      + s.bevolking.totaal * 1.8
      + gebouwd * 1.2
      + (s.tijdperk - 1) * 35
      + s.raid.nummer * 8;
    kracht -= Math.min(35, (s.leger ? s.leger.overwinningen : 0) * 6);
    /* A captain you have paid off before comes back bolder every time. */
    kracht *= 1 + (s.rovers.schattingen || 0) * cfg().schattingOpslag;
    kracht *= 1 + (s.rovers.wrok || 0) * 0.02;
    return Math.max(10, Math.round(kracht * (0.85 + Math.random() * 0.3) * zwaarte(s).raid));
  }

  /* ------------------------------------------------------------ beslissen -- */

  function rout(s, kracht, viaUitval) {
    s.raid.uitslag = 'vernietigd';
    s.leger.overwinningen++;
    s.rovers.verslagen++;
    s.moreel = Math.min(Game.core.feesten.MOREEL_MAX, (s.moreel || 0) + 12);
    s.raid.routBonus = viaUitval ? 150 : 90;
    Game.ui.log.schrijf(s, (viaUitval
      ? '🏆 Je leger trok uit en vernietigde de bende van ' + s.rovers.naam + '! ('
      : '🏆 Je garnizoen brak de bende van ' + s.rovers.naam + ' volledig! (') +
      R.legerKracht(s) + ' tegen ' + Math.round(kracht) + ')', 'goed');
    Game.ui.toast('🏆 Roversbende vernietigd!');
    if (Game.ui.audio && Game.ui.audio.zege) Game.ui.audio.zege();
    if (viaUitval && Math.random() < 0.35) verliesSoldaat(s);
    vervangKapitein(s);
  }

  /* A captain does not survive his band being wiped out — however it happened.
     His successor arrives with a score to settle. */
  function vervangKapitein(s) {
    var gevallen = s.rovers.naam;
    s.rovers.naam = R.nieuweNaam(s);
    s.rovers.wrok = Math.min(10, (s.rovers.wrok || 0) + 1);
    Game.ui.log.schrijf(s, '🗡️ ' + gevallen + ' is gevallen. ' + s.rovers.naam +
      ' neemt de bende over en heeft iets recht te zetten.');
  }

  function beslecht(s) {
    R.zorgLeger(s);
    zorgKeuze(s);
    var c = cfg();
    var split = R.verdedigingSplit(s);
    var leger = Math.round(split.garnizoen + R.burgerwachtKracht(s));
    /* Cover that never got to fire still stands between them and the square. */
    var verdediging = Math.round(leger + split.positioneel);
    var kracht = s.raid.kracht;

    /* A band that was shot to pieces on the way in simply gives up. */
    if (kracht <= 1) {
      s.raid.uitslag = 'vernietigd';
      s.leger.overwinningen++;
      s.rovers.verslagen++;
      s.moreel = Math.min(Game.core.feesten.MOREEL_MAX, (s.moreel || 0) + 10);
      s.raid.routBonus = 90;
      Game.ui.log.schrijf(s, '🏆 De bende van ' + s.rovers.naam +
        ' werd al op de weg naar de stad uiteengeslagen door je torens.', 'goed');
      Game.ui.toast('🏆 Ze haalden je muren niet eens');
      vervangKapitein(s);
      return;
    }

    var verhouding = verdediging / Math.max(1, kracht);

    if (s.leger.uitval && leger > 0) {
      if (leger >= kracht * 0.85) { rout(s, kracht, true); return; }
      Game.ui.log.schrijf(s, '⚔️ De uitval was te gewaagd — je leger werd teruggedreven en verloor mannen.', 'slecht');
      verliesSoldaat(s);
      if (Math.random() < 0.5) verliesSoldaat(s);
      split = R.verdedigingSplit(s);
      leger = Math.round(split.garnizoen + R.burgerwachtKracht(s));
      verdediging = Math.round(leger + split.positioneel);
      verhouding = verdediging / Math.max(1, kracht);
    }

    /* From age 4 a band that cannot win outright may dig in instead. */
    if (s.tijdperk >= c.belegVanafTijdperk && verhouding < 1.35 && verhouding > 0.5 &&
        Math.random() < c.belegKans) {
      beginBeleg(s, kracht);
      return;
    }

    if (leger > 0 && verdediging >= kracht * 1.5) { rout(s, kracht, false); return; }

    if (verhouding >= 1) {
      s.raid.uitslag = 'verjaagd';
      Game.ui.log.schrijf(s, '🛡️ Je wacht heeft ' + s.rovers.naam + ' verjaagd! (' +
        verdediging + ' tegen ' + Math.round(kracht) + ')', 'goed');
      Game.ui.toast('🛡️ De rovers zijn verjaagd!');
      s.moreel = (s.moreel || 0) + 7;
      if (Math.random() < 0.3) verliesSoldaat(s);
      return;
    }

    var evac = s.raid.keuze.evacuatie;

    if (verhouding >= 0.6) {
      s.raid.uitslag = 'ternauwernood';
      var buit = steel(s, 0.10 * (evac ? c.evacuatieBuit : 1));
      Game.ui.log.schrijf(s, '⚔️ Zware strijd! De rovers zijn teruggeslagen, maar namen ' + buit + ' mee.', 'slecht');
      Game.ui.toast('⚔️ Ternauwernood standgehouden');
      s.moreel = (s.moreel || 0) - 4;
      verliesSoldaat(s);
      return;
    }

    s.raid.uitslag = 'doorgebroken';
    s.rovers.wrok = Math.max(0, (s.rovers.wrok || 0) - 1);   /* he got what he came for */
    var buit2 = steel(s, 0.28 * (evac ? c.evacuatieBuit : 1));
    var schade = beschadigGebouw(s);
    var tekst = '🔥 ' + s.rovers.naam + ' brak door je verdediging (' + verdediging +
      ' tegen ' + Math.round(kracht) + ') en roofde ' + buit2 + '.';
    if (schade) tekst += ' ' + schade + ' is zwaar beschadigd.';
    if (evac) tekst += ' Dankzij de ontruiming viel de buit mee.';
    Game.ui.log.schrijf(s, tekst, 'slecht');
    Game.ui.toast('🔥 De rovers hebben toegeslagen!');
    s.moreel = (s.moreel || 0) - 12;
    /* Evacuated towns lose goods, not people. */
    if (!evac && s.bevolking.totaal > 4 && Math.random() < 0.5) {
      Game.core.population.verwijderDorpeling(s);
      Game.ui.log.schrijf(s, '💀 Een dorpeling kwam om bij de overval.', 'slecht');
    }
  }

  /* ------------------------------------------------------------- het beleg -- */

  function beginBeleg(s, kracht) {
    var r = s.raid;
    r.fase = 'beleg';
    r.uitslag = 'beleg';
    r.kracht = kracht;
    r.belegTimer = cfg().belegDuur;
    s.leger.uitval = false;
    Game.ui.log.schrijf(s, '🏕️ ' + s.rovers.naam + ' slaat zijn kamp op voor je muren. ' +
      'Alles buiten de stad ligt stil tot je het beleg breekt of ze het opgeven.', 'slecht');
    Game.ui.toast('🏕️ Je stad wordt belegerd!');
  }

  function belegTick(s, dt) {
    var r = s.raid;
    var c = cfg();
    r.belegTimer -= dt;
    s.moreel = (s.moreel || 0) - c.belegMoreelPerSec * dt;

    /* A sortie ordered during the siege is resolved right away. */
    if (s.leger.uitval) {
      var leger = R.legerKracht(s);
      if (leger >= r.kracht * 0.85) {
        rout(s, r.kracht, true);
        eindig(s);
        return;
      }
      Game.ui.log.schrijf(s, '⚔️ De uitval brak niet door de belegeringslinie. Je verloor mannen.', 'slecht');
      verliesSoldaat(s);
      r.kracht *= 0.9;
      s.leger.uitval = false;
      return;
    }

    if (r.belegTimer <= 0) {
      /* Waited them out: hungry and bored, they break camp. */
      Game.ui.log.schrijf(s, '🏕️ ' + s.rovers.naam +
        ' heeft het beleg opgegeven en is afgetrokken. Je stad hield stand.', 'goed');
      Game.ui.toast('🛡️ Het beleg is voorbij');
      s.moreel = (s.moreel || 0) + 8;
      s.leger.overwinningen++;
      eindig(s);
    }
  }

  /* ------------------------------------------------------------- gevolgen -- */

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
    g.geschroeid = 26;
    s.raid.doel = { x: g.x + d.grootte / 2, y: g.y + d.grootte / 2 };
    Game.core.state.herbereken(s);
    return d.naam;
  }

  /* ------------------------------------------------------------------ HUD -- */

  R.statusTekst = function (s) {
    if (s.tijdperk < 2) return null;
    if (s.raid.fase !== 'waarschuwing' && s.raid.fase !== 'beleg') return null;
    R.zorgLeger(s);
    R.zorgRovers(s);
    zorgKeuze(s);
    var split = R.verdedigingSplit(s);
    return {
      fase: s.raid.fase,
      naam: s.rovers.naam,
      seconden: Math.ceil(s.raid.fase === 'beleg' ? s.raid.belegTimer : s.raid.timer),
      kracht: Math.round(s.raid.kracht),
      beginKracht: Math.round(s.raid.beginKracht || s.raid.kracht),
      afgeslagen: Math.round(s.raid.afgeslagen || 0),
      voortgang: s.raid.voortgang || 0,
      verdediging: R.effectieveVerdediging(s),
      wachtendeDekking: Math.round(split.positioneel),
      totaal: s.verdediging,
      leger: R.legerKracht(s),
      uitval: s.leger.uitval,
      kanUitval: R.legerKracht(s) > 0,
      evacuatie: s.raid.keuze.evacuatie,
      burgerwacht: s.raid.keuze.burgerwacht,
      burgerwachtKracht: R.burgerwachtKracht(s),
      schatting: R.schattingPrijs(s),
      kanSchatting: s.res.munten >= R.schattingPrijs(s)
    };
  };

  Game.core.raids = R;

})(window.Game);
