/* Getting the goods home.
 *
 * Until now everything a building produced appeared instantly in one global
 * pot, however far away it stood. That is why a woodcutter on the far rim of
 * the map performed exactly as well as one behind the square — and why the
 * little people walking the streets were pure decoration.
 *
 * Now every workplace hauls its output to the nearest storage building (the
 * town square, a barn, a warehouse). The further that haul, the more of the
 * day is spent walking instead of working. Paving the route with streets
 * shortens it again, which is what makes roads worth their tiles.
 *
 * Deliberately not a goods simulation: no carts to track, no queues, no
 * items in flight. One number per building, recomputed only when something
 * moved. A save stays plain JSON.
 */
(function (Game) {

  var L = {};

  /* Hauling distance in tiles: free up to VOL, sliding down to MIN at VER.
     The floor is generous on purpose — a badly placed mine is a bad decision,
     never a broken one, in the same spirit as the 0.75 production floor in
     economy.js. */
  L.VOL = 10;
  L.VER = 26;
  L.MIN = 0.5;

  /* A paved route carries a cart much better than a muddy track. This is the
     whole return on a street. */
  L.WEGWINST = 0.45;

  /* Water on the route is a detour, not a shortcut. A cart cannot ford a
     river, so every stretch of unbridged water between a workplace and its
     depot is walked around — and the way around is longer than the way
     across. Expressed as extra effective distance: a route that is entirely
     water would cost L.OMWEG times its own length on top.

     This is what makes the river in map.js a decision instead of scenery, and
     what makes a bridge worth its timber. A bridge tile carries `t.weg` like
     any street, so it both removes the detour and shortens what is left. */
  L.OMWEG = 2.2;

  var cache = { handtekening: '', depots: [], perGebouw: {} };

  function handtekening(s) {
    var d = '';
    for (var i = 0; i < s.gebouwen.length; i++) {
      var g = s.gebouwen[i];
      if (!g.gebouwd) continue;
      d += g.id + ':' + g.type + ':' + g.x + ',' + g.y + ';';
    }
    return d + '|w' + (s.wegTeller || 0);
  }

  /* Anything that holds stock is somewhere to deliver to. */
  L.isDepot = function (d) { return !!d.opslag; };

  L.ververs = function (s) {
    var h = handtekening(s);
    if (h === cache.handtekening) return;
    cache.handtekening = h;
    cache.perGebouw = {};

    var depots = [];
    for (var i = 0; i < s.gebouwen.length; i++) {
      var g = s.gebouwen[i];
      if (!g.gebouwd) continue;
      var d = Game.core.state.def(g);
      if (!L.isDepot(d)) continue;
      depots.push({ id: g.id, type: g.type, x: g.x + (d.grootte - 1) / 2, y: g.y + (d.grootte - 1) / 2 });
    }
    cache.depots = depots;
  };

  L.depots = function (s) { L.ververs(s); return cache.depots; };

  /* What the straight line between two points is made of: the share that runs
     over paved road, and the share that is water nobody has bridged.
     Sampling beats pathfinding here: it is cheap, it is stable, and it says
     something the player can act on — pave the route you actually use, and
     bridge the water it crosses.

     One pass answers both questions, because both are read on every tile when
     the aanvoer overlay rebuilds. */
  L.route = function (s, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay;
    var lengte = Math.sqrt(dx * dx + dy * dy);
    if (lengte < 1) return { lengte: lengte, weg: 1, water: 0 };
    /* Capped low on purpose: a dozen samples already tell paved from unpaved. */
    var stappen = Math.min(14, Math.max(2, Math.round(lengte)));
    var op = 0, nat = 0;
    for (var i = 0; i <= stappen; i++) {
      var t = i / stappen;
      var tegel = Game.core.map.tegel(s.kaart, Math.round(ax + dx * t), Math.round(ay + dy * t));
      if (!tegel) continue;
      if (tegel.weg) op++;
      /* A bridged tile is road, not water: it is exactly the tile the player
         paid to stop being an obstacle. */
      else if (tegel.t === 'water') nat++;
    }
    return { lengte: lengte, weg: op / (stappen + 1), water: nat / (stappen + 1) };
  };

  /* Kept as the old, narrower question — some callers only want the road. */
  L.wegDeel = function (s, ax, ay, bx, by) {
    return L.route(s, ax, ay, bx, by).weg;
  };

  /* Straight-line distance turned into what the cart actually walks: shorter
     over pavement, longer around water it cannot cross. */
  L.effectieveAfstand = function (s, ax, ay, bx, by) {
    var r = L.route(s, ax, ay, bx, by);
    return r.lengte * (1 - L.WEGWINST * r.weg + L.OMWEG * r.water);
  };

  /* The nearest depot to a point on the map, and the effective — that is,
     road-shortened — distance to it. Takes plain coordinates so the aanvoer
     overlay can ask the very same question about a bare tile. */
  L.depotVoorPunt = function (s, gx, gy) {
    L.ververs(s);
    var beste = null, besteAfstand = Infinity, besteRuw = Infinity;
    for (var i = 0; i < cache.depots.length; i++) {
      var dep = cache.depots[i];
      var ddx = dep.x - gx, ddy = dep.y - gy;
      var ruw = Math.sqrt(ddx * ddx + ddy * ddy);
      /* Even fully paved and bone dry, a further depot cannot beat this —
         skip the sampling. The water penalty only ever adds distance, so this
         bound stays safe. */
      if (ruw * (1 - L.WEGWINST) >= besteAfstand) continue;
      var effectief = L.effectieveAfstand(s, gx, gy, dep.x, dep.y);
      if (effectief < besteAfstand) { besteAfstand = effectief; beste = dep; besteRuw = ruw; }
    }
    return { depot: beste, afstand: besteAfstand, ruweAfstand: besteRuw };
  };

  /* Same question for an actual building, memoised per building id. */
  L.dichtstbijDepot = function (s, g) {
    L.ververs(s);
    if (cache.perGebouw[g.id]) return cache.perGebouw[g.id];
    var d = Game.core.state.def(g);
    var uit = L.depotVoorPunt(s, g.x + (d.grootte - 1) / 2, g.y + (d.grootte - 1) / 2);
    cache.perGebouw[g.id] = uit;
    return uit;
  };

  /* Turns a hauling distance into the share of the work that arrives. */
  L.factorVoorAfstand = function (afstand, erIsEenDepot) {
    if (!erIsEenDepot) return L.MIN;       /* nowhere to deliver at all */
    if (afstand <= L.VOL) return 1;
    if (afstand >= L.VER) return L.MIN;
    return 1 - ((afstand - L.VOL) / (L.VER - L.VOL)) * (1 - L.MIN);
  };

  /* How much of a day's work actually reaches the store. 1 = next door. */
  L.factor = function (s, g) {
    var d = Game.core.state.def(g);
    /* Only workplaces that ship something care about the haul. */
    if (!d.wint && !d.maakt) return 1;
    var bij = L.dichtstbijDepot(s, g);
    return L.factorVoorAfstand(bij.afstand, !!bij.depot);
  };

  /* What a workplace standing on this bare tile would bring home. Used by the
     aanvoer overlay, and deliberately routed through the same formula so the
     map can never drift away from what the economy does. */
  L.factorOpTegel = function (s, x, y) {
    var bij = L.depotVoorPunt(s, x, y);
    return L.factorVoorAfstand(bij.afstand, !!bij.depot);
  };

  /* Wording for the building panel and the warning line. */
  L.omschrijving = function (s, g) {
    var f = L.factor(s, g);
    var bij = L.dichtstbijDepot(s, g);
    if (!bij.depot) return { factor: f, tekst: 'Geen opslag om naartoe te brengen', slecht: true };
    if (f >= 0.999) return { factor: f, tekst: 'Vlak bij de opslag', slecht: false };

    /* Zeg wát er ver is. "Ver van de opslag" terwijl de opslag tien tegels
       verderop aan de andere oever ligt, is geen bruikbaar advies. */
    var d = Game.core.state.def(g);
    var route = L.route(s, g.x + (d.grootte - 1) / 2, g.y + (d.grootte - 1) / 2,
      bij.depot.x, bij.depot.y);
    if (route.water > 0.08) {
      return {
        factor: f,
        tekst: 'De karren moeten om het water heen — ' + Math.round(f * 100) +
          '% komt aan. Een brug scheelt veel.',
        slecht: f < 0.8
      };
    }
    return {
      factor: f,
      tekst: 'Ver van de opslag — ' + Math.round(f * 100) + '% komt aan',
      slecht: f < 0.8
    };
  };

  Game.core.logistiek = L;

})(window.Game);
