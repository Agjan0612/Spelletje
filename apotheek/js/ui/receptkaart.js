/* De receptkaart — de plek waar de speler het spel speelt.
 *
 * Fase 0 toont de kleinst mogelijke versie van wat het worden moet: wie de
 * patiënt is, wat er voorgeschreven staat, welk signaal de bewaking eruit haalt
 * en de twee besluiten met hun prijs. Wat er bewust al in zit is de vorm van de
 * afweging: overleggen is altijd goed maar kost zes minuten van een assistent
 * die je niet hebt, akkoord geven is gratis maar soms verkeerd — en je kunt in
 * fase 0 niet zien welke van de twee dit is. Dat laatste is geen ontbrekende
 * functie maar het onderwerp van fase 1: gegevens opvragen is straks wat een
 * gok in een oordeel verandert. */
(function (A) {

  var open = null;

  A.ui.receptkaart = {

    toon: function (s, id) {
      if (typeof document === 'undefined') return;
      var kaart = document.getElementById('receptkaart');
      var r = A.core.state.recept(s, id);
      if (!kaart || !r) return;
      open = id;

      var sig = A.config.signaal(r.signaal);
      var wachtend = Math.round(s.tijd - r.binnen);

      kaart.className = 'kaart';
      kaart.innerHTML =
        '<div class="rk-kop"><span class="t">Recept ' + r.nr + '</span>' +
        '<span class="n">binnen ' + A.util.klok(r.binnen) + ' · wacht ' + wachtend + ' min</span></div>' +
        '<div class="rk-patient"><span class="nm">' + esc(r.patient) + '</span>' +
        '<span class="feit">' + r.leeftijd + ' jr</span>' +
        '<span class="feit">' + (r.wacht ? 'wacht in de zaak' : 'haalt later op') + '</span>' +
        '<span class="feit leeg">nierfunctie — onbekend</span></div>' +
        (sig ? blokVoorschrift(sig) + blokSignaal(sig) : '') +
        '<div class="rk-acties"></div>';

      var acties = kaart.querySelector('.rk-acties');
      var besluiten = A.config.besluiten;
      for (var i = 0; i < besluiten.length; i++) {
        (function (b) {
          var knop = A.util.el('button', 'knop' + (b.id === 'overleg' ? ' prim' : ''), b.naam);
          knop.type = 'button';
          knop.title = b.omschrijving;
          knop.addEventListener('click', function () {
            A.core.recept.beslis(s, r.id, b.id);
            A.ui.receptkaart.sluit();
            A.ui.werklijst.ververs(s, true);
          });
          acties.appendChild(knop);
        })(besluiten[i]);
      }
      var later = A.util.el('button', 'knop dof', 'Later');
      later.type = 'button';
      later.addEventListener('click', A.ui.receptkaart.sluit);
      acties.appendChild(later);
    },

    sluit: function () {
      if (typeof document === 'undefined') return;
      var kaart = document.getElementById('receptkaart');
      if (kaart) kaart.className = 'kaart verborgen';
      open = null;
    },

    /* Als het getoonde recept intussen weggelopen of afgehandeld is, moet de
       kaart weg — anders klikt de speler op een besluit dat niet meer bestaat. */
    ververs: function (s) {
      if (!open) return;
      var r = A.core.state.recept(s, open);
      if (!r || r.fase !== 'besluit') A.ui.receptkaart.sluit();
    },

    /* Het eerstvolgende open besluit, voor de sneltoets. */
    volgende: function (s) {
      var b = A.core.state.besluiten(s);
      if (b.length) A.ui.receptkaart.toon(s, b[0].id);
    }
  };

  function blokVoorschrift(sig) {
    var uit = '<div class="rk-blok"><div class="rk-label">Voorschrift</div><div class="rk-regels">' +
      '<div class="rk-regel nieuw"><span class="mid">' + esc(sig.middel) + '</span><span class="tag">nieuw</span></div>';
    for (var i = 0; i < sig.naast.length; i++) {
      uit += '<div class="rk-regel"><span class="mid">' + esc(sig.naast[i]) +
        '</span><span class="tag">in gebruik</span></div>';
    }
    return uit + '</div></div>';
  }

  function blokSignaal(sig) {
    return '<div class="rk-blok"><div class="rk-label">Signaal</div>' +
      '<div class="rk-sig"><span class="klasse a">' + sig.klasse + '</span>' +
      '<span class="tk"><b>' + esc(sig.tekst) + '</b><span>' + esc(sig.uitleg) + '</span></span></div></div>';
  }

  function esc(t) {
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

})(window.Apotheek);
