/* Het pand: een vast rooster met een publieksruimte vóór de balie en een
 * werkvloer erachter.
 *
 * Fase 0 legt de plattegrond vast — inrichten en ruimte bijkopen is fase 2.
 * Wat nu al echt is, is de afstand: personeel.js laat een assistent de weg
 * tussen twee stations werkelijk aflopen, dus de plek van de lade ten opzichte
 * van de balie kost of scheelt doorstroom. Zonder dat zou het rooster
 * decoratie zijn. */
(function (A) {

  var BREED = 14;
  var DIEP = 10;

  /* Tegelsoorten. Het rooster zelf is een platte array van getallen, zodat een
     save gewoon JSON blijft. */
  var BUITEN = 0, WERKVLOER = 1, TOONBANK = 2, PUBLIEK = 3;

  function maak() {
    var t = new Array(BREED * DIEP);
    for (var y = 0; y < DIEP; y++) {
      for (var x = 0; x < BREED; x++) {
        var soort;
        if (y <= 4) soort = WERKVLOER;
        else if (y === 5) soort = TOONBANK;
        else soort = PUBLIEK;
        /* Een randje buiten aan weerszijden, zodat het pand een vorm heeft en
           niet als een rechthoek zonder muren leest. */
        if (x === 0 || x === BREED - 1) soort = BUITEN;
        if (y === DIEP - 1 && (x < 6 || x > 8)) soort = BUITEN;
        t[y * BREED + x] = soort;
      }
    }
    return t;
  }

  /* Waar de vaste inrichting staat. Eén regel per object; de assistent loopt
     naar de tegel ernaast (werkplek), niet op het meubel zelf. */
  var OPSTELLING = [
    { object: 'bewaking', x: 3, y: 2, sta: { x: 3, y: 3 } },
    { object: 'lade', x: 10, y: 2, sta: { x: 10, y: 3 } },
    { object: 'balie', x: 7, y: 5, sta: { x: 7, y: 4 } },
    { object: 'deur', x: 7, y: 9, sta: { x: 7, y: 8 } }
  ];

  /* Plekken waar wachtende patiënten staan, in volgorde van gebruik: het
     dichtst bij de balie raakt het eerst bezet. Puur voor de tekening en voor
     "hoe vol ziet het eruit" — het geduld zelf zit op het recept. */
  var WACHTPLEKKEN = [];
  (function () {
    var rijen = [7, 8];
    for (var i = 0; i < rijen.length; i++) {
      for (var x = 2; x <= 11; x++) WACHTPLEKKEN.push({ x: x, y: rijen[i] });
    }
  })();

  A.core.pand = {
    BREED: BREED, DIEP: DIEP,
    BUITEN: BUITEN, WERKVLOER: WERKVLOER, TOONBANK: TOONBANK, PUBLIEK: PUBLIEK,
    OPSTELLING: OPSTELLING,
    WACHTPLEKKEN: WACHTPLEKKEN,

    nieuw: function () {
      return { breed: BREED, diep: DIEP, tegels: maak() };
    },

    tegel: function (p, x, y) {
      if (x < 0 || y < 0 || x >= p.breed || y >= p.diep) return BUITEN;
      return p.tegels[y * p.breed + x];
    },

    /* Waar staat een assistent als die aan dit object werkt. */
    werkplek: function (s, objectId) {
      for (var i = 0; i < s.objecten.length; i++) {
        if (s.objecten[i].object === objectId) return s.objecten[i].sta;
      }
      return { x: 1, y: 1 };
    },

    object: function (s, objectId) {
      for (var i = 0; i < s.objecten.length; i++) {
        if (s.objecten[i].object === objectId) return s.objecten[i];
      }
      return null;
    }
  };

})(window.Apotheek);
