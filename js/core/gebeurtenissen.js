/* The event ticker: every few minutes something happens in the village.
 *
 * The event itself lives in js/config/gebeurtenissen.js as data; this module
 * only decides *when* one fires, remembers which one is waiting for an answer
 * (as plain JSON, so it survives a save) and applies the chosen option.
 *
 * Nothing fires while the bandits are on their way — one crisis at a time. */
(function (Game) {

  var G = {};

  G.RUST = [230, 380];        /* seconds between events */

  G.tick = function (s, dt) {
    if (s.tijdperk < 2) return;
    var g = s.gebeurtenis;
    if (!g || g.actief) return;                       /* waiting for an answer */
    if (s.raid && s.raid.fase === 'waarschuwing') return;

    g.timer -= dt;
    if (g.timer > 0) return;
    g.timer = volgendeRust();

    var ev = kies(s);
    if (ev) G.start(s, ev);
  };

  function volgendeRust() {
    return G.RUST[0] + Math.random() * (G.RUST[1] - G.RUST[0]);
  }
  G.volgendeRust = volgendeRust;

  G.def = function (id) {
    var lijst = Game.config.gebeurtenissen;
    for (var i = 0; i < lijst.length; i++) if (lijst[i].id === id) return lijst[i];
    return null;
  };

  /* Weighted draw over everything that fits the current state, skipping the
     one that fired last so the same story never repeats back to back. */
  function kies(s) {
    var mogelijk = Game.config.gebeurtenissen.filter(function (ev) {
      if (ev.tijdperk > s.tijdperk) return false;
      if (ev.id === s.gebeurtenis.laatste) return false;
      if (ev.mogelijk && !ev.mogelijk(s)) return false;
      return true;
    });
    if (!mogelijk.length) return null;

    var totaal = 0;
    mogelijk.forEach(function (ev) { totaal += ev.gewicht || 1; });
    var trek = Math.random() * totaal;
    for (var i = 0; i < mogelijk.length; i++) {
      trek -= (mogelijk[i].gewicht || 1);
      if (trek <= 0) return mogelijk[i];
    }
    return mogelijk[mogelijk.length - 1];
  }

  G.start = function (s, ev) {
    var ctx = ev.maakCtx ? ev.maakCtx(s) : {};
    if (ctx === null) return;                        /* context fell through */

    s.gebeurtenis.actief = ev.id;
    s.gebeurtenis.ctx = ctx || {};
    s.gebeurtenis.laatste = ev.id;

    if (Game.ui.stad && Game.ui.stad.toonGebeurtenis) {
      Game.ui.stad.toonGebeurtenis(s);
    } else {
      /* No UI (headless test run): take the first option that is affordable. */
      G.kies(s, eersteBetaalbaar(s, ev));
    }
  };

  function eersteBetaalbaar(s, ev) {
    for (var i = 0; i < ev.opties.length; i++) {
      if (G.kanKiezen(s, ev.opties[i])) return i;
    }
    return ev.opties.length - 1;
  }

  G.kanKiezen = function (s, optie) {
    return !optie.kosten || Game.core.state.kanBetalen(s, optie.kosten);
  };

  /* Applies one option: pay, run its effect, log the outcome and close. */
  G.kies = function (s, index) {
    var ev = G.def(s.gebeurtenis.actief);
    if (!ev) { sluit(s); return false; }

    var optie = ev.opties[index];
    if (!optie || !G.kanKiezen(s, optie)) return false;

    if (optie.kosten) Game.core.state.betaal(s, optie.kosten);
    var tekst = optie.doe(s, s.gebeurtenis.ctx || {});

    s.gebeurtenis.gedaan++;
    sluit(s);

    if (tekst) Game.ui.log.schrijf(s, tekst, optie.soort || '');
    Game.core.state.herbereken(s);
    return true;
  };

  function sluit(s) {
    s.gebeurtenis.actief = null;
    s.gebeurtenis.ctx = null;
  }

  Game.core.gebeurtenissen = G;

})(window.Game);
