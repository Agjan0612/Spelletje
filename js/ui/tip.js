/* One tooltip for the whole interface.
 *
 * The HUD used to explain itself through `title` attributes with newlines in
 * them: the browser waits a second, then renders grey system text that cannot
 * be styled and disappears the moment the mouse moves. The happiness
 * breakdown — arguably the most useful number in the game — was hidden behind
 * exactly that.
 *
 * This is the same box the build menu already drew for its cards, lifted out
 * so anything can use it. `Game.ui.tip.hang(el, fn)` attaches one to an
 * element; `fn` returns the HTML at the moment the mouse arrives, so a
 * tooltip is always about the town as it is now rather than as it was when
 * the element was built.
 */
(function (Game) {

  var T = {};
  var el = null;
  var anker = null;

  T.toon = function (bijEl, html) {
    T.verberg();
    if (!html) return;
    el = Game.util.el('div', 'tip');
    el.innerHTML = html;
    document.body.appendChild(el);
    anker = bijEl;
    plaats();
  };

  function plaats() {
    if (!el || !anker) return;
    var r = anker.getBoundingClientRect();
    var b = el.getBoundingClientRect();
    var links = Game.util.clamp(r.left + r.width / 2 - b.width / 2, 8, window.innerWidth - b.width - 8);
    /* Above the element by default, below it when there is no room — the top
       bar and the build bar sit on opposite edges of the screen. */
    var boven = r.top - b.height - 8;
    el.style.left = links + 'px';
    el.style.top = (boven < 8 ? r.bottom + 8 : boven) + 'px';
  }

  T.verberg = function () {
    if (el && el.parentNode) el.parentNode.removeChild(el);
    el = null;
    anker = null;
  };

  /* Attach a live tooltip: `fn()` is asked for its HTML on every hover. */
  T.hang = function (doel, fn) {
    if (!doel) return;
    doel.addEventListener('mouseenter', function () { T.toon(doel, fn()); });
    doel.addEventListener('mouseleave', T.verberg);
    /* Keyboard users get it too, which is why the stat chips are focusable. */
    doel.addEventListener('focus', function () { T.toon(doel, fn()); });
    doel.addEventListener('blur', T.verberg);
  };

  /* Building blocks, so every tooltip in the game reads the same way. */
  T.kop = function (tekst) { return '<h4>' + tekst + '</h4>'; };
  T.regel = function (label, waarde) {
    return '<div class="rij"><span class="label">' + label + ':</span> ' + waarde + '</div>';
  };
  T.cursief = function (tekst) { return '<div class="cursief">' + tekst + '</div>'; };

  Game.ui.tip = T;

})(window.Game);
