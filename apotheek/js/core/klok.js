/* De klok, en daarmee het ritme van de dag.
 *
 * Openingstijden zijn geen decor: de ochtendpiek en de vloedgolf recepten aan
 * het eind van de middag zijn waar de bezetting overheen tikt, en de deur die
 * dichtgaat is de deadline waar de werkvoorraad vóór leeg moet zijn.
 *
 * Na sluitingstijd komt er niets meer binnen maar wordt er wel doorgewerkt tot
 * de laatste zak over de toonbank is — precies zoals het echt gaat. */
(function (A) {

  var I = A.config.inst;

  A.core.klok = {

    tick: function (s, dm) {
      s.tijd += dm;
      if (s.geopend && s.tijd >= I.dagEind) {
        s.geopend = false;
        A.ui.log.schrijf(s, '🔒 De deur gaat dicht. Nog ' +
          A.core.state.onderhanden(s) + ' recepten onderhanden.');
      }
      if (!s.dagKlaar && !s.geopend && A.core.state.onderhanden(s) === 0) {
        A.core.klok.sluit(s);
      }
    },

    sluit: function (s) {
      s.dagKlaar = true;
      s.snelheid = 0;
      var af = A.core.geld.dagafsluiting(s);
      s.gisteren = {
        dag: s.dag,
        eind: s.tijd,
        boek: s.vandaag,
        loon: af.loon,
        huur: af.huur,
        saldo: af.saldo,
        bezetting: A.core.personeel.bezetting(s),
        tevredenheid: s.tevredenheid
      };
      optellen(s.totaal, s.vandaag);
      A.ui.log.schrijf(s, '🌙 Dag ' + s.dag + ' zit erop.');
    },

    /* De volgende ochtend. Recepten van gisteren zijn afgehandeld of weg, dus
       de lijst kan schoon: dat scheelt een save die eeuwig groeit. */
    nieuweDag: function (s) {
      s.dag++;
      s.tijd = I.dagStart;
      s.geopend = true;
      s.dagKlaar = false;
      s.recepten = [];
      s.vandaag = A.core.state.nieuwDagboek();
      s.meting = { werkMin: 0, loopMin: 0, klokMin: 0 };
      for (var i = 0; i < s.personeel.length; i++) {
        var p = s.personeel[i];
        p.taak = null; p.doel = null; p.bezig = 'vrij';
      }
      A.core.toeloop.plandag(s);
      A.ui.log.schrijf(s, '🌅 Dag ' + s.dag + ' — de deur gaat open.');
    }
  };

  function optellen(t, d) {
    for (var k in d) if (Object.prototype.hasOwnProperty.call(d, k)) t[k] += d[k];
  }

})(window.Apotheek);
