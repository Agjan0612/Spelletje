/* The chronicle: your town's history, written back to you.
 *
 * Winning used to be a scoreboard. This turns everything the simulation has
 * quietly been recording — the log, the register, the raid tally, the
 * neighbours — into a few paragraphs of chronicle in the voice of a monk who
 * has been watching the whole time.
 *
 * Nothing is stored: it is generated from the state on demand, so it costs a
 * save exactly nothing and can be opened at any moment, not only at the end.
 */
(function (Game) {

  var K = {};

  var RANG_ZIN = {
    'Gehucht in de wildernis': 'een gehucht dat de wildernis nog altijd bijna opslokt',
    'Dorp met een naam': 'een dorp dat men in de omtrek bij naam kent',
    'Bloeiende handelsstad': 'een bloeiende handelsstad waar de wegen samenkomen',
    'Vrije stad met stadsrechten': 'een vrije stad met eigen rechten en een eigen zegel',
    'Parel van het rijk': 'een parel van het rijk, waarover men tot in verre gewesten spreekt'
  };

  function telwoord(n, enkel, meer) {
    return n + ' ' + (n === 1 ? enkel : meer);
  }

  /* Pick the log lines worth remembering: births and finished sheds are noise,
     famine and bandits are history. */
  function hoogtepunten(s) {
    var uit = [];
    var log = s.log || [];
    for (var i = log.length - 1; i >= 0 && uit.length < 6; i--) {
      var r = log[i];
      var t = (r.tekst || r.t || '') + '';
      if (!t) continue;
      if (/🏆|🔥|💀|👑|🏕️|🗡️|🥶|💰|🤝/.test(t)) uit.push(t);
    }
    return uit.reverse();
  }

  K.schrijf = function (s) {
    var st = Game.core.state.statistiek(s);
    var stukken = [];

    /* --- opening --- */
    stukken.push({
      kop: 'De stichting',
      tekst: 'In het eerste jaar werd ' + s.dorpsnaam + ' gesticht door vijf zielen met een ploeg, ' +
        'een dak en meer moed dan verstand. Nu schrijven wij jaar ' + s.jaar + '. ' +
        'Wat begon in de wildernis is ' + (RANG_ZIN[st.rang] || 'een plaats van betekenis') + '.'
    });

    /* --- the people --- */
    var v = Game.core.demografie ? Game.core.demografie.verdeling(s) : null;
    var mensen = 'Er wonen ' + telwoord(st.bevolking, 'ziel', 'zielen') + ' binnen de grenzen';
    if (v && (v.kinderen || v.ouderen)) {
      mensen += ', waaronder ' + telwoord(v.kinderen, 'kind', 'kinderen') +
        ' en ' + telwoord(v.ouderen, 'oude van dagen', 'ouden van dagen');
    }
    mensen += '. Zij bewonen ' + telwoord(st.gebouwen, 'bouwwerk', 'bouwwerken') +
      ', en hun stemming is ' +
      (st.tevredenheid >= 75 ? 'uitgelaten' : st.tevredenheid >= 55 ? 'goed' :
       st.tevredenheid >= 35 ? 'gelaten' : 'somber') + '.';
    stukken.push({ kop: 'Het volk', tekst: mensen });

    /* --- the wars --- */
    if (st.rooftochten > 0) {
      var oorlog = 'Er zijn ' + telwoord(st.rooftochten, 'roversbende', 'roversbenden') +
        ' voor onze muren verschenen.';
      if (s.leger && s.leger.overwinningen > 0) {
        oorlog += ' ' + telwoord(s.leger.overwinningen, 'maal', 'maal') +
          ' werd er een beslissend verslagen.';
      }
      if (s.rovers && s.rovers.naam) {
        oorlog += ' Het is nu ' + s.rovers.naam + ' die daarbuiten op ons wacht';
        if (s.rovers.schattingen > 0) {
          oorlog += ', en hij weet — want wij hebben ' +
            telwoord(s.rovers.schattingen, 'maal', 'maal') + ' betaald — dat hier geld ligt';
        }
        oorlog += '.';
      }
      stukken.push({ kop: 'De rovers', tekst: oorlog });
    }

    /* --- trade and neighbours --- */
    if (s.buren && s.buren.length) {
      var routes = s.buren.filter(function (b) { return b.route; });
      var vrienden = s.buren.slice().sort(function (a, b) { return b.reputatie - a.reputatie; })[0];
      var handel = routes.length
        ? 'Onze karren rijden naar ' + routes.map(function (b) { return b.naam; }).join(' en ') + '.'
        : 'Wij hebben nog naar geen enkele stad een vaste route geopend.';
      if (vrienden) {
        handel += ' Van alle buren staan wij het best aangeschreven bij ' + vrienden.naam +
          ' (' + Math.round(vrienden.reputatie) + ' van 100).';
      }
      stukken.push({ kop: 'De buren', tekst: handel });
    }

    /* --- what was learned and built --- */
    var werk = 'Onze ambachtslieden hebben ' + Math.round(st.verzameld).toLocaleString('nl-NL') +
      ' eenheden goed uit dit land gehaald';
    if (st.onderzoek) werk += ' en ' + telwoord(st.onderzoek, 'studie', 'studies') + ' voltooid';
    if (st.opdrachten) werk += '; ' + telwoord(st.opdrachten, 'opdracht', 'opdrachten') +
      ' van de heer werd op tijd geleverd';
    werk += '.';
    stukken.push({ kop: 'Het werk', tekst: werk });

    /* --- the things that actually happened --- */
    var punten = hoogtepunten(s);
    if (punten.length) stukken.push({ kop: 'Uit de kroniek', regels: punten });

    /* --- closing --- */
    stukken.push({
      kop: 'Slot',
      tekst: s.gewonnen
        ? 'En zo staat ' + s.dorpsnaam + ' voltooid: kathedraal, kasteel, universiteit en stadhuis, ' +
          'en een volk dat er graag woont. Moge het zo blijven.'
        : 'Het werk is niet af. Er is altijd een muur te zetten, een akker te ploegen, ' +
          'een winter te doorstaan. Zo gaat dat met steden.'
    });

    return { titel: 'De kroniek van ' + s.dorpsnaam, rang: st.rang, punten: st.punten, stukken: stukken };
  };

  /* Plain text, for the copy-to-clipboard button. */
  K.alsTekst = function (s) {
    var k = K.schrijf(s);
    var uit = [k.titel, '='.repeat(k.titel.length), ''];
    k.stukken.forEach(function (st) {
      uit.push(st.kop.toUpperCase());
      if (st.tekst) uit.push(st.tekst);
      if (st.regels) st.regels.forEach(function (r) { uit.push('  · ' + r); });
      uit.push('');
    });
    uit.push('Rang: ' + k.rang + ' (' + k.punten + ' punten)');
    return uit.join('\n');
  };

  Game.core.kroniek = K;

})(window.Game);
