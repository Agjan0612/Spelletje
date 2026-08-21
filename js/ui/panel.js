/* Side panel for the selected building: what it does, who works there,
   and the buttons to pause or demolish it. */
(function (Game) {

  var P = {};
  var el = null;
  var spel = null;

  P.init = function (hetSpel) {
    spel = hetSpel;
    el = document.getElementById('panel');
  };

  /* Rebuilding the panel on every UI tick would rip the buttons out from
     under the player's cursor, so we only redraw when something changed. */
  function handtekening(s, g) {
    if (!g) return 'leeg';
    return [g.id, g.type, g.werkers, g.gebouwd ? 1 : 0, Math.round(g.voortgang * 4),
      g.uit ? 1 : 0, g.waarschuwing, s.bevolking.werkloos,
      Math.round(s.tevredenheid), s.seizoen, s.tijdperk,
      Game.core.construction.kanVerbeteren(s, g).ok ? 1 : 0].join('|');
  }

  P.ververs = function (s, forceer) {
    if (!el) return;
    var g = spel.geselecteerd ? Game.core.state.gebouw(s, spel.geselecteerd) : null;

    var teken = handtekening(s, g);
    if (!forceer && teken === P.laatsteTeken) return;
    P.laatsteTeken = teken;

    if (!g) { el.classList.add('hidden'); return; }

    var d = Game.core.state.def(g);
    el.classList.remove('hidden');
    el.innerHTML = '';

    /* --- kop --- */
    var kop = Game.util.el('div', 'titelrij');
    kop.appendChild(Game.util.el('span', 'emoji', d.emoji));
    kop.appendChild(Game.util.el('h2', '', d.naam));
    el.appendChild(kop);
    el.appendChild(Game.util.el('div', 'beschrijving', d.beschrijving || ''));

    /* --- in aanbouw --- */
    if (!g.gebouwd) {
      el.appendChild(Game.util.el('div', 'kop', 'In aanbouw'));
      var deel = g.voortgang / d.bouwtijd;
      var balk = Game.util.el('div', 'balk bouw');
      var vul = Game.util.el('div');
      vul.style.width = Math.round(deel * 100) + '%';
      balk.appendChild(vul);
      el.appendChild(balk);
      el.appendChild(regel('Voortgang', Math.round(deel * 100) + '%'));
      el.appendChild(regel('Bouwers', s.bevolking.werkloos + ' werkloze dorpelingen'));
      if (s.bevolking.werkloos === 0) {
        el.appendChild(Game.util.el('div', 'waarschuwing',
          'Niemand is vrij om te bouwen. Haal werkers uit een gebouw om sneller te bouwen.'));
      }
      el.appendChild(knoppen(s, g, d));
      return;
    }

    /* --- werkers --- */
    if (d.banen) {
      var baan = Game.config.jobs[d.banen.baan];
      el.appendChild(Game.util.el('div', 'kop', baan.emoji + ' ' + baan.naam));

      var rij = Game.util.el('div', 'werkers');
      var min = Game.util.el('button', '', '−');
      min.disabled = g.werkers <= 0;
      min.addEventListener('click', function () {
        Game.core.population.zetWerkers(s, g, g.werkers - 1);
        Game.render.renderer.verversWandelaars(s);
        P.ververs(s, true);
      });

      var telling = Game.util.el('div', 'telling', g.werkers + ' / ' + d.banen.aantal);

      var plus = Game.util.el('button', '', '+');
      plus.disabled = g.werkers >= d.banen.aantal || s.bevolking.werkloos <= 0;
      plus.addEventListener('click', function () {
        Game.core.population.zetWerkers(s, g, g.werkers + 1);
        Game.render.renderer.verversWandelaars(s);
        P.ververs(s, true);
      });

      rij.appendChild(min); rij.appendChild(telling); rij.appendChild(plus);
      el.appendChild(rij);

      var vulling = Game.util.el('div', 'balk');
      var vul2 = Game.util.el('div');
      vul2.style.width = Math.round(g.werkers / d.banen.aantal * 100) + '%';
      vulling.appendChild(vul2);
      el.appendChild(vulling);

      if (s.bevolking.werkloos <= 0 && g.werkers < d.banen.aantal) {
        el.appendChild(Game.util.el('div', 'waarschuwing',
          'Geen vrije dorpelingen. Bouw huizen zodat je dorp groeit.'));
      }
    }

    /* --- opbrengst --- */
    var opbrengst = [];
    if (d.wint) {
      var tempo = d.wint.tempo * g.werkers * s.bonus.productie * s.bonus.mijnbouw *
        (0.75 + 0.25 * (s.tevredenheid / 100));
      if (d.seizoensgevoelig) tempo *= Game.core.seasons.factor(s, 'jacht');
      opbrengst.push([Game.config.resources[d.wint.res].naam, '+' + (tempo * 60).toFixed(1) + ' /min']);
    }
    if (d.maakt) {
      var factor = g.werkers * s.bonus.productie * (0.75 + 0.25 * (s.tevredenheid / 100));
      if (d.seizoensgevoelig) factor *= Game.core.seasons.factor(s, 'akker');
      for (var ir in d.maakt.in) {
        opbrengst.push([Game.config.resources[ir].naam, '−' + (d.maakt.in[ir] * factor * 60).toFixed(1) + ' /min']);
      }
      for (var ur in d.maakt.uit) {
        opbrengst.push([Game.config.resources[ur].naam, '+' + (d.maakt.uit[ur] * factor * 60).toFixed(1) + ' /min']);
      }
    }
    if (opbrengst.length) {
      el.appendChild(Game.util.el('div', 'kop', 'Opbrengst nu'));
      opbrengst.forEach(function (o) { el.appendChild(regel(o[0], o[1])); });
    }

    /* --- overige effecten --- */
    var effecten = [];
    if (d.woonruimte) effecten.push(['Woonruimte', d.woonruimte + ' inwoners']);
    if (d.opslag) effecten.push(['Opslag', '+' + d.opslag]);
    if (d.tevredenheid) effecten.push(['Tevredenheid', '+' + d.tevredenheid]);
    if (d.verdediging) effecten.push(['Verdediging', '+' + d.verdediging]);
    if (d.verdPerWerker) effecten.push(['Verdediging', '+' + (d.verdPerWerker * g.werkers) + ' (' + d.verdPerWerker + ' per werker)']);
    if (d.productieBonus) effecten.push(['Productiebonus', '+' + Math.round(d.productieBonus * 100) + '%']);
    if (d.boerderijBonus) effecten.push(['Boerderijen dichtbij', '+' + Math.round(d.boerderijBonus * 100) + '%']);
    if (d.onderhoud) {
      for (var orr in d.onderhoud) {
        effecten.push(['Onderhoud', '−' + (d.onderhoud[orr] * 60).toFixed(1) + ' ' + Game.config.resources[orr].naam.toLowerCase() + ' /min']);
      }
    }
    if (effecten.length) {
      el.appendChild(Game.util.el('div', 'kop', 'Effect'));
      effecten.forEach(function (o) { el.appendChild(regel(o[0], o[1])); });
    }

    /* --- voorraad in de omgeving --- */
    if (d.wint) {
      var voorraad = Game.core.map.nodeInBereik(s.kaart, g.x, g.y, d.wint.node, d.wint.straal);
      el.appendChild(Game.util.el('div', 'kop', 'In de omgeving'));
      el.appendChild(regel(Game.core.map.nodeNaam[d.wint.node],
        voorraad >= Game.core.map.ONEINDIG ? 'onuitputtelijk' : Math.round(voorraad)));
    }

    if (g.waarschuwing) {
      el.appendChild(Game.util.el('div', 'waarschuwing', '⚠️ ' + g.waarschuwing));
    }

    verbeterBlok(el, s, g, d);
    el.appendChild(knoppen(s, g, d));
  };

  /* The upgrade offer: a building that can grow into a bigger version of
     itself says so right here, with what it would become and what it costs. */
  function verbeterBlok(el, s, g, d) {
    if (!d.verbetering) return;
    var check = Game.core.construction.kanVerbeteren(s, g);
    if (!check.naar) return;

    var blok = Game.util.el('div', 'verbeterblok' + (check.ok ? '' : ' kan-niet'));
    blok.appendChild(Game.util.el('div', 'kop', '⬆️ Uitbouwen'));

    var kop = Game.util.el('div', 'verbeternaam', check.naar.emoji + ' ' + check.naar.naam);
    blok.appendChild(kop);
    blok.appendChild(Game.util.el('div', 'beschrijving', check.naar.beschrijving));

    var winst = verschillen(d, check.naar);
    if (winst.length) blok.appendChild(Game.util.el('div', 'verbeterwinst', winst.join(' · ')));

    var knop = Game.util.el('button', 'verbeterknop',
      check.ok ? 'Uitbouwen (' + Game.ui.stad.kostenTekst(d.verbetering.kosten) + ')' : check.reden);
    knop.disabled = !check.ok;
    knop.addEventListener('click', function () {
      Game.core.construction.verbeter(s, g);
      Game.render.renderer.verversGebouwen(s);
      Game.ui.buildmenu.ververs(s, true);
      P.ververs(s, true);
    });
    blok.appendChild(knop);
    el.appendChild(blok);
  }

  /* What the player actually gains, in their own terms. */
  function verschillen(oud, nieuw) {
    var uit = [];
    if ((nieuw.woonruimte || 0) !== (oud.woonruimte || 0)) {
      uit.push('🛏️ ' + (oud.woonruimte || 0) + ' → ' + (nieuw.woonruimte || 0));
    }
    if (nieuw.banen && oud.banen && nieuw.banen.aantal !== oud.banen.aantal) {
      uit.push('👥 ' + oud.banen.aantal + ' → ' + nieuw.banen.aantal);
    }
    if (nieuw.wint && oud.wint && nieuw.wint.tempo !== oud.wint.tempo) {
      uit.push(Game.config.resources[nieuw.wint.res].emoji + ' ' +
        (oud.wint.tempo * 60).toFixed(0) + ' → ' + (nieuw.wint.tempo * 60).toFixed(0) + ' /min');
    }
    if (nieuw.maakt && oud.maakt) {
      for (var r in nieuw.maakt.uit) {
        if (oud.maakt.uit[r] && oud.maakt.uit[r] !== nieuw.maakt.uit[r]) {
          uit.push(Game.config.resources[r].emoji + ' ' + (oud.maakt.uit[r] * 60).toFixed(0) +
            ' → ' + (nieuw.maakt.uit[r] * 60).toFixed(0) + ' /min');
        }
      }
    }
    if ((nieuw.tevredenheid || 0) !== (oud.tevredenheid || 0)) {
      uit.push('😀 ' + (oud.tevredenheid || 0) + ' → ' + (nieuw.tevredenheid || 0));
    }
    if ((nieuw.verdediging || 0) !== (oud.verdediging || 0)) {
      uit.push('🛡️ ' + (oud.verdediging || 0) + ' → ' + (nieuw.verdediging || 0));
    }
    return uit;
  }

  function regel(k, v) {
    var r = Game.util.el('div', 'regel');
    r.appendChild(Game.util.el('span', 'k', k));
    r.appendChild(Game.util.el('span', 'v', String(v)));
    return r;
  }

  function knoppen(s, g, d) {
    var rij = Game.util.el('div', 'knoprij');

    if (g.gebouwd && (d.banen || d.productieBonus)) {
      var pauze = Game.util.el('button', '', g.uit ? '▶ Hervatten' : '⏸ Stilleggen');
      pauze.addEventListener('click', function () {
        g.uit = !g.uit;
        Game.core.state.herbereken(s);
        P.ververs(s, true);
      });
      rij.appendChild(pauze);
    }

    if (d.id !== 'dorpsplein') {
      var verzet = Game.util.el('button', '', '✋ Verplaatsen');
      verzet.title = 'Kost een vijfde van de bouwkosten: ' +
        Game.ui.stad.kostenTekst(Game.core.construction.verplaatsKosten(g.type));
      verzet.addEventListener('click', function () { spel.startVerplaatsen(g); });
      rij.appendChild(verzet);

      var sloop = Game.util.el('button', 'gevaar', '🔥 Slopen');
      sloop.addEventListener('click', function () {
        Game.core.construction.sloop(s, g);
        spel.geselecteerd = null;
        Game.render.renderer.verversWandelaars(s);
        P.ververs(s, true);
      });
      rij.appendChild(sloop);
    }

    var sluit = Game.util.el('button', '', '✕');
    sluit.title = 'Sluiten';
    sluit.style.flex = '0 0 36px';
    sluit.addEventListener('click', function () {
      spel.geselecteerd = null;
      P.ververs(s, true);
    });
    rij.appendChild(sluit);

    return rij;
  }

  Game.ui.panel = P;

})(window.Game);
