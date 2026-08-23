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
      Math.round((s.samenhorigheid || 0) * 100), s.bevolking.soldaten,
      Math.round((s.dienstdekking || 0) * 100), Math.round(s.sfeer || 0),
      s.wegTeller || 0, Math.round((g.ervaring || 0) * 20),
      s.bevolking.kinderen + ':' + s.bevolking.ouderen,
      s.wens && s.wens.actief ? s.wens.actief.gebouwId : '-',
      s.belastingtarief, s.koud ? 1 : 0,
      g.bouwPrio || 0, s.arbeid ? (s.arbeid.auto ? 1 : 0) + ':' + s.arbeid.bouwers +
        ':' + Object.keys(s.arbeid.prioriteit || {}).map(function (k2) {
          return s.arbeid.prioriteit[k2];
        }).join('') : '-',
      s.raid.fase, s.leger ? (s.leger.uitval ? 1 : 0) + ':' + s.leger.overwinningen : '-',
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
    var miniBron = Game.render.sprites && Game.render.sprites.miniatuurBron &&
      Game.render.sprites.miniatuurBron(d, 60, s.tijdperk);
    if (miniBron) {
      var wrap = Game.util.el('div', 'paneelmini');
      var img = document.createElement('img');
      img.className = 'mini'; img.alt = ''; img.src = miniBron;
      img.onerror = function () { wrap.textContent = d.emoji; };
      wrap.appendChild(img);
      /* A progress ring around the miniature while it is being built (fase 8.1). */
      if (!g.gebouwd) {
        var pct = Math.round(Game.util.clamp(g.voortgang / d.bouwtijd, 0, 1) * 100);
        var ring = Game.util.el('div', 'ring');
        ring.style.background = 'conic-gradient(var(--goud, #d7a94b) ' + pct + '%, rgba(0,0,0,.28) 0)';
        wrap.appendChild(ring);
      }
      kop.appendChild(wrap);
    } else {
      kop.appendChild(Game.util.el('span', 'emoji', d.emoji));
    }
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

    ervaringBlok(el, s, g, d);
    aanvoerBlok(el, s, g, d);
    buurtBlok(el, s, g, d);

    if (g.type === 'dorpsplein') dorpsleven(el, s);

    verbeterBlok(el, s, g, d);
    if (!g.gebouwd) bouwrijBlok(el, s, g, d);
    el.appendChild(knoppen(s, g, d));
  };

  /* Where this site sits in the queue, and the button to jump it to the
     front. The crew only works on the first few at a time, so "what do you
     want standing first" is a real question now. */
  function bouwrijBlok(el, s, g, d) {
    var rij = Game.core.construction.wachtrij(s);
    var plek = rij.indexOf(g) + 1;
    el.appendChild(Game.util.el('div', 'kop', '🏗️ In de bouwrij'));
    el.appendChild(regel('Plek', plek + ' van ' + rij.length));
    el.appendChild(regel('Voortgang', Math.round((g.voortgang / d.bouwtijd) * 100) + '%'));
    if (plek > Game.core.construction.PLOEGEN) {
      el.appendChild(Game.util.el('div', 'beschrijving',
        'Je ploegen werken aan de eerste ' + Game.core.construction.PLOEGEN +
        '. Hier wordt nog niets gedaan.'));
    }

    var knoprij = Game.util.el('div', 'knoprij');
    var voor = Game.util.el('button', g.bouwPrio ? '' : 'primair',
      g.bouwPrio ? '↓ Uit de voorrang halen' : '⬆️ Eerst dit bouwen');
    voor.addEventListener('click', function () {
      Game.core.construction.zetVoorrang(s, g);
      P.ververs(s, true);
    });
    knoprij.appendChild(voor);

    var weg = Game.util.el('button', '', '↩️ Annuleren (alles terug)');
    weg.title = 'Een gebouw dat nog niet staat kun je kosteloos terugdraaien.';
    weg.addEventListener('click', function () {
      Game.core.construction.annuleer(s, g);
      spel.geselecteerd = null;
      Game.render.renderer.verversGebouwen(s);
      Game.ui.buildmenu.ververs(s, true);
      P.ververs(s, true);
    });
    knoprij.appendChild(weg);
    el.appendChild(knoprij);
  }

  /* Practised hands. Shown only once there is something to show, so a fresh
     building does not carry a row of zeroes. */
  function ervaringBlok(el, s, g, d) {
    if (!d.banen || !g.ervaring) return;
    var pct = Math.round(g.ervaring * 100);
    el.appendChild(regel('Ervaring', pct + '% (+' +
      Math.round(g.ervaring * Game.core.economy.ERVARING_BONUS * 100) + '% opbrengst)'));
    if (pct < 40) {
      el.appendChild(Game.util.el('div', 'beschrijving',
        'Deze ploeg is nog aan het inwerken. Laat ze staan: werkers verplaatsen kost ervaring.'));
    }
  }

  /* How much of what this workplace makes actually arrives in the store. A
     building next to a barn loses nothing; one on the far rim of the map
     spends half its day walking. */
  function aanvoerBlok(el, s, g, d) {
    if (!d.wint && !d.maakt) return;
    var info = Game.core.logistiek.omschrijving(s, g);
    var bij = Game.core.logistiek.dichtstbijDepot(s, g);

    el.appendChild(Game.util.el('div', 'kop', '🛣️ Aanvoer'));
    el.appendChild(regel('Komt aan', Math.round(info.factor * 100) + '%'));
    if (bij.depot) {
      el.appendChild(regel('Naar', Game.config.gebouw(bij.depot.type).naam +
        ' (' + Math.round(bij.ruweAfstand) + ' tegels)'));
    }
    if (info.slecht) {
      el.appendChild(Game.util.el('div', 'beschrijving',
        'Bouw een voorraadschuur of pakhuis dichterbij, of leg een straatje naar de opslag — een geplaveide route scheelt bijna de helft.'));
    }
  }

  /* What this spot on the map is like: what a household here can reach on
     foot, and how pleasant it is to stand. Only shown where it changes a
     decision — for homes, and for anything that colours the neighbourhood. */
  function buurtBlok(el, s, g, d) {
    var toontDienst = !!d.woonruimte;
    var toontSfeer = !!(d.woonruimte || d.aantrekkelijkheid);
    if (!toontDienst && !toontSfeer) return;

    var mid = (d.grootte - 1) / 2;
    el.appendChild(Game.util.el('div', 'kop', '🏘️ De buurt hier'));

    if (toontDienst) {
      var punten = Game.core.buurt.dienstenOp(s, g.x + mid, g.y + mid);
      var deel = Math.round(Game.util.clamp(punten / Game.core.buurt.VOLLEDIG, 0, 1) * 100);
      el.appendChild(regel('Voorzieningen', deel + '%'));
      if (deel < 60) {
        el.appendChild(Game.util.el('div', 'beschrijving',
          'Deze bewoners hebben weinig binnen loopafstand. Een waterput, kapel of herberg dichterbij tilt hun humeur op.'));
      }
    }

    if (toontSfeer) {
      var sfeer = Game.core.buurt.aantrekkelijkOp(s, g.x + mid, g.y + mid);
      el.appendChild(regel('Aantrekkelijkheid', Math.round(sfeer)));
    }

    if (d.aantrekkelijkheid) {
      el.appendChild(Game.util.el('div', 'beschrijving',
        d.aantrekkelijkheid > 0
          ? 'Dit gebouw maakt de omgeving prettiger om te wonen (+' + d.aantrekkelijkheid + ').'
          : 'Rook, herrie en stof: dit maakt de omgeving minder prettig (' + d.aantrekkelijkheid + '). Zet het aan de rand van je stad.'));
    }

    el.appendChild(Game.util.el('div', 'beschrijving',
      'Druk op L voor de kaartlagen om dit over je hele stad te zien.'));
  }

  /* The town square doubles as the seat of village life: how close-knit the
     town is, and what your field army looks like. Feasts and the merchant
     live in the Stadszaken card and the top bar. */
  function dorpsleven(el, s) {
    el.appendChild(Game.util.el('div', 'kop', '🤝 Dorpsleven'));
    el.appendChild(regel('Samenhorigheid', Math.round((s.samenhorigheid || 0) * 100) + '%'));
    el.appendChild(regel('Huizen met voorzieningen', Math.round((s.dienstdekking || 0) * 100) + '%'));
    el.appendChild(regel('Gemiddelde buurt', Math.round(s.sfeer || 0)));

    var v = Game.core.demografie.verdeling(s);
    el.appendChild(Game.util.el('div', 'kop', '👪 Bevolking'));
    el.appendChild(regel('Kinderen', v.kinderen));
    el.appendChild(regel('Volwassenen', v.volwassenen));
    el.appendChild(regel('Ouderen', v.ouderen));
    el.appendChild(regel('Werkende handen', v.handen));

    var st = Game.core.standen.overzicht(s);
    el.appendChild(Game.util.el('div', 'kop', '🎩 Standen'));
    Game.config.standOrde.forEach(function (id) {
      var rij = st.per[id];
      if (rij.bewoners < 0.5) return;
      var stand = Game.config.stand(id);
      var achter = Math.round(rij.bewoners);
      if (rij.ontevreden >= 0.5) achter += ' — ' + Math.round(rij.ontevreden) + ' onvoldaan';
      el.appendChild(regel(stand.emoji + ' ' + stand.naam, achter));
    });
    el.appendChild(regel('Belasting', (Math.round(s.belasting * 600) / 10) + ' munten/min'));

    /* The one dial the player turns continuously rather than builds once. */
    var tariefRij = Game.util.el('div', 'knoprij');
    Game.config.belastingtarieven.forEach(function (t) {
      var knop = Game.util.el('button', s.belastingtarief === t.id ? 'primair' : '',
        t.emoji + ' ' + t.naam);
      knop.title = t.beschrijving +
        (t.tevredenheid ? ' (' + (t.tevredenheid > 0 ? '+' : '') + t.tevredenheid + ' tevredenheid)' : '');
      knop.addEventListener('click', function () {
        s.belastingtarief = t.id;
        P.ververs(s, true);
      });
      tariefRij.appendChild(knop);
    });
    el.appendChild(tariefRij);
    if (st.ontevredenDeel > 0.05) {
      el.appendChild(Game.util.el('div', 'beschrijving',
        'Burgers willen twee soorten voedsel, kleding en voorzieningen om de hoek; ' +
        'poorters willen drie soorten, kleding én bier, en veel meer voorzieningen. ' +
        'Wie dat niet krijgt, betaalt nauwelijks belasting en moppert.'));
      var tekort = [];
      for (var waar in (st.vraag || {})) {
        if (s.warenGeleverd && s.warenGeleverd[waar] === false) {
          tekort.push(Game.config.resources[waar].emoji + ' ' + Game.config.resources[waar].naam.toLowerCase());
        }
      }
      if (tekort.length) {
        el.appendChild(Game.util.el('div', 'waarschuwing', '⚠️ Tekort aan ' + tekort.join(' en ')));
      }
    }

    arbeidBlok(el, s);

    var wens = Game.core.dorpelingen.wens(s);
    if (wens) {
      el.appendChild(Game.util.el('div', 'kop', '🙋 Een verzoek'));
      el.appendChild(Game.util.el('div', 'beschrijving', wens.tekst));
      el.appendChild(regel('Voorzieningen daar', Math.round(wens.dekking * 100) + '% van ' +
        Math.round(wens.doel * 100) + '%'));
    }
    el.appendChild(Game.util.el('div', 'beschrijving',
      'Bouw dicht om het plein, en zorg dat elk huis een put, kapel of herberg binnen loopafstand heeft.'));

    if (s.tijdperk < 2) return;

    var leger = Game.core.raids.legerStatus(s);
    el.appendChild(Game.util.el('div', 'kop', '⚔️ Leger'));
    el.appendChild(regel('Legerkracht', leger.kracht));
    el.appendChild(regel('Soldaten', leger.soldaten));
    el.appendChild(regel('Bendes verslagen', leger.overwinningen));

    if (Game.core.raids.uitvalMogelijk(s)) {
      var rij = Game.util.el('div', 'knoprij');
      var uit = Game.util.el('button', leger.uitval ? '' : 'primair',
        leger.uitval ? '⚔️ Uitval bevolen — trek terug' : '⚔️ Uitval bevelen');
      uit.addEventListener('click', function () {
        Game.core.raids.zetUitval(s);
        P.ververs(s, true);
      });
      rij.appendChild(uit);
      el.appendChild(rij);
    } else if (leger.kracht <= 0) {
      el.appendChild(Game.util.el('div', 'beschrijving',
        'Bouw een oefenveld, kazerne of kasteel en zet er soldaten op om een leger te vormen.'));
    }
  }

  /* Labour policy. Clicking + on fifty buildings is not a decision, it is
     typing; this is the decision. Deliberately only ever *fills* empty slots
     unless the player asks for a full redeal, so it never fights the practice
     bonus that rewards leaving a crew alone. */
  function arbeidBlok(el, s) {
    var A = Game.core.arbeid;
    A.zorg(s);
    var verdeling = A.verdeling(s);

    el.appendChild(Game.util.el('div', 'kop', '👥 Arbeidsbeleid'));

    var aanRij = Game.util.el('div', 'knoprij');
    var aan = Game.util.el('button', s.arbeid.auto ? 'primair' : '',
      s.arbeid.auto ? '✔️ Vanzelf verdelen staat aan' : '👥 Laat ze zichzelf verdelen');
    aan.title = 'Vrije dorpelingen nemen om de paar seconden zelf een openstaande baan, ' +
      'in de volgorde die je hieronder kiest. Er wordt nooit iemand weggehaald bij zijn werk.';
    aan.addEventListener('click', function () {
      s.arbeid.auto = !s.arbeid.auto;
      if (s.arbeid.auto) Game.core.arbeid.vulAan(s);
      P.ververs(s, true);
    });
    aanRij.appendChild(aan);
    el.appendChild(aanRij);

    A.SOORTEN.forEach(function (soort) {
      var prio = s.arbeid.prioriteit[soort.id];
      var d = verdeling[soort.id];
      var rij = Game.util.el('div', 'arbeidrij');
      rij.appendChild(Game.util.el('span', 'arbeidnaam',
        soort.emoji + ' ' + soort.naam + ' (' + d.werkers + '/' + d.plekken + ')'));
      var knoppen = Game.util.el('span', 'arbeidknoppen');
      ['0', '1', '2', '3'].forEach(function (n, i) {
        var k = Game.util.el('button', prio === i ? 'gekozen' : '', ['—', '·', '··', '•••'][i]);
        k.title = ['Niet bemannen', 'Lage voorrang', 'Gewone voorrang', 'Eerst dit'][i];
        k.addEventListener('click', function () {
          s.arbeid.prioriteit[soort.id] = i;
          P.ververs(s, true);
        });
        knoppen.appendChild(k);
      });
      rij.appendChild(knoppen);
      el.appendChild(rij);
    });

    el.appendChild(regel('Bouwers vrijhouden', s.arbeid.bouwers));
    var bouwRij = Game.util.el('div', 'knoprij');
    [1, 3, 6].forEach(function (n) {
      var k = Game.util.el('button', s.arbeid.bouwers === n ? 'primair' : '', n + ' bouwers');
      k.title = 'Zoveel dorpelingen blijven zonder baan om te kunnen bouwen.';
      k.addEventListener('click', function () { s.arbeid.bouwers = n; P.ververs(s, true); });
      bouwRij.appendChild(k);
    });
    el.appendChild(bouwRij);

    var herRij = Game.util.el('div', 'knoprij');
    var her = Game.util.el('button', '', '🔄 Nu opnieuw verdelen');
    her.title = 'Haalt iedereen van zijn werk en deelt de hele beroepsbevolking opnieuw uit. ' +
      'Dat kost wel ervaring.';
    her.addEventListener('click', function () {
      Game.core.arbeid.herverdeel(s);
      P.ververs(s, true);
    });
    herRij.appendChild(her);
    el.appendChild(herRij);
  }

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
