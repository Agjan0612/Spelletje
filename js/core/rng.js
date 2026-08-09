/* Seeded pseudo-random generator (mulberry32).
   A fixed seed makes a map reproducible, which keeps saves honest and makes
   bugs repeatable. */
(function (Game) {

  function Rng(seed) {
    this.s = (seed >>> 0) || 1;
  }

  Rng.prototype.next = function () {
    this.s = (this.s + 0x6D2B79F5) >>> 0;
    var t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  Rng.prototype.range = function (lo, hi) { return lo + this.next() * (hi - lo); };
  Rng.prototype.int = function (lo, hi) { return Math.floor(this.range(lo, hi + 1)); };
  Rng.prototype.kans = function (p) { return this.next() < p; };
  Rng.prototype.kies = function (arr) { return arr[Math.floor(this.next() * arr.length)]; };

  Game.core.Rng = Rng;

  /* Value noise built on the seeded generator: smooth blobs for terrain. */
  Game.core.ruis = function (seed, w, h, schaal) {
    var rng = new Rng(seed);
    var gw = Math.ceil(w / schaal) + 2;
    var gh = Math.ceil(h / schaal) + 2;
    var grid = new Float32Array(gw * gh);
    for (var i = 0; i < grid.length; i++) grid[i] = rng.next();

    function smooth(t) { return t * t * (3 - 2 * t); }

    var out = new Float32Array(w * h);
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var gx = x / schaal, gy = y / schaal;
        var x0 = Math.floor(gx), y0 = Math.floor(gy);
        var fx = smooth(gx - x0), fy = smooth(gy - y0);
        var a = grid[y0 * gw + x0];
        var b = grid[y0 * gw + x0 + 1];
        var c = grid[(y0 + 1) * gw + x0];
        var d = grid[(y0 + 1) * gw + x0 + 1];
        var top = a + (b - a) * fx;
        var bot = c + (d - c) * fx;
        out[y * w + x] = top + (bot - top) * fy;
      }
    }
    return out;
  };

})(window.Game);
