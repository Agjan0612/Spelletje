/* Minimal local sound for the big moments — a war horn when raiders are
 * sighted, a bell on an age-up, a dull thud when the town is breached.
 *
 * Everything is *synthesised* with the Web Audio API: there are no audio files
 * to fetch or embed, so this works straight from file:// and keeps the repo
 * dependency-free and small. Nothing touches Game.state — the only persisted
 * bit is the on/off preference, kept in localStorage, so saves stay pure JSON.
 *
 * Browsers block audio until the first user gesture, so the context is created
 * lazily and resumed on the first click/key/touch; calls before that simply
 * make no sound (and never throw). */
(function (Game) {

  var A = {};
  var SLEUTEL = 'dorp-tot-stad-geluid';

  var ctx = null, master = null, ruisBuf = null;
  var sfeer = null;             /* the looping ambient wind bed */
  var beschikbaar = true;       /* flips off if Web Audio is missing/blocked */
  A.aan = true;

  A.init = function () {
    try {
      var opgeslagen = window.localStorage.getItem(SLEUTEL);
      if (opgeslagen === '0') A.aan = false;
    } catch (e) { /* localStorage may be unavailable; default to on */ }

    /* Create/resume the context on the first real gesture. */
    var wek = function () {
      zorgVoorContext();
      window.removeEventListener('pointerdown', wek);
      window.removeEventListener('keydown', wek);
      window.removeEventListener('touchstart', wek);
    };
    window.addEventListener('pointerdown', wek);
    window.addEventListener('keydown', wek);
    window.addEventListener('touchstart', wek);

    koppelKnop();
    werkKnopBij();
  };

  function zorgVoorContext() {
    if (!beschikbaar) return null;
    try {
      if (!ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) { beschikbaar = false; return null; }
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.35;
        master.connect(ctx.destination);
      }
      if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
      if (A.aan) startSfeer();
      return ctx;
    } catch (e) { beschikbaar = false; return null; }
  }

  function ruis() {
    if (ruisBuf) return ruisBuf;
    var n = Math.floor(ctx.sampleRate * 0.4);
    ruisBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    var data = ruisBuf.getChannelData(0);
    for (var i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    return ruisBuf;
  }

  /* A single decaying oscillator voice into the master bus. */
  function stem(type, freq, tijd, duur, vol, doel) {
    var o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, tijd);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, tijd);
    g.gain.exponentialRampToValueAtTime(vol, tijd + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, tijd + duur);
    o.connect(g); g.connect(doel || master);
    o.start(tijd); o.stop(tijd + duur + 0.03);
    return o;
  }

  /* ---------------------------------------------------------------- geluiden */

  /* War horn: two detuned low voices, slow attack, lowpass-filtered, with a
     small upward bend so it "sounds the alarm". */
  A.hoorn = function () {
    if (!A.aan || !zorgVoorContext()) return;
    try {
      var t = ctx.currentTime;
      var lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 950;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.6, t + 0.18);
      g.gain.exponentialRampToValueAtTime(0.4, t + 0.75);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.25);
      lp.connect(g); g.connect(master);

      var basis = 172;
      [[basis, 'sawtooth', 0.6], [basis * 1.5, 'triangle', 0.32], [basis * 2, 'triangle', 0.18]]
        .forEach(function (v) {
          var o = ctx.createOscillator();
          o.type = v[1];
          o.frequency.setValueAtTime(v[0] * 0.97, t);
          o.frequency.exponentialRampToValueAtTime(v[0], t + 0.22);
          var og = ctx.createGain(); og.gain.value = v[2];
          o.connect(og); og.connect(lp);
          o.start(t); o.stop(t + 1.3);
        });
    } catch (e) { /* never let sound break the game */ }
  };

  /* Church bell: a struck fundamental with a few inharmonic partials, each
     ringing out on its own exponential decay. */
  A.klok = function (grondtoon) {
    if (!A.aan || !zorgVoorContext()) return;
    try {
      var t = ctx.currentTime;
      var basis = grondtoon || 384;
      var partialen = [1, 2.0, 2.76, 3.05, 4.2];
      var volumes = [0.5, 0.3, 0.2, 0.14, 0.1];
      var vervalt = [1.7, 1.3, 1.0, 0.8, 0.6];
      for (var i = 0; i < partialen.length; i++) {
        stem('sine', basis * partialen[i], t, vervalt[i], volumes[i]);
      }
      /* A touch of strike transient. */
      var src = ctx.createBufferSource(); src.buffer = ruis();
      var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = basis * 3;
      var sg = ctx.createGain();
      sg.gain.setValueAtTime(0.25, t); sg.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      src.connect(bp); bp.connect(sg); sg.connect(master);
      src.start(t); src.stop(t + 0.13);
    } catch (e) { /* ignore */ }
  };

  /* Dull impact when the raiders break through. */
  A.dreun = function () {
    if (!A.aan || !zorgVoorContext()) return;
    try {
      var t = ctx.currentTime;
      var src = ctx.createBufferSource(); src.buffer = ruis();
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.6, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
      src.connect(lp); lp.connect(g); g.connect(master);
      src.start(t); src.stop(t + 0.32);

      var o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(96, t); o.frequency.exponentialRampToValueAtTime(44, t + 0.3);
      var og = ctx.createGain();
      og.gain.setValueAtTime(0.5, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
      o.connect(og); og.connect(master);
      o.start(t); o.stop(t + 0.35);
    } catch (e) { /* ignore */ }
  };

  /* A short triumphant peal for the finished city. */
  A.zege = function () {
    if (!A.aan || !zorgVoorContext()) return;
    var tonen = [384, 512, 640];
    tonen.forEach(function (f, i) { setTimeout(function () { A.klok(f); }, i * 260); });
  };

  /* A cheerful little fanfare when a feast starts. */
  A.feest = function () {
    if (!A.aan || !zorgVoorContext()) return;
    var nu = ctx.currentTime;
    [523, 659, 784, 1047].forEach(function (f, i) {
      stem('triangle', f, nu + i * 0.13, 0.34, 0.16);
    });
  };

  /* ------------------------------------------------------------------ sfeer

     A soft bed of wind under everything: filtered noise, slowly swelling.
     It is deliberately almost inaudible — atmosphere, not music — and it is
     one looping buffer, so it costs nothing to keep running. */
  function startSfeer() {
    if (sfeer || !ctx) return;
    try {
      var bron = ctx.createBufferSource();
      bron.buffer = langeRuis();
      bron.loop = true;

      var filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 340;
      filter.Q.value = 0.6;

      var gain = ctx.createGain();
      gain.gain.value = 0.05;

      /* Slow swell so the wind breathes instead of hissing flat. */
      var lfo = ctx.createOscillator();
      lfo.frequency.value = 0.06;
      var lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.028;
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);

      bron.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      bron.start();
      lfo.start();

      sfeer = { bron: bron, gain: gain, lfo: lfo };
    } catch (e) { sfeer = null; }
  }

  function stopSfeer() {
    if (!sfeer) return;
    try { sfeer.bron.stop(); sfeer.lfo.stop(); } catch (e) { /* already stopped */ }
    sfeer = null;
  }

  /* Four seconds of noise, long enough that the loop point is inaudible. */
  function langeRuis() {
    var n = Math.floor(ctx.sampleRate * 4);
    var buf = ctx.createBuffer(1, n, ctx.sampleRate);
    var data = buf.getChannelData(0);
    var vorig = 0;
    for (var i = 0; i < n; i++) {
      /* Brown-ish noise: smoother and less hissy than white. */
      vorig = (vorig + (Math.random() * 2 - 1) * 0.06) * 0.985;
      data[i] = vorig;
    }
    return buf;
  }

  /* ------------------------------------------------------------------ toggle */

  A.zetAan = function (aan) {
    A.aan = !!aan;
    try { window.localStorage.setItem(SLEUTEL, A.aan ? '1' : '0'); } catch (e) { /* ignore */ }
    if (A.aan) { zorgVoorContext(); A.klok(512); }   /* little confirmation ring */
    else stopSfeer();
    werkKnopBij();
  };

  function koppelKnop() {
    var knop = document.getElementById('btn-sound');
    if (!knop) return;
    knop.addEventListener('click', function () { A.zetAan(!A.aan); });
  }

  function werkKnopBij() {
    var knop = document.getElementById('btn-sound');
    if (!knop) return;
    knop.textContent = A.aan ? '🔊' : '🔇';
    knop.classList.toggle('uit', !A.aan);
    knop.title = A.aan ? 'Geluid uit' : 'Geluid aan';
  }

  Game.ui.audio = A;

})(window.Game);
