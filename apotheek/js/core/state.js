/* De speltoestand: één platte, serialiseerbare boom.
 *
 * Regel uit het buurspel die hier onverkort geldt: nooit iets in de toestand
 * dat JSON niet overleeft. Geen functies, geen Infinity, geen verwijzingen naar
 * DOM of naar elkaar — recepten en personeel verwijzen met een id, niet met een
 * object. De tekenlaag houdt zijn eigen spullen bij en staat hier niet in. */
(function (A) {

  var I = A.config.inst;

  A.core.state = {

    nieuw: function (zaad, naam) {
      var s = {
        zaad: (zaad >>> 0) || 1,
        rngS: (zaad >>> 0) || 1,
        naam: naam || 'Apotheek De Waag',

        tijd: I.dagStart,
        dag: 1,
        geopend: true,
        snelheid: 1,
        accu: 0,

        pand: A.core.pand.nieuw(),
        objecten: [],
        personeel: [],
        recepten: [],
        komend: [],            /* aankomsttijden van vandaag die nog moeten vallen */

        volgnummer: 1,
        geld: 2500,
        tevredenheid: I.tevredenStart,

        protocol: A.core.protocollen.nieuw(),

        vandaag: leegDagboek(),
        gisteren: null,
        totaal: leegDagboek(),

        /* Bezetting van het personeel over de dag, om de wachtrijklif uit het
           bouwplan te kunnen meten in plaats van hem te moeten raden. */
        meting: leegMeting(),

        log: [],
        dagKlaar: false
      };

      for (var i = 0; i < A.core.pand.OPSTELLING.length; i++) {
        var o = A.core.pand.OPSTELLING[i];
        s.objecten.push({ object: o.object, x: o.x, y: o.y, sta: { x: o.sta.x, y: o.sta.y } });
      }

      /* Twee assistenten en één apotheker. De apotheker draait gewoon mee in
         het werk — hij is alleen de enige die een klasse A mag afdoen, en dat
         maakt hem de flessenhals zonder hem stil te zetten. */
      var bemanning = [
        { naam: 'Fatima', rol: 'assistent', bij: 'bewaking' },
        { naam: 'Joost', rol: 'assistent', bij: 'lade' },
        { naam: 'Ineke', rol: 'apotheker', bij: 'kantoor' }
      ];
      for (var p = 0; p < bemanning.length; p++) {
        var start = A.core.pand.werkplek(s, bemanning[p].bij);
        s.personeel.push({
          id: 'm' + (p + 1),
          naam: bemanning[p].naam,
          rol: bemanning[p].rol,
          x: start.x, y: start.y,
          doel: null,
          taak: null,
          bezig: 'vrij'
        });
      }

      A.core.toeloop.plandag(s);
      return s;
    },

    recept: function (s, id) {
      for (var i = 0; i < s.recepten.length; i++) if (s.recepten[i].id === id) return s.recepten[i];
      return null;
    },

    /* De werkvoorraad: alles waar wíj nog iets aan moeten doen.
       Een recept dat klaarligt in het rek telt hier bewust niet mee — dat is
       geen werk maar een pakketje dat op zijn eigenaar wacht. Ze op één hoop
       gooien laat een rustige ochtend eruitzien als een achterstand. */
    onderhanden: function (s) {
      var n = 0;
      for (var i = 0; i < s.recepten.length; i++) {
        var r = s.recepten[i];
        if (r.fase === 'af' || r.fase === 'weg') continue;
        if (r.fase === 'uitgifte' && s.tijd < r.ophalen) continue;
        n++;
      }
      return n;
    },

    /* Klaar, maar de patiënt is er nog niet. */
    inHetRek: function (s) {
      var n = 0;
      for (var i = 0; i < s.recepten.length; i++) {
        var r = s.recepten[i];
        if (r.fase === 'uitgifte' && s.tijd < r.ophalen) n++;
      }
      return n;
    },

    wachtenden: function (s) {
      var uit = [];
      for (var i = 0; i < s.recepten.length; i++) {
        var r = s.recepten[i];
        if (r.wacht && r.fase !== 'af' && r.fase !== 'weg') uit.push(r);
      }
      return uit;
    },

    /* Recepten die op een besluit van de speler wachten. Dit is de rem op het
       hele systeem: zolang de speler niets kiest, schuift er niets door. */
    besluiten: function (s) {
      var uit = [];
      for (var i = 0; i < s.recepten.length; i++) {
        if (s.recepten[i].fase === 'besluit') uit.push(s.recepten[i]);
      }
      return uit;
    },

    nieuwDagboek: leegDagboek,
    nieuwMeting: leegMeting,

    apotheker: function (s) {
      for (var i = 0; i < s.personeel.length; i++) {
        if (s.personeel[i].rol === 'apotheker') return s.personeel[i];
      }
      return null;
    }
  };

  function leegMeting() {
    return { werkMin: 0, loopMin: 0, klokMin: 0, apothekerWerk: 0, apothekerKlok: 0 };
  }

  function leegDagboek() {
    return {
      binnen: 0, af: 0, weggelopen: 0,
      signalen: 0, fouten: 0, bijnaFouten: 0,
      overlegd: 0, akkoord: 0, beoordeeld: 0,
      opgevraagd: 0, opvraagMislukt: 0, teruggestuurd: 0, buitenNorm: 0,
      omzet: 0, kosten: 0,
      /* Twee klokken, twee metingen — en ze verwarren is precies de fout die
         het harnas er meteen uit haalde. `gereed` is wat de apotheek zelf doet:
         van binnenkomst tot klaar in het rek. `wacht` is wat de patiënt in de
         zaak ervaart. Een recept dat om elf uur klaarligt en om vier uur wordt
         opgehaald, is snel afgehandeld en niet traag. */
      gereedSom: 0, gereedN: 0, gereedMax: 0,
      wachtSom: 0, wachtN: 0, wachtMax: 0
    };
  }

})(window.Apotheek);
