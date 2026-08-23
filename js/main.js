/* Bootstrap, game loop and input handling. */
(function (Game) {

  var TICK = 0.1;            /* simulated seconds per logic step */
  var MAX_STAPPEN = 60;      /* never spiral if the tab was in the background */
  var UI_INTERVAL = 0.2;     /* seconds between HUD refreshes */
  var AUTOSAVE = 20;         /* seconds of real time between autosaves */

  var VOORVOEGSEL = ['Eiken', 'Berken', 'Molen', 'Steen', 'Hertog', 'Vier', 'Zwaan', 'Rots', 'Beek', 'Wolven', 'Hoog', 'Zonne'];
  var ACHTERVOEGSEL = ['dorp', 'hoven', 'burg', 'wijk', 'stede', 'daal', 'veen', 'brug', 'gem', 'horst'];

  var spel = {
    state: null,
    cam: null,
    plaatsType: null,
    plaatsCheck: null,
    /* Set while an existing building is being picked up and put down again. */
    verplaatst: null,
    /* Start tile of a shift-drag row of 1x1 buildings. */
    lijn: null,
    geselecteerd: null,
    muisTegel: null,
    /* Stays false until the player picks "new village" or "continue", so the
       autosave can never overwrite a saved town from behind the welcome screen. */
    actief: false
  };

  /* ------------------------------------------------------------- opstarten */

  function start() {
    var canvas = document.getElementById('canvas');
    spel.cam = new Game.render.Camera();
    Game.render.renderer.init(canvas);

    Game.ui.log.init();
    if (Game.ui.audio) Game.ui.audio.init();
    Game.ui.hud.init(spel);
    Game.ui.buildmenu.init(spel);
    Game.ui.panel.init(spel);
    Game.ui.quests.init(spel);
    Game.ui.stad.init(spel);
    Game.ui.onderzoek.init(spel);
    Game.ui.lagen.init(spel);
    Game.ui.overlay.init(spel);
    if (Game.render.minimap) Game.render.minimap.init(spel);

    koppelInvoer(canvas);
    window.addEventListener('resize', pasMaatAan);

    /* A paused world behind the welcome screen, purely as a backdrop. */
    spel.zetState(Game.core.state.nieuw(undefined, verzinNaam()));
    spel.state.snelheid = 0;
    Game.ui.overlay.welkom();

    pasMaatAan();
    requestAnimationFrame(loop);
  }

  spel.verzinNaam = function () { return verzinNaam(); };

  function verzinNaam() {
    return VOORVOEGSEL[Math.floor(Math.random() * VOORVOEGSEL.length)] +
      ACHTERVOEGSEL[Math.floor(Math.random() * ACHTERVOEGSEL.length)];
  }

  function pasMaatAan() {
    var maat = Game.render.renderer.pasMaatAan();
    if (maat) spel.cam.stelIn(maat.b, maat.h);
  }

  /* ---------------------------------------------------------- spelbeheer -- */

  spel.zetState = function (s) {
    spel.state = s;
    spel.geselecteerd = null;
    spel.plaatsType = null;
    spel.cam.zoom = 1.3;
    spel.cam.doelZoom = 1.3;
    spel.cam.stopGlij();
    spel.cam.centreerOpTegel(s.start ? s.start.x : s.kaart.b / 2, s.start ? s.start.y : s.kaart.h / 2);
    if (Game.render.particles) Game.render.particles.reset();
    Game.render.renderer.verversWereld(s);
    Game.ui.log.teken(s);
    Game.ui.hud.ververs(s);
    Game.ui.buildmenu.ververs(s);
    Game.ui.quests.ververs(s);
    Game.ui.stad.ververs(s, true);
    Game.ui.panel.ververs(s);
  };

  /* `opties` are the choices from the new-game screen:
     { naam, seed, kaart, moeilijkheid }. Everything may be left out. */
  spel.nieuwSpel = function (opties) {
    opties = opties || {};
    var s = Game.core.state.nieuw(opties.seed, opties.naam || verzinNaam(), opties);
    Game.ui.log.schrijf(s, '🌅 ' + s.dorpsnaam + ' is gesticht. Succes!', 'goed');
    spel.zetState(s);
    spel.actief = true;
    saveTimer = 0;
    Game.core.save.opslaan(s);
  };

  spel.laadOpgeslagenSpel = function () {
    var s = Game.core.save.laden();
    if (!s) { spel.nieuwSpel(); return; }
    spel.zetState(s);
    spel.actief = true;
    saveTimer = 0;
    Game.ui.toast('📜 Je dorp is teruggehaald');
  };

  /* Pick a building up: the ghost follows the cursor and the next click puts
     it down somewhere else, for a fifth of its build cost. */
  spel.startVerplaatsen = function (g) {
    spel.plaatsType = g.type;
    spel.verplaatst = g.id;
    spel.geselecteerd = null;
    document.getElementById('canvas').classList.add('placing');
    Game.ui.panel.ververs(spel.state, true);
    Game.ui.toast('✋ Klik waar het gebouw naartoe moet (Escape annuleert)');
  };

  spel.zetSnelheid = function (n) {
    if (!spel.state) return;
    spel.state.snelheid = n;
    Game.ui.hud.ververs(spel.state);
  };

  spel.kiesBouw = function (type) {
    if (!type) spel.verplaatst = null;
    spel.lijn = null;
    spel.plaatsType = type;
    document.getElementById('canvas').classList.toggle('placing', !!type);
    if (!type) document.getElementById('ghost-info').classList.add('hidden');
    if (type) spel.geselecteerd = null;
    Game.ui.buildmenu.ververs(spel.state, true);
    Game.ui.panel.ververs(spel.state, true);
  };

  /* ------------------------------------------------- ongedaan maken ------ */

  /* A short memory of what was just put down, so a misclick costs nothing.
     Kept out of Game.state on purpose: it is a comfort for the person at the
     keyboard, not part of the town, and it has no business in a save. */
  var ongedaan = [];
  var ONGEDAAN_MAX = 20;

  spel.onthoud = function (item) {
    ongedaan.push(item);
    if (ongedaan.length > ONGEDAAN_MAX) ongedaan.shift();
  };

  spel.ongedaan = function () {
    var s = spel.state;
    if (!s || !ongedaan.length) { Game.ui.toast('Niets om ongedaan te maken'); return; }
    var item = ongedaan.pop();

    if (item.weg) {
      var t = Game.core.map.tegel(s.kaart, item.weg.x, item.weg.y);
      if (t) {
        /* Laying and lifting are the same action, so undoing either is the
           other one — and legWeg already handles the refund both ways. */
        Game.core.construction.legWeg(s, Game.config.gebouw('straat'), item.weg.x, item.weg.y);
      }
      Game.render.renderer.verversGebouwen(s);
      Game.ui.toast('↩️ Straatje teruggedraaid');
      return;
    }

    var g = Game.core.state.gebouw(s, item.gebouwId);
    if (!g) { spel.ongedaan(); return; }        /* already gone — try the one before */
    if (g.gebouwd) {
      Game.ui.toast('⚠️ ' + Game.config.gebouw(g.type).naam + ' staat al — sloop hem in het paneel');
      return;
    }
    var naam = Game.config.gebouw(g.type).naam;
    Game.core.construction.annuleer(s, g);
    if (spel.geselecteerd === g.id) spel.geselecteerd = null;
    Game.render.renderer.verversGebouwen(s);
    Game.ui.buildmenu.ververs(s, true);
    Game.ui.panel.ververs(s, true);
    Game.ui.toast('↩️ ' + naam + ' teruggedraaid');
  };

  /* ------------------------------------------------------------- de loop -- */

  var vorigeTijd = 0;
  var uiTimer = 0;
  var saveTimer = 0;
  var wandelTimer = 0;

  function loop(nu) {
    requestAnimationFrame(loop);
    var echteDt = Math.min(0.1, (nu - vorigeTijd) / 1000 || 0);
    vorigeTijd = nu;

    var s = spel.state;
    if (!s) return;

    /* --- simulatie in vaste stappen --- */
    if (s.snelheid > 0) {
      s.accu = (s.accu || 0) + echteDt * s.snelheid;
      var stappen = 0;
      while (s.accu >= TICK && stappen < MAX_STAPPEN) {
        s.accu -= TICK;
        stappen++;
        stap(s, TICK);
      }
      if (stappen >= MAX_STAPPEN) s.accu = 0;
    }

    /* --- wandelaars, effecten en tekenen lopen op echte tijd --- */
    Game.render.renderer.tickWandelaars(s, echteDt * Math.max(1, s.snelheid));
    Game.render.renderer.tickEffecten(s, echteDt * Math.max(1, s.snelheid));

    Game.render.renderer.teken(s, spel.cam, {
      plaatsType: spel.plaatsType,
      muisTegel: spel.muisTegel,
      geselecteerd: spel.geselecteerd,
      verplaatst: spel.verplaatst,
      lijn: spel.lijn
    });
    if (spel.plaatsType) toonGhostInfo();

    /* --- UI bijwerken --- */
    uiTimer += echteDt;
    if (uiTimer >= UI_INTERVAL) {
      uiTimer = 0;
      Game.ui.hud.ververs(s);
      Game.ui.quests.ververs(s);
      Game.ui.stad.ververs(s);
      Game.ui.panel.ververs(s);
      Game.ui.buildmenu.ververs(s);
      if (Game.render.minimap) Game.render.minimap.ververs(s);
    }

    wandelTimer += echteDt;
    if (wandelTimer > 3) {
      wandelTimer = 0;
      Game.render.renderer.verversWandelaars(s);
    }

    if (spel.actief) {
      saveTimer += echteDt;
      if (saveTimer >= AUTOSAVE) {
        saveTimer = 0;
        Game.core.save.opslaan(s);
      }
    }

    /* Camera inertia + smooth zoom, on real time (fase 8.4). */
    spel.cam.demp(echteDt);
    if (spel.state) spel.cam.begrens(spel.state.kaart);

    toetsenPan(echteDt);
  }

  /* One simulation step. */
  function stap(s, dt) {
    Game.core.seasons.tick(s, dt);
    Game.core.construction.tick(s, dt);
    Game.core.economy.tick(s, dt);
    Game.core.population.tick(s, dt);
    Game.core.demografie.tick(s, dt);
    Game.core.standen.tick(s, dt);
    Game.core.raids.tick(s, dt);
    Game.core.feesten.tick(s, dt);
    Game.core.handel.tick(s, dt);
    Game.core.opdrachten.tick(s, dt);
    Game.core.gebeurtenissen.tick(s, dt);
    Game.core.buren.tick(s, dt);
    Game.core.arbeid.tick(s, dt);
    Game.core.dorpelingen.tick(s, dt);
    Game.ui.quests.controleer(s);
    Game.core.ages.controleerOverwinning(s);
  }

  /* -------------------------------------------------------------- invoer -- */

  var sleept = false, sleepVerplaatst = 0, laatsteMuis = null;
  var sleepVel = { x: 0, y: 0 }, sleepTijd = 0;
  var toetsen = {};

  function koppelInvoer(canvas) {
    canvas.addEventListener('mousedown', function (ev) {
      if (ev.button === 2) return;

      /* Shift-drag with a 1x1 building selected draws a whole row at once —
         the quickest way to run a city wall or a street of houses. */
      if (spel.plaatsType && !spel.verplaatst && ev.shiftKey &&
          Game.config.gebouw(spel.plaatsType).grootte === 1 && spel.muisTegel) {
        spel.lijn = { x0: spel.muisTegel.x, y0: spel.muisTegel.y,
                      x1: spel.muisTegel.x, y1: spel.muisTegel.y };
        return;
      }

      sleept = true;
      sleepVerplaatst = 0;
      laatsteMuis = { x: ev.clientX, y: ev.clientY };
      sleepVel = { x: 0, y: 0 };
      sleepTijd = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      spel.cam.stopGlij();                 /* grab the map: kill any glide */
      canvas.classList.add('dragging');
    });

    window.addEventListener('mousemove', function (ev) {
      var r = canvas.getBoundingClientRect();
      spel.muisTegel = spel.cam.tegelOnder(ev.clientX - r.left, ev.clientY - r.top);
      spel.muisScherm = { x: ev.clientX, y: ev.clientY };

      /* While drawing a row, the drag is the row — not a camera pan. */
      if (spel.lijn && spel.muisTegel) {
        var dxL = spel.muisTegel.x - spel.lijn.x0;
        var dyL = spel.muisTegel.y - spel.lijn.y0;
        if (Math.abs(dxL) >= Math.abs(dyL)) {
          spel.lijn.x1 = spel.muisTegel.x; spel.lijn.y1 = spel.lijn.y0;
        } else {
          spel.lijn.x1 = spel.lijn.x0; spel.lijn.y1 = spel.muisTegel.y;
        }
        return;
      }

      if (sleept && laatsteMuis) {
        var dx = ev.clientX - laatsteMuis.x;
        var dy = ev.clientY - laatsteMuis.y;
        sleepVerplaatst += Math.abs(dx) + Math.abs(dy);
        if (sleepVerplaatst > 4) {
          spel.cam.beweeg(-dx, -dy);
          spel.cam.begrens(spel.state.kaart);
          /* Track the world-space velocity, so releasing the drag flings the
             map on (fase 8.4). */
          var nu = (typeof performance !== 'undefined' ? performance.now() : Date.now());
          var dtMove = Math.max(0.001, (nu - sleepTijd) / 1000);
          var wd = spel.cam.wereldDelta(-dx, -dy);
          sleepVel.x = wd.x / dtMove;
          sleepVel.y = wd.y / dtMove;
          sleepTijd = nu;
        }
        laatsteMuis = { x: ev.clientX, y: ev.clientY };
      }
    });

    window.addEventListener('mouseup', function (ev) {
      if (spel.lijn) { plaatsLijn(spel.lijn); spel.lijn = null; return; }
      if (!sleept) return;
      sleept = false;
      canvas.classList.remove('dragging');
      if (sleepVerplaatst <= 4 && ev.target === canvas) klik(ev, canvas);
      else {
        /* Fling: keep the last drag velocity so the view glides to a stop, but
           only if the pointer was actually moving when released. */
        var nu = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        if (nu - sleepTijd < 60) spel.cam.glij(sleepVel.x * 0.6, sleepVel.y * 0.6);
      }
    });

    canvas.addEventListener('contextmenu', function (ev) {
      ev.preventDefault();
      if (spel.plaatsType) spel.kiesBouw(null);
      else { spel.geselecteerd = null; Game.ui.panel.ververs(spel.state); }
    });

    canvas.addEventListener('wheel', function (ev) {
      ev.preventDefault();
      var r = canvas.getBoundingClientRect();
      spel.cam.zoomOp(ev.clientX - r.left, ev.clientY - r.top, ev.deltaY < 0 ? 1 : -1);
      spel.cam.begrens(spel.state.kaart);
    }, { passive: false });

    /* Touch: one finger pans, a tap places or selects. */
    var raakStart = null;
    canvas.addEventListener('touchstart', function (ev) {
      if (ev.touches.length !== 1) return;
      raakStart = { x: ev.touches[0].clientX, y: ev.touches[0].clientY, verplaatst: 0 };
    }, { passive: true });

    canvas.addEventListener('touchmove', function (ev) {
      if (ev.touches.length !== 1 || !raakStart) return;
      var dx = ev.touches[0].clientX - raakStart.x;
      var dy = ev.touches[0].clientY - raakStart.y;
      raakStart.verplaatst += Math.abs(dx) + Math.abs(dy);
      spel.cam.beweeg(-dx, -dy);
      spel.cam.begrens(spel.state.kaart);
      raakStart.x = ev.touches[0].clientX;
      raakStart.y = ev.touches[0].clientY;
    }, { passive: true });

    canvas.addEventListener('touchend', function (ev) {
      if (raakStart && raakStart.verplaatst < 10) {
        var r = canvas.getBoundingClientRect();
        var t = ev.changedTouches[0];
        spel.muisTegel = spel.cam.tegelOnder(t.clientX - r.left, t.clientY - r.top);
        klik({ clientX: t.clientX, clientY: t.clientY }, canvas);
      }
      raakStart = null;
    });

    window.addEventListener('keydown', function (ev) {
      toetsen[ev.key.toLowerCase()] = true;

      if (ev.key === 'Escape') {
        if (Game.ui.overlay.isOpen()) return;
        if (Game.ui.lagen.uit()) return;
        if (spel.plaatsType) spel.kiesBouw(null);
        else { spel.geselecteerd = null; Game.ui.panel.ververs(spel.state); }
      }
      /* One key steps through the map overlays and back off again. */
      if (ev.key.toLowerCase() === 'l' && !ev.shiftKey && !ev.ctrlKey && !ev.metaKey) {
        Game.ui.lagen.volgende();
      }
      if (ev.key.toLowerCase() === 'z' && (ev.ctrlKey || ev.metaKey)) {
        ev.preventDefault();
        spel.ongedaan();
      }
      if (ev.key === ' ') {
        ev.preventDefault();
        spel.zetSnelheid(spel.state.snelheid === 0 ? 1 : 0);
      }
      /* Shift + a number picks the n-th building in the open build tab.
         Read from ev.code, because shift turns '1' into '!' on most layouts. */
      if (ev.shiftKey && /^Digit[1-9]$/.test(ev.code || '')) {
        ev.preventDefault();
        Game.ui.buildmenu.kiesIndex(parseInt(ev.code.slice(5), 10) - 1);
        return;
      }

      if (ev.key === '1') spel.zetSnelheid(1);
      if (ev.key === '2') spel.zetSnelheid(2);
      if (ev.key === '3') spel.zetSnelheid(4);
      if (ev.key === '+' || ev.key === '=') spel.cam.zoomOp(spel.cam.breedte / 2, spel.cam.hoogte / 2, 1);
      if (ev.key === '-') spel.cam.zoomOp(spel.cam.breedte / 2, spel.cam.hoogte / 2, -1);
    });

    window.addEventListener('keyup', function (ev) { toetsen[ev.key.toLowerCase()] = false; });
    window.addEventListener('blur', function () { toetsen = {}; });
  }

  function toetsenPan(dt) {
    var v = 520 * dt;
    if (toetsen['w'] || toetsen['arrowup']) spel.cam.beweeg(0, -v);
    if (toetsen['s'] || toetsen['arrowdown']) spel.cam.beweeg(0, v);
    if (toetsen['a'] || toetsen['arrowleft']) spel.cam.beweeg(-v, 0);
    if (toetsen['d'] || toetsen['arrowright']) spel.cam.beweeg(v, 0);
    if (spel.state) spel.cam.begrens(spel.state.kaart);
  }

  function klik(ev, canvas) {
    var s = spel.state;
    var r = canvas.getBoundingClientRect();
    var tegelPos = spel.cam.tegelOnder(ev.clientX - r.left, ev.clientY - r.top);

    /* Putting a picked-up building back down. */
    if (spel.verplaatst) {
      var teVerplaatsen = Game.core.state.gebouw(s, spel.verplaatst);
      if (!teVerplaatsen) { spel.kiesBouw(null); return; }
      var verzet = Game.core.construction.verplaats(s, teVerplaatsen, tegelPos.x, tegelPos.y);
      if (!verzet.ok) { Game.ui.toast('⚠️ ' + verzet.reden, 1600); return; }
      spel.kiesBouw(null);
      spel.geselecteerd = teVerplaatsen.id;
      Game.render.renderer.verversGebouwen(s);
      Game.ui.panel.ververs(s, true);
      return;
    }

    if (spel.plaatsType) {
      var uitkomst = Game.core.construction.plaats(s, spel.plaatsType, tegelPos.x, tegelPos.y);
      if (!uitkomst.ok) {
        Game.ui.toast('⚠️ ' + uitkomst.reden, 1600);
      } else {
        if (uitkomst.weg) spel.onthoud({ weg: { x: tegelPos.x, y: tegelPos.y } });
        else if (uitkomst.gebouw) spel.onthoud({ gebouwId: uitkomst.gebouw.id });
        Game.render.renderer.verversGebouwen(s);
        Game.ui.buildmenu.ververs(s);
        /* Keep the building selected so you can place a row of houses; with
           shift held you keep it even when the purse runs dry. */
        if (!ev.shiftKey && !Game.core.state.kanBetalen(s, Game.config.gebouw(spel.plaatsType).kosten)) {
          spel.kiesBouw(null);
        }
      }
      return;
    }

    var tegel = Game.core.map.tegel(s.kaart, tegelPos.x, tegelPos.y);
    if (tegel && tegel.b) {
      spel.geselecteerd = tegel.b;
    } else {
      spel.geselecteerd = null;
      /* Clicking bare ground tells you what is in it — handy for hunting down
         an ore vein on the far side of the map. */
      if (tegel && tegel.n) Game.ui.toast(Game.render.renderer.tegelInfo(s, tegelPos.x, tegelPos.y), 1800);
    }
    Game.ui.panel.ververs(s);
  }

  /* Puts one building on every tile of a shift-dragged row, stopping as soon
     as the treasury runs out. */
  function plaatsLijn(lijn) {
    var s = spel.state;
    if (!spel.plaatsType) return;
    var stapX = Math.sign(lijn.x1 - lijn.x0);
    var stapY = Math.sign(lijn.y1 - lijn.y0);
    var aantal = Math.max(Math.abs(lijn.x1 - lijn.x0), Math.abs(lijn.y1 - lijn.y0)) + 1;
    var gezet = 0;

    /* A street may also be *lifted* by dragging over it, and lifting refunds
       rather than costs — so let plaats() judge each tile instead of stopping
       the whole row on an empty purse. */
    var isWeg = !!Game.config.gebouw(spel.plaatsType).weg;

    for (var i = 0; i < aantal; i++) {
      var x = lijn.x0 + stapX * i, y = lijn.y0 + stapY * i;
      if (!isWeg && !Game.core.state.kanBetalen(s, Game.config.gebouw(spel.plaatsType).kosten)) break;
      var r = Game.core.construction.plaats(s, spel.plaatsType, x, y);
      if (r.ok) {
        gezet++;
        if (r.weg) spel.onthoud({ weg: { x: x, y: y } });
        else if (r.gebouw) spel.onthoud({ gebouwId: r.gebouw.id });
      }
    }

    if (gezet) {
      Game.render.renderer.verversGebouwen(s);
      Game.ui.buildmenu.ververs(s, true);
      Game.ui.toast(isWeg
        ? '🛣️ ' + Game.util.telwoord(gezet, 'tegel straat', 'tegels straat')
        : '🏗️ ' + Game.util.telwoord(gezet, 'gebouw geplaatst', 'gebouwen geplaatst'));
    }
    if (!isWeg && !Game.core.state.kanBetalen(s, Game.config.gebouw(spel.plaatsType).kosten)) spel.kiesBouw(null);
  }

  /* Little label that follows the cursor while placing. */
  function toonGhostInfo() {
    var el = document.getElementById('ghost-info');
    if (!spel.muisScherm || !spel.muisTegel) { el.classList.add('hidden'); return; }
    var g = spel.verplaatst ? Game.core.state.gebouw(spel.state, spel.verplaatst) : null;
    var check = g
      ? Game.core.construction.controleerVerplaatsing(spel.state, g, spel.muisTegel.x, spel.muisTegel.y)
      : Game.core.construction.controleer(spel.state, spel.plaatsType, spel.muisTegel.x, spel.muisTegel.y);
    var def = Game.config.gebouw(spel.plaatsType);
    el.classList.remove('hidden');
    el.classList.toggle('fout', !check.ok);
    el.textContent = check.ok
      ? (g ? def.naam + ' hierheen verplaatsen' : def.naam + ' hier plaatsen')
      : check.reden;
    /* muisScherm is in viewport coordinates; the label lives inside #stage. */
    var stage = document.getElementById('stage').getBoundingClientRect();
    el.style.left = (spel.muisScherm.x - stage.left) + 'px';
    el.style.top = (spel.muisScherm.y - stage.top) + 'px';
  }

  window.addEventListener('DOMContentLoaded', start);

  /* Handy when debugging from the browser console. */
  window.spel = spel;

})(window.Game);
