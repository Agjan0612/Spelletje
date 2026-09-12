/* De werkvloer: welk recept wordt als volgende opgepakt, en wat gebeurt er als
 * een station klaar is.
 *
 * Twee regels dragen dit hele bestand.
 *
 * 1. Een station is door één assistent tegelijk te gebruiken. Dat is wat de
 *    plattegrond straks laat meetellen: een tweede balie is een echte
 *    investering en geen cosmetische.
 * 2. De volgorde loopt van achteren naar voren door de kernlus. Werk dat bijna
 *    klaar is staat het dichtst bij een tevreden patiënt en bij de vergoeding,
 *    en het houdt het onderhanden werk laag. Eerst alles binnenhalen en dan pas
 *    afmaken is precies hoe een wachtkamer volloopt. */
(function (A) {

  /* Fase -> het object waar dat werk gebeurt. Bewaking en overleg delen één
     werkplek: overleggen kost dus niet alleen tijd maar ook de plek waar de
     volgende controle had kunnen gebeuren. */
  var STATIONS = {
    bewaking: 'bewaking',
    overleg: 'bewaking',
    gereedmaken: 'lade',
    uitgifte: 'balie'
  };

  /* Lager = eerder oppakken. Zie regel 2 hierboven. */
  function urgentie(s, r) {
    if (r.fase === 'uitgifte') return r.wacht ? 0 : 1;
    if (r.fase === 'gereedmaken') return 2;
    if (r.fase === 'overleg') return 3;
    return 4;                                   /* bewaking */
  }

  function gereserveerd(s, objectId, behalve) {
    for (var i = 0; i < s.personeel.length; i++) {
      var p = s.personeel[i];
      if (p === behalve) continue;
      if (p.taak && p.taak.object === objectId) return true;
    }
    return false;
  }

  A.core.werkvloer = {

    STATIONS: STATIONS,
    gereserveerd: gereserveerd,

    objectVoor: function (r) {
      var st = A.core.recept.station(r);
      return st ? STATIONS[r.fase] : null;
    },

    /* Mag hier nú aan gewerkt worden? */
    oppakbaar: function (s, r, doorWie) {
      if (r.bezig) return false;
      var obj = A.core.werkvloer.objectVoor(r);
      if (!obj) return false;
      /* Wie later ophaalt, staat er nog niet: uitgifte kan pas als de patiënt
         terug is. Tot die tijd ligt het klaar in het rek. */
      if (r.fase === 'uitgifte' && s.tijd < r.ophalen) return false;
      if (gereserveerd(s, obj, doorWie)) return false;
      return true;
    },

    /* Het meest urgente oppakbare recept, of null. */
    volgende: function (s, doorWie) {
      var beste = null, besteScore = 0;
      for (var i = 0; i < s.recepten.length; i++) {
        var r = s.recepten[i];
        if (!A.core.werkvloer.oppakbaar(s, r, doorWie)) continue;
        /* Urgentie eerst, daarna wie het langst binnen is (eerlijk, en het
           drukt de langste wachttijd in plaats van het gemiddelde). */
        var score = urgentie(s, r) * 100000 + r.binnen;
        if (!beste || score < besteScore) { beste = r; besteScore = score; }
      }
      return beste;
    },

    /* Het werk aan dit station is af: schuif het recept door naar de volgende
       fase. Dit is de enige plek waar de kernlus van richting verandert. */
    rond: function (s, r) {
      var I = A.config.inst;

      if (r.fase === 'bewaking') {
        if (r.signaal) {
          /* Hier stopt de machine en begint het spel. */
          r.fase = 'besluit';
          r.rest = 0;
          A.ui.log.schrijf(s, '⚠️ Signaal bij ' + r.patient + ' — recept ' + r.nr + ' wacht op een besluit.');
        } else {
          r.fase = 'gereedmaken';
          r.rest = A.core.recept.werktijd(s, 'gereedmaken');
        }
        return;
      }

      if (r.fase === 'overleg') {
        r.fase = 'gereedmaken';
        r.rest = A.core.recept.werktijd(s, 'gereedmaken');
        return;
      }

      if (r.fase === 'gereedmaken') {
        r.fase = 'uitgifte';
        r.rest = A.core.recept.werktijd(s, 'uitgifte');
        /* Klaar in het rek. Dit is de doorlooptijd van de apotheek zelf; wat
           daarna komt is de agenda van de patiënt. */
        r.gereed = s.tijd;
        var door = r.gereed - r.binnen;
        s.vandaag.gereedSom += door;
        s.vandaag.gereedN++;
        if (door > s.vandaag.gereedMax) s.vandaag.gereedMax = door;
        return;
      }

      if (r.fase === 'uitgifte') {
        r.fase = 'af';
        r.klaar = s.tijd;
        s.vandaag.af++;
        var doorloop = r.klaar - r.binnen;
        if (r.wacht) {
          s.vandaag.wachtSom += doorloop;
          s.vandaag.wachtN++;
          if (doorloop > s.vandaag.wachtMax) s.vandaag.wachtMax = doorloop;
        }

        A.core.geld.terhandstelling(s, r);

        if (r.fout) {
          s.vandaag.fouten++;
          A.core.geld.fout(s, r);
          s.tevredenheid -= I.tevredenPerFout;
          A.ui.log.schrijf(s, '❌ Aan de balie blijkt het signaal bij ' + r.patient +
            ' terecht: het recept moet terug naar de huisarts.');
        } else if (r.wacht && doorloop > I.doorloopNorm) {
          s.tevredenheid -= I.tevredenPerTraag;
        }
        return;
      }
    },

    /* Wachtende patiënten die het opgeven. Alleen wie nog niet aan de balie
       geholpen wordt: iemand wegsturen terwijl de assistent er al mee bezig is
       zou oneerlijk zijn én zou de speler een moment ontnemen dat hij verdiend
       heeft. */
    tick: function (s, dm) {
      var I = A.config.inst;
      for (var i = 0; i < s.recepten.length; i++) {
        var r = s.recepten[i];
        if (!r.wacht || r.fase === 'af' || r.fase === 'weg') continue;
        if (r.bezig && r.fase === 'uitgifte') continue;
        if (s.tijd - r.binnen > I.geduld) {
          r.fase = 'weg';
          r.bezig = false;
          s.vandaag.weggelopen++;
          s.tevredenheid -= I.tevredenPerWeggelopen;
          A.core.geld.weggelopen(s, r);
          A.ui.log.schrijf(s, '🚪 ' + r.patient + ' is na ' +
            A.util.duur(I.geduld) + ' wachten weggelopen.');
        }
      }
      /* Tevredenheid kruipt terug omhoog als het goed gaat, zodat een slechte
         ochtend geen doodvonnis is. */
      s.tevredenheid = A.util.clamp(
        s.tevredenheid + (100 - s.tevredenheid) * I.tevredenHerstel * dm, 0, 100);
    }
  };

})(window.Apotheek);
