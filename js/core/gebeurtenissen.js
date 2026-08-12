/* Random events — small happenings that give the world some unpredictability
   beyond the raids. Each event is plain data (a condition, a message and an
   effect), the same shape as buildings, so the list is easy to extend. Events
   are deliberately non-modal: they never pause the game or force a popup, they
   just log, toast and apply a modest effect. The good outnumber the bad and
   the bad are gentle, so an event can never tip a village into famine. */
(function (Game) {

  var G = {};

  G.MIN = 180;               /* sim-seconds between events (min) */
  G.SPREIDING = 180;         /* extra random spread */

  function verlies(s, res, deel) {
    var weg = s.res[res] * deel;
    s.res[res] = Math.max(0, s.res[res] - weg);
    return Math.round(weg);
  }

  var EVENTS = [
    {
      id: 'bard',
      doe: function (s) {
        s.moreel = (s.moreel || 0) + 8;
        Game.ui.log.schrijf(s, '🎵 Een rondtrekkende bard speelt op het plein. De dorpelingen genieten.', 'goed');
        Game.ui.toast('🎵 Een bard bezoekt je dorp');
      }
    },
    {
      id: 'oogst',
      eis: function (s) { return s.seizoen !== 3; },
      doe: function (s) {
        Game.core.state.voegToe(s, 'graan', 60);
        Game.core.state.voegToe(s, 'vlees', 30);
        Game.ui.log.schrijf(s, '🌻 Een rijke oogst! De schuren stromen vol graan en wild.', 'goed');
        Game.ui.toast('🌻 Rijke oogst');
      }
    },
    {
      id: 'markt',
      doe: function (s) {
        Game.core.state.voegToe(s, 'munten', 45);
        Game.ui.log.schrijf(s, '💰 Een drukke marktdag levert de schatkist extra munten op.', 'goed');
      }
    },
    {
      id: 'geleerde',
      doe: function (s) {
        Game.core.state.voegToe(s, 'gereedschap', 15);
        Game.ui.log.schrijf(s, '📚 Een reizende geleerde deelt kennis: je smeden werken vlotter.', 'goed');
      }
    },
    {
      id: 'nachtvorst',
      eis: function (s) { return s.seizoen === 3 || s.seizoen === 0; },
      doe: function (s) {
        var weg = verlies(s, 'graan', 0.08);
        Game.ui.log.schrijf(s, '🌨️ Een strenge nachtvorst bederft wat graan' +
          (weg > 0 ? ' (−' + weg + ')' : '') + '.', 'slecht');
        Game.ui.toast('🌨️ Nachtvorst');
      }
    },
    {
      id: 'ziekte',
      doe: function (s) {
        s.moreel = (s.moreel || 0) - 6;
        Game.ui.log.schrijf(s, '🤒 Een lichte koorts waart rond. De dorpelingen zijn wat mismoedig.', 'slecht');
      }
    }
  ];

  G.tick = function (s, dt) {
    if (s.tijdperk < 2) return;
    if (typeof s.gebeurtenisTimer !== 'number') s.gebeurtenisTimer = G.MIN;
    s.gebeurtenisTimer -= dt;
    if (s.gebeurtenisTimer > 0) return;
    s.gebeurtenisTimer = G.MIN + Math.random() * G.SPREIDING;

    var poel = EVENTS.filter(function (e) { return !e.eis || e.eis(s); });
    if (!poel.length) return;
    poel[Math.floor(Math.random() * poel.length)].doe(s);
  };

  Game.core.gebeurtenissen = G;

})(window.Game);
