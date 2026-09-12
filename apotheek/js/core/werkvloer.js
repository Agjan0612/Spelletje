/* De werkvloer: welk recept wordt als volgende opgepakt, wie mag eraan werken,
 * en wat gebeurt er als een station klaar is.
 *
 * Drie regels dragen dit bestand.
 *
 * 1. Een station is door één medewerker tegelijk te gebruiken. Dat is wat de
 *    plattegrond straks laat meetellen: een tweede balie is een echte
 *    investering en geen cosmetische.
 * 2. De volgorde loopt van achteren naar voren door de kernlus. Werk dat bijna
 *    klaar is staat het dichtst bij een tevreden patiënt en bij de vergoeding,
 *    en het houdt het onderhanden werk laag. Eerst alles binnenhalen en dan pas
 *    afmaken is precies hoe een wachtkamer volloopt.
 * 3. Alleen de apotheker mag een klasse A afdoen, en voor hém gaat dat vóór
 *    alles. Er is er één, dus dat is de flessenhals van het hele spel. */
(function (A) {

  /* Fase -> het object waar dat werk gebeurt. Bewaking, opvragen en overleg
     delen één werkplek: uitzoeken kost dus niet alleen tijd maar ook de plek
     waar de volgende controle had kunnen gebeuren. */
  var STATIONS = {
    bewaking: 'bewaking',
    opvragen: 'bewaking',
    overleg: 'bewaking',
    oordeel: 'kantoor',
    gereedmaken: 'lade',
    controle: 'controle',
    uitgifte: 'balie'
  };

  /* Wie mag welk werk doen. Alleen 'oordeel' is voorbehouden; verder kan de
     apotheker gewoon meedraaien, en dat moet ook — anders staat hij stil op een
     dag zonder klasse A. */
  function magDoen(p, r) {
    if (r.fase === 'oordeel') return p.rol === 'apotheker';
    return true;
  }

  var VOLGORDE = {
    uitgifte: 1, controle: 2, gereedmaken: 3, overleg: 4, opvragen: 5, bewaking: 6
  };

  /* Lager = eerder oppakken. Zie regel 2 en 3 hierboven.
     Wie in de zaak staat te wachten gaat overal voor, niet alleen aan de balie.
     Dat is wat een apotheek ook doet — en zonder die regel sluit een wachtende
     patiënt bij elk van de vijf stations opnieuw achteraan aan, wat hem de hele
     doorlooptijd van een ophaalrecept laat uitzitten. */
  function urgentie(s, r, p) {
    if (r.fase === 'oordeel') return p.rol === 'apotheker' ? -9 : 99;
    var u = VOLGORDE[r.fase];
    if (u === undefined) return 99;
    /* Geprobeerd en verworpen: veroudering, waarbij een recept opschuift naarmate
       het langer ligt. De lange staart in de doorlooptijd is geen uithongering
       maar de drukte van het laatste uur, dus het hielp niet — en sterk genoeg
       afgesteld om wél iets te doen, liet het oude ophaalrecepten vóór wachtende
       patiënten gaan en kostte dat zeven weglopers per dag. Niet opnieuw
       invoeren zonder het te meten. */
    return r.wacht ? u - A.config.inst.wachtVoorrang : u;
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
    magDoen: magDoen,

    objectVoor: function (r) { return STATIONS[r.fase] || null; },

    /* Mag hier nú aan gewerkt worden, door deze persoon? */
    oppakbaar: function (s, r, doorWie) {
      if (r.bezig) return false;
      var obj = STATIONS[r.fase];
      if (!obj) return false;
      if (!magDoen(doorWie, r)) return false;
      /* Wie later ophaalt, staat er nog niet: uitgifte kan pas als de patiënt
         terug is. Tot die tijd ligt het klaar in het rek. */
      if (r.fase === 'uitgifte' && s.tijd < r.ophalen) return false;
      if (gereserveerd(s, obj, doorWie)) return false;
      return true;
    },

    volgende: function (s, doorWie) {
      var beste = null, besteScore = 0;
      for (var i = 0; i < s.recepten.length; i++) {
        var r = s.recepten[i];
        if (!A.core.werkvloer.oppakbaar(s, r, doorWie)) continue;
        /* Urgentie eerst, daarna wie het langst binnen is (eerlijk, en het
           drukt de langste wachttijd in plaats van het gemiddelde). */
        var score = urgentie(s, r, doorWie) * 100000 + r.binnen;
        if (!beste || score < besteScore) { beste = r; besteScore = score; }
      }
      return beste;
    },

    /* Van besluit naar de rest van de molen. Eén plek, omdat drie handelingen
       hier uitkomen en ze het niet oneens mogen worden over de volgorde. */
    naarGereedmaken: function (s, r) {
      r.fase = 'gereedmaken';
      r.rest = A.core.recept.werktijd(s, 'gereedmaken');
    },

    /* Wordt dit recept nagekeken? Beleid van de speler, en een van de weinige
       knoppen die throughput direct tegen veiligheid ruilt. */
    moetControle: function (s, r) {
      var p = s.protocol.controle;
      if (p === 'geen') return false;
      if (p === 'steekproef') return A.core.rng.kans(s, A.config.inst.steekproefDeel);
      return true;
    },

    /* Het werk aan dit station is af: schuif het recept door. Dit is de enige
       plek waar de kernlus van richting verandert. */
    rond: function (s, r) {
      var I = A.config.inst;

      if (r.fase === 'bewaking') {
        if (!r.signaal) { A.core.werkvloer.naarGereedmaken(s, r); return; }
        /* Klasse C blokkeert niet: het is informatie voor de balie, geen
           beslissing. Het kost wel tijd, en wel op de drukste plek in huis. */
        if (r.klasse === 'C') { A.core.werkvloer.naarGereedmaken(s, r); return; }
        r.fase = 'besluit';
        r.rest = 0;
        return;
      }

      if (r.fase === 'opvragen') { A.core.recept.onthul(s, r); return; }

      if (r.fase === 'overleg') {
        /* Het telefoontje is gepleegd; nu wachten op de terugbel. De assistent
           is vrij, het recept niet. Dit is de duurste stilstand in het spel en
           hij staat op geen enkele werkplek — precies zoals in het echt. */
        r.besluit = 'overleg';
        r.fase = 'antwoord';
        r.rest = 0;
        r.terug = s.tijd + A.core.rng.tussen(s, I.overlegAntwoord[0], I.overlegAntwoord[1]);
        /* Wie stond te wachten wordt naar huis gestuurd: zo lang duurt een
           terugbelverzoek nu eenmaal. Dat kost goodwill, geen klant. */
        if (r.wacht) {
          r.wacht = false;
          r.ophalen = r.terug + 10;
          s.vandaag.teruggestuurd++;
          s.tevredenheid -= I.tevredenPerTerugsturen;
          A.ui.log.schrijf(s, '🕒 ' + r.patient + ' komt straks terug — de huisarts moet nog bellen.');
        }
        return;
      }

      if (r.fase === 'oordeel') {
        /* De apotheker staat in huis. Dat is het verschil met overleggen, en
           het is precies waarom hij zijn loon waard is. */
        r.besluit = 'oordeel';
        A.core.werkvloer.naarGereedmaken(s, r);
        return;
      }

      if (r.fase === 'gereedmaken') {
        /* De verkeerde sterkte uit de la. Los van elk signaal, want zo werkt
           het ook: dit is een handfout, geen denkfout. */
        if (A.core.rng.kans(s, I.verzamelfoutKans)) {
          r.fout = true;
          r.verzamelfout = true;
        }
        if (A.core.werkvloer.moetControle(s, r)) {
          r.fase = 'controle';
          r.rest = A.core.recept.werktijd(s, 'controle');
        } else {
          gereedGemeld(s, r);
        }
        return;
      }

      if (r.fase === 'controle') {
        r.gecontroleerd = true;
        /* Het mooiste moment van het spel: de fout die niet de deur uit gaat.
           Dat moet je zien gebeuren, anders voelt de controletafel als een
           station dat alleen maar tijd kost. */
        if (r.fout && A.core.rng.kans(s, I.controleVangt)) {
          /* Terug naar het begin van de beslissing, niet even bijgeplakt. Een
             gevangen fout betekent dat het recept opnieuw door de molen moet:
             beslissen, klaarmaken, controleren, uitgeven. Dat is duur in de
             enige munt die er in dit spel toe doet — tijd — en het is de reden
             dat "alles maar doorlaten en de controle het laten vangen" geen
             strategie is maar een dure gewoonte.
             De controleur wéét nu wel wat er aan de hand was: het gegeven ligt
             op tafel, dus de tweede beslissing is een geïnformeerde. */
          r.fout = false;
          r.bijnaFout = true;
          s.vandaag.bijnaFouten++;
          if (r.verzamelfout) {
            /* Verkeerd doosje: opnieuw pakken, meer niet. */
            r.verzamelfout = false;
            r.fase = 'gereedmaken';
            r.rest = A.core.recept.werktijd(s, 'gereedmaken');
            A.ui.log.schrijf(s, '🛑 De controle ziet de verkeerde sterkte bij ' +
              r.patient + ' — opnieuw klaarmaken.');
          } else {
            /* Verkeerd oordeel: terug naar de beslissing, nu mét het gegeven.
               De controleur weet inmiddels wat er aan de hand was. */
            r.onthuld = true;
            r.besluit = null;
            r.fase = 'besluit';
            r.rest = 0;
            A.ui.log.schrijf(s, '🛑 De controle houdt het recept van ' + r.patient +
              ' tegen — dat was bijna misgegaan. Het moet opnieuw langs de beslissing.');
          }
          return;
        }
        gereedGemeld(s, r);
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
          var sig = A.config.signaal(r.signaal);
          A.ui.log.schrijf(s, '❌ ' + r.patient + ': ' + (r.verzamelfout
            ? 'de verkeerde sterkte is meegegeven.'
            : (sig ? sig.terecht : 'het signaal was terecht.')) +
            ' Dit had niet de deur uit gemogen.');
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

        /* De huisarts belt terug. Geen station, alleen een klok. */
        if (r.fase === 'antwoord' && s.tijd >= r.terug) {
          A.core.werkvloer.naarGereedmaken(s, r);
        }

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

  /* Klaar in het rek. Dit is de doorlooptijd van de apotheek zelf; wat daarna
     komt is de agenda van de patiënt. Een klasse C kost hier nog extra tijd aan
     de balie, want dat signaal ís een gesprek. */
  function gereedGemeld(s, r) {
    r.fase = 'uitgifte';
    r.rest = A.core.recept.werktijd(s, 'uitgifte');
    if (r.klasse === 'C') r.rest += A.core.recept.werktijd(s, 'begeleiding');
    r.gereed = s.tijd;
    var door = r.gereed - r.binnen;
    s.vandaag.gereedSom += door;
    s.vandaag.gereedN++;
    if (door > s.vandaag.gereedMax) s.vandaag.gereedMax = door;

    /* Boven de norm kost het tevredenheid, en wel naar rato: twee keer zo traag
       is twee keer zo erg. Een harde drempel zou van de norm een klif maken en
       precies dát is wat dit spel elders al genoeg heeft. */
    var I2 = A.config.inst;
    if (door > I2.doorloopNorm) {
      s.vandaag.buitenNorm++;
      s.tevredenheid -= I2.tevredenPerTraag * (door - I2.doorloopNorm) / I2.doorloopNorm;
    }
  }

})(window.Apotheek);
