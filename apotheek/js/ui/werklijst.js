/* De werkvoorraad: wat ligt er, en waar wacht het op.
 *
 * Bovenaan staat waar de speler zelf aan zet is — de recepten met een signaal.
 * Daaronder alleen een telling per fase, want de rest handelt zichzelf af en
 * hoeft geen regel per recept. Dat is dezelfde afweging als in het buurspel:
 * een paneel dat elk frame twintig knoppen opnieuw opbouwt, is een paneel dat
 * je niet kunt aanklikken. Vandaar de handtekening hieronder. */
(function (A) {

  var vorigeHandtekening = '';

  function handtekening(s) {
    var b = A.core.state.besluiten(s);
    var h = b.length + '|';
    for (var i = 0; i < b.length; i++) h += b[i].id + ',';
    var telling = { bewaking: 0, uitzoeken: 0, antwoord: 0, oordeel: 0,
      gereedmaken: 0, controle: 0, uitgifte: 0, rek: 0 };
    for (var j = 0; j < s.recepten.length; j++) {
      var r = s.recepten[j];
      if (r.fase === 'uitgifte' && s.tijd < r.ophalen) telling.rek++;
      else if (r.fase === 'opvragen' || r.fase === 'overleg') telling.uitzoeken++;
      else if (telling[r.fase] !== undefined) telling[r.fase]++;
    }
    h += '|' + telling.bewaking + '.' + telling.uitzoeken + '.' + telling.antwoord +
      '.' + telling.oordeel + '.' + telling.gereedmaken + '.' + telling.controle +
      '.' + telling.uitgifte + '.' + telling.rek;
    return { h: h, besluiten: b, telling: telling };
  }

  A.ui.werklijst = {

    ververs: function (s, forceer) {
      if (typeof document === 'undefined') return;
      var box = document.getElementById('werklijst-inhoud');
      if (!box) return;

      var hs = handtekening(s);
      if (!forceer && hs.h === vorigeHandtekening) return;
      vorigeHandtekening = hs.h;

      var tel = document.getElementById('werklijst-telling');
      if (tel) {
        tel.textContent = hs.besluiten.length;
        tel.className = 'telling' + (hs.besluiten.length ? ' wacht' : '');
      }

      box.innerHTML = '';

      if (!hs.besluiten.length) {
        box.appendChild(A.util.el('p', 'rustig',
          'Geen open besluiten. Wat je aan het protocol hebt overgelaten, loopt door.'));
      }

      for (var i = 0; i < hs.besluiten.length; i++) {
        box.appendChild(regel(s, hs.besluiten[i]));
      }

      box.appendChild(stroom(hs.telling));
    }
  };

  function regel(s, r) {
    var el = A.util.el('button', 'werkregel k' + r.klasse.toLowerCase());
    el.type = 'button';
    var wachtend = s.tijd - r.binnen;
    var krap = r.wacht && wachtend > A.config.inst.geduld * 0.6;
    var sig = A.config.signaal(r.signaal);

    el.innerHTML =
      '<span class="klasse ' + r.klasse.toLowerCase() + '">' + r.klasse + '</span>' +
      '<span class="wie"><b>' + esc(r.patient) + '</b><span class="sub">' +
      esc(sig ? sig.tekst : '') + '</span>' +
      '<span class="sub zacht">' + (r.onthuld ? 'gegeven binnen' :
        r.opvraagMislukt ? 'niets gevonden' : (r.wacht ? 'wacht in de zaak' : 'haalt later op')) +
      '</span></span>' +
      '<span class="tijd' + (krap ? ' krap' : '') + '">' + Math.round(wachtend) + '′</span>';

    el.addEventListener('click', function () { A.ui.receptkaart.toon(s, r.id); });
    return el;
  }

  function esc(t) {
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function stroom(t) {
    var el = A.util.el('div', 'stroom');
    var rijen = [
      ['Bewaking', t.bewaking],
      ['Uitzoeken', t.uitzoeken],
      ['Wacht op de huisarts', t.antwoord],
      ['Bij de apotheker', t.oordeel],
      ['Gereedmaken', t.gereedmaken],
      ['Controle', t.controle],
      ['In het rek', t.rek],
      ['Aan de balie', t.uitgifte]
    ];
    for (var i = 0; i < rijen.length; i++) {
      var r = A.util.el('div', 'stroomrij');
      r.appendChild(A.util.el('span', 'nm', rijen[i][0]));
      r.appendChild(A.util.el('span', 'n' + (rijen[i][1] ? '' : ' nul'), String(rijen[i][1])));
      el.appendChild(r);
    }
    return el;
  }

})(window.Apotheek);
