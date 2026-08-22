/* The map-layer bar: four toggles that tint the map to answer one question,
   plus a legend explaining what the colours mean. Sits bottom-left of the
   stage, above the build bar. */
(function (Game) {

  var U = {};
  var spel = null;
  var balk = null, legenda = null;

  U.init = function (s) {
    spel = s;
    balk = document.getElementById('lagenbalk');
    legenda = document.getElementById('lagen-legenda');
    if (!balk) return;

    Game.render.lagen.LAGEN.forEach(function (laag) {
      var knop = Game.util.el('button', 'laagknop');
      knop.dataset.laag = laag.id;
      knop.title = laag.naam + ' — ' + laag.uitleg;
      knop.innerHTML = '<span class="ico">' + laag.emoji + '</span><span class="lbl">' + laag.naam + '</span>';
      knop.addEventListener('click', function () { U.kies(laag.id); });
      balk.appendChild(knop);
    });
    U.ververs();
  };

  U.kies = function (id) {
    Game.render.lagen.zet(id);
    U.ververs();
  };

  /* Step through the layers with one key, ending back at "off". */
  U.volgende = function () {
    var lijst = Game.render.lagen.LAGEN;
    var nu = Game.render.lagen.actief;
    var i = -1;
    for (var k = 0; k < lijst.length; k++) if (lijst[k].id === nu) i = k;
    var volgend = (i + 1 >= lijst.length) ? null : lijst[i + 1].id;
    Game.render.lagen.actief = volgend;
    U.ververs();
  };

  U.uit = function () {
    if (!Game.render.lagen.actief) return false;
    Game.render.lagen.actief = null;
    U.ververs();
    return true;
  };

  U.ververs = function () {
    if (!balk) return;
    var actief = Game.render.lagen.actief;
    var knoppen = balk.querySelectorAll('.laagknop');
    for (var i = 0; i < knoppen.length; i++) {
      knoppen[i].classList.toggle('actief', knoppen[i].dataset.laag === actief);
    }
    if (!legenda) return;
    var laag = Game.render.lagen.laag(actief);
    legenda.classList.toggle('hidden', !laag);
    if (laag) {
      legenda.innerHTML = '<b>' + laag.emoji + ' ' + laag.naam + '</b> — ' + laag.uitleg +
        '<span class="schaal"><i class="slecht"></i><i class="matig"></i><i class="goed"></i></span>';
    }
  };

  Game.ui.lagen = U;

})(window.Game);
