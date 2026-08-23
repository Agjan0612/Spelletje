/* Full-screen overlays: welcome, help, menu, age transition and victory. */
(function (Game) {

  var O = {};
  var wrap, titelEl, bodyEl, actiesEl;
  var spel = null;
  var wasGepauzeerd = 1;

  O.init = function (hetSpel) {
    spel = hetSpel;
    wrap = document.getElementById('overlay');
    titelEl = document.getElementById('overlay-title');
    bodyEl = document.getElementById('overlay-body');
    actiesEl = document.getElementById('overlay-actions');

    document.getElementById('btn-menu').addEventListener('click', function () { O.menu(); });

    wrap.addEventListener('click', function (ev) {
      if (ev.target === wrap) O.sluit();
    });
  };

  O.open = function (titel, bouwBody, knoppen, pauzeer) {
    if (pauzeer !== false) {
      wasGepauzeerd = spel.state ? spel.state.snelheid : 1;
      spel.zetSnelheid(0);
    }
    titelEl.textContent = titel;
    bodyEl.innerHTML = '';
    if (typeof bouwBody === 'string') bodyEl.innerHTML = bouwBody;
    else if (bouwBody) bouwBody(bodyEl);

    actiesEl.innerHTML = '';
    (knoppen || []).forEach(function (k) {
      var b = Game.util.el('button', k.primair ? 'primair' : '', k.tekst);
      b.addEventListener('click', k.actie);
      actiesEl.appendChild(b);
    });
    wrap.classList.remove('hidden');
  };

  O.sluit = function (hervat) {
    wrap.classList.add('hidden');
    if (hervat !== false) spel.zetSnelheid(wasGepauzeerd || 1);
  };

  O.isOpen = function () { return wrap && !wrap.classList.contains('hidden'); };

  /* ------------------------------------------------------------- welkom -- */

  O.welkom = function () {
    var boeken = Game.core.save.boeken();
    var gevuld = boeken.filter(function (b) { return !b.leeg; });
    var erIsEenSave = gevuld.length > 0;
    var knoppen = [];

    if (erIsEenSave) {
      var laatste = Game.core.save.laatste();
      var meta = boeken[laatste - 1];
      knoppen.push({
        tekst: '📜 Verder met ' + (meta && meta.naam ? meta.naam : 'je dorp'), primair: true,
        actie: function () {
          spel.laadOpgeslagenSpel(laatste);
          O.sluit();
        }
      });
    }
    if (gevuld.length > 1) {
      knoppen.push({ tekst: '📁 Dorpsboeken', actie: function () { O.boeken(true); } });
    }
    knoppen.push({
      tekst: '🌱 Nieuw dorp stichten', primair: !erIsEenSave, actie: function () {
        O.nieuwSpelScherm();
      }
    });
    knoppen.push({ tekst: '❓ Hoe speel ik dit?', actie: function () { O.help(true); } });

    O.open('🏰 Dorp tot Stad', function (el) {
      el.innerHTML =
        '<p>Je begint met een handvol dorpelingen, een boerderij en een groot stuk wildernis. ' +
        'Verzamel <b>vlees, hout, steen, ijzer, koper en edelstenen</b>, bouw je nederzetting uit ' +
        'en klim door vier tijdperken heen naar een echte middeleeuwse stad.</p>' +
        '<h4>In het kort</h4>' +
        '<ul>' +
        '<li>Kies onderin een gebouw en klik op de kaart om het te plaatsen.</li>' +
        '<li>Klik op een gebouw om er werkers aan toe te wijzen.</li>' +
        '<li>Houd je dorpelingen gevoed en tevreden — dan groeit je dorp vanzelf.</li>' +
        '<li>Leg voorraad aan vóór de winter, en bouw verdediging vóór de rovers komen.</li>' +
        '<li>Er komen kooplieden, opdrachten van de heer en gebeurtenissen langs ' +
        'waar je iets mee moet. Kijk in het tabblad <b>Stad</b> rechts.</li>' +
        '</ul>';
    }, knoppen, false);
  };

  /* --------------------------------------------------------------- hulp -- */

  O.help = function (vanafWelkom) {
    O.open('❓ Zo speel je Dorp tot Stad', function (el) {
      el.innerHTML =
        '<h4>Besturing</h4>' +
        '<ul>' +
        '<li><b>Slepen</b> met de muis of <b>WASD</b> / pijltjestoetsen: over de kaart bewegen</li>' +
        '<li><b>Scrollen</b> of <b>+ / −</b>: in- en uitzoomen</li>' +
        '<li><b>Klik</b> op een gebouw: paneel met werkers en opbrengst</li>' +
        '<li><b>Escape</b>: plaatsen annuleren of paneel sluiten</li>' +
        '<li><b>Spatie</b>: pauzeren en hervatten · <b>1 2 3</b>: snelheid</li>' +
        '<li><b>Shift + 1…9</b>: het zoveelste gebouw uit het open tabblad kiezen</li>' +
        '<li><b>Shift + slepen</b>: een hele rij neerzetten (muren, straatjes)</li>' +
        '<li><b>Ctrl + Z</b>: het laatst geplaatste gebouw terugdraaien</li>' +
        '<li><b>L</b>: door de kaartlagen · <b>C</b>: door de tabbladen rechts</li>' +
        '<li><b>✋ Verplaatsen</b> in het paneel: een gebouw oppakken en ergens ' +
        'anders neerzetten voor een vijfde van de bouwkosten</li>' +
        '</ul>' +
        '<h4>Waar staat wat?</h4>' +
        '<ul>' +
        '<li>De <b>bouwbalk</b> onderin is gesorteerd op wát een gebouw doet: ' +
        'Wonen, Voedsel, Grondstoffen, Opslag, Voorzieningen, Ambacht, Handel, ' +
        'Verdediging en Straten. Grijze kaarten komen in een later tijdperk.</li>' +
        '<li>Terwijl een gebouw aan je muis hangt, staat er bij de cursor ' +
        '<b>wat het op déze tegel waard is</b>: hoeveel er van de opbrengst ' +
        'thuiskomt, hoeveel bos of erts er binnen bereik ligt, en hoeveel ' +
        'huizen een kapel bereikt.</li>' +
        '<li>Rechts staan drie tabbladen: <b>Tijdperk</b>, <b>Doelen</b> en ' +
        '<b>Stad</b>. Een stip op een tabblad betekent dat daar iets ligt te ' +
        'wachten — rood als er iets misgaat.</li>' +
        '<li>In het tabblad <b>Stad</b> zitten ook 🎉 <b>Feest</b> (voorraad ' +
        'omzetten in tevredenheid), 📚 <b>Onderzoek</b> (munten omzetten in ' +
        'blijvende bonussen) en 📋 <b>Overzicht</b> (wat staat er stil?).</li>' +
        '<li>Ga met de muis over de cijfers bovenin voor de uitleg erachter — ' +
        'de tevredenheid laat zien waar elk punt vandaan komt.</li>' +
        '<li>Bij <b>Menu → Statistieken</b> staat het <b>verloop</b> van je stad: ' +
        'inwoners, tevredenheid, voedsel en munten per seizoen, met de tijdperken ' +
        'als gouden strepen. Eén getal zegt hoe het nú staat, de lijn zegt of het ' +
        'de goede kant op gaat.</li>' +
        '</ul>' +
        '<h4>Er gebeurt van alles</h4>' +
        '<ul>' +
        '<li><b>De koopman</b> komt af en toe langs met eenmalige deals. ' +
        'Zo krijg je waar je te weinig van hebt — en raak je je overschot kwijt.</li>' +
        '<li><b>De heer</b> stuurt opdrachten met een deadline. Leveren geeft ' +
        'munten en een blijer dorp; te laat is een streep door de rekening.</li>' +
        '<li><b>Gebeurtenissen</b> zoals brand, vorst of vluchtelingen vragen om ' +
        'een keuze. Er is bijna altijd een goedkope en een goede optie.</li>' +
        '<li><b>Uitbouwen</b>: huisjes, boerderijen, groeven, de waterput en de ' +
        'wachttoren kunnen vanaf tijdperk 3 uitgroeien tot iets groters. ' +
        'Klik het gebouw aan en kijk in het paneel.</li>' +
        '</ul>' +
        '<h4>De rivier en de brug</h4>' +
        '<p>Door elke kaart loopt een rivier van de bergen naar zee. Dat is geen ' +
        'decor: je karren gaan er niet overheen, dus alles aan de overkant ligt ' +
        'ver van je opslag en levert veel minder op. Een 🌉 <b>brug</b> vind je bij ' +
        '<b>Straten</b>. Je legt hem vanaf de oever, tegel voor tegel het water op ' +
        '— of vanaf een brug die er al ligt. Over de brug rijden je karren net zo ' +
        'hard als over een straatje. Het visgebied eronder blijft gewoon liggen, ' +
        'dus een vissershut naast je brug vist rustig door.</p>' +
        '<h4>Drie dorpen naast elkaar</h4>' +
        '<p>Er passen drie dorpen in je browser. Bij <b>Menu → Dorpsboeken</b> zie je ' +
        'ze alle drie en kun je wisselen; bij een nieuw dorp kies je zelf in welk ' +
        'boek het komt. Zo kost een scenario proberen je niet je bestaande stad.</p>' +
        '<h4>En als je gewonnen hebt</h4>' +
        '<p>Zodra je stad af is verleent de kroon een <b>handvest</b>. Vanaf dan opent ' +
        'er telkens een nieuwe termijn: een levering met een deadline én een norm ' +
        'waar je stad aan moet blijven voldoen. Haal je allebei, dan levert dat ' +
        'dubbele faam op, en met faam klim je van vrijstad naar keizerlijke ' +
        'vrijstad. Elke rang geeft je stad iets blijvends. Het handvest staat in ' +
        'het tabblad <b>Stad</b>.</p>' +
        '<h4>De vijf dingen die er echt toe doen</h4>' +
        '<ul>' +
        '<li><b>Voedsel.</b> Iedereen eet. Graan van de boerderij, vlees van jagers en vissers, ' +
        'brood van de bakkerij. Afwisseling maakt mensen blijer dan één soort.</li>' +
        '<li><b>Woonruimte.</b> Nieuwe dorpelingen komen alleen als er een bed vrij is.</li>' +
        '<li><b>Tevredenheid.</b> Een waterput, kapel of herberg tilt het humeur op. ' +
        'Blije dorpelingen werken harder én je dorp groeit sneller.</li>' +
        '<li><b>De winter.</b> Boerderijen leveren dan niets en er wordt méér gegeten. ' +
        'Vissershutten en mijnen werken gewoon door.</li>' +
        '<li><b>Rovers.</b> Vanaf tijdperk 2 komen bandieten langs. Je krijgt altijd ' +
        '45 seconden waarschuwing. Wachttorens, muren, soldaten en een kasteel houden ze buiten.</li>' +
        '</ul>' +
        '<h4>Werkloze dorpelingen zijn je bouwers</h4>' +
        '<p>Iedereen die geen baan heeft, helpt mee aan alles wat in aanbouw is. Zet je álle ' +
        'dorpelingen aan het werk, dan gaat bouwen een stuk trager. Houd er dus een paar vrij.</p>';
    }, [{
      tekst: vanafWelkom ? '← Terug' : 'Sluiten', primair: true,
      actie: function () { if (vanafWelkom) O.welkom(); else O.sluit(); }
    }]);
  };

  /* --------------------------------------------------------------- menu -- */

  O.menu = function () {
    O.open('☰ Menu', function (el) {
      var boek = Game.core.save.boeken()[Game.core.save.huidig - 1];
      el.innerHTML = '<p>Je spel wordt elke 20 seconden automatisch opgeslagen in ' +
        '<b>dorpsboek ' + Game.core.save.huidig + '</b>' +
        (boek && !boek.leeg && boek.naam ? ' (' + boek.naam + ')' : '') +
        '. Er passen er drie in deze browser.</p>';

      var kop = Game.util.el('h4', '', 'Save kopiëren of terugzetten');
      el.appendChild(kop);
      var uitleg = Game.util.el('p', '', 'Kopieer deze tekst om je dorp te bewaren, of plak er een eerdere save in en klik op Importeren.');
      el.appendChild(uitleg);

      var ta = Game.util.el('textarea');
      ta.id = 'save-tekst';
      ta.value = Game.core.save.naarTekst(spel.state);
      el.appendChild(ta);
    }, [
      { tekst: '💾 Nu opslaan', primair: true, actie: function () {
        var gelukt = Game.core.save.opslaan(spel.state);
        Game.ui.toast(gelukt
          ? '💾 Opgeslagen in dorpsboek ' + Game.core.save.huidig
          : '⚠️ Opslaan lukte niet — is de browseropslag vol?');
        O.sluit();
      } },
      { tekst: '📥 Importeren', actie: function () {
        var tekst = document.getElementById('save-tekst').value;
        var s = Game.core.save.uitTekst(tekst);
        if (!s) { Game.ui.toast('⚠️ Deze save kon ik niet lezen'); return; }
        spel.zetState(s);
        Game.ui.toast('📥 Save geladen');
        O.sluit();
      } },
      { tekst: '📁 Dorpsboeken', actie: function () { O.boeken(false); } },
      { tekst: '📖 Dorpsboek', actie: function () { O.dorpsboek(); } },
      { tekst: '📊 Statistieken', actie: function () { O.statistieken(); } },
      { tekst: '📜 De kroniek', actie: function () { O.kroniek(); } },
      { tekst: '📷 Plaatje maken', actie: function () { O.plaatje(); } },
      { tekst: '❓ Uitleg', actie: function () { O.help(false); } },
      { tekst: '🌱 Nieuw spel', actie: function () {
        O.bevestigNieuw();
      } },
      { tekst: '← Verder spelen', actie: function () { O.sluit(); } }
    ]);
  };

  O.bevestigNieuw = function () {
    O.open('Nieuw spel beginnen?', '<p>Je huidige dorp gaat verloren. Weet je het zeker?</p>', [
      { tekst: 'Ja, nieuw dorp', primair: true, actie: function () { O.nieuwSpelScherm(); } },
      { tekst: 'Nee, terug', actie: function () { O.menu(); } }
    ]);
  };

  /* --------------------------------------------------- dorpsboeken ------ */

  /* Drie dorpen naast elkaar in plaats van één. Het scherm laat ze alle drie
     zien, ook de lege, want dat is de hele mededeling: er is nog plek, je
     hoeft je stad niet op te geven om een scenario te proberen. */
  O.boeken = function (vanafWelkom) {
    O.open('📁 Dorpsboeken', function (el) {
      el.appendChild(Game.util.el('p', '',
        'Er passen drie dorpen in deze browser. Het spel schrijft steeds in het ' +
        'boek dat je hier openslaat.'));

      var lijst = Game.util.el('div', 'boekenlijst');
      Game.core.save.boeken().forEach(function (b) {
        var rij = Game.util.el('div', 'boekrij' +
          (b.nr === Game.core.save.huidig ? ' huidig' : '') + (b.leeg ? ' leeg' : ''));

        var open = Game.util.el('button', 'boekknop');
        var regel = b.leeg
          ? '<b>Boek ' + b.nr + '</b><span>Leeg — hier past een nieuw dorp in</span>'
          : '<b>' + b.nr + '. ' + b.naam + '</b><span>' +
            (b.uitgestorven ? '⚰️ verlaten · ' : (b.gewonnen ? '👑 voltooid · ' : '')) +
            'jaar ' + b.jaar + ' · tijdperk ' + b.tijdperk + ' · ' +
            b.bevolking + ' inwoners · ' + b.punten + ' punten</span>';
        open.innerHTML = regel;
        open.disabled = b.leeg;
        open.addEventListener('click', function () {
          spel.laadOpgeslagenSpel(b.nr);
          O.sluit();
        });
        rij.appendChild(open);

        if (!b.leeg) {
          var wis = Game.util.el('button', 'kleineknop', '🗑️');
          wis.title = 'Dit dorpsboek wissen';
          wis.addEventListener('click', function () {
            O.open('Boek ' + b.nr + ' wissen?',
              '<p><b>' + b.naam + '</b> verdwijnt dan voorgoed uit deze browser.</p>', [
                { tekst: 'Ja, wissen', primair: true, actie: function () {
                  Game.core.save.wissen(b.nr);
                  O.boeken(vanafWelkom);
                } },
                { tekst: 'Nee, terug', actie: function () { O.boeken(vanafWelkom); } }
              ]);
          });
          rij.appendChild(wis);
        }
        lijst.appendChild(rij);
      });
      el.appendChild(lijst);
    }, [
      { tekst: '🌱 Nieuw dorp stichten', primair: true, actie: function () { O.nieuwSpelScherm(); } },
      { tekst: '← Terug', actie: function () { if (vanafWelkom) O.welkom(); else O.menu(); } }
    ], !vanafWelkom);
  };

  /* ------------------------------------------------------- nieuw spel --- */

  /* The set-up screen: name your village, pick how much world you want and
     how rough the bandits are. The seed is optional — fill in the same number
     and you get exactly the same map back. */
  O.nieuwSpelScherm = function () {
    var boeken = Game.core.save.boeken();
    var keuze = {
      naam: spel.verzinNaam(),
      scenario: 'vrij',
      kaart: 'normaal',
      moeilijkheid: 'normaal',
      seed: '',
      /* Standaard het eerste lege boek: een nieuw dorp hoort niet stilletjes
         over het vorige heen te schrijven. */
      slot: Game.core.save.vrijBoek() || Game.core.save.huidig
    };

    function knoprij(el, lijst, veld) {
      var rij = Game.util.el('div', 'keuzerij');
      lijst.forEach(function (item) {
        var k = Game.util.el('button', 'keuzeknop' + (keuze[veld] === item.id ? ' gekozen' : ''));
        k.innerHTML = '<b>' + item.emoji + ' ' + item.naam + '</b>' +
          '<span>' + item.beschrijving + '</span>';
        k.addEventListener('click', function () {
          keuze[veld] = item.id;
          Array.prototype.forEach.call(rij.children, function (kk) { kk.classList.remove('gekozen'); });
          k.classList.add('gekozen');
        });
        rij.appendChild(k);
      });
      el.appendChild(rij);
    }

    O.open('🌱 Een nieuw dorp stichten', function (el) {
      el.appendChild(Game.util.el('h4', '', 'Naam van je dorp'));
      var naamRij = Game.util.el('div', 'naamrij');
      var invoer = document.createElement('input');
      invoer.type = 'text';
      invoer.maxLength = 24;
      invoer.value = keuze.naam;
      invoer.addEventListener('input', function () { keuze.naam = invoer.value; });
      naamRij.appendChild(invoer);
      var dobbel = Game.util.el('button', 'kleineknop', '🎲');
      dobbel.title = 'Verzin een naam';
      dobbel.addEventListener('click', function () {
        keuze.naam = spel.verzinNaam();
        invoer.value = keuze.naam;
      });
      naamRij.appendChild(dobbel);
      el.appendChild(naamRij);

      el.appendChild(Game.util.el('h4', '', 'Wat voor spel wil je spelen?'));
      var scenarioRij = Game.util.el('div', 'keuzerij scenariorij');
      var uitleg = Game.util.el('div', 'cursief');
      Game.config.scenarios.forEach(function (sc) {
        var k = Game.util.el('button', 'keuzeknop' + (keuze.scenario === sc.id ? ' gekozen' : ''));
        k.innerHTML = '<b>' + sc.emoji + ' ' + sc.naam + '</b><span>' + sc.korte + '</span>';
        k.addEventListener('click', function () {
          keuze.scenario = sc.id;
          Array.prototype.forEach.call(scenarioRij.children, function (kk) { kk.classList.remove('gekozen'); });
          k.classList.add('gekozen');
          uitleg.textContent = sc.beschrijving;
          /* A scenario that fixes the world takes those choices out of the
             player's hands, so say so instead of silently overruling them. */
          var vast = sc.regels || {};
          vastMelding.textContent = (vast.kaart || vast.moeilijkheid)
            ? 'Dit scenario legt de kaartgrootte en zwaarte zelf vast.' : '';
        });
        scenarioRij.appendChild(k);
      });
      el.appendChild(scenarioRij);
      uitleg.textContent = Game.config.scenarios[0].beschrijving;
      el.appendChild(uitleg);
      var vastMelding = Game.util.el('div', 'cursief');
      el.appendChild(vastMelding);

      el.appendChild(Game.util.el('h4', '', 'Grootte van de kaart'));
      knoprij(el, Game.config.kaartmaten, 'kaart');

      el.appendChild(Game.util.el('h4', '', 'Hoe zwaar mag het zijn?'));
      knoprij(el, Game.config.moeilijkheden, 'moeilijkheid');

      el.appendChild(Game.util.el('h4', '', 'In welk dorpsboek?'));
      var boekRij = Game.util.el('div', 'keuzerij');
      var boekWaarschuwing = Game.util.el('div', 'cursief');
      function meldOverschrijven() {
        var b = boeken[keuze.slot - 1];
        boekWaarschuwing.textContent = b && !b.leeg
          ? '⚠️ Boek ' + b.nr + ' bevat ' + b.naam + ' — dat dorp gaat dan verloren.'
          : '';
      }
      boeken.forEach(function (b) {
        var k = Game.util.el('button', 'keuzeknop' + (keuze.slot === b.nr ? ' gekozen' : ''));
        k.innerHTML = '<b>Boek ' + b.nr + '</b><span>' +
          (b.leeg ? 'leeg' : b.naam + ' · jaar ' + b.jaar) + '</span>';
        k.addEventListener('click', function () {
          keuze.slot = b.nr;
          Array.prototype.forEach.call(boekRij.children, function (kk) { kk.classList.remove('gekozen'); });
          k.classList.add('gekozen');
          meldOverschrijven();
        });
        boekRij.appendChild(k);
      });
      el.appendChild(boekRij);
      el.appendChild(boekWaarschuwing);
      meldOverschrijven();

      el.appendChild(Game.util.el('h4', '', 'Kaartnummer (optioneel)'));
      var seedRij = Game.util.el('div', 'naamrij');
      var seedInvoer = document.createElement('input');
      seedInvoer.type = 'text';
      seedInvoer.placeholder = 'leeg = een willekeurige wereld';
      seedInvoer.addEventListener('input', function () { keuze.seed = seedInvoer.value; });
      seedRij.appendChild(seedInvoer);
      el.appendChild(seedRij);
      el.appendChild(Game.util.el('div', 'cursief',
        'Hetzelfde kaartnummer geeft altijd dezelfde wereld — handig om een mooi dorp opnieuw te spelen.'));
    }, [
      {
        tekst: '🌱 Stichten', primair: true, actie: function () {
          var seed = parseInt(String(keuze.seed).replace(/\D/g, ''), 10);
          spel.nieuwSpel({
            naam: (keuze.naam || '').trim() || spel.verzinNaam(),
            seed: isNaN(seed) || seed <= 0 ? undefined : seed,
            scenario: keuze.scenario,
            kaart: keuze.kaart,
            moeilijkheid: keuze.moeilijkheid,
            slot: keuze.slot
          });
          O.sluit();
        }
      },
      { tekst: '← Terug', actie: function () { O.welkom(); } }
    ], false);
  };

  /* -------------------------------------------------------- dorpsboek -- */

  /* Who actually lives here: names, trades and the year they arrived. Pure
     flavour on top of the headcount — see js/core/dorpelingen.js. */
  O.dorpsboek = function () {
    var s = spel.state;
    O.open('📖 Het dorpsboek van ' + s.dorpsnaam, function (el) {
      var boek = Game.core.dorpelingen.boek(s);
      if (!boek.length) {
        el.innerHTML = '<p>Er woont nog niemand in je dorp.</p>';
        return;
      }
      el.appendChild(Game.util.el('p', '', boek.length +
        ' inwoners noemen ' + s.dorpsnaam + ' hun thuis:'));

      var ul = Game.util.el('ul');
      ul.className = 'dorpsboek';
      boek.forEach(function (m) {
        var li = Game.util.el('li');
        li.appendChild(Game.util.el('span', 'naam', m.naam));
        li.appendChild(Game.util.el('span', 'baan', m.baan));
        li.appendChild(Game.util.el('span', 'sinds', 'sinds jaar ' + m.sinds));
        ul.appendChild(li);
      });
      el.appendChild(ul);
    }, [
      { tekst: '← Terug naar het menu', primair: true, actie: function () { O.menu(); } }
    ]);
  };

  /* -------------------------------------------------- statistieken ------ */

  /* Everything the town has done so far, with a score and a title. Available
     from the menu at any time, not just when you have won. */
  O.statistiekLijst = function (s) {
    var st = Game.core.state.statistiek(s);
    var lijst = [
      ['👥 Inwoners', st.bevolking],
      ['🏠 Gebouwen', st.gebouwen],
      ['😀 Tevredenheid', st.tevredenheid + '%'],
      ['📅 Jaren verstreken', st.jaar],
      ['📦 Totaal verzameld', Game.util.fmt(st.verzameld)],
      ['📚 Onderzoek afgerond', st.onderzoek + ' / ' + Game.config.onderzoek.length],
      ['📜 Opdrachten geleverd', st.opdrachten],
      ['⚔️ Rooftochten doorstaan', st.rooftochten],
      ['🪵 Hout verzameld', Game.util.fmt(Math.round(s.verzameld.hout))],
      ['🪨 Steen verzameld', Game.util.fmt(Math.round(s.verzameld.steen))],
      ['💎 Edelstenen gedolven', Game.util.fmt(Math.round(s.verzameld.edelsteen))]
    ];
    /* Het handvest bestaat pas na de overwinning; ervóór zou het een rij met
       nullen zijn, en die horen hier niet te staan. */
    if (s.gewonnen && s.faam) {
      var rang = Game.core.faam.rang(s);
      lijst.push([rang.emoji + ' Rang van de stad', rang.naam]);
      lijst.push(['📯 Faam', s.faam.punten + ' punten']);
      lijst.push(['📯 Termijnen vervuld', s.faam.klaar + (s.faam.gemist ? ' (' + s.faam.gemist + ' gemist)' : '')]);
    }
    return lijst;
  };

  function statistiekBlok(el, s) {
    var st = Game.core.state.statistiek(s);

    var score = Game.util.el('div', 'scoreblok');
    score.innerHTML = '<div class="scorepunten">' + st.punten + ' punten</div>' +
      '<div class="scorerang">' + st.rang + '</div>';
    el.appendChild(score);

    var tabel = Game.util.el('div', 'stattabel');
    O.statistiekLijst(s).forEach(function (rij) {
      var r = Game.util.el('div', 'statrij');
      r.appendChild(Game.util.el('span', 'k', rij[0]));
      r.appendChild(Game.util.el('span', 'v', String(rij[1])));
      tabel.appendChild(r);
    });
    el.appendChild(tabel);

    /* Het verloop erbij: één getal zegt hoe het nú staat, de lijn zegt of het
       de goede kant op gaat. Dat tweede is meestal de vraag. */
    if (Game.ui.grafiek) {
      el.appendChild(Game.util.el('h4', '', 'Het verloop van ' + s.dorpsnaam));
      el.appendChild(Game.ui.grafiek.bouw(s));
    }
  }

  O.statistieken = function () {
    O.open('📊 ' + spel.state.dorpsnaam + ' in cijfers', function (el) {
      statistiekBlok(el, spel.state);
    }, [
      { tekst: '← Terug', primair: true, actie: function () { O.menu(); } },
      { tekst: 'Verder spelen', actie: function () { O.sluit(); } }
    ]);
  };

  /* ------------------------------------------------------------ plaatje -- */

  /* Saves the current view as a PNG. Handy for showing off a town — and it
     works from file:// because the canvas never loads a cross-origin image. */
  O.plaatje = function () {
    var canvas = document.getElementById('canvas');
    try {
      var url = canvas.toDataURL('image/png');
      var a = document.createElement('a');
      a.href = url;
      a.download = (spel.state.dorpsnaam || 'dorp').replace(/[^\w-]+/g, '_') + '.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      Game.ui.toast('📷 Plaatje opgeslagen');
      O.sluit();
    } catch (e) {
      Game.ui.toast('📷 Dat lukte niet in deze browser');
    }
  };

  /* ---------------------------------------------------------- tijdperk -- */

  O.tijdperk = function (age) {
    O.open(age.emoji + ' ' + age.naam,
      '<p style="text-align:center;font-size:16px">' + age.motto + '</p>' +
      '<p style="text-align:center">Er zijn nieuwe gebouwen beschikbaar in het bouwmenu.</p>',
      [{ tekst: 'Verder bouwen', primair: true, actie: function () { O.sluit(); } }]);
  };

  /* -------------------------------------------------------- overwinning -- */

  /* The chronicle: everything the simulation quietly recorded, told back as
     a few paragraphs. Generated on demand from the state (js/core/kroniek.js),
     so it costs a save nothing and can be read at any moment. */
  O.kroniek = function () {
    var s = spel.state;
    var k = Game.core.kroniek.schrijf(s);
    O.open('📜 ' + k.titel, function (el) {
      k.stukken.forEach(function (st) {
        el.appendChild(Game.util.el('h4', '', st.kop));
        if (st.tekst) el.appendChild(Game.util.el('p', '', st.tekst));
        if (st.regels) {
          var ul = Game.util.el('ul');
          st.regels.forEach(function (r) { ul.appendChild(Game.util.el('li', '', r)); });
          el.appendChild(ul);
        }
      });
      el.appendChild(Game.util.el('p', 'midden', k.rang + ' — ' + k.punten + ' punten'));
    }, [
      {
        tekst: '📋 Kopieer als tekst', primair: true, actie: function () {
          var tekst = Game.core.kroniek.alsTekst(spel.state);
          if (navigator.clipboard) {
            navigator.clipboard.writeText(tekst).then(function () {
              Game.ui.toast('📋 De kroniek staat op je klembord');
            }, function () { Game.ui.toast('⚠️ Kopiëren is niet gelukt'); });
          } else {
            Game.ui.toast('⚠️ Kopiëren werkt hier niet');
          }
        }
      },
      { tekst: 'Sluiten', actie: function () { O.sluit(); } }
    ]);
  };

  /* -------------------------------------------------------- uitgestorven -- */

  /* De andere afloop. Er was er tot nu toe maar één: winnen. Een dorp kon
     leeglopen en het spel tikte gewoon door op een lege kaart, alsof er niets
     gebeurd was. Dit is het scherm dat daar hoort — met de kroniek erbij,
     want dit is nu juist het moment waarop je wil lezen hoe het zo ver kwam.

     De autosave is op dit moment al stilgezet (js/main.js), dus wat er in de
     browser ligt is het dorp van hooguit twintig seconden geleden. Dat is
     geen troostprijs maar het echte aanbod: het ging mis, ga terug. */
  O.uitgestorven = function (s) {
    var erIsEenSave = Game.core.save.erIsEenSave();
    var knoppen = [];

    if (erIsEenSave) {
      knoppen.push({
        tekst: '📜 Terug naar de laatste opslag', primair: true, actie: function () {
          spel.laadOpgeslagenSpel();
          O.sluit();
        }
      });
    }
    knoppen.push({ tekst: '🌱 Een nieuw dorp stichten', primair: !erIsEenSave,
      actie: function () { O.nieuwSpelScherm(); } });
    knoppen.push({ tekst: '📜 De kroniek', actie: function () { O.kroniek(); } });
    knoppen.push({ tekst: '👀 Rondkijken', actie: function () { O.sluit(false); } });

    O.open('⚰️ ' + s.dorpsnaam + ' is verlaten', function (el) {
      el.appendChild(Game.util.el('p', 'midden',
        'De laatste inwoner is weg. Wat er staat, staat er nog — maar er is ' +
        'niemand meer om het te bewonen.'));
      el.appendChild(Game.util.el('p', '',
        'Het dorp heeft ' + s.jaar + (s.jaar === 1 ? ' jaar' : ' jaren') +
        ' bestaan. Hieronder staat wat het in die tijd heeft opgebouwd; ' +
        'de kroniek vertelt waar het misging.'));
      statistiekBlok(el, s);
    }, knoppen);
  };

  /* `sc` is the scenario that just ended, if any; `verloren` marks the ones
     with a deadline you did not make. */
  O.overwinning = function (s, sc, verloren) {
    var titel = verloren
      ? '⌛ ' + (sc ? sc.naam : 'Het doel') + ' niet gehaald'
      : (sc && sc.doel ? '👑 ' + sc.emoji + ' ' + sc.naam + ' volbracht!'
                       : '👑 ' + s.dorpsnaam + ' is een stad!');

    O.open(titel, function (el) {
      el.appendChild(Game.util.el('p', 'midden', verloren
        ? 'Dit scenario is niet gelukt — maar je stad staat er nog. Speel gerust door.'
        : (sc && sc.doel
            ? sc.doel.tekst + ' — gehaald in jaar ' + s.jaar + '.'
            : 'Van één boerderij tot een stad met kathedraal, kasteel en universiteit. ' +
              'Dat heb je knap gedaan.')));
      statistiekBlok(el, s);
      if (!verloren) {
        el.appendChild(Game.util.el('h4', '', '📯 En nu?'));
        el.appendChild(Game.util.el('p', '',
          'De kroon verleent je stad een handvest. Vanaf nu opent er telkens een ' +
          'nieuwe termijn: een levering met een deadline, én een norm waar je stad ' +
          'aan moet blijven voldoen. Haal je beide, dan klim je van vrijstad naar ' +
          'hanzestad en uiteindelijk naar keizerlijke vrijstad — elke rang geeft je ' +
          'stad iets blijvends. Je vindt het handvest in het tabblad Stad.'));
      } else {
        el.appendChild(Game.util.el('p', '',
          'Je kunt gewoon doorspelen en je stad nog verder uitbouwen — je score blijft meelopen.'));
      }
    }, [
      { tekst: 'Doorspelen', primair: true, actie: function () { O.sluit(); } },
      { tekst: '📜 De kroniek', actie: function () { O.kroniek(); } },
      { tekst: '📷 Plaatje maken', actie: function () { O.plaatje(); } }
    ]);
  };

  /* Een nieuwe rang is een moment, geen regel in het logboek. */
  O.faamRang = function (s, rang) {
    O.open(rang.emoji + ' ' + s.dorpsnaam + ' is een ' + rang.naam,
      '<p style="text-align:center;font-size:16px">' + rang.tekst + '</p>' +
      '<p style="text-align:center">De volgende termijn opent binnenkort.</p>',
      [{ tekst: 'Verder regeren', primair: true, actie: function () { O.sluit(); } }]);
  };

  Game.ui.overlay = O;

})(window.Game);
