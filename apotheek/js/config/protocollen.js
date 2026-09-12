/* Protocollen — het beleid dat de speler instelt in plaats van elk recept aan
 * te klikken.
 *
 * Dit is de belangrijkste knop van fase 1 en hij bestaat om een reden die niet
 * over realisme gaat: zonder beleid loopt dit spel na een half uur vast in
 * muisarm. Je handelt de eerste dagen elk signaal zelf af, ziet welke keuze bij
 * welke klasse hoort, en legt hem daarna vast. Wat overblijft zijn de gevallen
 * die je expres aan jezelf hebt gehouden. */
(function (A) {

  A.config.protocolKeuzes = {
    A: [
      { id: 'vraag', naam: 'Vraag het mij', uitleg: 'Elke klasse A komt op je bureau.' },
      { id: 'apotheker', naam: 'Direct naar de apotheker', uitleg: 'Snel van je bureau af, maar de apotheker is de flessenhals.' },
      { id: 'uitzoeken', naam: 'Eerst uitzoeken, dan de apotheker', uitleg: 'Een assistent haalt het gegeven erbij; de apotheker is daarna veel sneller klaar.' }
    ],
    B: [
      { id: 'vraag', naam: 'Vraag het mij', uitleg: 'Elke klasse B komt op je bureau.' },
      { id: 'uitzoeken', naam: 'Uitzoeken en dan beslissen', uitleg: 'Opvragen; blijkt het loos, dan door — blijkt het terecht, dan overleg.' },
      { id: 'overleg', naam: 'Altijd overleggen', uitleg: 'Veilig en duur: zes minuten per stuk, ook als het nergens over ging.' },
      { id: 'akkoord', naam: 'Altijd doorlaten', uitleg: 'Snel, en af en toe gaat er iets de deur uit dat dat niet had moeten doen.' }
    ],
    controle: [
      { id: 'alles', naam: 'Alles controleren', uitleg: 'Het tweede paar ogen op elk recept. Kost tijd, vangt de meeste fouten.' },
      { id: 'steekproef', naam: 'De helft controleren', uitleg: 'Half zoveel tijd, half zoveel vangst. Een eerlijke ruil op een drukke dag.' },
      { id: 'geen', naam: 'Niet controleren', uitleg: 'Alles gaat rechtstreeks naar de balie. Alleen bij grote drukte een verdedigbare keuze.' }
    ]
  };

  A.config.protocolStandaard = { A: 'vraag', B: 'vraag', controle: 'alles' };

})(window.Apotheek);
