/* Palet — één bron van waarheid voor de AoE2-kleuren.
 *
 * De renderlaag las z'n kleuren vroeger uit losse letterlijke hex-waarden
 * verspreid door pixi-renderer.js. Dit module bundelt ze zodat de hele
 * AoE2-stijl vanaf één plek te tunen is: terrein per seizoen, water-diepteramp,
 * dak- en muurmaterialen, en — nieuw — de spelerskleur (het blauw dat een stad
 * meteen "van jou" maakt, zoals in Age of Empires 2).
 *
 * Puur data + een paar kleur-helpers. Niets hier raakt Game.state; het is
 * render-only. Kleuren zijn getallen (0xrrggbb) zodat Pixi ze direct slikt. */
(function (Game) {

  var P = {};

  /* ---- kleur-helpers (getal-rgb) --------------------------------------- */

  P.hex = function (s) { return parseInt(s.slice(1), 16); };

  /* rgb * f, per kanaal geklemd op 0..255. */
  P.schaal = function (num, f) {
    var r = (num >> 16 & 255) * f, g = (num >> 8 & 255) * f, b = (num & 255) * f;
    r = r > 255 ? 255 : r < 0 ? 0 : r | 0;
    g = g > 255 ? 255 : g < 0 ? 0 : g | 0;
    b = b > 255 ? 255 : b < 0 ? 0 : b | 0;
    return (r << 16) | (g << 8) | b;
  };

  /* Meng twee rgb-getallen; t=0 → a, t=1 → b. */
  P.meng = function (a, b, t) {
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    var ar = a >> 16 & 255, ag = a >> 8 & 255, ab = a & 255;
    var br = b >> 16 & 255, bg = b >> 8 & 255, bb = b & 255;
    return ((ar + (br - ar) * t) | 0) << 16 | ((ag + (bg - ag) * t) | 0) << 8 | ((ab + (bb - ab) * t) | 0);
  };

  /* ---- terrein per seizoen (lente, zomer, herfst, winter) --------------
     Warmer en iets meer verzadigd dan de oude waarden — de geschilderde,
     zonovergoten grond van AoE2 leunt naar geelgroen en droge aarde. */
  P.terrein = {
    gras:       [0x6f9646, 0x74923c, 0x93923f, 0xc9cfc4],
    vruchtbaar: [0x8f7d3c, 0xa08636, 0xac8a33, 0xbfc0b0],
    bos:        [0x3f6033, 0x3a5c2c, 0x5c5f2a, 0x7f8c7a],
    rots:       [0x817d73, 0x817d73, 0x7d786d, 0x9d9d9a],
    berg:       [0x625d54, 0x625d54, 0x5e5850, 0x8d8d8d],
    water:      [0x3f6f8f, 0x42749a, 0x3c6a89, 0x4a6f85]
  };

  /* Water-diepte: ondiep (turquoise) → diep (donker blauwgroen). */
  P.waterOndiep = 0x8fd0c8;
  P.waterDiep = [0x27506b, 0x295473, 0x254a64, 0x2b4a5e];
  P.oeverschuim = 0xdcf3ee;
  P.strand = 0xd8c48a;

  /* Wegen en bruggen. */
  P.weg = 0xbfa878;      /* aangestampt zand */
  P.brug = 0xa9865b;     /* houten dek */

  /* Lucht (off-map). */
  P.lucht = 0x8fb3cf;

  /* ---- spelerskleur — het herkenbare AoE2-blauw ------------------------
     Vlaggen, banieren, daknok-accenten, deurlijsten en unit-tunieken dragen
     dit; het is wat een stad in één oogopslag "van jou" maakt. */
  P.speler = 0x2f57c8;
  P.spelerLicht = 0x5f83e0;
  P.spelerDonker = 0x1d3a94;

  /* ---- bladkleur bomen per seizoen ------------------------------------- */
  P.blad = [0x3f7233, 0x386a2b, 0x8a5f1e, 0x51624e];

  Game.render.palet = P;

})(window.Game);
