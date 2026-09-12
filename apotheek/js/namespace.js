/* Global namespace. Every file hangs its parts on window.Apotheek.
   Classic IIFE modules, no ES modules in the game code itself: the same trick
   the neighbouring game uses, and it keeps the headless harness trivial. */
window.Apotheek = window.Apotheek || {
  config: {},
  core: {},
  render: {},
  ui: {},
  state: null
};

Apotheek.util = {
  clamp: function (v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); },

  /* Minutes since midnight -> "08:35". The whole game runs on this one clock. */
  klok: function (min) {
    var m = Math.floor(min) % 1440;
    var u = Math.floor(m / 60), r = m % 60;
    return (u < 10 ? '0' : '') + u + ':' + (r < 10 ? '0' : '') + r;
  },

  /* A duration in minutes -> "6 min" / "1 u 12". */
  duur: function (min) {
    if (min < 60) return Math.round(min) + ' min';
    var u = Math.floor(min / 60);
    return u + ' u ' + Math.round(min % 60);
  },

  /* "1 fout" / "3 fouten" */
  telwoord: function (n, enkel, meer) { return n + ' ' + (n === 1 ? enkel : meer); },

  euro: function (n) {
    var neg = n < 0;
    var v = Math.abs(n).toFixed(2).replace('.', ',');
    return (neg ? '−' : '') + '€ ' + v;
  },

  el: function (tag, cls, tekst) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (tekst !== undefined) e.textContent = tekst;
    return e;
  }
};
