/* The top bar: resources, population, happiness, defence, season, speed. */
(function (Game) {

  var H = {};
  var els = {};
  var resEls = {};

  H.init = function (spel) {
    els.naam = document.getElementById('townname');
    els.tijdperk = document.getElementById('agename');
    els.primair = document.getElementById('res-primary');
    els.secundair = document.getElementById('res-secondary');
    els.pop = document.querySelector('#stat-pop .val');
    els.happy = document.querySelector('#stat-happy .val');
    els.happyIco = document.querySelector('#stat-happy .ico');
    els.def = document.querySelector('#stat-def .val');
    els.seizoen = document.querySelector('#stat-season .val');
    els.seizoenIco = document.querySelector('#stat-season .ico');
    els.raid = document.getElementById('raid-warning');

    bouwResourceRij();

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
      el.title = def.naam;
      el.appendChild(Game.util.el('span', 'ico', def.emoji));
      var val = Game.util.el('span', 'val', '0');
      el.appendChild(val);
      var delta = Game.util.el('span', 'delta', '');
      el.appendChild(delta);
      (def.primair ? els.primair : els.secundair).appendChild(el);
      resEls[id] = { wrap: el, val: val, delta: delta };
    });
  }

  H.ververs = function (s) {
    els.naam.textContent = s.dorpsnaam;
    var tp = Game.config.age(s.tijdperk);
    els.tijdperk.textContent = 'Tijdperk ' + s.tijdperk + ' — ' + tp.naam;

    Game.config.resourceOrder.forEach(function (id) {
      var e = resEls[id];
      var waarde = s.res[id];
      e.val.textContent = Game.util.fmt(waarde);

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
      e.wrap.title = Game.config.resources[id].naam + ': ' +
        Math.floor(waarde) + ' / ' + plafond;
    });

    els.pop.textContent = s.bevolking.totaal + ' (' + s.bevolking.werkloos + ' vrij)';
    document.getElementById('stat-pop').title =
      'Inwoners: ' + s.bevolking.totaal +
      ' · aan het werk: ' + s.bevolking.werkend +
      ' · werkloos: ' + s.bevolking.werkloos +
      ' · woonruimte: ' + s.bevolking.ruimte;

    var h = Math.round(s.tevredenheid);
    els.happy.textContent = h + '%';
    els.happyIco.textContent = h >= 70 ? '😄' : h >= 50 ? '😀' : h >= 30 ? '😐' : '😟';
    document.getElementById('stat-happy').title = tevredenheidUitleg(s);

    els.def.textContent = s.verdediging;
    document.getElementById('stat-def').title =
      'Verdediging tegen rovers: ' + s.verdediging +
      (s.tijdperk < 2 ? ' (rovers verschijnen vanaf tijdperk 2)' : '');

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

  function tevredenheidUitleg(s) {
    var d = Game.core.population.tevredenheidDetail(s);
    function n(x) { return (x >= 0 ? '+' : '') + Math.round(x); }
    return 'Tevredenheid ' + Math.round(s.tevredenheid) + '%  (streeft naar ' + Math.round(d.doel) + '%)\n' +
      'Basis ' + n(d.basis) + '\n' +
      'Voedselvoorraad ' + n(d.voedsel) + '\n' +
      'Afwisseling in eten ' + n(d.variatie) + '\n' +
      'Woonruimte ' + n(d.wonen) + '\n' +
      'Voorzieningen ' + n(d.diensten) + ' (' + Math.round((d.dekking || 0) * 100) + '% van je huizen bereikt ze)\n' +
      'Aantrekkelijke buurt ' + n(d.sfeer) + '\n' +
      'Kinderen en ouderen ' + n(d.generaties) + '\n' +
      (d.stand ? 'Standen krijgen niet wat ze vragen ' + n(d.stand) + '\n' : '') +
      (d.koude ? 'GEEN BRANDHOUT ' + n(d.koude) + '\n' : '') +
      (d.tarief ? 'Belastingtarief ' + n(d.tarief) + '\n' : '') +
      'Samenhorigheid ' + n(d.samen) + '\n' +
      (d.onderzoek ? 'Onderzoek ' + n(d.onderzoek) + '\n' : '') +
      (d.honger ? 'HONGER ' + n(d.honger) + '\n' : '') +
      (d.moreel ? 'Moreel ' + n(d.moreel) + ' (feest, rovers, opdrachten)' : '');
  }

  Game.ui.hud = H;

})(window.Game);
