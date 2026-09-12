/* Overlays: het welkomstscherm en het dagrapport.
 *
 * Het dagrapport is in fase 0 belangrijker dan het lijkt. Het is de plek waar
 * de speler ziet of de dag wérkte — niet alleen het saldo, maar de bezetting
 * van het personeel, want dat is het getal waar het bouwplan om draait. Boven
 * de 90 procent loopt de wachtkamer vol, onder de 60 verveelt de speler zich. */
(function (A) {

  function el(id) { return document.getElementById(id); }

  A.ui.overlay = {

    toon: function (titel, bodyHtml, acties) {
      if (typeof document === 'undefined') return;
      el('overlay-titel').textContent = titel;
      el('overlay-body').innerHTML = bodyHtml;
      var rij = el('overlay-acties');
      rij.innerHTML = '';
      for (var i = 0; i < acties.length; i++) {
        (function (a) {
          var k = A.util.el('button', 'knop' + (a.prim ? ' prim' : ''), a.naam);
          k.type = 'button';
          k.addEventListener('click', a.doe);
          rij.appendChild(k);
        })(acties[i]);
      }
      el('overlay').className = '';
    },

    sluit: function () {
      if (typeof document === 'undefined') return;
      el('overlay').className = 'verborgen';
    },

    welkom: function (start) {
      A.ui.overlay.toon('Recept tot Zorg',
        '<p class="in">Je hebt een kleine apotheek overgenomen. Twee assistenten, één ' +
        'apotheker, en vanaf acht uur stroomt het binnen.</p>' +
        '<p>Het meeste gaat vanzelf. Waar jij aan zet bent, zijn de recepten waar de ' +
        'bewaking een <b>signaal</b> op geeft — die schuiven pas door als jij kiest:</p>' +
        '<ul class="uitleg">' +
        '<li><b>Overleg met de huisarts</b> is altijd goed, maar kost een assistent zes minuten.</li>' +
        '<li><b>Akkoord</b> kost niets — tot blijkt dat het signaal terecht was.</li>' +
        '</ul>' +
        '<p>En je kunt het <b>uitzoeken</b>: een assistent haalt de nierfunctie of de ' +
        'afleverhistorie erbij, en dan weet je het. Dat kost een paar minuten en lukt ' +
        'niet altijd — maar het maakt van een gok een oordeel.</p>' +
        '<p>Een <b>klasse A</b> mag alleen de apotheker afdoen, en er is er één. ' +
        'Zodra je weet welke keuze bij welke klasse hoort, leg je hem vast in de ' +
        '<b>protocollen</b> en handel je alleen nog de uitzonderingen zelf af.</p>' +
        '<p class="klein">Spatie pauzeert · <b>1 2 3</b> versnellen · <b>Enter</b> opent het ' +
        'eerstvolgende signaal · <b>P</b> voor de protocollen.</p>',
        [{ naam: 'Open de deur', prim: true, doe: start }]);
    },

    dagrapport: function (s, verder) {
      var g = s.gisteren;
      var b = g.boek;
      var gem = b.gereedN ? b.gereedSom / b.gereedN : 0;
      var wachtGem = b.wachtN ? b.wachtSom / b.wachtN : 0;
      var bez = Math.round(g.bezetting * 100);

      var ap = g.bezettingApotheker || 0;
      var oordeel = bez > 90 ? 'Te krap — de rij liep de hele dag achter de feiten aan.'
        : ap > 0.9 ? 'De apotheker kwam om. Laat een assistent eerst uitzoeken, dan is hij sneller klaar.'
          : bez < 60 ? 'Rustig. Er is ruimte voor meer werk of minder personeel.'
            : 'Een gezonde bezetting.';
      if (b.bijnaFouten) {
        oordeel += ' De controletafel hield vandaag ' +
          A.util.telwoord(b.bijnaFouten, 'fout', 'fouten') + ' binnen.';
      }

      A.ui.overlay.toon('Dag ' + g.dag + ' — de deur is dicht',
        '<div class="rapport">' +
        rij('Afgeleverd', b.af + ' recepten') +
        rij('Binnengekomen', b.binnen) +
        rij('Weggelopen', b.weggelopen, b.weggelopen ? 'slecht' : '') +
        '<hr>' +
        rij('Signalen', b.signalen) +
        rij('Opgevraagd', b.opgevraagd + (b.opvraagMislukt ? ' (' + b.opvraagMislukt + '× niets gevonden)' : '')) +
        rij('Overlegd / doorgelaten', b.overlegd + ' / ' + b.akkoord) +
        rij('Naar de apotheker', b.beoordeeld) +
        rij('Teruggestuurd voor overleg', b.teruggestuurd) +
        rij('Door de controle gevangen', b.bijnaFouten, b.bijnaFouten ? 'goed' : '') +
        rij('De deur uit gegaan', b.fouten, b.fouten ? 'slecht' : 'goed') +
        '<hr>' +
        rij('Doorlooptijd (tot klaar)', A.util.duur(gem), gem > A.config.inst.doorloopNorm ? 'slecht' : '') +
        rij('Langste', A.util.duur(b.gereedMax)) +
        rij('Buiten de norm van ' + A.config.inst.doorloopNorm + ' min',
          b.buitenNorm + ' van ' + b.gereedN,
          b.gereedN && b.buitenNorm / b.gereedN > 0.35 ? 'slecht' : '') +
        rij('Wachttijd in de zaak', b.wachtN ? A.util.duur(wachtGem) : '—',
          wachtGem > A.config.inst.doorloopNorm ? 'slecht' : '') +
        rij('Bezetting personeel', bez + '%', bez > 90 || bez < 60 ? 'let-op' : 'goed') +
        rij('Bezetting apotheker', Math.round((g.bezettingApotheker || 0) * 100) + '%',
          (g.bezettingApotheker || 0) > 0.9 ? 'slecht' : '') +
        '<hr>' +
        rij('Omzet', A.util.euro(b.omzet)) +
        rij('Loon en huur', A.util.euro(-(g.loon + g.huur))) +
        rij('Saldo', A.util.euro(g.saldo), g.saldo < 0 ? 'slecht' : 'goed') +
        '</div>' +
        '<p class="oordeel">' + oordeel + '</p>',
        [{ naam: 'Volgende dag', prim: true, doe: verder }]);
    }
  };

  function rij(naam, waarde, klasse) {
    return '<div class="rr"><span class="nm">' + naam + '</span>' +
      '<span class="wa ' + (klasse || '') + '">' + waarde + '</span></div>';
  }

})(window.Apotheek);
