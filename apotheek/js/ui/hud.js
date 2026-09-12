/* De bovenbalk: zes cijfers die je altijd wilt zien.
 *
 * Regel uit het bouwplan: niets op het scherm dat altijd nul is. Vandaar geen
 * rij lege tellers maar precies de zes waar in fase 0 een beslissing aan hangt
 * — de klok, de werkvoorraad, hoeveel mensen er zitten te wachten, hoe lang een
 * recept erover doet, de tevredenheid en het saldo. */
(function (A) {

  function zet(id, waarde, klasse) {
    var el = document.getElementById(id);
    if (!el) return;
    el.querySelector('.val').textContent = waarde;
    el.className = 'meter' + (klasse ? ' ' + klasse : '');
  }

  A.ui.hud = {

    ververs: function (s) {
      if (typeof document === 'undefined') return;

      zet('m-klok', A.util.klok(s.tijd), s.geopend ? '' : 'dicht');

      var rij = A.core.state.onderhanden(s);
      zet('m-rij', rij, rij > 22 ? 'slecht' : rij > 12 ? 'let-op' : '');

      var wacht = A.core.state.wachtenden(s).length;
      zet('m-wachtend', wacht, wacht > 10 ? 'slecht' : wacht > 6 ? 'let-op' : '');

      /* De doorlooptijd van de apotheek: binnen tot klaar in het rek. Wat een
         patiënt daarna zelf aan ophaaltijd kiest, is geen prestatie van ons. */
      var gem = s.vandaag.gereedN ? s.vandaag.gereedSom / s.vandaag.gereedN : 0;
      zet('m-doorloop', gem ? A.util.duur(gem) : '—',
        gem > A.config.inst.doorloopNorm ? 'slecht' : '');

      var t = Math.round(s.tevredenheid);
      zet('m-tevreden', t + '%', t < 70 ? 'slecht' : t < 85 ? 'let-op' : '');

      zet('m-geld', A.util.euro(s.geld), s.geld < 0 ? 'slecht' : '');

      /* De apotheker apart, want die is de flessenhals. Zodra er een rij voor
         zijn deur staat, is dat het eerste wat je wilt weten. */
      var bijApotheker = 0;
      for (var i = 0; i < s.recepten.length; i++) {
        if (s.recepten[i].fase === 'oordeel') bijApotheker++;
      }
      zet('m-apotheker', bijApotheker,
        bijApotheker > 5 ? 'slecht' : bijApotheker > 2 ? 'let-op' : '');

      var f = document.getElementById('fase');
      if (f) f.textContent = 'Dag ' + s.dag;
    }
  };

})(window.Apotheek);
