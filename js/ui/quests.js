/* The objective list and the age checklist in the right-hand column. */
(function (Game) {

  var Q = {};
  var lijstEl, eisenEl, naamEl, knopEl;
  var spel = null;
  var ZICHTBAAR = 4;

  var adviesEl = null;

  Q.init = function (hetSpel) {
    spel = hetSpel;
    lijstEl = document.getElementById('quest-list');
    eisenEl = document.getElementById('age-reqs');
    naamEl = document.getElementById('age-next-name');
    knopEl = document.getElementById('btn-advance');

    /* The village elder's advice: one line, always the single most useful next
       step. It sits above the tabs rather than inside the objectives card,
       because it is the one thing that must never be behind a tab. */
    adviesEl = document.getElementById('advies');

    knopEl.addEventListener('click', function () {
      Game.core.ages.bevorder(spel.state);
      Game.ui.buildmenu.ververs(spel.state, true);
      Q.ververs(spel.state);
    });
  };

  /* Hands out quest rewards and keeps the completed set up to date. */
  Q.controleer = function (s) {
    for (var i = 0; i < Game.config.quests.length; i++) {
      var q = Game.config.quests[i];
      if (s.questsGedaan[q.id]) continue;
      if (!q.klaar(s)) continue;

      s.questsGedaan[q.id] = true;
      var tekst = '✅ Doel behaald: ' + q.tekst;
      if (q.beloning) {
        var delen = [];
        for (var r in q.beloning) {
          Game.core.state.voegToe(s, r, q.beloning[r]);
          delen.push(q.beloning[r] + ' ' + Game.config.resources[r].naam.toLowerCase());
        }
        tekst += ' (+' + delen.join(', ') + ')';
      }
      Game.ui.log.schrijf(s, tekst, 'goed');
    }
  };

  /* Picks the single most relevant piece of advice for right now. Ordered by
     urgency, so a hungry town hears about food before anything else. */
  Q.advies = function (s) {
    if (Game.core.population.voedselDagen(s) < 2 && s.bevolking.totaal > 3) {
      return '🍽️ Je mensen dreigen honger te lijden. Zet meer dorpelingen op jacht, visserij of de akkers, of bouw er een bij.';
    }

    var raid = Game.core.raids.statusTekst && Game.core.raids.statusTekst(s);
    if (raid && raid.verdediging < raid.kracht) {
      if (raid.leger >= raid.kracht * 0.85) {
        return '⚔️ Rovers op komst! Je muren zijn te zwak, maar je leger is sterk — beveel een uitval met de knop in de roversbalk of via het dorpsplein.';
      }
      return '⚔️ Rovers op komst en je verdediging is te zwak! Bouw snel een wachttoren of muur op hun route.';
    }

    if (s.tijdperk >= 2 && s.verdediging <= 0) {
      return '🛡️ Vanaf tijdperk 2 komen er rovers. Bouw een wachttoren of oefenveld voordat het zover is.';
    }

    if (s.bevolking.ruimte - s.bevolking.totaal <= 0) {
      return '🏠 Er is geen woonruimte vrij. Bouw huisjes zodat nieuwe dorpelingen zich kunnen vestigen.';
    }

    if (s.bevolking.werkloos <= 0 && s.bevolking.totaal > 2) {
      return '🧰 Iedereen heeft een baan — houd een paar dorpelingen vrij, want zij bouwen alles.';
    }

    /* Idle villagers next to empty benches is the most common way a village
       quietly stops growing, and the fix (click the building, or switch on
       the labour policy) is not something you find by yourself. */
    var leeg = legePlekken(s);
    if (leeg >= 2 && s.bevolking.werkloos > (s.arbeid ? s.arbeid.bouwers : 3)) {
      return '👥 ' + s.bevolking.werkloos + ' dorpelingen lopen werkloos rond terwijl er ' +
        leeg + ' werkplekken leegstaan. Klik een gebouw aan en zet er mensen op, of ' +
        'zet op het dorpsplein de arbeidsverdeling op automatisch.';
    }

    if (s.tevredenheid < 45) {
      return '😟 Je dorp is ontevreden. Bouw een waterput, kapel of herberg, of geef een feest met de 🎉-knop rechtsboven.';
    }

    if (Game.core.ages.kanBevorderen(s)) {
      return '⚑ Je hebt alles voor het volgende tijdperk! Klik op "Bevorder tijdperk".';
    }

    var eisen = Game.core.ages.eisen(s);
    if (eisen) {
      var mist = eisen.lijst.filter(function (r) { return !r.klaar; })[0];
      if (mist) {
        var wat = mist.tekst.replace(/^[^ ]+ /, '');
        return '🎯 Op weg naar ' + eisen.tijdperk.naam + ': werk aan ' +
          wat.charAt(0).toLowerCase() + wat.slice(1) + ' (' +
          Game.util.fmt(mist.nu) + ' van ' + Game.util.fmt(mist.doel) + ').';
      }
    }
    return '🏰 Mooi bezig! Blijf je stad uitbouwen en houd voedsel en tevredenheid op peil.';
  };

  function legePlekken(s) {
    var leeg = 0;
    for (var i = 0; i < s.gebouwen.length; i++) {
      var g = s.gebouwen[i];
      if (!g.gebouwd || g.uit) continue;
      var d = Game.core.state.def(g);
      if (d.banen) leeg += d.banen.aantal - g.werkers;
    }
    return leeg;
  }

  Q.ververs = function (s) {
    if (!lijstEl) return;

    if (adviesEl) adviesEl.textContent = Q.advies(s);

    /* --- doelen --- */
    lijstEl.innerHTML = '';
    var getoond = 0;
    var laatsteKlaar = null;

    for (var i = 0; i < Game.config.quests.length && getoond < ZICHTBAAR; i++) {
      var q = Game.config.quests[i];
      if (s.questsGedaan[q.id]) { laatsteKlaar = q; continue; }
      var li = Game.util.el('li');
      li.appendChild(Game.util.el('span', 'mark', '☐'));
      var tekst = Game.util.el('span', '', q.tekst);
      if (getoond === 0 && q.hint) tekst.title = q.hint;
      li.appendChild(tekst);
      lijstEl.appendChild(li);
      getoond++;
    }

    if (laatsteKlaar && getoond < ZICHTBAAR + 1) {
      var klaarLi = Game.util.el('li', 'ok');
      klaarLi.appendChild(Game.util.el('span', 'mark', '☑'));
      klaarLi.appendChild(Game.util.el('span', '', laatsteKlaar.tekst));
      lijstEl.insertBefore(klaarLi, lijstEl.firstChild);
    }

    if (!getoond) {
      var af = Game.util.el('li', 'ok');
      af.textContent = 'Alle doelen behaald — je stad is compleet!';
      lijstEl.appendChild(af);
    }

    /* --- tijdperk --- */
    eisenEl.innerHTML = '';
    var eisen = Game.core.ages.eisen(s);

    if (!eisen) {
      /* Careful: the heading holds #age-next-name, so write around the span
         rather than through the whole heading's textContent. */
      naamEl.textContent = '';
      var kop = document.querySelector('#agebox h3');
      if (kop.firstChild && kop.firstChild.nodeType === 3) kop.firstChild.nodeValue = 'De voltooide stad';
      Game.core.ages.eindDoelLijst(s).forEach(function (r) { eisenEl.appendChild(eisRegel(r)); });
      knopEl.disabled = true;
      knopEl.textContent = s.gewonnen ? '👑 Stad voltooid' : 'Bouw je stad af';
      return;
    }

    var kop2 = document.querySelector('#agebox h3');
    if (kop2.firstChild && kop2.firstChild.nodeType === 3) kop2.firstChild.nodeValue = 'Volgend tijdperk ';
    naamEl.textContent = eisen.tijdperk.emoji + ' ' + eisen.tijdperk.naam;
    eisen.lijst.forEach(function (r) { eisenEl.appendChild(eisRegel(r)); });

    var kosten = eisen.tijdperk.kosten || {};
    var kostenDelen = [];
    for (var r2 in kosten) {
      kostenDelen.push(Game.config.resources[r2].emoji + ' ' + kosten[r2]);
    }
    if (kostenDelen.length) {
      var li2 = Game.util.el('li', Game.core.state.kanBetalen(s, kosten) ? 'ok' : '');
      li2.appendChild(Game.util.el('span', 'mark', '💰'));
      li2.appendChild(Game.util.el('span', '', 'Kosten: ' + kostenDelen.join('  ')));
      eisenEl.appendChild(li2);
    }

    var kan = Game.core.ages.kanBevorderen(s);
    knopEl.disabled = !kan;
    knopEl.textContent = kan ? '⚑ Bevorder tot ' + eisen.tijdperk.naam : 'Bevorder tijdperk';
  };

  function eisRegel(r) {
    var li = Game.util.el('li', r.klaar ? 'ok' : '');
    li.appendChild(Game.util.el('span', 'mark', r.klaar ? '☑' : '☐'));
    var waarde = r.procent
      ? r.nu + '% / ' + r.doel + '%'
      : Game.util.fmt(r.nu) + ' / ' + Game.util.fmt(r.doel);
    li.appendChild(Game.util.el('span', '', r.tekst + ': ' + waarde));
    return li;
  }

  Game.ui.quests = Q;

})(window.Game);
