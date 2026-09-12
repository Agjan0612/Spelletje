/* De receptkaart — de plek waar de speler het spel speelt.
 *
 * Wat er sinds fase 0 bij is gekomen is één idee: informatie is een grondstof.
 * De kaart laat expliciet zien wát je niet weet, en wat het je kost om daar
 * verandering in te brengen. Zolang het gegeven grijs is, is elke keuze een gok;
 * daarna is het een oordeel. Dat verschil is het onderwerp van deze fase.
 *
 * De knoppen komen uit `recept.mogelijk()` en de handeling gaat door
 * `recept.doe()` — dezelfde functies die het protocol en het balansharnas
 * gebruiken. Er is dus geen pad waarop de speler iets kan wat het beleid niet
 * kan, of andersom. */
(function (A) {

  var open = null;

  A.ui.receptkaart = {

    toon: function (s, id) {
      if (typeof document === 'undefined') return;
      var kaart = document.getElementById('receptkaart');
      var r = A.core.state.recept(s, id);
      if (!kaart || !r || r.fase !== 'besluit') return;
      open = id;

      var sig = A.config.signaal(r.signaal);
      var wachtend = Math.round(s.tijd - r.binnen);

      kaart.className = 'kaart';
      kaart.innerHTML =
        '<div class="rk-kop"><span class="t"><span class="klasse ' + sig.klasse.toLowerCase() + '">' +
        sig.klasse + '</span> Recept ' + r.nr + '</span>' +
        '<span class="n">binnen ' + A.util.klok(r.binnen) + ' · wacht ' + wachtend + ' min</span></div>' +

        '<div class="rk-patient"><span class="nm">' + esc(r.patient) + '</span>' +
        '<span class="feit">' + r.leeftijd + ' jr</span>' +
        '<span class="feit">' + (r.wacht ? 'wacht in de zaak' : 'haalt later op') + '</span></div>' +

        dossier(r, sig) +
        voorschrift(sig) +
        signaalblok(sig) +
        oordeelblok(r, sig) +
        '<div class="rk-acties"></div>';

      var acties = kaart.querySelector('.rk-acties');
      var mogelijk = A.core.recept.mogelijk(s, r);
      for (var i = 0; i < mogelijk.length; i++) {
        (function (b) {
          var knop = A.util.el('button', 'knop' + (b.id === 'akkoord' ? ' dof' : ''), b.naam);
          knop.type = 'button';
          knop.title = b.omschrijving;
          if (b.id === 'opvragen' && sig.vraagt) knop.textContent = naamVanGegeven(sig.vraagt);
          knop.addEventListener('click', function () {
            A.core.recept.doe(s, r.id, b.id);
            A.ui.receptkaart.sluit();
            A.ui.werklijst.ververs(s, true);
          });
          acties.appendChild(knop);
        })(mogelijk[i]);
      }
      var later = A.util.el('button', 'knop dof', 'Later');
      later.type = 'button';
      later.addEventListener('click', A.ui.receptkaart.sluit);
      acties.appendChild(later);
    },

    sluit: function () {
      if (typeof document === 'undefined') return;
      var kaart = document.getElementById('receptkaart');
      if (kaart) kaart.className = 'kaart verborgen';
      open = null;
    },

    /* Als het getoonde recept intussen weggelopen of doorgeschoven is, moet de
       kaart weg — anders klikt de speler op een besluit dat niet meer bestaat. */
    ververs: function (s) {
      if (!open) return;
      var r = A.core.state.recept(s, open);
      if (!r || r.fase !== 'besluit') A.ui.receptkaart.sluit();
    },

    /* Het eerstvolgende open besluit, voor de sneltoets. */
    volgende: function (s) {
      var b = A.core.state.besluiten(s);
      if (b.length) A.ui.receptkaart.toon(s, b[0].id);
    },

    open: function () { return open; }
  };

  /* Het dossier, en vooral: het gat erin. Grijs met een stippellijn betekent
     "dit weet je niet, en dit is precies wat je zou moeten weten". */
  function dossier(r, sig) {
    if (!sig.vraagt) {
      return '<div class="rk-dossier"><span class="feit vol">Aan het recept zelf te zien — ' +
        'hier helpt opvragen niet.</span></div>';
    }
    var naam = naamVanGegeven(sig.vraagt);
    if (r.onthuld) {
      return '<div class="rk-dossier"><span class="feit vol">' + esc(r.gegeven.lang) + '</span></div>';
    }
    if (r.opvraagMislukt) {
      return '<div class="rk-dossier"><span class="feit mislukt">' + esc(naam) +
        ' — niet gevonden. Je zult zonder moeten beslissen.</span></div>';
    }
    return '<div class="rk-dossier"><span class="feit leeg">' + esc(naam) +
      ' — niet opgevraagd</span></div>';
  }

  function voorschrift(sig) {
    var uit = '<div class="rk-blok"><div class="rk-label">Voorschrift</div><div class="rk-regels">' +
      '<div class="rk-regel nieuw"><span class="mid">' + esc(sig.middel) + '</span><span class="tag">nieuw</span></div>';
    for (var i = 0; i < sig.naast.length; i++) {
      uit += '<div class="rk-regel"><span class="mid">' + esc(sig.naast[i]) +
        '</span><span class="tag">in gebruik</span></div>';
    }
    return uit + '</div></div>';
  }

  function signaalblok(sig) {
    return '<div class="rk-blok"><div class="rk-label">Signaal</div>' +
      '<div class="rk-sig"><span class="klasse ' + sig.klasse.toLowerCase() + '">' + sig.klasse + '</span>' +
      '<span class="tk"><b>' + esc(sig.tekst) + '</b><span>' + esc(sig.uitleg) + '</span></span></div></div>';
  }

  /* Pas als het gegeven binnen is, staat hier wat het betekent. Dat is het hele
     verschil tussen gokken en beoordelen, en het hoort dus ook pas dan te
     verschijnen. */
  function oordeelblok(r, sig) {
    if (!r.onthuld) return '';
    var terecht = r.echt;
    return '<div class="rk-oordeel ' + (terecht ? 'terecht' : 'loos') + '">' +
      '<b>' + (terecht ? 'Terecht' : 'Valt mee') + '</b> ' +
      esc(terecht ? sig.terecht : sig.loos) + '</div>';
  }

  function naamVanGegeven(soort) {
    if (soort === 'nierfunctie') return 'Nierfunctie opvragen';
    if (soort === 'allergie') return 'Allergie navragen';
    return 'Afleverhistorie bekijken';
  }

  function esc(t) {
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

})(window.Apotheek);
