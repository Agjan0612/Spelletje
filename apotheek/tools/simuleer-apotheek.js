#!/usr/bin/env node
/* Headless balansharnas voor het apotheekspel — geen browser, geen npm.
 *
 * Dit bestand komt vroeg in plaats van laat, en dat is een ontwerpkeuze uit het
 * bouwplan. Dit spel is een wachtrijnetwerk en die hebben een klif: een station
 * dat tien procent te weinig capaciteit heeft geeft geen tien procent langere
 * rij maar een rij die de hele dag blijft groeien. Met de hand meten leest ruis.
 *
 * De laadvolgorde komt uit src/legacy.js, zodat het harnas niet achterloopt op
 * een nieuw core-bestand, en js/main.js gaat er achteraan omdat dáár de
 * tickvolgorde staat. Het harnas draait dus letterlijk hetzelfde spel.
 *
 * Gebruik:
 *   node tools/simuleer-apotheek.js
 *   node tools/simuleer-apotheek.js --zaden=16 --dagen=3
 *   node tools/simuleer-apotheek.js --recepten=120 --beleid=overleg
 *   node tools/simuleer-apotheek.js --json
 */
'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');

var WORTEL = path.resolve(__dirname, '..');
var UI_TOEGESTAAN = { 'js/ui/log.js': 1 };   /* het logboek doet echt werk */

