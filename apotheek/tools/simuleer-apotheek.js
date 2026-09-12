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

/* De bot ís het protocol. Sinds fase 1 kan de speler zijn beleid vastleggen, en
   dan is het eerlijkst — en veruit het nuttigst — om precies díe standen te
   meten in plaats van een eigen botlogica te verzinnen die niemand kan spelen.
   Wat hier gemeten wordt is dus letterlijk een speelbare speelstijl.
   Het vangnet hieronder is er voor de stand 'vraag', waar een mens aan zet is:
   in een headless run zou het recept dan eeuwig blijven liggen. */
function botVangnet(A, s) {
  var open = A.core.state.besluiten(s);
  for (var i = 0; i < open.length; i++) {
    var r = open[i];
    if (A.core.protocollen.keuze(s, r)) continue;      /* het beleid pakt hem op */
    A.core.recept.doe(s, r.id, r.klasse === 'A' ? 'apotheker' : 'overleg');
  }
}

/* --------------------------------------------------------------- een run -- */

function draaiZaad(zaad, opties) {
  var ctx = nieuweWereld();
  var A = ctx.window.Apotheek;

  if (opties.recepten) A.config.inst.receptenPerDag = opties.recepten;
  /* --knop=naam:waarde zet één instelling om, zodat een sweep geen bestand
     hoeft te bewerken. Alleen platte getallen; alles ingewikkelder hoort in
     instellingen.js thuis en niet op de opdrachtregel. */
  opties.knoppen.forEach(function (k) {
    var d = k.split(':');
    if (d.length === 2 && A.config.inst[d[0]] !== undefined) {
      A.config.inst[d[0]] = Number(d[1]);
    }
  });

  var s = A.core.state.nieuw(zaad, 'Harnas');
  s.protocol.A = opties.beleidA;
  s.protocol.B = opties.beleidB;
  s.protocol.controle = opties.controle;
  var dm = ctx.window.spel.TICK * A.config.inst.minutenPerSeconde;

  var dagen = [];
  for (var d = 0; d < opties.dagen; d++) {
    var vast = 0;
    while (!s.dagKlaar) {
      ctx.window.spel.stap(s, dm);
      botVangnet(A, s);
      /* Vangnet: als de dag na sluitingstijd niet leegloopt, is er iets mis met
         de doorstroom — dat is een bevinding, geen reden om te blijven hangen. */
      if (s.tijd > A.config.inst.dagEind + 600) { vast = 1; A.core.klok.sluit(s); }
    }
    var g = s.gisteren, b = g.boek;
    dagen.push({
      af: b.af, binnen: b.binnen, weg: b.weggelopen,
      fouten: b.fouten, bijna: b.bijnaFouten,
      overlegd: b.overlegd, akkoord: b.akkoord, beoordeeld: b.beoordeeld,
      opgevraagd: b.opgevraagd,
      apotheker: g.bezettingApotheker,
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
  beleidA: vlag('a', 'uitzoeken'),        /* apotheker | uitzoeken | vraag */
  beleidB: vlag('b', 'uitzoeken'),        /* uitzoeken | overleg | akkoord | vraag */
  controle: vlag('controle', 'alles'),    /* alles | signaal | geen */
  recepten: Number(vlag('recepten', 0)) || 0,
  knoppen: process.argv.filter(function (a) { return a.indexOf('--knop=') === 0; })
    .map(function (a) { return a.slice(7); })
};
var alsJson = process.argv.indexOf('--json') >= 0;

var rijen = [];
for (var z = 1; z <= opties.zaden; z++) rijen.push(draaiZaad(z * 7919, opties));

var kolommen = ['af', 'weg', 'fouten', 'bijna', 'doorloop', 'doorloopMax', 'wachttijd',
  'bezetting', 'apotheker', 'saldo', 'tevreden', 'eind'];
var med = {};
kolommen.forEach(function (k) {
  med[k] = mediaan(rijen.map(function (r) { return r[k]; }));
});

if (alsJson) {
  console.log(JSON.stringify({ opties: opties, mediaan: med, zaden: rijen }, null, 2));
} else {
  console.log('');
  console.log('  Apotheek — ' + opties.zaden + ' zaden × ' + opties.dagen + ' dagen');
  console.log('  beleid: A=' + opties.beleidA + '  B=' + opties.beleidB +
    '  controle=' + opties.controle + '  recepten/dag=' + (opties.recepten || 'standaard'));
  console.log('');
  console.log('  zaad   af  weg  fout bijna  gereed   max  balie   bezet  apoth   saldo  tevr  klaar');
  rijen.forEach(function (r, i) { console.log('  ' + regel(i + 1, r)); });
  console.log('  ' + '-'.repeat(78));
  console.log('  MED ' + regel('', med).slice(4));
  console.log('');
  var b = med.bezetting;
  console.log('  ' + (b > 0.90 ? '⚠️  Te krap: boven 0,90 groeit de rij de hele dag.'
    : b < 0.60 ? '⚠️  Te ruim: onder 0,60 heeft de speler niets te doen.'
      : '✅ Bezetting in de speelbare band (0,75–0,85 streef).'));
  if (med.apotheker > 0.9) console.log('  ⚠️  De apotheker zit vast: klasse A stapelt op.');
  console.log('');
}

function regel(nr, r) {
  return pad(nr, 4) + pad(Math.round(r.af), 5) + pad(Math.round(r.weg), 5) +
    pad(r.fouten.toFixed(1), 6) + pad(r.bijna.toFixed(1), 6) +
    pad(r.doorloop.toFixed(1), 8) + pad(Math.round(r.doorloopMax), 6) +
    pad(r.wachttijd.toFixed(1), 7) +
    pad(Math.round(r.bezetting * 100) + '%', 8) +
    pad(Math.round(r.apotheker * 100) + '%', 7) +
    pad(Math.round(r.saldo), 8) + pad(Math.round(r.tevreden) + '%', 6) +
    pad(klok(r.eind), 7);
}

function pad(v, n) { var s = String(v); while (s.length < n) s = ' ' + s; return s; }
function klok(min) {
  var m = Math.round(min) % 1440, u = Math.floor(m / 60), r = m % 60;
  return (u < 10 ? '0' : '') + u + ':' + (r < 10 ? '0' : '') + r;
}
