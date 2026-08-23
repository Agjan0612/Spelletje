/* City affairs: the panel and dialogs for everything that is not building.
 *
 * The "Stad" tab of the right-hand column shows what is going on right now (a
 * festival, the caravan on the square, the lord's open contract, a neighbour
 * asking for help, and what is stuck), with three buttons under it that open
 * the dialogs: throw a feast, order research, or read the full overview. They
 * used to be three unlabelled emoji in the top bar, where nobody found them.
 * The tab itself is shown and hidden by js/ui/kolom.js, so this module never
 * hides its own card any more — an empty one says so instead.
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
    /* Neighbours only reshape the card when a request appears or a route is
       opened or cut — the countdowns inside it tick without a rebuild. */
    (s.buren || []).forEach(function (b) {
      stukken.push(b.id + (b.route ? 'r' : '-') + (b.verzoek ? 'v' + b.verzoek.res : '') +
        (b.onderbroken > 0 ? 'x' : ''));
    });
    stukken.push(s.tijdperk);
    /* Only the shape of the problem list, not the numbers inside it: the
       card must not be rebuilt out from under the cursor every tick. */
    var probl = S.problemen(s);
    stukken.push(probl.length + ':' + probl.slice(0, S.PROBLEMEN_MAX)
      .map(function (p) { return p.tekst; }).join('/'));
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
  };

  function bouw(s) {
    inhoudEl.innerHTML = '';
    dyn = [];

    if (s.feest.resterend > 0) bouwFeest(s);
    if (s.handel.fase === 'aanwezig') bouwHandel(s);
    if (s.opdracht.actief) bouwOpdracht(s);
    bouwBuren(s);
    bouwProblemen(s);

    /* The card lives in a tab now, so an empty one has to say so itself
       instead of quietly disappearing and leaving a blank pane. */
    if (!inhoudEl.firstChild) {
      var rust = Game.util.el('div', 'stadregel cursief',
        'Er speelt nu niets bijzonders. Hier verschijnen de koopman, de ' +
        'opdrachten van de heer, je buursteden en alles wat vastloopt.');
      inhoudEl.appendChild(rust);
    }
  }

  /* The towns beyond the map edge: a request to answer, a route to open, or
     a route already running. Only shown once there is something to do with
     them, so the card does not fill up with idle rows. */
  function bouwBuren(s) {
    if (s.tijdperk < 2 || !s.buren || !s.buren.length) return;
    var lijst = Game.core.buren.overzicht(s);

    lijst.forEach(function (b) {
      var heeftIets = b.verzoek || b.route || b.kanRoute.ok || b.onderbroken;
      if (!heeftIets) return;

      var el = blok('buur', b.soort.emoji + ' ' + b.naam);
      el.appendChild(Game.util.el('div', 'stadregel',
        b.soort.naam + ' · aanzien ' + b.reputatie + '/100'));

      if (b.onderbroken) {
        var wacht = Game.util.el('div', 'stadregel slecht');
        el.appendChild(wacht);
        volg(wacht, function (st) {
          var nu = (st.buren || []).filter(function (x) { return x.id === b.id; })[0];
          return '🐎 De weg is onveilig — nog ' +
            tijdTekst(nu ? nu.onderbroken : 0);
        });
      } else if (b.route) {
        el.appendChild(Game.util.el('div', 'stadregel' + (b.leegloop ? ' slecht' : ''),
          b.leegloop
            ? '⚠️ Je levert te weinig ' + Game.config.resources[b.soort.vraagt].naam.toLowerCase() +
              ' — de karren rijden half leeg'
            : '🐎 Route loopt: ' + b.opbrengst + ' ' +
              Game.config.resources[b.soort.levert].naam.toLowerCase() + '/min'));
      }

      if (b.verzoek) {
        el.appendChild(Game.util.el('div', 'stadregel', b.verzoek.tekst));
        var klok = Game.util.el('div', 'stadregel klein');
        el.appendChild(klok);
        volg(klok, function (st) {
          var nu = (st.buren || []).filter(function (x) { return x.id === b.id; })[0];
          return nu && nu.verzoek ? 'Nog ' + tijdTekst(nu.verzoek.resterend) : '';
        });

        var rij = Game.util.el('div', 'knoprij');
        var kan = s.res[b.verzoek.res] >= b.verzoek.aantal;
        var help = Game.util.el('button', kan ? 'primair' : '', '🤝 Helpen');
        help.disabled = !kan;
        help.addEventListener('click', function () {
          var doel = echteBuur(spel.state, b.id);
          if (doel) Game.core.buren.help(spel.state, doel);
          S.ververs(spel.state, true);
        });
        var nee = Game.util.el('button', '', '🚪 Afwijzen');
        nee.addEventListener('click', function () {
          var doel = echteBuur(spel.state, b.id);
          if (doel) Game.core.buren.weiger(spel.state, doel);
          S.ververs(spel.state, true);
        });
        rij.appendChild(help); rij.appendChild(nee);
        el.appendChild(rij);
      }

      if (!b.route && b.kanRoute.ok) {
        var kosten = Game.config.buren.routeKosten;
        var prijs = Object.keys(kosten).map(function (r) {
          return Game.config.resources[r].emoji + ' ' + kosten[r];
        }).join(' ');
        var open = Game.util.el('button', 'primair', '🐎 Handelsroute openen (' + prijs + ')');
        open.title = 'Kost eenmalig een wagen en een beurs, en levert daarna elke dag ' +
          Game.config.resources[b.soort.levert].naam.toLowerCase() + ' en munten op — ' +
          'zolang jij ' + Game.config.resources[b.soort.vraagt].naam.toLowerCase() + ' blijft leveren.';
        open.addEventListener('click', function () {
          var doel = echteBuur(spel.state, b.id);
          if (doel) Game.core.buren.openRoute(spel.state, doel);
          S.ververs(spel.state, true);
        });
        var rij2 = Game.util.el('div', 'knoprij');
        rij2.appendChild(open);
        el.appendChild(rij2);
      }
    });
  }

  /* overzicht() hands out snapshots; the actions need the real record. */
  function echteBuur(s, id) {
    for (var i = 0; i < (s.buren || []).length; i++) if (s.buren[i].id === id) return s.buren[i];
    return null;
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

  /* ------------------------------------------------------------ problemen */

  /* The log scrolls away and the overview is behind a button, so the things
     that are actually stuck were easy to miss. This is the short version:
     at most three, sorted by urgency, and clicking one takes you there. */
  S.PROBLEMEN_MAX = 3;

  S.problemen = function (s) {
    var lijst = [];

    var dagen = Game.core.population.voedselDagen(s);
    if (dagen < 3 && s.bevolking.totaal > 3) {
      lijst.push({ ernst: 3, tekst: '🍞 Nog ' + dagen.toFixed(1) + ' dagen voedsel' });
    }
    if (s.koud) {
      lijst.push({ ernst: 3, tekst: '🥶 Geen brandhout — je dorpelingen zitten in de kou' });
    }
    if (s.voedselTekort > 1e-6) {
      lijst.push({ ernst: 3, tekst: '💀 Er wordt honger geleden' });
    }

    /* Buildings that are stuck, each with the spot to jump to. */
    for (var i = 0; i < s.gebouwen.length; i++) {
      var g = s.gebouwen[i];
      if (!g.gebouwd || g.uit) continue;
      var d = Game.core.state.def(g);
      if (d.banen && g.werkers === 0) {
        lijst.push({ ernst: 1, tekst: '👥 ' + d.naam + ' staat zonder werkers', x: g.x, y: g.y });
      } else if (g.waarschuwing) {
        lijst.push({ ernst: 2, tekst: '⚠️ ' + d.naam + ': ' + g.waarschuwing, x: g.x, y: g.y });
      }
    }

    var vol = Game.config.resourceOrder.filter(function (r) {
      return s.res[r] >= Game.core.state.plafond(s, r) - 0.5;
    });
    if (vol.length) {
      lijst.push({
        ernst: 2,
        tekst: '📦 Opslag vol: ' + vol.map(function (r) { return Game.config.resources[r].naam; }).join(', ')
      });
    }

    if (s.bevolking.ruimte - s.bevolking.totaal <= 0 && s.bevolking.totaal > 4) {
      lijst.push({ ernst: 1, tekst: '🛏️ Geen bed vrij — je dorp kan niet groeien' });
    }

    lijst.sort(function (a, b) { return b.ernst - a.ernst; });
    return lijst;
  };

  function bouwProblemen(s) {
    var lijst = S.problemen(s);
    if (!lijst.length) return;

    var el = blok('problemen', '❗ Vraagt aandacht');
    lijst.slice(0, S.PROBLEMEN_MAX).forEach(function (p) {
      var regel = Game.util.el('div', 'stadregel probleem' + (p.ernst >= 3 ? ' slecht' : ''));
      regel.textContent = p.tekst;
      if (p.x !== undefined) {
        regel.classList.add('klikbaar');
        regel.title = 'Klik om er in beeld naartoe te gaan';
        regel.addEventListener('click', function () {
          spel.cam.centreerOpTegel(p.x, p.y);
          spel.cam.begrens(spel.state.kaart);
          var tegel = Game.core.map.tegel(spel.state.kaart, p.x, p.y);
          if (tegel && tegel.b) {
            spel.geselecteerd = tegel.b;
            Game.ui.panel.ververs(spel.state, true);
          }
        });
      }
      el.appendChild(regel);
    });
    if (lijst.length > S.PROBLEMEN_MAX) {
      var meer = Game.util.el('div', 'stadregel klein',
        'en nog ' + (lijst.length - S.PROBLEMEN_MAX) + ' — zie 📋 Overzicht');
      el.appendChild(meer);
    }
  }

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

    var vol = Game.config.resourceOrder.filter(function (r) {
      return s.res[r] >= Game.core.state.plafond(s, r) - 0.5;
    });
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
