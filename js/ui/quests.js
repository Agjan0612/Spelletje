/* The objective list and the age checklist in the right-hand column. */
(function (Game) {

  var Q = {};
  var lijstEl, eisenEl, naamEl, knopEl;
  var spel = null;
  var ZICHTBAAR = 4;

  Q.init = function (hetSpel) {
    spel = hetSpel;
    lijstEl = document.getElementById('quest-list');
    eisenEl = document.getElementById('age-reqs');
    naamEl = document.getElementById('age-next-name');
    knopEl = document.getElementById('btn-advance');

    knopEl.addEventListener('click', function () {
      Game.core.ages.bevorder(spel.state);
      Game.ui.buildmenu.ververs(spel.state);
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
      if (Game.ui.audio && Game.ui.audio.fanfare) Game.ui.audio.fanfare();
    }
  };

  Q.ververs = function (s) {
    if (!lijstEl) return;

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
      naamEl.textContent = '';
      document.querySelector('#agebox h3').textContent = 'De voltooide stad';
      Game.core.ages.eindDoelLijst(s).forEach(function (r) { eisenEl.appendChild(eisRegel(r)); });
      knopEl.disabled = true;
      knopEl.textContent = s.gewonnen ? '👑 Stad voltooid' : 'Bouw je stad af';
      return;
    }

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
