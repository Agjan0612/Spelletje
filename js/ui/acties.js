/* The "Het dorp" action card in the right column: throw a festival, visit the
   travelling merchant, and hand in the lord's order. It only reads and calls
   the core modules; all the rules live there. The card is built in JS and
   appended to #right-col, so it needs no extra markup in index.html. */
(function (Game) {

  var A = {};
  var spel = null;
  var box, feestBtn, koopBtn, opdrachtDiv, leverBtn;

  A.init = function (hetSpel) {
    spel = hetSpel;
    var col = document.getElementById('right-col');
    if (!col) return;

    box = Game.util.el('section', 'card');
    box.id = 'actiebox';
    box.appendChild(Game.util.el('h3', '', 'Het dorp'));

    feestBtn = Game.util.el('button', 'actieknop', '🎉 Feest vieren');
    feestBtn.addEventListener('click', function () {
      Game.core.feesten.vier(spel.state);
      A.ververs(spel.state);
      Game.ui.hud.ververs(spel.state);
    });
    box.appendChild(feestBtn);

    koopBtn = Game.util.el('button', 'actieknop', '🐴 Bezoek de koopman');
    koopBtn.addEventListener('click', function () { Game.ui.overlay.koopman(spel.state); });
    box.appendChild(koopBtn);

    opdrachtDiv = Game.util.el('div', 'opdracht');
    box.appendChild(opdrachtDiv);

    leverBtn = Game.util.el('button', 'actieknop', '📜 Lever aan de heer');
    leverBtn.addEventListener('click', function () {
      var r = Game.core.opdrachten.lever(spel.state);
      if (!r.ok) Game.ui.toast('⚠️ ' + r.reden);
      A.ververs(spel.state);
      Game.ui.hud.ververs(spel.state);
    });
    box.appendChild(leverBtn);

    /* Sit between the age card and the objectives so it is always in view. */
    var questbox = document.getElementById('questbox');
    if (questbox) col.insertBefore(box, questbox);
    else col.appendChild(box);
  };

  A.ververs = function (s) {
    if (!box || !s) return;
    var F = Game.core.feesten, H = Game.core.handel, O = Game.core.opdrachten;

    /* Festival */
    var kanFeest = F.kanVieren(s);
    var cd = Math.ceil(F.cooldown(s));
    feestBtn.disabled = !kanFeest;
    feestBtn.textContent = '🎉 Feest vieren (' + H.deelTekst(F.kosten(s)) + ')';
    feestBtn.title = cd > 0
      ? 'De vorige feestvreugde zakt nog weg — nog ' + cd + 's'
      : 'Geef graan en munten uit voor een flinke tevredenheidsboost';
    feestBtn.classList.toggle('op', kanFeest);

    /* Merchant */
    var koop = H.aanwezig(s);
    koopBtn.classList.toggle('hidden', !koop);
    koopBtn.classList.toggle('op', koop);

    /* Lord's order */
    var o = s.opdracht;
    if (o && o.actief) {
      var heeft = Math.floor(s.res[o.res]);
      opdrachtDiv.classList.remove('hidden');
      opdrachtDiv.innerHTML = '📜 <b>Opdracht van de heer</b><br>' + o.tekst +
        '<br>Voortgang: ' + heeft + ' / ' + o.doel +
        ' · nog ' + O.resterendeDagen(s) + ' dagen';
      leverBtn.classList.remove('hidden');
      leverBtn.disabled = s.res[o.res] < o.doel;
      leverBtn.classList.toggle('op', s.res[o.res] >= o.doel);
    } else {
      opdrachtDiv.classList.add('hidden');
      leverBtn.classList.add('hidden');
    }
  };

  Game.ui.acties = A;

})(window.Game);
