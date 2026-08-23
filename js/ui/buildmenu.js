/* The build bar at the bottom: one tab per kind of building, a card each.
 *
 * The tabs used to be the four ages, which answers a question nobody asks. A
 * player in the fourth age who wants another cottage does not think "that was
 * age one" — they think "a house". So the drawers are what a building *does*,
 * every drawer holds everything of that kind from every age, and the ones
 * that are still locked sit greyed at the back so you can see what is coming.
 */
(function (Game) {

  var BM = {};
  var spel = null;
  var tabsEl, lijstEl;
  /* Ids of the cards you can actually click, in the order they are shown —
     that order is what Shift+1..9 selects from. */
  var zichtbaar = [];

  /* Which drawer a building belongs in. Derived from what it does, so a new
     entry in config lands somewhere sensible without another field to fill in.

     Two orders live here and they are not the same: the array is the order of
     the tabs, roughly the order in which a town needs them, while `prio` is
     the order in which the tests are tried. A castle stores goods and pleases
     the neighbourhood, but it is a fortress, so defence has to be asked
     before storage even though its tab comes last. */
  BM.SOORTEN = [
    { id: 'wonen',     naam: 'Wonen',        emoji: '🏠', prio: 10,
      test: function (d) { return d.woonruimte; } },
    { id: 'voedsel',   naam: 'Voedsel',      emoji: '🌾', prio: 20,
      test: function (d) {
        return Game.core.population.isVoedselgebouw(d) || d.boerderijBonus || d.visserijBonus;
      } },
    { id: 'grondstof', naam: 'Grondstoffen', emoji: '🪵', prio: 30,
      test: function (d) { return d.wint; } },
    { id: 'opslag',    naam: 'Opslag',       emoji: '📦', prio: 70,
      test: function (d) { return d.opslag || d.opslagPer; } },
    { id: 'diensten',  naam: 'Voorzieningen', emoji: '⛪', prio: 50,
      test: function (d) { return d.tevredenheid && d.bereik; } },
    { id: 'ambacht',   naam: 'Ambacht',      emoji: '🔨', prio: 60,
      test: function (d) { return d.maakt || d.productieBonus; } },
    { id: 'handel',    naam: 'Handel',       emoji: '🪙', prio: 45,
      test: function (d) { return d.maakt && d.maakt.uit && d.maakt.uit.munten; } },
    { id: 'verdediging', naam: 'Verdediging', emoji: '🛡️', prio: 40,
      test: function (d) { return d.verdediging || d.verdPerWerker; } },
    { id: 'straten',   naam: 'Straten',      emoji: '🛣️', prio: 80,
      test: function (d) { return d.weg; } },
    { id: 'overig',    naam: 'Overig',       emoji: '🧱', prio: 990,
      test: function () { return true; } }
  ];

  var opPrio = BM.SOORTEN.slice().sort(function (a, b) { return a.prio - b.prio; });

  BM.soortVan = function (d) {
    for (var i = 0; i < opPrio.length; i++) {
      if (opPrio[i].test(d)) return opPrio[i].id;
    }
    return 'overig';
  };

  var actieveTab = 'wonen';

  BM.init = function (hetSpel) {
    spel = hetSpel;
    tabsEl = document.getElementById('build-tabs');
    lijstEl = document.getElementById('build-list');
    bouwTabs();
    BM.toon(actieveTab);
  };

  /* Buildings of one kind, unlocked first and then the locked ones, each
     group ordered by the age they arrive in. */
  function inTab(id) {
    var lijst = Game.config.buildingList.filter(function (d) {
      return !d.verborgen && d.tijdperk > 0 && BM.soortVan(d) === id;
    });
    lijst.sort(function (a, b) { return a.tijdperk - b.tijdperk; });
    return lijst;
  }

  function bouwTabs() {
    tabsEl.innerHTML = '';
    BM.SOORTEN.forEach(function (soort) {
      if (!inTab(soort.id).length) return;      /* never show an empty drawer */
      var k = Game.util.el('button', '', soort.emoji + ' ' + soort.naam);
      k.dataset.tab = soort.id;
      k.addEventListener('click', function () { BM.toon(soort.id); });
      tabsEl.appendChild(k);
    });
  }

  BM.toon = function (id) {
    actieveTab = id;
    BM.ververs(spel.state, true);
  };

  /* Same idea as the side panel: only rebuild the cards when something the
     player can see actually changed, so hovering and clicking stay stable. */
  function handtekening(s) {
    var stukken = [actieveTab, s.tijdperk, spel.plaatsType];
    inTab(actieveTab).forEach(function (d) {
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
      k.classList.toggle('active', k.dataset.tab === actieveTab);
      /* A drawer with nothing unlocked in it yet is dimmed rather than
         hidden: seeing that "Verdediging" exists is half the hint. */
      var open = inTab(k.dataset.tab).some(function (d) { return d.tijdperk <= s.tijdperk; });
      k.classList.toggle('op-slot', !open);
    });

    lijstEl.innerHTML = '';
    zichtbaar = [];
    inTab(actieveTab).forEach(function (d) {
      var vergrendeld = d.tijdperk > s.tijdperk;
      var opMax = d.max && Game.core.construction.aantalGepland(s, d.id) >= d.max;
      var kaart = Game.util.el('div', 'bouwkaart');
      if (vergrendeld || opMax) kaart.classList.add('vergrendeld');
      if (spel.plaatsType === d.id) kaart.classList.add('geselecteerd');

      var em = Game.util.el('div', 'em');
      /* The real iso volume you are about to place, cached per building. Falls
         back to the top-down sprite, then to the emoji. */
      var miniBron = Game.render.sprites && Game.render.sprites.miniatuurBron &&
        Game.render.sprites.miniatuurBron(d, 60, s.tijdperk);
      var spritePad = Game.render.atlas && Game.render.atlas.gebouwPad(d.id);
      if (miniBron) {
        var mini = document.createElement('img');
        mini.className = 'mini';
        mini.alt = '';
        mini.onerror = function () { em.textContent = d.emoji; };
        mini.src = miniBron;
        em.appendChild(mini);
      } else if (spritePad) {
        var thumb = document.createElement('img');
        thumb.className = 'sprite';
        thumb.alt = '';
        thumb.onerror = function () { em.textContent = d.emoji; };
        thumb.src = spritePad;
        em.appendChild(thumb);
      } else {
        em.textContent = d.emoji;
      }
      kaart.appendChild(em);
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
        zichtbaar.push(d.id);
        if (zichtbaar.length <= 9) {
          kaart.appendChild(Game.util.el('div', 'hk', '⇧' + zichtbaar.length));
        }
      }

      kaart.addEventListener('mouseenter', function (ev) { toonTip(d, s, ev.currentTarget); });
      kaart.addEventListener('mouseleave', verbergTip);

      lijstEl.appendChild(kaart);
    });
  };

  /* Shift + number: pick the n-th clickable building in the open tab. */
  BM.kiesIndex = function (i) {
    var id = zichtbaar[i];
    if (!id) return;
    spel.kiesBouw(spel.plaatsType === id ? null : id);
  };

  /* --------------------------------------------------------------- tooltip

     Everything the card cannot fit: what it makes, what it costs to keep, and
     where it is allowed to stand. Drawn by the shared tooltip in js/ui/tip.js,
     the same box the HUD uses. */

  function toonTip(d, s, anker) {
    var T = Game.ui.tip;
    var html = T.kop(d.emoji + '  ' + d.naam) + T.cursief(d.beschrijving || '');

    var kosten = [];
    for (var r in d.kosten) {
      kosten.push(Game.config.resources[r].emoji + ' ' + d.kosten[r] + ' ' + Game.config.resources[r].naam.toLowerCase());
    }
    if (kosten.length) html += T.regel('Kosten', kosten.join(', '));
    html += T.regel('Bouwtijd', Math.round(d.bouwtijd) + ' sec (sneller met werkloze dorpelingen)');
    if (d.grootte > 1) html += T.regel('Grootte', d.grootte + '×' + d.grootte + ' tegels');

    if (d.banen) {
      html += T.regel('Werkers', d.banen.aantal + '× ' + Game.config.jobs[d.banen.baan].naam);
    }
    if (d.wint) {
      html += T.regel('Wint', Game.config.resources[d.wint.res].emoji + ' ' +
        (d.wint.tempo * 60).toFixed(0) + ' ' + Game.config.resources[d.wint.res].naam.toLowerCase() +
        ' per minuut per werker');
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
      html += T.regel('Maakt', (inTekst.length ? inTekst.join(' + ') + ' → ' : '') +
        uitTekst.join(' + ') + ' per minuut per werker');
    }
    if (d.woonruimte) html += T.regel('Woonruimte', d.woonruimte + ' inwoners');
    if (d.stand) html += T.regel('Bewoners', Game.config.standen[d.stand].naam);
    if (d.opslag) html += T.regel('Opslag', '+' + d.opslag + ' per grondstof');
    if (d.opslagPer) {
      for (var soort in d.opslagPer) {
        html += T.regel('Opslag', '+' + d.opslagPer[soort] + ' ' +
          Game.config.opslagSoorten[soort].naam.toLowerCase());
      }
    }
    if (d.tevredenheid) {
      html += T.regel('Tevredenheid', '+' + d.tevredenheid + ' punten voor huizen binnen ' +
        d.bereik + ' tegels');
    }
    if (d.aantrekkelijkheid) {
      html += T.regel('Buurt', (d.aantrekkelijkheid > 0 ? '+' : '') + d.aantrekkelijkheid +
        ' aantrekkelijkheid binnen ' + (d.sfeerStraal || 6) + ' tegels');
    }
    if (d.verdediging) html += T.regel('Verdediging', '+' + d.verdediging);
    if (d.verdPerWerker) html += T.regel('Verdediging', '+' + d.verdPerWerker + ' per werker');
    if (d.productieBonus) html += T.regel('Bonus', '+' + Math.round(d.productieBonus * 100) + '% op alle productie');
    if (d.boerderijBonus) html += T.regel('Bonus', '+' + Math.round(d.boerderijBonus * 100) + '% graan voor boerderijen binnen ' + d.boerderijStraal + ' tegels');
    if (d.visserijBonus) html += T.regel('Bonus', '+' + Math.round(d.visserijBonus * 100) + '% vis voor vissershutten binnen ' + d.visserijStraal + ' tegels');
    if (d.onderhoud) {
      var onder = [];
      for (var orr in d.onderhoud) {
        onder.push(Game.config.resources[orr].emoji + ' ' + (d.onderhoud[orr] * 60).toFixed(1) + ' per minuut');
      }
      html += T.regel('Onderhoud', onder.join(', '));
    }
    if (d.plaats && d.plaats.nabij) {
      html += T.regel('Plaatsing', 'binnen ' + d.plaats.nabij.straal + ' tegels van ' +
        Game.core.map.nodeNaam[d.plaats.nabij.node].toLowerCase());
    }
    if (d.verbetering) {
      var naar = Game.config.gebouw(d.verbetering.naar);
      if (naar) html += T.regel('Later uit te bouwen tot', naar.emoji + ' ' + naar.naam +
        ' (tijdperk ' + d.verbetering.tijdperk + ')');
    }
    if (d.seizoensgevoelig) html += T.regel('Let op', 'de opbrengst hangt af van het seizoen');
    if (d.max) html += T.regel('Maximum', d.max + '×');
    if (d.tijdperk > s.tijdperk) html += T.regel('Vergrendeld', 'beschikbaar vanaf tijdperk ' + d.tijdperk);

    Game.ui.tip.toon(anker, html);
  }

  function verbergTip() { Game.ui.tip.verberg(); }
  BM.verbergTip = verbergTip;

  Game.ui.buildmenu = BM;

})(window.Game);
