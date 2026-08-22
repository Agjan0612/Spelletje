/* Placing, building and demolishing. */
(function (Game) {

  var C = {};
  var map = Game.core.map;

  C.plekVrij = function (s, x, y, grootte) {
    for (var dy = 0; dy < grootte; dy++) {
      for (var dx = 0; dx < grootte; dx++) {
        var t = map.tegel(s.kaart, x + dx, y + dy);
        if (!t) return false;
        if (!map.bebouwbaar[t.t]) return false;
        if (t.b !== null && t.b !== undefined) return false;
      }
    }
    return true;
  };

  /* Full placement check. Returns { ok, reden } — `reden` is shown to the
     player in Dutch under the cursor.

     `opties` is used when moving an existing building: { negeerId } lets the
     building's own tiles (and its copy limit) pass, and { negeerKosten } skips
     the price of a fresh build. */
  C.controleer = function (s, type, x, y, opties) {
    opties = opties || {};
    var d = Game.config.gebouw(type);
    if (!d) return { ok: false, reden: 'Onbekend gebouw' };

    if (d.tijdperk > s.tijdperk) {
      return { ok: false, reden: 'Vergrendeld tot tijdperk ' + d.tijdperk };
    }

    /* A street is a flag on a tile, not a building, so it plays by its own
       short set of rules: laying one on an existing street takes it up. */
    if (d.weg) return C.controleerWeg(s, d, x, y);
    if (d.max && !opties.negeerId && C.aantalGepland(s, type) >= d.max) {
      return { ok: false, reden: 'Je mag er maar ' + d.max + ' hebben' };
    }

    for (var dy = 0; dy < d.grootte; dy++) {
      for (var dx = 0; dx < d.grootte; dx++) {
        var t = map.tegel(s.kaart, x + dx, y + dy);
        if (!t) return { ok: false, reden: 'Buiten de kaart' };
        if (t.t === 'water') return { ok: false, reden: 'Niet op water bouwen' };
        if (t.t === 'berg') return { ok: false, reden: 'De berg is te steil om op te bouwen' };
        if (t.t === 'rots' && !(d.plaats && d.plaats.opRuwTerrein)) {
          return { ok: false, reden: 'De grond is te rotsachtig — alleen mijnbouw kan hier staan' };
        }
        if (t.b !== null && t.b !== undefined && t.b !== opties.negeerId) {
          return { ok: false, reden: 'Hier staat al iets' };
        }
      }
    }

    if (d.plaats && d.plaats.nabij) {
      var eis = d.plaats.nabij;
      var mx = x + (d.grootte - 1) / 2, my = y + (d.grootte - 1) / 2;
      if (map.nodeInBereik(s.kaart, Math.round(mx), Math.round(my), eis.node, eis.straal) <= 0) {
        return { ok: false, reden: 'Moet binnen ' + eis.straal + ' tegels van ' + map.nodeNaam[eis.node].toLowerCase() + ' staan' };
      }
    }

    /* Some buildings are only put up where people want to live. */
    if (d.plaats && d.plaats.aantrekkelijkheid) {
      var mx2 = x + (d.grootte - 1) / 2, my2 = y + (d.grootte - 1) / 2;
      var hier = Game.core.buurt.aantrekkelijkOp(s, mx2, my2);
      if (hier < d.plaats.aantrekkelijkheid) {
        return {
          ok: false,
          reden: 'De buurt is hier niet deftig genoeg (' + Math.round(hier) +
            ' van ' + d.plaats.aantrekkelijkheid + ')'
        };
      }
    }

    var kosten = opties.negeerKosten ? (opties.kosten || {}) : d.kosten;
    if (!Game.core.state.kanBetalen(s, kosten)) {
      return { ok: false, reden: 'Te weinig grondstoffen' };
    }

    return { ok: true, reden: '' };
  };

  /* --------------------------------------------------------------- wegen -- */

  C.controleerWeg = function (s, d, x, y) {
    var t = map.tegel(s.kaart, x, y);
    if (!t) return { ok: false, reden: 'Buiten de kaart' };
    if (t.weg) return { ok: true, reden: '', opbreken: true };
    if (t.t === 'water') return { ok: false, reden: 'Niet over water — daar hoort een brug' };
    if (t.t === 'berg') return { ok: false, reden: 'De berg is te steil voor een weg' };
    if (t.b !== null && t.b !== undefined) return { ok: false, reden: 'Hier staat al iets' };
    if (!Game.core.state.kanBetalen(s, d.kosten)) {
      return { ok: false, reden: 'Te weinig grondstoffen' };
    }
    return { ok: true, reden: '' };
  };

  /* Lays or lifts one street tile. Streets are never building sites: there is
     nothing to raise, so they are done the moment they are laid. */
  C.legWeg = function (s, d, x, y) {
    var check = C.controleerWeg(s, d, x, y);
    if (!check.ok) return { ok: false, reden: check.reden };
    var t = map.tegel(s.kaart, x, y);

    if (check.opbreken) {
      t.weg = 0;
      for (var r in d.kosten) Game.core.state.voegToe(s, r, Math.floor(d.kosten[r] * 0.5));
    } else {
      Game.core.state.betaal(s, d.kosten);
      /* Clearing the ground for a street yields the same scrap of timber as
         clearing it for a building would. */
      if (t.t === 'bos') {
        Game.core.state.voegToe(s, 'hout', Math.round(Math.min(8, t.amt)));
        t.t = 'gras'; t.n = null; t.amt = 0; t.max = 0;
      }
      t.weg = 1;
    }

    /* One counter is all core/logistiek.js needs to know the network moved. */
    s.wegTeller = (s.wegTeller || 0) + 1;
    return { ok: true, weg: true, opgebroken: !!check.opbreken };
  };

  C.aantalGepland = function (s, type) {
    var n = 0;
    for (var i = 0; i < s.gebouwen.length; i++) if (s.gebouwen[i].type === type) n++;
    return n;
  };

  C.markeerTegels = function (s, g) {
    var d = Game.config.gebouw(g.type);
    for (var dy = 0; dy < d.grootte; dy++) {
      for (var dx = 0; dx < d.grootte; dx++) {
        var t = map.tegel(s.kaart, g.x + dx, g.y + dy);
        if (t) t.b = g.id;
      }
    }
  };

  C.wisTegels = function (s, g) {
    var d = Game.config.gebouw(g.type);
    for (var dy = 0; dy < d.grootte; dy++) {
      for (var dx = 0; dx < d.grootte; dx++) {
        var t = map.tegel(s.kaart, g.x + dx, g.y + dy);
        if (t && t.b === g.id) t.b = null;
      }
    }
  };

  /* Places a building site. Costs are paid immediately; the site then needs
     builders to finish. Clearing forest yields a little timber. */
  C.plaats = function (s, type, x, y) {
    var d0 = Game.config.gebouw(type);
    if (d0 && d0.weg) return C.legWeg(s, d0, x, y);

    var check = C.controleer(s, type, x, y);
    if (!check.ok) return { ok: false, reden: check.reden };

    var d = Game.config.gebouw(type);
    Game.core.state.betaal(s, d.kosten);

    var gekapt = 0;
    for (var dy = 0; dy < d.grootte; dy++) {
      for (var dx = 0; dx < d.grootte; dx++) {
        var t = map.tegel(s.kaart, x + dx, y + dy);
        if (t && t.t === 'bos') {
          gekapt += Math.min(12, t.amt);
          t.t = 'gras'; t.n = null; t.amt = 0; t.max = 0;
        }
        /* A building swallows the street it stands on. */
        if (t && t.weg) { t.weg = 0; s.wegTeller = (s.wegTeller || 0) + 1; }
      }
    }
    if (gekapt > 0) Game.core.state.voegToe(s, 'hout', Math.round(gekapt));

    var g = {
      id: s.volgendId++,
      type: type,
      x: x, y: y,
      werkers: 0,
      voortgang: 0,
      gebouwd: false,
      uit: false,
      waarschuwing: ''
    };
    s.gebouwen.push(g);
    C.markeerTegels(s, g);
    Game.core.state.herbereken(s);

    return { ok: true, gebouw: g };
  };

  /* Idle villagers work on every building site at once; more idlers means
     faster construction, up to a sensible cap. */
  C.tick = function (s, dt) {
    var sites = [];
    for (var i = 0; i < s.gebouwen.length; i++) {
      if (!s.gebouwen[i].gebouwd) sites.push(s.gebouwen[i]);
    }
    if (!sites.length) return;

    /* Nothing gets raised while the militia is standing on the wall. */
    if (Game.core.raids.bouwStilgelegd(s)) return;

    var bouwers = Math.min(8, s.bevolking.werkloos);
    var snelheid = (0.5 + bouwers * 0.55) * (s.bonus.bouw || 1) / sites.length;

    for (var j = 0; j < sites.length; j++) {
      var g = sites[j];
      var d = Game.config.gebouw(g.type);
      g.voortgang += dt * snelheid;
      if (g.voortgang >= d.bouwtijd) {
        g.voortgang = d.bouwtijd;
        g.gebouwd = true;
        Game.core.state.herbereken(s);
        Game.ui.log.schrijf(s, d.emoji + ' ' + d.naam + ' is klaar!', 'goed');
        Game.core.population.autoBemannen(s, g);
      }
    }
  };

  /* --------------------------------------------------------- verplaatsen -- */

  /* Moving a finished building costs a fifth of what it cost to build — the
     material you lose taking it apart — instead of demolishing at half loss
     and paying full price again. */
  C.verplaatsKosten = function (type) {
    var d = Game.config.gebouw(type);
    var kosten = {};
    for (var r in d.kosten) {
      var deel = Math.ceil(d.kosten[r] * 0.2);
      if (deel > 0) kosten[r] = deel;
    }
    return kosten;
  };

  C.controleerVerplaatsing = function (s, g, x, y) {
    if (g.type === 'dorpsplein') return { ok: false, reden: 'Het dorpsplein blijft waar het is' };
    var kosten = C.verplaatsKosten(g.type);
    return C.controleer(s, g.type, x, y, { negeerId: g.id, negeerKosten: true, kosten: kosten });
  };

  C.verplaats = function (s, g, x, y) {
    var check = C.controleerVerplaatsing(s, g, x, y);
    if (!check.ok) return { ok: false, reden: check.reden };

    Game.core.state.betaal(s, C.verplaatsKosten(g.type));
    C.wisTegels(s, g);
    g.x = x; g.y = y;
    C.markeerTegels(s, g);
    Game.core.state.herbereken(s);

    var d = Game.config.gebouw(g.type);
    if (Game.render.particles) {
      Game.render.particles.stof((x + d.grootte / 2) * 40, (y + d.grootte / 2) * 40, 6);
    }
    Game.ui.log.schrijf(s, d.emoji + ' ' + d.naam + ' is verplaatst.');
    return { ok: true };
  };

  /* --------------------------------------------------------- verbeteren -- */

  /* An upgrade swaps one building for a bigger version of itself on the same
     spot. The footprint is identical by design (see buildings.js), so the tiles
     it occupies never change — only what stands on them. */
  C.kanVerbeteren = function (s, g) {
    var d = Game.config.gebouw(g.type);
    var v = d.verbetering;
    if (!v) return { ok: false };
    var naar = Game.config.gebouw(v.naar);
    if (!naar) return { ok: false };

    if (!g.gebouwd) return { ok: false, reden: 'Eerst afbouwen', naar: naar, kosten: v.kosten };
    if (s.tijdperk < v.tijdperk) {
      return { ok: false, reden: 'Vanaf tijdperk ' + v.tijdperk, naar: naar, kosten: v.kosten };
    }
    /* A cottage only grows into a half-timbered house on a street worth
       living on. This is where building nicely pays off. */
    if (v.aantrekkelijkheid) {
      var mid = (d.grootte - 1) / 2;
      var hier = Game.core.buurt.aantrekkelijkOp(s, g.x + mid, g.y + mid);
      if (hier < v.aantrekkelijkheid) {
        return {
          ok: false,
          reden: 'De buurt is nog niet aantrekkelijk genoeg (' + Math.round(hier) +
            ' van ' + v.aantrekkelijkheid + ')',
          naar: naar, kosten: v.kosten, sfeerTekort: true
        };
      }
    }
    if (!Game.core.state.kanBetalen(s, v.kosten)) {
      return { ok: false, reden: 'Te weinig grondstoffen', naar: naar, kosten: v.kosten };
    }
    return { ok: true, naar: naar, kosten: v.kosten };
  };

  C.verbeter = function (s, g) {
    var check = C.kanVerbeteren(s, g);
    if (!check.ok) return false;

    var oud = Game.config.gebouw(g.type);
    Game.core.state.betaal(s, check.kosten);

    C.wisTegels(s, g);
    g.type = check.naar.id;
    C.markeerTegels(s, g);

    /* The new building may have fewer or more slots than the old one. */
    var banen = check.naar.banen ? check.naar.banen.aantal : 0;
    g.werkers = Math.min(g.werkers, banen);
    g.waarschuwing = '';

    Game.core.state.herbereken(s);
    Game.core.population.corrigeer(s);

    if (Game.render.particles) {
      Game.render.particles.stof((g.x + check.naar.grootte / 2) * 40,
        (g.y + check.naar.grootte / 2) * 40, 8);
    }
    Game.ui.log.schrijf(s, check.naar.emoji + ' ' + oud.naam + ' is uitgebouwd tot ' +
      check.naar.naam + '.', 'goed');
    return true;
  };

  C.sloop = function (s, g) {
    var d = Game.config.gebouw(g.type);
    if (g.gebouwd) {
      for (var r in d.kosten) Game.core.state.voegToe(s, r, Math.floor(d.kosten[r] * 0.5));
    } else {
      for (var r2 in d.kosten) Game.core.state.voegToe(s, r2, Math.floor(d.kosten[r2] * 0.9));
    }
    C.wisTegels(s, g);
    var i = s.gebouwen.indexOf(g);
    if (i >= 0) s.gebouwen.splice(i, 1);
    Game.core.state.herbereken(s);
    Game.ui.log.schrijf(s, d.naam + ' gesloopt. Een deel van het materiaal is hergebruikt.');
  };

  Game.core.construction = C;

})(window.Game);
