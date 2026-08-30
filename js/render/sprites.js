/* All drawing of terrain and buildings, in an isometric (2:1 diamond) view.
   The camera (js/render/camera.js) does the projection; this module draws the
   shapes that sit on that grid.

   Terrain tiles are drawn as diamonds. Buildings are drawn as procedural
   isometric volumes (walls + roof) rather than from the image atlas: the Kenney
   sprites are top-down and would clash with the tilted ground, so in iso they
   are bypassed here. Trees and rocks stay as upright billboards from the atlas
   (with a hand-drawn fallback) so the game still runs without the assets. */
(function (Game) {

  var S = {};

  /* Base colours per terrain, per season (lente, zomer, herfst, winter). */
  /* Base terrain colours, per season (lente, zomer, herfst, winter).
   *
     Two deliberate moves here over the older table, both about *range*. The
     whole palette used to sit between 40% and 65% lightness at under about 35%
     saturation, and a screenshot of it came out flat however much was drawn on
     it — nothing was dark and nothing was light. So the greens are warmer and
     considerably more saturated, and the gap between grass and wood is now
     wide enough to read as two kinds of ground rather than two shades.

     And `vruchtbaar` has come *towards* grass instead of away from it. Fertile
     ground is not a different landscape, it is grass that happens to be worth
     ploughing, and painting it olive-brown turned every interleaved patch of
     it into a visible chequerboard of two terrains — one of the loudest grids
     left on the map after fase C. It is a warmer, yellower green now; the
     furrows on it and the grondstoffen overlay are what a player hunting for
     farmland should be reading, and both say it far more clearly than a brown
     tile ever did. */
  var TERREIN = {
    gras:       ['#74a03f', '#6d9a33', '#93973a', '#ccd2c6'],
    vruchtbaar: ['#8aa03c', '#93a032', '#a89a33', '#c4c6b2'],
    bos:        ['#33562a', '#2d5023', '#525c22', '#6f8072'],
    rots:       ['#847f74', '#847f74', '#807a6e', '#a2a29e'],
    berg:       ['#5c5750', '#5c5750', '#59544d', '#8d8d8d'],
    water:      ['#3a6f93', '#3d76a2', '#366a8e', '#456f88']
  };

  var ADERKLEUR = {
    ijzer: '#b7c2cf', koper: '#d98a3e', edelsteen: '#63d6e0', steen: '#c9c6bd'
  };

  S.terreinKleur = function (tegel, seizoen) {
    var rij = TERREIN[tegel.t] || TERREIN.gras;
    return rij[seizoen] || rij[0];
  };

  /* ----------------------------------------------------------- relief cache

     A per-tile hillshade factor (~0.8..1.22) from the height difference with
     the up/left neighbours, as if lit from the top-left. Computed once per map
     and kept in this module (never in Game.state) so saves stay pure JSON. */

  var schaduwCache = { seed: null, arr: null, diepte: null };

  function tegelH(kaart, x, y, terug) {
    var t = Game.core.map.tegel(kaart, x, y);
    return t ? (t.h || 0) : terug;
  }

  S.bereidTerreinVoor = function (kaart) {
    if (!kaart || !kaart.tegels) return;
    if (schaduwCache.seed === kaart.seed && schaduwCache.arr &&
        schaduwCache.arr.length === kaart.tegels.length) return;

    var b = kaart.b, h = kaart.h;
    var arr = new Float32Array(b * h);
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < b; x++) {
        var i = y * b + x;
        var hc = kaart.tegels[i].h || 0;
        var ul = tegelH(kaart, x - 1, y - 1, hc);
        var u = tegelH(kaart, x, y - 1, hc);
        var l = tegelH(kaart, x - 1, y, hc);
        var dh = hc - (ul * 0.5 + u * 0.25 + l * 0.25);
        arr[i] = Game.util.clamp(1 + dh * 2.4, 0.8, 1.22);
      }
    }
    schaduwCache = {
      seed: kaart.seed, arr: arr,
      diepte: bouwDiepte(kaart),
      randen: bouwRanden(kaart),
      ruis: bouwRuis(kaart)
    };
  };

  /* ------------------------------------------------------------- ruisveld

     Every tile carries `tegel.v`, a stable random of its own, and the ground
     used to take its brightness straight from it. That is noise with a
     wavelength of exactly one tile, and the eye reads wavelength-one noise as
     a grid — it was the single loudest reason you could count the tiles on a
     screenshot.

     This is the same idea at the right scale: three octaves of value noise at
     wavelengths of about 12, 5 and 2 tiles, bilinearly interpolated off a
     coarse lattice and summed. Grass then has patches of drier and damper
     ground tens of tiles across, the way an Age of Empires map does, and
     `tegel.v` goes back to being what it is good at: deciding *which* tree
     sprite and *how many* boulders, things that genuinely differ per tile.

     Built once per map, next to the hillshade, keyed on kaart.seed and never
     in Game.state. */
  var OCTAVEN = [[13, 0.54], [5, 0.31], [2, 0.15]];

  function ruisHash(seed, o, i) {
    var n = (seed | 0) + o * 374761393 + i * 668265263;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }

  function zacht(t) { return t * t * (3 - 2 * t); }

  function bouwRuis(kaart) {
    var b = kaart.b, h = kaart.h;
    var arr = new Float32Array(b * h);

    for (var o = 0; o < OCTAVEN.length; o++) {
      var golf = OCTAVEN[o][0], gewicht = OCTAVEN[o][1];
      var nb = Math.ceil(b / golf) + 2, nh = Math.ceil(h / golf) + 2;
      var rooster = new Float32Array(nb * nh);
      for (var r = 0; r < rooster.length; r++) rooster[r] = ruisHash(kaart.seed, o, r);

      for (var y = 0; y < h; y++) {
        var gy = y / golf, y0 = gy | 0, fy = zacht(gy - y0);
        var rij0 = y0 * nb, rij1 = (y0 + 1) * nb;
        for (var x = 0; x < b; x++) {
          var gx = x / golf, x0 = gx | 0, fx = zacht(gx - x0);
          var a = rooster[rij0 + x0], bb = rooster[rij0 + x0 + 1];
          var c = rooster[rij1 + x0], dd = rooster[rij1 + x0 + 1];
          var boven = a + (bb - a) * fx;
          var onder = c + (dd - c) * fx;
          arr[y * b + x] += (boven + (onder - boven) * fy) * gewicht;
        }
      }
    }
    return arr;
  }

  /* The noise at a tile, 0..1. Falls back to the tile's own random when the
     cache is not for this map (the first frame after a new game). */
  function ruisOp(kaart, idx, tegel) {
    var R = schaduwCache.ruis;
    if (!R || schaduwCache.seed !== kaart.seed) return tegel ? tegel.v : 0.5;
    return R[idx];
  }
  S.ruisOp = function (kaart, x, y) {
    if (!kaart) return 0.5;
    return ruisOp(kaart, y * kaart.b + x, null);
  };

  /* How far every water tile is from the nearest land, in tiles (a flood fill
     from the coastline, capped at MAXDIEPTE). Land is 0. Shallow water near a
     shore is drawn turquoise and open water deep blue, which is what turns a
     flat teal blob into a sea. Computed once per map and kept here, never in
     Game.state. */
  var MAXDIEPTE = 7;

  function bouwDiepte(kaart) {
    var b = kaart.b, h = kaart.h, n = b * h;
    var diep = new Uint8Array(n);
    var rij = [];
    for (var i = 0; i < n; i++) {
      if (kaart.tegels[i].t !== 'water') { diep[i] = 0; rij.push(i); }
      else diep[i] = 255;
    }
    for (var k = 0; k < rij.length; k++) {
      var idx = rij[k];
      var d = diep[idx];
      if (d >= MAXDIEPTE) continue;
      var x = idx % b, y = (idx - x) / b;
      for (var e = 0; e < BUUREDGE.length; e++) {
        var nx = x + BUUREDGE[e].dx, ny = y + BUUREDGE[e].dy;
        if (nx < 0 || ny < 0 || nx >= b || ny >= h) continue;
        var ni = ny * b + nx;
        if (diep[ni] !== 255) continue;
        diep[ni] = d + 1;
        rij.push(ni);
      }
    }
    for (var j = 0; j < n; j++) if (diep[j] === 255) diep[j] = MAXDIEPTE;

    /* Smooth it. The flood fill counts whole tiles, so the sea came out in
       concentric diamond steps — a staircase of blues that was one of the
       clearest places you could read the grid off the screen. Two box-blur
       passes turn those steps into a gradient, at the cost of one float array
       built once per map. */
    var zacht = new Float32Array(n);
    for (var q = 0; q < n; q++) zacht[q] = diep[q];
    var tmp = new Float32Array(n);
    for (var ronde = 0; ronde < 2; ronde++) {
      for (var yy = 0; yy < h; yy++) {
        for (var xx = 0; xx < b; xx++) {
          var som = 0, tel = 0;
          for (var oy = -1; oy <= 1; oy++) {
            var ny = yy + oy;
            if (ny < 0 || ny >= h) continue;
            for (var ox = -1; ox <= 1; ox++) {
              var nx = xx + ox;
              if (nx < 0 || nx >= b) continue;
              som += zacht[ny * b + nx]; tel++;
            }
          }
          tmp[yy * b + xx] = som / tel;
        }
      }
      zacht.set(tmp);
    }
    return zacht;
  }

  /* Which of a tile's four edges border a *different* terrain, and which
     terrain that is. One byte per tile for the mask plus four for the
     neighbours, worked out once per map instead of four map.tegel() lookups
     per tile per frame — and the common case (a tile in the middle of a field)
     then costs a single array read and an early return. */
  var TERREINEN = ['gras', 'vruchtbaar', 'bos', 'rots', 'berg', 'water'];

  function bouwRanden(kaart) {
    var b = kaart.b, h = kaart.h, n = b * h;
    var masker = new Uint8Array(n);
    var buren = new Uint8Array(n * 4);
    var nr = {};
    for (var q = 0; q < TERREINEN.length; q++) nr[TERREINEN[q]] = q;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < b; x++) {
        var i = y * b + x;
        var eigen = kaart.tegels[i].t;
        for (var e = 0; e < BUUREDGE.length; e++) {
          var nx = x + BUUREDGE[e].dx, ny = y + BUUREDGE[e].dy;
          if (nx < 0 || ny < 0 || nx >= b || ny >= h) continue;
          var bt = kaart.tegels[ny * b + nx].t;
          if (bt === eigen) continue;
          masker[i] |= (1 << e);
          buren[i * 4 + e] = nr[bt] || 0;
        }
      }
    }
    return { masker: masker, buren: buren };
  }

  function schaduwFactor(kaart, i) {
    return (kaart && schaduwCache.arr && schaduwCache.seed === kaart.seed) ? schaduwCache.arr[i] : 1;
  }

  /* 0 at the shoreline, 1 in open water. */
  function diepteDeel(kaart, i) {
    if (!kaart || !schaduwCache.diepte || schaduwCache.seed !== kaart.seed) return 0.5;
    return Game.util.clamp((schaduwCache.diepte[i] - 1) / (MAXDIEPTE - 1), 0, 1);
  }


  /* -------------------------------------------------------- colour helpers */

  function ontleed(kleur) {
    var m = kleur.match(/^#(\w\w)(\w\w)(\w\w)$/);
    if (m) return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
    m = kleur.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (m) return [+m[1], +m[2], +m[3]];
    return [200, 200, 200];
  }

  /* Multiply a colour by a brightness factor, returning an rgb() string.
     Memoised on (colour, factor rounded to 1/200): this runs a few times per
     tile per frame — terrain shade, every transition band, every building face
     — and re-parsing a hex string that often was measurable. */
  var verfCache = Object.create(null);
  var verfAantal = 0;

  function verf(kleur, f) {
    var sleutel = kleur + '#' + (f * 200 | 0);
    var uit = verfCache[sleutel];
    if (uit) return uit;
    var c = ontleed(kleur);
    uit = 'rgb(' + Game.util.clamp(Math.round(c[0] * f), 0, 255) + ',' +
                   Game.util.clamp(Math.round(c[1] * f), 0, 255) + ',' +
                   Game.util.clamp(Math.round(c[2] * f), 0, 255) + ')';
    /* Bounded: buildings mix their own shades, so the key space is open. */
    if (verfAantal > 6000) { verfCache = Object.create(null); verfAantal = 0; }
    verfCache[sleutel] = uit;
    verfAantal++;
    return uit;
  }

  /* Final tile colour: base hex, per-tile brightness `v`, and the hillshade. */
  function eindKleur(hex, v, shade) {
    return verf(hex, (0.88 + v * 0.24) * shade);
  }

  /* ------------------------------------------------------- grondpalet ----

     The colour of a land tile is a pure function of four things: which terrain,
     which season, where it sits in the noise field, and its hillshade. All four
     are small and bounded, so the whole answer is a lookup table — built once,
     lazily, and indexed with four integers per tile. No hex parsing, no string
     building and no cache probe on the hottest path in the renderer: at minimum
     zoom this runs several thousand times a frame, and that headroom is what
     pays for the material work in fase D.

     The ramp does two things at once, which is the point. Brightness carries
     the patch, and a warm/cool shift carries what *kind* of patch: the dry side
     leans yellow-brown, the damp side blue-green. One shift is all it takes to
     stop a brightness ramp reading as a lighting error. */
  var RUISN = 12, SCHADUWN = 14;
  var SCHADUW_MIN = 0.8, SCHADUW_SPAN = 0.42;   /* matches the clamp in bereidTerreinVoor */
  var grondPalet = null;

  /* How far the dry/damp shift swings per terrain: bare rock barely changes
     colour with the damp, grass changes a lot. */
  var RUISKRACHT = {
    gras: 1, vruchtbaar: 0.85, bos: 0.8, rots: 0.45, berg: 0.4
  };

  /* The seasonal grade, and the reason it lives in a lookup table.
   *
     A grade wants to pull a picture's contrast and saturation *apart*; a wash
     over the finished frame can only pull them together, so js/render/sfeer.js
     cannot do it however many gradients it lays on. The canvas primitive that
     can — ctx.filter over a copy of the canvas onto itself — was built and
     measured at +440 ms a frame at playing zoom, which is more than twice the
     whole frame. See the note in sfeer.js.

     So it happens here instead, at build time, on the colours themselves. The
     ground is most of what is on screen, and a table can carry a curve exactly
     as well as a filter can — for nothing. Summer is bright and punchy, autumn
     rich and warm, winter pale, blue and flat. */
  var SEIZOENSGRADATIE = [
    { contrast: 1.06, verzadiging: 1.06 },   /* lente  */
    { contrast: 1.10, verzadiging: 1.10 },   /* zomer  */
    { contrast: 1.08, verzadiging: 1.14 },   /* herfst */
    { contrast: 0.96, verzadiging: 0.82 }    /* winter */
  ];

  function gradeer(c, g) {
    var lum = c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114;
    var uit = [];
    for (var i = 0; i < 3; i++) {
      var v = lum + (c[i] - lum) * g.verzadiging;
      uit[i] = 128 + (v - 128) * g.contrast;
    }
    return uit;
  }

  function bouwGrondPalet() {
    grondPalet = {};
    for (var t in TERREIN) {
      if (t === 'water') continue;               /* depth decides water, not noise */
      var kracht = RUISKRACHT[t] != null ? RUISKRACHT[t] : 1;
      var perSeizoen = [];
      for (var sz = 0; sz < 4; sz++) {
        var c = gradeer(ontleed(TERREIN[t][sz] || TERREIN[t][0]), SEIZOENSGRADATIE[sz]);
        var rijen = [];
        for (var r = 0; r < RUISN; r++) {
          var u = r / (RUISN - 1);
          var f = 1 + (u - 0.5) * 0.30 * kracht;
          var warm = (u - 0.5) * 26 * kracht;
          var schaduwen = [];
          for (var q = 0; q < SCHADUWN; q++) {
            var sh = SCHADUW_MIN + (q / (SCHADUWN - 1)) * SCHADUW_SPAN;
            schaduwen.push('rgb(' + kanaal(c[0] * f + warm, sh) + ',' +
                                    kanaal(c[1] * f + warm * 0.3, sh) + ',' +
                                    kanaal(c[2] * f - warm * 0.75, sh) + ')');
          }
          rijen.push(schaduwen);
        }
        perSeizoen.push(rijen);
      }
      grondPalet[t] = perSeizoen;
    }
  }

  function kanaal(v, sh) { return Game.util.clamp(Math.round(v * sh), 0, 255); }

  function grondKleur(terrein, seizoen, r, shade) {
    if (!grondPalet) bouwGrondPalet();
    var rij = grondPalet[terrein] || grondPalet.gras;
    var ri = (r * RUISN) | 0;
    if (ri < 0) ri = 0; else if (ri >= RUISN) ri = RUISN - 1;
    var qi = ((shade - SCHADUW_MIN) / SCHADUW_SPAN * SCHADUWN) | 0;
    if (qi < 0) qi = 0; else if (qi >= SCHADUWN) qi = SCHADUWN - 1;
    return rij[seizoen][ri][qi];
  }

  /* Slight per-tile brightness so a field of grass is not a flat colour. */
  function schakering(kleur, v) {
    return verf(kleur, 0.88 + v * 0.24);
  }
  S.schakering = schakering;

  /* ------------------------------------------------------------- korrel ---

     The cheapest real texture there is, and the largest single step away from
     "flat vector" that this file makes: one tiling noise bitmap, composited
     over the whole ground in a single fillRect with soft-light. Every square
     centimetre of ground in the game stops being an even fill, for the cost of
     one full-screen blend a frame.

     Two things make it work rather than merely cheap:

       - It is anchored to the *world*, not the screen. Without that the grain
         swims over the ground as you pan, which is far more noticeable than
         having no grain at all. It does not scale with the zoom, though — it is
         the tooth of the paper, not a thing lying in the world.
       - It goes under the standing layer. Buildings and trees have material of
         their own and do not want this on top of them.

     The bitmap is two octaves of wrapping value noise (fine and coarse), and it
     is *pre-multiplied into black and white speckles with an alpha* rather than
     being mid-grey under a soft-light blend. Both give the same picture — mid
     grey under soft-light is a no-op, and so is alpha zero — but soft-light is
     branchy per-pixel maths over a million-odd pixels every frame, and a plain
     source-over blend is the one path every renderer has optimised to death.
     Measured on presented frames in headless Chromium (software rendering, so
     a pessimistic floor) that swap was worth tens of milliseconds a frame. */
  var KORREL = 128;
  var korrelDoek = null, korrelPatroon = null;

  /* Wrapping value noise, `blok` pixels per lattice cell. The lattice indices
     wrap, so the bitmap tiles seamlessly. */
  function wrapRuis(n, blok, zaad) {
    var m = Math.max(1, Math.round(n / blok));
    var rooster = new Float32Array(m * m);
    for (var i = 0; i < rooster.length; i++) rooster[i] = ruisHash(zaad, blok, i);
    var uit = new Float32Array(n * n);
    for (var y = 0; y < n; y++) {
      var gy = y / blok, y0 = gy | 0, fy = zacht(gy - y0);
      var r0 = (y0 % m) * m, r1 = ((y0 + 1) % m) * m;
      for (var x = 0; x < n; x++) {
        var gx = x / blok, x0 = gx | 0, fx = zacht(gx - x0);
        var c0 = x0 % m, c1 = (x0 + 1) % m;
        var boven = rooster[r0 + c0] + (rooster[r0 + c1] - rooster[r0 + c0]) * fx;
        var onder = rooster[r1 + c0] + (rooster[r1 + c1] - rooster[r1 + c0]) * fx;
        uit[y * n + x] = boven + (onder - boven) * fy;
      }
    }
    return uit;
  }

  function bouwKorrel() {
    var doek = document.createElement('canvas');
    doek.width = doek.height = KORREL;
    var k = doek.getContext('2d');
    var beeld = k.createImageData(KORREL, KORREL), dat = beeld.data;
    var fijn = wrapRuis(KORREL, 2, 11);
    var grof = wrapRuis(KORREL, 9, 29);
    for (var i = 0; i < KORREL * KORREL; i++) {
      /* -1..1, zero meaning "leave this pixel alone". */
      var v = (fijn[i] - 0.5) * 1.05 + (grof[i] - 0.5) * 0.95;
      var o = i * 4;
      var licht = v > 0;
      dat[o] = dat[o + 1] = dat[o + 2] = licht ? 255 : 0;
      dat[o + 3] = Game.util.clamp(Math.round(Math.abs(v) * 168), 0, 255);
    }
    k.putImageData(beeld, 0, 0);
    korrelDoek = doek;
  }

  /* ---------------------------------------------------- terreinpatronen ---

     The grain above gives every surface tooth; this gives the ground a *grain
     direction*. One transparent 64px texture per terrain — blades for grass,
     furrow streaks for ploughed earth, mottle for a wood, chipped speckle for
     rock — laid over the tile's own colour.

     Two rules keep it affordable. It is filled straight into the diamond path
     that is already being traced, with no ctx.save()/clip()/restore() per tile:
     a pattern fills a path directly, and the clip trio is the one canvas call
     that genuinely hurts across thousands of tiles. And it is gated on zoom,
     because a blade of grass drawn onto an eight-pixel tile costs a fill and
     shows nothing.

     The patterns are anchored to the world and scaled with the zoom, set once a
     frame in stelPatronenIn — without that the texture swims over the ground
     while you pan, which is far worse than having no texture at all. If the
     browser has no CanvasPattern.setTransform we skip the whole thing rather
     than ship the swimming version. */
  var PATROON = 64;
  var patroonDoek = {};      /* "terrein|seizoen" -> canvas */
  var patroonBron = {};      /* "terrein|seizoen" -> CanvasPattern */
  var patroonKan = null;     /* does this browser support setTransform? */
  S.PATROON_ZOOM = 52;       /* pixels per tile below which it is not drawn */

  /* Honest note on what this costs, measured on presented frames in headless
     Chromium (software rendering — a pessimistic floor, as VISUEEL.md sets out):
     the fills cost is entirely a function of how many tiles are on screen — at
     p = 44 they added 81 ms to a 193 ms frame, at p = 88 only 35 ms, because
     there are a quarter as many tiles. Skipping CanvasPattern.setTransform
     changes nothing, so the cost is not the transform but the per-pixel texture
     sampling of the fill itself, which is precisely the work a GPU canvas does
     for free.

     Hence the threshold: 52 px per tile, above the 44 that a new game opens at.
     The grain carries the ground at playing distance; this comes on when the
     player leans in, which is both where it shows and where there are fewest
     tiles to pay for. It is the one knob if it ever needs to move. */

  function patroonVerf(k, seizoen) {
    var doek = document.createElement('canvas');
    doek.width = doek.height = PATROON;
    var c = doek.getContext('2d');
    var n = PATROON;
    var tel = 0;
    function r() { tel++; return ruisHash(9137, tel, seizoen * 31 + k.length); }

    if (k === 'gras' || k === 'bos') {
      /* Blades: short strokes leaning slightly, denser and darker for a wood. */
      var bos = k === 'bos';
      var aantal = bos ? 240 : 320;
      for (var i = 0; i < aantal; i++) {
        var x = r() * n, y = r() * n, h = 2 + r() * (bos ? 3 : 4);
        var licht = r() > 0.5;
        c.strokeStyle = licht ? 'rgba(255,255,255,.22)' : 'rgba(0,0,0,.22)';
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + (r() - 0.5) * 2, y - h);
        c.stroke();
      }
      if (bos) {
        for (var b = 0; b < 22; b++) {
          c.fillStyle = 'rgba(0,0,0,.15)';
          c.beginPath();
          c.ellipse(r() * n, r() * n, 3 + r() * 6, 2 + r() * 4, r() * 3, 0, Math.PI * 2);
          c.fill();
        }
      }
    } else if (k === 'vruchtbaar') {
      /* Furrow streaks: long, low, roughly along one axis, like turned earth. */
      for (var f = 0; f < 90; f++) {
        var fx = r() * n, fy = r() * n, len = 4 + r() * 12;
        c.strokeStyle = r() > 0.5 ? 'rgba(255,244,214,.2)' : 'rgba(40,24,10,.26)';
        c.lineWidth = 1 + r();
        c.beginPath();
        c.moveTo(fx, fy);
        c.lineTo(fx + len, fy + (r() - 0.5) * 2);
        c.stroke();
      }
    } else {
      /* Rock and mountain: angular chips and pits. */
      for (var s2 = 0; s2 < 120; s2++) {
        var sx = r() * n, sy = r() * n, sr = 1 + r() * 3;
        c.fillStyle = r() > 0.5 ? 'rgba(255,255,255,.22)' : 'rgba(0,0,0,.24)';
        c.beginPath();
        c.moveTo(sx, sy - sr);
        c.lineTo(sx + sr, sy);
        c.lineTo(sx, sy + sr * 0.8);
        c.lineTo(sx - sr * 0.9, sy);
        c.closePath();
        c.fill();
      }
    }
    return doek;
  }

  function terreinPatroon(ctx, terrein, seizoen) {
    if (patroonKan === false) return null;
    var sleutel = terrein + '|' + seizoen;
    if (patroonBron[sleutel] !== undefined) return patroonBron[sleutel];
    if (!patroonDoek[sleutel]) patroonDoek[sleutel] = patroonVerf(terrein, seizoen);
    var pat = ctx.createPattern(patroonDoek[sleutel], 'repeat');
    if (pat && typeof pat.setTransform !== 'function') { patroonKan = false; return null; }
    patroonKan = true;
    patroonBron[sleutel] = pat || null;
    return patroonBron[sleutel];
  }

  /* Anchor every built pattern to the world once a frame. */
  S.stelPatronenIn = function (ctx, cam, seizoen) {
    if (patroonKan === false || typeof DOMMatrix === 'undefined') { patroonKan = false; return; }
    var p = cam.px();
    if (p < S.PATROON_ZOOM) return;
    var oor = cam.wereldNaarScherm(0, 0);
    /* Anchored to the world so it never swims while panning, but only loosely
       scaled with the zoom: at full scale a 64px texture is stretched to 170px
       at maximum zoom and the blades drift so far apart that the whole thing
       measures as nothing (0.9 of a standard deviation on a grass field, against
       4.1 for the grain). A blade of grass should stay blade-sized. */
    var schaal = Game.util.clamp(cam.zoom, 0.9, 1.4);
    var m = new DOMMatrix([schaal, 0, 0, schaal, oor.x, oor.y]);
    for (var k in patroonBron) {
      if (patroonBron[k]) patroonBron[k].setTransform(m);
    }
    /* Build the ones this season needs, so the first frame after a season
       change is not the one that pays for four new textures. */
    if (seizoen === 3) return;
    var soorten = ['gras', 'vruchtbaar', 'bos', 'rots', 'berg'];
    for (var i = 0; i < soorten.length; i++) {
      var pat = terreinPatroon(ctx, soorten[i], seizoen);
      if (pat) pat.setTransform(m);
    }
  };

  S.tekenKorrel = function (ctx, cam) {
    if (!korrelDoek) bouwKorrel();
    if (!korrelPatroon) korrelPatroon = ctx.createPattern(korrelDoek, 'repeat');
    if (!korrelPatroon) return;
    var oor = cam.wereldNaarScherm(0, 0);
    var ox = ((oor.x % KORREL) + KORREL) % KORREL;
    var oy = ((oor.y % KORREL) + KORREL) % KORREL;
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.translate(ox, oy);
    ctx.fillStyle = korrelPatroon;
    ctx.fillRect(-ox, -oy, cam.breedte, cam.hoogte);
    ctx.restore();
  };

  /* ------------------------------------------------------- iso primitives */

  function lerp(a, b, t) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }
  function omhoog(pt, H) { return { x: pt.x, y: pt.y - H }; }

  function diamantVan(cx, cy, hw, hh) {
    return {
      top:    { x: cx,      y: cy - hh },
      right:  { x: cx + hw, y: cy },
      bottom: { x: cx,      y: cy + hh },
      left:   { x: cx - hw, y: cy },
      cx: cx, cy: cy, hw: hw, hh: hh
    };
  }

  function vulDiamant(ctx, d, kleur) {
    Game.render.padDiamant(ctx, d);
    ctx.fillStyle = kleur;
    ctx.fill();
  }

  function quad(ctx, a, b, c, d, kleur) {
    ctx.fillStyle = kleur;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y);
    ctx.closePath();
    ctx.fill();
  }

  function tri(ctx, a, b, c, kleur) {
    ctx.fillStyle = kleur;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y);
    ctx.closePath();
    ctx.fill();
  }

  /* -------------------------------------------------------------- terrein */

  /* Flat ground: the tile diamond plus everything that lies in the tile plane
     (coastline, water sparkle, field furrows). Raised features — trees, rocks,
     mountains, the deer — are drawn separately by tekenKenmerk so the renderer
     can depth-sort them against buildings and walkers. */
  S.tekenGrond = function (ctx, tegel, sx, sy, p, seizoen, tijd, kaart, x, y) {
    var d = Game.render.diamant(sx, sy, p);
    var idx = kaart ? y * kaart.b + x : 0;
    var schaduw = schaduwFactor(kaart, idx);
    var ruis = kaart ? ruisOp(kaart, idx, tegel) : tegel.v;
    var kleur;
    if (tegel.t === 'water') {
      /* Water takes its colour from how deep it is, not from the noise. */
      kleur = eindKleur(waterKleur(S.terreinKleur(tegel, seizoen), diepteDeel(kaart, idx)),
                        ruis, schaduw);
    } else {
      kleur = grondKleur(tegel.t, seizoen, ruis, schaduw);
    }
    vulDiamant(ctx, d, kleur);
    /* Hairline-seam guard: a 1px stroke in the same colour closes the sub-pixel
       cracks between neighbouring diamonds without changing the look. */
    Game.render.padDiamant(ctx, d);
    ctx.strokeStyle = kleur; ctx.lineWidth = 1; ctx.stroke();

    if (tegel.t === 'water' && kaart) {
      if (p >= 12) water(ctx, d, tegel, p, tijd, kaart, x, y, seizoen); else kust(ctx, d, kaart, x, y, tijd, p);
      if (seizoen === 3) ijs(ctx, d, tegel, p, kaart, x, y, ruis);
      return;
    }

    /* The terrain's own grain, straight into the diamond path — no clip, no
       save/restore. Never under a building: the footprint hides it. */
    /* Not under a building (the footprint hides it) and not in winter (the
       snow cover sits over it at 20–70% white, so every one of those fills
       would be paying for something nobody can see). */
    if (p >= S.PATROON_ZOOM && !tegel.b && seizoen !== 3) {
      var pat = terreinPatroon(ctx, tegel.t, seizoen);
      if (pat) {
        Game.render.padDiamant(ctx, d);
        ctx.fillStyle = pat;
        ctx.fill();
      }
    }

    /* Deep inside a wood, a dark canopy under the trees. A forest in Age of
       Empires is a mass you cannot see the ground through; here you could see
       grass between every trunk, which is what made a wood read as "tiles that
       happen to have trees on them". Only on tiles whose four neighbours are
       also forest (randen.masker === 0 means no edge borders another terrain),
       so the wood's edge keeps its individual trees — and since every interior
       tile is darkened by the same rule, the darkening itself shows no seams.
       The noise still modulates it, so the canopy is not a flat sheet. */
    if (tegel.t === 'bos' && kaart) bladerdek(ctx, d, kaart, idx, ruis, seizoen);

    /* Soft edges between terrains: the neighbour's colour bleeds a little way
       into this tile, so grass runs into forest and land runs into a beach
       instead of meeting along a hard diamond edge. */
    if (kaart && p >= 9) overgangen(ctx, d, tegel, kaart, seizoen, idx, ruis);

    /* Winter really lies on the land: a mottled snow cover whose depth comes
       from the noise field (so it drifts in patches instead of per tile), with
       a brighter drift on the light-facing half. */
    if (seizoen === 3) { sneeuwdek(ctx, d, tegel, p, ruis); return; }

    if (p >= 12 && tegel.t === 'vruchtbaar') akker(ctx, d, tegel, p, seizoen);

    /* Fine detail so a field of grass or rock is not one flat colour. Only when
       zoomed in and never under a building footprint (it would be hidden). */
    else if (p >= 24 && !tegel.b) {
      if (tegel.t === 'gras' && seizoen !== 3) grasplukjes(ctx, d, tegel, p, tijd, seizoen);
      else if (tegel.t === 'rots') grondspikkels(ctx, d, tegel, p);
    }
  };

  /* Deep water is darker and bluer than the shallows. `deel` is 0 at the
     shoreline and 1 out at sea. */
  function waterKleur(basis, deel) {
    var c = ontleed(basis);
    var diep = [22, 52, 84];
    var ondiep = [96, 176, 186];
    /* Shallow first (a turquoise lift right at the shore), then down into the
       dark. Two mixes rather than one keeps the beach from looking bleached. */
    var m = mix(mix(c, ondiep, Math.max(0, 0.5 - deel) * 0.7), diep, deel * 0.62);
    return 'rgb(' + m[0] + ',' + m[1] + ',' + m[2] + ')';
  }

  function mix(a, b, t) {
    t = Game.util.clamp(t, 0, 1);
    return [Math.round(a[0] + (b[0] - a[0]) * t),
            Math.round(a[1] + (b[1] - a[1]) * t),
            Math.round(a[2] + (b[2] - a[2]) * t)];
  }

  /* The colour of water at its deepest — what the sea beyond the map edge has
     to be painted in (js/render/sfeer.js). It runs through the very same
     waterKleur() the tiles do rather than being a second table: the moment the
     two differ by a shade, the map stops being an island and becomes a raft on
     a backdrop, which is exactly what the old flat ZEE fill looked like. */
  S.diepZeeKleur = function (seizoen) {
    return waterKleur(TERREIN.water[seizoen] || TERREIN.water[0], 1);
  };

  /* The dark floor of a closed wood — see the note at the call site. */
  var DEK = ['rgba(22,44,20,', 'rgba(18,40,17,', 'rgba(40,36,14,', 'rgba(30,40,44,'];

  function bladerdek(ctx, d, kaart, idx, ruis, seizoen) {
    var R = schaduwCache.randen;
    if (!R || schaduwCache.seed !== kaart.seed || R.masker[idx]) return;
    vulDiamant(ctx, d, (DEK[seizoen] || DEK[0]) + (0.30 + ruis * 0.22).toFixed(3) + ')');
  }

  /* Sand along a coast, per season — winter sand is pale and frozen. */
  var ZAND = ['#d5c290', '#dbc994', '#cfb87f', '#d9d5c8'];

  /* Two bands of the neighbour's colour along every edge this tile shares with
     a different terrain: close to the edge nearly opaque, further in faint.
     Two flat quads read as a gradient and cost a fraction of a real one. */
  function overgangen(ctx, d, tegel, kaart, seizoen, idx, ruis) {
    var R = schaduwCache.randen;
    if (!R || schaduwCache.seed !== kaart.seed) return;
    var masker = R.masker[idx];
    if (!masker) return;                       /* the common case: no border */

    var fijn = d.hw >= 15;
    for (var i = 0; i < BUUREDGE.length; i++) {
      if (!(masker & (1 << i))) continue;
      var e = BUUREDGE[i];
      var buurT = TERREINEN[R.buren[idx * 4 + i]];

      var kleur;
      if (buurT === 'water') kleur = ZAND[seizoen] || ZAND[0];
      else kleur = schakering(S.terreinKleur({ t: buurT }, seizoen), ruis);

      var a = d[e.a], b = d[e.b], c = { x: d.cx, y: d.cy };
      if (fijn) {
        /* Two nested bands with a scalloped inner boundary. Straight was the
           problem: a rock field met a meadow along a ruler-perfect diamond
           edge, and that reads as a map of coloured areas rather than as a
           landscape. The wave is a pure function of the tile index and the
           edge, so it is stable across frames, and the two bands share a phase
           so the deeper one nests inside the shallower one instead of crossing
           it. Nothing has to agree with the neighbouring tile: each tile paints
           its own side of the border. */
        var zaad = (idx * 7 + i * 13) % 1000;
        golfband(ctx, a, b, c, 0, 0.30, 0.14, kleur, 0.62, zaad);
        golfband(ctx, a, b, c, 0.30, 0.62, 0.20, kleur, 0.24, zaad);
      } else {
        /* Zoomed out there are several thousand tiles on screen, so one flat
           band per edge — at that size the softness is carried by the sheer
           number of edges anyway, and the scallop would be sub-pixel. */
        band(ctx, a, b, c, 0, 0.45, kleur, 0.5);
      }
    }
  }

  /* A quad along edge a→b, between fractions u0 and u1 of the way to centre c. */
  function band(ctx, a, b, c, u0, u1, kleur, alpha) {
    ctx.globalAlpha = alpha;
    quad(ctx, lerp(a, c, u0), lerp(b, c, u0), lerp(b, c, u1), lerp(a, c, u1), kleur);
    ctx.globalAlpha = 1;
  }

  /* Two sine waves of different periods, in [-1, 1]. Two rather than one so the
     boundary does not repeat visibly along an edge. */
  function golf(zaad, u) {
    return Math.sin(u * 6.9 + zaad) * 0.62 + Math.sin(u * 13.7 + zaad * 2.3) * 0.38;
  }

  /* Like band(), but the far boundary waves along its length: the strip runs
     from depth u0 (straight, on the shared edge side) to u1 ± amp. */
  var GOLFSTAPPEN = 5;

  function golfband(ctx, a, b, c, u0, u1, amp, kleur, alpha, zaad) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = kleur;
    ctx.beginPath();
    var p0 = lerp(a, c, u0), p1 = lerp(b, c, u0);
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    for (var k = GOLFSTAPPEN; k >= 0; k--) {
      var u = k / GOLFSTAPPEN;
      var diep = u1 + amp * golf(zaad, u);
      if (diep < u0) diep = u0;
      var px = a.x + (b.x - a.x) * u, py = a.y + (b.y - a.y) * u;
      ctx.lineTo(px + (c.x - px) * diep, py + (c.y - py) * diep);
    }
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  /* Snow cover on a land tile. Bare rock and mountains keep more of their own
     colour; fields and grass go nearly white. */
  /* Snow was the clearest proof that the game drew per tile: the cover took its
     depth from `t.v` (noise with a wavelength of one tile), and on top of that
     every single tile got a bright top-left triangle and a cool bottom-right
     one — a perfect diamond lattice stamped over the whole map. Both are gone.
     The depth comes from the coherent noise field, so snow lies in drifts tens
     of tiles across, and the light and shade are wavy-edged bands whose phase
     differs per tile, so they read as drift rather than as a grid. */
  function sneeuwdek(ctx, d, t, p, ruis) {
    var basis = (t.t === 'rots' || t.t === 'berg') ? 0.18 : (t.t === 'bos' ? 0.24 : 0.38);
    var alpha = basis + ruis * 0.34;
    vulDiamant(ctx, d, 'rgba(244,248,252,' + alpha.toFixed(3) + ')');

    /* The drift's lit and shaded faces are detail, and detail gets a zoom gate:
       two wavy polygons per tile across a whole snowed-in map measured at +68%
       of the frame when this ran from p = 14. From here up it is a couple of
       hundred tiles, not five thousand. */
    if (p >= 30 && !t.b) {
      var c = { x: d.cx, y: d.cy };
      var zaad = (t.v * 997) % 1000;
      /* The lit face of the drift, from the top-left edge inwards. */
      golfband(ctx, d.top, d.left, c, 0, 0.52 + ruis * 0.3, 0.26,
               'rgb(255,255,255)', 0.10 + ruis * 0.16, zaad);
      /* ...and the cool side away from the light, so a snowfield has form
         instead of being one white sheet. */
      golfband(ctx, d.right, d.bottom, c, 0, 0.46 + (1 - ruis) * 0.3, 0.24,
               'rgb(150,176,206)', 0.14, zaad + 3.1);
    }

    /* Stubble poking through a snowy field. */
    if (p >= 26 && t.t === 'vruchtbaar' && !t.b) {
      ctx.strokeStyle = 'rgba(150,132,86,.45)';
      ctx.lineWidth = Math.max(1, p * 0.016);
      for (var i = 0; i < 3; i++) {
        var bx = d.cx + (((i * 47 + t.v * 110) % 70) / 70 - 0.5) * d.hw;
        var by = d.cy + (((i * 31 + t.v * 60) % 50) / 50 - 0.5) * d.hh;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + p * 0.01, by - p * 0.05);
        ctx.stroke();
      }
    }
  }

  /* Ice on the water in winter: a pale sheen plus a couple of floes, and a
     frozen white rim wherever the water meets land. */
  function ijs(ctx, d, t, p, kaart, tx, ty, ruis) {
    /* The sheen follows the noise field, not the tile's own random: with a
       per-tile alpha a frozen bay came out as a chessboard of light and dark
       diamonds, which in the winter screenshot was the loudest grid on the
       map. Now the ice thickens and thins in patches. */
    vulDiamant(ctx, d, 'rgba(214,232,240,' + (0.16 + ruis * 0.36).toFixed(3) + ')');
    if (p < 14) return;

    for (var i = 0; i < 2; i++) {
      var fx = d.cx + (((i * 43 + t.v * 90) % 60) / 60 - 0.5) * d.hw * 0.9;
      var fy = d.cy + (((i * 67 + t.v * 40) % 50) / 50 - 0.5) * d.hh * 0.9;
      ctx.fillStyle = 'rgba(240,248,252,.55)';
      ctx.beginPath();
      ctx.ellipse(fx, fy, p * (0.09 + (t.v % 0.2) * 0.2), p * (0.05 + (t.v % 0.1) * 0.2), 0, 0, Math.PI * 2);
      ctx.fill();
    }

    /* Frozen rim where the ice meets the shore, with a scalloped inner edge
       like the surf it replaces for the winter. */
    var c = { x: d.cx, y: d.cy };
    for (var b = 0; b < BUUREDGE.length; b++) {
      var e = BUUREDGE[b];
      var buur = Game.core.map.tegel(kaart, tx + e.dx, ty + e.dy);
      if (!buur || buur.t === 'water') continue;
      golfband(ctx, d[e.a], d[e.b], c, 0, 0.2, 0.1, 'rgb(250,253,255)', 0.72,
               (tx * 7 + ty * 13 + b) % 1000);
    }
  }

  /* A few wind-bent grass blades, deterministic from the tile's `v` so they
     never flicker between frames. */
  function grasplukjes(ctx, d, t, p, tijd, seizoen) {
    ctx.strokeStyle = seizoen === 2 ? 'rgba(150,132,64,.45)' : 'rgba(96,132,60,.42)';
    ctx.lineWidth = Math.max(1, p * 0.018);
    ctx.lineCap = 'round';
    for (var i = 0; i < 4; i++) {
      var bx = d.cx + (((i * 53 + t.v * 130) % 80) / 80 - 0.5) * d.hw * 1.1;
      var by = d.cy + (((i * 29 + t.v * 90) % 60) / 60 - 0.5) * d.hh * 1.1;
      var sway = Math.sin(tijd * 1.5 + t.v * 6.28 + i) * p * 0.03;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx + sway * 0.5, by - p * 0.05, bx + sway, by - p * 0.09);
      ctx.stroke();
    }
  }

  /* Scattered pebbles on bare rock ground. */
  function grondspikkels(ctx, d, t, p) {
    ctx.fillStyle = 'rgba(74,72,66,.35)';
    for (var i = 0; i < 4; i++) {
      var bx = d.cx + (((i * 61 + t.v * 120) % 80) / 80 - 0.5) * d.hw * 0.9;
      var by = d.cy + (((i * 37 + t.v * 70) % 60) / 60 - 0.5) * d.hh * 0.9;
      ctx.beginPath();
      ctx.arc(bx, by, p * 0.016, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* Whether a tile carries a raised feature worth its own depth-sorted draw. */
  S.heeftKenmerk = function (tegel) {
    return tegel.t === 'bos' || tegel.t === 'rots' || tegel.t === 'berg' ||
           (tegel.t === 'gras' && tegel.n === 'wild' && tegel.amt > 0);
  };

  /* ------------------------------------------------- decor per exemplaar --

     Trees and boulders used to be drawn as "everything on this tile", from the
     tile's centre, with a jitter of ±0.23 of a tile sideways and ±0.06 forward.
     Six percent of forward spread is why they stood in *rows*: they were
     allowed to wander along the street but never off it, and a wood came out as
     a lattice of green cones.

     So decoration is now enumerated: a tile says how many things stand on it
     (S.aantalDelen) and where each one is (S.deelPositie, in tile fractions,
     now ±0.45 in both directions). The renderer pushes one entry per item into
     its depth-sorted layer, so an item that strays half a tile forward is
     sorted where it actually stands rather than where its tile is — without
     that, a tree that wandered towards the camera would be drawn behind the
     house it stands in front of.

     No allocation on the hot path: deelPositie fills a scratch object the
     caller owns, and the positions are a pure function of (tegel.v, i), so
     working them out twice a frame — once to sort, once to draw — is cheaper
     than building a list. */

  S.aantalDelen = function (tegel) {
    switch (tegel.t) {
      case 'bos': return boomAantal(tegel);
      case 'rots': return 1 + Math.floor(((tegel.v * 5.7) % 1) * 3);
      default: return 1;      /* a mountain, a herd of deer: one thing, centred */
    }
  };

  S.deelPositie = function (tegel, i, uit) {
    uit = uit || { dx: 0, dy: 0 };
    if (tegel.t === 'bos' || tegel.t === 'rots') {
      var h1 = ((i * 37 + tegel.v * 613) % 91) / 91;
      var h2 = ((i * 61 + tegel.v * 419) % 89) / 89;
      uit.dx = (h1 - 0.5) * 0.9;
      uit.dy = (h2 - 0.5) * 0.9;
    } else if (tegel.t === 'berg') {
      /* A range wants less wander than a wood — a peak that strays half a tile
         floats off its own mountain — but enough that the summits do not sit
         on a lattice. */
      uit.dx = (((tegel.v * 733) % 1) - 0.5) * 0.44;
      uit.dy = (((tegel.v * 947) % 1) - 0.5) * 0.44;
    } else {
      uit.dx = 0; uit.dy = 0;
    }
    return uit;
  };

  var deelPos = { dx: 0, dy: 0 };

  /* Draws item `i` of a tile. (sx, sy) is still the tile's projected top
     corner; the offset is applied here, in screen space, through the same iso
     transform the tile diamond uses (a tile step of +1 in world x moves the
     screen point by (+hw, +hh); +1 in world y by (-hw, +hh)). */
  S.tekenDeel = function (ctx, tegel, sx, sy, p, seizoen, tijd, i) {
    if (p < 12) return;
    tijd = tijd || 0;
    var d = Game.render.diamant(sx, sy, p);
    S.deelPositie(tegel, i, deelPos);
    if (deelPos.dx || deelPos.dy) {
      d = diamantVan(d.cx + (deelPos.dx - deelPos.dy) * d.hw,
                     d.cy + (deelPos.dx + deelPos.dy) * d.hh, d.hw, d.hh);
    }
    switch (tegel.t) {
      case 'bos': boom(ctx, d, tegel, p, seizoen, tijd, i); break;
      case 'rots': rots(ctx, d, tegel, p, i); break;
      case 'berg':
        berg(ctx, d, tegel, p, seizoen);
        if (tegel.n && ADERKLEUR[tegel.n]) ader(ctx, d, tegel, p);
        break;
      case 'gras': if (tegel.n === 'wild') wild(ctx, d, tegel, p, tijd); break;
    }
  };

  /* Everything on a tile at once. Kept for callers that do not depth-sort. */
  S.tekenKenmerk = function (ctx, tegel, sx, sy, p, seizoen, tijd) {
    var n = S.aantalDelen(tegel);
    for (var i = 0; i < n; i++) S.tekenDeel(ctx, tegel, sx, sy, p, seizoen, tijd, i);
  };

  /* Which diamond edge a tile shares with each 4-neighbour. */
  var BUUREDGE = [
    { dx: -1, dy: 0, a: 'top',   b: 'left'   },  /* west  */
    { dx: 0, dy: -1, a: 'top',   b: 'right'  },  /* north */
    { dx: 1, dy: 0,  a: 'right', b: 'bottom' },  /* east  */
    { dx: 0, dy: 1,  a: 'left',  b: 'bottom' }   /* south */
  ];

  /* Lighter shallow rim on the water-tile edges that face land, breathing in
     and out like a slow surf. */
  /* Surf. Where a water tile touches land, a band of foam runs in from the
     shared edge — and its inner boundary scallops along its length and breathes
     with the swell, because a coastline drawn as a straight stroke along a
     diamond edge is the clearest possible statement that the world is made of
     tiles. Zoomed far out it falls back to that stroke: at eight pixels a tile
     the scallop is sub-pixel and only costs fills. */
  function kust(ctx, d, kaart, tx, ty, tijd, p) {
    var t = tijd || 0;
    var puls = 0.5 + 0.5 * Math.sin(t * 1.3 + (tx + ty) * 0.6);

    if (!(p >= 16)) {
      ctx.strokeStyle = 'rgba(196,230,236,' + (0.4 + puls * 0.28).toFixed(3) + ')';
      ctx.lineWidth = Math.max(1, d.hw * (0.11 + puls * 0.06));
      ctx.beginPath();
      for (var i = 0; i < BUUREDGE.length; i++) {
        var b0 = Game.core.map.tegel(kaart, tx + BUUREDGE[i].dx, ty + BUUREDGE[i].dy);
        if (!b0 || b0.t === 'water') continue;
        var a0 = d[BUUREDGE[i].a], c0 = d[BUUREDGE[i].b];
        ctx.moveTo(a0.x, a0.y); ctx.lineTo(c0.x, c0.y);
      }
      ctx.stroke();
      return;
    }

    for (var j = 0; j < BUUREDGE.length; j++) {
      var buur = Game.core.map.tegel(kaart, tx + BUUREDGE[j].dx, ty + BUUREDGE[j].dy);
      if (!buur || buur.t === 'water') continue;
      var a = d[BUUREDGE[j].a], b = d[BUUREDGE[j].b];
      var swell = 0.5 + 0.5 * Math.sin(t * 1.5 + (tx * 1.7 + ty * 2.3) + j);

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      for (var k = 5; k >= 0; k--) {
        var u = k / 5;
        var diep = 0.13 + swell * 0.09 +
                   0.06 * Math.sin(t * 2.1 + u * 7.5 + tx * 3.1 + ty * 5.3);
        var px = a.x + (b.x - a.x) * u, py = a.y + (b.y - a.y) * u;
        ctx.lineTo(px + (d.cx - px) * diep, py + (d.cy - py) * diep);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(224,244,248,' + (0.22 + swell * 0.18).toFixed(3) + ')';
      ctx.fill();

      /* And a crisp line right on the waterline itself. */
      ctx.strokeStyle = 'rgba(244,253,255,' + (0.3 + swell * 0.24).toFixed(3) + ')';
      ctx.lineWidth = Math.max(1, d.hw * 0.05);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  function water(ctx, d, t, p, tijd, kaart, tx, ty, seizoen) {
    if (kaart) kust(ctx, d, kaart, tx, ty, tijd, p);

    /* Reflection of the shore: on water tiles that touch land, smear the
       neighbour's colour (its trees, its buildings) a little way into the tile,
       vertically flipped and wavering. Only for shoreline tiles — randen /
       BUUREDGE already tell us which edges face land (fase 3.1). */
    if (p >= 16 && kaart) spiegeling(ctx, d, p, tijd, kaart, tx, ty, seizoen);

    /* Ripples. Water without light and shade in it is a blue field with
       stripes on it; what makes a swell read as a swell is that a crest is
       lighter than the water and the trough right under it is darker. So the
       same three ripples are drawn twice — a bright crest and, a hair below it,
       its own shadow — and they ride two beat frequencies rather than one, so
       the pattern never settles into a rhythm. Two strokes for the tile, not
       six: the loop builds both paths and each is stroked once. */
    var kruinen = [], dalen = [];
    for (var i = 0; i < 3; i++) {
      var ph = tijd * (1.0 + i * 0.33) + t.v * 9 + i * 2.1;
      var ph2 = tijd * (0.41 + i * 0.17) + t.v * 5.5;
      /* Offsets keyed to the tile's own random, so the ripples do not line up
         into rows that give the grid away. */
      var yy = d.cy + ((t.v * 3.3 + i) % 1 - 0.5) * d.hh * 1.1
             + Math.sin(ph) * p * 0.04 + Math.sin(ph2) * p * 0.02;
      var xx = d.cx + ((t.v * 7.9 + i * 0.4) % 1 - 0.5) * d.hw * 0.5
             + Math.cos(ph) * p * 0.05;
      var len = p * (0.08 + ((t.v * 11 + i) % 1) * 0.08) * (0.7 + 0.3 * Math.sin(ph2));
      kruinen.push([xx - len, yy, xx + len, yy]);
      dalen.push([xx - len * 0.9, yy + p * 0.022, xx + len * 0.9, yy + p * 0.022]);
    }

    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, p * 0.026);
    ctx.strokeStyle = 'rgba(10,26,44,.16)';
    ctx.beginPath();
    for (var q = 0; q < dalen.length; q++) {
      ctx.moveTo(dalen[q][0], dalen[q][1]); ctx.lineTo(dalen[q][2], dalen[q][3]);
    }
    ctx.stroke();

    ctx.strokeStyle = 'rgba(232,248,254,.15)';
    ctx.beginPath();
    for (var w = 0; w < kruinen.length; w++) {
      ctx.moveTo(kruinen[w][0], kruinen[w][1]); ctx.lineTo(kruinen[w][2], kruinen[w][3]);
    }
    ctx.stroke();

    /* A sun glint that brightens by day and glides across the tile. */
    var dag = (Game.core.state && Game.core.state.DAG) || 1;
    var f = (tijd % dag) / dag;
    var licht = Game.util.clamp(0.5 - 0.5 * Math.cos(f * Math.PI * 2), 0, 1);   /* 1 at midday */
    /* Bright and warm by day; a faint, cold moon-glitter never fully off at
       night, so the sea is never dead. */
    var a = (0.04 + licht * (0.45 + 0.55 * Math.abs(Math.sin(tijd * 3 + t.v * 20))) * 0.34);
    var koud = 1 - licht;
    a = Math.max(a, koud * 0.10 * (0.4 + 0.6 * Math.abs(Math.sin(tijd * 2.4 + t.v * 20))));
    if (a > 0.05) {
      var kleur = licht > 0.4 ? '255,248,222' : '196,214,240';   /* sun → moon */
      ctx.fillStyle = 'rgba(' + kleur + ',' + a.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(d.cx + Math.sin(tijd * 0.7 + t.v * 12) * p * 0.13, d.cy - p * 0.02, p * 0.028, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* Shore reflection: for each edge of this water tile that faces land, smear a
     wavering vertical band of the neighbour's colour into the water, ~25%
     opaque. A building on the shore reflects its roof; trees and grass reflect
     their green. Cheap: two soft strokes per land edge, and shoreline tiles are
     a small fraction of the map. */
  function spiegeling(ctx, d, p, tijd, kaart, tx, ty, seizoen) {
    seizoen = seizoen || 0;
    for (var i = 0; i < BUUREDGE.length; i++) {
      var e = BUUREDGE[i];
      var buur = Game.core.map.tegel(kaart, tx + e.dx, ty + e.dy);
      if (!buur || buur.t === 'water') continue;

      var kleur;
      if (buur.b != null) kleur = '#8a5a3a';                       /* a roof on the shore */
      else if (buur.t === 'bos') kleur = '#2f5226';
      else kleur = S.terreinKleur({ t: buur.t }, seizoen);

      /* Midpoint of the shared edge, and the two edge corners. */
      var a = d[e.a], b = d[e.b];
      var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      var wob = Math.sin(tijd * 2 + (tx + ty) * 0.7) * p * 0.03;
      ctx.strokeStyle = kleur;
      ctx.globalAlpha = 0.22;
      ctx.lineWidth = Math.max(1.5, p * 0.09);
      ctx.lineCap = 'round';
      ctx.beginPath();
      /* Down into the tile (screen-down) from the edge midpoint, wavering. */
      ctx.moveTo(mx + wob * 0.4, my);
      ctx.quadraticCurveTo(mx + wob, my + p * 0.1, d.cx + wob, d.cy + p * 0.04);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  /* The shadow an upright thing throws on the ground: an ellipse stretched and
     leaned along the one light direction the whole scene shares, so a wood, a
     boulder field and a street of houses all agree on where the sun is. */
  var SCHADUWHOEK = Math.atan2(0.30, 0.62);

  /* Ground shadows are drawn one at a time, and that is a measured choice.
   *
     Collecting a screen full of tree and boulder shadows into a single path and
     filling it once looks like the obvious win — one fill instead of thousands,
     and overlapping shadows would stop compounding into a stain. Both were
     built. Two things came out of measuring it on presented frames:

       - ctx.ellipse continues the current subpath, so without a moveTo in front
         of every one of them the whole screen became one self-intersecting
         polygon. Filling that cost five times the rest of the frame together.
       - Even with that fixed, one path of a few thousand disjoint ovals was
         *slower* than a few thousand small fills (310 ms against 215 ms zoomed
         out). A small fill only ever touches its own bounding box; one enormous
         path makes the rasteriser build and scan a global edge list.

     So: separate fills, and overlapping shadows do compound a little. What was
     kept from the experiment is the pass itself — every feature shadow goes
     down before any feature body, so a shadow can never land on top of the
     trunk of a tree that was drawn earlier. */

  /* What colour a shadow is right now. It was a fixed near-black at 20%, which
     on a screenshot barely existed — in Age of Empires the shadow under a
     building is the darkest thing on screen, and that is exactly where its
     relief comes from. Now it deepens, and it takes its hue from the light:
     cool and short under a midday sun, warmer and softer at dawn and dusk. The
     *direction* still never moves (see the header of js/render/sfeer.js): the
     hillshade is baked lit from the top-left and a wandering shadow would
     fight it. */
  S.schaduwKleur = function (licht, alpha) {
    if (!licht) return 'rgba(24,20,14,' + alpha.toFixed(3) + ')';
    var warm = licht.avond * 0.8 + licht.ochtend * 0.5;
    var r = Math.round(20 + warm * 26);
    var g = Math.round(18 + warm * 8);
    var b = Math.round(30 - warm * 10);
    /* At night the wash over everything is already doing the darkening. */
    var a = alpha * (1 - licht.nacht * 0.55);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a.toFixed(3) + ')';
  };

  /* How much longer a shadow is at a low sun. */
  S.schaduwRek = function (licht) {
    if (!licht) return 1;
    return 1 + (licht.avond + licht.ochtend) * 0.85;
  };

  function grondschaduw(ctx, x, y, straal, hoogte, alpha) {
    var richting = (Game.render.sfeer && Game.render.sfeer.SCHADUW) || { x: 0.62, y: 0.30 };
    var ox = hoogte * richting.x, oy = hoogte * richting.y;
    var lengte = Math.sqrt(ox * ox + oy * oy) * 0.5 + straal;
    /* ellipse() takes its own rotation, so this needs no save/translate/rotate
       /restore — which matters, because a forest draws three of these per tile. */
    ctx.fillStyle = S.schaduwKleur(huidigLicht, alpha);
    ctx.beginPath();
    ctx.ellipse(x + ox * 0.5, y + oy * 0.5, lengte, straal * 0.55, SCHADUWHOEK, 0, Math.PI * 2);
    ctx.fill();
  }

  /* Only the ground shadow of item `i` on a tile, for the batched pass. */
  S.deelSchaduw = function (ctx, tegel, sx, sy, p, i) {
    if (p < 12) return;
    var d = Game.render.diamant(sx, sy, p);
    S.deelPositie(tegel, i, deelPos);
    var cx = d.cx + (deelPos.dx - deelPos.dy) * d.hw;
    var cy = d.cy + (deelPos.dx + deelPos.dy) * d.hh;
    var rek = S.schaduwRek(Game.render.sfeer && Game.render.sfeer.licht ? huidigLicht : null);
    if (tegel.t === 'bos') {
      var deel = tegel.max > 0 ? Game.util.clamp(tegel.amt / tegel.max, 0, 1) : 0;
      var maat = 0.76 + (((i * 53 + tegel.v * 271) % 67) / 67) * 0.56;
      grondschaduw(ctx, cx, cy + p * 0.03, p * 0.11 * maat, p * (0.6 + deel * 0.24) * maat * 0.9 * rek, 0.2);
    } else if (tegel.t === 'rots') {
      var rm = 0.7 + (((i * 29 + tegel.v * 331) % 71) / 71) * 0.7;
      grondschaduw(ctx, cx, cy + p * 0.05, p * 0.1 * rm, p * 0.14 * rm * rek, 0.18);
    } else if (tegel.t === 'berg') {
      var r1 = (tegel.v * 7.31) % 1;
      grondschaduw(ctx, cx, cy + d.hh * 0.2, d.hw * 0.8, p * (0.55 + r1 * 1.25) * 0.5 * rek, 0.2);
    }
  };

  /* The light as of this frame, handed in by the renderer so the shadow helpers
     do not each recompute it. */
  var huidigLicht = null;
  S.zetLicht = function (l) { huidigLicht = l; };

  /* An upright billboard (sprite or richer fallback tree) at a point, bent by
     the wind: each tree is rotated a few degrees around its foot so the canopy
     sways while the trunk base stays planted. Sway is a slow sine keyed to the
     tile's stable `v` (and the tree index) so a wood ripples rather than moving
     as one block. */
  /* How many trees stand on a forest tile. A denser tile carries more, so a
     wood thins out as it is felled instead of every tile losing height at the
     same rate. */
  function boomAantal(t) {
    var deel = t.max > 0 ? Game.util.clamp(t.amt / t.max, 0, 1) : 0;
    return Math.max(1, Math.round(1 + deel * 2));
  }

  /* One tree, at the offset the caller has already applied to `d`. */
  function boom(ctx, d, t, p, seizoen, tijd, i) {
    var deel = t.max > 0 ? Game.util.clamp(t.amt / t.max, 0, 1) : 0;
    var atlas = Game.render.atlas;
    var ox = d.cx, oy = d.cy;
    /* Size varies per tree, not just per tile: a stand of identical cones is
       the other half of why a wood used to read as wallpaper. */
    var maat = 0.76 + (((i * 53 + t.v * 271) % 67) / 67) * 0.56;
    var wind = Math.sin(tijd * 0.9 + t.v * 6.28 + i * 1.3) * 0.05;   /* ~3° */
    var hoog = p * (0.6 + deel * 0.24) * maat;

    ctx.save();
    ctx.translate(ox, oy);
    ctx.rotate(wind);

    var img = atlas && atlas.boom(t.v, i);
    if (img) {
      ctx.drawImage(img, -hoog / 2, -hoog * 0.82, hoog, hoog);
    } else {
      boomVorm(ctx, p * maat, deel, seizoen, t.v + i);
    }

    /* A dusting of snow on the crown — the atlas trees are summer trees, so
       winter has to be painted on top of them as well as on the fallback.
       One soft cap, not stripes: it should read as snow, not as bunting. */
    if (seizoen === 3) {
      ctx.fillStyle = 'rgba(248,252,255,.72)';
      ctx.beginPath();
      ctx.ellipse(0, -hoog * 0.62, p * 0.075 * maat, p * 0.03 * maat, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(248,252,255,.34)';
      ctx.beginPath();
      ctx.ellipse(-p * 0.02, -hoog * 0.34, p * 0.1 * maat, p * 0.035 * maat, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    /* A felled stump on a nearly bare tile, once, on the first tree. */
    if (deel < 0.25 && i === 0) {
      ctx.fillStyle = 'rgba(70,50,30,.5)';
      ctx.beginPath();
      ctx.arc(ox + p * 0.2, oy + p * 0.16, p * 0.06, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* Hand-drawn fallback tree (used when the atlas sprite has not loaded): a
     trunk and two-to-three layered canopy tufts instead of a flat triangle, so
     it holds up when the assets are missing. Drawn around a local origin at the
     foot; the caller has already applied the wind rotation. */
  function boomVorm(ctx, p, deel, seizoen, seed) {
    var bladKleur = ['#3a6b2f', '#356428', '#8a5f1e', '#51624e'][seizoen];
    var donker = verf(bladKleur, 0.78);
    var r = p * (0.15 + deel * 0.08);

    ctx.fillStyle = '#4a3320';
    ctx.fillRect(-p * 0.028, -p * 0.16, p * 0.056, p * 0.18);

    var lagen = [
      { y: -p * 0.16, rr: r,        k: donker },
      { y: -p * 0.30, rr: r * 0.82, k: bladKleur },
      { y: -p * 0.42, rr: r * 0.6,  k: verf(bladKleur, 1.12) }
    ];
    for (var i = 0; i < lagen.length; i++) {
      var L = lagen[i];
      ctx.fillStyle = L.k;
      ctx.beginPath();
      ctx.ellipse((((seed * 40 + i * 17) % 6) / 6 - 0.5) * p * 0.05, L.y, L.rr, L.rr * 0.92, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* One boulder, at the offset the caller has already applied to `d`. */
  function rots(ctx, d, t, p, i) {
    var atlas = Game.render.atlas;
    var ox = d.cx, oy = d.cy;
    var maat = 0.7 + (((i * 29 + t.v * 331) % 71) / 71) * 0.7;

    var img = atlas && atlas.rots(t.v, i);
    if (img) {
      var rs = p * 0.38 * maat;
      ctx.drawImage(img, ox - rs / 2, oy - rs * 0.62, rs, rs);
      return;
    }

    var r = p * 0.12 * maat;
    /* Two-tone boulder (shadow body + lit top facet) rather than a flat
       pentagon, so it reads as a rock when the atlas sprite is missing. */
    ctx.fillStyle = '#7f7b72';
    ctx.beginPath();
    ctx.moveTo(ox - r, oy + r * 0.5);
    ctx.lineTo(ox - r * 0.4, oy - r);
    ctx.lineTo(ox + r * 0.6, oy - r * 0.8);
    ctx.lineTo(ox + r, oy + r * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#b3afa4';
    ctx.beginPath();
    ctx.moveTo(ox - r * 0.4, oy - r);
    ctx.lineTo(ox + r * 0.6, oy - r * 0.8);
    ctx.lineTo(ox + r * 0.15, oy + r * 0.1);
    ctx.closePath();
    ctx.fill();
  }

  /* An iso mountain: a shaded pyramid rising out of the tile diamond. Height
     varies with the tile's stable random `v`, and only the taller peaks (or any
     peak in winter) wear a snow cap, so a range reads as a mix rather than a
     field of identical spikes. */
  function berg(ctx, d, t, p, seizoen) {
    /* Two stable pseudo-randoms per tile so neighbouring peaks differ in both
       height and lean; a field of identical spikes was the giveaway that this
       was one repeated shape. */
    var r1 = (t.v * 7.31) % 1;
    var r2 = (t.v * 13.77) % 1;

    var H = p * (0.55 + r1 * 1.25);
    var lean = (r2 - 0.5) * p * 0.34;
    var apex = { x: d.cx + lean, y: d.cy - H };

    /* A lower shoulder peak against the main one turns a lone cone into a
       ridge, especially where several mountain tiles meet. */
    if (r2 > 0.3) {
      var kant = r1 > 0.5 ? 1 : -1;
      var sub = { x: d.cx + kant * d.hw * 0.5, y: d.cy - H * (0.4 + r2 * 0.3) };
      tri(ctx, d.left, d.bottom, sub, '#4e4941');
      tri(ctx, d.bottom, d.right, sub, '#63594c');
    }

    /* Two front flanks (near, bottom corner splits them) then the two back
       flanks a touch darker for silhouette against neighbours. */
    tri(ctx, d.left, d.bottom, apex, '#5e574d');
    tri(ctx, d.bottom, d.right, apex, '#7d7365');
    tri(ctx, d.top, d.left, apex, '#484238');
    tri(ctx, d.top, d.right, apex, '#665e52');

    /* A lit crest down the near ridge, so the two front faces meet in an edge
       instead of a colour change. */
    ctx.strokeStyle = 'rgba(178,168,150,.55)';
    ctx.lineWidth = Math.max(1, p * 0.02);
    ctx.beginPath();
    ctx.moveTo(apex.x, apex.y);
    ctx.lineTo(d.bottom.x, d.bottom.y);
    ctx.stroke();

    /* Snow lies on what is high, not on what is random: only real peaks keep a
       cap all year, the rest wait for winter. The snow line is broken rather
       than a clean lerp — a straight white triangle is what made these read as
       paper cones. */
    var hoogte = (H / p - 0.55) / 1.25;
    var sneeuw = (seizoen === 3 ? 0.26 : 0) + (hoogte > 0.62 ? (hoogte - 0.62) * 1.3 : 0);
    if (sneeuw < 0.1) return;
    sneeuw = Math.min(0.62, sneeuw);
    sneeuwkap(ctx, apex, d.left, d.bottom, sneeuw, r1, '#dbe3e8');
    sneeuwkap(ctx, apex, d.bottom, d.right, sneeuw, r2, '#eff4f7');
  }

  /* One snowy face: a wedge from the apex down to a ragged snow line between
     the two given corners. */
  function sneeuwkap(ctx, apex, a, b, deel, seed, kleur) {
    ctx.fillStyle = kleur;
    ctx.beginPath();
    ctx.moveTo(apex.x, apex.y);
    for (var i = 0; i <= 4; i++) {
      var u = i / 4;
      var kant = lerp(a, b, u);
      var rafel = deel * (0.72 + ((i * 37 + seed * 90) % 55) / 100);
      var pt = lerp(apex, kant, rafel);
      ctx.lineTo(pt.x, pt.y);
    }
    ctx.closePath();
    ctx.fill();
  }

  function ader(ctx, d, t, p) {
    var leeg = t.max > 0 ? Game.util.clamp(t.amt / t.max, 0, 1) : 0;
    if (leeg <= 0.02) return;
    ctx.fillStyle = ADERKLEUR[t.n];
    ctx.globalAlpha = 0.5 + leeg * 0.5;
    for (var i = 0; i < 3; i++) {
      var ox = d.cx + p * (((i * 29 + t.v * 80) % 30) / 100 - 0.15);
      var oy = d.cy + p * (((i * 53 + t.v * 50) % 24) / 100 - 0.04);
      ctx.beginPath();
      ctx.arc(ox, oy, p * 0.05, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* A field through the year: young green shoots in spring, tall golden grain in
     summer, harvested stubble with a couple of sheaves in autumn (winter is
     handled by the snow cover, which returns before this). The furrows are the
     same rows every season; what grows on them is the season made visible
     (fase 4.1). */
  function akker(ctx, d, t, p, seizoen) {
    if (seizoen === 3) return;

    /* The bare furrows first, as ridges of turned earth. */
    ctx.strokeStyle = 'rgba(120,92,58,.5)';
    ctx.lineWidth = Math.max(1, p * 0.04);
    ctx.beginPath();
    for (var i = 1; i < 4; i++) {
      var f = i / 4;
      var a = lerp(d.top, d.left, f), b = lerp(d.right, d.bottom, f);
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();

    if (p < 20) return;   /* the crop grain only at closer zoom */

    if (seizoen === 0) {
      /* Spring: short green shoots standing up out of the furrows. */
      ctx.strokeStyle = 'rgba(120,170,70,.75)';
      ctx.lineWidth = Math.max(1, p * 0.02);
      gewasHalmen(ctx, d, p, 0.05, 0);
    } else if (seizoen === 1) {
      /* Summer: tall golden grain, heavy-headed. */
      ctx.strokeStyle = 'rgba(214,182,70,.85)';
      ctx.lineWidth = Math.max(1, p * 0.022);
      gewasHalmen(ctx, d, p, 0.12, 0.02);
    } else {
      /* Autumn: cut stubble and a couple of sheaves. */
      ctx.strokeStyle = 'rgba(196,168,96,.6)';
      ctx.lineWidth = Math.max(1, p * 0.018);
      gewasHalmen(ctx, d, p, 0.03, 0);
      schoof(ctx, d.cx - p * 0.12, d.cy + p * 0.02, p, t.v);
      schoof(ctx, d.cx + p * 0.14, d.cy - p * 0.04, p, t.v * 1.7 % 1);
    }
  }

  /* Rows of little upright strokes standing on the furrows: the crop. `h` is
     stalk height, `buig` a lean for a heavy head. Deterministic offsets so a
     field does not shimmer between frames. */
  function gewasHalmen(ctx, d, p, h, buig) {
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (var r = 1; r < 4; r++) {
      var f = r / 4;
      var a = lerp(d.top, d.left, f), b = lerp(d.right, d.bottom, f);
      for (var k = 1; k < 6; k++) {
        var u = k / 6;
        var base = lerp(a, b, u);
        ctx.moveTo(base.x, base.y);
        ctx.lineTo(base.x + buig * p, base.y - h * p);
      }
    }
    ctx.stroke();
  }

  /* A tied sheaf of grain standing in a harvested field. */
  function schoof(ctx, x, y, p, seed) {
    ctx.strokeStyle = 'rgba(206,176,96,.9)';
    ctx.lineWidth = Math.max(1, p * 0.02);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (var i = 0; i < 4; i++) {
      var lean = (i - 1.5) * 0.03 * p;
      ctx.moveTo(x, y);
      ctx.lineTo(x + lean, y - p * 0.13);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(150,116,40,.8)';
    ctx.beginPath();
    ctx.moveTo(x - p * 0.03, y - p * 0.06);
    ctx.lineTo(x + p * 0.03, y - p * 0.06);
    ctx.stroke();
  }

  /* A deer that grazes and drifts within its tile instead of standing frozen.
     Position is a slow function of time (+ the tile's stable `v`), so it needs
     no per-animal state and survives the pure-JSON rule. It faces the way it
     is drifting and dips its head now and then. */
  function wild(ctx, d, t, p, tijd) {
    if (t.amt <= 0) return;
    var fx = Math.sin(tijd * 0.35 + t.v * 6.28);
    var fy = Math.cos(tijd * 0.27 + t.v * 4.0);
    var ox = d.cx + fx * p * 0.2;
    var oy = d.cy - p * 0.14 + fy * p * 0.08;
    var kijk = Math.cos(tijd * 0.35 + t.v * 6.28) >= 0 ? 1 : -1;   /* d/dt of fx */
    var graas = Math.max(0, Math.sin(tijd * 0.9 + t.v * 3)) * p * 0.03;

    ctx.fillStyle = 'rgba(0,0,0,.16)';
    ctx.beginPath();
    ctx.ellipse(ox, oy + p * 0.16, p * 0.11, p * 0.045, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(ox, oy + graas);
    ctx.scale(kijk, 1);
    ctx.font = Math.round(p * 0.46) + 'px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🦌', 0, 0);
    ctx.restore();
  }

  /* -------------------------------------------------------------- gebouwen */

  /* Per-age palette for the tiered houses/halls, so a village visibly matures:
     daub → timber → stone → half-timber, thatch → tile. */
  /* Wall and roof per housing tier. Wall and roof used to sit about thirty
     lightness points apart; they are nearer forty-five now. A building has to
     be lighter than the ground it stands on — that separation is most of what
     pulls a town forward out of a green field, and it is why an Age of Empires
     village reads at a glance from any distance. */
  var TIER_PALET = {
    1: { muur: '#e0cba2', dak: '#77401f' },
    2: { muur: '#d5bf8e', dak: '#8a4f26' },
    3: { muur: '#d2cec2', dak: '#5f574d' },
    4: { muur: '#efe6ca', dak: '#743225' }
  };
  var TIER_SHAPES = { dorpsplein: 1, huisje: 1, herenhuis: 1, herberg: 1, marktplaats: 1 };

  /* Per-building iso shape: wall height & roof style/height (as fractions of a
     tile), plus optional flourishes and colours. Anything not listed uses the
     house default. `stijl`: schuin (hip roof) | punt (steep spire) |
     plat (flat top) | geen (open top). */
  var ISO = {
    _default:    { muurH: 0.55, stijl: 'schuin', dakH: 0.46, muur: '#d8c5a1', dak: '#6f3d21' },

    dorpsplein:  { muurH: 0.42, stijl: 'schuin', dakH: 0.4, vlag: true },
    huisje:      { muurH: 0.52, stijl: 'schuin', dakH: 0.48 },
    herenhuis:   { muurH: 0.64, stijl: 'schuin', dakH: 0.48 },
    boerderij:   { muurH: 0.4,  stijl: 'schuin', dakH: 0.34, muur: '#dcc99b', dak: '#7d4b25' },
    herberg:     { muurH: 0.52, stijl: 'schuin', dakH: 0.5, uithang: true },

    stadhuis:    { muurH: 0.72, stijl: 'schuin', dakH: 0.55, muur: '#d8cba6', dak: '#7a5236', vlag: true },
    handelshuis: { muurH: 0.66, stijl: 'schuin', dakH: 0.5, muur: '#d3c39c', dak: '#7a5236', vlag: true },
    universiteit:{ muurH: 0.72, stijl: 'schuin', dakH: 0.52, muur: '#d8cba6', dak: '#5f5852', vlag: true },
    gildehuis:   { muurH: 0.64, stijl: 'schuin', dakH: 0.5, muur: '#d3c39c', dak: '#6a5240' },

    marktplaats: { muurH: 0.3,  stijl: 'plat',   dakH: 0.12, muur: '#c7b083', dak: '#9c6a3a', luifel: true },
    voorraadschuur:{ muurH: 0.42, stijl: 'schuin', dakH: 0.44, muur: '#c8a877', dak: '#603c1e' },
    pakhuis:     { muurH: 0.5,  stijl: 'schuin', dakH: 0.46, muur: '#b99a6a', dak: '#5f4530' },
    waterput:    { muurH: 0.3,  stijl: 'schuin', dakH: 0.4,  smal: 0.5, muur: '#a9a094', dak: '#6a4a30' },

    kapel:       { muurH: 0.62, stijl: 'punt',   dakH: 0.95, muur: '#e2dac4', dak: '#6a6258', kruis: true },
    kerk:        { muurH: 0.74, stijl: 'punt',   dakH: 1.2,  muur: '#e2dac4', dak: '#616058', kruis: true },
    kathedraal:  { muurH: 0.9,  stijl: 'punt',   dakH: 1.5,  muur: '#e6dfca', dak: '#5a5a54', kruis: true },

    wachttoren:  { muurH: 1.15, stijl: 'punt',   dakH: 0.7,  smal: 0.5, muur: '#a49a8c', dak: '#7a3b2c' },
    kazerne:     { muurH: 0.6,  stijl: 'schuin', dakH: 0.44, muur: '#b0a692', dak: '#5f4a3a' },
    smederij:    { muurH: 0.5,  stijl: 'schuin', dakH: 0.44, muur: '#b8a483', dak: '#5a4636' },
    wapensmid:   { muurH: 0.56, stijl: 'schuin', dakH: 0.46, muur: '#b0a08a', dak: '#5a4636' },

    kasteel:     { muurH: 1.05, stijl: 'plat',   dakH: 0.1,  muur: '#b8b0a2', dak: '#5a3a30', kantelen: true, torens: true },
    stadsmuur:   { muurH: 0.55, stijl: 'geen',   dakH: 0,    muur: '#9aa0a6', kantelen: true },
    poort:       { muurH: 0.8,  stijl: 'plat',   dakH: 0.12, muur: '#8f8578', dak: '#6a3b2c', kantelen: true },
    haven:       { muurH: 0.34, stijl: 'schuin', dakH: 0.38, muur: '#b0a184', dak: '#3f5a6a', vlag: true, luifel: true },
    oefenveld:   { muurH: 0.24, stijl: 'geen',   dakH: 0,    muur: '#a7a488', vlag: true },
    molen:       { muurH: 0.72, stijl: 'schuin', dakH: 0.44, smal: 0.62, muur: '#d5c7a4', dak: '#7c4b2e', wieken: true },

    steengroeve: { muurH: 0.34, stijl: 'schuin', dakH: 0.4,  muur: '#b0a894', dak: '#6a5a44' },
    kopermijn:   { muurH: 0.34, stijl: 'schuin', dakH: 0.4,  muur: '#b0a894', dak: '#6a5a44' },
    ijzermijn:   { muurH: 0.34, stijl: 'schuin', dakH: 0.4,  muur: '#b0a894', dak: '#6a5a44' },
    edelsteenmijn:{ muurH: 0.34, stijl: 'schuin', dakH: 0.4, muur: '#b0a894', dak: '#6a5a44' },
    houthakkershut:{ muurH: 0.44, stijl: 'schuin', dakH: 0.46, muur: '#b99a6a', dak: '#5f4530' },
    jachthut:    { muurH: 0.42, stijl: 'schuin', dakH: 0.46, muur: '#b99a6a', dak: '#5f4530' },
    vissershut:  { muurH: 0.42, stijl: 'schuin', dakH: 0.46, muur: '#b99a6a', dak: '#5f4530' },
    bakkerij:    { muurH: 0.5,  stijl: 'schuin', dakH: 0.46, muur: '#dcc99b', dak: '#7d4b25' },
    juwelier:    { muurH: 0.56, stijl: 'schuin', dakH: 0.5, muur: '#d3c39c', dak: '#6a5240' }
  };

  /* A stable little wobble per building instance, from its id: no two roofs in
     a street are quite the same brown, and no two walls quite the same plaster.
     Without this a row of five identical huisjes reads as one long shed. */
  function verscheidenheid(cfg, zaad) {
    if (!zaad && zaad !== 0) return cfg;
    var r1 = ((zaad * 2654435761) % 1000) / 1000;
    var r2 = ((zaad * 40503) % 997) / 997;
    var r3 = ((zaad * 27644437) % 991) / 991;
    cfg.muur = verf(cfg.muur, 0.94 + r1 * 0.12);
    cfg.dak = verf(cfg.dak, 0.88 + r2 * 0.24);
    /* And the *height*, a little. Colour variation alone still left a street
       with one dead-flat roofline running along it; nine percent either way is
       enough that the eye reads separate houses without anything looking
       misbuilt. */
    cfg.muurH *= 0.91 + r3 * 0.18;
    cfg.dakH *= 0.93 + r1 * 0.15;
    return cfg;
  }

  /* Roof material by building, so a standing's rise reads in the roof too:
     reed for huts and farms, tile for townhouses and workshops, slate for
     churches, halls and fortifications. */
  var RIETDAK = {
    huisje: 1, boerderij: 1, hoeve: 1, herberg: 1, voorraadschuur: 1, pakhuis: 1,
    houthakkershut: 1, houtzagerij: 1, jachthut: 1, vissershut: 1,
    steengroeve: 1, kopermijn: 1, ijzermijn: 1, edelsteenmijn: 1
  };
  var LEIDAK = {
    kapel: 1, kerk: 1, kathedraal: 1, wachttoren: 1, bergfried: 1, poort: 1,
    kasteel: 1, stadhuis: 1, universiteit: 1, gildehuis: 1
  };
  /* Buildings with a hearth get a chimney the smoke rises from. */
  var SCHOORSTEEN = {
    huisje: 1, vakwerkhuis: 1, herenhuis: 1, boerderij: 1, hoeve: 1, herberg: 1,
    bakkerij: 1, smederij: 1, wapensmid: 1, brouwerij: 1
  };

  function dakstijlVoor(def, tier) {
    if (LEIDAK[def.id]) return 'lei';
    /* A tiered house re-roofs as it climbs: reed → tile → slate. */
    if (TIER_SHAPES[def.id] && tier) return tier >= 4 ? 'lei' : (tier >= 2 ? 'pan' : 'riet');
    if (RIETDAK[def.id]) return 'riet';
    return 'pan';
  }

  function isoCfg(def, tier) {
    var basis = ISO[def.id] || ISO._default;
    var cfg = {
      muurH: basis.muurH != null ? basis.muurH : ISO._default.muurH,
      stijl: basis.stijl || ISO._default.stijl,
      dakH: basis.dakH != null ? basis.dakH : ISO._default.dakH,
      muur: basis.muur || ISO._default.muur,
      dak: basis.dak || ISO._default.dak,
      dakstijl: basis.dakstijl || dakstijlVoor(def, tier),
      schoorsteen: basis.schoorsteen || (SCHOORSTEEN[def.id] ? { u: 0.34, v: 0.34, h: 0.44 } : null),
      smal: basis.smal || 0,
      vlag: basis.vlag, kruis: basis.kruis, kantelen: basis.kantelen,
      torens: basis.torens, wieken: basis.wieken, luifel: basis.luifel,
      uithang: basis.uithang
    };
    /* Tiered houses recolour with the age palette; at the top tier they gain a
       half-timber frame so the town's maturing reads at a glance. */
    if (tier && tier > 1 && TIER_SHAPES[def.id]) {
      var pal = TIER_PALET[Game.util.clamp(tier, 1, 4)];
      cfg.muur = pal.muur; cfg.dak = pal.dak;
    }
    cfg.vakwerk = tier === 4 && !!TIER_SHAPES[def.id];
    return cfg;
  }

  /* ------------------------------------------------------------------ erf --

     A patch of beaten earth around a building's footprint, a third wider than
     the building and with a wavy edge.

     This is the single most Age-of-Empires thing in the whole plan and it is
     twenty lines. Every building there stands in a worn place; here they stood
     in unbroken meadow, each on its own clean diamond, and a town read as
     separate houses dropped into a field rather than as a settlement. The yard
     also quietly does two other jobs: it hides the tile boundary underneath the
     building, and it gives js/render/props.js an honest surface for its clutter
     instead of scattering barrels on grass.

     Drawn in the renderer's pre-pass with the shadows rather than inside
     tekenGebouw, because it reaches beyond its own footprint — from inside the
     depth-sorted pass it would paint over the building standing behind it. */
  /* Trodden earth is *lighter and drier* than the grass around it, not darker.
     The first version of this was a dark brown at half opacity and measured
     almost nothing against the saturated greens of fase E — the yard was there,
     it just had nothing to say. A pale tan is what reads as a worn place. */
  var ERFKLEUR = ['rgba(176,150,102,', 'rgba(182,156,104,', 'rgba(170,144,96,', 'rgba(206,206,202,'];

  var GEEN_ERF = { stadsmuur: 1, poort: 1, brug: 1, straat: 1, oefenveld: 1 };

  S.tekenErf = function (ctx, def, sx, sy, p, grootte, zaad, seizoen) {
    if (p < 15 || GEEN_ERF[def.id] || def.weg) return;
    var foot = Game.render.diamant(sx, sy, p * grootte);
    /* A small building needs proportionally more yard than a big one: the roof
       already overhangs its walls by 14%, so a flat 1.32 left a hut's yard
       almost entirely hidden under its own eaves. */
    var uit = 1.24 + 0.5 / grootte;
    var hw = foot.hw * uit, hh = foot.hh * uit;

    ctx.beginPath();
    var N = 22;
    for (var i = 0; i <= N; i++) {
      var u = i / N;
      var a = u * Math.PI * 2;
      var cx = Math.cos(a), cy = Math.sin(a);
      /* A circle direction mapped onto the tile diamond |x/hw| + |y/hh| = 1,
         then pushed in and out along its length so the edge is worn, not
         geometric. */
      var norm = Math.abs(cx) + Math.abs(cy);
      var r = 1 + golf(zaad, u) * 0.13;
      var x = foot.cx + (cx / norm) * hw * r;
      var y = foot.cy + (cy / norm) * hh * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = (ERFKLEUR[seizoen] || ERFKLEUR[0]) + '0.62)';
    ctx.fill();

    /* A trodden-harder core, so the yard has a middle instead of being one
       even stain. */
    if (p >= 30) {
      ctx.beginPath();
      for (var k = 0; k <= N; k++) {
        var u2 = k / N;
        var a2 = u2 * Math.PI * 2;
        var dx = Math.cos(a2), dy = Math.sin(a2);
        var n2 = Math.abs(dx) + Math.abs(dy);
        var r2 = (1 + golf(zaad + 5.5, u2) * 0.16) * 0.72;
        var x2 = foot.cx + (dx / n2) * hw * r2;
        var y2 = foot.cy + (dy / n2) * hh * r2;
        if (k === 0) ctx.moveTo(x2, y2); else ctx.lineTo(x2, y2);
      }
      ctx.closePath();
      ctx.fillStyle = (ERFKLEUR[seizoen] || ERFKLEUR[0]) + '0.4)';
      ctx.fill();
    }
  };

  /* Draws a building. (sx, sy) is the projected *top corner* of its footprint,
     which spans `grootte` tiles; p is pixels-per-tile. */
  S.tekenGebouw = function (ctx, def, sx, sy, p, grootte, opties) {
    opties = opties || {};

    /* Spoor D: a registered, loaded iso sprite replaces the procedural volume;
       otherwise we draw the volume below exactly as before. */
    var atlas = Game.render.atlas;
    var isoImg = atlas && atlas.isoGebouw && atlas.isoGebouw(def.id);
    if (isoImg) { tekenGebouwSprite(ctx, isoImg, def, sx, sy, p, grootte, opties); return; }

    var cfg = verscheidenheid(isoCfg(def, opties.tijdperk), opties.zaad);
    var foot = Game.render.diamant(sx, sy, p * grootte);
    if (cfg.smal) foot = diamantVan(foot.cx, foot.cy, foot.hw * (1 - cfg.smal * 0.5), foot.hh * (1 - cfg.smal * 0.5));

    var H = p * cfg.muurH * (0.8 + 0.2 * grootte);
    var dakH = p * cfg.dakH * (0.85 + 0.08 * grootte);

    /* Cast shadow on the ground, in the one light direction the whole game
       shares (Game.render.sfeer.SCHADUW — the same top-left sun the terrain
       hillshade is baked from). This is what sets a building *on* the ground
       instead of on top of it. */
    slagschaduw(ctx, foot, H + dakH * 0.55);

    /* Soft ambient-occlusion shadow (a radial gradient, so its edge feathers
       into the ground instead of a hard ellipse), offset to the light-away
       side. */
    var scx = foot.cx + foot.hw * 0.12, scy = foot.cy + foot.hh * 0.28, sr = foot.hw * 1.08;
    var sg = ctx.createRadialGradient(scx, scy, sr * 0.35, scx, scy, sr);
    sg.addColorStop(0, 'rgba(0,0,0,.34)');
    sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.ellipse(scx, scy, sr, sr * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    var top = isoMuren(ctx, foot, H, cfg.muur, p, opties.zaad || 0);

    /* Door + shuttered windows on the visible wall faces. Shutters swing closed
       at night, at the same darkness the warm window glow comes on (fase 1.3). */
    if (!NOGEVEL[def.id] && p * grootte >= 30) gevel(ctx, foot, top, cfg, opties.nacht);

    /* Half-timber frame over the plaster on the top-tier houses. */
    if (cfg.vakwerk && p * grootte >= 26) vakwerk(ctx, foot, top);

    if (cfg.kantelen) kantelen(ctx, top, p, cfg.muur);

    /* Roofs stay proportionate as footprints grow (a big hall gets a broad,
       not a towering, roof). */
    if (cfg.stijl === 'schuin' || cfg.stijl === 'punt') dakSchuin(ctx, top, dakH, cfg.dak, cfg.dakstijl, p);
    else if (cfg.stijl === 'plat') vulDiamant(ctx, top, verf(cfg.muur, 0.98));
    else vulDiamant(ctx, top, verf(cfg.muur, 0.9));   /* 'geen': open wall top */

    /* Contour: a dark line around the standing silhouette, so a row of houses
       reads as separate roofs instead of one brown field. */
    if (p * grootte >= 18) contour(ctx, foot, top);

    if (opties.seizoen === 3) dakSneeuw(ctx, top, dakH, cfg);

    /* A chimney on the roof, so the ambient smoke rises from something (1.2). */
    if (cfg.schoorsteen && p >= 26 && cfg.stijl !== 'geen') schoorsteenBlok(ctx, top, dakH, p, cfg);

    if (cfg.torens) kasteelTorens(ctx, foot, H, dakH, cfg, p);
    if (cfg.kruis) kruisTop(ctx, top, dakH, p);
    if (cfg.vlag) vlag(ctx, top, dakH, p);
    if (cfg.wieken) wieken(ctx, foot, H, p, opties.tijd || 0, cfg.dak);
    if (cfg.uithang) uithangbord(ctx, foot, H, p);

    if (opties.geschroeid) schroei(ctx, foot, H, dakH, opties.geschroeid);

    /* Icon badge, for the zoom range where a roof is too small to read. See
       bordjeDekking: it is a wayfinding aid when zoomed out, not decoration. */
    if (def.id !== 'stadsmuur' && !cfg.wieken) {
      bordje(ctx, def.emoji, top.cx, top.cy - (cfg.stijl === 'plat' ? p * 0.1 : dakH * 0.46), p, opties);
    }
  };

  /* The ground shadow a building throws: the footprint diamond swept along the
     light direction by its height. Drawn as the swept silhouette (the hull of
     the near and the offset diamond) so it stays one clean shape. */
  function slagschaduw(ctx, foot, hoogte) {
    var richting = (Game.render.sfeer && Game.render.sfeer.SCHADUW) || { x: 0.62, y: 0.30 };
    /* A low sun throws a long shadow. The direction stays put (see the header
       of js/render/sfeer.js) but the length and the colour follow the hour,
       which is most of what makes a morning look like a morning. */
    var rek = S.schaduwRek(huidigLicht);
    var ox = hoogte * richting.x * rek, oy = hoogte * richting.y * rek;
    if (ox < 1 && oy < 1) return;

    /* Deepened from .22. A building's shadow should be the darkest thing
       around it — that contrast is where the relief comes from, and at .22 it
       barely registered on a screenshot. */
    ctx.fillStyle = S.schaduwKleur(huidigLicht, 0.4);
    ctx.beginPath();
    ctx.moveTo(foot.top.x, foot.top.y);
    ctx.lineTo(foot.right.x, foot.right.y);
    ctx.lineTo(foot.right.x + ox, foot.right.y + oy);
    ctx.lineTo(foot.bottom.x + ox, foot.bottom.y + oy);
    ctx.lineTo(foot.left.x + ox, foot.left.y + oy);
    ctx.lineTo(foot.left.x, foot.left.y);
    ctx.closePath();
    ctx.fill();
  }

  /* Dark outline over the wall corners and the eaves. Only the edges that are
     part of the outer silhouette, so the inside of the volume stays clean. */
  function contour(ctx, foot, top) {
    ctx.strokeStyle = 'rgba(28,20,12,.42)';
    ctx.lineWidth = Math.max(1, foot.hw * 0.035);
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(foot.left.x, foot.left.y);
    ctx.lineTo(foot.bottom.x, foot.bottom.y);
    ctx.lineTo(foot.right.x, foot.right.y);
    ctx.moveTo(foot.left.x, foot.left.y); ctx.lineTo(top.left.x, top.left.y);
    ctx.moveTo(foot.bottom.x, foot.bottom.y); ctx.lineTo(top.bottom.x, top.bottom.y);
    ctx.moveTo(foot.right.x, foot.right.y); ctx.lineTo(top.right.x, top.right.y);
    ctx.stroke();
  }

  /* A small dark plaque with the building's icon on it, with a peg and a
     shadow so it hangs rather than floats. Fades out as the building grows on
     screen. */
  /* The zoom window in which the badge is the only thing identifying a roof.
     It used to be full strength up to p = 48 and only fade out between 48 and
     70 — which is to say: on every normal playing distance every roof wore an
     emoji, and that was the loudest thing on the screen. It is the other way
     round now. Below LAAG a building is a few pixels and the badge would swamp
     it; above UIT the silhouette, the facade and the yard already say what this
     is. Hovering, selecting, or holding the labels key brings it back at any
     zoom, the way an RTS shows its health bars. */
  var BORDJE_LAAG = 16, BORDJE_AAN = 20, BORDJE_UIT = 32, BORDJE_WEG = 42;

  function bordjeDekking(p, opties) {
    if (opties && opties.toonBordje) return 1;
    if (p <= BORDJE_LAAG || p >= BORDJE_WEG) return 0;
    if (p < BORDJE_AAN) return (p - BORDJE_LAAG) / (BORDJE_AAN - BORDJE_LAAG);
    if (p > BORDJE_UIT) return (BORDJE_WEG - p) / (BORDJE_WEG - BORDJE_UIT);
    return 1;
  }

  function bordje(ctx, emoji, cx, cy, p, opties) {
    var alpha = bordjeDekking(p, opties);
    if (alpha <= 0.01) return;
    /* Dim with the night wash, otherwise the badges float over a dark town at
       full daylight brightness — the one thing that gave the night away. */
    if (opties && opties.nachtF) alpha *= 1 - opties.nachtF * 0.45;
    var r = Game.util.clamp(p * 0.26, 8, 17);

    ctx.save();
    ctx.globalAlpha = alpha;

    ctx.fillStyle = 'rgba(24,17,10,.82)';
    ctx.strokeStyle = 'rgba(215,169,75,.55)';
    ctx.lineWidth = Math.max(1, r * 0.09);
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(cx - r, cy - r * 0.86, r * 2, r * 1.72, r * 0.32);
    else ctx.rect(cx - r, cy - r * 0.86, r * 2, r * 1.72);
    ctx.fill();
    ctx.stroke();

    ctx.font = Math.round(r * 1.15) + 'px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, cx, cy + r * 0.06);
    ctx.restore();
  }

  /* Snow settling on a roof in winter: a white cap over the upper part of the
     two front roof faces, or a full white top on a flat roof. The single
     cheapest thing that makes winter read as winter in the town itself. */
  function dakSneeuw(ctx, t, dakH, cfg) {
    if (cfg.stijl === 'plat' || cfg.stijl === 'geen') {
      vulDiamant(ctx, t, 'rgba(240,247,252,.72)');
      return;
    }
    var apex = { x: t.cx, y: t.cy - dakH };
    var deel = 0.46;
    var sL = lerp(apex, t.left, deel), sR = lerp(apex, t.right, deel);
    var sB = lerp(apex, t.bottom, deel), sT = lerp(apex, t.top, deel);
    tri(ctx, apex, sL, sB, 'rgba(238,245,250,.85)');
    tri(ctx, apex, sB, sR, 'rgba(248,252,255,.9)');
    tri(ctx, apex, sT, sL, 'rgba(230,238,245,.7)');
    tri(ctx, apex, sT, sR, 'rgba(236,243,249,.75)');
  }

  /* Draw a registered iso building sprite in place of the procedural volume,
     anchored with its base at the front corner of the footprint so it sits on
     the tile and depth-sorts correctly. Keeps the soft ground shadow and the
     raid scorch so it matches the rest of the town. */
  function tekenGebouwSprite(ctx, img, def, sx, sy, p, grootte, opties) {
    var foot = Game.render.diamant(sx, sy, p * grootte);
    var w = p * grootte * 1.5;
    var ratio = (img.naturalHeight && img.naturalWidth) ? img.naturalHeight / img.naturalWidth : 1;
    var h = w * ratio;
    /* Roughly how tall the art stands above its footprint, for the cast shadow
       and for hanging the badge — the sprite has no volume to ask. */
    var hoogte = Math.max(0, h - foot.hh * 2);

    /* Everything the procedural volume gets, a sprite-backed building gets too.
       The whole point of the hook is that a building can be swapped over to
       painted art one at a time; if crossing that line silently cost it its
       cast shadow, its icon badge and its snow, a half-converted town would
       look broken in a way that reads as a bug rather than as a style. */
    slagschaduw(ctx, foot, hoogte * 0.75);

    var scx = foot.cx + foot.hw * 0.12, scy = foot.cy + foot.hh * 0.28, sr = foot.hw * 1.08;
    var sg = ctx.createRadialGradient(scx, scy, sr * 0.35, scx, scy, sr);
    sg.addColorStop(0, 'rgba(0,0,0,.34)');
    sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.ellipse(scx, scy, sr, sr * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.drawImage(img, foot.cx - w / 2, foot.cy + foot.hh - h, w, h);

    if (opties.geschroeid) schroei(ctx, foot, p * grootte * 0.6, h * 0.4, opties.geschroeid);

    if (def.id !== 'stadsmuur') {
      bordje(ctx, def.emoji, foot.cx, foot.cy + foot.hh - h * 0.92, p, opties);
    }
  }

  /* Left + right visible walls; returns the raised top-face diamond. The dark
     (left) face is lifted a touch by a soft fill light so the shadow side does
     not crush to a flat block. */
  function isoMuren(ctx, foot, H, muur, p, zaad) {
    var top = diamantVan(foot.cx, foot.cy - H, foot.hw, foot.hh);
    quad(ctx, foot.left, foot.bottom, top.bottom, top.left, verf(muur, 0.72));    /* left face  */
    quad(ctx, foot.bottom, foot.right, top.right, top.bottom, verf(muur, 0.88));  /* right face */
    if (p >= 26) {
      pleister(ctx, foot.left, foot.bottom, top.bottom, top.left, muur, 0.72, p, zaad);
      pleister(ctx, foot.bottom, foot.right, top.right, top.bottom, muur, 0.88, p, zaad + 7);
    }
    return top;
  }

  /* What a rendered wall actually looks like: uneven, and dirty where it meets
     the ground. A flat quad of one cream is the single clearest "vector" tell
     on a building at close zoom, and two cheap passes fix it.

       - A handful of soft blotches of lighter and darker plaster, placed from
         the building's own seed so a street is not one repeated wall.
       - A band of damp and splashed mud along the bottom. This is an old
         painter's trick and it does something no shadow can: it *sets the
         building on the ground* instead of letting it hover on a clean line. */
  function pleister(ctx, bl, br, tr, tl, muur, licht, p, zaad) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(bl.x, bl.y); ctx.lineTo(br.x, br.y);
    ctx.lineTo(tr.x, tr.y); ctx.lineTo(tl.x, tl.y);
    ctx.closePath();
    ctx.clip();

    for (var i = 0; i < 4; i++) {
      var h1 = ((zaad * 37 + i * 131) % 97) / 97;
      var h2 = ((zaad * 61 + i * 89) % 83) / 83;
      var q = gevelPunt(bl, br, tl, tr, h1, h2);
      var r = p * (0.1 + h2 * 0.16);
      ctx.fillStyle = verf(muur, licht * (i % 2 ? 1.07 : 0.93));
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.ellipse(q.x, q.y, r, r * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    /* The dirt band along the foot of the wall. */
    var hoogte = bl.y - tl.y;
    var g = ctx.createLinearGradient(0, bl.y, 0, bl.y - Math.abs(hoogte) * 0.3);
    g.addColorStop(0, 'rgba(58,44,28,.34)');
    g.addColorStop(1, 'rgba(58,44,28,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(bl.x, bl.y); ctx.lineTo(br.x, br.y);
    ctx.lineTo(tr.x, tr.y); ctx.lineTo(tl.x, tl.y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /* Hip / spire roof rising from a top-face diamond to an apex, with a lit
     ridge line so the two front faces read as a proper roof, plus a few faint
     courses parallel to the eaves that suggest tiles / thatch (C1). */
  function dakSchuin(ctx, t, dakH, dak, dakstijl, p) {
    /* Eaves: the roof springs from a slightly wider diamond than the wall top,
       and hangs a touch lower. That overhang is most of what separates "a house"
       from "a box with a point on it", and it gives the wall below a shadow
       line for free. */
    var e = diamantVan(t.cx, t.cy + t.hh * 0.14, t.hw * 1.14, t.hh * 1.14);
    var apex = { x: e.cx, y: t.cy - dakH };

    tri(ctx, e.top, e.left, apex, verf(dak, 0.7));    /* back-left  (far)  */
    tri(ctx, e.top, e.right, apex, verf(dak, 0.84));  /* back-right */
    tri(ctx, e.left, e.bottom, apex, verf(dak, 0.92)); /* front-left */
    tri(ctx, e.bottom, e.right, apex, verf(dak, 1.08));/* front-right (lit) */

    /* Material of the two front faces: tile courses, thatch or slate. Only the
       fine grain kicks in when zoomed in (fase 1.1); the flat faces above read
       identically far out. */
    dakLagen(ctx, e.left, e.bottom, apex, dak, 0.9, dakstijl, p);   /* front-left  */
    dakLagen(ctx, e.bottom, e.right, apex, dak, 1.06, dakstijl, p); /* front-right */

    /* Lit ridge, then a dark line along the eaves so the roof edge reads. */
    ctx.strokeStyle = verf(dak, 1.28);
    ctx.lineWidth = Math.max(1, dakH * 0.03);
    ctx.beginPath();
    ctx.moveTo(e.bottom.x, e.bottom.y); ctx.lineTo(apex.x, apex.y);
    ctx.stroke();

    /* Reed roofs have a ragged, thick lower edge rather than a crisp eave. */
    if (dakstijl === 'riet' && p > 34) {
      ctx.strokeStyle = verf(dak, 0.66);
      ctx.lineWidth = Math.max(1.5, e.hw * 0.09);
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(e.left.x, e.left.y); ctx.lineTo(e.bottom.x, e.bottom.y); ctx.lineTo(e.right.x, e.right.y);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(26,18,10,.45)';
    ctx.lineWidth = Math.max(1, e.hw * 0.035);
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(e.left.x, e.left.y);
    ctx.lineTo(e.bottom.x, e.bottom.y);
    ctx.lineTo(e.right.x, e.right.y);
    ctx.stroke();
  }

  /* The material of one roof face, between its eave (edge a→b) and the apex.
     This used to be four faint lines and, only above p = 34, five short dashes
     per row — which is to say that on a roof forty pixels tall you got four
     stripes, and the roof read as a coloured triangle. The course count now
     follows the face's actual height on screen, so a roof carries pantiles at
     the scale pantiles have, and each style is drawn as the thing it is:

       pan  — courses of staggered tiles with a lit top edge and a dark joint,
              which is what gives a tiled roof its corrugation.
       lei  — many fine courses of small slates, staggered, cooler and flatter.
       riet — few, thick, soft bands with a combed grain running up the slope
              and a ragged bottom edge.

     One path per pass, so a roof is a handful of strokes however many tiles it
     has. Buildings are counted in dozens, not thousands: this is the cheapest
     place in the renderer to spend detail. */
  function dakLagen(ctx, a, b, apex, dak, licht, dakstijl, p) {
    p = p || 0;
    dakstijl = dakstijl || 'pan';

    /* How tall this face is on screen decides how many courses fit. */
    var hoogte = Math.abs(apex.y - (a.y + b.y) / 2);
    var perLaag = dakstijl === 'riet' ? p * 0.3 : (dakstijl === 'lei' ? p * 0.075 : p * 0.1);
    var lagen = Game.util.clamp(Math.round(hoogte / Math.max(2, perLaag)), 2, 20);

    if (p < 16) {
      /* Far out: two hint lines, no more. The silhouette carries the roof. */
      lijnLagen(ctx, a, b, apex, verf(dak, licht * 0.82), 1, 3);
      return;
    }

    if (dakstijl === 'riet') {
      /* Soft bands, then a comb of strokes running up the slope. */
      lijnLagen(ctx, a, b, apex, verf(dak, licht * 0.86), Math.max(1, p * 0.02), lagen);
      if (p >= 34) {
        ctx.strokeStyle = verf(dak, licht * 0.94);
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (var c = 1; c < 9; c++) {
          var voet = lerp(a, b, c / 9);
          var kruin = lerp(voet, apex, 0.82);
          ctx.moveTo(voet.x, voet.y); ctx.lineTo(kruin.x, kruin.y);
        }
        ctx.stroke();
      }
      return;
    }

    /* Tile and slate: a lit edge along the top of every course and a dark
       joint under it. Two strokes for the whole face. */
    lijnLagen(ctx, a, b, apex, verf(dak, licht * 1.16), 1, lagen, 0.012);
    lijnLagen(ctx, a, b, apex, verf(dak, licht * 0.62), Math.max(1, p * 0.008), lagen);

    if (p < 30) return;

    /* The individual tiles: a staggered dash per tile along each course. */
    var perRij = dakstijl === 'lei' ? 9 : 6;
    ctx.strokeStyle = verf(dak, licht * 0.5);
    ctx.lineWidth = Math.max(1, p * 0.006);
    ctx.lineCap = 'butt';
    ctx.beginPath();
    for (var r = 1; r < lagen; r++) {
      var u = r / lagen;
      var la = lerp(a, apex, u), lb = lerp(b, apex, u);
      var lo = lerp(a, apex, Math.min(1, u + 1 / lagen));
      var lp = lerp(b, apex, Math.min(1, u + 1 / lagen));
      var schuif = (r % 2) * 0.5;
      for (var k = 0; k < perRij; k++) {
        var f = (k + schuif) / perRij;
        if (f > 1) continue;
        var onder = lerp(la, lb, f), boven = lerp(lo, lp, f);
        ctx.moveTo(onder.x, onder.y); ctx.lineTo(boven.x, boven.y);
      }
    }
    ctx.stroke();
  }

  /* `n` lines parallel to the eave a→b, spread up towards the apex. `verschuif`
     nudges them a hair up the slope, which is how the lit edge of a course sits
     just above its own joint. */
  function lijnLagen(ctx, a, b, apex, kleur, dikte, n, verschuif) {
    ctx.strokeStyle = kleur;
    ctx.lineWidth = dikte;
    ctx.beginPath();
    for (var i = 1; i < n; i++) {
      var u = i / n + (verschuif || 0);
      var q1 = lerp(a, apex, u), q2 = lerp(b, apex, u);
      ctx.moveTo(q1.x, q1.y); ctx.lineTo(q2.x, q2.y);
    }
    ctx.stroke();
  }

  /* A brick chimney standing on the roof, offset toward the lit side, with a
     dark mouth so the ambient smoke has something to rise from (fase 1.2). */
  function schoorsteenBlok(ctx, top, dakH, p, cfg) {
    var sc = cfg.schoorsteen || { u: 0.4, v: 0.2, h: 0.5 };
    var bx = top.cx + top.hw * (sc.u != null ? sc.u : 0.4);
    var by = top.cy - dakH * (sc.v != null ? sc.v : 0.35);
    var w = p * 0.11, h = p * (sc.h != null ? sc.h : 0.4);
    ctx.fillStyle = '#7a5340';
    ctx.fillRect(bx - w / 2, by - h, w, h);
    ctx.fillStyle = '#8a6048';
    ctx.fillRect(bx - w / 2, by - h, w * 0.42, h);
    ctx.fillStyle = '#3a2a20';
    ctx.fillRect(bx - w / 2 - w * 0.08, by - h - p * 0.02, w * 1.16, p * 0.04);
  }

  /* Buildings whose walls stay plain (fortifications, towers, mills, mines). */
  var NOGEVEL = {
    stadsmuur: 1, wachttoren: 1, molen: 1, waterput: 1, kasteel: 1,
    steengroeve: 1, kopermijn: 1, ijzermijn: 1, edelsteenmijn: 1
  };

  function gevelPunt(bl, br, tl, tr, u, v) {
    return lerp(lerp(bl, br, u), lerp(tl, tr, u), v);
  }

  /* Door on the lit face + shuttered windows on both visible faces. `nacht`
     closes the shutters over the window openings once it is dark. */
  function gevel(ctx, foot, top, cfg, nacht) {
    gevelVlak(ctx, foot.bottom, foot.right, top.bottom, top.right, cfg, true, nacht);
    gevelVlak(ctx, foot.left, foot.bottom, top.left, top.bottom, cfg, false, nacht);
  }

  function gevelVlak(ctx, bl, br, tl, tr, cfg, lit, nacht) {
    if (lit) {
      quad(ctx,
        gevelPunt(bl, br, tl, tr, 0.44, 0.02), gevelPunt(bl, br, tl, tr, 0.6, 0.02),
        gevelPunt(bl, br, tl, tr, 0.6, 0.5),  gevelPunt(bl, br, tl, tr, 0.44, 0.5),
        verf(cfg.dak, 0.55));
    }
    var raam = lit ? 'rgba(42,30,18,.9)' : 'rgba(30,22,14,.92)';
    var us = lit ? [0.2, 0.82] : [0.32, 0.68];
    for (var i = 0; i < us.length; i++) {
      var u = us[i];
      quad(ctx,
        gevelPunt(bl, br, tl, tr, u - 0.07, 0.56), gevelPunt(bl, br, tl, tr, u + 0.07, 0.56),
        gevelPunt(bl, br, tl, tr, u + 0.07, 0.82), gevelPunt(bl, br, tl, tr, u - 0.07, 0.82),
        raam);
      /* Fase 1.3: a pair of closed shutters over the opening at night, in the
         wall's own timber, with a seam down the middle. */
      if (nacht) {
        var luik = verf(cfg.dak, 0.8);
        quad(ctx,
          gevelPunt(bl, br, tl, tr, u - 0.075, 0.55), gevelPunt(bl, br, tl, tr, u, 0.55),
          gevelPunt(bl, br, tl, tr, u, 0.83), gevelPunt(bl, br, tl, tr, u - 0.075, 0.83),
          luik);
        quad(ctx,
          gevelPunt(bl, br, tl, tr, u, 0.55), gevelPunt(bl, br, tl, tr, u + 0.075, 0.55),
          gevelPunt(bl, br, tl, tr, u + 0.075, 0.83), gevelPunt(bl, br, tl, tr, u, 0.83),
          verf(cfg.dak, 0.66));
      }
    }
  }

  /* Half-timber framing on the two visible faces: corner posts, top plate,
     sill and a pair of diagonal braces, in dark oak over the plaster. */
  function vakwerk(ctx, foot, top) {
    var balk = '#5a4030';
    ctx.strokeStyle = balk;
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1, foot.hw * 0.06);
    ctx.beginPath();
    ctx.moveTo(foot.left.x, foot.left.y); ctx.lineTo(top.left.x, top.left.y);
    ctx.moveTo(foot.bottom.x, foot.bottom.y); ctx.lineTo(top.bottom.x, top.bottom.y);
    ctx.moveTo(foot.right.x, foot.right.y); ctx.lineTo(top.right.x, top.right.y);
    ctx.moveTo(top.left.x, top.left.y); ctx.lineTo(top.bottom.x, top.bottom.y); ctx.lineTo(top.right.x, top.right.y);
    ctx.moveTo(foot.left.x, foot.left.y); ctx.lineTo(foot.bottom.x, foot.bottom.y); ctx.lineTo(foot.right.x, foot.right.y);
    ctx.stroke();
    ctx.lineWidth = Math.max(1, foot.hw * 0.04);
    ctx.beginPath();
    ctx.moveTo(foot.bottom.x, foot.bottom.y); ctx.lineTo(top.left.x, top.left.y);
    ctx.moveTo(foot.bottom.x, foot.bottom.y); ctx.lineTo(top.right.x, top.right.y);
    ctx.stroke();
  }

  /* Crenellated parapet along the two near top edges. */
  function kantelen(ctx, t, p, muur) {
    var n = 4, h = p * 0.16;
    for (var s = 0; s < 2; s++) {
      var a = s === 0 ? t.left : t.bottom;
      var b = s === 0 ? t.bottom : t.right;
      for (var i = 0; i < n; i += 2) {
        var q0 = lerp(a, b, i / n), q1 = lerp(a, b, (i + 1) / n);
        quad(ctx, q0, q1, omhoog(q1, h), omhoog(q0, h), verf(muur, s === 0 ? 0.72 : 0.9));
      }
    }
  }

  function kasteelTorens(ctx, foot, H, dakH, cfg, p) {
    var th = H * 1.18, r = foot.hw * 0.26;
    [foot.left, foot.top, foot.right].forEach(function (c, i) {
      var base = diamantVan(c.x, c.y, r, r * 0.5);
      var top = isoMuren(ctx, base, th, cfg.muur);
      dakSchuin(ctx, top, dakH * 1.1, cfg.dak, cfg.dakstijl, p);
    });
  }

  function kruisTop(ctx, t, dakH, p) {
    var apex = t.cy - dakH;
    ctx.strokeStyle = '#d7a94b';
    ctx.lineWidth = Math.max(1.4, p * 0.045);
    ctx.beginPath();
    ctx.moveTo(t.cx, apex - p * 0.02); ctx.lineTo(t.cx, apex - p * 0.28);
    ctx.moveTo(t.cx - p * 0.09, apex - p * 0.2); ctx.lineTo(t.cx + p * 0.09, apex - p * 0.2);
    ctx.stroke();
  }

  function vlag(ctx, t, dakH, p) {
    var apex = t.cy - dakH;
    ctx.strokeStyle = '#6a5030';
    ctx.lineWidth = Math.max(1, p * 0.03);
    ctx.beginPath();
    ctx.moveTo(t.cx, apex); ctx.lineTo(t.cx, apex - p * 0.34);
    ctx.stroke();
    ctx.fillStyle = '#c85a4a';
    ctx.beginPath();
    ctx.moveTo(t.cx, apex - p * 0.34);
    ctx.lineTo(t.cx + p * 0.2, apex - p * 0.28);
    ctx.lineTo(t.cx, apex - p * 0.22);
    ctx.closePath();
    ctx.fill();
  }

  /* Turning windmill sails on the front (lower-right) face. */
  function wieken(ctx, foot, H, p, tijd, dak) {
    var cx = foot.cx + foot.hw * 0.22, cy = foot.cy - H * 0.72, r = p * 0.42;
    ctx.strokeStyle = '#5c4326';
    ctx.lineWidth = Math.max(1.5, p * 0.05);
    for (var i = 0; i < 4; i++) {
      var a = tijd * 0.9 + i * Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.62);
      ctx.stroke();
    }
  }

  function uithangbord(ctx, foot, H, p) {
    var x = foot.right.x + p * 0.02, y = foot.right.y - H * 0.6;
    ctx.strokeStyle = '#5a4126';
    ctx.lineWidth = Math.max(1, p * 0.03);
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x, y + p * 0.22);
    ctx.stroke();
    ctx.fillStyle = '#8a5a34';
    ctx.fillRect(x - p * 0.07, y + p * 0.08, p * 0.14, p * 0.12);
  }

  /* A smoky scorch wash on a building the raiders damaged (fase 6). */
  function schroei(ctx, foot, H, dakH, timer) {
    var t = Game.util.clamp(timer / 26, 0, 1);
    ctx.save();
    ctx.globalAlpha = t * 0.55;
    ctx.fillStyle = 'rgba(30,24,20,1)';
    ctx.beginPath();
    ctx.ellipse(foot.cx, foot.cy - H * 0.5, foot.hw * 0.9, (H + dakH) * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /* Construction site: a low iso stub grown by progress, scaffolding whose rails
     rise with it, stacks of the materials the building costs, a rope winch on
     the bigger sites, and a floating progress bar. Building is a big share of
     the play time, so it earns a bit more than four poles (fase 1.4). */
  S.tekenBouwplaats = function (ctx, def, sx, sy, p, grootte, deel) {
    var foot = Game.render.diamant(sx, sy, p * grootte);
    deel = Game.util.clamp(deel, 0, 1);

    ctx.fillStyle = 'rgba(0,0,0,.2)';
    ctx.beginPath();
    ctx.ellipse(foot.cx, foot.cy + foot.hh * 0.25, foot.hw * 0.98, foot.hh * 0.98, 0, 0, Math.PI * 2);
    ctx.fill();

    var H = p * grootte * 0.4 * deel + 1;
    var top = isoMuren(ctx, foot, H, '#b89a6a');
    vulDiamant(ctx, top, 'rgba(150,120,80,.85)');

    /* Scaffolding poles at the footprint corners, with horizontal rails that
       climb as the walls grow. */
    var poleH = p * grootte * 0.5;
    var hoeken = [foot.left, foot.right, foot.top, foot.bottom];
    ctx.strokeStyle = '#a07b46';
    ctx.lineWidth = Math.max(1, p * 0.04);
    ctx.beginPath();
    hoeken.forEach(function (c) { ctx.moveTo(c.x, c.y); ctx.lineTo(c.x, c.y - poleH); });
    ctx.stroke();

    if (p * grootte >= 22) {
      /* Rails around the frame at the current build height, plus one mid rail. */
      ctx.strokeStyle = 'rgba(150,116,66,.85)';
      ctx.lineWidth = Math.max(1, p * 0.03);
      [Math.max(p * 0.12, H), poleH * 0.55].forEach(function (rh) {
        ctx.beginPath();
        for (var i = 0; i < hoeken.length; i++) {
          var a = hoeken[i], b = hoeken[(i + 1) % hoeken.length];
          ctx.moveTo(a.x, a.y - rh); ctx.lineTo(b.x, b.y - rh);
        }
        ctx.stroke();
      });

      /* Material stacks of what the building is made of, along the near edge. */
      var kleuren = [];
      for (var kr in (def.kosten || {})) {
        var rdef = Game.config.resources[kr];
        if (rdef) kleuren.push(rdef.kleur);
        if (kleuren.length >= 3) break;
      }
      for (var m = 0; m < kleuren.length; m++) {
        var mx = foot.bottom.x - foot.hw * 0.4 + m * p * 0.22;
        var my = foot.bottom.y - foot.hh * 0.1;
        materiaalStapel(ctx, mx, my, p, kleuren[m], 1 - deel * 0.6);
      }

      /* A winch with a rope on the bigger sites. */
      if (grootte >= 2) {
        var wx = foot.cx, wy = foot.cy - poleH;
        ctx.strokeStyle = '#6a4a28';
        ctx.lineWidth = Math.max(1, p * 0.03);
        ctx.beginPath();
        ctx.moveTo(foot.top.x, foot.top.y - poleH); ctx.lineTo(wx, wy);
        ctx.moveTo(wx, wy); ctx.lineTo(wx, wy + poleH * (0.3 + deel * 0.4));
        ctx.stroke();
        ctx.fillStyle = '#8a6236';
        ctx.fillRect(wx - p * 0.06, wy + poleH * (0.3 + deel * 0.4), p * 0.12, p * 0.1);
      }
    }

    if (p * grootte >= 24) {
      ctx.font = Math.round(p * grootte * 0.28) + 'px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = 0.8;
      ctx.fillText(def.emoji, foot.cx, foot.cy - H - p * 0.1);
      ctx.globalAlpha = 1;
    }

    /* Progress bar floating above the site. */
    var bw = foot.hw * 1.1, bx = foot.cx - bw / 2, by = foot.cy - poleH - p * 0.2, bh = Math.max(3, p * 0.09);
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = '#d7a94b';
    ctx.fillRect(bx, by, bw * deel, bh);
  };

  /* A little pile of building material in the resource's colour; shrinks as the
     work uses it up (`voorraad` 0..1). */
  function materiaalStapel(ctx, x, y, p, kleur, voorraad) {
    var n = 1 + Math.round(voorraad * 2);
    for (var i = 0; i < n; i++) {
      ctx.fillStyle = verf(kleur, 0.8 + i * 0.12);
      ctx.beginPath();
      ctx.ellipse(x + (i % 2) * p * 0.04, y - i * p * 0.05, p * 0.08, p * 0.045, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* An iso miniature of a building, rendered once to an offscreen canvas and
     cached as a data URL, so the build menu and the panel can show the real
     volume you are about to place instead of an emoji (fase 8.1). */
  var miniCache = {};
  S.miniatuurBron = function (def, maat, tijdperk) {
    maat = maat || 60;
    var sleutel = def.id + ':' + maat + ':' + (tijdperk || 0);
    if (miniCache[sleutel]) return miniCache[sleutel];
    if (typeof document === 'undefined') return null;
    var cv = document.createElement('canvas');
    cv.width = maat; cv.height = maat;
    var c = cv.getContext('2d');
    var grootte = def.grootte || 1;
    var p = (maat * 0.6) / grootte;
    S.tekenGebouw(c, def, maat / 2, maat * 0.3, p, grootte,
      { tijd: 0, tijdperk: tijdperk || def.tijdperk, seizoen: 0, zaad: 3 });
    var url;
    try { url = cv.toDataURL(); } catch (e) { url = null; }
    if (url) miniCache[sleutel] = url;
    return url;
  };

  Game.render.sprites = S;

})(window.Game);
