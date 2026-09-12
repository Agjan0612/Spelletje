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
    var telling = { bewaking: 0, overleg: 0, gereedmaken: 0, uitgifte: 0, rek: 0 };
    for (var j = 0; j < s.recepten.length; j++) {
      var r = s.recepten[j];
      if (r.fase === 'uitgifte' && s.tijd < r.ophalen) telling.rek++;
      else if (telling[r.fase] !== undefined) telling[r.fase]++;
    }
    h += '|' + telling.bewaking + '.' + telling.overleg + '.' + telling.gereedmaken +
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
        var rust = A.util.el('p', 'rustig', 'Geen signalen open. De molen draait.');
        box.appendChild(rust);
      }

      for (var i = 0; i < hs.besluiten.length; i++) {
        box.appendChild(regel(s, hs.besluiten[i]));
      }

      box.appendChild(stroom(hs.telling));
    }
  };

  function regel(s, r) {
    var el = A.util.el('button', 'werkregel');
    el.type = 'button';
    var wachtend = s.tijd - r.binnen;
    var krap = r.wacht && wachtend > A.config.inst.geduld * 0.6;

    el.innerHTML =
      '<span class="klasse a">A</span>' +
      '<span class="wie"><b>' + r.patient + '</b><span class="sub">recept ' + r.nr +
      ' · ' + (r.wacht ? 'wacht in de zaak' : 'haalt later op') + '</span></span>' +
      '<span class="tijd' + (krap ? ' krap' : '') + '">' + Math.round(wachtend) + '′</span>';

    el.addEventListener('click', function () { A.ui.receptkaart.toon(s, r.id); });
    return el;
  }

  function stroom(t) {
    var el = A.util.el('div', 'stroom');
    var rijen = [
      ['Bewaking', t.bewaking],
      ['Overleg', t.overleg],
      ['Gereedmaken', t.gereedmaken],
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
