/* Configuration self-check. Runs once at start-up and shouts in the console
   if the game data contradicts itself — a cheap safety net while we keep
   adding buildings. */
(function (Game) {

  function controleer() {
    var fouten = [];
    var res = Game.config.resources;
    var ids = {};

    Game.config.buildingList.forEach(function (d) {
      if (ids[d.id]) fouten.push('Dubbel gebouw-id: ' + d.id);
      ids[d.id] = true;

      if (!d.naam || !d.emoji) fouten.push(d.id + ': naam of emoji ontbreekt');
      if (typeof d.tijdperk !== 'number' || d.tijdperk < 0 || d.tijdperk > 4) {
        fouten.push(d.id + ': ongeldig tijdperk ' + d.tijdperk);
      }
      if (!d.beschrijving) fouten.push(d.id + ': geen beschrijving');

      controleerResources(fouten, d.id + '.kosten', d.kosten, res);
      controleerResources(fouten, d.id + '.onderhoud', d.onderhoud, res);
      if (d.maakt) {
        controleerResources(fouten, d.id + '.maakt.in', d.maakt.in, res);
        controleerResources(fouten, d.id + '.maakt.uit', d.maakt.uit, res);
      }
      if (d.wint) {
        if (!res[d.wint.res]) fouten.push(d.id + ': wint onbekende grondstof ' + d.wint.res);
        if (!Game.core.map.nodeNaam[d.wint.node]) fouten.push(d.id + ': onbekende node ' + d.wint.node);
        if (!d.banen) fouten.push(d.id + ': wint iets maar heeft geen werkers');
      }
      if (d.plaats && d.plaats.nabij && !Game.core.map.nodeNaam[d.plaats.nabij.node]) {
        fouten.push(d.id + ': plaatsingseis met onbekende node');
      }
      if (d.banen && !Game.config.jobs[d.banen.baan]) {
        fouten.push(d.id + ': onbekende baan ' + d.banen.baan);
      }
    });

    /* Every age requirement must be reachable with what is unlocked by then. */
    Game.config.ages.forEach(function (age) {
      if (!age.eisen) return;
      for (var b in (age.eisen.gebouwen || {})) {
        var def = Game.config.gebouw(b);
        if (!def) { fouten.push('Tijdperk ' + age.nr + ' eist onbekend gebouw ' + b); continue; }
        if (def.tijdperk >= age.nr) {
          fouten.push('Tijdperk ' + age.nr + ' eist ' + b + ', maar dat ontgrendelt pas in tijdperk ' + def.tijdperk);
        }
      }
      for (var r in (age.eisen.verzameld || {})) {
        if (!res[r]) { fouten.push('Tijdperk ' + age.nr + ' eist onbekende grondstof ' + r); continue; }
        if (!bronBestaatVoor(r, age.nr - 1)) {
          fouten.push('Tijdperk ' + age.nr + ' eist ' + r + ', maar daar is nog geen bron voor');
        }
      }
      controleerResources(fouten, 'tijdperk ' + age.nr + '.kosten', age.kosten, res);
    });

    /* Every resource needs at least one producer somewhere in the game. */
    Game.config.resourceOrder.forEach(function (r) {
      if (!bronBestaatVoor(r, 4)) fouten.push('Geen enkel gebouw produceert ' + r);
    });

    if (fouten.length) {
      console.error('⚠️ Configuratiefouten in Dorp tot Stad:\n' + fouten.join('\n'));
    } else {
      console.log('✅ Speldata gecontroleerd: ' +
        Game.config.buildingList.length + ' gebouwen, ' +
        Game.config.resourceOrder.length + ' grondstoffen, alles klopt.');
    }
    return fouten;
  }

  function controleerResources(fouten, waar, obj, res) {
    for (var r in (obj || {})) {
      if (!res[r]) fouten.push(waar + ': onbekende grondstof ' + r);
      if (typeof obj[r] !== 'number' || obj[r] < 0) fouten.push(waar + ': ongeldige hoeveelheid voor ' + r);
    }
  }

  function bronBestaatVoor(resource, totTijdperk) {
    return Game.config.buildingList.some(function (d) {
      if (d.tijdperk > totTijdperk) return false;
      if (d.wint && d.wint.res === resource) return true;
      if (d.maakt && d.maakt.uit && d.maakt.uit[resource]) return true;
      return false;
    });
  }

  Game.devcheck = controleer;
  window.addEventListener('DOMContentLoaded', function () { controleer(); });

})(window.Game);
