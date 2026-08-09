/* Global namespace. Every file attaches its parts to `window.Game`.
   Classic scripts (no ES modules) keep the game runnable straight from file://. */
window.Game = window.Game || {
  config: {},
  core: {},
  render: {},
  ui: {},
  state: null
};

/* Small shared helpers. */
Game.util = {
  clamp: function (v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); },

  /* Formats a number for the HUD: 1234 -> "1,2k". */
  fmt: function (n) {
    if (n >= 100000) return Math.round(n / 1000) + 'k';
    if (n >= 10000) return (n / 1000).toFixed(1).replace('.', ',') + 'k';
    if (n >= 1000) return (n / 1000).toFixed(2).replace('.', ',') + 'k';
    if (n >= 100) return String(Math.floor(n));
    return (Math.round(n * 10) / 10).toString().replace('.', ',');
  },

  /* Dutch plural helper: "1 huis" / "3 huizen". */
  telwoord: function (n, enkel, meer) { return n + ' ' + (n === 1 ? enkel : meer); },

  el: function (tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
};
