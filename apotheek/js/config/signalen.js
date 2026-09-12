/* Bewakingssignalen — hier zit de vakinhoud.
 *
 * Eén object per signaal en het spel kent het; er hoeft nooit code bij. Dat is
 * de reden dat dit bestand bestaat in plaats van een reeks if-jes in de kern.
 *
 * Velden:
 *   klasse    A harde stop, alleen de apotheker mag hem afdoen
 *             B overleg gewenst — hier ligt de keuze van de speler
 *             C informeren — geen blokkade, wel een gesprek bij de uitgifte
 *   tekst     de vakinhoudelijke regel
 *   uitleg    diezelfde regel in gewone taal. Niet optioneel: zonder deze zin
 *             is het spel onspeelbaar voor wie geen apotheker is, en dat is de
 *             helft van de mensen die het ooit oppakt.
 *   vraagt    welk gegeven bepaalt of dit signaal terecht is — 'nierfunctie',
 *             'allergie', 'historie', of null als het aan het recept zelf te
 *             zien is. Dit veld is de kern van fase 1: het maakt informatie
 *             iets dat je moet halen in plaats van iets dat je al hebt.
 *   echtKans  hoe vaak ingrijpen echt nodig is
 *   middel    het nieuwe voorschrift
 *   naast     wat de patiënt al gebruikt
 *   terecht   wat er aan de hand is als het signaal terecht blijkt
 *   loos      waarom het meevalt als dat niet zo is
 */
