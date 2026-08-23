/* What a building would actually be worth on *this* tile.
 *
 * The town already runs on locality: the haul to the nearest depot, the trees
 * within reach of a woodcutter, low well-watered ground under a field, wind
 * on a rise for a mill, and how many homes a chapel can comfort. All of it
 * was readable afterwards — in the panel of a building already standing, or
 * in a map overlay — but never at the one moment it is a decision.
 *
 * So this answers the question at the cursor. Every number here is read
 * straight out of the modules that run the simulation (logistiek, buurt,
 * economy, map), never re-derived, so a preview can never promise something
 * the economy will not pay out.
 *
 * Returns a short list of { emoji, tekst, soort } where soort is
 * 'goed' / 'matig' / 'slecht' / '' — the caller decides how to draw it.
 */
(function (Game) {

  var P = {};

  function pct(f) { return Math.round(f * 100) + '%'; }

  function duur(minuten) {
    if (minuten < 1) return 'nog geen minuut';
    if (minuten < 90) return '~' + Math.round(minuten) + ' min';
    return 'ruim ' + Math.floor(minuten / 60) + ' uur';
  }

  /* The tile a building of this size is centred on. */
  function midden(def, x, y) {
    var m = (def.grootte - 1) / 2;
    return { x: x + m, y: y + m };
  }

  P.verwachting = function (s, def, x, y) {
    var uit = [];
    if (!s || !def) return uit;
    var mid = midden(def, x, y);

    /* --- the haul home ------------------------------------------------- */
    if (def.wint || def.maakt) {
      var f = Game.core.logistiek.factorOpTegel(s, mid.x, mid.y);
      uit.push({
        emoji: '🚚',
        tekst: 'Aanvoer ' + pct(f) + (f >= 0.999 ? ' — vlak bij je opslag'
          : f < 0.8 ? ' — ver van je opslag, leg een straat of zet een schuur dichterbij' : ''),
        soort: f >= 0.999 ? 'goed' : (f < 0.8 ? 'slecht' : 'matig')
      });
    }

    /* --- what it digs out of the ground -------------------------------- */
    if (def.wint) {
      var w = def.wint;
      var voorraad = Game.core.map.nodeInBereik(s.kaart, x, y, w.node, w.straal);
      var naam = Game.core.map.nodeNaam[w.node] || w.node;
      if (voorraad >= Game.core.map.ONEINDIG) {
        uit.push({ emoji: '♾️', tekst: naam + ' in bereik: onuitputtelijk', soort: 'goed' });
      } else {
        /* Roughly how long a full crew can keep going here, at the building's
           own rate — the same tempo the tooltip quotes. */
        var perMin = w.tempo * (def.banen ? def.banen.aantal : 1) * 60;
        var minuten = perMin > 0 ? voorraad / perMin : 0;
        /* The raw stock in the ground says nothing — "13050" is not a
           decision. How long a full crew can keep working here is. */
        uit.push({
          emoji: voorraad > 0 ? '⛏️' : '🚫',
          tekst: voorraad <= 0
            ? 'Geen ' + naam.toLowerCase() + ' binnen ' + w.straal + ' tegels'
            : naam + ' in bereik: ' + duur(minuten) + ' werk voor een volle ploeg',
          soort: voorraad <= 0 ? 'slecht' : (minuten < 8 ? 'matig' : 'goed')
        });
      }
    }

    /* --- fields, mills and harbours ------------------------------------ */
    if (Game.core.economy.isAkker(def)) {
      var water = Game.core.buurt.bijWater(s, mid.x, mid.y, 5);
      var helling = Game.core.buurt.relief(s, mid.x, mid.y);
      var akker = Game.core.economy.akkerBonus(s, { x: x, y: y }, def);
      uit.push({
        emoji: water ? '💧' : '🏜️',
        tekst: 'Grond ' + pct(akker) + ' — ' +
          (water ? 'water in de buurt' : 'geen water in de buurt') +
          (helling > 0.5 ? ', hoog en droog' : ''),
        soort: akker >= 1.1 ? 'goed' : (akker < 0.95 ? 'slecht' : 'matig')
      });
    }
    if (def.boerderijBonus) {
      var wind = Game.core.buurt.relief(s, mid.x, mid.y);
      uit.push({
        emoji: '🌬️',
        tekst: 'Wind ' + pct(1 + 0.5 * wind) + ' — ' +
          (wind > 0.55 ? 'mooi hoog' : wind < 0.25 ? 'laag; hoger vangt meer wind' : 'redelijk'),
        soort: wind > 0.55 ? 'goed' : (wind < 0.25 ? 'matig' : '')
      });
      uit.push({ emoji: '🌾', tekst: 'Akkers in bereik: ' +
        telGebouwen(s, def.boerderijStraal, mid, Game.core.economy.isAkker), soort: '' });
    }
    if (def.visserijBonus) {
      uit.push({ emoji: '🎣', tekst: 'Vissershutten in bereik: ' +
        telGebouwen(s, def.visserijStraal, mid, function (d) { return d.id === 'vissershut'; }), soort: '' });
    }

    /* --- services: who can actually walk to it -------------------------- */
    if (def.tevredenheid && def.bereik) {
      var bereikt = huizenInBereik(s, mid, def.bereik * bereikFactor(s));
      uit.push({
        emoji: '🏠',
        tekst: 'Bereikt ' + bereikt.huizen + ' ' + (bereikt.huizen === 1 ? 'huis' : 'huizen') +
          ' (' + bereikt.plekken + ' bewoners)',
        soort: bereikt.huizen === 0 ? 'slecht' : (bereikt.huizen < 3 ? 'matig' : 'goed')
      });
    }

    /* --- houses: is this a nice place to live? -------------------------- */
    if (def.woonruimte) {
      var diensten = Game.core.buurt.dienstenOp(s, mid.x, mid.y) / Game.core.buurt.VOLLEDIG;
      uit.push({
        emoji: '⛪',
        tekst: 'Voorzieningen hier: ' + pct(Game.util.clamp(diensten, 0, 1)),
        soort: diensten >= 0.7 ? 'goed' : (diensten < 0.3 ? 'slecht' : 'matig')
      });
    }
    if (def.woonruimte || def.tevredenheid) {
      var sfeer = Game.core.buurt.aantrekkelijkOp(s, mid.x, mid.y);
      uit.push({
        emoji: sfeer >= 0 ? '🌳' : '🏭',
        tekst: 'Aantrekkelijkheid: ' + (sfeer >= 0 ? '+' : '') + Math.round(sfeer),
        soort: sfeer >= 6 ? 'goed' : (sfeer < 0 ? 'slecht' : 'matig')
      });
    }

    /* --- walls and towers: do they cover anything? ---------------------- */
    if (def.verdediging || def.verdPerWerker) {
      var kracht = (def.verdediging || 0) +
        (def.verdPerWerker && def.banen ? def.verdPerWerker * def.banen.aantal : 0);
      uit.push({ emoji: '🛡️', tekst: 'Verdediging +' + kracht +
        (def.verdPerWerker ? ' (volledig bemand)' : ''), soort: '' });
    }

    return uit;
  };

  function bereikFactor(s) {
    var z = Game.config.moeilijkheid(s.moeilijkheid);
    return z.bereik || 1;
  }

  function telGebouwen(s, straal, mid, test) {
    var n = 0;
    for (var i = 0; i < s.gebouwen.length; i++) {
      var g = s.gebouwen[i];
      var d = Game.core.state.def(g);
      if (!test(d)) continue;
      var dx = g.x - mid.x, dy = g.y - mid.y;
      if (dx * dx + dy * dy <= straal * straal) n++;
    }
    return n;
  }

  function huizenInBereik(s, mid, straal) {
    var bronnen = Game.core.buurt.bronnen(s);
    var huizen = 0, plekken = 0;
    for (var i = 0; i < bronnen.huizen.length; i++) {
      var h = bronnen.huizen[i];
      var dx = h.x - mid.x, dy = h.y - mid.y;
      if (dx * dx + dy * dy > straal * straal) continue;
      huizen++;
      plekken += h.plekken;
    }
    return { huizen: huizen, plekken: plekken };
  }

  Game.core.plek = P;

})(window.Game);
