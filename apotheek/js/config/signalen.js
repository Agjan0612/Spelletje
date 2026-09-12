/* Bewakingssignalen — de bibliotheek waar de vakinhoud in zit.
 *
 * Fase 0 heeft er bewust één soort: een interactie waar je akkoord op geeft of
 * over overlegt. De vorm ligt hier al vast zoals de hele bibliotheek hem later
 * krijgt, zodat er straks alleen objecten bijkomen en geen code.
 *
 *   klasse   A harde stop · B overleg gewenst · C informeren
 *   tekst    de vakinhoudelijke regel
 *   uitleg   diezelfde regel in gewone taal — dit is wat het spel speelbaar
 *            houdt voor wie geen apotheker is, en het is niet optioneel
 *   echt     kans dat dit signaal bij deze patiënt écht ingrijpen vraagt */
(function (A) {

  var S = [
    {
      id: 'nsaid-ras-diureticum',
      klasse: 'A',
      tekst: 'NSAID naast RAS-remmer en diureticum',
      uitleg: 'Drie middelen die samen de nier zwaar belasten. Bij een oudere patiënt met een matige nierfunctie kan dat acuut misgaan.',
      middel: 'Diclofenac 50 mg',
      naast: ['Enalapril 10 mg', 'Hydrochloorthiazide 12,5 mg']
    }
  ];

  A.config.signalen = S;
  A.config.signaal = function (id) {
    for (var i = 0; i < S.length; i++) if (S[i].id === id) return S[i];
    return null;
  };

  /* Twee keuzes, twee kosten. Dit is de hele afweging van fase 0: overleggen is
     veilig maar vreet capaciteit, akkoord geven is gratis maar soms fout. */
  A.config.besluiten = [
    { id: 'akkoord', naam: 'Akkoord', omschrijving: 'Direct door. Kost geen tijd — maar als het signaal terecht was, gaat er iets mis.' },
    { id: 'overleg', naam: 'Overleg huisarts', omschrijving: 'Altijd goed, maar het kost een assistent zes minuten.' }
  ];

})(window.Apotheek);
