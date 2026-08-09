/* Event log in the bottom left corner, plus the big centre toast. */
(function (Game) {

  var L = {};
  var MAX_ZICHTBAAR = 6;
  var doosje = null;
  var toastEl = null;
  var toastTimer = null;

  L.init = function () {
    doosje = document.getElementById('logbox');
    toastEl = document.getElementById('toast');
  };

  L.schrijf = function (s, tekst, soort) {
    var regel = {
      tekst: tekst,
      soort: soort || '',
      seizoen: Game.core.state.SEIZOENEN[s.seizoen],
      jaar: s.jaar
    };
    s.log.push(regel);
    if (s.log.length > 60) s.log.shift();
    L.teken(s);
  };

  L.teken = function (s) {
    if (!doosje) return;
    doosje.innerHTML = '';
    var recent = s.log.slice(-MAX_ZICHTBAAR);
    for (var i = 0; i < recent.length; i++) {
      var r = recent[i];
      var el = Game.util.el('div', 'logregel ' + r.soort);
      var tijd = Game.util.el('span', 'tijd', r.seizoen + ' ' + r.jaar);
      el.appendChild(tijd);
      el.appendChild(document.createTextNode(r.tekst));
      doosje.appendChild(el);
    }
  };

  Game.ui.log = L;

  Game.ui.toast = function (tekst, ms) {
    if (!toastEl) return;
    toastEl.textContent = tekst;
    toastEl.classList.remove('hidden');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.add('hidden');
    }, ms || 2600);
  };

})(window.Game);
