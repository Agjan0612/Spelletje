/* Image atlas — optional pretty sprites layered on top of the shape/emoji
   drawing. Every asset is a local CC0 file (Kenney "RTS Pack: Medieval",
   see assets/kenney/). Paths are relative so file:// and the Pages
   subdirectory both work.

   Nothing here touches Game.state: the images live only in this module, so a
   save stays pure JSON. If an image has not loaded yet (or is missing) the
   callers fall back to the original canvas drawing, so the game never breaks
   without the assets. */
(function (Game) {

  var A = {};

  var BASIS = 'assets/kenney/';
  var ISO_BASIS = 'assets/iso/';   /* optional hand-drawn / generated iso art */
  var beelden = {};          /* sleutel -> { img, klaar } */

  function pad(naam) {
    var map = { s: 'structure/', e: 'environment/', u: 'unit/' };
    return BASIS + (map[naam.charAt(0)] || '') + naam + '.png';
  }

  /* Load an image under an explicit key + source. The onerror keeps a missing
     file harmless: the key just never becomes `klaar`, so callers fall back. */
  function laadBron(sleutel, src) {
    if (beelden[sleutel]) return;
    var img = new Image();
    var rec = { img: img, klaar: false };
    img.onload = function () { rec.klaar = img.naturalWidth > 0; };
    img.onerror = function () { rec.klaar = false; };
    img.src = src;
    beelden[sleutel] = rec;
  }

  function laad(naam) { laadBron(naam, pad(naam)); }

  /* ---- building id -> Structure sprite. Reuse is fine: mines all share one
     "mine mouth", churches share one chapel, etc. Buildings not listed keep
     their hand-drawn look (molen keeps its turning sails on top). ---- */
  A.gebouwMap = {
    dorpsplein: 's21', huisje: 's17', boerderij: 's19',
    houthakkershut: 's01', jachthut: 's10', vissershut: 's16',
    steengroeve: 's08', voorraadschuur: 's07', waterput: 's12',
    bakkerij: 's23', marktplaats: 's22', kapel: 's04',
    kopermijn: 's08', ijzermijn: 's08', wachttoren: 's05',
    smederij: 's20', wapensmid: 's05', kazerne: 's02',
    herberg: 's09', kerk: 's04', edelsteenmijn: 's08',
    gildehuis: 's03', pakhuis: 's07', herenhuis: 's18',
    stadhuis: 's06', juwelier: 's09', handelshuis: 's06',
    universiteit: 's03', kathedraal: 's04', kasteel: 's02'
    /* stadsmuur keeps its coded wall so it tiles cleanly; molen keeps its
       hand-drawn body so its sails can turn. */
  };

  /* ---- optional true iso building art (Spoor D). Empty by default, so no
     requests are made and the polished procedural volumes stay the default.
     To switch a building over to a real iso sprite, drop `assets/iso/<file>.png`
     in place and add an entry here: `stadhuis: 'stadhuis'`. tekenGebouw picks it
     up automatically, and falls back to the procedural volume if it is missing
     or still loading — the same never-breaks contract the trees/rocks use. ---- */
  A.isoGebouwMap = {};

  function isoPad(best) { return ISO_BASIS + best + '.png'; }

  /* Trees for a bos tile and rocks for a rots tile. */
  var BOMEN = ['e04', 'e03', 'e02', 'e01'];
  var ROTSEN = ['e08', 'e09', 'e11', 'e10', 'e12'];

  /* job id -> villager sprite, so a fisher looks different from a soldier. */
  A.werkerMap = {
    boer: 'u05', houthakker: 'u09', jager: 'u13', visser: 'u01',
    steenhouwer: 'u21', mijnwerker: 'u21', bakker: 'u06', molenaar: 'u11',
    smid: 'u20', wapensmid: 'u20', handelaar: 'u04', waard: 'u07',
    priester: 'u22', juwelier: 'u23', geleerde: 'u16', soldaat: 'u20',
    bouwer: 'u08', werkloos: 'u05'
  };

  /* -------------------------------------------------------------- laden --- */

  A.laden = function () {
    var set = {};
    Object.keys(A.gebouwMap).forEach(function (k) { set[A.gebouwMap[k]] = 1; });
    Object.keys(A.werkerMap).forEach(function (k) { set[A.werkerMap[k]] = 1; });
    BOMEN.forEach(function (n) { set[n] = 1; });
    ROTSEN.forEach(function (n) { set[n] = 1; });
    Object.keys(set).forEach(laad);
    /* Preload only the iso building art that has actually been registered. */
    Object.keys(A.isoGebouwMap).forEach(function (id) {
      laadBron('iso:' + id, isoPad(A.isoGebouwMap[id]));
    });
  };

  /* --------------------------------------------------------------- api ---- */

  /* Returns the loaded <img> for a name, or null while it is still loading /
     missing so the caller can fall back to canvas drawing. */
  A.get = function (naam) {
    var r = beelden[naam];
    return (r && r.klaar) ? r.img : null;
  };

  A.gebouw = function (id) {
    var naam = A.gebouwMap[id];
    return naam ? A.get(naam) : null;
  };

  /* Loaded iso building sprite for an id, or null (missing / still loading /
     not registered) so the caller falls back to the procedural volume. */
  A.isoGebouw = function (id) {
    return A.isoGebouwMap[id] ? A.get('iso:' + id) : null;
  };

  /* Asset path for a building's sprite (for use as an <img> src in the UI), or
     null if the building has no sprite. */
  A.gebouwPad = function (id) {
    var naam = A.gebouwMap[id];
    return naam ? pad(naam) : null;
  };

  /* Pick a tree/rock deterministically from the tile's stable random `v`, so a
     tile always draws the same sprites and does not flicker between frames. */
  A.boom = function (v, i) {
    return A.get(BOMEN[Math.floor((v * 97 + i * 31) % BOMEN.length + BOMEN.length) % BOMEN.length]);
  };
  A.rots = function (v, i) {
    return A.get(ROTSEN[Math.floor((v * 89 + i * 41) % ROTSEN.length + ROTSEN.length) % ROTSEN.length]);
  };

  A.werker = function (baan) {
    var naam = A.werkerMap[baan] || A.werkerMap.werkloos;
    return A.get(naam);
  };

  Game.render.atlas = A;

  /* Start preloading immediately; new Image() needs no DOM. */
  A.laden();

})(window.Game);
