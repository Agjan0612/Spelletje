/* The travelling merchant.
 *
 * Every few minutes a caravan rolls into town, stays a while and offers a
 * handful of one-off deals: he sells what you are short of and buys what you
 * have too much of. It is the only way to turn coins back into goods, so a
 * full purse finally becomes a real tool instead of an age-up toll.
 *
 * Same shape as raids.js: a phase plus a timer, all plain JSON. */
(function (Game) {

  var H = {};

  H.tick = function (s, dt) {
    if (s.tijdperk < 2) return;              /* a hamlet is not worth the trip */
    var h = s.handel;
    if (!h) return;

    h.timer -= dt;
    if (h.timer > 0) return;

    if (h.fase === 'aanwezig') {
      vertrek(s);
    } else {
      arriveer(s);
    }
  };

  function volgendeRust() {
    var r = Game.config.handel.rust;
    return r[0] + Math.random() * (r[1] - r[0]);
  }
  H.volgendeRust = volgendeRust;

  function arriveer(s) {
    var h = s.handel;
    h.fase = 'aanwezig';
    h.nummer++;
    h.timer = Game.config.handel.verblijf;
    h.aanbod = maakAanbod(s);
    Game.ui.log.schrijf(s, '🐴 Een reizende koopman is aangekomen op het plein. Hij blijft even.', 'goed');
    Game.ui.toast('🐴 Er is een koopman in de stad');
  }

  function vertrek(s) {
    var h = s.handel;
    var gedaan = h.aanbod.filter(function (a) { return a.gedaan; }).length;
    h.fase = 'weg';
    h.timer = volgendeRust();
    h.aanbod = [];
    Game.ui.log.schrijf(s, gedaan
      ? '🐴 De koopman trekt verder. Het was zaken doen.'
      : '🐴 De koopman trekt verder — je hebt niets met hem gehandeld.');
  }

  /* How much of the spread your trade buildings claw back. */
  H.marge = function (s) {
    var cfg = Game.config.handel;
    var korting = 0;
    for (var type in cfg.marge) {
      korting += cfg.marge[type] * Game.core.state.telType(s, type);
    }
    return Math.min(cfg.margeMax, korting);
  };

  H.prijs = function (s, res, aantal, soort) {
    var cfg = Game.config.handel;
    var basis = Game.config.handelWaarde[res] || 1;
    var marge = H.marge(s);
    var factor = soort === 'koopt'
      ? cfg.verkoopFactor * (1 + marge)     /* he pays you more */
      : cfg.koopFactor * (1 - marge);       /* he charges you less */
    return Math.max(1, Math.round(basis * aantal * factor));
  };

  /* He offers what you are short of and asks for what you are drowning in —
     read straight off the current stock, so the caravan always feels relevant. */
  function maakAanbod(s) {
    var kandidaten = Object.keys(Game.config.handelWaarde).filter(function (r) {
      return Game.config.resources[r];
    });

    var arm = kandidaten.slice().sort(function (a, b) {
      return (s.res[a] / (s.capaciteit || 1)) - (s.res[b] / (s.capaciteit || 1));
    });
    var rijk = arm.slice().reverse();

    var aanbod = [];
    var gebruikt = {};

    /* Two things he sells you (the ones you have least of that he can carry). */
    for (var i = 0; i < arm.length && aanbod.length < 2; i++) {
      var r = arm[i];
      if (gebruikt[r]) continue;
      /* Gems and iron only once the mines exist, or the offer is meaningless. */
      if (s.tijdperk < 3 && (r === 'edelsteen' || r === 'gereedschap')) continue;
      gebruikt[r] = true;
      var aantal = hoeveelheid(s, r);
      aanbod.push({ soort: 'verkoopt', res: r, aantal: aantal, prijs: H.prijs(s, r, aantal, 'verkoopt'), gedaan: false });
    }

    /* And one thing he takes off your hands — three offers is enough to read
       at a glance in the city panel. */
    for (var j = 0; j < rijk.length && aanbod.length < 3; j++) {
      var r2 = rijk[j];
      if (gebruikt[r2]) continue;
      var aantal2 = hoeveelheid(s, r2);
      if (s.res[r2] < aantal2 * 0.6) continue;      /* don't ask for what you lack */
      gebruikt[r2] = true;
      aanbod.push({ soort: 'koopt', res: r2, aantal: aantal2, prijs: H.prijs(s, r2, aantal2, 'koopt'), gedaan: false });
    }

    return aanbod;
  }

  /* Trade sizes grow with the town so a caravan stays worth stopping for. */
  function hoeveelheid(s, res) {
    var waarde = Game.config.handelWaarde[res] || 1;
    var schaal = 40 + s.bevolking.totaal * 0.9 + s.tijdperk * 12;
    var n = Math.round(schaal / Math.max(0.5, waarde) / 10) * 10;
    return Game.util.clamp(n, 10, 260);
  }

  H.kanHandelen = function (s, index) {
    var a = s.handel && s.handel.aanbod[index];
    if (!a || a.gedaan || s.handel.fase !== 'aanwezig') return false;
    if (a.soort === 'verkoopt') return s.res.munten >= a.prijs;
    return s.res[a.res] >= a.aantal;
  };

  /* Executes one deal. Buying respects the storage cap, so a full warehouse
     simply means less arrives — never a silent loss of coins. */
  H.doe = function (s, index) {
    if (!H.kanHandelen(s, index)) return false;
    var a = s.handel.aanbod[index];
    var naam = Game.config.resources[a.res].naam.toLowerCase();

    if (a.soort === 'verkoopt') {
      var ruimte = s.capaciteit - s.res[a.res];
      if (ruimte < a.aantal * 0.5) {
        Game.ui.toast('📦 Je opslag voor ' + naam + ' is te vol voor deze koop');
        return false;
      }
      s.res.munten -= a.prijs;
      var gekregen = Game.core.state.voegToe(s, a.res, a.aantal);
      Game.ui.log.schrijf(s, '🐴 Gekocht: ' + Math.round(gekregen) + ' ' + naam +
        ' voor ' + a.prijs + ' munten.', 'goed');
    } else {
      s.res[a.res] -= a.aantal;
      Game.core.state.voegToe(s, 'munten', a.prijs);
      Game.ui.log.schrijf(s, '🐴 Verkocht: ' + a.aantal + ' ' + naam +
        ' voor ' + a.prijs + ' munten.', 'goed');
    }

    a.gedaan = true;
    Game.core.state.herbereken(s);
    return true;
  };

  Game.core.handel = H;

})(window.Game);
