/* Camera: pan, zoom and the conversions between screen and world. */
(function (Game) {

  var TEGEL = 34;   /* base pixels per tile at zoom 1 */

  function Camera() {
    this.x = 0;          /* world pixel at the centre of the view */
    this.y = 0;
    this.zoom = 1;
    this.breedte = 1;
    this.hoogte = 1;
  }

  Camera.prototype.TEGEL = TEGEL;

  Camera.prototype.stelIn = function (b, h) { this.breedte = b; this.hoogte = h; };

  Camera.prototype.px = function () { return TEGEL * this.zoom; };

  Camera.prototype.wereldNaarScherm = function (wx, wy) {
    return {
      x: (wx - this.x) * this.zoom + this.breedte / 2,
      y: (wy - this.y) * this.zoom + this.hoogte / 2
    };
  };

  Camera.prototype.schermNaarWereld = function (sx, sy) {
    return {
      x: (sx - this.breedte / 2) / this.zoom + this.x,
      y: (sy - this.hoogte / 2) / this.zoom + this.y
    };
  };

  Camera.prototype.tegelOnder = function (sx, sy) {
    var w = this.schermNaarWereld(sx, sy);
    return { x: Math.floor(w.x / TEGEL), y: Math.floor(w.y / TEGEL) };
  };

  Camera.prototype.centreerOpTegel = function (tx, ty) {
    this.x = (tx + 0.5) * TEGEL;
    this.y = (ty + 0.5) * TEGEL;
  };

  Camera.prototype.beweeg = function (dx, dy) {
    this.x += dx / this.zoom;
    this.y += dy / this.zoom;
  };

  Camera.prototype.zoomOp = function (sx, sy, richting) {
    var voor = this.schermNaarWereld(sx, sy);
    this.zoom = Game.util.clamp(this.zoom * (richting > 0 ? 1.15 : 1 / 1.15), 0.4, 2.6);
    var na = this.schermNaarWereld(sx, sy);
    this.x += voor.x - na.x;
    this.y += voor.y - na.y;
  };

  /* Keeps the view roughly over the map instead of drifting into the void. */
  Camera.prototype.begrens = function (kaart) {
    var marge = 6 * TEGEL;
    this.x = Game.util.clamp(this.x, -marge, kaart.b * TEGEL + marge);
    this.y = Game.util.clamp(this.y, -marge, kaart.h * TEGEL + marge);
  };

  /* Tile range that is currently visible, with a one tile margin. */
  Camera.prototype.zichtbaar = function (kaart) {
    var lb = this.schermNaarWereld(0, 0);
    var ro = this.schermNaarWereld(this.breedte, this.hoogte);
    return {
      x0: Game.util.clamp(Math.floor(lb.x / TEGEL) - 1, 0, kaart.b - 1),
      y0: Game.util.clamp(Math.floor(lb.y / TEGEL) - 1, 0, kaart.h - 1),
      x1: Game.util.clamp(Math.ceil(ro.x / TEGEL) + 1, 0, kaart.b),
      y1: Game.util.clamp(Math.ceil(ro.y / TEGEL) + 1, 0, kaart.h)
    };
  };

  Game.render.Camera = Camera;
  Game.render.TEGEL = TEGEL;

})(window.Game);
