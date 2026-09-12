/* Het recept: één zaak die door de molen gaat.
 *
 * De fasen zijn de kernlus uit het bouwplan:
 *
 *   bewaking → [besluit ⇄ opvragen] → overleg | oordeel → gereedmaken
 *            → controle → uitgifte → af                        ↘ weg
 *
 * 'besluit' is de enige fase zonder station: daar wacht het recept op de speler
 * of op zijn protocol. Dat is met opzet de flessenhals — het is de plek waar het
 * spel om aandacht vraagt in plaats van om muisklikken.
 *
 * Het dubbele pijltje naar 'opvragen' is waar fase 1 om draait. Een signaal is
 * pas een oordeel als je weet wat er onder ligt; tot die tijd is het een gok.
 * Opvragen kost tijd, lukt niet altijd, en verandert daarna wél alles. */
(function (A) {

  var I = A.config.inst;

  var ACHTERNAMEN = [
    'Bakker', 'de Vries', 'Jansen', 'van Dijk', 'Visser', 'Smit', 'Meijer',
    'de Boer', 'Mulder', 'Bos', 'Vos', 'Peters', 'Hendriks', 'van Leeuwen',
    'Dekker', 'Brouwer', 'de Wit', 'Dijkstra', 'Kok', 'van den Berg',
    'El Amrani', 'Yilmaz', 'Kowalski', 'Nguyen', 'Öztürk', 'Fernandes'
  ];
  var LETTERS = 'ABCDEFGHIJKLMNOPRSTVW';

  function werktijd(s, sleutel) {
    var basis = I.werk[sleutel];
    var sp = I.werkSpreiding;
    return basis * A.core.rng.tussen(s, 1 - sp, 1 + sp);
  }

  /* Wanneer komt iemand die later ophaalt terug? Nooit ná sluitingstijd: een
     recept dat blijft liggen tot morgen is een echte situatie, maar het maakt
     van één speeldag een boekhouding over twee dagen. Dat is fase 3, niet nu. */
  function ophaalmoment(s) {
    var vroegst = s.tijd + A.core.rng.tussen(s, I.ophalenNa[0], I.ophalenNa[1]);
    var laatst = I.dagEind - 20;
    if (vroegst <= laatst) return vroegst;
    /* Wie anders ná sluitingstijd terug zou komen, spreiden we over het laatste
       uur in plaats van ze allemaal op hetzelfde moment terug te laten komen.
       Dat afkappen op één tijdstip bouwde een piek die er niet hoort te zijn en
       liet de dag pas om zeven uur leeglopen. */
    return Math.max(s.tijd + 15, A.core.rng.tussen(s, I.dagEind - 95, laatst));
  }

  function kiesKlasse(s) {
    var v = I.klasseVerdeling;
    var r = A.core.rng.trek(s);
    if (r < v.A) return 'A';
    if (r < v.A + v.B) return 'B';
    return 'C';
  }

  /* Wat je te zien krijgt als het gegeven boven water komt. De waarde ís het
     antwoord — dat is het verschil met een spel waarin een knop "goed" of "fout"
     zegt: hier lees je een nierfunctie en trek je zelf de conclusie. */
  function gegeven(s, soort, echt) {
    if (soort === 'nierfunctie') {
      var e = echt ? A.core.rng.heel(s, 28, 48) : A.core.rng.heel(s, 62, 96);
      return { kort: 'eGFR ' + e, lang: 'Nierfunctie: eGFR ' + e + ' ml/min' };
    }
    if (soort === 'allergie') {
      return echt
        ? { kort: 'echte allergie', lang: 'Allergie bevestigd: uitslag en benauwdheid, gemeld door de huisarts.' }
        : { kort: 'geen allergie', lang: 'De melding blijkt maagklachten te zijn geweest — geen allergie.' };
    }
    return echt
      ? { kort: 'gebruikt door', lang: 'Afleverhistorie: haalt dit middel elke maand op, laatste keer vier weken geleden.' }
      : { kort: 'gestopt', lang: 'Afleverhistorie: laatste aflevering ruim acht maanden geleden.' };
  }

  A.core.recept = {

    werktijd: werktijd,

    /* Maakt een recept op het moment dat het binnenkomt. Alles wat het nodig
       heeft wordt hier één keer getrokken, zodat de rest van de simulatie geen
       kansen meer hoeft te gooien: dat maakt een dag herhaalbaar. */
    maak: function (s) {
      var wacht = A.core.rng.kans(s, I.wachtAandeel);
      var letter = LETTERS[A.core.rng.heel(s, 0, LETTERS.length - 1)];
      var naam = ACHTERNAMEN[A.core.rng.heel(s, 0, ACHTERNAMEN.length - 1)];

      var sig = null, echt = false;
      if (A.core.rng.kans(s, I.signaalKans)) {
        var lijst = A.config.signalenVanKlasse(kiesKlasse(s));
        sig = lijst[A.core.rng.heel(s, 0, lijst.length - 1)];
        echt = A.core.rng.kans(s, sig.echtKans);
      }

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

        signaal: sig ? sig.id : null,
        klasse: sig ? sig.klasse : null,
        /* De verborgen waarheid. Opvragen is de enige manier om hem te zien —
           en dat is precies wat een gok in een oordeel verandert. */
        echt: echt,
        onthuld: false,
        opvraagMislukt: false,
        gegeven: sig && sig.vraagt ? gegeven(s, sig.vraagt, echt) : null,

        besluit: null,
        fout: false,
        verzamelfout: false,
        bijnaFout: false,
        gecontroleerd: false,
        gereed: null,
        klaar: null
      };
      s.volgnummer++;
      s.recepten.push(r);
      s.vandaag.binnen++;
      if (sig) s.vandaag.signalen++;
      return r;
    },

    /* Welke handelingen zijn hier nú mogelijk. De receptkaart tekent hier zijn
       knoppen mee en het protocol kiest er één uit — dus geen tweede lijst. */
    mogelijk: function (s, r) {
      var sig = A.config.signaal(r.signaal);
      if (!sig) return [];
      var uit = [];
      var toegestaan = A.config.toegestaan[sig.klasse] || [];
      for (var i = 0; i < toegestaan.length; i++) {
        var id = toegestaan[i];
        if (id === 'opvragen' && (!sig.vraagt || r.onthuld || r.opvraagMislukt)) continue;
        uit.push(A.config.actie(id));
      }
      return uit;
    },

    /* De handeling van de speler (of van zijn protocol). Ook het harnas roept
       precies deze functie aan, zodat een headless run niet stiekem een ander
       spel meet dan de speler speelt. */
    doe: function (s, id, actieId) {
      var r = A.core.state.recept(s, id);
      if (!r || r.fase !== 'besluit') return false;
      var sig = A.config.signaal(r.signaal);
      if (!sig) return false;

      var toegestaan = A.config.toegestaan[sig.klasse] || [];
      if (toegestaan.indexOf(actieId) < 0) return false;

      if (actieId === 'opvragen') {
        r.fase = 'opvragen';
        r.rest = werktijd(s, 'opvragen');
        return true;
      }
      if (actieId === 'overleg') {
        r.fase = 'overleg';
        r.rest = werktijd(s, 'overleg');
        s.vandaag.overlegd++;
        return true;
      }
      if (actieId === 'apotheker') {
        r.fase = 'oordeel';
        /* Met het gegeven er al bij is de apotheker in een derde van de tijd
           klaar. Dat is de hele reden om een assistent eerst te laten uitzoeken:
           je ruilt goedkope tijd tegen de duurste tijd in huis. */
        r.rest = werktijd(s, r.onthuld ? 'oordeelKort' : 'oordeel');
        s.vandaag.beoordeeld++;
        return true;
      }
      if (actieId === 'akkoord') {
        r.besluit = 'akkoord';
        s.vandaag.akkoord++;
        /* Akkoord op een signaal dat écht was, is een fout. Of die de deur uit
           gaat hangt af van de controletafel. */
        if (r.echt && sig.klasse !== 'C') r.fout = true;
        A.core.werkvloer.naarGereedmaken(s, r);
        return true;
      }
      return false;
    },

    /* Het gegeven is opgehaald — of niet. Dat tweede is geen pech maar het
       tegenwicht: zonder de kans dat je met lege handen terugkomt zou opvragen
       altijd het beste antwoord zijn en was er weer niets te kiezen. */
    onthul: function (s, r) {
      if (A.core.rng.kans(s, I.opvraagKans)) {
        r.onthuld = true;
        s.vandaag.opgevraagd++;
        A.ui.log.schrijf(s, '🔎 ' + r.patient + ': ' + (r.gegeven ? r.gegeven.kort : 'gegeven binnen') + '.');
      } else {
        r.opvraagMislukt = true;
        s.vandaag.opvraagMislukt++;
        A.ui.log.schrijf(s, '🔎 Geen gegeven gevonden voor ' + r.patient + '.');
      }
      r.fase = 'besluit';
      r.rest = 0;
    }
  };

})(window.Apotheek);
