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

        vandaag: leegDagboek(),
        gisteren: null,
        totaal: leegDagboek(),

        /* Bezetting van het personeel over de dag, om de wachtrijklif uit het
           bouwplan te kunnen meten in plaats van hem te moeten raden. */
        meting: { werkMin: 0, loopMin: 0, klokMin: 0 },

        log: [],
        dagKlaar: false
      };

      for (var i = 0; i < A.core.pand.OPSTELLING.length; i++) {
        var o = A.core.pand.OPSTELLING[i];
        s.objecten.push({ object: o.object, x: o.x, y: o.y, sta: { x: o.sta.x, y: o.sta.y } });
      }

      var namen = ['Fatima', 'Joost'];
      for (var p = 0; p < namen.length; p++) {
        var start = A.core.pand.werkplek(s, p === 0 ? 'bewaking' : 'balie');
        s.personeel.push({
          id: 'a' + (p + 1),
          naam: namen[p],
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

    nieuwDagboek: leegDagboek
  };

  function leegDagboek() {
    return {
      binnen: 0, af: 0, weggelopen: 0, fouten: 0,
      overlegd: 0, akkoord: 0,
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
