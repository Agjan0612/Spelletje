/* Map generation.
 *
 * A tile is a plain object so it survives JSON round-trips in saves:
 *   { t: terrein, n: node|null, amt: voorraad, max: startvoorraad, v: variant, b: gebouw-id|null }
 *
 * Terrein: water | gras | vruchtbaar | bos | rots | berg
 * Node:    hout | wild | vis | steen | ijzer | koper | edelsteen | vruchtbaar
 */
(function (Game) {

  var M = {};

  M.BREEDTE = 64;
  M.HOOGTE = 48;

  /* Practically endless nodes (water, fertile soil). A big finite number
     instead of Infinity so it survives JSON in saves. */
  M.ONEINDIG = 1e9;

  M.bebouwbaar = { gras: true, vruchtbaar: true, bos: true };

  M.terreinNaam = {
    water: 'Water', gras: 'Grasland', vruchtbaar: 'Vruchtbare grond',
    bos: 'Bos', rots: 'Rotsen', berg: 'Bergen'
  };

  M.nodeNaam = {
    hout: 'Bomen', wild: 'Wild', vis: 'Visgrond', steen: 'Steenader',
    ijzer: 'IJzerader', koper: 'Koperader', edelsteen: 'Edelsteenader',
    vruchtbaar: 'Vruchtbare grond'
  };

  M.index = function (kaart, x, y) { return y * kaart.b + x; };

  M.tegel = function (kaart, x, y) {
    if (x < 0 || y < 0 || x >= kaart.b || y >= kaart.h) return null;
    return kaart.tegels[y * kaart.b + x];
  };

  /* Total amount of a node type within `straal` tiles of (x, y). */
  M.nodeInBereik = function (kaart, x, y, node, straal) {
    var totaal = 0;
    for (var dy = -straal; dy <= straal; dy++) {
      for (var dx = -straal; dx <= straal; dx++) {
        var t = M.tegel(kaart, x + dx, y + dy);
        if (t && t.n === node && t.amt > 0) totaal += t.amt;
      }
    }
    return totaal;
  };

  /* Nearest tile with the given node that still has stock, or null. */
  M.zoekNode = function (kaart, x, y, node, straal) {
    var beste = null, besteAfstand = Infinity;
    for (var dy = -straal; dy <= straal; dy++) {
      for (var dx = -straal; dx <= straal; dx++) {
        var t = M.tegel(kaart, x + dx, y + dy);
        if (!t || t.n !== node || t.amt <= 0) continue;
        var d = dx * dx + dy * dy;
        if (d < besteAfstand) { besteAfstand = d; beste = t; }
      }
    }
    return beste;
  };

  /* `breedte`/`hoogte` are optional: the new-game screen passes the chosen
     map size, everything else falls back to the standard 64x48. */
  M.genereer = function (seed, breedte, hoogte_) {
    var b = breedte || M.BREEDTE, h = hoogte_ || M.HOOGTE;
    var rng = new Game.core.Rng(seed);
    var hoogte = Game.core.ruis(seed * 7 + 11, b, h, 9);
    var vocht = Game.core.ruis(seed * 13 + 29, b, h, 7);
    var detail = Game.core.ruis(seed * 17 + 5, b, h, 3);

    var tegels = new Array(b * h);

    for (var y = 0; y < h; y++) {
      for (var x = 0; x < b; x++) {
        var i = y * b + x;

        /* Push the height down towards the edges so the map ends in water
           instead of an abrupt cut. */
        var randX = Math.min(x, b - 1 - x) / (b * 0.5);
        var randY = Math.min(y, h - 1 - y) / (h * 0.5);
        var randFactor = Math.min(1, Math.min(randX, randY) * 2.6);

        var hh = hoogte[i] * 0.72 + detail[i] * 0.28;
        hh = hh * (0.35 + 0.65 * randFactor);
        var vv = vocht[i] * 0.75 + detail[i] * 0.25;

        /* h (0..1) is the terrain height, kept for the relief/hillshade layer.
           A plain number, so saves stay pure JSON. */
        var t = { t: 'gras', n: null, amt: 0, max: 0, v: detail[i], b: null, h: hh };

        if (hh < 0.24) {
          t.t = 'water'; t.n = 'vis'; t.amt = M.ONEINDIG; t.max = M.ONEINDIG;
        } else if (hh > 0.70) {
          t.t = 'berg';
        } else if (hh > 0.60) {
          t.t = 'rots'; t.n = 'steen';
          t.max = t.amt = Math.round(1200 + rng.next() * 1300);
        } else if (vv > 0.60 && hh > 0.30) {
          t.t = 'bos'; t.n = 'hout';
          t.max = t.amt = Math.round(140 + rng.next() * 120);
        } else if (vv > 0.44 && hh < 0.46) {
          t.t = 'vruchtbaar'; t.n = 'vruchtbaar'; t.amt = M.ONEINDIG; t.max = M.ONEINDIG;
        }

        tegels[i] = t;
      }
    }

    var kaart = { b: b, h: h, tegels: tegels, seed: seed };

    zaaiAders(kaart, rng);
    zaaiWild(kaart, rng);

    return kaart;
  };

  /* Ore veins are placed as blobs in the mountains and in the rocky ring
     around them, so there is always buildable ground within reach of a mine. */
  function zaaiAders(kaart, rng) {
    var bergen = [];
    for (var i = 0; i < kaart.tegels.length; i++) {
      var tt = kaart.tegels[i];
      if (tt.t === 'berg' || (tt.t === 'rots' && grensAanBerg(kaart, i))) bergen.push(i);
    }
    if (!bergen.length) {
      for (var j = 0; j < kaart.tegels.length; j++) {
        if (kaart.tegels[j].t === 'rots') bergen.push(j);
      }
    }
    if (!bergen.length) return;

    var soorten = [
      { node: 'ijzer', aantal: 7, grootte: [3, 6], voorraad: [700, 1400] },
      { node: 'koper', aantal: 6, grootte: [3, 5], voorraad: [600, 1200] },
      { node: 'edelsteen', aantal: 3, grootte: [2, 3], voorraad: [220, 400] }
    ];

    /* Scale the number of veins with the area, so a big map is not a poor
       one and a small map is not littered with mines. */
    var schaal = (kaart.b * kaart.h) / (M.BREEDTE * M.HOOGTE);

    soorten.forEach(function (s) {
      var aantal = Math.max(2, Math.round(s.aantal * schaal));
      for (var n = 0; n < aantal; n++) {
        var start = bergen[rng.int(0, bergen.length - 1)];
        var cx = start % kaart.b, cy = Math.floor(start / kaart.b);
        var grootte = rng.int(s.grootte[0], s.grootte[1]);
        for (var k = 0; k < grootte; k++) {
          var x = cx + rng.int(-2, 2), y = cy + rng.int(-2, 2);
          var t = M.tegel(kaart, x, y);
          if (!t) continue;
          if (t.t !== 'berg' && t.t !== 'rots') continue;
          if (t.n && t.n !== 'steen') continue;
          t.n = s.node;
          t.max = t.amt = rng.int(s.voorraad[0], s.voorraad[1]);
        }
      }
    });
  }

  function grensAanBerg(kaart, index) {
    var x = index % kaart.b, y = Math.floor(index / kaart.b);
    for (var dy = -1; dy <= 1; dy++) {
      for (var dx = -1; dx <= 1; dx++) {
        var t = M.tegel(kaart, x + dx, y + dy);
        if (t && t.t === 'berg') return true;
      }
    }
    return false;
  }

  /* Game animals live on grass next to woodland. */
  function zaaiWild(kaart, rng) {
    for (var y = 1; y < kaart.h - 1; y++) {
      for (var x = 1; x < kaart.b - 1; x++) {
        var t = M.tegel(kaart, x, y);
        if (!t || t.t !== 'gras' || t.n) continue;
        var bosBuur = 0;
        for (var dy = -2; dy <= 2; dy++) {
          for (var dx = -2; dx <= 2; dx++) {
            var q = M.tegel(kaart, x + dx, y + dy);
            if (q && q.t === 'bos') bosBuur++;
          }
        }
        if (bosBuur >= 3 && rng.kans(0.12)) {
          t.n = 'wild';
          t.max = t.amt = rng.int(250, 500);
        }
      }
    }
  }

  /* Recomputes t.h for every tile from the map's seed, using the exact same
     noise + edge-falloff as genereer(). Used to migrate saves made before the
     relief layer existed, so they keep working and stay pure JSON. */
  M.herstelHoogte = function (kaart) {
    var b = kaart.b, h = kaart.h, seed = kaart.seed;
    var hoogte = Game.core.ruis(seed * 7 + 11, b, h, 9);
    var detail = Game.core.ruis(seed * 17 + 5, b, h, 3);
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < b; x++) {
        var i = y * b + x;
        var randX = Math.min(x, b - 1 - x) / (b * 0.5);
        var randY = Math.min(y, h - 1 - y) / (h * 0.5);
        var randFactor = Math.min(1, Math.min(randX, randY) * 2.6);
        var hh = hoogte[i] * 0.72 + detail[i] * 0.28;
        hh = hh * (0.35 + 0.65 * randFactor);
        if (kaart.tegels[i]) kaart.tegels[i].h = hh;
      }
    }
  };

  /* Scores a candidate spot for the starting village: we want flat buildable
     ground with fertile soil, forest and rock all within reach. */
  M.kiesStartplek = function (kaart) {
    var beste = null, besteScore = -1;
    for (var y = 6; y < kaart.h - 6; y += 2) {
      for (var x = 6; x < kaart.b - 6; x += 2) {
        var t = M.tegel(kaart, x, y);
        if (!t || t.t !== 'gras') continue;

        var vlak = 0;
        for (var dy = -2; dy <= 2; dy++) {
          for (var dx = -2; dx <= 2; dx++) {
            var q = M.tegel(kaart, x + dx, y + dy);
            if (q && M.bebouwbaar[q.t]) vlak++;
          }
        }
        if (vlak < 20) continue;

        var score = 0;
        score += Math.min(60, M.nodeInBereik(kaart, x, y, 'hout', 6) / 12);
        score += M.nodeInBereik(kaart, x, y, 'vruchtbaar', 5) > 0 ? 40 : 0;
        score += M.nodeInBereik(kaart, x, y, 'steen', 9) > 0 ? 25 : 0;
        /* Food beats everything else: a start without game or fish means a
           village that lives on seasonal grain alone and starves each winter. */
        score += M.nodeInBereik(kaart, x, y, 'wild', 8) > 0 ? 45 : 0;
        score += M.nodeInBereik(kaart, x, y, 'vis', 8) > 0 ? 35 : 0;
        score += vlak;

        if (score > besteScore) { besteScore = score; beste = { x: x, y: y }; }
      }
    }
    return beste || { x: Math.floor(kaart.b / 2), y: Math.floor(kaart.h / 2) };
  };

  /* Make sure the village can actually be founded: flatten the tiles the
     starting buildings need, and guarantee some fertile soil nearby. */
  M.maakStartplekVrij = function (kaart, cx, cy) {
    for (var dy = -3; dy <= 3; dy++) {
      for (var dx = -3; dx <= 3; dx++) {
        var t = M.tegel(kaart, cx + dx, cy + dy);
        if (!t) continue;
        if (t.t === 'bos' || t.t === 'rots' || t.t === 'berg') {
          t.t = 'gras'; t.n = null; t.amt = 0; t.max = 0;
        }
      }
    }
    /* Guarantee a year-round food source near the start. Grain alone yields
       nothing in winter, so every map gets game within reach of the village. */
    if (M.nodeInBereik(kaart, cx, cy, 'wild', 8) === 0 &&
        M.nodeInBereik(kaart, cx, cy, 'vis', 8) === 0) {
      var gezet = 0;
      for (var r = 4; r <= 7 && gezet < 5; r++) {
        for (var dy2 = -r; dy2 <= r && gezet < 5; dy2++) {
          for (var dx2 = -r; dx2 <= r && gezet < 5; dx2++) {
            if (Math.max(Math.abs(dx2), Math.abs(dy2)) !== r) continue;
            var w = M.tegel(kaart, cx + dx2, cy + dy2);
            if (!w || w.t !== 'gras' || w.n) continue;
            w.n = 'wild';
            w.max = w.amt = 400;
            gezet++;
          }
        }
      }
    }

    if (M.nodeInBereik(kaart, cx, cy, 'vruchtbaar', 5) === 0) {
      for (var y = cy + 2; y <= cy + 4; y++) {
        for (var x = cx - 2; x <= cx + 2; x++) {
          var q = M.tegel(kaart, x, y);
          if (q && q.t !== 'water' && q.t !== 'berg' && q.t !== 'rots') {
            q.t = 'vruchtbaar'; q.n = 'vruchtbaar'; q.amt = M.ONEINDIG; q.max = M.ONEINDIG;
          }
        }
      }
    }
  };

  Game.core.map = M;

})(window.Game);
