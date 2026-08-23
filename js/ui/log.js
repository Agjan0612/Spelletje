/* Event log in the bottom left corner, plus the big centre toast. */
(function (Game) {

  var L = {};
  /* Four lines, not six: the log sits over the bottom-left corner of the map
     and the map is the thing you came for. Older lines are still in s.log and
     in the chronicle. */
  var MAX_ZICHTBAAR = 4;
  var doosje = null;
  var knop = null;
  var toastEl = null;
  var toastTimer = null;

  L.ingeklapt = false;

  L.init = function () {
    doosje = document.getElementById('logbox');
    toastEl = document.getElementById('toast');

    /* The log used to sit permanently over the bottom-left of the map. It can
       now be folded away to one line — the map is the thing you came for. */
    knop = document.getElementById('log-toggle');
    if (knop) {
      knop.addEventListener('click', function () {
        L.ingeklapt = !L.ingeklapt;
        knop.textContent = L.ingeklapt ? '▴' : '▾';
        knop.title = L.ingeklapt ? 'Logboek uitklappen' : 'Logboek inklappen';
        if (window.spel && window.spel.state) L.teken(window.spel.state);
      });
    }
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
    var recent = s.log.slice(-(L.ingeklapt ? 1 : MAX_ZICHTBAAR));
    for (var i = 0; i < recent.length; i++) {
      var r = recent[i];
      var el = Game.util.el('div', 'logregel ' + r.soort);
      /* Older lines fade back so your eye lands on the newest one. */
      el.style.opacity = (0.42 + 0.58 * ((i + 1) / recent.length)).toFixed(2);
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
