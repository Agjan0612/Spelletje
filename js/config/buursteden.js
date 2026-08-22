/* The world beyond your walls.
 *
 * Until now the map edge was where the raiders came from and nothing else.
 * These are the towns on the other side of it: places you trade with, help
 * through a bad winter, and build a reputation with.
 *
 * A trade route is what late-game coins are *for* besides research — an
 * investment that pays a little every season, and that can be cut off.
 */
(function (Game) {

  Game.config.buurstadNamen = [
    'Aldenhoven', 'Rijnsburcht', 'Zwartewaal', 'Sint-Odulf', 'Maarnstede',
    'Groenewoud', 'Koudekerke', 'Hertogenbaan', 'Vlierdam', 'Ravensteijn',
    'Bruggenveen', 'Sint-Marten'
  ];

  /* What a neighbour is known for. A route to them brings that in — and they
     pay well for what they cannot make themselves. */
  Game.config.buurstadSoorten = [
    { id: 'wol',    naam: 'wolstad',      emoji: '🐑', levert: 'wol',         vraagt: 'brood' },
    { id: 'zout',   naam: 'zoutstad',     emoji: '🧂', levert: 'vlees',       vraagt: 'hout' },
    { id: 'erts',   naam: 'mijnstad',     emoji: '⛏️', levert: 'ijzer',       vraagt: 'graan' },
    { id: 'koper',  naam: 'kopersmeden',  emoji: '🟠', levert: 'koper',       vraagt: 'bier' },
    { id: 'hout',   naam: 'houtstad',     emoji: '🌲', levert: 'hout',        vraagt: 'kleding' },
    { id: 'gilde',  naam: 'gildestad',    emoji: '🔨', levert: 'gereedschap', vraagt: 'steen' }
  ];

  Game.config.buren = {
    aantal: 3,

    /* Opening a route: a wagon, an escort and a purse. */
    routeKosten: { munten: 220, hout: 90 },
    routeTijdperk: 3,

    /* What a running route brings in per second, before reputation. */
    routeOpbrengst: 0.16,       /* units of their speciality */
    routeMunten: 0.10,
    /* Reputation swings that between half and one and a half. */
    reputatieInvloed: 0.5,

    /* A route pays for what it hauls away from you. */
    routeVraagt: 0.09,

    /* Neighbours ask for help now and then; helping is the main way to earn
       standing, refusing is free but remembered. */
    verzoekRust: [420, 700],
    verzoekDuur: 260,
    verzoekReputatie: 14,
    weigerReputatie: -6,

    /* Raiders on the road cut a route for a while. */
    onderbrekingNaRoof: 180
  };

})(window.Game);
