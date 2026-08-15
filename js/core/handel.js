/* Handel — a travelling merchant, built like raids.js: a timed event that
 * rests, then arrives, then leaves. While present you can trade at prices that
 * follow supply and demand: dumping a surplus pays little, buying something
 * scarce costs a lot. The trade menu is a small puzzle instead of a fixed shop.
 *
 * Everything is plain data. The caravan appears from age 2 (once there's a
 * market worth visiting); streken and the Marktrecht edict make it come more
 * often and trade on better terms. */
(function (Game) {

  var H = {};

  /* Base worth of one unit, in coins. */
  var BASIS = {
    vlees: 1.0, hout: 0.5, steen: 0.6, ijzer: 2.2, koper: 2.2, edelsteen: 7.0,
    graan: 0.5, brood: 1.4, gereedschap: 3.2, munten: 1.0
  };

  var MARKT_DUUR = 80;     /* seconds the caravan stays */

  /* How favourably the town trades — raised by a trade route or Marktrecht. */
  function gunst(s) {
    var g = Game.config.streekMult(s, 'koopman');
    if (Game.core.beleid) g *= Game.core.beleid.mult(s, 'koopman');
    return g;
  }

  /* Coins you get for selling one unit: the more you have in store, the less
     it is worth (a glut is cheap). */
  H.verkoopPrijs = function (s, res) {
    var ratio = Game.util.clamp(s.res[res] / Math.max(1, s.capaciteit), 0, 1);
    var prijs = BASIS[res] * (1.05 - 0.55 * ratio);
    prijs *= Math.min(1.35, Math.sqrt(gunst(s)));
    return prijs;
  };

  /* Coins it costs to buy one unit: the less you have, the more they charge. */
  H.koopPrijs = function (s, res) {
    var ratio = Game.util.clamp(s.res[res] / Math.max(1, s.capaciteit), 0, 1);
    var prijs = BASIS[res] * (1.7 + 0.8 * (1 - ratio));
    prijs /= Math.min(1.35, Math.sqrt(gunst(s)));
    return prijs;
  };

  function rustTijd(s) {
    var basis = 300 / Math.max(0.4, gunst(s));
    return basis + Math.random() * 90;
  }

  H.tick = function (s, dt) {
    if (s.tijdperk < 2) return;
    if (!s.handel) s.handel = { fase: 'rust', timer: 200, aanbod: null };
    var h = s.handel;

    if (h.fase === 'rust') {
      h.timer -= dt;
      if (h.timer <= 0) {
        h.fase = 'markt';
        h.timer = MARKT_DUUR;
        h.aanbod = genereerAanbod(s);
        Game.ui.log.schrijf(s, '🐴 Een reizende koopman heeft zijn kraam opgezet op de markt.', 'goed');
        Game.ui.toast('🐴 De koopman is er! Klik op 🐴 om te handelen.');
        if (Game.ui.audio && Game.ui.audio.munt) Game.ui.audio.munt();
        if (Game.ui.handelAangekomen) Game.ui.handelAangekomen(s);
      }
      return;
    }

    if (h.fase === 'markt') {
      h.timer -= dt;
      if (h.timer <= 0) {
        h.fase = 'rust';
        h.timer = rustTijd(s);
        h.aanbod = null;
        Game.ui.log.schrijf(s, '🐴 De koopman is weer verder getrokken.');
        if (Game.ui.handelVertrokken) Game.ui.handelVertrokken(s);
      }
    }
  };

  H.actief = function (s) { return s.handel && s.handel.fase === 'markt' && s.handel.aanbod; };
  H.seconden = function (s) { return s.handel ? Math.ceil(s.handel.timer) : 0; };

  /* Build a handful of deals from the current prices: a couple to offload
     surplus, a couple to buy something you are short on. */
  function genereerAanbod(s) {
    var aanbod = [];
    var verkoopKandidaten = ['hout', 'steen', 'vlees', 'graan', 'brood', 'koper', 'ijzer'];
    var koopKandidaten = ['ijzer', 'koper', 'gereedschap', 'edelsteen', 'steen'];

    /* Sell offers: things you have plenty of. */
    verkoopKandidaten
      .filter(function (r) { return s.res[r] > 60; })
      .sort(function (a, b) { return (s.res[b] / BASIS[b]) - (s.res[a] / BASIS[a]); })
      .slice(0, 2)
      .forEach(function (r) {
        var aantal = Math.round(Game.util.clamp(s.res[r] * 0.4, 30, 180));
        var munten = Math.round(aantal * H.verkoopPrijs(s, r));
        if (munten > 0) aanbod.push({ type: 'verkoop', geef: r, aantal: aantal, munten: munten });
      });

    /* Buy offers: things you are short on but will want. */
    koopKandidaten
      .filter(function (r) { return s.res[r] < s.capaciteit * 0.4; })
      .sort(function (a, b) { return s.res[a] - s.res[b]; })
      .slice(0, 2)
      .forEach(function (r) {
        var aantal = r === 'edelsteen' ? 10 : 30;
        var munten = Math.round(aantal * H.koopPrijs(s, r));
        if (munten > 0) aanbod.push({ type: 'koop', krijg: r, aantal: aantal, munten: munten });
      });

    return aanbod;
  }

  H.kanRuilen = function (s, deal) {
    if (deal.type === 'verkoop') return s.res[deal.geef] >= deal.aantal;
    return s.res.munten >= deal.munten;
  };

  /* Execute one deal. Returns true on success. Each deal can be taken once. */
  H.ruil = function (s, index) {
    if (!H.actief(s)) return false;
    var deal = s.handel.aanbod[index];
    if (!deal || deal.gedaan || !H.kanRuilen(s, deal)) return false;

    if (deal.type === 'verkoop') {
      s.res[deal.geef] -= deal.aantal;
      Game.core.state.voegToe(s, 'munten', deal.munten);
      Game.ui.log.schrijf(s, '🪙 Verkocht: ' + deal.aantal + ' ' +
        Game.config.resources[deal.geef].naam.toLowerCase() + ' voor ' + deal.munten + ' munten.', 'goed');
    } else {
      s.res.munten -= deal.munten;
      Game.core.state.voegToe(s, deal.krijg, deal.aantal);
      Game.ui.log.schrijf(s, '📦 Gekocht: ' + deal.aantal + ' ' +
        Game.config.resources[deal.krijg].naam.toLowerCase() + ' voor ' + deal.munten + ' munten.', 'goed');
    }
    deal.gedaan = true;
    if (Game.ui.audio && Game.ui.audio.munt) Game.ui.audio.munt();
    return true;
  };

  Game.core.handel = H;

})(window.Game);
