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
    var erIsEenSave = Game.core.save.erIsEenSave();
    var knoppen = [];

    if (erIsEenSave) {
      knoppen.push({
        tekst: '📜 Verder spelen', primair: true, actie: function () {
          spel.laadOpgeslagenSpel();
          O.sluit();
        }
      });
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
        'waar je iets mee moet. Kijk in de balk rechtsboven.</li>' +
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
        '<li><b>✋ Verplaatsen</b> in het paneel: een gebouw oppakken en ergens ' +
        'anders neerzetten voor een vijfde van de bouwkosten</li>' +
        '</ul>' +
        '<h4>De knoppen rechtsboven</h4>' +
        '<ul>' +
        '<li>🎉 <b>Feest</b> — voorraad omzetten in een flinke portie tevredenheid</li>' +
        '<li>📚 <b>Onderzoek</b> — munten omzetten in blijvende bonussen ' +
        '(vanaf een gildehuis)</li>' +
        '<li>📋 <b>Overzicht</b> — wat staat er stil? Alles in één lijst</li>' +
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
      el.innerHTML = '<p>Je spel wordt elke 20 seconden automatisch opgeslagen in deze browser.</p>';

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
        Game.core.save.opslaan(spel.state);
        Game.ui.toast('💾 Opgeslagen');
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
      { tekst: '📊 Statistieken', actie: function () { O.statistieken(); } },
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

  /* ------------------------------------------------------- nieuw spel --- */

  /* The set-up screen: name your village, pick how much world you want and
     how rough the bandits are. The seed is optional — fill in the same number
     and you get exactly the same map back. */
  O.nieuwSpelScherm = function () {
    var keuze = {
      naam: spel.verzinNaam(),
      kaart: 'normaal',
      moeilijkheid: 'normaal',
      seed: ''
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

      el.appendChild(Game.util.el('h4', '', 'Grootte van de kaart'));
      knoprij(el, Game.config.kaartmaten, 'kaart');

      el.appendChild(Game.util.el('h4', '', 'Hoe zwaar mag het zijn?'));
      knoprij(el, Game.config.moeilijkheden, 'moeilijkheid');

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
            kaart: keuze.kaart,
            moeilijkheid: keuze.moeilijkheid
          });
          O.sluit();
        }
      },
      { tekst: '← Terug', actie: function () { O.welkom(); } }
    ], false);
  };

  /* -------------------------------------------------- statistieken ------ */

  /* Everything the town has done so far, with a score and a title. Available
     from the menu at any time, not just when you have won. */
  O.statistiekLijst = function (s) {
    var st = Game.core.state.statistiek(s);
    return [
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

  O.overwinning = function (s) {
    O.open('👑 ' + s.dorpsnaam + ' is een stad!', function (el) {
      el.appendChild(Game.util.el('p', 'midden',
        'Van één boerderij tot een stad met kathedraal, kasteel en universiteit. ' +
        'Dat heb je knap gedaan.'));
      statistiekBlok(el, s);
      el.appendChild(Game.util.el('p', '',
        'Je kunt gewoon doorspelen en je stad nog verder uitbouwen — je score blijft meelopen.'));
    }, [
      { tekst: 'Doorspelen', primair: true, actie: function () { O.sluit(); } },
      { tekst: '📷 Plaatje maken', actie: function () { O.plaatje(); } }
    ]);
  };

  Game.ui.overlay = O;

})(window.Game);
