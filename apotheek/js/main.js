/* De bootstrap en de lus.
 *
 * Vaste tijdstap, losgekoppeld van het tekenen: de snelheidsknoppen
 * vermenigvuldigen het *aantal* stappen, nooit de grootte ervan. Een simulatie
 * die bij 4x met vier keer zo grote stappen rekent, is bij 4x een ander spel.
 *
 * De tickvolgorde staat hieronder en nergens anders. tools/simuleer-apotheek.js
 * draait exact deze functie, zodat een headless balansrun onmogelijk stilletjes
 * iets anders kan meten dan wat de speler speelt. */
(function (A) {

  var TICK = 0.1;                  /* echte seconden per simulatiestap */
  var MAX_STAPPEN = 60;
  var UI_INTERVAL = 0.12;

  var spel = {
    state: null,
    cam: null,
    ctx: null,
    actief: false
  };

  /* ------------------------------------------------------- de tickvolgorde -- */
  /* dm is speelminuten, niet seconden: dit spel meet alles in minuten van de
     werkdag, dus dat is de eenheid die door de hele kern loopt. */
  function stap(s, dm) {
    A.core.klok.tick(s, dm);
    A.core.toeloop.tick(s, dm);
    A.core.personeel.tick(s, dm);
    /* Protocollen draaien ná het personeel: een recept dat deze tik op
       'besluit' belandt, wordt in dezelfde tik door het beleid opgepakt in
       plaats van een tik te blijven liggen. */
    A.core.protocollen.tick(s);
    A.core.werkvloer.tick(s, dm);
  }
  spel.stap = stap;
  spel.TICK = TICK;
  spel.minutenPerStap = function () { return TICK * A.config.inst.minutenPerSeconde; };

  /* ------------------------------------------------------------- opstarten -- */

  function nieuwSpel(zaad) {
    spel.state = A.core.state.nieuw(zaad || Math.floor(Math.random() * 1e9), 'Apotheek De Waag');
    A.state = spel.state;
    spel.actief = true;
    A.ui.log.schrijf(spel.state, '🌅 Dag 1 — de deur gaat open.');
    verversAlles(true);
    return spel.state;
  }
  spel.nieuwSpel = nieuwSpel;

  function verversAlles(forceer) {
    var s = spel.state;
    if (!s) return;
    A.ui.hud.ververs(s);
    A.ui.werklijst.ververs(s, forceer);
    A.ui.receptkaart.ververs(s);
    A.ui.beleid.ververs(s, forceer);
  }

  /* ------------------------------------------------------------------ lus -- */

  var vorigeTijd = 0;
  var uiTimer = 0;

  function lus(nu) {
    requestAnimationFrame(lus);
    var echteDt = Math.min(0.1, (nu - vorigeTijd) / 1000 || 0);
    vorigeTijd = nu;

    var s = spel.state;
    if (!s) return;

    if (s.snelheid > 0 && !s.dagKlaar) {
      s.accu += echteDt * s.snelheid;
      var stappen = 0;
      while (s.accu >= TICK && stappen < MAX_STAPPEN) {
        s.accu -= TICK;
        stappen++;
        stap(s, spel.minutenPerStap());
      }
      if (stappen >= MAX_STAPPEN) s.accu = 0;
    }

    A.render.tekenen.teken(s, spel.cam, spel.ctx);

    uiTimer += echteDt;
    if (uiTimer >= UI_INTERVAL) {
      uiTimer = 0;
      verversAlles(false);
    }

    if (s.dagKlaar && !dagrapportOpen) {
      dagrapportOpen = true;
      A.ui.overlay.dagrapport(s, function () {
        A.ui.overlay.sluit();
        dagrapportOpen = false;
        A.core.klok.nieuweDag(s);
        s.snelheid = 1;
        zetSnelheidsknop(1);
        verversAlles(true);
      });
    }
  }
  var dagrapportOpen = false;

  /* ---------------------------------------------------------------- invoer -- */

  function zetSnelheidsknop(v) {
    var knoppen = document.querySelectorAll('#snelheden .spd');
    for (var i = 0; i < knoppen.length; i++) {
      knoppen[i].classList.toggle('actief', Number(knoppen[i].dataset.snelheid) === v);
    }
  }

  function snelheid(v) {
    if (!spel.state) return;
    spel.state.snelheid = v;
    zetSnelheidsknop(v);
  }

  function maatvoering() {
    var vloer = document.getElementById('vloer');
    var canvas = document.getElementById('canvas');
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var b = vloer.clientWidth, h = vloer.clientHeight;
    canvas.width = Math.round(b * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = b + 'px';
    canvas.style.height = h + 'px';
    spel.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (spel.state) spel.cam.pas(spel.state.pand, b, h);
  }

  function start() {
    var canvas = document.getElementById('canvas');
    spel.ctx = canvas.getContext('2d');
    spel.cam = new A.render.Camera();

    document.getElementById('btn-beleid').addEventListener('click', function () {
      A.ui.beleid.wissel(spel.state);
    });

    document.getElementById('snelheden').addEventListener('click', function (e) {
      var k = e.target.closest('.spd');
      if (k) snelheid(Number(k.dataset.snelheid));
    });

    window.addEventListener('keydown', function (e) {
      if (!spel.state) return;
      if (e.code === 'Space') { e.preventDefault(); snelheid(spel.state.snelheid > 0 ? 0 : 1); }
      else if (e.key === '1') snelheid(1);
      else if (e.key === '2') snelheid(2);
      else if (e.key === '3') snelheid(4);
      else if (e.key === 'Enter') A.ui.receptkaart.volgende(spel.state);
      else if (e.key === 'p' || e.key === 'P') A.ui.beleid.wissel(spel.state);
      else if (e.key === 'Escape') A.ui.receptkaart.sluit();
    });

    window.addEventListener('resize', maatvoering);

    A.ui.overlay.welkom(function () {
      A.ui.overlay.sluit();
      nieuwSpel();
      maatvoering();
    });

    /* Een leeg pand tekenen tot de speler op "open de deur" klikt: een zwart
       scherm achter een dialoog leest als iets dat kapot is. */
    nieuwSpel(1);
    spel.state.snelheid = 0;
    maatvoering();
    requestAnimationFrame(lus);
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
  }

  window.spel = spel;
  A.spel = spel;

})(window.Apotheek);
