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
    els.faam = document.querySelector('#stat-faam .val');
    els.pop = document.querySelector('#stat-pop .val');
    els.happy = document.querySelector('#stat-happy .val');
    els.happyIco = document.querySelector('#stat-happy .ico');
    els.def = document.querySelector('#stat-def .val');
    els.seizoen = document.querySelector('#stat-season .val');
    els.seizoenIco = document.querySelector('#stat-season .ico');
    els.raid = document.getElementById('raid-warning');
    els.calendar = document.getElementById('calendar');
    els.handel = document.getElementById('btn-handel');

    var boek = document.getElementById('btn-boek');
    if (boek) boek.addEventListener('click', function () { Game.ui.overlay.stadsboek(); });
    if (els.handel) els.handel.addEventListener('click', function () { Game.ui.overlay.handel(); });

    bouwResourceRij();

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

  /* The Faam counter visibly ticks up toward its true value instead of
     snapping, which is what makes a rising number feel rewarding. */
  H.faamGetoond = 0;

  H.ververs = function (s) {
    els.naam.textContent = s.dorpsnaam;
    var tp = Game.config.age(s.tijdperk);
    els.tijdperk.textContent = 'Tijdperk ' + s.tijdperk + ' — ' + tp.naam;

    if (els.faam && Game.core.faam) {
      var doel = Game.core.faam.bereken(s);
      var verschil = doel - H.faamGetoond;
      if (Math.abs(verschil) < 1) H.faamGetoond = doel;
      else H.faamGetoond += verschil * 0.28 + (verschil > 0 ? 1 : -1);
      els.faam.textContent = Game.util.fmt(Math.round(H.faamGetoond));
      document.getElementById('stat-faam').title = faamUitleg(s);
      /* A soft tick when the shown value is still climbing toward a higher goal. */
      if (Game.ui.audio && Game.ui.audio.tik && doel - H.faamGetoond > 3 && s.snelheid > 0) {
        H.faamTikTeller = (H.faamTikTeller || 0) + 1;
        if (H.faamTikTeller % 3 === 0) Game.ui.audio.tik(0.05);
      }
    }

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

    if (els.calendar) els.calendar.innerHTML = kalenderHTML(s);
    if (els.handel) {
      var koopmanEr = Game.core.handel && Game.core.handel.actief(s);
      els.handel.classList.toggle('hidden', !koopmanEr);
      if (koopmanEr) els.handel.title = 'De koopman is er — nog ' + Game.core.handel.seconden(s) + 's';
    }

    /* Raid countdown. */
    var raid = Game.core.raids.statusTekst(s);
    if (raid) {
      els.raid.classList.remove('hidden');
      /* Effective defence is what actually meets the raiders in their corridor;
         if it is below the town total, show both so the player learns why. */
      var verd = raid.verdediging < raid.totaal
        ? raid.verdediging + ' <span style="opacity:.7">(van ' + raid.totaal + ')</span>'
        : raid.verdediging;
      els.raid.innerHTML = '⚔️ Rovers vallen aan over ' + raid.seconden + 's' +
        '<span class="klein">Hun kracht: ~' + raid.kracht +
        ' · verdediging op hun route: ' + verd + '</span>';
    } else {
      els.raid.classList.add('hidden');
    }

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
      (d.honger ? 'HONGER ' + n(d.honger) + '\n' : '') +
      (d.beleid ? 'Beleid ' + n(d.beleid) + '\n' : '') +
      (d.moreel ? 'Moreel ' + n(d.moreel) : '');
  }

  /* Calendar strip: the four seasons with the current one lit, plus what's
     coming — the winter to brace for, or the merchant to catch. This is the
     "anticipation" layer: you play toward the next beat instead of being
     surprised by it. */
  function kalenderHTML(s) {
    var emojis = Game.core.state.SEIZOEN_EMOJI;
    var namen = Game.core.state.SEIZOENEN;
    var perSeizoen = Game.core.state.DAGEN_PER_SEIZOEN;
    var dagInSeizoen = s.dag % perSeizoen;

    var pips = '';
    for (var i = 0; i < 4; i++) {
      pips += '<span class="pip' + (i === s.seizoen ? ' nu' : '') +
        (i === 3 ? ' winter' : '') + '" title="' + namen[i] + '">' + emojis[i] + '</span>';
    }
    var frac = Math.round((dagInSeizoen / perSeizoen) * 100);

    var volgende;
    if (Game.core.handel && Game.core.handel.actief(s)) {
      volgende = '🐴 koopman vertrekt over ' + Game.core.handel.seconden(s) + 's';
    } else if (s.raid && s.raid.fase === 'waarschuwing') {
      volgende = '⚔️ rovers over ' + Math.ceil(s.raid.timer) + 's';
    } else if (s.seizoen < 3) {
      var n = (3 - s.seizoen) * perSeizoen - dagInSeizoen;
      volgende = '❄️ winter over ' + n + ' ' + (n === 1 ? 'dag' : 'dagen');
    } else {
      var n2 = perSeizoen - dagInSeizoen;
      volgende = '🌱 lente over ' + n2 + ' ' + (n2 === 1 ? 'dag' : 'dagen');
    }

    return '<div class="cal-pips">' + pips + '</div>' +
      '<div class="cal-bar"><i style="width:' + frac + '%"></i></div>' +
      '<div class="cal-next">' + volgende + '</div>';
  }

  function faamUitleg(s) {
    var d = Game.core.faam.detail(s);
    function r(x) { return (x >= 0 ? '+' : '') + Math.round(x); }
    var record = Game.core.faam.record();
    var regels = [
      'Faam ' + Game.core.faam.bereken(s) + (record ? '   (record ' + record + ')' : ''),
      'Inwoners ' + r(d.inwoners),
      'Gebouwen ' + r(d.gebouwen),
      'Tijdperk ' + r(d.tijdperk),
      'Welvaart ' + r(d.welvaart),
      'Tevredenheid ' + r(d.tevredenheid)
    ];
    if (d.winters) regels.push('Overleefde winters ' + r(d.winters));
    if (d.rovers) regels.push('Rovers verjaagd ' + r(d.rovers));
    if (d.mijlpalen) regels.push('Mijlpalen ' + r(d.mijlpalen));
    if (d.voltooid) regels.push('Voltooide stad ' + r(d.voltooid));
    return regels.join('\n');
  }

  Game.ui.hud = H;

})(window.Game);
