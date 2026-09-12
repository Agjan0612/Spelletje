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
    receptenPerDag: 112,
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
    wachtAandeel: 0.42,
    /* Wie later ophaalt, komt zoveel minuten na binnenkomst terug. */
    ophalenNa: [70, 260],

    /* --------------------------------------------------------------- werk -- */
    /* Minuten werk per recept per station, voor één assistent. */
    werk: {
      bewaking: 2.2,
      gereedmaken: 1.8,
      uitgifte: 2.8,
      overleg: 6.0
    },
    /* Spreiding op die tijden: elk recept trekt uniform uit [1-x, 1+x]. */
    werkSpreiding: 0.35,

    /* ------------------------------------------------------------ signaal -- */
    signaalKans: 0.18,         /* deel van de recepten met een bewakingssignaal */
    signaalEcht: 0.35,         /* deel daarvan dat écht ingrijpen nodig heeft */

    /* ------------------------------------------------------------ geduld -- */
    geduld: 34,                /* minuten dat een wachtende patiënt het volhoudt */

    /* ---------------------------------------------------------- personeel -- */
    loopsnelheid: 7,           /* tegels per speelminuut */
    loonPerDag: 185,           /* per assistent */

    /* ---------------------------------------------------------------- geld -- */
    vergoeding: 6.5,           /* terhandstelling per afgeleverd recept */
    huurPerDag: 95,
    foutKosten: 25,            /* herstel, extra uitgifte, een boze huisarts */
    /* Een weggelopen patiënt moet ook in geld pijn doen, niet alleen in
       tevredenheid. Zonder dit is "altijd overleggen" financieel gratis en dan
       is de keuze op de receptkaart geen keuze maar een formaliteit — precies
       de val waar het harnas ons uit heeft gehaald. Naast de misgelopen
       vergoeding kost het de klandizie van vandaag. */
    weglopenKosten: 12,

    /* ------------------------------------------------------ tevredenheid -- */
    tevredenStart: 100,
    tevredenPerFout: 3,
    tevredenPerWeggelopen: 2,
    /* Doorlooptijd waarboven een wachtende patiënt ontevreden vertrekt van de
       balie: niet weggelopen, wel geïrriteerd. */
    doorloopNorm: 18,
    tevredenPerTraag: 0.25,
    /* Herstel loopt naar 100 toe in plaats van er lineair heen te kruipen: dat
       maakt tevredenheid een evenwicht in plaats van een aftelklok. Hoe lager
       je staat, hoe harder een goede dag helpt. */
    tevredenHerstel: 0.0016
  };

})(window.Apotheek);
