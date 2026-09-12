/* Het beleidspaneel: waar de speler ophoudt met klikken en begint met besturen.
 *
 * Drie keuzes, meer niet. Ze staan er niet om compleet te zijn maar omdat ze
 * alle drie iets kosten: elke stand ruilt doorlooptijd tegen zekerheid, en er is
 * geen stand die op alle dagen de beste is. Een paneel met een duidelijk beste
 * antwoord had net zo goed een vinkje kunnen zijn. */
(function (A) {

  var zichtbaar = false;

  A.ui.beleid = {

    wissel: function (s) {
      zichtbaar = !zichtbaar;
      A.ui.beleid.ververs(s, true);
    },

    ververs: function (s, forceer) {
      if (typeof document === 'undefined') return;
      var doos = document.getElementById('beleid');
      if (!doos) return;
      doos.className = 'kaart' + (zichtbaar ? '' : ' verborgen');
      var knop = document.getElementById('btn-beleid');
      if (knop) knop.classList.toggle('actief', zichtbaar);
      if (!zichtbaar || !forceer) return;

      doos.innerHTML = '<h3>Protocollen</h3><div class="bl-inhoud"></div>';
      var in_ = doos.querySelector('.bl-inhoud');
      in_.appendChild(groep(s, 'A', 'Klasse A — harde stop',
        'Alleen de apotheker mag deze afdoen. Er is er één, dus alles wat je hem bespaart telt.'));
      in_.appendChild(groep(s, 'B', 'Klasse B — overleg gewenst',
        'Hier ligt de echte keuze. Uitzoeken kost een assistent een paar minuten en scheelt de rest.'));
      in_.appendChild(groep(s, 'controle', 'De controletafel',
        'Het tweede paar ogen vangt de meeste fouten, en kost per recept ruim een minuut.'));
    }
  };

  function groep(s, sleutel, titel, uitleg) {
    var el = A.util.el('div', 'bl-groep');
    el.appendChild(A.util.el('div', 'bl-titel', titel));
    el.appendChild(A.util.el('p', 'bl-uitleg', uitleg));

    var keuzes = A.config.protocolKeuzes[sleutel];
    var rij = A.util.el('div', 'bl-keuzes');
    for (var i = 0; i < keuzes.length; i++) {
      (function (k) {
        var knop = A.util.el('button', 'bl-knop' + (s.protocol[sleutel] === k.id ? ' aan' : ''));
        knop.type = 'button';
        knop.innerHTML = '<b>' + k.naam + '</b><span>' + k.uitleg + '</span>';
        knop.addEventListener('click', function () {
          s.protocol[sleutel] = k.id;
          A.ui.beleid.ververs(s, true);
          A.ui.log.schrijf(s, '📋 Protocol ' +
            (sleutel === 'controle' ? 'controle' : 'klasse ' + sleutel) + ': ' + k.naam.toLowerCase() + '.');
        });
        rij.appendChild(knop);
      })(keuzes[i]);
    }
    el.appendChild(rij);
    return el;
  }

})(window.Apotheek);
