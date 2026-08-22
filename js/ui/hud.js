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

    /* Delegated so the sortie toggle keeps working through the ~1x/sec
       rebuilds of the countdown. */
    els.raid.addEventListener('click', function (ev) {
      if (!ev.target.closest('#raid-sally')) return;
      if (!spel.state) return;
      Game.core.raids.zetUitval(spel.state);
      H.ververs(spel.state);
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

      e.wrap.classList.toggle('vol', waarde >= s.capaciteit - 0.5);
      e.wrap.classList.toggle('leeg', waarde < 1 && stroom < 0);
      e.wrap.title = Game.config.resources[id].naam + ': ' +
        Math.floor(waarde) + ' / ' + s.capaciteit;
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
      /* Effective defence is what actually meets the raiders in their corridor;
         if it is below the town total, show both so the player learns why. */
      var verd = raid.verdediging < raid.totaal
        ? raid.verdediging + ' <span style="opacity:.7">(van ' + raid.totaal + ')</span>'
        : raid.verdediging;
      var html = '⚔️ Rovers vallen aan over ' + raid.seconden + 's' +
        '<span class="klein">Hun kracht: ~' + raid.kracht +
        ' · verdediging op hun route: ' + verd +
        (raid.leger > 0 ? ' · leger: ' + raid.leger : '') + '</span>';
      /* Your army can meet them in the field instead of holding the walls. */
      if (raid.kanUitval) {
        html += '<button id="raid-sally" class="' + (raid.uitval ? 'armed' : '') + '">' +
          (raid.uitval ? '⚔️ Uitval bevolen — trek terug' : '⚔️ Uitval bevelen (val aan)') + '</button>';
      }
      els.raid.innerHTML = html;
    } else {
      els.raid.classList.add('hidden');
    }

    /* Delegated so the sortie toggle keeps working through the ~1x/sec
       rebuilds of the countdown. */
    els.raid.addEventListener('click', function (ev) {
      if (!ev.target.closest('#raid-sally')) return;
      if (!spel.state) return;
      Game.core.raids.zetUitval(spel.state);
      H.ververs(spel.state);
    });

    var knoppen = document.querySelectorAll('#speeds .spd');
    Array.prototype.forEach.call(knoppen, function (k) {
      k.classList.toggle('active', parseInt(k.dataset.speed, 10) === s.snelheid);
    });
  };

  function tevredenheidUitleg(s) {
    var d = Game.core.population.tevredenheidDetail(s);
    function n(x) { return (x >= 0 ? '+' : '') + Math.round(x); }
    return 'Tevredenheid ' + Math.round(s.tevredenheid) + '%  (streeft naar ' + Math.round(d.doel) + '%)\n' +
      'Basis ' + n(d.basis) + '\n' +
      'Voedselvoorraad ' + n(d.voedsel) + '\n' +
      'Afwisseling in eten ' + n(d.variatie) + '\n' +
      'Woonruimte ' + n(d.wonen) + '\n' +
      'Voorzieningen ' + n(d.diensten) + '\n' +
      'Samenhorigheid ' + n(d.samen) + '\n' +
      (d.onderzoek ? 'Onderzoek ' + n(d.onderzoek) + '\n' : '') +
      (d.honger ? 'HONGER ' + n(d.honger) + '\n' : '') +
      (d.moreel ? 'Moreel ' + n(d.moreel) + ' (feest, rovers, opdrachten)' : '');
  }

  Game.ui.hud = H;

})(window.Game);
