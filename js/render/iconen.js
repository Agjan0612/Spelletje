/* Eigen icoonset — vervangt de OS-emoji door één samenhangende grafische taal.
 *
 * Waarom: emoji zien er op elke machine anders uit en lezen als placeholder. Eén
 * set handgetekende glyphs geeft het spel een eigen gezicht, en — belangrijk —
 * exact hetzelfde in de DOM (HUD) als op het canvas (gebouw-badges, floaters).
 *
 * Elke icoon is een transformloze SVG op een 24×24 raster: alleen path/circle/
 * rect/polygon met fill/stroke, GEEN `transform`-attributen, want Pixi's SVG-
 * parser negeert die. Zo tekent dezelfde string identiek in beide werelden:
 *   - DOM:  iconen.svg(sleutel) → een <svg>-string voor innerHTML
 *   - Pixi: iconen.pixi(sleutel) → een PIXI.Container met de icoon
 *
 * De sleutels zijn de resource-id's plus een handvol gebouw-categorieën voor de
 * gebouwen die niets produceren (een badge toont anders de icoon van wat het
 * gebouw máákt — zie badgeVoorGebouw). */
(function (Game) {

  var I = {};

  /* Inhoud per sleutel: de kinderen van de <svg>. Stijl: gevulde silhouetten met
     een donkere contour, in de eigen kleur van de grondstof. */
  var INHOUD = {
    /* ---- grondstoffen ---- */
    vlees:
      '<circle cx="10" cy="14" r="6.2" fill="#c0664a" stroke="#7d3527" stroke-width="1.4"/>' +
      '<circle cx="10" cy="14" r="2.4" fill="#a8412f"/>' +
      '<path d="M14.2 9.8 L18.6 5.4 A2 2 0 1 1 19.8 6.6 L15.4 11 Z" fill="#f2e6d2" stroke="#c1a578" stroke-width="1.1" stroke-linejoin="round"/>',
    hout:
      '<ellipse cx="8" cy="9.5" rx="5" ry="3.8" fill="#9a6f3e" stroke="#5f4326" stroke-width="1.3"/>' +
      '<ellipse cx="15.5" cy="12" rx="5" ry="3.8" fill="#a5794a" stroke="#5f4326" stroke-width="1.3"/>' +
      '<ellipse cx="9" cy="15.5" rx="5" ry="3.8" fill="#8a6236" stroke="#5f4326" stroke-width="1.3"/>' +
      '<ellipse cx="8" cy="9.5" rx="1.9" ry="1.4" fill="#c8a56e"/>' +
      '<ellipse cx="15.5" cy="12" rx="1.9" ry="1.4" fill="#c8a56e"/>' +
      '<ellipse cx="9" cy="15.5" rx="1.9" ry="1.4" fill="#c8a56e"/>',
    steen:
      '<path d="M3.5 17 A7 5 0 0 1 17.5 17 Z" fill="#9aa0a6" stroke="#5f646a" stroke-width="1.3" stroke-linejoin="round"/>' +
      '<path d="M8 11 A5 4 0 0 1 18.5 11 Z" fill="#b3b8bd" stroke="#5f646a" stroke-width="1.3" stroke-linejoin="round"/>',
    ijzer:
      '<path d="M4.5 16 L8 11 H16 L19.5 16 Z" fill="#8794a3" stroke="#4d5764" stroke-width="1.3" stroke-linejoin="round"/>' +
      '<path d="M8 11 H16 L17.4 13 H6.6 Z" fill="#aab4c0"/>',
    koper:
      '<path d="M4.5 16 L8 11 H16 L19.5 16 Z" fill="#c47b3a" stroke="#8a5424" stroke-width="1.3" stroke-linejoin="round"/>' +
      '<path d="M8 11 H16 L17.4 13 H6.6 Z" fill="#e0a05c"/>',
    edelsteen:
      '<path d="M12 3 L18 8 L12 21 L6 8 Z" fill="#63c6d6" stroke="#2f7f8c" stroke-width="1.3" stroke-linejoin="round"/>' +
      '<path d="M6 8 H18 M12 3 L9 8 L12 21 L15 8 Z" fill="#8fe0ec" stroke="#2f7f8c" stroke-width="1"/>',
    graan:
      '<path d="M12 22 V7" stroke="#a8863a" stroke-width="1.4" fill="none" stroke-linecap="round"/>' +
      '<path d="M12 12 L8 10 M12 12 L16 10 M12 16 L8 14 M12 16 L16 14" stroke="#a8863a" stroke-width="1.3" fill="none" stroke-linecap="round"/>' +
      '<path d="M12 3.5 C13.6 5 13.6 8 12 9.5 C10.4 8 10.4 5 12 3.5 Z" fill="#e6c76c" stroke="#a8863a" stroke-width="1"/>' +
      '<path d="M7.3 6.6 C9.3 7.4 10.3 9.6 9.8 11.4 C7.8 10.6 6.8 8.4 7.3 6.6 Z" fill="#e6c76c" stroke="#a8863a" stroke-width="1"/>' +
      '<path d="M16.7 6.6 C14.7 7.4 13.7 9.6 14.2 11.4 C16.2 10.6 17.2 8.4 16.7 6.6 Z" fill="#e6c76c" stroke="#a8863a" stroke-width="1"/>',
    brood:
      '<path d="M4 15 A8 5 0 0 1 20 15 A2 2 0 0 1 18 17 H6 A2 2 0 0 1 4 15 Z" fill="#d2a05a" stroke="#9a6f34" stroke-width="1.3" stroke-linejoin="round"/>' +
      '<path d="M8.5 11.5 L10 14.4 M12 10.6 V14.6 M15.5 11.5 L14 14.4" stroke="#9a6f34" stroke-width="1.2" fill="none" stroke-linecap="round"/>',
    gereedschap:
      '<path d="M12.6 3.2 L18.2 6.4 L16.2 9.8 L10.6 6.6 Z" fill="#9aa0a6" stroke="#5f646a" stroke-width="1.2" stroke-linejoin="round"/>' +
      '<path d="M12.4 6.6 L5.6 18.4" stroke="#8a5f34" stroke-width="2.6" stroke-linecap="round"/>',
    wol:
      '<circle cx="12" cy="13" r="7" fill="#eee8db" stroke="#b8ad93" stroke-width="1.3"/>' +
      '<path d="M6 11 Q12 15 18 11 M6 15 Q12 19 18 15" stroke="#c9bfa4" stroke-width="1" fill="none"/>' +
      '<path d="M9 6.5 Q12 12 9 19 M15 6.5 Q12 12 15 19" stroke="#c9bfa4" stroke-width="1" fill="none"/>',
    kleding:
      '<path d="M9 4 L5 7 L7 10.5 L9 9 V20 H15 V9 L17 10.5 L19 7 L15 4 L13.2 6 H10.8 Z" fill="#8a6a9a" stroke="#5c4568" stroke-width="1.3" stroke-linejoin="round"/>',
    hop:
      '<path d="M12 3 C16 6 16 15 12 20 C8 15 8 6 12 3 Z" fill="#8faa5c" stroke="#5f7a3a" stroke-width="1.2" stroke-linejoin="round"/>' +
      '<path d="M12 5 V19 M8.6 9 Q12 11 15.4 9 M8.2 13 Q12 15 15.8 13" stroke="#5f7a3a" stroke-width="1" fill="none"/>',
    bier:
      '<path d="M6 8 H15 V19 A2 2 0 0 1 13 21 H8 A2 2 0 0 1 6 19 Z" fill="#c98a2a" stroke="#8a5a18" stroke-width="1.3" stroke-linejoin="round"/>' +
      '<path d="M15 10 H17.4 A2.4 2.4 0 0 1 17.4 15 H15" fill="none" stroke="#8a5a18" stroke-width="1.3"/>' +
      '<path d="M5 8 Q5 4.6 8.2 4.8 Q9.4 2.8 11.4 4 Q13.6 3.2 14.4 5.2 Q16.8 5.2 16 8 Z" fill="#f2e6cf" stroke="#c9b48f" stroke-width="1" stroke-linejoin="round"/>',
    munten:
      '<ellipse cx="12" cy="16.5" rx="7" ry="2.6" fill="#e0c05a" stroke="#a8863a" stroke-width="1.2"/>' +
      '<ellipse cx="12" cy="13.2" rx="7" ry="2.6" fill="#e8cd6e" stroke="#a8863a" stroke-width="1.2"/>' +
      '<ellipse cx="12" cy="9.9" rx="7" ry="2.6" fill="#f0da85" stroke="#a8863a" stroke-width="1.2"/>' +
      '<circle cx="12" cy="9.9" r="1.4" fill="#c9a63f"/>',

    /* ---- opslag-soorten (voorraadVoedsel wordt hieronder gezet) ---- */
    voorraadGoed:
      '<rect x="4" y="7" width="16" height="12" rx="1" fill="#a5794a" stroke="#5f4326" stroke-width="1.3"/>' +
      '<path d="M4 8 L20 18 M20 8 L4 18" stroke="#5f4326" stroke-width="1.1" fill="none"/>',
    voorraadSchat:
      '<rect x="4" y="10" width="16" height="9" rx="1" fill="#8a5a34" stroke="#4d3016" stroke-width="1.3"/>' +
      '<path d="M4 12 A8 3 0 0 1 20 12 V13 H4 Z" fill="#a5794a" stroke="#4d3016" stroke-width="1.3"/>' +
      '<rect x="10.6" y="12.5" width="2.8" height="4" rx="0.5" fill="#e0c05a" stroke="#a8863a" stroke-width="1"/>',

    /* ---- gebouw-categorieën (voor wat niets produceert) ---- */
    wonen:
      '<path d="M4 12 L12 5 L20 12 V20 H4 Z" fill="#b06a4a" stroke="#5c3320" stroke-width="1.4" stroke-linejoin="round"/>' +
      '<path d="M3 12.5 L12 4.5 L21 12.5" fill="none" stroke="#5c3320" stroke-width="1.4" stroke-linejoin="round"/>' +
      '<rect x="10" y="14" width="4" height="6" fill="#5c3320"/>',
    geloof:
      '<path d="M6 20 V10 L12 5 L18 10 V20 Z" fill="#dcd3bd" stroke="#6a6258" stroke-width="1.3" stroke-linejoin="round"/>' +
      '<rect x="11.2" y="2.5" width="1.6" height="6" fill="#8a6a3a"/><rect x="9.5" y="4.2" width="5" height="1.6" fill="#8a6a3a"/>' +
      '<rect x="10.6" y="14" width="2.8" height="6" fill="#6a6258"/>',
    opslag:
      '<rect x="4" y="7" width="16" height="12" rx="1" fill="#a5794a" stroke="#5f4326" stroke-width="1.3"/>' +
      '<path d="M4 8 L20 18 M20 8 L4 18" stroke="#5f4326" stroke-width="1.1" fill="none"/>',
    handel:
      '<ellipse cx="12" cy="16.5" rx="7" ry="2.6" fill="#e0c05a" stroke="#a8863a" stroke-width="1.2"/>' +
      '<ellipse cx="12" cy="13.2" rx="7" ry="2.6" fill="#e8cd6e" stroke="#a8863a" stroke-width="1.2"/>' +
      '<ellipse cx="12" cy="9.9" rx="7" ry="2.6" fill="#f0da85" stroke="#a8863a" stroke-width="1.2"/>',
    verdediging:
      '<path d="M12 3 L19 6 V12 C19 16.5 16 19.5 12 21 C8 19.5 5 16.5 5 12 V6 Z" fill="#8794a3" stroke="#455060" stroke-width="1.4" stroke-linejoin="round"/>' +
      '<path d="M12 3 V21 M5 8.5 H19" stroke="#455060" stroke-width="1"/>',
    voorziening:
      '<path d="M12 21 C8.5 21 6 18 6 14.5 C6 10.5 12 4 12 4 C12 4 18 10.5 18 14.5 C18 18 15.5 21 12 21 Z" fill="#5aa6c4" stroke="#2f6f88" stroke-width="1.3" stroke-linejoin="round"/>' +
      '<path d="M9.5 15 C9.5 17 10.6 18.4 12 18.6" fill="none" stroke="#cdeaf4" stroke-width="1.2" stroke-linecap="round"/>',
    bestuur:
      '<path d="M4 20 V11 H20 V20 Z" fill="#d3c39c" stroke="#6a5236" stroke-width="1.3"/>' +
      '<path d="M3 11 L12 5 L21 11 Z" fill="#b99a6a" stroke="#6a5236" stroke-width="1.3" stroke-linejoin="round"/>' +
      '<rect x="7" y="13" width="1.8" height="7" fill="#6a5236"/><rect x="11.1" y="13" width="1.8" height="7" fill="#6a5236"/><rect x="15.2" y="13" width="1.8" height="7" fill="#6a5236"/>',
    kennis:
      '<path d="M4 6 C7 4.5 10 4.5 12 6 V19 C10 17.5 7 17.5 4 19 Z" fill="#b5623f" stroke="#6a3620" stroke-width="1.3" stroke-linejoin="round"/>' +
      '<path d="M20 6 C17 4.5 14 4.5 12 6 V19 C14 17.5 17 17.5 20 19 Z" fill="#c47a52" stroke="#6a3620" stroke-width="1.3" stroke-linejoin="round"/>' +
      '<path d="M12 6 V19" stroke="#6a3620" stroke-width="1.1"/>',
    herberg:
      '<path d="M6 8 H15 V19 A2 2 0 0 1 13 21 H8 A2 2 0 0 1 6 19 Z" fill="#c98a2a" stroke="#8a5a18" stroke-width="1.3" stroke-linejoin="round"/>' +
      '<path d="M15 10 H17.4 A2.4 2.4 0 0 1 17.4 15 H15" fill="none" stroke="#8a5a18" stroke-width="1.3"/>' +
      '<path d="M5 8 Q5 4.6 8.2 4.8 Q9.4 2.8 11.4 4 Q13.6 3.2 14.4 5.2 Q16.8 5.2 16 8 Z" fill="#f2e6cf" stroke="#c9b48f" stroke-width="1" stroke-linejoin="round"/>',
    jacht:
      '<circle cx="12" cy="12" r="8.5" fill="none" stroke="#7d5230" stroke-width="1.4"/>' +
      '<circle cx="12" cy="12" r="4" fill="none" stroke="#7d5230" stroke-width="1.3"/>' +
      '<circle cx="12" cy="12" r="1.3" fill="#a63a2a"/>' +
      '<path d="M12 1.5 V6 M12 18 V22.5 M1.5 12 H6 M18 12 H22.5" stroke="#7d5230" stroke-width="1.4" stroke-linecap="round"/>',
    vis:
      '<path d="M4 12 C7 7 13 7 17 12 C13 17 7 17 4 12 Z" fill="#6aa9b8" stroke="#356470" stroke-width="1.3" stroke-linejoin="round"/>' +
      '<path d="M17 12 L21 8 V16 Z" fill="#6aa9b8" stroke="#356470" stroke-width="1.3" stroke-linejoin="round"/>' +
      '<circle cx="8" cy="11" r="1.1" fill="#153038"/>',
    ambacht:
      '<path d="M12.6 3.2 L18.2 6.4 L16.2 9.8 L10.6 6.6 Z" fill="#9aa0a6" stroke="#5f646a" stroke-width="1.2" stroke-linejoin="round"/>' +
      '<path d="M12.4 6.6 L5.6 18.4" stroke="#8a5f34" stroke-width="2.6" stroke-linecap="round"/>'
  };

  /* Opslag-voedsel: een mand met een korenschoof. */
  INHOUD.voorraadVoedsel =
    '<path d="M5 9 H19 L17.6 19.5 A1.4 1.4 0 0 1 16.2 21 H7.8 A1.4 1.4 0 0 1 6.4 19.5 Z" fill="#c79a5a" stroke="#8a6234" stroke-width="1.3" stroke-linejoin="round"/>' +
    '<path d="M6 12 H18 M6.6 15.5 H17.4" stroke="#8a6234" stroke-width="1" fill="none"/>' +
    '<path d="M8 9 Q12 3 16 9" fill="none" stroke="#a8863a" stroke-width="1.3"/>' +
    '<path d="M12 3.5 C13.4 5 13.4 7.5 12 9 C10.6 7.5 10.6 5 12 3.5 Z" fill="#e6c76c" stroke="#a8863a" stroke-width="1"/>';

  /* Volledige SVG-string (voor DOM-innerHTML of Pixi's svg-parser). */
  I.svg = function (sleutel, maat) {
    var inhoud = INHOUD[sleutel];
    if (!inhoud) return '';
    var m = maat || 24;
    return '<svg width="' + m + '" height="' + m + '" viewBox="0 0 24 24" ' +
      'xmlns="http://www.w3.org/2000/svg">' + inhoud + '</svg>';
  };

  I.heeft = function (sleutel) { return !!INHOUD[sleutel]; };

  /* SVG-string als de sleutel bestaat, anders de meegegeven emoji — voor tekst-
     contexten (kosten-chips e.d.) die nu nog een emoji tonen. */
  I.htmlOfEmoji = function (sleutel, maat, emoji) {
    return INHOUD[sleutel] ? I.svg(sleutel, maat) : (emoji || '');
  };

  /* Welke icoon hoort bij een grondstof-id (identiek aan de id, mits bekend). */
  I.resSleutel = function (id) { return INHOUD[id] ? id : null; };

  /* De badge-icoon voor een gebouw: eerst wat het produceert (dan draagt de badge
     echte betekenis), anders een categorie-glyph. */
  I.badgeVoorGebouw = function (d) {
    if (!d) return 'wonen';
    if (d.wint && d.wint.res && INHOUD[d.wint.res]) return d.wint.res;
    if (d.maakt && d.maakt.uit) { for (var k in d.maakt.uit) { if (INHOUD[k]) return k; } }
    var id = d.id || '';
    if (d.woonruimte) return 'wonen';
    if (/kapel|kerk|klooster|abdij|dom/.test(id)) return 'geloof';
    if (/universiteit|school|biblio|academie/.test(id)) return 'kennis';
    if (/herberg|taveerne|taverne|kroeg/.test(id)) return 'herberg';
    if (/markt|handel|beurs|gilde/.test(id)) return 'handel';
    if (/put|bad|fontein|bron/.test(id)) return 'voorziening';
    if (/stadhuis|burcht|kasteel|paleis|donjon|raadhuis/.test(id)) return 'bestuur';
    if (/vis|haven|vijver/.test(id)) return 'vis';
    if (/jacht|jager/.test(id)) return 'jacht';
    if (d.verdediging || d.verdPerWerker || /muur|toren|poort|wal|kanteel|bolwerk/.test(id)) return 'verdediging';
    if (d.opslag || d.opslagPer) return 'opslag';
    if (d.wint || d.maakt) return 'ambacht';
    return 'wonen';
  };

  /* Een PIXI.Container met de icoon, geschaald op een doelhoogte (px) en met de
     pivot onderaan-midden zodat hij als badge boven een nok hangt. Elke aanroep
     bouwt een verse Graphics (badges worden zelden herbouwd, niet per frame). */
  I.pixi = function (sleutel, hoogte) {
    var PIXI = window.PIXI;
    var inhoud = INHOUD[sleutel];
    if (!PIXI || !inhoud) return null;
    var g = new PIXI.Graphics();
    try { g.svg(I.svg(sleutel, 24)); } catch (e) { return null; }
    var schaal = (hoogte || 16) / 24;
    g.scale.set(schaal);
    var c = new PIXI.Container();
    c.addChild(g);
    /* pivot op onder-midden van de 24×24-icoon, in container-coördinaten. */
    c.pivot.set(12 * schaal, 24 * schaal);
    return c;
  };

  Game.render = Game.render || {};
  Game.render.iconen = I;

})(window.Game);
