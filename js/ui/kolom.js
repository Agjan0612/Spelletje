/* The right-hand column: three cards that became three tabs.
 *
 * Tijdperk, Doelen and Stadszaken used to stand under each other in a
 * scrolling column. On a normal screen the third one was always half out of
 * view, and the column grew a fade-out mask to admit it. Only one of the
 * three is ever urgent at a time, so this shows one at a time and puts a dot
 * on the tab that wants attention:
 *
 *   ⚑ Tijdperk  gold  — everything for the next age is in place
 *   🎯 Doelen    gold  — an objective was just completed
 *   🏛️ Stad     red   — something is stuck; gold — a merchant, contract or
 *                       neighbour is waiting for an answer
 *
 * The dot is what keeps this from hiding things: you never have to click
 * through the tabs to find out whether there is news behind them.
 */
(function (Game) {

  var K = {};
  var spel = null;
  var tabs = null;
  var panes = {};
  K.actief = 'agebox';

  K.init = function (hetSpel) {
    spel = hetSpel;
    tabs = document.getElementById('col-tabs');
    if (!tabs) return;

    Array.prototype.forEach.call(tabs.children, function (knop) {
      var id = knop.dataset.pane;
      panes[id] = document.getElementById(id);
      knop.addEventListener('click', function () { K.toon(id); });
    });

    K.toon(K.actief);
  };

  K.toon = function (id) {
    if (!panes[id]) return;
    K.actief = id;
    for (var p in panes) panes[p].classList.toggle('hidden', p !== id);
    Array.prototype.forEach.call(tabs.children, function (knop) {
      knop.classList.toggle('active', knop.dataset.pane === id);
    });
    if (spel && spel.state) {
      /* The pane was hidden while the town moved on, so let it catch up
         before it is shown rather than a fifth of a second later. */
      if (id === 'stadbox') Game.ui.stad.ververs(spel.state, true);
      if (id !== 'stadbox') Game.ui.quests.ververs(spel.state);
      K.ververs(spel.state);
    }
  };

  /* Step through the tabs — bound to Tab-free key 'c' in main.js. */
  K.volgende = function () {
    var ids = Object.keys(panes);
    var i = ids.indexOf(K.actief);
    K.toon(ids[(i + 1) % ids.length]);
  };

  K.ververs = function (s) {
    if (!tabs || !s) return;

    var aandacht = {
      agebox: Game.core.ages.kanBevorderen(s) ? 'goud' : '',
      questbox: '',
      stadbox: stadAandacht(s)
    };

    Array.prototype.forEach.call(tabs.children, function (knop) {
      var soort = aandacht[knop.dataset.pane] || '';
      var stip = knop.querySelector('.stip');
      if (!stip) return;
      /* No dot on the tab you are already looking at: you can see it. */
      var toon = soort && knop.dataset.pane !== K.actief;
      stip.classList.toggle('hidden', !toon);
      stip.className = 'stip' + (toon ? ' ' + soort : ' hidden');
    });
  };

  function stadAandacht(s) {
    var probl = Game.ui.stad.problemen(s);
    for (var i = 0; i < probl.length; i++) if (probl[i].ernst >= 3) return 'rood';

    if (s.handel && s.handel.fase === 'aanwezig') return 'goud';
    if (s.opdracht && s.opdracht.actief && Game.core.opdrachten.kanLeveren(s)) return 'goud';
    for (var j = 0; j < (s.buren || []).length; j++) if (s.buren[j].verzoek) return 'goud';
    return probl.length ? 'goud' : '';
  }

  Game.ui.kolom = K;

})(window.Game);
