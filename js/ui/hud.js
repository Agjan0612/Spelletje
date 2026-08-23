/* The top bar: resources, population, food, happiness, defence, season, speed. */
(function (Game) {

  var H = {};
  var els = {};
  var resEls = {};

  H.init = function (spel) {
    els.spel = spel;
    els.naam = document.getElementById('townname');
    els.tijdperk = document.getElementById('agename');
    els.primair = document.getElementById('res-primary');
    els.secundair = document.getElementById('res-secondary');
    els.pop = document.querySelector('#stat-pop .val');
    els.voedsel = document.querySelector('#stat-voedsel .val');
    els.voedselIco = document.querySelector('#stat-voedsel .ico');
    els.happy = document.querySelector('#stat-happy .val');
    els.happyIco = document.querySelector('#stat-happy .ico');
    els.def = document.querySelector('#stat-def .val');
    els.defBox = document.getElementById('stat-def');
    els.seizoen = document.querySelector('#stat-season .val');
    els.seizoenIco = document.querySelector('#stat-season .ico');
    els.raid = document.getElementById('raid-warning');

    bouwResourceRij();
    hangTooltips(spel);

    /* Bound once, here — the countdown rebuilds its innerHTML several times a
       second, so the handler has to be delegated rather than per-button. */
    els.raid.addEventListener('click', function (ev) {
      var knop = ev.target.closest('[data-raid]');
      if (!knop || !spel.state) return;
      var s = spel.state;
      var RA = Game.core.raids;
      switch (knop.dataset.raid) {
        case 'uitval':      RA.zetUitval(s); break;
        case 'evacuatie':   RA.zetEvacuatie(s); break;
        case 'burgerwacht': RA.zetBurgerwacht(s); break;
        case 'schatting':
          if (!RA.betaalSchatting(s)) Game.ui.toast('⚠️ Je hebt niet genoeg munten voor de schatting');
          break;
      }
      H.ververs(s);
    });

    var knoppen = document.querySelectorAll('#speeds .spd');
    Array.prototype.forEach.call(knoppen, function (k) {
      k.addEventListener('click', function () {
        spel.zetSnelheid(parseInt(k.dataset.speed, 10));
      });
    });
  };

  function bouwResourceRij() {
    els.primair.innerHTML = '';
    els.secundair.innerHTML = '';

    Game.config.resourceOrder.forEach(function (id) {
      var def = Game.config.resources[id];
      var el = Game.util.el('div', 'res');
      el.appendChild(Game.util.el('span', 'ico', def.emoji));
      var val = Game.util.el('span', 'val', '0');
      el.appendChild(val);
      var delta = Game.util.el('span', 'delta', '');
      el.appendChild(delta);
      (def.primair ? els.primair : els.secundair).appendChild(el);
      resEls[id] = { wrap: el, val: val, delta: delta };

      Game.ui.tip.hang(el, function () { return resTip(id); });
    });
  }

  /* --------------------------------------------------------------- tooltips

     These used to be `title` attributes with newlines in them. The happiness
     breakdown in particular is the game explaining its own hardest number, so
     it deserves better than grey system text after a second of waiting. */
  function hangTooltips(spel) {
    var T = Game.ui.tip;
    T.hang(document.getElementById('stat-pop'), function () { return popTip(spel.state); });
    T.hang(document.getElementById('stat-voedsel'), function () { return voedselTip(spel.state); });
    T.hang(document.getElementById('stat-happy'), function () { return tevredenheidTip(spel.state); });
    T.hang(document.getElementById('stat-def'), function () { return verdedigingTip(spel.state); });
    T.hang(document.getElementById('stat-season'), function () { return seizoenTip(spel.state); });
  }

  function resTip(id) {
    var s = els.spel && els.spel.state;
    if (!s) return '';
    var def = Game.config.resources[id];
    var T = Game.ui.tip;
    var plafond = Game.core.state.plafond(s, id);
    var stroom = s.stroom[id] || 0;
    var soort = Game.config.opslagSoorten[Game.config.resSoort(id)];

    var html = T.kop(def.emoji + '  ' + def.naam);
    html += T.regel('Voorraad', Math.floor(s.res[id]) + ' / ' + plafond +
      (s.res[id] >= plafond - 0.5 ? ' <b>(vol)</b>' : ''));
    html += T.regel('Per seconde', (stroom >= 0 ? '+' : '') +
      (Math.round(stroom * 10) / 10).toString().replace('.', ','));
    html += T.regel('Ligt in', soort.emoji + ' ' + soort.naam);
    if (def.voedsel) html += T.cursief('Wordt opgegeten en bederft langzaam.');
    return html;
  }

  function popTip(s) {
    var T = Game.ui.tip;
    var b = s.bevolking;
    var html = T.kop('👥  Inwoners');
    html += T.regel('Totaal', b.totaal + ' (' + b.ruimte + ' bedden)');
    html += T.regel('Aan het werk', b.werkend);
    html += T.regel('Vrij', b.werkloos + ' — zij bouwen alles');
    html += T.regel('Kinderen', (b.kinderen || 0) + ' · ouderen ' + (b.ouderen || 0));
    if (b.werkloos === 0) html += T.cursief('Niemand vrij: het bouwen ligt zo goed als stil.');
    return html;
  }

  function voedselTip(s) {
    var T = Game.ui.tip;
    var v = Game.core.population.vooruitzicht(s);
    var html = T.kop('🍞  Voedselvoorraad');
    html += T.regel('Voorraad', Math.round(v.voorraad) + ' eten');
    html += T.regel('Reikt tot', v.dagen.toFixed(1) + ' dagen');
    html += T.regel('Verbruik', Math.round(v.perDag) + ' per dag' +
      (s.seizoen === 3 ? ' (winter: meer)' : ''));
    html += T.regel('Winter over', v.dagenTotWinterEind + ' dagen');
    if (v.tekort) {
      html += T.cursief('⚠️ Zo haal je het einde van de winter niet. Zet meer mensen ' +
        'op de akkers, de jacht of de visserij, of koop eten van de koopman.');
    } else {
      html += T.cursief('Genoeg om de winter door te komen.');
    }
    return html;
  }

  function verdedigingTip(s) {
    var T = Game.ui.tip;
    var split = Game.core.raids.verdedigingSplit ? Game.core.raids.verdedigingSplit(s) : null;
    var html = T.kop('🛡️  Verdediging');
    html += T.regel('Totaal', s.verdediging);
    if (split) {
      html += T.regel('Leger', Math.round(split.garnizoen) + ' — kan het veld in');
      html += T.regel('Muren en torens', Math.round(split.positioneel) +
        ' — telt alleen op hun route');
    }
    html += T.cursief('Rovers komen vanaf tijdperk 2 en worden sterker naarmate je stad groeit.');
    return html;
  }

  function seizoenTip(s) {
    var T = Game.ui.tip;
    var S = Game.core.state;
    var dagInSeizoen = (s.dag % S.DAGEN_PER_SEIZOEN) + 1;
    var html = T.kop(Game.core.seasons.emoji(s) + '  ' + Game.core.seasons.naam(s));
    html += T.regel('Dag', dagInSeizoen + ' van ' + S.DAGEN_PER_SEIZOEN);
    html += T.regel('Akkers', Math.round(Game.core.seasons.factor(s, 'akker') * 100) + '%');
    html += T.regel('Jacht en visserij', Math.round(Game.core.seasons.factor(s, 'jacht') * 100) + '%');
    if (s.seizoen === 2) html += T.cursief('Herfst: dé tijd om voorraad aan te leggen.');
    if (s.seizoen === 3) html += T.cursief('Winter: de akkers leveren niets en er wordt hout gestookt.');
    return html;
  }

  /* -------------------------------------------------------------- ververs */

  H.ververs = function (s) {
    els.naam.textContent = s.dorpsnaam;
    var tp = Game.config.age(s.tijdperk);
    els.tijdperk.textContent = 'Tijdperk ' + s.tijdperk + ' — ' + tp.naam;

    var tweedeRijGevuld = false;

    Game.config.resourceOrder.forEach(function (id) {
      var e = resEls[id];

      /* Only the resources this town has actually met. Fourteen counters, of
         which eight sit at nul all through the first age, is not information —
         it is furniture. They appear the moment you produce one or place a
         building that handles it (see s.gezien in core/state.js). */
      var ken = !s.gezien || s.gezien[id] || s.res[id] > 0;
      e.wrap.classList.toggle('hidden', !ken);
      if (!ken) return;
      if (!Game.config.resources[id].primair) tweedeRijGevuld = true;

      var waarde = s.res[id];

      /* Roll the number toward its real value instead of snapping, and tint it
         by which way it is moving, so a rising stock reads gold and a falling
         one reads warm-red. */
      if (e.toon == null) e.toon = waarde;
      var diff = waarde - e.toon;
      if (Math.abs(diff) < 0.6) e.toon = waarde;
      else e.toon += diff * 0.34;
      e.val.textContent = Game.util.fmt(e.toon);
      e.val.classList.toggle('stijgt', diff > 0.6);
      e.val.classList.toggle('daalt', diff < -0.6);

      var stroom = s.stroom[id] || 0;
      if (Math.abs(stroom) >= 0.05) {
        e.delta.textContent = (stroom > 0 ? '+' : '') + (Math.round(stroom * 10) / 10).toString().replace('.', ',');
        e.delta.className = 'delta' + (stroom < 0 ? ' neg' : '');
      } else {
        e.delta.textContent = '';
      }

      /* Ask for *this* resource's ceiling: food, goods and treasure each have
         their own storehouse, and the general s.capaciteit would lie. */
      var plafond = Game.core.state.plafond(s, id);
      e.wrap.classList.toggle('vol', waarde >= plafond - 0.5);
      e.wrap.classList.toggle('leeg', waarde < 1 && stroom < 0);
    });

    els.secundair.classList.toggle('hidden', !tweedeRijGevuld);

    els.pop.textContent = s.bevolking.totaal + ' (' + s.bevolking.werkloos + ' vrij)';

    /* Days of food is the number the whole village runs on, and until now it
       lived three clicks deep in the overview. */
    var v = Game.core.population.vooruitzicht(s);
    els.voedsel.textContent = v.dagen >= 99 ? '99+ d'
      : (v.dagen >= 10 ? Math.round(v.dagen) : v.dagen.toFixed(1).replace('.', ',')) + ' d';
    els.voedselIco.textContent = v.dagen < 3 ? '🥣' : '🍞';
    var voedselBox = document.getElementById('stat-voedsel');
    voedselBox.classList.toggle('slecht', v.dagen < 3);
    voedselBox.classList.toggle('let-op', v.dagen >= 3 && (v.dagen < 6 || v.tekort));

    var h = Math.round(s.tevredenheid);
    els.happy.textContent = h + '%';
    els.happyIco.textContent = h >= 70 ? '😄' : h >= 50 ? '😀' : h >= 30 ? '😐' : '😟';
    document.getElementById('stat-happy').classList.toggle('slecht', h < 30);

    /* The shield is meaningless before raiders exist, so it stays away until
       they can come. */
    els.defBox.classList.toggle('hidden', s.tijdperk < 2 && !s.verdediging);
    els.def.textContent = s.verdediging;

    els.seizoen.textContent = Game.core.seasons.naam(s);
    els.seizoenIco.textContent = Game.core.seasons.emoji(s);

    /* Raid countdown. */
    var raid = Game.core.raids.statusTekst(s);
    if (raid) {
      els.raid.classList.remove('hidden');
      var nieuw = raid.fase === 'beleg' ? belegHtml(raid) : aanvalHtml(raid);
      /* Only touch the DOM when something actually changed: the buttons must
         not be ripped out from under the cursor five times a second. */
      if (nieuw !== els.raidHtml) { els.raid.innerHTML = nieuw; els.raidHtml = nieuw; }
    } else {
      els.raidHtml = '';
      els.raid.classList.add('hidden');
    }

    /* The raid buttons are bound once in init(); binding them here would add
       a fresh listener on every refresh, so a single click would fire dozens
       of times. */
    var knoppen = document.querySelectorAll('#speeds .spd');
    Array.prototype.forEach.call(knoppen, function (k) {
      k.classList.toggle('active', parseInt(k.dataset.speed, 10) === s.snelheid);
    });
  };

  /* The 45 seconds while a band is on its way: how far they have come, how
     much your towers already took off them, and the four things you can do
     about it. */
  function aanvalHtml(raid) {
    var html = '⚔️ ' + raid.naam + ' valt aan over ' + raid.seconden + 's';

    html += '<div class="raidbalk"><i style="width:' +
      Math.round(raid.voortgang * 100) + '%"></i></div>';

    html += '<span class="klein">Nog ~' + raid.kracht + ' man';
    if (raid.afgeslagen > 0) html += ' <b>(−' + raid.afgeslagen + ' door je torens)</b>';
    html += ' · jouw verdediging: ' + raid.verdediging;
    if (raid.wachtendeDekking > 0) html += ' · dekking die nog moet vuren: ' + raid.wachtendeDekking;
    html += '</span>';

    html += '<div class="raidknoppen">';
    if (raid.kanUitval) {
      html += knop('uitval', raid.uitval, raid.uitval ? '⚔️ Uitval bevolen' : '⚔️ Uitval',
        'Trek het veld in. Win je, dan is de bende vernietigd; verlies je, dan sta je zonder mannen op de muur.');
    }
    html += knop('evacuatie', raid.evacuatie, '🏃 Ontruimen',
      'De buitenwijken naar binnen. Daar ligt het werk stil, maar er valt veel minder te roven en er komt niemand om.');
    html += knop('burgerwacht', raid.burgerwacht,
      '🔱 Burgerwacht' + (raid.burgerwachtKracht ? ' (+' + raid.burgerwachtKracht + ')' : ''),
      'Iedereen zonder werk op de muur. Er wordt niets gebouwd zolang ze daar staan.');
    html += knop('schatting', false, '💰 Schatting ' + raid.schatting,
      'Koop ze af. Ze trekken meteen weg — en komen sneller en sterker terug.',
      !raid.kanSchatting);
    html += '</div>';
    return html;
  }

  function belegHtml(raid) {
    var html = '🏕️ ' + raid.naam + ' belegert je stad — nog ' + raid.seconden + 's';
    html += '<span class="klein">Hun kracht: ~' + raid.kracht +
      ' · jouw leger: ' + raid.leger +
      ' · alles buiten de stad ligt stil</span>';
    html += '<div class="raidknoppen">';
    if (raid.kanUitval) {
      html += knop('uitval', raid.uitval, '⚔️ Beleg breken',
        'Val het kamp aan. Is je leger sterk genoeg, dan is het beleg meteen voorbij.');
    }
    html += knop('schatting', false, '💰 Schatting ' + raid.schatting,
      'Koop het beleg af.', !raid.kanSchatting);
    html += '</div>';
    return html;
  }

  function knop(id, actief, tekst, uitleg, uit) {
    return '<button data-raid="' + id + '" title="' + uitleg + '"' +
      (uit ? ' disabled' : '') + ' class="' + (actief ? 'armed' : '') + '">' + tekst + '</button>';
  }

  function tevredenheidTip(s) {
    var T = Game.ui.tip;
    var d = Game.core.population.tevredenheidDetail(s);
    function n(x) { return (x >= 0 ? '+' : '') + Math.round(x); }
    function rij(label, waarde, extra) {
      if (!waarde) return '';
      return '<div class="rij"><span class="label">' + label + '</span> ' +
        '<b class="' + (waarde >= 0 ? 'plus' : 'min') + '">' + n(waarde) + '</b>' +
        (extra ? ' <span class="cursief">' + extra + '</span>' : '') + '</div>';
    }

    var html = T.kop('😀  Tevredenheid ' + Math.round(s.tevredenheid) + '%');
    html += T.cursief('Beweegt langzaam naar ' + Math.round(d.doel) + '%.');
    html += rij('Basis', d.basis);
    html += rij('Voedselvoorraad', d.voedsel);
    html += rij('Afwisseling in eten', d.variatie);
    html += rij('Woonruimte', d.wonen);
    html += rij('Voorzieningen', d.diensten,
      Math.round((d.dekking || 0) * 100) + '% van je huizen bereikt ze');
    html += rij('Aantrekkelijke buurt', d.sfeer);
    html += rij('Kinderen en ouderen', d.generaties);
    html += rij('Standen krijgen niet wat ze vragen', d.stand);
    html += rij('Geen brandhout', d.koude);
    html += rij('Belastingtarief', d.tarief);
    html += rij('Samenhorigheid', d.samen);
    html += rij('Onderzoek', d.onderzoek);
    html += rij('Honger', d.honger);
    html += rij('Moreel', d.moreel, 'feest, rovers, opdrachten');
    return html;
  }

  Game.ui.hud = H;

})(window.Game);
