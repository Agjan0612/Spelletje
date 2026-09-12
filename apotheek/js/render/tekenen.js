/* De tekenlaag. Canvas 2D, geen bibliotheek.
 *
 * Bewuste fase-0-keuze: het buurspel tekent met PixiJS en dit spel gaat dat
 * uiteindelijk ook doen, maar een skelet met drie meubels en twee poppetjes
 * verdient geen WebGL-opzet. Canvas 2D is hier honderdvijftig regels en nul
 * configuratie. Het overstappunt is fase 2, als er echt iets te tekenen valt;
 * de projectie zit al in camera.js en verandert daar niet van.
 *
 * Niets in dit bestand raakt de speltoestand aan. Wat het tekent is afgeleid:
 * waar een wachtende patiënt staat volgt uit zijn plek in de rij, niet uit een
 * veld in de save. */
(function (A) {

  var KLEUR = {
    buiten: '#e8e6df',
    werkvloer: '#d9dcd6',
    werkvloer2: '#d2d6cf',
    toonbank: '#b9a17b',
    publiek: '#e3e0d6',
    publiek2: '#dcd9ce',
    muur: '#c9cec6',
    muurZij: '#b3b9af',
    toonbank2: '#a68d69',
    lijn: 'rgba(20,32,28,.07)',
    inkt: '#14201C',
    groen: '#1B5E4B',
    geel: '#E8B33C',
    klei: '#B4462F'
  };

  function ruit(ctx, p, hb, hh) {
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - hh);
    ctx.lineTo(p.x + hb, p.y);
    ctx.lineTo(p.x, p.y + hh);
    ctx.lineTo(p.x - hb, p.y);
    ctx.closePath();
  }

  /* Een staand blok op een tegel: bovenvlak plus twee zijvlakken. Genoeg om een
     kast van een balie te onderscheiden zonder één sprite te laden. */
  function blok(ctx, cam, tx, ty, hoogte, kleur, breedte) {
    var b = breedte === undefined ? 0.82 : breedte;
    var hb = cam.halfBreed() * b, hh = cam.halfHoog() * b;
    var h = hoogte * cam.zoom;
    var p = cam.naarScherm(tx + 0.5, ty + 0.5);
    var top = { x: p.x, y: p.y - h };

    ctx.fillStyle = schaduw(kleur, 0.72);
    ctx.beginPath();
    ctx.moveTo(p.x - hb, p.y);
    ctx.lineTo(p.x, p.y + hh);
    ctx.lineTo(top.x, top.y + hh);
    ctx.lineTo(top.x - hb, top.y);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = schaduw(kleur, 0.88);
    ctx.beginPath();
    ctx.moveTo(p.x + hb, p.y);
    ctx.lineTo(p.x, p.y + hh);
    ctx.lineTo(top.x, top.y + hh);
    ctx.lineTo(top.x + hb, top.y);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = kleur;
    ruit(ctx, top, hb, hh);
    ctx.fill();
    ctx.strokeStyle = 'rgba(20,32,28,.18)';
    ctx.lineWidth = 1;
    ctx.stroke();

    return top;
  }

  function schaduw(hex, f) {
    var n = parseInt(hex.slice(1), 16);
    var r = Math.round(((n >> 16) & 255) * f);
    var g = Math.round(((n >> 8) & 255) * f);
    var b = Math.round((n & 255) * f);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  /* Een poppetje: een bolletje op een rompje. Klein genoeg om er twaalf naast
     elkaar te zetten zonder dat het een menigte kleuren wordt. */
  function figuur(ctx, cam, tx, ty, kleur, hoed) {
    var p = cam.naarScherm(tx + 0.5, ty + 0.5);
    var s = cam.zoom;
    ctx.fillStyle = 'rgba(20,32,28,.16)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 7 * s, 3.4 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = kleur;
    ctx.beginPath();
    ctx.moveTo(p.x - 4.4 * s, p.y - 1 * s);
    ctx.lineTo(p.x + 4.4 * s, p.y - 1 * s);
    ctx.lineTo(p.x + 3.2 * s, p.y - 13 * s);
    ctx.lineTo(p.x - 3.2 * s, p.y - 13 * s);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = hoed || '#e8d9c4';
    ctx.beginPath();
    ctx.arc(p.x, p.y - 16.5 * s, 4 * s, 0, Math.PI * 2);
    ctx.fill();
    return p;
  }

  A.render.tekenen = {

    teken: function (s, cam, ctx) {
      var pand = s.pand, x, y, i;
      ctx.clearRect(0, 0, cam.breedte, cam.hoogte);

      /* --- de vloer --- */
      for (y = 0; y < pand.diep; y++) {
        for (x = 0; x < pand.breed; x++) {
          var soort = A.core.pand.tegel(pand, x, y);
          if (soort === A.core.pand.BUITEN) continue;
          var wissel = (x + y) % 2 === 0;
          var kl = soort === A.core.pand.WERKVLOER ? (wissel ? KLEUR.werkvloer : KLEUR.werkvloer2)
            : soort === A.core.pand.TOONBANK ? KLEUR.toonbank
              : (wissel ? KLEUR.publiek : KLEUR.publiek2);
          var p = cam.naarScherm(x + 0.5, y + 0.5);
          ruit(ctx, p, cam.halfBreed(), cam.halfHoog());
          ctx.fillStyle = kl;
          ctx.fill();
          ctx.strokeStyle = KLEUR.lijn;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      /* --- muren op de achterranden --- */
      /* Alleen de twee randen die van de kijker af liggen. De voorkant blijft
         open, anders kijk je tegen een dak aan in plaats van in een apotheek.
         Dat is dezelfde doorsnede die elk isometrisch spel gebruikt. */
      for (y = 0; y < pand.diep; y++) {
        for (x = 0; x < pand.breed; x++) {
          if (A.core.pand.tegel(pand, x, y) === A.core.pand.BUITEN) continue;
          if (A.core.pand.tegel(pand, x, y - 1) === A.core.pand.BUITEN) muur(ctx, cam, x, y, 'noord');
          if (A.core.pand.tegel(pand, x - 1, y) === A.core.pand.BUITEN) muur(ctx, cam, x, y, 'west');
        }
      }

      /* --- alles wat rechtop staat, van achter naar voren --- */
      var staand = [];

      /* De toonbank is geen vloerkleur maar een meubel: het is het ding dat de
         publieksruimte van de werkvloer scheidt, en zonder dat leest het pand
         als een tapijt met dozen erop. Bij de balie zit een gat, want daar
         gaat het over de toonbank. */
      for (x = 0; x < pand.breed; x++) {
        if (A.core.pand.tegel(pand, x, 5) !== A.core.pand.TOONBANK) continue;
        if (baliePlek(s, x, 5)) continue;
        (function (tx) {
          staand.push({
            d: tx + 5,
            teken: function () { blok(ctx, cam, tx, 5, 9, KLEUR.toonbank2, 1.0); }
          });
        })(x);
      }

      for (i = 0; i < s.objecten.length; i++) {
        (function (o) {
          var def = A.config.object(o.object);
          staand.push({
            d: o.x + o.y,
            teken: function () {
              var top = blok(ctx, cam, o.x, o.y, def.hoogte, def.kleur, o.object === 'balie' ? 0.95 : 0.8);
              /* Vorderingsboogje als er nu aan dit station gewerkt wordt. */
              var bezig = werkendAan(s, o.object);
              if (bezig) boog(ctx, top, cam.zoom, bezig);
              ctx.font = Math.round(13 * cam.zoom) + 'px system-ui, sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText(def.emoji, top.x, top.y + 5 * cam.zoom);
            }
          });
        })(s.objecten[i]);
      }

      var wachtend = A.core.state.wachtenden(s);
      for (i = 0; i < wachtend.length && i < A.core.pand.WACHTPLEKKEN.length; i++) {
        (function (r, plek) {
          var geduldOp = 1 - (s.tijd - r.binnen) / A.config.inst.geduld;
          var kleur = geduldOp > 0.55 ? '#7d8a92' : geduldOp > 0.25 ? '#c08a3e' : KLEUR.klei;
          staand.push({
            d: plek.x + plek.y,
            teken: function () { figuur(ctx, cam, plek.x, plek.y, kleur); }
          });
        })(wachtend[i], A.core.pand.WACHTPLEKKEN[i]);
      }

      for (i = 0; i < s.personeel.length; i++) {
        (function (p) {
          staand.push({
            d: p.x + p.y + 0.4,
            teken: function () {
              var pos = figuur(ctx, cam, p.x, p.y, p.bezig === 'werken' ? KLEUR.groen : '#4a7f6b', '#f0e2cd');
              naamplaatje(ctx, p.naam, pos.x, pos.y - 25 * cam.zoom, cam.zoom);
            }
          });
        })(s.personeel[i]);
      }

      staand.sort(function (a, b) { return a.d - b.d; });
      for (i = 0; i < staand.length; i++) staand[i].teken();

      /* --- klok in de hoek van de vloer --- */
      if (!s.geopend) {
        ctx.fillStyle = 'rgba(20,32,28,.06)';
        ctx.fillRect(0, 0, cam.breedte, cam.hoogte);
      }
    }
  };

  function baliePlek(s, x, y) {
    var b = A.core.pand.object(s, 'balie');
    return b && b.x === x && b.y === y;
  }

  /* Eén muursegment op de rand van een tegel. Twee vlakken: het bovenvlakje
     dat de dikte laat zien en het staande vlak eronder. */
  function muur(ctx, cam, tx, ty, kant) {
    var hb = cam.halfBreed(), hh = cam.halfHoog();
    var h = 21 * cam.zoom;
    var p = cam.naarScherm(tx + 0.5, ty + 0.5);
    /* Welke ruitzijde grenst aan welke buur: +x loopt op het scherm naar
       rechtsonder en +y naar linksonder, dus de buur op y-1 deelt de
       noordoostzijde (top→rechts) en de buur op x-1 de noordwestzijde
       (links→top). Ze omdraaien levert een schutting op in plaats van een muur. */
    var a, b;
    if (kant === 'noord') { a = { x: p.x, y: p.y - hh }; b = { x: p.x + hb, y: p.y }; }
    else { a = { x: p.x - hb, y: p.y }; b = { x: p.x, y: p.y - hh }; }

    ctx.fillStyle = kant === 'noord' ? KLEUR.muur : KLEUR.muurZij;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(b.x, b.y - h);
    ctx.lineTo(a.x, a.y - h);
    ctx.closePath();
    ctx.fill();

    /* Alleen de bovenrand aanzetten: een lijn om elk segment maakt er weer
       losse panelen van. */
    ctx.strokeStyle = 'rgba(20,32,28,.09)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y - h);
    ctx.lineTo(b.x, b.y - h);
    ctx.stroke();
  }

  function naamplaatje(ctx, tekst, x, y, zoom) {
    ctx.font = '600 ' + Math.round(7.5 * zoom) + 'px system-ui, sans-serif';
    ctx.textAlign = 'center';
    var b = ctx.measureText(tekst).width + 6 * zoom;
    ctx.fillStyle = 'rgba(255,255,255,.66)';
    ctx.beginPath();
    ctx.roundRect(x - b / 2, y - 8 * zoom, b, 10.5 * zoom, 2 * zoom);
    ctx.fill();
    ctx.fillStyle = 'rgba(20,32,28,.62)';
    ctx.fillText(tekst, x, y);
  }

  /* Welk deel van het werk aan dit object is af (0..1), of null. */
  function werkendAan(s, objectId) {
    for (var i = 0; i < s.personeel.length; i++) {
      var p = s.personeel[i];
      if (!p.taak || p.taak.object !== objectId || p.bezig !== 'werken') continue;
      var r = A.core.state.recept(s, p.taak.recept);
      if (!r) continue;
      var totaal = A.config.inst.werk[p.taak.fase] || 1;
      return A.util.clamp(1 - r.rest / totaal, 0, 1);
    }
    return null;
  }

  function boog(ctx, top, zoom, deel) {
    var straal = 13 * zoom;
    ctx.beginPath();
    ctx.arc(top.x, top.y - 16 * zoom, straal, -Math.PI / 2, -Math.PI / 2 + deel * Math.PI * 2);
    ctx.strokeStyle = KLEUR.geel;
    ctx.lineWidth = 3 * zoom;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

})(window.Apotheek);
