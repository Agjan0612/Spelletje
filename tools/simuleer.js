#!/usr/bin/env node
/* Headless balansharnas — draait het spel zonder browser.
 *
 * CLAUDE.md eist dat elke balanswijziging headless gevalideerd wordt, en
 * waarschuwt tegelijk dat twee runs met dezelfde instellingen enorm uiteen
 * lopen: tijdperk 3 is gemeten tussen 1135s en 2968s. Eén run leest dus ruis.
 * Daarom draait dit script N zaden met een vastgezette Math.random en rapporteert
 * de mediaan.
 *
 * Geen npm, geen dependencies, geen browser: de config- en core-bestanden zijn
 * gewone IIFE's op window.Game, dus ze laden prima in een vm-context met een
 * handvol stubs voor de teken- en interfacelaag. De bestandenlijst komt uit
 * index.html, zodat een nieuw core-bestand hier vanzelf meedoet.
 *
 * Gebruik:
 *   node tools/simuleer.js                       acht zaden, standaardinstellingen
 *   node tools/simuleer.js --zaden=16 --tijd=6000
 *   node tools/simuleer.js --scenario=kust --moeilijkheid=pittig
 *   node tools/simuleer.js --json                machineleesbare uitvoer
 *   node tools/simuleer.js --parallel=1          alles in één proces (rustiger)
 */
'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');
var os = require('os');
var kind = require('child_process');

var WORTEL = path.resolve(__dirname, '..');

/* ------------------------------------------------------------- de wereld -- */

/* De laadvolgorde staat sinds de PixiJS-migratie in src/legacy.js (de import-
   volgorde van de IIFE-modules) en nergens anders — die lezen we uit, zodat het
   harnas niet stilletjes achterloopt op een nieuw core-bestand. src/legacy.js
   laadt js/main.js niet (dat staat in src/main.js, ná de renderer), dus die
   plakken we er hier achteraan: main.js draagt de tickvolgorde. */
/* Twee interfacebestanden doen echt simulatiewerk (het logboek dat de kroniek
   terugleest, en de doelen die beloningen uitkeren) en raken de DOM alleen
   binnen functies die hier nooit aangeroepen worden. Die laden dus gewoon mee,
   in plaats van ze hier na te bouwen en te laten verjaren. */
var UI_TOEGESTAAN = { 'js/ui/log.js': 1, 'js/ui/quests.js': 1 };

