/* Saving and loading via localStorage, plus export/import as text so a save
   can be copied to another computer.

   Er zijn drie dorpsboeken in plaats van één. Eén sleutel betekende dat een
   nieuw scenario proberen je bestaande stad kostte — en met vijf scenario's op
   het beginscherm is dat een val die je precies één keer per stad in loopt.

   De sloten zijn drie losse sleutels plus een klein register met alleen wat
   het keuzescherm moet tonen (naam, jaar, punten). Dat register apart houden
   is het hele punt: een lijst met dorpen opbouwen mag geen drie saves van een
   paar honderd kilobyte parsen. */
(function (Game) {

  var SL = {};

  /* De oude, enkele sleutel. Blijft bestaan om één keer uit te lezen. */
  var SLEUTEL_OUD = 'dorp-tot-stad-save-v1';
  var SLEUTEL_REGISTER = 'dorp-tot-stad-boeken-v1';

  SL.AANTAL = 3;

  /* In welk boek dit spel schrijft. Bewust géén onderdeel van Game.state: het
     zegt iets over deze browser, niet over deze stad. */
  SL.huidig = 1;

  function sleutel(nr) { return 'dorp-tot-stad-boek-' + nr; }

  SL.beschikbaar = function () {
    try {
      window.localStorage.setItem('__test', '1');
      window.localStorage.removeItem('__test');
      return true;
    } catch (e) {
      return false;
    }
  };

  function geldig(nr) {
    nr = parseInt(nr, 10);
    return nr >= 1 && nr <= SL.AANTAL ? nr : SL.huidig;
  }

  /* ------------------------------------------------------------ register -- */

  SL.register = function () {
    if (!SL.beschikbaar()) return {};
    try {
      return JSON.parse(window.localStorage.getItem(SLEUTEL_REGISTER)) || {};
    } catch (e) {
      return {};
    }
  };

  function schrijfRegister(reg) {
    try {
      window.localStorage.setItem(SLEUTEL_REGISTER, JSON.stringify(reg));
    } catch (e) {
      console.warn('Register opslaan mislukt:', e);
    }
  }

  /* Wat het keuzescherm van een boek moet weten, zonder de save te lezen. */
  function samenvatting(s) {
    var st = Game.core.state.statistiek(s);
    return {
      naam: s.dorpsnaam,
      jaar: s.jaar,
      tijdperk: s.tijdperk,
      bevolking: s.bevolking.totaal,
      punten: st.punten,
      scenario: s.scenario,
      gewonnen: !!s.gewonnen,
      uitgestorven: !!s.uitgestorven,
      opgeslagen: Date.now()
    };
  }

  /* De drie boeken zoals het menu ze toont: altijd alle drie, ook de lege. */
  SL.boeken = function () {
    SL.migreer();
    var reg = SL.register();
    var uit = [];
    for (var nr = 1; nr <= SL.AANTAL; nr++) {
      var meta = reg[nr];
      var erIsIets = SL.beschikbaar() && !!window.localStorage.getItem(sleutel(nr));
      uit.push(erIsIets && meta
        ? { nr: nr, leeg: false, naam: meta.naam, jaar: meta.jaar, tijdperk: meta.tijdperk,
            bevolking: meta.bevolking, punten: meta.punten, scenario: meta.scenario,
            gewonnen: meta.gewonnen, uitgestorven: meta.uitgestorven, opgeslagen: meta.opgeslagen }
        : { nr: nr, leeg: !erIsIets, naam: erIsIets ? 'Onbekend dorp' : '' });
    }
    return uit;
  };

  /* Het boek waarin het laatst geschreven is — waar "verder spelen" heen gaat. */
  SL.laatste = function () {
    var beste = 0, besteTijd = -1;
    SL.boeken().forEach(function (b) {
      if (b.leeg) return;
      var tijd = b.opgeslagen || 0;
      if (tijd >= besteTijd) { besteTijd = tijd; beste = b.nr; }
    });
    return beste;
  };

  /* Het eerste lege boek, of 0 als ze alle drie vol zitten. */
  SL.vrijBoek = function () {
    var boeken = SL.boeken();
    for (var i = 0; i < boeken.length; i++) if (boeken[i].leeg) return boeken[i].nr;
    return 0;
  };

  /* Eén keer: de save van vóór de dorpsboeken verhuist naar boek 1. */
  var gemigreerd = false;
  SL.migreer = function () {
    if (gemigreerd || !SL.beschikbaar()) return;
    gemigreerd = true;
    var oud = window.localStorage.getItem(SLEUTEL_OUD);
    if (!oud) return;
    if (!window.localStorage.getItem(sleutel(1))) {
      try {
        window.localStorage.setItem(sleutel(1), oud);
        var s = SL.uitTekst(oud);
        if (s) {
          var reg = SL.register();
          reg[1] = samenvatting(s);
          schrijfRegister(reg);
        }
      } catch (e) {
        console.warn('Oude save verhuizen mislukt:', e);
        return;
      }
    }
    window.localStorage.removeItem(SLEUTEL_OUD);
  };

  SL.naarTekst = function (s) {
    return JSON.stringify(s);
  };

  SL.opslaan = function (s, nr) {
    if (!SL.beschikbaar()) return false;
    SL.migreer();
    nr = geldig(nr === undefined ? SL.huidig : nr);
    try {
      window.localStorage.setItem(sleutel(nr), SL.naarTekst(s));
    } catch (e) {
      /* Vol of geweigerd. Het register niet bijwerken, anders wijst het naar
         een boek dat er niet in past. */
      console.warn('Opslaan mislukt:', e);
      return false;
    }
    var reg = SL.register();
    reg[nr] = samenvatting(s);
    schrijfRegister(reg);
    SL.huidig = nr;
    s.laatsteOpslag = Date.now();
    return true;
  };

  SL.erIsEenSave = function () { return SL.laatste() > 0; };

  SL.laden = function (nr) {
    if (!SL.beschikbaar()) return null;
    SL.migreer();
    nr = geldig(nr === undefined ? (SL.laatste() || SL.huidig) : nr);
    var tekst = window.localStorage.getItem(sleutel(nr));
    if (!tekst) return null;
    var s = SL.uitTekst(tekst);
    if (s) SL.huidig = nr;
    return s;
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
    /* Which resources the HUD shows. An older save simply gets everything it
       has ever held; herbereken adds whatever its buildings handle. */
    s.gezien = s.gezien || {};
    Game.config.resourceOrder.forEach(function (r) {
      if (typeof s.res[r] !== 'number') s.res[r] = 0;
      if (typeof s.verzameld[r] !== 'number') s.verzameld[r] = 0;
      s.stroom[r] = 0;
      if (s.res[r] > 0 || s.verzameld[r] > 0) s.gezien[r] = true;
    });

    s.bevolking = s.bevolking || { totaal: 5 };
    /* Cohorts, standing and practice were added later. demografie.zorg (called
       from herbereken below) counts an older town as all grown-ups, which is
       exactly what it was. */
    s.leeftijd = s.leeftijd || { rijp: 0, oud: 0, dood: 0 };
    s.belasting = typeof s.belasting === 'number' ? s.belasting : 0;
    s.standOntevreden = typeof s.standOntevreden === 'number' ? s.standOntevreden : 0;
    s.wens = s.wens || { actief: null, rust: 160, vervuld: 0 };

    /* Storehouse categories, firewood and the tax dial, all added later.
       s.capaciteiten is derived and refilled by herbereken below. */
    s.capaciteiten = s.capaciteiten || {};
    s.bederfRem = typeof s.bederfRem === 'number' ? s.bederfRem : 0;
    s.belastingtarief = s.belastingtarief || 'normaal';
    s.koudeTimer = typeof s.koudeTimer === 'number' ? s.koudeTimer : 0;
    s.koud = !!s.koud;
    s.warenGeleverd = s.warenGeleverd || {};

    /* Scenarios and neighbouring towns, added later. An older save is simply
       a free game whose neighbours are generated on the next tick. */
    s.scenario = s.scenario || 'vrij';
    s.scenarioAf = !!s.scenarioAf;
    s.scenarioVerloren = !!s.scenarioVerloren;
    s.buren = Array.isArray(s.buren) ? s.buren : [];
    s.burenTimer = typeof s.burenTimer === 'number' ? s.burenTimer : 0;

    /* Labour policy, added later. core/arbeid.zorg fills in the defaults. */
    if (Game.core.arbeid) Game.core.arbeid.zorg(s);
    s.bonus = s.bonus || { productie: 1, mijnbouw: 1 };
    s.raid = s.raid || { fase: 'rust', timer: 200, kracht: 0, nummer: 0 };
    /* The marching band, its choices and the captain were added later. An
       older save simply starts its next raid with a clean slate. */
    if (typeof s.raid.voortgang !== 'number') s.raid.voortgang = 0;
    if (typeof s.raid.afgeslagen !== 'number') s.raid.afgeslagen = 0;
    if (typeof s.raid.beginKracht !== 'number') s.raid.beginKracht = s.raid.kracht || 0;
    if (!s.raid.beschoten || typeof s.raid.beschoten !== 'object') s.raid.beschoten = {};
    if (!s.raid.keuze) s.raid.keuze = { evacuatie: false, burgerwacht: false };
    /* A siege in progress needs its clock back, or it would never lift. */
    if (s.raid.fase === 'beleg' && typeof s.raid.belegTimer !== 'number') {
      s.raid.belegTimer = Game.config.rovers.belegDuur;
    }
    s.rovers = s.rovers || { naam: '', wrok: 0, ontmoetingen: 0, schattingen: 0, verslagen: 0 };
    ['wrok', 'ontmoetingen', 'schattingen', 'verslagen'].forEach(function (k) {
      if (typeof s.rovers[k] !== 'number') s.rovers[k] = 0;
    });
    if (typeof s.rovers.naam !== 'string') s.rovers.naam = '';

    /* City life, added after the first release: an older save simply starts
       with an empty calendar instead of breaking. */
    s.moreel = typeof s.moreel === 'number' ? s.moreel : 0;
    s.feest = s.feest || { id: null, resterend: 0, rust: 0, boost: 0 };
    s.handel = s.handel || { fase: 'weg', timer: 240, nummer: 0, aanbod: [] };
    if (!s.handel.aanbod) s.handel.aanbod = [];
    s.opdracht = s.opdracht || { actief: null, rust: 200, gedaan: 0, gefaald: 0, laatste: null };
    s.gebeurtenis = s.gebeurtenis || { timer: 280, actief: null, ctx: null, gedaan: 0, laatste: null };
    s.onderzoek = s.onderzoek || {};
    s.leger = s.leger || { overwinningen: 0, uitval: false };
    if (typeof s.leger.overwinningen !== 'number') s.leger.overwinningen = 0;
    s.leger.uitval = !!s.leger.uitval;
    s.dorpelingen = Array.isArray(s.dorpelingen) ? s.dorpelingen : [];
    s.kaartmaat = s.kaartmaat || 'normaal';
    s.moeilijkheid = s.moeilijkheid || 'normaal';
    s.questsGedaan = s.questsGedaan || {};
    s.log = s.log || [];
    /* Geschiedenis en de andere afloop, later toegevoegd: een oudere save
       begint zijn grafiek gewoon vanaf nu. */
    if (Game.core.historie) Game.core.historie.zorg(s);
    if (Game.core.faam) Game.core.faam.zorg(s);
    s.uitgestorven = !!s.uitgestorven;
    /* Walkers now live in the render layer, not the save. Drop the field an
       older save may still carry so a fresh save never writes it again. */
    delete s.wandelaars;
    s.tevredenheid = typeof s.tevredenheid === 'number' ? s.tevredenheid : 60;
    s.snelheid = s.snelheid || 1;

    /* Local services and desirability, added later: both are derived, so an
       older save only needs the fields to exist — herbereken below fills
       them in with the real numbers. */
    s.dienstdekking = typeof s.dienstdekking === 'number' ? s.dienstdekking : 0;
    s.sfeer = typeof s.sfeer === 'number' ? s.sfeer : 0;

    /* Streets, added later: an older map simply has none. The flag lives on
       the tiles, so nothing else needs restoring. */
    s.wegTeller = typeof s.wegTeller === 'number' ? s.wegTeller : 0;

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
      if (typeof g.ervaring !== 'number') g.ervaring = 0;
      if (typeof g.bouwPrio !== 'number') g.bouwPrio = 0;
      Game.core.construction.markeerTegels(s, g);
    }

    Game.core.state.herbereken(s);
    Game.core.population.corrigeer(s);
    return s;
  };

  SL.wissen = function (nr) {
    if (!SL.beschikbaar()) return;
    nr = geldig(nr === undefined ? SL.huidig : nr);
    window.localStorage.removeItem(sleutel(nr));
    var reg = SL.register();
    delete reg[nr];
    schrijfRegister(reg);
  };

  Game.core.save = SL;

})(window.Game);
