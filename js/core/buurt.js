/* The neighbourhood: what a given spot in town has within walking distance.
 *
 * This is what makes *where* you build matter. Two things are read off the
 * map here, both derived and never stored in state:
 *
 *   diensten          service points a home can reach (well, chapel, tavern…)
 *   aantrekkelijkheid how pleasant the spot is — a fountain lifts it, a
 *                     smithy or a quarry drags it down
 *
 * Happiness used to be one town-wide total, which meant a chapel in the far
 * corner of the map counted exactly as much as one on the square. Now every
 * house looks around itself, and the town's score is the average over its
 * homes, weighted by how many people live in them.
 *
 * Nothing is cached in `s`: the building list is cached on a signature, the
 * same trick paths.js and panel.js use, so this only rebuilds when something
 * actually moved.
 */
(function (Game) {

  var B = {};

  /* Local service points that make a home fully content. Roughly: a well, a
     chapel and a tavern within reach, or a church plus a market. */
  B.VOLLEDIG = 30;

  var cache = { handtekening: '', diensten: [], sfeer: [], huizen: [], dekking: null };

  /* Buildings change far less often than workers do, so key the cache on the
     things that actually move the neighbourhood around. */
  function handtekening(s) {
    var d = '';
    for (var i = 0; i < s.gebouwen.length; i++) {
      var g = s.gebouwen[i];
      if (!g.gebouwd) continue;
      d += g.id + ':' + g.type + ':' + g.x + ',' + g.y + (g.uit ? 'x' : '') + ';';
    }
    return d + '|' + (s.moeilijkheid || 'normaal');
  }

  /* How far services carry, per difficulty: a quiet game forgives a sprawling
     town, a tough one makes you build compactly. */
  function bereikFactor(s) {
    var z = Game.config.moeilijkheid(s.moeilijkheid);
    return z.bereik || 1;
  }

  B.ververs = function (s) {
    var h = handtekening(s);
    if (h === cache.handtekening) return;
    cache.handtekening = h;
    cache.dekking = null;

    var f = bereikFactor(s);
    var diensten = [], sfeer = [], huizen = [];

    for (var i = 0; i < s.gebouwen.length; i++) {
      var g = s.gebouwen[i];
      if (!g.gebouwd) continue;
      var d = Game.config.gebouw(g.type);
      var mx = g.x + (d.grootte - 1) / 2, my = g.y + (d.grootte - 1) / 2;

      if (d.tevredenheid && d.bereik && !g.uit) {
        diensten.push({ type: g.type, punten: d.tevredenheid, straal: d.bereik * f, x: mx, y: my });
      }
      if (d.aantrekkelijkheid) {
        sfeer.push({
          waarde: d.aantrekkelijkheid,
          straal: (d.sfeerStraal || 6) * (d.aantrekkelijkheid > 0 ? f : 1),
          x: mx, y: my
        });
      }
      if (d.woonruimte) huizen.push({ x: mx, y: my, plekken: d.woonruimte });
    }

    cache.diensten = diensten;
    cache.sfeer = sfeer;
    cache.huizen = huizen;
  };

  /* Service points reachable from one tile. Extra copies of the same kind of
     building give diminishing returns, exactly like the old town-wide total
     did — a second chapel next door is worth much less than the first. */
  B.dienstenOp = function (s, x, y) {
    B.ververs(s);
    var perType = {};
    for (var i = 0; i < cache.diensten.length; i++) {
      var d = cache.diensten[i];
      var dx = d.x - x, dy = d.y - y;
      if (dx * dx + dy * dy > d.straal * d.straal) continue;
      perType[d.type] = (perType[d.type] || 0) + 1;
    }
    var punten = 0;
    for (var t in perType) {
      punten += Game.config.gebouw(t).tevredenheid * Math.sqrt(perType[t]);
    }
    return punten;
  };

  /* Desirability at one tile: every source fades linearly with distance, so
     the overlay reads as a soft gradient instead of hard circles. */
  B.aantrekkelijkOp = function (s, x, y) {
    B.ververs(s);
    var totaal = 0;
    for (var i = 0; i < cache.sfeer.length; i++) {
      var b = cache.sfeer[i];
      var dx = b.x - x, dy = b.y - y;
      var afstand = Math.sqrt(dx * dx + dy * dy);
      if (afstand > b.straal) continue;
      totaal += b.waarde * (1 - afstand / b.straal);
    }
    return totaal;
  };

  /* The town-wide picture, averaged over the homes and weighted by how many
     people each one holds. A village with no houses yet falls back to the
     town square, so the opening minutes still read sensibly. */
  B.dekking = function (s) {
    B.ververs(s);
    if (cache.dekking) return cache.dekking;

    var huizen = cache.huizen;
    var uit;

    if (!huizen.length) {
      var plein = null;
      for (var i = 0; i < s.gebouwen.length; i++) {
        if (s.gebouwen[i].type === 'dorpsplein') { plein = s.gebouwen[i]; break; }
      }
      var px = plein ? plein.x + 1 : Math.floor(s.kaart.b / 2);
      var py = plein ? plein.y + 1 : Math.floor(s.kaart.h / 2);
      uit = {
        diensten: Game.util.clamp(B.dienstenOp(s, px, py) / B.VOLLEDIG, 0, 1),
        aantrekkelijkheid: B.aantrekkelijkOp(s, px, py),
        huizen: 0, slechtste: null
      };
      cache.dekking = uit;
      return uit;
    }

    var somGewicht = 0, somDienst = 0, somSfeer = 0;
    var slechtste = null, slechtsteWaarde = Infinity;

    for (var j = 0; j < huizen.length; j++) {
      var hz = huizen[j];
      var deel = Game.util.clamp(B.dienstenOp(s, hz.x, hz.y) / B.VOLLEDIG, 0, 1);
      somDienst += deel * hz.plekken;
      somSfeer += B.aantrekkelijkOp(s, hz.x, hz.y) * hz.plekken;
      somGewicht += hz.plekken;
      if (deel < slechtsteWaarde) { slechtsteWaarde = deel; slechtste = hz; }
    }

    uit = {
      diensten: somGewicht > 0 ? somDienst / somGewicht : 0,
      aantrekkelijkheid: somGewicht > 0 ? somSfeer / somGewicht : 0,
      huizen: huizen.length,
      slechtste: slechtste ? { x: slechtste.x, y: slechtste.y, deel: slechtsteWaarde } : null
    };
    cache.dekking = uit;
    return uit;
  };

  /* ------------------------------------------------------------- terrein --

     The height map was already generated for the hillshade; these two helpers
     let the simulation read it too. `relief` maps buildable ground (roughly
     0.35..0.60) onto a friendly 0..1. */
  B.relief = function (s, x, y) {
    var t = Game.core.map.tegel(s.kaart, Math.round(x), Math.round(y));
    if (!t) return 0;
    return Game.util.clamp(((t.h || 0) - 0.35) / 0.25, 0, 1);
  };

  /* Is there open water within `straal` tiles? Used for irrigated fields. */
  B.bijWater = function (s, x, y, straal) {
    var r = Math.ceil(straal);
    for (var dy = -r; dy <= r; dy++) {
      for (var dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > straal * straal) continue;
        var t = Game.core.map.tegel(s.kaart, Math.round(x) + dx, Math.round(y) + dy);
        if (t && t.t === 'water') return true;
      }
    }
    return false;
  };

  /* Let the overlay layer reuse the cached lists without rebuilding them. */
  B.bronnen = function (s) {
    B.ververs(s);
    return { diensten: cache.diensten, sfeer: cache.sfeer, huizen: cache.huizen };
  };

  Game.core.buurt = B;

})(window.Game);
