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
        spel.nieuwSpel();
        O.sluit();
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
      { tekst: '❓ Uitleg', actie: function () { O.help(false); } },
      { tekst: '🌱 Nieuw spel', actie: function () {
        O.bevestigNieuw();
      } },
      { tekst: '← Verder spelen', actie: function () { O.sluit(); } }
    ]);
  };

  O.bevestigNieuw = function () {
    O.open('Nieuw spel beginnen?', '<p>Je huidige dorp gaat verloren. Weet je het zeker?</p>', [
      { tekst: 'Ja, nieuw dorp', primair: true, actie: function () {
        spel.nieuwSpel();
        O.sluit();
      } },
      { tekst: 'Nee, terug', actie: function () { O.menu(); } }
    ]);
  };

  /* ------------------------------------------------------- koopman -- */

  O.koopman = function (s) {
    var a = s.handel && s.handel.aanbod;
    if (!a) { Game.ui.toast('🐴 De koopman is al vertrokken'); return; }
    var H = Game.core.handel;
    O.open('🐴 De reizende koopman', function (el) {
      el.innerHTML =
        '<p>Een koopman met een zwaarbeladen kar biedt je een ruil aan:</p>' +
        '<p style="text-align:center;font-size:18px;margin:14px 0">' +
        '<b>' + H.deelTekst(a.geef) + '</b>' +
        ' &nbsp;→&nbsp; ' +
        '<b>' + H.deelTekst(a.krijg) + '</b></p>' +
        '<p>Hij trekt zo weer verder. Ruilen?</p>';
    }, [
      { tekst: '🤝 Ruilen', primair: true, actie: function () {
        var r = Game.core.handel.accepteer(s);
        if (!r.ok) { Game.ui.toast('⚠️ ' + r.reden); return; }
        O.sluit();
      } },
      { tekst: 'Nee, bedankt', actie: function () { O.sluit(); } }
    ]);
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
      el.innerHTML =
        '<p style="text-align:center;font-size:16px">Van één boerderij tot een stad met kathedraal, ' +
        'kasteel en universiteit. Dat heb je knap gedaan.</p>' +
        '<h4>Je stad in cijfers</h4>' +
        '<ul>' +
        '<li>Inwoners: <b>' + s.bevolking.totaal + '</b></li>' +
        '<li>Gebouwen: <b>' + s.gebouwen.length + '</b></li>' +
        '<li>Jaren verstreken: <b>' + s.jaar + '</b></li>' +
        '<li>Tevredenheid: <b>' + Math.round(s.tevredenheid) + '%</b></li>' +
        '<li>Hout verzameld: <b>' + Math.round(s.verzameld.hout) + '</b></li>' +
        '<li>Steen verzameld: <b>' + Math.round(s.verzameld.steen) + '</b></li>' +
        '<li>Edelstenen gedolven: <b>' + Math.round(s.verzameld.edelsteen) + '</b></li>' +
        '</ul>' +
        '<p>Je kunt gewoon doorspelen en je stad nog verder uitbouwen.</p>';
    }, [{ tekst: 'Doorspelen', primair: true, actie: function () { O.sluit(); } }]);
  };

  Game.ui.overlay = O;

})(window.Game);
