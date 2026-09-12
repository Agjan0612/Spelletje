/* Het recept: één zaak die door de molen gaat.
 *
 * De fasen zijn de kernlus uit het bouwplan, één op één:
 *
 *   bewaking → (besluit → overleg) → gereedmaken → uitgifte → af
 *                                                          ↘ weg
 *
 * 'besluit' is de enige fase zonder station: daar wacht het recept op de
 * speler. Dat is met opzet de flessenhals — het is de plek waar het spel om
 * aandacht vraagt in plaats van om muisklikken. */
(function (A) {

  var I = A.config.inst;

  var ACHTERNAMEN = [
    'Bakker', 'de Vries', 'Jansen', 'van Dijk', 'Visser', 'Smit', 'Meijer',
    'de Boer', 'Mulder', 'Bos', 'Vos', 'Peters', 'Hendriks', 'van Leeuwen',
    'Dekker', 'Brouwer', 'de Wit', 'Dijkstra', 'Kok', 'van der Berg',
    'El Amrani', 'Yilmaz', 'Kowalski', 'Nguyen'
  ];
  var LETTERS = 'ABCDEFGHIJKLMNOPRSTVW';

  /* Wanneer komt iemand die later ophaalt terug? Nooit ná sluitingstijd: een
     recept dat blijft liggen tot morgen is een echte situatie, maar het maakt
     van één speeldag een boekhouding over twee dagen. Dat is fase 3, niet nu. */
  function ophaalmoment(s) {
    var vroegst = s.tijd + A.core.rng.tussen(s, I.ophalenNa[0], I.ophalenNa[1]);
    return Math.min(vroegst, I.dagEind - 25);
  }

  function werktijd(s, station) {
    var basis = I.werk[station];
    var sp = I.werkSpreiding;
    return basis * A.core.rng.tussen(s, 1 - sp, 1 + sp);
  }

  A.core.recept = {

    werktijd: werktijd,

    /* Maakt een recept op het moment dat het binnenkomt. Alles wat het nodig
       heeft wordt hier één keer getrokken, zodat de rest van de simulatie geen
       kansen meer hoeft te gooien: dat maakt een dag herhaalbaar. */
    maak: function (s) {
      var wacht = A.core.rng.kans(s, I.wachtAandeel);
      var heeftSignaal = A.core.rng.kans(s, I.signaalKans);
      var letter = LETTERS[A.core.rng.heel(s, 0, LETTERS.length - 1)];
      var naam = ACHTERNAMEN[A.core.rng.heel(s, 0, ACHTERNAMEN.length - 1)];

      var r = {
        id: 'r' + s.volgnummer,
        nr: s.volgnummer,
        patient: letter + '. ' + naam,
        leeftijd: A.core.rng.heel(s, 24, 89),
        binnen: s.tijd,
        wacht: wacht,
        ophalen: wacht ? s.tijd : ophaalmoment(s),
        fase: 'bewaking',
        rest: werktijd(s, 'bewaking'),
        bezig: false,
        signaal: heeftSignaal ? A.config.signalen[0].id : null,
        /* De verborgen waarheid. De speler kan hem in fase 0 niet zien — in
           fase 1 is dat precies wat het opvragen van gegevens gaat opleveren. */
        echt: heeftSignaal ? A.core.rng.kans(s, I.signaalEcht) : false,
        besluit: null,
        fout: false,
        klaar: null
      };
      s.volgnummer++;
      s.recepten.push(r);
      s.vandaag.binnen++;
      return r;
    },

    /* Het station dat bij de huidige fase hoort, of null als het recept nu
       niet op iemand wacht die eraan kan werken. */
    station: function (r) {
      if (r.fase === 'bewaking') return 'bewaking';
      if (r.fase === 'overleg') return 'overleg';
      if (r.fase === 'gereedmaken') return 'gereedmaken';
      if (r.fase === 'uitgifte') return 'uitgifte';
      return null;
    },

    /* Het besluit van de speler op een bewakingssignaal. Ook het harnas roept
       precies deze functie aan, zodat een headless run niet stiekem een ander
       spel meet dan de speler speelt. */
    beslis: function (s, id, keuze) {
      var r = A.core.state.recept(s, id);
      if (!r || r.fase !== 'besluit') return false;
      r.besluit = keuze;

      if (keuze === 'overleg') {
        r.fase = 'overleg';
        r.rest = werktijd(s, 'overleg');
        s.vandaag.overlegd++;
        A.ui.log.schrijf(s, '☎️ Overleg met de huisarts over ' + r.patient + '.');
      } else {
        r.fase = 'gereedmaken';
        r.rest = werktijd(s, 'gereedmaken');
        s.vandaag.akkoord++;
        /* Akkoord op een signaal dat écht was, is een fout. Die komt in fase 0
           aan de balie aan het licht — een gevolg dat pas weken later opduikt
           is het plan voor fase 1, en daar hoort een langere tijdlijn bij. */
        if (r.echt) r.fout = true;
      }
      return true;
    }
  };

})(window.Apotheek);
