/* De assistenten. Elke assistent is een klein toestandsmachientje:
 *
 *   vrij → lopen → werken → vrij
 *
 * Meer is het niet, en meer moet het in fase 0 ook niet zijn. Wat er wél echt
 * in zit is de loopafstand: een assistent legt de weg tussen twee stations
 * werkelijk af, dus tijd die aan lopen opgaat is capaciteit die niet aan
 * recepten opgaat. Dat is de reden dat de plattegrond straks een puzzel is en
 * niet alleen een plaatje. */
(function (A) {

  var I = A.config.inst;

  A.core.personeel = {

    tick: function (s, dm) {
      for (var i = 0; i < s.personeel.length; i++) {
        var p = s.personeel[i];

        if (p.bezig === 'vrij') zoekWerk(s, p);
        if (p.bezig === 'lopen') loop(s, p, dm);
        else if (p.bezig === 'werken') werk(s, p, dm);

        s.meting.klokMin += dm;
      }
    },

    /* Deel van de tijd dat het personeel echt aan het werk was. Dit is het
       getal waar het bouwplan om vraagt: rond 0,75–0,85 is speelbaar. */
    bezetting: function (s) {
      var t = s.meting.klokMin;
      if (t <= 0) return 0;
      return (s.meting.werkMin + s.meting.loopMin) / t;
    }
  };

  function zoekWerk(s, p) {
    var r = A.core.werkvloer.volgende(s, p);
    if (!r) { p.taak = null; return; }

    var obj = A.core.werkvloer.objectVoor(r);
    var plek = A.core.pand.werkplek(s, obj);
    r.bezig = true;
    p.taak = { recept: r.id, object: obj, fase: r.fase };
    p.doel = { x: plek.x, y: plek.y };
    p.bezig = 'lopen';
  }

  function loop(s, p, dm) {
    var dx = p.doel.x - p.x, dy = p.doel.y - p.y;
    var afstand = Math.sqrt(dx * dx + dy * dy);
    var stap = I.loopsnelheid * dm;

    s.meting.loopMin += dm;

    if (afstand <= stap || afstand < 0.001) {
      p.x = p.doel.x; p.y = p.doel.y;
      p.bezig = 'werken';
      return;
    }
    p.x += dx / afstand * stap;
    p.y += dy / afstand * stap;
  }

  function werk(s, p, dm) {
    var r = A.core.state.recept(s, p.taak.recept);
    /* De patiënt kan intussen zijn weggelopen. Dan valt het werk weg — niet
       netjes voor de assistent, wel eerlijk voor de speler. */
    if (!r || r.fase === 'weg' || r.fase === 'af') { laatLos(s, p, r); return; }

    s.meting.werkMin += dm;
    r.rest -= dm;
    if (r.rest > 0) return;

    A.core.werkvloer.rond(s, r);
    laatLos(s, p, r);
  }

  function laatLos(s, p, r) {
    if (r) r.bezig = false;
    p.taak = null;
    p.doel = null;
    p.bezig = 'vrij';
  }

})(window.Apotheek);