function bestandslijst() {
  var legacy = fs.readFileSync(path.join(WORTEL, 'src', 'legacy.js'), 'utf8');
  var uit = [];
  var re = /import\s+'\.\.\/([^']+)'/g;
  var m;
  while ((m = re.exec(legacy))) {
    var src = m[1];                                                 /* bv. js/core/map.js */
    if (/^js\/render\//.test(src)) continue;                       /* tekenlaag */
    if (/^js\/ui\//.test(src) && !UI_TOEGESTAAN[src]) continue;    /* DOM-panelen */
    uit.push(src);
  }
  uit.push('js/main.js');                                          /* tickvolgorde, op één plek */
  return uit;
}

function leegElement() {
  return {
    style: {}, dataset: {}, children: [], value: '', textContent: '', innerHTML: '',
    classList: { add: function () {}, remove: function () {}, toggle: function () {}, contains: function () { return false; } },
    appendChild: function () {}, removeChild: function () {}, addEventListener: function () {},
    getBoundingClientRect: function () { return { left: 0, top: 0, width: 0, height: 0 }; }
  };
}

function nieuweWereld() {
  var ctx = vm.createContext({ console: console });
  vm.runInContext(
    'var window = this;' +
    'window.addEventListener = function () {};' +
    'window.requestAnimationFrame = function () { return 0; };' +
    'window.setTimeout = function () { return 0; };' +
    'window.clearTimeout = function () {};' +
    'window.localStorage = undefined;', ctx);
  ctx.document = {
    getElementById: function () { return null; },
    createElement: leegElement,
    createTextNode: function () { return leegElement(); },
    addEventListener: function () {},
    body: leegElement()
  };
  ctx.window.document = ctx.document;
  ctx.setTimeout = function () { return 0; };
  ctx.clearTimeout = function () {};

  bestandslijst().forEach(function (rel) {
    var code = fs.readFileSync(path.join(WORTEL, rel), 'utf8');
    vm.runInContext(code, ctx, { filename: rel });
  });

  var Game = ctx.window.Game;
  zetStubs(Game);
  return { ctx: ctx, Game: Game, spel: ctx.window.spel };
}

/* Wat de simulatie verder aanroept woont in panelen die hier niet bestaan.
   Alles hieronder is puur beeld en geluid: als het iets aan de speltoestand
   zou veranderen, hoort het in js/core/ te staan en niet hier gestubd. */
function zetStubs(Game) {
  Game.ui.overlay = { overwinning: function () {}, tijdperk: function () {}, uitgestorven: function () {} };
  Game.ui.audio = { zege: function () {}, klok: function () {}, hoorn: function () {}, feest: function () {} };
  Game.ui.stad = { toonGebeurtenis: function () {}, ververs: function () {} };
  Game.ui.buildmenu = { toon: function () {}, ververs: function () {} };
  Game.render.particles = null;                     /* overal achter een if */
  Game.render.renderer = { tijdperkSweep: function () {} };
}

/* Math.random stuurt rooftochten, gebeurtenissen en geboortes aan. Vastzetten
   is het hele punt van dit harnas: zonder dat meet je ruis. */
function zaaiToeval(ctx, zaad) {
  var a = zaad >>> 0;
  /* De vm-context heeft zijn eigen globals; window is die global. */
  ctx.window.Math.random = function () {
    a = (a + 0x6D2B79F5) >>> 0;
    var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------ de speler -- */

/* Een redelijke, niet briljante speler: bouwt de voor de hand liggende
   volgorde, houdt woonruimte bij, grijpt in als het eten opraakt en promoveert
   zodra het mag. Het gaat er niet om of dít lijstje optimaal is — het gaat erom
   dat het lijstje tussen twee metingen hetzelfde blijft. */
var PLAN = {
  1: ['houthakkershut', 'jachthut', 'huisje', 'steengroeve', 'huisje', 'vissershut',
      'boerderij', 'waterput', 'huisje', 'houthakkershut', 'graanschuur', 'huisje',
      'jachthut', 'voorraadschuur', 'huisje'],
  2: ['molen', 'bakkerij', 'huisje', 'kapel', 'steengroeve', 'marktplaats', 'huisje',
      'ijzermijn', 'kopermijn', 'huisje', 'schaapskooi', 'hopveld', 'steengroeve',
      'huisje', 'houthakkershut', 'wachttoren', 'huisje', 'waterput', 'boerderij',
      'huisje', 'steengroeve'],
  3: ['smederij', 'huisje', 'kerk', 'steengroeve', 'weverij', 'brouwerij', 'huisje',
      'kazerne', 'edelsteenmijn', 'gildehuis', 'huisje', 'school', 'steenhouwerij',
      'herberg', 'pakhuis', 'huisje', 'schatkamer', 'huisje', 'wapensmid',
      'steengroeve', 'huisje', 'houtzagerij'],
  4: ['stadhuis', 'huisje', 'universiteit', 'handelshuis', 'huisje', 'kathedraal',
      'kasteel', 'huisje', 'juwelier', 'huisje', 'fontein', 'huisje']
};

/* Voedsel is de enige echte faalmodus, dus die krijgt voorrang op het plan. */
var VOEDSEL = ['jachthut', 'vissershut', 'boerderij'];

function Speler(Game, s) {
  this.Game = Game;
  this.s = s;
  this.index = { 1: 0, 2: 0, 3: 0, 4: 0 };
  Game.core.arbeid.zorg(s);          /* s.arbeid wordt pas op de eerste tick gevuld */
  s.arbeid.auto = true;              /* laat de arbeidsverdeling zijn werk doen */
}

/* Spiraal vanaf het plein tot de eerste tegel waar het gebouw mág staan.
   controleer() doet alle echte regels, dus de bot kan niet vals spelen. */
Speler.prototype.zoekPlek = function (type) {
  var Game = this.Game, s = this.s;
  var plein = s.start || { x: Math.floor(s.kaart.b / 2), y: Math.floor(s.kaart.h / 2) };
  for (var r = 1; r < 22; r++) {
    for (var dy = -r; dy <= r; dy++) {
      for (var dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        var x = plein.x + dx, y = plein.y + dy;
        if (Game.core.construction.controleer(s, type, x, y).ok) return { x: x, y: y };
      }
    }
  }
  return null;
};

Speler.prototype.bouw = function (type) {
  var def = this.Game.config.gebouw(type);
  if (!def) return false;
  if (def.tijdperk > this.s.tijdperk) return false;
  if (!this.Game.core.state.kanBetalen(this.s, def.kosten)) return false;
  var plek = this.zoekPlek(type);
  if (!plek) return false;
  return this.Game.core.construction.plaats(this.s, type, plek.x, plek.y).ok;
};

/* Hoeveel woonruimte deze speler nu nastreeft: net iets meer dan het volgende
   tijdperk vraagt. */
Speler.prototype.woondoel = function () {
  var Game = this.Game, s = this.s;
  var volgende = Game.config.ages[s.tijdperk];       /* ages[0] is tijdperk 1 */
  var eis = volgende && volgende.eisen ? volgende.eisen.bevolking
    : Game.config.eindDoel.bevolking;
  return Math.round(eis * 1.35);
};

Speler.prototype.stap = function () {
  var Game = this.Game, s = this.s;

  /* Wachtende keuzes: zonder antwoord vuurt er nooit meer een gebeurtenis. */
  if (s.gebeurtenis && s.gebeurtenis.actief) Game.core.gebeurtenissen.kies(s, 0);
  if (Game.core.opdrachten.kanLeveren(s)) Game.core.opdrachten.lever(s);

  if (Game.core.ages.kanBevorderen(s)) Game.core.ages.bevorder(s);

  /* Honger eerst: onder de tien dagen voorraad gaat het plan opzij. */
  if (Game.core.population.voedselDagen(s) < 10) {
    for (var i = 0; i < VOEDSEL.length; i++) if (this.bouw(VOEDSEL[i])) return;
  }
  /* Dan een bed — maar niet eindeloos. Een speler bouwt huizen om een
     tijdperkeis te halen, niet om een dorp van driehonderd zielen te voeden
     dat nog steeds geen bakkerij heeft. */
  if (s.bevolking.ruimte - s.bevolking.totaal < 2 &&
      s.bevolking.ruimte < this.woondoel() && this.bouw('huisje')) return;

  /* En anders gewoon het volgende punt van het bouwplan. */
  var lijst = PLAN[s.tijdperk] || [];
  var poging = 0;
  while (this.index[s.tijdperk] < lijst.length && poging < 4) {
    var type = lijst[this.index[s.tijdperk]];
    if (this.bouw(type)) { this.index[s.tijdperk]++; return; }
    /* Nog niet te betalen? Wachten. Nergens kwijt te kunnen? Overslaan. */
    var def = Game.config.gebouw(type);
    if (def && Game.core.state.kanBetalen(s, def.kosten)) { this.index[s.tijdperk]++; poging++; continue; }
    return;
  }
};

/* --------------------------------------------------------------- de run -- */

function draai(opties, zaad) {
  var wereld = nieuweWereld();
  var Game = wereld.Game;
  var stap = wereld.spel.stap;      /* de échte tickvolgorde uit js/main.js */
  zaaiToeval(wereld.ctx, zaad);

  var s = Game.core.state.nieuw(zaad, 'Proefdorp', {
    kaart: opties.kaart, moeilijkheid: opties.moeilijkheid, scenario: opties.scenario
  });
  var speler = new Speler(Game, s);

  var TICK = 0.1;
  var meting = {
    zaad: zaad, tijdperk2: null, tijdperk3: null, tijdperk4: null, gewonnen: null,
    honger: 0, koude: 0, minVoedselDagen: 999, piekBevolking: 0, uitgestorven: null
  };
  var vorigTijdperk = s.tijdperk;
  var vorigeBevolking = s.bevolking.totaal;
  var bouwKlok = 0;

  for (var t = 0; t < opties.tijd; t += TICK) {
    stap(s, TICK);

    bouwKlok += TICK;
    if (bouwKlok >= 2) { bouwKlok = 0; speler.stap(); }

    if (s.tijdperk !== vorigTijdperk) {
      meting['tijdperk' + s.tijdperk] = Math.round(t);
      vorigTijdperk = s.tijdperk;
    }
    if (s.gewonnen && meting.gewonnen === null) meting.gewonnen = Math.round(t);

    /* Sterfte door honger of kou telt: dat zijn de twee dingen die de balans
       kapot maken en die geen enkele gemiddelde-eindstand laat zien. */
    if (s.bevolking.totaal < vorigeBevolking) {
      var laatste = s.log.length ? s.log[s.log.length - 1].tekst : '';
      if (/honger|verhongerd/i.test(laatste)) meting.honger++;
      else if (/kou|bevroren|brandhout/i.test(laatste)) meting.koude++;
    }
    vorigeBevolking = s.bevolking.totaal;
    meting.piekBevolking = Math.max(meting.piekBevolking, s.bevolking.totaal);

    if (s.bevolking.totaal <= 0) { meting.uitgestorven = Math.round(t); break; }

    /* Voorraadpeil één keer per gesimuleerde dag: voedselDagen() is niet gratis. */
    if (Math.abs(t % Game.core.state.DAG) < TICK && s.bevolking.totaal > 0) {
      meting.minVoedselDagen = Math.min(meting.minVoedselDagen,
        Math.round(Game.core.population.voedselDagen(s)));
    }
  }

  meting.bevolking = s.bevolking.totaal;
  meting.tevredenheid = Math.round(s.tevredenheid);
  meting.jaar = s.jaar;
  meting.gebouwen = s.gebouwen.filter(function (g) { return g.gebouwd; }).length;
  meting.punten = Game.core.state.statistiek(s).punten;

  /* Waar liep het vast? Zonder dit zegt een run die tijdperk 4 niet haalt
     alleen dát het niet lukte, en niet waaraan het lag. */
  var eisen = Game.core.ages.eisen(s);
  meting.blokkade = eisen ? eisen.lijst.filter(function (e) { return !e.klaar; })
    .map(function (e) { return e.tekst.replace(/^\S+\s/, '') + ' ' + e.nu + '/' + e.doel; }) : [];
  /* De promotiekosten zijn ook een eis, en juist die staat niet in de lijst. */
  if (eisen && !meting.blokkade.length && !Game.core.state.kanBetalen(s, eisen.tijdperk.kosten || {})) {
    for (var r in eisen.tijdperk.kosten) {
      if (s.res[r] < eisen.tijdperk.kosten[r]) {
        meting.blokkade.push('kosten ' + r + ' ' + Math.floor(s.res[r]) + '/' + eisen.tijdperk.kosten[r]);
      }
    }
  }
  return meting;
}

/* ------------------------------------------------------------- rapport --- */

function mediaan(getallen) {
  var lijst = getallen.filter(function (n) { return typeof n === 'number'; }).sort(function (a, b) { return a - b; });
  if (!lijst.length) return null;
  var m = Math.floor(lijst.length / 2);
  return lijst.length % 2 ? lijst[m] : Math.round((lijst[m - 1] + lijst[m]) / 2);
}

function kolom(v, breed) {
  var t = v === null || v === undefined ? '—' : String(v);
  while (t.length < breed) t = ' ' + t;
  return t;
}

function zaadLijst(aantal) {
  var uit = [];
  for (var i = 0; i < aantal; i++) uit.push(1000 + i * 7919);   /* vast, dus herhaalbaar */
  return uit;
}

/* De runs zijn los van elkaar, dus ze mogen naast elkaar draaien. Eén run van
   negenduizend seconden duurt een minuut of twee; acht achter elkaar is een
   kwartier wachten voor een getal dat je twee keer nodig hebt (vóór en ná).
   Vandaar: verdeel de zaden over een paar processen en voeg de uitkomsten
   samen. Elk kind draait exact dezelfde code, alleen met minder zaden. */
function draaiParallel(opties, zaden, klaar) {
  var kernen = Math.max(1, Math.min(opties.parallel, zaden.length));
  var delen = [];
  for (var i = 0; i < kernen; i++) delen.push([]);
  zaden.forEach(function (z, i) { delen[i % kernen].push(z); });

  var uit = [], open = kernen, mislukt = null;
  delen.forEach(function (deel) {
    var argumenten = ['--json', '--tijd=' + opties.tijd, '--kaart=' + opties.kaart,
      '--moeilijkheid=' + opties.moeilijkheid, '--scenario=' + opties.scenario,
      '--parallel=1', '--zaadlijst=' + deel.join(',')];
    var kid = kind.execFile(process.execPath, [__filename].concat(argumenten),
      { maxBuffer: 32 * 1024 * 1024 }, function (fout, uitvoer) {
        if (fout) mislukt = fout;
        else {
          try { uit = uit.concat(JSON.parse(uitvoer).runs); }
          catch (e) { mislukt = e; }
        }
        if (--open === 0) klaar(mislukt, uit);
      });
    kid.stderr.on('data', function (d) { process.stderr.write(d); });
  });
}

function main() {
  var opties = {
    zaden: 8, tijd: 5000, kaart: 'normaal', moeilijkheid: 'normaal', scenario: 'vrij',
    json: false, parallel: Math.min(4, os.cpus().length), zaadlijst: ''
  };
  process.argv.slice(2).forEach(function (arg) {
    var m = /^--([a-z0-9]+)(?:=(.*))?$/.exec(arg);
    if (!m) return;
    if (m[1] === 'json') { opties.json = true; return; }
    if (m[1] === 'zaden' || m[1] === 'tijd' || m[1] === 'parallel') opties[m[1]] = parseInt(m[2], 10);
    else if (opties[m[1]] !== undefined) opties[m[1]] = m[2];
  });

  var zaden = opties.zaadlijst
    ? opties.zaadlijst.split(',').map(Number)
    : zaadLijst(opties.zaden);
  opties.zaden = zaden.length;

  /* Eerst de speldata zelf: een run tegen een tegenstrijdige config meten is
     tijdverspilling, en de fouten staan anders alleen in een browserconsole
     die hier niet bestaat. */
  var wereld = nieuweWereld();
  /* devcheck logt zijn groene regel naar stdout; in --json-modus is stdout de
     uitvoer zelf, en een kindproces dat JSON teruggeeft mag er niets bij zetten. */
  var praat = console.log;
  if (opties.json) console.log = function () {};
  var fouten = wereld.Game.devcheck();
  console.log = praat;
  if (fouten.length) {
    console.error('\n  ⚠️ Speldata klopt niet — eerst dit oplossen:');
    fouten.forEach(function (f) { console.error('     · ' + f); });
    process.exitCode = 1;
    return;
  }

  if (opties.parallel > 1 && zaden.length > 1) {
    draaiParallel(opties, zaden, function (fout, metingen) {
      if (fout) { console.error(fout.message); process.exitCode = 1; return; }
      metingen.sort(function (a, b) { return a.zaad - b.zaad; });
      rapporteer(opties, metingen);
    });
    return;
  }

  var metingen = [];
  zaden.forEach(function (zaad) {
    metingen.push(draai(opties, zaad));
    if (!opties.json) process.stdout.write('.');
  });
  if (!opties.json) process.stdout.write('\n');
  rapporteer(opties, metingen);
}

function rapporteer(opties, metingen) {
  if (opties.json) {
    console.log(JSON.stringify({ opties: opties, runs: metingen }, null, 2));
    return;
  }

  console.log('\n  ' + metingen.length + ' runs · ' + opties.tijd + 's gesimuleerd · kaart ' +
    opties.kaart + ' · ' + opties.moeilijkheid + ' · scenario ' + opties.scenario + '\n');
  console.log('  zaad     t2     t3     t4    zege  inw  tev  huis  honger  kou  minvoorr');
  console.log('  ' + new Array(70).join('-'));
  metingen.forEach(function (m) {
    console.log('  ' + kolom(m.zaad, 5) + kolom(m.tijdperk2, 7) + kolom(m.tijdperk3, 7) +
      kolom(m.tijdperk4, 7) + kolom(m.gewonnen, 8) + kolom(m.bevolking, 5) +
      kolom(m.tevredenheid, 5) + kolom(m.gebouwen, 6) + kolom(m.honger, 8) +
      kolom(m.koude, 5) + kolom(m.minVoedselDagen === 999 ? null : m.minVoedselDagen, 10));
  });
  console.log('  ' + new Array(70).join('-'));
  var med = function (veld) { return mediaan(metingen.map(function (m) { return m[veld]; })); };
  console.log('  mediaan' + kolom(med('tijdperk2'), 7) + kolom(med('tijdperk3'), 7) +
    kolom(med('tijdperk4'), 7) + kolom(med('gewonnen'), 8) + kolom(med('bevolking'), 5) +
    kolom(med('tevredenheid'), 5) + kolom(med('gebouwen'), 6) + kolom(med('honger'), 8) +
    kolom(med('koude'), 5) + kolom(med('minVoedselDagen'), 10));

  var vast = {};
  metingen.forEach(function (m) {
    (m.blokkade || []).forEach(function (b) {
      var sleutel = b.replace(/ \d+\/\d+$/, '');
      vast[sleutel] = (vast[sleutel] || 0) + 1;
    });
  });
  var vastLijst = Object.keys(vast).sort(function (a, b) { return vast[b] - vast[a]; });
  if (vastLijst.length) {
    console.log('\n  nog niet gehaald aan het eind: ' + vastLijst.slice(0, 6).map(function (k) {
      return k + ' (' + vast[k] + 'x)';
    }).join(', '));
  }

  var gehaald = metingen.filter(function (m) { return m.tijdperk4 !== null; }).length;
  var dood = metingen.filter(function (m) { return m.uitgestorven !== null; }).length;
  console.log('\n  tijdperk 4 gehaald: ' + gehaald + '/' + metingen.length +
    ' · uitgestorven: ' + dood + '/' + metingen.length);
  console.log('  De eis uit CLAUDE.md: een vers dorp haalt tijdperk 4 zonder honger.\n');
}

if (require.main === module) main();
module.exports = { nieuweWereld: nieuweWereld, draai: draai };