function bestandslijst() {
  var legacy = fs.readFileSync(path.join(WORTEL, 'src', 'legacy.js'), 'utf8');
  var uit = [], re = /import\s+'\.\.\/([^']+)'/g, m;
  while ((m = re.exec(legacy))) {
    var src = m[1];
    if (/^js\/render\//.test(src)) continue;
    if (/^js\/ui\//.test(src) && !UI_TOEGESTAAN[src]) continue;
    uit.push(src);
  }
  uit.push('js/main.js');                     /* de tickvolgorde, op één plek */
  return uit;
}

function nieuweWereld() {
  var ctx = vm.createContext({ console: console });
  vm.runInContext(
    'var window = this;' +
    'window.addEventListener = function () {};' +
    'window.requestAnimationFrame = function () { return 0; };',
    ctx);
  bestandslijst().forEach(function (rel) {
    var code = fs.readFileSync(path.join(WORTEL, rel), 'utf8');
    vm.runInContext(code, ctx, { filename: rel });
  });
  return ctx;
}

/* ------------------------------------------------------------------ bot -- */

/* Een bewust middelmatige, bewust vaste speler. Het getal dat hij oplevert is
   alleen iets waard omdat het dezelfde speler is aan beide kanten van een
   wijziging — vergelijk hem nooit met een mens. */
var beleidDrempel = 6;

function bot(A, s, beleid) {
  var open = A.core.state.besluiten(s);
  if (!open.length) return;
  var druk = A.core.state.onderhanden(s);
  for (var i = 0; i < open.length; i++) {
    var keuze;
    if (beleid === 'overleg') keuze = 'overleg';
    else if (beleid === 'akkoord') keuze = 'akkoord';
    else keuze = druk > beleidDrempel ? 'akkoord' : 'overleg';  /* wijk als het druk is */
    A.core.recept.beslis(s, open[i].id, keuze);
  }
}

/* --------------------------------------------------------------- een run -- */

function draaiZaad(zaad, opties) {
  var ctx = nieuweWereld();
  var A = ctx.window.Apotheek;

  if (opties.recepten) A.config.inst.receptenPerDag = opties.recepten;
  if (opties.personeel) { /* fase 0 heeft er vast twee; haak voor later */ }

  var s = A.core.state.nieuw(zaad, 'Harnas');
  var dm = ctx.window.spel.TICK * A.config.inst.minutenPerSeconde;

  var dagen = [];
  for (var d = 0; d < opties.dagen; d++) {
    var vast = 0;
    while (!s.dagKlaar) {
      ctx.window.spel.stap(s, dm);
      bot(A, s, opties.beleid);
      /* Vangnet: als de dag na sluitingstijd niet leegloopt, is er iets mis met
         de doorstroom — dat is een bevinding, geen reden om te blijven hangen. */
      if (s.tijd > A.config.inst.dagEind + 600) { vast = 1; A.core.klok.sluit(s); }
    }
    var g = s.gisteren, b = g.boek;
    dagen.push({
      af: b.af, binnen: b.binnen, weg: b.weggelopen, fouten: b.fouten,
      overlegd: b.overlegd, akkoord: b.akkoord,
      doorloop: b.gereedN ? b.gereedSom / b.gereedN : 0,
      doorloopMax: b.gereedMax,
      wachttijd: b.wachtN ? b.wachtSom / b.wachtN : 0,
      bezetting: g.bezetting,
      saldo: g.saldo,
      tevreden: g.tevredenheid,
      eind: g.eind,
      vast: vast
    });
    if (d < opties.dagen - 1) A.core.klok.nieuweDag(s);
  }
  return gemiddeld(dagen);
}

function gemiddeld(rijen) {
  var uit = {};
  Object.keys(rijen[0]).forEach(function (k) {
    var som = 0;
    for (var i = 0; i < rijen.length; i++) som += rijen[i][k];
    uit[k] = som / rijen.length;
  });
  return uit;
}

function mediaan(getallen) {
  var a = getallen.slice().sort(function (x, y) { return x - y; });
  var m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

/* ------------------------------------------------------------------ main -- */

function vlag(naam, standaard) {
  var pre = '--' + naam + '=';
  for (var i = 2; i < process.argv.length; i++) {
    if (process.argv[i].indexOf(pre) === 0) return process.argv[i].slice(pre.length);
  }
  return standaard;
}

var opties = {
  zaden: Number(vlag('zaden', 12)),
  dagen: Number(vlag('dagen', 3)),
  beleid: vlag('beleid', 'gemengd'),
  recepten: Number(vlag('recepten', 0)) || 0,
  drempel: Number(vlag('drempel', 6))
};
beleidDrempel = opties.drempel;
var alsJson = process.argv.indexOf('--json') >= 0;

var rijen = [];
for (var z = 1; z <= opties.zaden; z++) rijen.push(draaiZaad(z * 7919, opties));

var kolommen = ['af', 'weg', 'fouten', 'doorloop', 'doorloopMax', 'wachttijd', 'bezetting', 'saldo', 'tevreden', 'eind'];
var med = {};
kolommen.forEach(function (k) {
  med[k] = mediaan(rijen.map(function (r) { return r[k]; }));
});

if (alsJson) {
  console.log(JSON.stringify({ opties: opties, mediaan: med, zaden: rijen }, null, 2));
} else {
  console.log('');
  console.log('  Apotheek — ' + opties.zaden + ' zaden × ' + opties.dagen + ' dagen, beleid: ' + opties.beleid);
  console.log('  recepten/dag: ' + (opties.recepten || 'standaard'));
  console.log('');
  console.log('  zaad   af   weg  fout   gereed   max   balie   bezetting   saldo   tevr   klaar om');
  rijen.forEach(function (r, i) {
    console.log('  ' + pad(i + 1, 4) + pad(Math.round(r.af), 5) + pad(Math.round(r.weg), 6) +
      pad(r.fouten.toFixed(1), 6) + pad(r.doorloop.toFixed(1), 9) +
      pad(Math.round(r.doorloopMax), 6) + pad(r.wachttijd.toFixed(1), 8) +
      pad(Math.round(r.bezetting * 100) + '%', 12) +
      pad(Math.round(r.saldo), 8) + pad(Math.round(r.tevreden) + '%', 7) +
      pad(klok(r.eind), 11));
  });
  console.log('  ' + '-'.repeat(72));
  console.log('  MED ' + pad(Math.round(med.af), 5) + pad(Math.round(med.weg), 6) +
    pad(med.fouten.toFixed(1), 6) + pad(med.doorloop.toFixed(1), 9) +
    pad(Math.round(med.doorloopMax), 6) + pad(med.wachttijd.toFixed(1), 8) +
    pad(Math.round(med.bezetting * 100) + '%', 12) +
    pad(Math.round(med.saldo), 8) + pad(Math.round(med.tevreden) + '%', 7) +
    pad(klok(med.eind), 11));
  console.log('');
  var b = med.bezetting;
  console.log('  ' + (b > 0.90 ? '⚠️  Te krap: boven 0,90 groeit de rij de hele dag.'
    : b < 0.60 ? '⚠️  Te ruim: onder 0,60 heeft de speler niets te doen.'
      : '✅ Bezetting in de speelbare band (0,75–0,85 streef).'));
  console.log('');
}

function pad(v, n) { var s = String(v); while (s.length < n) s = ' ' + s; return s; }
function klok(min) {
  var m = Math.round(min) % 1440, u = Math.floor(m / 60), r = m % 60;
  return (u < 10 ? '0' : '') + u + ':' + (r < 10 ? '0' : '') + r;
}