(function (A) {

  var S = [

    /* ---------------------------------------------------------- klasse A -- */
    {
      id: 'triple-whammy', klasse: 'A', vraagt: 'nierfunctie', echtKans: 0.40,
      tekst: 'NSAID naast RAS-remmer en diureticum',
      uitleg: 'Drie middelen die samen de nier zwaar belasten. Bij een matige nierfunctie kan dat acuut misgaan.',
      middel: 'Diclofenac 50 mg', naast: ['Enalapril 10 mg', 'Hydrochloorthiazide 12,5 mg'],
      terecht: 'De nierfunctie is te laag voor deze combinatie.',
      loos: 'De nierfunctie is ruim voldoende; met een korte kuur valt dit mee.'
    },
    {
      id: 'penicilline-allergie', klasse: 'A', vraagt: 'allergie', echtKans: 0.45,
      tekst: 'Amoxicilline bij gemelde penicillineallergie',
      uitleg: 'Als de allergie echt is, kan dit een ernstige reactie geven. Veel gemelde allergieën blijken bij navraag geen allergie.',
      middel: 'Amoxicilline 500 mg', naast: [],
      terecht: 'Het gaat om een echte allergie — dit middel mag niet.',
      loos: 'De melding blijkt maagklachten te zijn geweest, geen allergie.'
    },
    {
      id: 'methotrexaat-dagelijks', klasse: 'A', vraagt: null, echtKans: 0.80,
      tekst: 'Methotrexaat met een dagelijkse doseerinstructie',
      uitleg: 'Methotrexaat gaat één keer per week. Dagelijks innemen is levensgevaarlijk. Dit staat op het recept zelf — daar is geen extra gegeven voor nodig.',
      middel: 'Methotrexaat 2,5 mg', naast: ['Foliumzuur 5 mg'],
      terecht: 'Het recept zegt echt dagelijks. Dit moet terug naar de voorschrijver.',
      loos: 'De huisarts bedoelde wekelijks; de instructie was slordig ingetypt.'
    },
    {
      id: 'dubbel-nsaid', klasse: 'A', vraagt: 'historie', echtKans: 0.35,
      tekst: 'Twee ontstekingsremmers tegelijk',
      uitleg: 'Twee NSAID’s naast elkaar geeft alleen maar meer kans op een maagbloeding, niet meer effect.',
      middel: 'Naproxen 500 mg', naast: ['Ibuprofen 600 mg'],
      terecht: 'De patiënt gebruikt de eerste nog dagelijks.',
      loos: 'De ibuprofen was een eenmalige kuur die allang op is.'
    },

    /* ---------------------------------------------------------- klasse B -- */
    {
      id: 'metformine-nier', klasse: 'B', vraagt: 'nierfunctie', echtKans: 0.35,
      tekst: 'Metformine bij mogelijk verminderde nierfunctie',
      uitleg: 'Metformine wordt door de nier uitgescheiden. Werkt die minder, dan stapelt het middel op.',
      middel: 'Metformine 1000 mg', naast: [],
      terecht: 'De nierfunctie vraagt om een lagere dosering.',
      loos: 'De nierfunctie is prima voor deze dosering.'
    },
    {
      id: 'statine-macrolide', klasse: 'B', vraagt: 'historie', echtKans: 0.40,
      tekst: 'Simvastatine naast claritromycine',
      uitleg: 'De antibiotica remt de afbraak van de statine. Een week pauzeren met de statine is meestal genoeg.',
      middel: 'Claritromycine 500 mg', naast: ['Simvastatine 40 mg'],
      terecht: 'De patiënt gebruikt de statine trouw door — die moet even stoppen.',
      loos: 'De statine is vorige maand al gestaakt.'
    },
    {
      id: 'nsaid-maagbescherming', klasse: 'B', vraagt: 'historie', echtKans: 0.45,
      tekst: 'NSAID zonder maagbescherming boven de zeventig',
      uitleg: 'Op deze leeftijd hoort er een maagbeschermer bij. Misschien heeft de patiënt die al.',
      middel: 'Ibuprofen 600 mg', naast: [],
      terecht: 'Er is geen maagbescherming — die moet erbij.',
      loos: 'De patiënt gebruikt al een protonpompremmer.'
    },
    {
      id: 'benzo-herhaling', klasse: 'B', vraagt: 'historie', echtKans: 0.40,
      tekst: 'Slaapmiddel wordt te snel opnieuw opgehaald',
      uitleg: 'Sneller ophalen dan de dosering toelaat wijst op meer gebruik dan afgesproken — of op een voorraadje.',
      middel: 'Temazepam 10 mg', naast: [],
      terecht: 'Het gebruik loopt duidelijk op. Dit is een gesprek waard.',
      loos: 'De patiënt ging op reis en haalde daarom vooruit.'
    },

    /* ---------------------------------------------------------- klasse C -- */
    {
      id: 'eerste-uitgifte', klasse: 'C', vraagt: null, echtKans: 1,
      tekst: 'Eerste uitgifte — begeleidingsgesprek',
      uitleg: 'De eerste keer hoort er uitleg bij: hoe het werkt, wanneer het gaat helpen en wat je merkt.',
      middel: 'Nieuw middel', naast: [],
      terecht: 'Kost een paar minuten extra aan de balie.',
      loos: ''
    },
    {
      id: 'ace-hoest', klasse: 'C', vraagt: null, echtKans: 1,
      tekst: 'Droge prikkelhoest kan van de ACE-remmer komen',
      uitleg: 'Een bekende bijwerking die vaak voor een verkoudheid wordt aangezien. Het helpt als iemand dat weet.',
      middel: 'Noscapine drank', naast: ['Lisinopril 10 mg'],
      terecht: 'Even benoemen bij de uitgifte.',
      loos: ''
    }
  ];

  A.config.signalen = S;
  A.config.signaal = function (id) {
    for (var i = 0; i < S.length; i++) if (S[i].id === id) return S[i];
    return null;
  };
  A.config.signalenVanKlasse = function (k) {
    return S.filter(function (x) { return x.klasse === k; });
  };

  /* De handelingen op de receptkaart. `wie` zegt wie het mag doen, `werk` welke
     tijdsleutel uit instellingen.werk erbij hoort. */
  A.config.acties = [
    {
      id: 'opvragen', naam: 'Gegeven opvragen', wie: 'iedereen', werk: 'opvragen',
      omschrijving: 'Kost een paar minuten en vertelt je of het signaal terecht is — als het gegeven te vinden is.'
    },
    {
      id: 'overleg', naam: 'Overleg huisarts', wie: 'iedereen', werk: 'overleg',
      omschrijving: 'Altijd een goede afloop, maar het kost een assistent zes minuten.'
    },
    {
      id: 'apotheker', naam: 'Naar de apotheker', wie: 'apotheker', werk: 'oordeel',
      omschrijving: 'De apotheker beslist en dat is altijd goed — maar er is er maar één.'
    },
    {
      id: 'akkoord', naam: 'Akkoord', wie: 'iedereen', werk: null,
      omschrijving: 'Direct door. Gratis, tot blijkt dat het signaal terecht was.'
    }
  ];
  A.config.actie = function (id) {
    var a = A.config.acties;
    for (var i = 0; i < a.length; i++) if (a[i].id === id) return a[i];
    return null;
  };

  /* Welke handelingen mogen per klasse. Een A mag nooit zomaar akkoord: daar is
     de apotheker eindverantwoordelijk voor, en dat is precies wat hem tot de
     flessenhals van het spel maakt. */
  A.config.toegestaan = {
    A: ['opvragen', 'apotheker', 'overleg'],
    B: ['opvragen', 'overleg', 'akkoord', 'apotheker'],
    C: ['akkoord']
  };

})(window.Apotheek);
