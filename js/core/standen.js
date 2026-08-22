/* What kind of household lives in a house, what it demands, and what it pays.
 *
 * The housing upgrade chain (huisje -> vakwerkhuis -> herenhuis) always looked
 * like a social ladder but only ever added beds. Now each rung is a different
 * kind of citizen: farmers ask nothing and pay almost nothing; burghers want
 * variety on the table and services on the corner; patricians want a great
 * deal and pay a great deal.
 *
 * That gives coins a source that scales with how *well* your town is built
 * rather than with how many market stalls you happen to own, and it gives the
 * upgrade button a reason beyond "more beds".
 *
 * Everything here is derived per tick from the buildings and read straight
 * back out; the only thing written to state is the coins themselves and two
 * cached numbers for the HUD.
 */
(function (Game) {

  var S = {};

  /* Which class a building houses. Anything with beds and no class named is
     treated as the humblest. */
  S.standVan = function (d) {
    if (!d.woonruimte) return null;
    return d.stand || 'boeren';
  };

  /* A snapshot of the town by class: how many people, whether their demands
     are met, and what they are paying. */
  S.overzicht = function (s) {
    var buurt = Game.core.buurt;
    var ruimte = Math.max(1, s.bevolking.ruimte || 1);
    /* People spread over the beds that exist. Not simulated per house — the
       town is not that kind of game — but proportional to what each offers. */
    var bezetting = Game.util.clamp((s.bevolking.totaal || 0) / ruimte, 0, 1);
    var variatie = s.voedselVariatie || 0;

    var per = {};
    Game.config.standOrde.forEach(function (id) {
      per[id] = { id: id, bewoners: 0, tevreden: 0, ontevreden: 0, munten: 0 };
    });

    for (var i = 0; i < s.gebouwen.length; i++) {
      var g = s.gebouwen[i];
      if (!g.gebouwd) continue;
      var d = Game.core.state.def(g);
      var standId = S.standVan(d);
      if (!standId || !per[standId]) continue;

      var stand = Game.config.stand(standId);
      var bewoners = d.woonruimte * bezetting;
      if (bewoners <= 0) continue;

      var mid = (d.grootte - 1) / 2;
      var dekking = Game.util.clamp(
        buurt.dienstenOp(s, g.x + mid, g.y + mid) / buurt.VOLLEDIG, 0, 1);

      var voldaan = true;
      if (stand.eisen.variatie && variatie < stand.eisen.variatie) voldaan = false;
      if (stand.eisen.diensten && dekking < stand.eisen.diensten) voldaan = false;

      per[standId].bewoners += bewoners;
      per[standId][voldaan ? 'tevreden' : 'ontevreden'] += bewoners;
      /* A household that is not getting what it was promised still pays its
         dues, but grudgingly and late. */
      per[standId].munten += stand.belasting * bewoners *
        (0.4 + 0.6 * (s.tevredenheid / 100)) * (voldaan ? 1 : 0.35);
    }

    var totaal = 0, ontevreden = 0, munten = 0;
    Game.config.standOrde.forEach(function (id) {
      totaal += per[id].bewoners;
      ontevreden += per[id].ontevreden;
      munten += per[id].munten;
    });

    return {
      per: per,
      bewoners: totaal,
      ontevredenDeel: totaal > 0 ? ontevreden / totaal : 0,
      muntenPerSec: munten
    };
  };

  S.tick = function (s, dt) {
    var o = S.overzicht(s);

    /* Taxes. Booked through voegToe so the storage cap applies exactly as it
       does to every other income. */
    if (o.muntenPerSec > 0) {
      var binnen = Game.core.state.voegToe(s, 'munten', o.muntenPerSec * dt);
      s.stroom.munten = s.stroom.munten * 0.8 + (binnen / dt) * 0.2;
    }

    /* Cached for the HUD and for population.tevredenheidDetail — recomputing
       this inside the happiness formula would walk every building twice. */
    s.belasting = o.muntenPerSec;
    s.standOntevreden = o.ontevredenDeel;
  };

  Game.core.standen = S;

})(window.Game);
