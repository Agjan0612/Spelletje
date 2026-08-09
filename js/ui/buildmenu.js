/* The build bar at the bottom: one tab per age, a card per building. */
(function (Game) {

  var BM = {};
  var spel = null;
  var tabsEl, lijstEl, tipEl = null;
  var actieveTab = 1;

  BM.init = function (hetSpel) {
    spel = hetSpel;
    tabsEl = document.getElementById('build-tabs');
    lijstEl = document.getElementById('build-list');
    bouwTabs();
    BM.toon(1);
  };

  function bouwTabs() {
    tabsEl.innerHTML = '';
    Game.config.ages.forEach(function (age) {
      if (age.nr < 1) return;
      var k = Game.util.el('button', '', age.emoji + ' ' + age.naam);
      k.dataset.tab = age.nr;
      k.addEventListener('click', function () { BM.toon(age.nr); });
      tabsEl.appendChild(k);
    });
  }

  BM.toon = function (nr) {
    actieveTab = nr;
    BM.ververs(spel.state, true);
  };

  /* Same idea as the side panel: only rebuild the cards when something the
     player can see actually changed, so hovering and clicking stay stable. */
  function handtekening(s) {
    var stukken = [actieveTab, s.tijdperk, spel.plaatsType];
    Game.config.buildingList.forEach(function (d) {
      if (d.tijdperk !== actieveTab) return;
      stukken.push(Game.core.state.kanBetalen(s, d.kosten) ? 1 : 0);
      if (d.max) stukken.push(Game.core.construction.aantalGepland(s, d.id));
    });
    return stukken.join('|');
  }

  BM.ververs = function (s, forceer) {
    if (!lijstEl || !s) return;

    var teken = handtekening(s);
    if (!forceer && teken === BM.laatsteTeken) return;
    BM.laatsteTeken = teken;

    Array.prototype.forEach.call(tabsEl.children, function (k) {
      var nr = parseInt(k.dataset.tab, 10);
      k.classList.toggle('active', nr === actieveTab);
      k.classList.toggle('op-slot', nr > s.tijdperk);
    });

    lijstEl.innerHTML = '';
    Game.config.buildingList.forEach(function (d) {
      if (d.tijdperk !== actieveTab) return;

      var vergrendeld = d.tijdperk > s.tijdperk;
      var opMax = d.max && Game.core.construction.aantalGepland(s, d.id) >= d.max;
      var kaart = Game.util.el('div', 'bouwkaart');
      if (vergrendeld || opMax) kaart.classList.add('vergrendeld');
      if (spel.plaatsType === d.id) kaart.classList.add('geselecteerd');

      kaart.appendChild(Game.util.el('div', 'em', d.emoji));
      kaart.appendChild(Game.util.el('div', 'nm', d.naam));

      var ks = Game.util.el('div', 'ks');
      var delen = [];
      for (var r in d.kosten) {
        var genoeg = s.res[r] >= d.kosten[r];
        delen.push('<span class="' + (genoeg ? '' : 'mist') + '">' +
          Game.config.resources[r].emoji + d.kosten[r] + '</span>');
      }
      ks.innerHTML = delen.join(' ') || 'gratis';
      kaart.appendChild(ks);

      if (vergrendeld) {
        kaart.appendChild(Game.util.el('div', 'slot', '🔒'));
      } else if (opMax) {
        kaart.appendChild(Game.util.el('div', 'slot', '✔️'));
      } else if (!Game.core.state.kanBetalen(s, d.kosten)) {
        kaart.classList.add('tekort');
      }

      if (!vergrendeld && !opMax) {
        kaart.addEventListener('click', function () {
          spel.kiesBouw(spel.plaatsType === d.id ? null : d.id);
        });
      }

      kaart.addEventListener('mouseenter', function (ev) { toonTip(d, s, ev.currentTarget); });
      kaart.addEventListener('mouseleave', verbergTip);

      lijstEl.appendChild(kaart);
    });
  };

  /* --------------------------------------------------------------- tooltip */

  function toonTip(d, s, anker) {
    verbergTip();
    tipEl = Game.util.el('div', 'tip');

    var h = Game.util.el('h4', '', d.emoji + '  ' + d.naam);
    tipEl.appendChild(h);
    tipEl.appendChild(Game.util.el('div', 'cursief', d.beschrijving || ''));

    var regels = [];

    var kosten = [];
    for (var r in d.kosten) {
      kosten.push(Game.config.resources[r].emoji + ' ' + d.kosten[r] + ' ' + Game.config.resources[r].naam.toLowerCase());
    }
    if (kosten.length) regels.push(['Kosten', kosten.join(', ')]);
    regels.push(['Bouwtijd', Math.round(d.bouwtijd) + ' sec (sneller met werkloze dorpelingen)']);
    if (d.grootte > 1) regels.push(['Grootte', d.grootte + '×' + d.grootte + ' tegels']);

    if (d.banen) {
      regels.push(['Werkers', d.banen.aantal + '× ' + Game.config.jobs[d.banen.baan].naam]);
    }
    if (d.wint) {
      regels.push(['Wint', Game.config.resources[d.wint.res].emoji + ' ' +
        (d.wint.tempo * 60).toFixed(0) + ' ' + Game.config.resources[d.wint.res].naam.toLowerCase() +
        ' per minuut per werker']);
    }
    if (d.maakt) {
      var inTekst = [];
      for (var ir in d.maakt.in) {
        inTekst.push(Game.config.resources[ir].emoji + ' ' + (d.maakt.in[ir] * 60).toFixed(0));
      }
      var uitTekst = [];
      for (var ur in d.maakt.uit) {
        uitTekst.push(Game.config.resources[ur].emoji + ' ' + (d.maakt.uit[ur] * 60).toFixed(0));
      }
      regels.push(['Maakt', (inTekst.length ? inTekst.join(' + ') + ' → ' : '') + uitTekst.join(' + ') + ' per minuut per werker']);
    }
    if (d.woonruimte) regels.push(['Woonruimte', d.woonruimte + ' inwoners']);
    if (d.opslag) regels.push(['Opslag', '+' + d.opslag + ' per grondstof']);
    if (d.tevredenheid) regels.push(['Tevredenheid', '+' + d.tevredenheid + ' punten']);
    if (d.verdediging) regels.push(['Verdediging', '+' + d.verdediging]);
    if (d.verdPerWerker) regels.push(['Verdediging', '+' + d.verdPerWerker + ' per werker']);
    if (d.productieBonus) regels.push(['Bonus', '+' + Math.round(d.productieBonus * 100) + '% op alle productie']);
    if (d.boerderijBonus) regels.push(['Bonus', '+' + Math.round(d.boerderijBonus * 100) + '% graan voor boerderijen binnen ' + d.boerderijStraal + ' tegels']);
    if (d.onderhoud) {
      var onder = [];
      for (var orr in d.onderhoud) {
        onder.push(Game.config.resources[orr].emoji + ' ' + (d.onderhoud[orr] * 60).toFixed(1) + ' per minuut');
      }
      regels.push(['Onderhoud', onder.join(', ')]);
    }
    if (d.plaats && d.plaats.nabij) {
      regels.push(['Plaatsing', 'binnen ' + d.plaats.nabij.straal + ' tegels van ' +
        Game.core.map.nodeNaam[d.plaats.nabij.node].toLowerCase()]);
    }
    if (d.seizoensgevoelig) regels.push(['Let op', 'de opbrengst hangt af van het seizoen']);
    if (d.max) regels.push(['Maximum', d.max + '×']);
    if (d.tijdperk > s.tijdperk) regels.push(['Vergrendeld', 'beschikbaar vanaf tijdperk ' + d.tijdperk]);

    regels.forEach(function (rij) {
      var el = Game.util.el('div', 'rij');
      el.innerHTML = '<span class="label">' + rij[0] + ':</span> ' + rij[1];
      tipEl.appendChild(el);
    });

    document.body.appendChild(tipEl);
    var r2 = anker.getBoundingClientRect();
    var b = tipEl.getBoundingClientRect();
    var left = Game.util.clamp(r2.left + r2.width / 2 - b.width / 2, 8, window.innerWidth - b.width - 8);
    tipEl.style.left = left + 'px';
    tipEl.style.top = Math.max(8, r2.top - b.height - 8) + 'px';
  }

  function verbergTip() {
    if (tipEl && tipEl.parentNode) tipEl.parentNode.removeChild(tipEl);
    tipEl = null;
  }
  BM.verbergTip = verbergTip;

  Game.ui.buildmenu = BM;

})(window.Game);
