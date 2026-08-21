/* City affairs: the panel and dialogs for everything that is not building.
 *
 * One card in the right-hand column shows what is going on right now (a
 * festival, the caravan on the square, the lord's open contract), and the
 * three buttons in the top bar open the dialogs: throw a feast, order
 * research, or read the overview of what is stuck in your town.
 *
 * The card is rebuilt only when its *structure* changes; the countdowns are
 * written into the existing nodes every refresh. Otherwise the buttons would
 * be ripped out from under the cursor once a second — the same reason
 * panel.js and buildmenu.js use a signature diff. */
(function (Game) {

  var S = {};
  var spel = null;
  var box = null, inhoudEl = null;
  var dyn = [];              /* small updater closures, run on every refresh */
  var laatsteTeken = null;

  S.init = function (hetSpel) {
    spel = hetSpel;
    box = document.getElementById('stadbox');
    inhoudEl = document.getElementById('stad-inhoud');

    koppel('btn-feest', function () { S.feestMenu(); });
    koppel('btn-onderzoek', function () { S.onderzoekMenu(); });
    koppel('btn-overzicht', function () { S.overzicht(); });
  };

  function koppel(id, fn) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('click', fn);
  }

  /* ------------------------------------------------------------ de kaart -- */

  /* Only the things that change the *shape* of the card. */
  function handtekening(s) {
    var stukken = [
      s.feest.id || '-',
      s.handel.fase, s.handel.nummer,
      s.opdracht.actief ? s.opdracht.actief.id + s.opdracht.actief.aantal : '-',
      Game.core.opdrachten.kanLeveren(s) ? 1 : 0
    ];
    (s.handel.aanbod || []).forEach(function (a, i) {
      stukken.push(i + (a.gedaan ? 'x' : (Game.core.handel.kanHandelen(s, i) ? 'k' : 'n')));
    });
    return stukken.join('|');
  }

  S.ververs = function (s, forceer) {
    if (!box || !s) return;

    /* An event that is waiting for an answer always comes back to the front,
       also right after loading a save in the middle of one. */
    if (s.gebeurtenis && s.gebeurtenis.actief && !Game.ui.overlay.isOpen()) {
      S.toonGebeurtenis(s);
    }

    var teken = handtekening(s);
    if (forceer || teken !== laatsteTeken) {
      laatsteTeken = teken;
      bouw(s);
    }
    for (var i = 0; i < dyn.length; i++) dyn[i](s);

    var leeg = !inhoudEl.firstChild;
    box.classList.toggle('hidden', leeg);
  };

  function bouw(s) {
    inhoudEl.innerHTML = '';
    dyn = [];

    if (s.feest.resterend > 0) bouwFeest(s);
    if (s.handel.fase === 'aanwezig') bouwHandel(s);
    if (s.opdracht.actief) bouwOpdracht(s);
  }

  function tijdTekst(sec) {
    sec = Math.max(0, Math.ceil(sec));
    if (sec < 60) return sec + 's';
    return Math.floor(sec / 60) + ':' + ('0' + (sec % 60)).slice(-2);
  }

  function blok(klasse, titel) {
    var el = Game.util.el('div', 'stadblok ' + (klasse || ''));
    if (titel) el.appendChild(Game.util.el('div', 'stadkop', titel));
    inhoudEl.appendChild(el);
    return el;
  }

  /* Register a node whose text is rewritten every refresh (countdowns). */
  function volg(el, fn) {
    dyn.push(function (s) { el.textContent = fn(s); });
  }

  function bouwFeest(s) {
    var soort = Game.core.feesten.soort(s.feest.id) || { emoji: '🎉', naam: 'Feest' };
    var el = blok('feest', soort.emoji + ' ' + soort.naam);
    var regel = Game.util.el('div', 'stadregel');
    regel.appendChild(Game.util.el('span', '', 'Nog '));
    var t = Game.util.el('span', 'nadruk', '');
    volg(t, function (st) { return tijdTekst(st.feest.resterend); });
    regel.appendChild(t);
    regel.appendChild(Game.util.el('span', '', ' feestvieren'));
    el.appendChild(regel);
  }

  function bouwHandel(s) {
    var el = blok('handel', '🐴 Reizende koopman');

    var klok = Game.util.el('div', 'stadregel dof');
    var t = Game.util.el('span', '', '');
    volg(t, function (st) { return tijdTekst(st.handel.timer); });
    klok.appendChild(Game.util.el('span', '', 'Vertrekt over '));
    klok.appendChild(t);
    el.appendChild(klok);

    s.handel.aanbod.forEach(function (a, i) {
      var res = Game.config.resources[a.res];
      var knop = Game.util.el('button', 'handelknop');
      knop.innerHTML = (a.soort === 'verkoopt' ? 'Koop ' : 'Verkoop ') +
        '<b>' + res.emoji + ' ' + a.aantal + '</b> ' +
        (a.soort === 'verkoopt' ? 'voor' : 'voor') + ' <b>🪙 ' + a.prijs + '</b>';
      if (a.gedaan) {
        knop.disabled = true;
        knop.classList.add('gedaan');
        knop.innerHTML += ' ✔';
      } else if (!Game.core.handel.kanHandelen(s, i)) {
        knop.disabled = true;
      } else {
        knop.addEventListener('click', function () {
          Game.core.handel.doe(spel.state, i);
          S.ververs(spel.state, true);
          Game.ui.hud.ververs(spel.state);
        });
      }
      el.appendChild(knop);
    });
  }

  function bouwOpdracht(s) {
    var a = s.opdracht.actief;
    var res = Game.config.resources[a.res];
    var el = blok('opdracht', '📜 Opdracht van de heer');

    el.appendChild(Game.util.el('div', 'stadregel cursief', a.tekst));

    var regel = Game.util.el('div', 'stadregel');
    regel.innerHTML = 'Lever <b>' + res.emoji + ' ' + a.aantal + '</b> · beloning <b>🪙 ' + a.munten + '</b>';
    el.appendChild(regel);

    var balk = Game.util.el('div', 'balk');
    var vul = Game.util.el('div');
    balk.appendChild(vul);
    el.appendChild(balk);
    dyn.push(function (st) {
      vul.style.width = Math.round(Game.util.clamp(st.res[a.res] / a.aantal, 0, 1) * 100) + '%';
    });

    var klok = Game.util.el('div', 'stadregel dof');
    var t = Game.util.el('span', '', '');
    volg(t, function (st) {
      var over = Game.core.opdrachten.dagenOver(st);
      return over === 1 ? 'nog 1 dag' : 'nog ' + over + ' dagen';
    });
    klok.appendChild(Game.util.el('span', '', 'Deadline: '));
    klok.appendChild(t);
    el.appendChild(klok);

    var knop = Game.util.el('button', 'handelknop', '📜 Leveren');
    knop.disabled = !Game.core.opdrachten.kanLeveren(s);
    knop.addEventListener('click', function () {
      Game.core.opdrachten.lever(spel.state);
      S.ververs(spel.state, true);
      Game.ui.hud.ververs(spel.state);
    });
    el.appendChild(knop);
  }

  /* ----------------------------------------------------------- gebeurtenis */

  S.toonGebeurtenis = function (s) {
    var ev = Game.core.gebeurtenissen.def(s.gebeurtenis.actief);
    if (!ev) return;
    var ctx = s.gebeurtenis.ctx || {};

    var knoppen = ev.opties.map(function (optie, i) {
      var label = optie.tekst;
      if (optie.kosten) label += ' (' + kostenTekst(optie.kosten) + ')';
      return {
        tekst: label,
        primair: i === 0,
        actie: function () {
          if (!Game.core.gebeurtenissen.kanKiezen(spel.state, optie)) {
            Game.ui.toast('⚠️ Daar heb je de grondstoffen niet voor');
            return;
          }
          Game.core.gebeurtenissen.kies(spel.state, i);
          Game.ui.overlay.sluit();
          S.ververs(spel.state, true);
          Game.ui.hud.ververs(spel.state);
        }
      };
    });

    Game.ui.overlay.open(ev.emoji + ' ' + ev.titel, function (el) {
      el.appendChild(Game.util.el('p', '', ev.tekst(s, ctx)));
      var ul = Game.util.el('ul', 'keuzes');
      ev.opties.forEach(function (optie) {
        if (!optie.uitleg) return;
        var li = Game.util.el('li');
        li.innerHTML = '<b>' + optie.tekst + '</b> — ' + optie.uitleg +
          (optie.kosten && !Game.core.state.kanBetalen(s, optie.kosten)
            ? ' <span class="mist">(te weinig voorraad)</span>' : '');
        ul.appendChild(li);
      });
      el.appendChild(ul);
    }, knoppen);
  };

  function kostenTekst(kosten) {
    var delen = [];
    for (var r in kosten) delen.push(Game.config.resources[r].emoji + ' ' + kosten[r]);
    return delen.join(' ');
  }
  S.kostenTekst = kostenTekst;

  /* ---------------------------------------------------------------- feest */

  S.feestMenu = function () {
    var s = spel.state;
    Game.ui.overlay.open('🎉 Een feest geven', function (el) {
      el.appendChild(Game.util.el('p', '', 'Een feest kost voorraad en tilt de tevredenheid ' +
        'een tijd lang flink op. Handig na een rooftocht, of om net dat laatste ' +
        'stukje tevredenheid voor een tijdperk te halen.'));

      Game.core.feesten.soorten.forEach(function (soort) {
        var reden = Game.core.feesten.reden(s, soort);
        var kaart = Game.util.el('div', 'feestkaart' + (reden ? ' kan-niet' : ''));

        var kop = Game.util.el('div', 'feestkop', soort.emoji + '  ' + soort.naam);
        kaart.appendChild(kop);
        kaart.appendChild(Game.util.el('div', 'cursief', soort.beschrijving));

        var info = Game.util.el('div', 'feestinfo');
        info.innerHTML = 'Kosten: <b>' + kostenTekst(soort.kosten) + '</b> · ' +
          'Humeur: <b>+' + soort.moreel + '</b> · Duur: <b>' + soort.duur + 's</b>';
        kaart.appendChild(info);

        var knop = Game.util.el('button', 'feestknop', reden ? reden : 'Vier het ' + soort.naam.toLowerCase());
        knop.disabled = !!reden;
        knop.addEventListener('click', function () {
          Game.core.feesten.vier(spel.state, soort.id);
          Game.ui.overlay.sluit();
          S.ververs(spel.state, true);
          Game.ui.hud.ververs(spel.state);
        });
        kaart.appendChild(knop);

        el.appendChild(kaart);
      });
    }, [{ tekst: '← Terug', primair: true, actie: function () { Game.ui.overlay.sluit(); } }]);
  };

  /* ------------------------------------------------------------- overzicht */

  /* Everything that is stuck, in one list. The per-building warnings already
     exist — they were just hidden inside the panel of one building at a time. */
  S.overzichtRegels = function (s) {
    var regels = [];
    var zonderWerkers = [], waarschuwingen = {}, uit = 0, inAanbouw = 0;

    for (var i = 0; i < s.gebouwen.length; i++) {
      var g = s.gebouwen[i];
      var d = Game.core.state.def(g);
      if (!g.gebouwd) { inAanbouw++; continue; }
      if (g.uit) { uit++; continue; }
      if (d.banen && g.werkers === 0) zonderWerkers.push(d.naam);
      else if (g.waarschuwing) {
        waarschuwingen[g.waarschuwing] = (waarschuwingen[g.waarschuwing] || 0) + 1;
      }
    }

    var dagen = Game.core.population.voedselDagen(s);
    regels.push({
      soort: dagen < 3 ? 'slecht' : (dagen < 6 ? 'let-op' : 'goed'),
      tekst: '🍞 Voedsel: ' + dagen.toFixed(1) + ' dagen voorraad' +
        (dagen < 3 ? ' — te weinig om te groeien' : '')
    });

    var vrij = s.bevolking.ruimte - s.bevolking.totaal;
    regels.push({
      soort: vrij <= 0 ? 'let-op' : 'goed',
      tekst: '🛏️ Woonruimte: ' + vrij + ' bedden vrij' + (vrij <= 0 ? ' — je dorp kan niet groeien' : '')
    });

    regels.push({
      soort: s.bevolking.werkloos === 0 ? 'let-op' : 'goed',
      tekst: '🧰 Bouwers: ' + s.bevolking.werkloos + ' werkloze dorpelingen' +
        (s.bevolking.werkloos === 0 ? ' — bouwen ligt zo goed als stil' : '')
    });

    if (zonderWerkers.length) {
      regels.push({
        soort: 'let-op',
        tekst: '👥 Zonder werkers: ' + tel(zonderWerkers)
      });
    }
    for (var w in waarschuwingen) {
      regels.push({ soort: 'let-op', tekst: '⚠️ ' + w + ' (' + waarschuwingen[w] + '×)' });
    }
    if (uit) regels.push({ soort: 'let-op', tekst: '⏸ ' + uit + ' gebouw(en) handmatig stilgelegd' });
    if (inAanbouw) regels.push({ soort: '', tekst: '🏗️ ' + inAanbouw + ' gebouw(en) in aanbouw' });

    var vol = Game.config.resourceOrder.filter(function (r) { return s.res[r] >= s.capaciteit - 0.5; });
    if (vol.length) {
      regels.push({
        soort: 'let-op',
        tekst: '📦 Opslag vol: ' + vol.map(function (r) { return Game.config.resources[r].naam; }).join(', ') +
          ' — bouw een voorraadschuur of pakhuis'
      });
    }

    if (s.tijdperk >= 2) {
      var verd = Game.core.raids.effectieveVerdediging(s);
      regels.push({
        soort: verd < 20 ? 'slecht' : '',
        tekst: '🛡️ Verdediging: ' + verd + (verd < 20 ? ' — de rovers komen, bouw een wachttoren' : '')
      });
    }

    if (!zonderWerkers.length && !Object.keys(waarschuwingen).length && dagen >= 6 && vrij > 0) {
      regels.push({ soort: 'goed', tekst: '✅ Er staat niets stil. Bouw rustig verder.' });
    }
    return regels;
  };

  function tel(lijst) {
    var per = {};
    lijst.forEach(function (n) { per[n] = (per[n] || 0) + 1; });
    return Object.keys(per).map(function (n) {
      return per[n] > 1 ? per[n] + '× ' + n : n;
    }).join(', ');
  }

  S.overzicht = function () {
    var s = spel.state;
    Game.ui.overlay.open('📋 Overzicht van je stad', function (el) {
      var ul = Game.util.el('ul', 'overzicht');
      S.overzichtRegels(s).forEach(function (r) {
        var li = Game.util.el('li', r.soort);
        li.textContent = r.tekst;
        ul.appendChild(li);
      });
      el.appendChild(ul);

      var cijfers = Game.util.el('div', 'stadcijfers');
      cijfers.innerHTML =
        '<b>' + s.bevolking.totaal + '</b> inwoners · ' +
        '<b>' + s.gebouwen.length + '</b> gebouwen · ' +
        '<b>' + Math.round(s.tevredenheid) + '%</b> tevreden · ' +
        'jaar <b>' + s.jaar + '</b>';
      el.appendChild(cijfers);
    }, [{ tekst: 'Sluiten', primair: true, actie: function () { Game.ui.overlay.sluit(); } }]);
  };

  /* Filled in by js/ui/onderzoek.js; kept here so the button always answers. */
  S.onderzoekMenu = function () {
    if (Game.ui.onderzoek) Game.ui.onderzoek.menu();
  };

  Game.ui.stad = S;

})(window.Game);
