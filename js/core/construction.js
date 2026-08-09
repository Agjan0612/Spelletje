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
     player in Dutch under the cursor. */
  C.controleer = function (s, type, x, y) {
    var d = Game.config.gebouw(type);
    if (!d) return { ok: false, reden: 'Onbekend gebouw' };

    if (d.tijdperk > s.tijdperk) {
      return { ok: false, reden: 'Vergrendeld tot tijdperk ' + d.tijdperk };
    }
    if (d.max && C.aantalGepland(s, type) >= d.max) {
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
        if (t.b !== null && t.b !== undefined) return { ok: false, reden: 'Hier staat al iets' };
      }
    }

    if (d.plaats && d.plaats.nabij) {
      var eis = d.plaats.nabij;
      var mx = x + (d.grootte - 1) / 2, my = y + (d.grootte - 1) / 2;
      if (map.nodeInBereik(s.kaart, Math.round(mx), Math.round(my), eis.node, eis.straal) <= 0) {
        return { ok: false, reden: 'Moet binnen ' + eis.straal + ' tegels van ' + map.nodeNaam[eis.node].toLowerCase() + ' staan' };
      }
    }

    if (!Game.core.state.kanBetalen(s, d.kosten)) {
      return { ok: false, reden: 'Te weinig grondstoffen' };
    }

    return { ok: true, reden: '' };
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

    var bouwers = Math.min(8, s.bevolking.werkloos);
    var snelheid = (0.5 + bouwers * 0.55) / sites.length;

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
