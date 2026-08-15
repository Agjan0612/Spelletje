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
    knoppen.push({ tekst: '🎲 Kies een zaad', actie: function () { O.zaadKiezen(); } });
    knoppen.push({ tekst: '❓ Hoe speel ik dit?', actie: function () { O.help(true); } });

    var record = Game.core.faam ? Game.core.faam.record() : 0;
    var behaald = Game.core.mijlpalen ? Game.core.mijlpalen.aantalBehaald() : 0;

    O.open('🏰 Dorp tot Stad', function (el) {
      el.innerHTML =
        '<p>Je begint met een handvol dorpelingen, een boerderij en een groot stuk wildernis. ' +
        'Verzamel <b>vlees, hout, steen, ijzer, koper en edelstenen</b>, bouw je nederzetting uit ' +
        'en klim door vier tijdperken heen naar een echte middeleeuwse stad.</p>' +
        (record ? '<p class="welkom-record">⭐ Jouw hoogste faam: <b>' + record + '</b>' +
          (behaald ? '   ·   🏅 ' + behaald + ' mijlpalen verzameld' : '') + '</p>' : '') +
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
      el.innerHTML = '<p>Je spel wordt elke 20 seconden automatisch opgeslagen in deze browser.</p>' +
        '<p class="klein">🎲 Zaad van dit dorp: <b>' + (spel.state ? spel.state.seed : '?') +
        '</b> — deel het en speel dezelfde kaart.</p>';

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
      { tekst: '📮 Postkaart', actie: function () { O.postkaart(); } },
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

  /* ---------------------------------------------------------- tijdperk -- */

  O.tijdperk = function (age) {
    O.open(age.emoji + ' ' + age.naam,
      '<p style="text-align:center;font-size:16px">' + age.motto + '</p>' +
      '<p style="text-align:center">Er zijn nieuwe gebouwen beschikbaar in het bouwmenu.</p>',
      [{ tekst: 'Verder bouwen', primair: true, actie: function () { O.sluit(); } }]);
  };

  /* -------------------------------------------------------- overwinning -- */

  O.overwinning = function (s) {
    var uitslag = Game.core.faam ? Game.core.faam.bewaarRecord(s) : { waarde: 0, nieuw: false, record: 0 };
    var behaald = Object.keys(s.mijlpalenGedaan || {}).length;
    O.open('👑 ' + s.dorpsnaam + ' is een stad!', function (el) {
      el.innerHTML =
        '<p style="text-align:center;font-size:16px">Van één boerderij tot een stad met kathedraal, ' +
        'kasteel en universiteit. Dat heb je knap gedaan.</p>' +
        '<div class="zege-faam">⭐ Faam ' + uitslag.waarde +
        (uitslag.nieuw ? ' <span class="nieuw-record">🏆 nieuw record!</span>' :
          '<span class="klein"> (record ' + uitslag.record + ')</span>') + '</div>' +
        '<h4>Je stad in cijfers</h4>' +
        '<ul>' +
        '<li>Inwoners: <b>' + s.bevolking.totaal + '</b></li>' +
        '<li>Gebouwen: <b>' + s.gebouwen.length + '</b></li>' +
        '<li>Jaren verstreken: <b>' + s.jaar + '</b></li>' +
        '<li>Winters overleefd: <b>' + (s.wintersOverleefd || 0) + '</b>' +
          (s.raidsVerjaagd ? '   ·   Rovers verjaagd: <b>' + s.raidsVerjaagd + '</b>' : '') + '</li>' +
        '<li>Mijlpalen deze stad: <b>' + behaald + '</b></li>' +
        (Game.config.streekLabel(s) ? '<li>Streek: <b>' + Game.config.streekLabel(s) + '</b></li>' : '') +
        '</ul>' +
        '<p>Blijf gerust doorbouwen aan een nog grotere stad — je Faam blijft stijgen. ' +
        'Of probeer een nieuw zaad voor een heel andere uitdaging.</p>';
    }, [
      { tekst: 'Doorspelen', primair: true, actie: function () { O.sluit(); } },
      { tekst: '📮 Postkaart delen', actie: function () { O.postkaart(); } }
    ]);
  };

  /* ===================================================================== */
  /* ============================ Stadsboek ============================== */
  /* One discoverable place for the engagement systems: town edicts, the
     trophy cabinet, the named notables and the land's traits. */

  var el = Game.util.el;
  function resNaam(r) { return Game.config.resources[r].emoji + ' ' + Game.config.resources[r].naam.toLowerCase(); }

  O.stadsboek = function (tab) {
    tab = tab || O._boekTab || 'beleid';
    O._boekTab = tab;
    var s = spel.state;
    O.open('📖 Stadsboek', function (root) {
      var tabs = [['beleid', '📜 Beleid'], ['mijlpalen', '🏅 Prijzenkast'],
                  ['notabelen', '👤 Notabelen'], ['streek', '🗺️ Streek']];
      var bar = el('div', 'boek-tabs');
      tabs.forEach(function (t) {
        var b = el('button', t[0] === tab ? 'actief' : '', t[1]);
        b.addEventListener('click', function () { O.stadsboek(t[0]); });
        bar.appendChild(b);
      });
      root.appendChild(bar);
      var body = el('div', 'boek-body');
      root.appendChild(body);
      if (tab === 'beleid') bouwBeleid(body, s);
      else if (tab === 'mijlpalen') bouwMijlpalen(body, s);
      else if (tab === 'notabelen') bouwNotabelen(body, s);
      else bouwStreek(body, s);
    }, [{ tekst: 'Sluiten', primair: true, actie: function () { O.sluit(); } }]);
  };

  function bouwBeleid(body, s) {
    body.appendChild(el('p', 'boek-invloed', '⚜️ Invloed: ' + Math.floor(s.invloed || 0) +
      '   — groeit vanzelf; een stadhuis en gildehuis versnellen het.'));
    body.appendChild(el('p', 'klein', 'Edicten zijn blijvende keuzes met een prijs. Per groep kies je er één.'));

    var groepen = {}, volgorde = ['economie', 'volk', 'bestuur'];
    var groepNaam = { economie: 'Economie', volk: 'Volk', bestuur: 'Handel & bestuur' };
    Game.config.beleid.forEach(function (e) { (groepen[e.groep] = groepen[e.groep] || []).push(e); });

    volgorde.forEach(function (g) {
      if (!groepen[g]) return;
      body.appendChild(el('h4', '', groepNaam[g] || g));
      var gekozen = Game.core.beleid.inGroep(s, g);
      groepen[g].forEach(function (e) {
        var aan = !!(s.beleid && s.beleid[e.id]);
        var card = el('div', 'edict' + (aan ? ' aan' : (gekozen ? ' vergrendeld' : '')));
        card.innerHTML = '<div class="edict-kop">' + e.emoji + ' <b>' + e.naam + '</b>' +
          '<span class="edict-kost">⚜️ ' + e.kosten + '</span></div>' +
          '<div class="edict-tekst">' + e.beschrijving + '</div>';
        var check = Game.core.beleid.kanKiezen(s, e.id);
        var knop = el('button', '', aan ? '✓ Van kracht' : (gekozen ? 'Vergrendeld' : 'Afkondigen'));
        knop.disabled = aan || !check.ok;
        if (!aan && !check.ok && !gekozen) knop.title = check.reden;
        knop.addEventListener('click', function () {
          var r = Game.core.beleid.kies(s, e.id);
          if (r.ok) { Game.ui.hud.ververs(s); O.stadsboek('beleid'); }
          else Game.ui.toast('⚠️ ' + r.reden);
        });
        card.appendChild(knop);
        body.appendChild(card);
      });
    });
  }

  function bouwMijlpalen(body, s) {
    var kast = Game.core.mijlpalen.kast(s);
    var behaald = kast.filter(function (x) { return x.behaald; }).length;
    body.appendChild(el('p', '', behaald + ' van ' + kast.length +
      ' mijlpalen behaald (verzameld over al je spellen).'));
    var grid = el('div', 'mijlpaal-grid');
    kast.forEach(function (m) {
      var c = el('div', 'mijlpaal' + (m.behaald ? ' behaald' : '') + (m.ditSpel ? ' ditspel' : ''));
      c.innerHTML = '<div class="m-emoji">' + (m.behaald ? m.emoji : '🔒') + '</div>' +
        '<div class="m-titel">' + m.titel + '</div>' +
        '<div class="m-tekst">' + m.beschrijving + '</div>' +
        '<div class="m-faam">+' + m.faam + ' faam</div>';
      grid.appendChild(c);
    });
    body.appendChild(grid);
  }

  function bouwNotabelen(body, s) {
    var lijst = Game.core.notabelen.lijst(s);
    if (!lijst.length) {
      body.appendChild(el('p', '', 'Je stad heeft nog geen notabelen. Bouw een stadhuis, kerk, ' +
        'herberg, smederij of universiteit — dan staat er vanzelf iemand aan het hoofd.'));
      return;
    }
    body.appendChild(el('p', 'klein', 'De gezichten achter je stad. Hun humeur volgt hoe het écht gaat.'));
    var wrap = el('div', 'notabelen');
    lijst.forEach(function (n) {
      var c = el('div', 'notabele');
      c.innerHTML = '<div class="n-emoji">' + n.emoji + '</div>' +
        '<div class="n-info"><div class="n-naam">' + n.naam + '</div>' +
        '<div class="n-titel">' + n.titel + '</div>' +
        '<div class="n-humeur">“' + n.humeur + '”</div></div>';
      wrap.appendChild(c);
    });
    body.appendChild(wrap);
  }

  function bouwStreek(body, s) {
    if (!s.streken || !s.streken.length) {
      body.appendChild(el('p', '', 'Deze streek heeft geen bijzondere eigenschappen — een neutrale start.'));
    } else {
      s.streken.forEach(function (id) {
        var st = Game.config.streek(id);
        if (!st) return;
        var c = el('div', 'streek-kaart ' + (st.goed ? 'goed' : 'slecht'));
        c.innerHTML = '<div class="s-kop">' + st.emoji + ' <b>' + st.naam + '</b>' +
          '<span class="badge ' + (st.goed ? 'goed' : 'slecht') + '">' +
          (st.goed ? 'zegen' : 'vloek') + '</span></div>' +
          '<div class="s-tekst">' + st.beschrijving + '</div>';
        body.appendChild(c);
      });
    }
    body.appendChild(el('p', 'klein', 'Elk zaad heeft zijn eigen streken. Deel je zaad (☰ Menu) en een ' +
      'vriend speelt exact deze kaart.'));
  }

  /* ============================== Handel ============================== */

  O.handel = function () {
    var s = spel.state;
    if (!Game.core.handel || !Game.core.handel.actief(s)) { Game.ui.toast('🐴 Er is nu geen koopman.'); return; }
    O.open('🐴 De reizende koopman', function (root) {
      root.appendChild(el('p', '', '"Goede handel vandaag!" — de koopman blijft nog ' +
        Game.core.handel.seconden(s) + ' seconden. Koersen volgen vraag en aanbod.'));
      var aanbod = s.handel.aanbod || [];
      if (!aanbod.length) {
        root.appendChild(el('p', '', 'Hij heeft vandaag niets wat jou van pas komt. Kom straks terug.'));
        return;
      }
      var lijst = el('div', 'handel-lijst');
      aanbod.forEach(function (deal, idx) {
        var kaart = el('div', 'deal' + (deal.gedaan ? ' gedaan' : ''));
        var tekst = deal.type === 'verkoop'
          ? 'Verkoop <b>' + deal.aantal + ' ' + resNaam(deal.geef) + '</b> voor <b>' + deal.munten + ' 🪙</b>'
          : 'Koop <b>' + deal.aantal + ' ' + resNaam(deal.krijg) + '</b> voor <b>' + deal.munten + ' 🪙</b>';
        kaart.innerHTML = '<span class="deal-tekst">' + tekst + '</span>';
        var knop = el('button', '', deal.gedaan ? '✓ Gedaan' : 'Ruilen');
        knop.disabled = deal.gedaan || !Game.core.handel.kanRuilen(s, deal);
        if (!deal.gedaan && !Game.core.handel.kanRuilen(s, deal)) knop.title = 'Niet genoeg voorraad';
        knop.addEventListener('click', function () {
          if (Game.core.handel.ruil(s, idx)) { Game.ui.hud.ververs(s); O.handel(); }
        });
        kaart.appendChild(knop);
        lijst.appendChild(kaart);
      });
      root.appendChild(lijst);
    }, [{ tekst: 'Klaar', primair: true, actie: function () { O.sluit(); } }]);
  };

  /* ========================= Zaad / uitdaging ========================= */

  function tekstHash(str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    return (h >>> 0) % 1000000000;
  }
  function dagZaad() {
    var d = new Date();
    return tekstHash(d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate());
  }

  O.zaadKiezen = function () {
    var record = Game.core.faam ? Game.core.faam.record() : 0;
    O.open('🎲 Kies een zaad', function (root) {
      root.innerHTML = '<p>Elk zaad geeft dezelfde kaart, dezelfde streken en dezelfde uitdaging. ' +
        'Deel een zaad en speel dezelfde wereld als een vriend.</p>';
      var rij = el('div', 'zaad-rij');
      var inp = el('input');
      inp.id = 'zaad-invoer'; inp.type = 'number'; inp.placeholder = 'bijv. 12345';
      rij.appendChild(inp);
      root.appendChild(rij);
      var dz = dagZaad();
      root.appendChild(el('p', 'klein', '🗓️ Zaad van vandaag: ' + dz +
        (Game.core.faam ? '  ·  jouw record hierop: ' + Game.core.faam.recordVoorZaad(dz) : '')));
    }, [
      { tekst: '▶️ Start met dit zaad', primair: true, actie: function () {
        var v = parseInt(document.getElementById('zaad-invoer').value, 10);
        spel.nieuwSpel(isNaN(v) ? undefined : v);
        O.sluit();
      } },
      { tekst: '🗓️ Uitdaging van vandaag', actie: function () { spel.nieuwSpel(dagZaad()); O.sluit(); } },
      { tekst: '← Terug', actie: function () { O.welkom(); } }
    ]);
  };

  /* ============================= Postkaart ============================ */

  O.postkaartTekst = function (s) {
    var faam = Game.core.faam ? Game.core.faam.bereken(s) : 0;
    var tp = Game.config.age(s.tijdperk);
    var regels = [
      '🏰 ' + s.dorpsnaam + ' — ' + tp.emoji + ' ' + tp.naam,
      '⭐ Faam ' + faam + '   👥 ' + s.bevolking.totaal + ' inwoners   🗓️ jaar ' + s.jaar,
      '😀 ' + Math.round(s.tevredenheid) + '% tevreden   🏗️ ' + s.gebouwen.length + ' gebouwen',
      '🏅 ' + Object.keys(s.mijlpalenGedaan || {}).length + ' mijlpalen behaald',
      (Game.config.streekLabel && Game.config.streekLabel(s) ? '🗺️ ' + Game.config.streekLabel(s) : ''),
      '🎲 Speel dezelfde kaart met zaad ' + s.seed,
      'Gebouwd in Dorp tot Stad 🌾'
    ];
    return regels.filter(function (r) { return r; }).join('\n');
  };

  O.postkaart = function () {
    var s = spel.state;
    O.open('📮 Postkaart van ' + s.dorpsnaam, function (root) {
      root.appendChild(el('p', '', 'Deel je stad! Kopieer deze kaart en stuur hem door — met het zaad ' +
        'speelt de ontvanger exact jouw wereld.'));
      var ta = el('textarea');
      ta.id = 'postkaart-tekst'; ta.readOnly = true; ta.rows = 8;
      ta.value = O.postkaartTekst(s);
      root.appendChild(ta);
    }, [
      { tekst: '📋 Kopieer', primair: true, actie: function () {
        var ta = document.getElementById('postkaart-tekst');
        ta.select();
        try { document.execCommand('copy'); Game.ui.toast('📋 Postkaart gekopieerd'); }
        catch (e) { Game.ui.toast('Selecteer de tekst en kopieer met Ctrl+C'); }
      } },
      { tekst: 'Sluiten', actie: function () { O.sluit(); } }
    ]);
  };

  Game.ui.overlay = O;

})(window.Game);
