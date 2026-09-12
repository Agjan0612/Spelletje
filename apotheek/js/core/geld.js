/* Geld. In fase 0 nog kaal: een vergoeding per afgeleverd recept, loon en huur
 * aan het eind van de dag, en de rekening van een fout.
 *
 * De vorm klopt wel al met waar het heen moet: de vergoeding per recept ligt
 * vast, dus je verdient niet door duurder te worden maar door beter te draaien.
 * Meer regels per uur, minder fouten, minder weggelopen patiënten. */
(function (A) {

  var I = A.config.inst;

  A.core.geld = {

    terhandstelling: function (s, r) {
      s.geld += I.vergoeding;
      s.vandaag.omzet += I.vergoeding;
    },

    /* Wie wegloopt neemt het recept mee naar een andere apotheek. De gemiste
       vergoeding is al verlies; dit is wat de klandizie van vandaag kost. */
    weggelopen: function (s, r) {
      s.geld -= I.weglopenKosten;
      s.vandaag.kosten += I.weglopenKosten;
    },

    fout: function (s, r) {
      s.geld -= I.foutKosten;
      s.vandaag.kosten += I.foutKosten;
    },

    /* De vaste lasten vallen in één keer als de deur dicht gaat, zodat de
       speler het effect van een dag in één cijfer ziet. */
    dagafsluiting: function (s) {
      var loon = 0;
      for (var i = 0; i < s.personeel.length; i++) {
        loon += I.loon[s.personeel[i].rol] || I.loon.assistent;
      }
      s.geld -= loon + I.huurPerDag;
      s.vandaag.kosten += loon + I.huurPerDag;
      return {
        loon: loon,
        huur: I.huurPerDag,
        saldo: s.vandaag.omzet - s.vandaag.kosten
      };
    }
  };

})(window.Apotheek);
