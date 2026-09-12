/* De toeloop: wanneer komen de recepten binnen.
 *
 * De aankomsttijden van een hele dag worden 's ochtends in één keer getrokken
 * en in s.komend gezet. Dat is bewust geen kansworp per tik: zo ligt de dag
 * vast zodra hij begint, wat een run herhaalbaar maakt en het harnas in staat
 * stelt twee instellingen op exact dezelfde dag te vergelijken.
 *
 * Het dagprofiel is het punt. Een vlakke stroom recepten zou het spel
 * karakterloos maken; de ochtendpiek en de vloedgolf huisartsrecepten aan het
 * eind van de middag zijn waar de bezetting overheen tikt. */
(function (A) {

  var I = A.config.inst;

  A.core.toeloop = {

    plandag: function (s) {
      var profiel = I.dagprofiel;
      var som = 0, i;
      for (i = 0; i < profiel.length; i++) som += profiel[i];

      var tijden = [];
      for (i = 0; i < profiel.length; i++) {
        var aantal = I.receptenPerDag * profiel[i] / som;
        var heel = Math.floor(aantal);
        /* De rest als kans, anders verliest elk halfuur systematisch recepten. */
        if (A.core.rng.kans(s, aantal - heel)) heel++;
        var van = I.dagStart + i * 30;
        for (var k = 0; k < heel; k++) tijden.push(A.core.rng.tussen(s, van, van + 30));
      }
      tijden.sort(function (a, b) { return a - b; });
      s.komend = tijden;
    },

    tick: function (s) {
      while (s.komend.length && s.komend[0] <= s.tijd) {
        s.komend.shift();
        A.core.recept.maak(s);
      }
    }
  };

})(window.Apotheek);
