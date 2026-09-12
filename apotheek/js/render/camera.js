/* Camera — uitgeklede kopie van de iso-projectie uit het buurspel.
 *
 * Het pand is klein en moet in zijn geheel zichtbaar blijven: je speelt dit
 * spel op de doorstroom van de hele vloer, niet op één hoek ervan. Daarom geen
 * pannen en zoomen zoals in een city builder, maar één pasvorm die het pand in
 * beeld legt en zich aan het venster aanpast. Dat scheelt ook alle invoercode.
 *
 * De projectie zelf is ongewijzigd: wereldpixels door een 2:1 ruit. De
 * speltoestand blijft een gewoon vierkant rooster en weet van niets. */
(function (A) {

  var TEGEL = 44;

  function isoX(wx, wy) { return (wx - wy) * 0.5; }
  function isoY(wx, wy) { return (wx + wy) * 0.25; }

  function Camera() {
    this.zoom = 1;
    this.breedte = 1;
    this.hoogte = 1;
    this.offX = 0;
    this.offY = 0;
  }

  Camera.prototype.TEGEL = TEGEL;

  /* Legt het hele pand in beeld, met een marge zodat de randtegels niet tegen
     de zijkant plakken. */
  Camera.prototype.pas = function (pand, breedte, hoogte) {
    this.breedte = breedte;
    this.hoogte = hoogte;

    var w = pand.breed * TEGEL, d = pand.diep * TEGEL;
    var xs = [isoX(0, 0), isoX(w, 0), isoX(0, d), isoX(w, d)];
    var ys = [isoY(0, 0), isoY(w, 0), isoY(0, d), isoY(w, d)];
    var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
    var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);

    /* Extra ruimte bovenin: gebouwen steken boven hun grondvlak uit. */
    var marge = 46;
    this.zoom = Math.min(
      (breedte - marge * 2) / (maxX - minX),
      (hoogte - marge * 2 - 30) / (maxY - minY)
    );
    this.offX = breedte / 2 - (minX + maxX) / 2 * this.zoom;
    this.offY = hoogte / 2 - (minY + maxY) / 2 * this.zoom + 14;
  };

  /* Tegelcoördinaten (mogen gebroken zijn — personeel loopt tussen tegels in)
     naar schermpixels. Het midden van tegel (x,y) is (x+0.5, y+0.5). */
  Camera.prototype.naarScherm = function (tx, ty) {
    var wx = tx * TEGEL, wy = ty * TEGEL;
    return {
      x: isoX(wx, wy) * this.zoom + this.offX,
      y: isoY(wx, wy) * this.zoom + this.offY
    };
  };

  /* Halve ruit in pixels — elke tekening leunt hierop. */
  Camera.prototype.halfBreed = function () { return TEGEL * 0.5 * this.zoom; };
  Camera.prototype.halfHoog = function () { return TEGEL * 0.25 * this.zoom; };

  A.render.Camera = Camera;

})(window.Apotheek);
