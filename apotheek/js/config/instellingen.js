/* Alle balansknoppen op één plek — pure data, geen logica.
 *
 * Waarom bij elkaar: dit spel is een wachtrijnetwerk en die hebben een klif.
 * Een station dat net te weinig capaciteit heeft geeft geen iets langere rij
 * maar een rij die de hele dag groeit. Deze getallen zijn dus niet "smaak",
 * ze bepalen of het spel speelbaar is — en ze horen op één plek te staan waar
 * tools/simuleer-apotheek.js ze kan lezen en de gevolgen kan meten.
 *
 * Streefwaarde: bezettingsgraad van het personeel rond 0,75–0,85 over een dag.
 * Boven 0,90 loopt de wachtkamer vol, onder 0,60 verveelt de speler zich. */
(function (A) {

  A.config.inst = {

    /* ------------------------------------------------------------- de dag -- */
    dagStart: 8 * 60,          /* 08:00 — deuren open */
    dagEind: 17.5 * 60,        /* 17:30 — deuren dicht */
    minutenPerSeconde: 1,      /* 1 echte seconde = 1 speelminuut bij 1x */

    /* ------------------------------------------------------------ toeloop -- */
    receptenPerDag: 125,
    /* Verdeling over de dag: gewicht per half uur vanaf dagStart. De ochtend-
       piek en de vloedgolf huisartsrecepten aan het eind van de middag zijn
       het hele punt — een vlakke stroom zou het spel karakterloos maken. */
    dagprofiel: [
      3, 5, 6, 6, 5, 4,        /* 08:00–11:00  ochtendpiek */
      3, 3, 2, 2,              /* 11:00–13:00  het zakt weg */
      3, 3, 4, 4,              /* 13:00–15:00  middag */
      5, 6, 6, 4, 2            /* 15:00–17:30  recepten van de huisarts */
    ],
    /* Deel van de patiënten dat blijft wachten in plaats van later op te halen. */
    wachtAandeel: 0.33,
    /* Wie later ophaalt, komt zoveel minuten na binnenkomst terug. */
    ophalenNa: [70, 260],

    /* --------------------------------------------------------------- werk -- */
    /* Minuten werk per recept per station, voor één medewerker. */
    werk: {
      bewaking: 2.2,
      opvragen: 2.5,           /* dossier of lab erbij halen */
      overleg: 6.0,            /* de huisarts bellen — de assistent is dan bezig */
      oordeel: 3.0,            /* de apotheker beslist */
      oordeelKort: 1.2,        /* ... met het gegeven er al bij */
      gereedmaken: 1.8,
      controle: 1.2,           /* het tweede paar ogen */
      uitgifte: 2.8,
      begeleiding: 1.5         /* extra aan de balie bij een klasse C-signaal */
    },
    /* Spreiding op die tijden: elk recept trekt uniform uit [1-x, 1+x]. */
    werkSpreiding: 0.35,

    /* En dan wachten. Een huisarts belt terug wanneer het hem uitkomt, en dat
       is de echte prijs van overleggen: niet de zes minuten van de assistent
       maar de half uur die de patiënt in de wachtruimte zit. Dit getal is de
       reden dat het loont om eerst zelf uit te zoeken of het overleg wel nodig
       is — zonder deze wachttijd is opvragen een omweg. */
    overlegAntwoord: [22, 45],

    /* ------------------------------------------------------------ signaal -- */
    signaalKans: 0.30,         /* deel van de recepten met een signaal */
    /* Verdeling over de klassen. A blokkeert en moet langs de apotheker, dus
       dit getal bepaalt vrijwel in z'n eentje hoe zwaar die flessenhals is. */
    klasseVerdeling: { A: 0.28, B: 0.40, C: 0.32 },
    /* Kans dat een opgevraagd gegeven ook echt te vinden is. De rest van de
       tijd heb je de minuten uitgegeven en weet je nog niets — dat is wat
       opvragen ervan weerhoudt altijd het beste antwoord te zijn. */
    opvraagKans: 0.82,

    /* ----------------------------------------------------------- controle -- */
    /* Er zijn twee soorten fouten en ze hebben niets met elkaar te maken.
       De eerste is een verkeerd oordeel op een signaal — die maak jij.
       De tweede is een verkeerd doosje: de andere sterkte uit de la, het
       verkeerde etiket. Die overkomt iedereen, ook op een recept zonder
       signaal, en dát is de reden dat een apotheek dubbel controleert. Zonder
       deze tweede soort is de controletafel een station dat alleen tijd kost
       zodra je goed leert beslissen — en dan zet de speler hem terecht uit. */
    verzamelfoutKans: 0.03,
    controleVangt: 0.78,       /* deel van de fouten dat het tweede paar ogen ziet */
    steekproefDeel: 0.5,       /* wat er bij 'steekproef' langs de controle gaat */

    /* ------------------------------------------------------------ geduld -- */
    geduld: 25,                /* minuten dat een wachtende patiënt het volhoudt */

    /* Hoeveel voorrang een wachtende patiënt krijgt, uitgedrukt in stappen van
       de kernlus. Op 0 sluit hij bij elk station achteraan aan en loopt hij weg;
       te hoog en de ophaalrecepten verhongeren, waardoor de dag pas om zeven uur
       leeg is. Dit getal koopt de wachttijd van de één met de doorlooptijd van
       de ander, en er is geen stand waarop allebei gratis is. */
    wachtVoorrang: 1.5,

    /* ---------------------------------------------------------- personeel -- */
    loopsnelheid: 7,           /* tegels per speelminuut */
    loon: { assistent: 185, apotheker: 330 },

    /* ---------------------------------------------------------------- geld -- */
    /* Opbrengst per afgeleverd recept. Dit is bewust één getal: het staat voor
       de terhandstellingsvergoeding plus de inkoopmarge plus het deel van de
       zelfzorgverkoop dat aan een receptbezoek hangt. Die drie uit elkaar
       trekken is fase 3; ze samen laag houden en dan doen alsof een apotheek
       van de terhandstelling alleen kan bestaan, is gewoon onwaar. */
    vergoeding: 9.0,
    huurPerDag: 95,
    /* Een fout die de deur uit gaat is geen boekhoudpostje. Terughalen, opnieuw
       afleveren, de huisarts bellen, de melding intern afhandelen — en dat is
       nog de goede afloop. Dit getal en tevredenPerFout hieronder staan bewust
       ver boven wat een weggelopen patiënt kost: een apotheek waar het model
       zegt dat te lang wachten erger is dan een verkeerd middel afleveren, is
       een apotheek die het verkeerde leert. */
    foutKosten: 90,
    /* Een weggelopen patiënt moet ook in geld pijn doen, niet alleen in
       tevredenheid. Zonder dit is "altijd overleggen" financieel gratis en dan
       is de keuze op de receptkaart geen keuze maar een formaliteit — precies
       de val waar het harnas ons uit heeft gehaald. Naast de misgelopen
       vergoeding kost het de klandizie van vandaag. */
    weglopenKosten: 12,

    /* ------------------------------------------------------ tevredenheid -- */
    tevredenStart: 100,
    tevredenPerFout: 10,
    tevredenPerWeggelopen: 2,
    /* De servicenorm van de apotheek zelf: binnen zoveel minuten hoort een
       recept klaar te liggen. Dit geldt voor élk recept, niet alleen voor wie
       staat te wachten — ook wie 's middags terugkomt merkt of het er ligt.
       Zonder deze norm is doorlooptijd een getal zonder gevolg, en dan levert
       eerst uitzoeken niets op tegenover blind overleggen. */
    doorloopNorm: 25,
    tevredenPerTraag: 0.3,
    /* Een wachtende patiënt naar huis sturen omdat de huisarts nog moet
       terugbellen, kost goodwill maar geen klant. Zonder deze uitweg loopt
       vrijwel iedereen weg voor wie overlegd moet worden, en dan is overleggen
       geen dure keuze meer maar een verboden zet. */
    tevredenPerTerugsturen: 1,
    /* Herstel loopt naar 100 toe in plaats van er lineair heen te kruipen: dat
       maakt tevredenheid een evenwicht in plaats van een aftelklok. Hoe lager
       je staat, hoe harder een goede dag helpt. */
    tevredenHerstel: 0.0016
  };

})(window.Apotheek);
