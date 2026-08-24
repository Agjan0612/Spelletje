/* De geschiedenis van de stad, getekend.
 *
 * Vier smalle grafiekjes onder elkaar in plaats van één grafiek met vier
 * lijnen: bevolking, tevredenheid, voedsel en munten hebben niets met elkaars
 * schaal te maken, en ze over één as heen leggen zou een verhaal vertellen dat
 * er niet staat. Elk grafiekje heeft dus zijn eigen maximum, en de tijdperken
 * lopen als gouden strepen door alle vier tegelijk — dat is wat ze wél delen.
 *
 * De metingen komen uit js/core/historie.js; hier wordt niets herrekend.
 */
(function (Game) {

  var G = {};

  var BREED = 520;                 /* logische breedte; CSS schaalt hem mee */
  var HOOG = 62;                   /* per grafiekje */

  G.REEKSEN = [
    { sleutel: 'b', naam: 'Inwoners', emoji: '👥', kleur: '#e8c46a' },
    { sleutel: 't', naam: 'Tevredenheid', emoji: '😀', kleur: '#8fc06a', vast: 100, achtervoegsel: '%' },
    { sleutel: 'v', naam: 'Voedsel in voorraad', emoji: '🍞', kleur: '#d99a5b' },
    { sleutel: 'm', naam: 'Munten', emoji: '🪙', kleur: '#c9b083' }
  ];

  /* Bouwt het hele blok: een kop, vier grafiekjes en een voetregel. Geeft null
     terug als er nog te weinig gemeten is om iets te tekenen. */
  G.bouw = function (s) {
    var punten = (s.historie || []).slice();
    var wrap = Game.util.el('div', 'grafiekblok');

    if (punten.length < 2) {
      wrap.appendChild(Game.util.el('p', 'cursief',
        'Er is nog te weinig geschiedenis om te tekenen — na een seizoen of twee ' +
        'staat hier het verloop van je stad.'));
      return wrap;
    }

    var grenzen = Game.core.historie.tijdperkGrenzen(s);

    G.REEKSEN.forEach(function (reeks) {
      var kaart = Game.util.el('div', 'grafiek');

      var kop = Game.util.el('div', 'grafiekkop');
      kop.appendChild(Game.util.el('span', 'naam', reeks.emoji + ' ' + reeks.naam));
      var nu = punten[punten.length - 1][reeks.sleutel];
      var top = reeks.vast || Math.max.apply(null, punten.map(function (p) { return p[reeks.sleutel]; }));
      kop.appendChild(Game.util.el('span', 'waarde',
        'nu ' + Game.util.fmt(nu) + (reeks.achtervoegsel || '') +
        ' · hoogst ' + Game.util.fmt(top) + (reeks.achtervoegsel || '')));
      kaart.appendChild(kop);

      var canvas = document.createElement('canvas');
      canvas.className = 'grafiekdoek';
      var dpr = window.devicePixelRatio || 1;
      canvas.width = BREED * dpr;
      canvas.height = HOOG * dpr;
      kaart.appendChild(canvas);

      var ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      teken(ctx, punten, reeks, grenzen);

      wrap.appendChild(kaart);
    });

    var van = Game.core.historie.label(punten[0]);
    var tot = Game.core.historie.label(punten[punten.length - 1]);
    wrap.appendChild(Game.util.el('div', 'cursief midden',
      van + ' → ' + tot + ' · elke stip is een seizoen' +
      (grenzen.length ? ' · de gouden strepen zijn de tijdperken' : '')));
    return wrap;
  };

  function teken(ctx, punten, reeks, grenzen) {
    var marge = 4;
    var b = BREED, h = HOOG;
    var top = reeks.vast || Math.max.apply(null, punten.map(function (p) { return p[reeks.sleutel]; }));
    if (!(top > 0)) top = 1;

    ctx.clearRect(0, 0, b, h);
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    ctx.fillRect(0, 0, b, h);

    /* Drie hulplijnen, genoeg om hoogte te schatten en weinig genoeg om de
       lijn zelf niet te overstemmen. */
    ctx.strokeStyle = 'rgba(255,232,190,.10)';
    ctx.lineWidth = 1;
    for (var i = 1; i < 4; i++) {
      var y = marge + (h - marge * 2) * (i / 4);
      ctx.beginPath();
      ctx.moveTo(0, Math.round(y) + 0.5);
      ctx.lineTo(b, Math.round(y) + 0.5);
      ctx.stroke();
    }

    function xVan(i) { return punten.length < 2 ? 0 : (i / (punten.length - 1)) * b; }
    function yVan(v) { return h - marge - (Math.min(v, top) / top) * (h - marge * 2); }

    /* De tijdperkgrenzen, door alle vier de grafiekjes op dezelfde plek. */
    ctx.strokeStyle = 'rgba(215,169,75,.42)';
    grenzen.forEach(function (g) {
      var gx = Math.round(xVan(g.index)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, h);
      ctx.stroke();
    });

    /* Vlak onder de lijn, zodat een lage waarde ook zonder de lijn te volgen
       als "laag" leest. */
    ctx.beginPath();
    ctx.moveTo(xVan(0), h);
    for (var j = 0; j < punten.length; j++) ctx.lineTo(xVan(j), yVan(punten[j][reeks.sleutel]));
    ctx.lineTo(xVan(punten.length - 1), h);
    ctx.closePath();
    ctx.fillStyle = vervaag(reeks.kleur, 0.18);
    ctx.fill();

    ctx.beginPath();
    for (var k = 0; k < punten.length; k++) {
      var px = xVan(k), py = yVan(punten[k][reeks.sleutel]);
      if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = reeks.kleur;
    ctx.lineWidth = 1.8;
    ctx.lineJoin = 'round';
    ctx.stroke();

    /* Het laatste punt krijgt een stip: dat is waar je nu staat. */
    var lx = xVan(punten.length - 1), ly = yVan(punten[punten.length - 1][reeks.sleutel]);
    ctx.fillStyle = reeks.kleur;
    ctx.beginPath();
    ctx.arc(lx - 1.5, ly, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }

  /* #rrggbb naar rgba(), zodat het vlak onder de lijn dezelfde kleur houdt. */
  function vervaag(hex, alfa) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + alfa + ')';
  }

  Game.ui.grafiek = G;

})(window.Game);
