/* Camera: pan, zoom and the conversions between screen and world.
 *
 * The world is a plain square grid in *world pixels* (tileX * TEGEL). What makes
 * the game isometric lives entirely here: wereldNaarScherm / schermNaarWereld
 * apply a 2:1 diamond projection to those world pixels, so every caller that
 * positions itself through the camera (terrain, roads, walkers, raiders,
 * particles, buildings) tilts into the iso view for free. Game.state never sees
 * any of this — it stays a pure square grid, so saves stay pure JSON. */
(function (Game) {

  var TEGEL = 34;   /* base pixels per tile at zoom 1 (= diamond width) */

  /* Iso projection of a world-pixel point into an unzoomed "iso space".
     A tile (TEGEL wide in world x and y) becomes a diamond that is TEGEL wide
     and TEGEL/2 tall — the classic 2:1 look. */
  function isoX(wx, wy) { return (wx - wy) * 0.5; }
  function isoY(wx, wy) { return (wx + wy) * 0.25; }

  /* Inverse of the pair above: iso-space back to world pixels.
     wx - wy = 2*ix ; wx + wy = 4*iy  →  wx = ix + 2*iy ; wy = 2*iy - ix. */
  function wereldX(ix, iy) { return ix + 2 * iy; }
  function wereldY(ix, iy) { return 2 * iy - ix; }

  function Camera() {
    this.x = 0;          /* world pixel at the centre of the view */
    this.y = 0;
    this.zoom = 1;
    this.breedte = 1;
    this.hoogte = 1;
    /* Damping (fase 8.4): pan glides on after a fling, and zoom eases toward a
       target rather than snapping. */
    this.velX = 0;
    this.velY = 0;
    this.doelZoom = 1;
    this.zoomSx = 0;
    this.zoomSy = 0;
  }

  Camera.prototype.TEGEL = TEGEL;

  Camera.prototype.stelIn = function (b, h) { this.breedte = b; this.hoogte = h; };

  Camera.prototype.px = function () { return TEGEL * this.zoom; };

  Camera.prototype.wereldNaarScherm = function (wx, wy) {
    var cx = isoX(this.x, this.y), cy = isoY(this.x, this.y);
    return {
      x: (isoX(wx, wy) - cx) * this.zoom + this.breedte / 2,
      y: (isoY(wx, wy) - cy) * this.zoom + this.hoogte / 2
    };
  };

  Camera.prototype.schermNaarWereld = function (sx, sy) {
    var cx = isoX(this.x, this.y), cy = isoY(this.x, this.y);
    var ix = (sx - this.breedte / 2) / this.zoom + cx;
    var iy = (sy - this.hoogte / 2) / this.zoom + cy;
    return { x: wereldX(ix, iy), y: wereldY(ix, iy) };
  };

  Camera.prototype.tegelOnder = function (sx, sy) {
    var w = this.schermNaarWereld(sx, sy);
    return { x: Math.floor(w.x / TEGEL), y: Math.floor(w.y / TEGEL) };
  };

  Camera.prototype.centreerOpTegel = function (tx, ty) {
    this.x = (tx + 0.5) * TEGEL;
    this.y = (ty + 0.5) * TEGEL;
  };

  /* Move the view by a *screen-space* delta (mouse drag, keyboard pan). The
     delta is un-projected into world pixels so dragging feels 1:1 on screen. */
  Camera.prototype.beweeg = function (dx, dy) {
    var d = this.wereldDelta(dx, dy);
    this.x += d.x;
    this.y += d.y;
  };

  /* Screen-space delta → world-pixel delta, for both panning and for turning a
     drag into a fling velocity. */
  Camera.prototype.wereldDelta = function (dx, dy) {
    var ix = dx / this.zoom, iy = dy / this.zoom;
    return { x: wereldX(ix, iy), y: wereldY(ix, iy) };
  };

  /* Let go of a drag with a world-pixel velocity, so the view glides to a stop
     instead of stopping dead. */
  Camera.prototype.glij = function (vx, vy) {
    this.velX = vx;
    this.velY = vy;
  };

  Camera.prototype.stopGlij = function () { this.velX = 0; this.velY = 0; };

  /* Aim the zoom at a target level, keeping the point under (sx, sy) fixed. The
     actual zoom eases toward it in demp(). */
  Camera.prototype.zoomOp = function (sx, sy, richting) {
    this.doelZoom = Game.util.clamp((this.doelZoom || this.zoom) * (richting > 0 ? 1.18 : 1 / 1.18),
                                    this.minZoom(), 2.6);
    this.zoomSx = sx;
    this.zoomSy = sy;
  };

  /* Real-time damping: apply the pan glide and ease the zoom toward its target,
     both frame-rate independent. Called from the main loop. */
  Camera.prototype.demp = function (dt) {
    if (dt <= 0) return;
    /* Pan inertia, decaying exponentially. */
    if (Math.abs(this.velX) > 1 || Math.abs(this.velY) > 1) {
      this.x += this.velX * dt;
      this.y += this.velY * dt;
      var afname = Math.exp(-7 * dt);
      this.velX *= afname;
      this.velY *= afname;
    } else { this.velX = this.velY = 0; }

    /* Smooth zoom toward the target, holding the focus point steady. */
    if (this.doelZoom && Math.abs(this.doelZoom - this.zoom) > 0.0005) {
      var voor = this.schermNaarWereld(this.zoomSx, this.zoomSy);
      var t = 1 - Math.exp(-16 * dt);
      this.zoom += (this.doelZoom - this.zoom) * t;
      var na = this.schermNaarWereld(this.zoomSx, this.zoomSy);
      this.x += voor.x - na.x;
      this.y += voor.y - na.y;
    }
  };

  /* How far out you may zoom: exactly far enough that the whole map fits on
     screen, and not a step further.
   *
     The map is a diamond in iso space, (b+h)*TEGEL*0.5 wide and half that tall.
     Once it fits inside the viewport you have already seen everything there is
     to see; zooming out past that only shrinks the town and fills the screen
     with empty water, which is what made the map read as a raft on a backdrop.
     So this never withholds a view — it withholds the *pointless* part of the
     range. It scales with the map, so a small map stops sooner than a big one,
     and it is clamped so a very large map or a very small window can never
     make the floor sillier than the old fixed one. */
  Camera.prototype.minZoom = function () {
    if (!this.kaartB || !this.breedte) return 0.4;
    var iso = (this.kaartB + this.kaartH) * TEGEL;
    var past = Math.min(2 * this.breedte, 4 * this.hoogte) / iso;
    return Game.util.clamp(past / 1.06, 0.28, 1.6);
  };

  /* Keeps the view roughly over the map instead of drifting into the void. */
  Camera.prototype.begrens = function (kaart) {
    this.kaartB = kaart.b;
    this.kaartH = kaart.h;
    var marge = 6 * TEGEL;
    this.x = Game.util.clamp(this.x, -marge, kaart.b * TEGEL + marge);
    this.y = Game.util.clamp(this.y, -marge, kaart.h * TEGEL + marge);

    /* Also the place the zoom floor is enforced: begrens runs every frame, so
       a resize or a freshly loaded map corrects itself without anyone having
       to remember to ask. */
    var min = this.minZoom();
    if (this.doelZoom < min) this.doelZoom = min;
    if (this.zoom < min) this.zoom = min;
  };

  /* Tile range that is currently visible. In iso the screen rectangle maps to a
     rotated diamond in tile space, so we take the axis-aligned bounding box of
     all four screen corners and pad generously — extra on top, where tall
     buildings and mountains rise up out of tiles that are technically off the
     top edge. Over-drawing a rim of tiles is cheap; clipping a spire is not. */
  Camera.prototype.zichtbaar = function (kaart) {
    var hoeken = [
      this.schermNaarWereld(0, 0),
      this.schermNaarWereld(this.breedte, 0),
      this.schermNaarWereld(0, this.hoogte),
      this.schermNaarWereld(this.breedte, this.hoogte)
    ];
    var minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    for (var i = 0; i < 4; i++) {
      minx = Math.min(minx, hoeken[i].x); maxx = Math.max(maxx, hoeken[i].x);
      miny = Math.min(miny, hoeken[i].y); maxy = Math.max(maxy, hoeken[i].y);
    }
    return {
      x0: Game.util.clamp(Math.floor(minx / TEGEL) - 2, 0, kaart.b - 1),
      y0: Game.util.clamp(Math.floor(miny / TEGEL) - 5, 0, kaart.h - 1),
      x1: Game.util.clamp(Math.ceil(maxx / TEGEL) + 2, 0, kaart.b),
      y1: Game.util.clamp(Math.ceil(maxy / TEGEL) + 2, 0, kaart.h)
    };
  };

  Game.render.Camera = Camera;
  Game.render.TEGEL = TEGEL;

  /* Shared iso-tile geometry: the four screen corners (and centre) of a tile
     whose *top* corner projects to (sx, sy) and whose on-screen width is p.
     Terrain fill, the placement grid cell, ghosts, selection and resource
     highlights all trace the same diamond through this. */
  Game.render.diamant = function (sx, sy, p) {
    var hw = p / 2, hh = p / 4;
    return {
      top:    { x: sx,      y: sy },
      right:  { x: sx + hw, y: sy + hh },
      bottom: { x: sx,      y: sy + hh * 2 },
      left:   { x: sx - hw, y: sy + hh },
      cx: sx, cy: sy + hh, hw: hw, hh: hh
    };
  };

  /* Trace a diamond onto ctx (does not fill/stroke — the caller decides). */
  Game.render.padDiamant = function (ctx, d) {
    ctx.beginPath();
    ctx.moveTo(d.top.x, d.top.y);
    ctx.lineTo(d.right.x, d.right.y);
    ctx.lineTo(d.bottom.x, d.bottom.y);
    ctx.lineTo(d.left.x, d.left.y);
    ctx.closePath();
  };

})(window.Game);
