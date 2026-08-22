/* Neighbouring towns: trade routes, reputation and the odd cry for help.
 *
 * The map edge used to mean "where bandits come from". These are the places
 * on the other side of it. Three of them are generated per world, sit just
 * outside the playable area, and are pure JSON like everything else.
 *
 * A trade route is an *investment*: it costs a wagon and a purse up front and
 * then pays a little every second for the rest of the game, scaled by how
 * well you have treated that town. It also hauls goods away from you, so a
 * route you cannot supply quietly stops earning. Raiders breaking through
 * cuts your routes for a while, which finally gives a lost raid a consequence
 * that is not just a pile of stolen timber.
 */
(function (Game) {

  var B = {};

  function cfg() { return Game.config.buren; }

  /* Placed on the map edge, spread around the town so they do not bunch up. */
  B.genereer = function (s) {
    var namen = Game.config.buurstadNamen.slice();
    var soorten = Game.config.buurstadSoorten.slice();
    var lijst = [];
    var n = cfg().aantal;

    for (var i = 0; i < n; i++) {
      var hoek = (i / n) * Math.PI * 2 + Math.random() * 0.6;
      var straal = Math.min(s.kaart.b, s.kaart.h) * 0.46;
      var cx = s.kaart.b / 2 + Math.cos(hoek) * straal;
      var cy = s.kaart.h / 2 + Math.sin(hoek) * straal;

      var naamIdx = Math.floor(Math.random() * namen.length);
      var soortIdx = Math.floor(Math.random() * soorten.length);

      lijst.push({
        id: 'buur' + i,
        naam: namen.splice(naamIdx, 1)[0],
        soort: soorten.splice(soortIdx, 1)[0].id,
        x: Math.round(Game.util.clamp(cx, 1, s.kaart.b - 2)),
        y: Math.round(Game.util.clamp(cy, 1, s.kaart.h - 2)),
        reputatie: 50,
        route: null,          /* { sinds } once opened */
        onderbroken: 0,       /* seconds a raid cut it for */
        verzoek: null,        /* { res, aantal, resterend } */
        geholpen: 0, geweigerd: 0
      });
    }
    return lijst;
  };

  B.zorg = function (s) {
    if (!Array.isArray(s.buren) || !s.buren.length) s.buren = B.genereer(s);
    if (!s.burenTimer) s.burenTimer = cfg().verzoekRust[0];
    for (var i = 0; i < s.buren.length; i++) {
      var b = s.buren[i];
      if (typeof b.reputatie !== 'number') b.reputatie = 50;
      if (typeof b.onderbroken !== 'number') b.onderbroken = 0;
      if (typeof b.geholpen !== 'number') b.geholpen = 0;
      if (typeof b.geweigerd !== 'number') b.geweigerd = 0;
    }
  };

  B.soort = function (b) {
    var l = Game.config.buurstadSoorten;
    for (var i = 0; i < l.length; i++) if (l[i].id === b.soort) return l[i];
    return l[0];
  };

  /* Reputation turns a route from meagre to handsome. 0..100 -> 0.5..1.5. */
  B.factor = function (b) {
    return 1 + ((b.reputatie - 50) / 50) * cfg().reputatieInvloed;
  };

  B.kanRoute = function (s, b) {
    if (b.route) return { ok: false, reden: 'Er loopt al een route' };
    if (s.tijdperk < cfg().routeTijdperk) {
      return { ok: false, reden: 'Vanaf tijdperk ' + cfg().routeTijdperk };
    }
    if (!Game.core.state.kanBetalen(s, cfg().routeKosten)) {
      return { ok: false, reden: 'Te weinig grondstoffen' };
    }
    return { ok: true };
  };

  B.openRoute = function (s, b) {
    var check = B.kanRoute(s, b);
    if (!check.ok) return false;
    Game.core.state.betaal(s, cfg().routeKosten);
    b.route = { sinds: s.jaar };
    Game.ui.log.schrijf(s, '🐎 Er loopt nu een handelsroute naar ' + b.naam +
      '. Elke dag komt er wat binnen — zolang je levert wat ze vragen.', 'goed');
    Game.ui.toast('🐎 Handelsroute naar ' + b.naam);
    return true;
  };

  B.sluitRoute = function (s, b) {
    if (!b.route) return false;
    b.route = null;
    Game.ui.log.schrijf(s, '🐎 De route naar ' + b.naam + ' is opgeheven.');
    return true;
  };

  /* Answering a request: hand over the goods for standing, or turn them away. */
  B.help = function (s, b) {
    if (!b.verzoek) return false;
    if (s.res[b.verzoek.res] < b.verzoek.aantal) return false;
    s.res[b.verzoek.res] -= b.verzoek.aantal;
    b.reputatie = Game.util.clamp(b.reputatie + cfg().verzoekReputatie, 0, 100);
    b.geholpen++;
    s.moreel = (s.moreel || 0) + 4;
    Game.ui.log.schrijf(s, '🤝 Je hielp ' + b.naam + ' uit de brand. Dat wordt onthouden.', 'goed');
    b.verzoek = null;
    return true;
  };

  B.weiger = function (s, b) {
    if (!b.verzoek) return false;
    b.reputatie = Game.util.clamp(b.reputatie + cfg().weigerReputatie, 0, 100);
    b.geweigerd++;
    Game.ui.log.schrijf(s, '🚪 Je liet de boden van ' + b.naam + ' met lege handen gaan.');
    b.verzoek = null;
    return true;
  };

  /* A raid that got through cuts every road out of town for a while. */
  B.onderbreek = function (s) {
    B.zorg(s);
    var geraakt = 0;
    for (var i = 0; i < s.buren.length; i++) {
      if (!s.buren[i].route) continue;
      s.buren[i].onderbroken = cfg().onderbrekingNaRoof;
      geraakt++;
    }
    if (geraakt) {
      Game.ui.log.schrijf(s, '🐎 De rovers maken de wegen onveilig — je handelsroutes liggen stil.', 'slecht');
    }
  };

  B.tick = function (s, dt) {
    if (s.tijdperk < 2) return;
    B.zorg(s);
    var c = cfg();

    for (var i = 0; i < s.buren.length; i++) {
      var b = s.buren[i];

      if (b.onderbroken > 0) { b.onderbroken -= dt; continue; }

      /* --- a running route --- */
      if (b.route) {
        var soort = B.soort(b);
        var f = B.factor(b);
        /* They want paying in goods. No goods, no caravan. */
        var wil = c.routeVraagt * dt;
        var betaald = Math.min(s.res[soort.vraagt], wil);
        s.res[soort.vraagt] -= betaald;
        var deel = wil > 0 ? betaald / wil : 1;

        if (deel > 0.01) {
          Game.core.state.voegToe(s, soort.levert, c.routeOpbrengst * f * deel * dt);
          Game.core.state.voegToe(s, 'munten', c.routeMunten * f * deel * dt);
        }
        b.leegloop = deel < 0.5;
      }

      /* --- a request that ran out of time --- */
      if (b.verzoek) {
        b.verzoek.resterend -= dt;
        if (b.verzoek.resterend <= 0) {
          b.reputatie = Game.util.clamp(b.reputatie + c.weigerReputatie, 0, 100);
          Game.ui.log.schrijf(s, '⌛ Je hebt het verzoek van ' + b.naam + ' laten verlopen.');
          b.verzoek = null;
        }
      }
    }

    /* --- a new request now and then --- */
    s.burenTimer -= dt;
    if (s.burenTimer > 0) return;
    s.burenTimer = c.verzoekRust[0] + Math.random() * (c.verzoekRust[1] - c.verzoekRust[0]);

    var vrij = s.buren.filter(function (x) { return !x.verzoek; });
    if (!vrij.length) return;
    var doel = vrij[Math.floor(Math.random() * vrij.length)];
    var soort2 = B.soort(doel);
    var aantal = Math.round(40 + s.bevolking.totaal * 1.2);
    doel.verzoek = {
      res: soort2.vraagt,
      aantal: aantal,
      resterend: c.verzoekDuur,
      tekst: doel.naam + ' heeft een zware tijd en vraagt om ' + aantal + ' ' +
        Game.config.resources[soort2.vraagt].naam.toLowerCase() + '.'
    };
    Game.ui.log.schrijf(s, '📨 ' + doel.verzoek.tekst);
  };

  /* Everything the town-affairs card needs. */
  B.overzicht = function (s) {
    B.zorg(s);
    return s.buren.map(function (b) {
      var soort = B.soort(b);
      return {
        id: b.id, naam: b.naam, soort: soort,
        reputatie: Math.round(b.reputatie),
        route: !!b.route,
        onderbroken: b.onderbroken > 0 ? Math.ceil(b.onderbroken) : 0,
        leegloop: !!b.leegloop,
        opbrengst: b.route ? Math.round(Game.config.buren.routeOpbrengst * B.factor(b) * 600) / 10 : 0,
        verzoek: b.verzoek,
        kanRoute: B.kanRoute(s, b)
      };
    });
  };

  Game.core.buren = B;

})(window.Game);
