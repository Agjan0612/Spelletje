/* De inrichting van het pand — pure data.
 *
 * Fase 0 kent drie werkplekken en een deur. Het pand ligt vast: inrichten en
 * ruimte bijkopen is fase 2. Wat hier nu al echt is, is de *plek*: de assistent
 * loopt de afstand tussen twee stations werkelijk, dus een balie ver van de
 * lade kost doorstroom. Dat is de reden dat dit een grid is en geen lijstje. */
(function (A) {

  var O = [
    {
      id: 'bewaking', naam: 'Bewakingswerkplek', emoji: '🖥️',
      station: 'bewaking', kleur: '#4a6b8a', hoogte: 12,
      uitleg: 'Hier wordt het recept nagelopen op signalen.'
    },
    {
      id: 'lade', naam: 'Verzamellade', emoji: '🗄️',
      station: 'gereedmaken', kleur: '#8a7048', hoogte: 20,
      uitleg: 'Hier wordt het middel gepakt en geëtiketteerd.'
    },
    {
      id: 'balie', naam: 'Balie', emoji: '🧑‍⚕️',
      station: 'uitgifte', kleur: '#2f6b57', hoogte: 10,
      uitleg: 'Hier gaat het medicijn over de toonbank, mét uitleg.'
    },
    {
      id: 'deur', naam: 'Ingang', emoji: '🚪',
      station: null, kleur: '#6b5a48', hoogte: 4,
      uitleg: 'Hier komen de patiënten binnen.'
    }
  ];

  A.config.objecten = O;
  A.config.object = function (id) {
    for (var i = 0; i < O.length; i++) if (O[i].id === id) return O[i];
    return null;
  };

})(window.Apotheek);
