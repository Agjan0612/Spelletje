/* Saving and loading via localStorage, plus export/import as text so a save
   can be copied to another computer. */
(function (Game) {

  var SL = {};
  var SLEUTEL = 'dorp-tot-stad-save-v1';

  SL.beschikbaar = function () {
    try {
      window.localStorage.setItem('__test', '1');
      window.localStorage.removeItem('__test');
      return true;
    } catch (e) {
      return false;
    }
  };

  SL.naarTekst = function (s) {
    return JSON.stringify(s);
  };

  SL.opslaan = function (s) {
    if (!SL.beschikbaar()) return false;
    try {
      window.localStorage.setItem(SLEUTEL, SL.naarTekst(s));
      s.laatsteOpslag = Date.now();
      return true;
    } catch (e) {
      console.warn('Opslaan mislukt:', e);
      return false;
    }
  };

  SL.erIsEenSave = function () {
    if (!SL.beschikbaar()) return false;
    return !!window.localStorage.getItem(SLEUTEL);
  };

  SL.laden = function () {
    if (!SL.beschikbaar()) return null;
    var tekst = window.localStorage.getItem(SLEUTEL);
    if (!tekst) return null;
    return SL.uitTekst(tekst);
  };

  SL.uitTekst = function (tekst) {
    var s;
    try {
      s = JSON.parse(tekst);
    } catch (e) {
      return null;
    }
    if (!s || !s.kaart || !s.gebouwen) return null;
    return SL.herstel(s);
  };

  /* Fills in anything a save from an older/partial version might miss and
     rebuilds the derived values. */
  SL.herstel = function (s) {
    s.versie = Game.core.state.VERSIE;
    s.res = s.res || {};
    s.verzameld = s.verzameld || {};
    s.stroom = s.stroom || {};
    Game.config.resourceOrder.forEach(function (r) {
      if (typeof s.res[r] !== 'number') s.res[r] = 0;
      if (typeof s.verzameld[r] !== 'number') s.verzameld[r] = 0;
      s.stroom[r] = 0;
    });

    s.bevolking = s.bevolking || { totaal: 5 };
    s.bonus = s.bonus || { productie: 1, mijnbouw: 1 };
    s.raid = s.raid || { fase: 'rust', timer: 200, kracht: 0, nummer: 0 };

    /* City life, added after the first release: an older save simply starts
       with an empty calendar instead of breaking. */
    s.moreel = typeof s.moreel === 'number' ? s.moreel : 0;
    s.feest = s.feest || { id: null, resterend: 0, rust: 0, boost: 0 };
    s.handel = s.handel || { fase: 'weg', timer: 240, nummer: 0, aanbod: [] };
    if (!s.handel.aanbod) s.handel.aanbod = [];
    s.opdracht = s.opdracht || { actief: null, rust: 200, gedaan: 0, gefaald: 0, laatste: null };
    s.gebeurtenis = s.gebeurtenis || { timer: 280, actief: null, ctx: null, gedaan: 0, laatste: null };
    s.onderzoek = s.onderzoek || {};
    s.kaartmaat = s.kaartmaat || 'normaal';
    s.moeilijkheid = s.moeilijkheid || 'normaal';
    s.questsGedaan = s.questsGedaan || {};
    s.log = s.log || [];
    s.wandelaars = [];
    s.tevredenheid = typeof s.tevredenheid === 'number' ? s.tevredenheid : 60;
    s.snelheid = s.snelheid || 1;

    /* Relief layer: saves from before it lack per-tile height. Recompute it
       from the seed so old towns get relief too, without breaking pure JSON. */
    if (s.kaart.seed != null && (!s.kaart.tegels[0] || typeof s.kaart.tegels[0].h !== 'number')) {
      Game.core.map.herstelHoogte(s.kaart);
    }

    /* Tiles lose their building links in nothing but a corrupted save, but
       rebuilding them is cheap and makes loading robust. */
    for (var i = 0; i < s.kaart.tegels.length; i++) s.kaart.tegels[i].b = null;
    for (var j = 0; j < s.gebouwen.length; j++) {
      var g = s.gebouwen[j];
      if (!Game.config.gebouw(g.type)) { s.gebouwen.splice(j--, 1); continue; }
      Game.core.construction.markeerTegels(s, g);
    }

    Game.core.state.herbereken(s);
    Game.core.population.corrigeer(s);
    return s;
  };

  SL.wissen = function () {
    if (SL.beschikbaar()) window.localStorage.removeItem(SLEUTEL);
  };

  Game.core.save = SL;

})(window.Game);
