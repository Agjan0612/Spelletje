/* Protocollen: het beleid dat de recepten afhandelt waar de speler geen zin in
 * heeft om ze stuk voor stuk te bekijken.
 *
 * Dit draait elke tik over de recepten die op een besluit wachten. Staat de
 * klasse op 'vraag', dan blijft het recept liggen tot de speler klikt. Staat er
 * beleid, dan kiest dit bestand dezelfde handeling als de speler zou doen — via
 * exact dezelfde functie (`recept.doe`), zodat beleid nooit iets kan wat een
 * mens niet kan.
 *
 * Het beleid 'uitzoeken' is de reden dat dit meer is dan een luiheidsknop: het
 * vraagt eerst het gegeven op en beslist dán, en dat is een betere speler dan
 * wie altijd overlegt of altijd doorlaat. */
(function (A) {

  A.core.protocollen = {

    nieuw: function () {
      var st = A.config.protocolStandaard;
      return { A: st.A, B: st.B, controle: st.controle };
    },

    /* Wat zou het beleid nu doen met dit recept? Geeft null als de speler zelf
       aan zet is. Apart van tick() zodat de receptkaart kan laten zien welke
       knop het protocol zou indrukken. */
    keuze: function (s, r) {
      if (r.klasse !== 'A' && r.klasse !== 'B') return null;
      var beleid = s.protocol[r.klasse];
      if (beleid === 'vraag') return null;

      var sig = A.config.signaal(r.signaal);
      var kanOpvragen = sig && sig.vraagt && !r.onthuld && !r.opvraagMislukt;

      if (r.klasse === 'A') {
        if (beleid === 'uitzoeken' && kanOpvragen) return 'opvragen';
        return 'apotheker';
      }

      /* Klasse B */
      if (beleid === 'akkoord') return 'akkoord';
      if (beleid === 'overleg') return 'overleg';
      if (beleid === 'uitzoeken') {
        if (kanOpvragen) return 'opvragen';
        /* Weten we het inmiddels? Dan is het geen gok meer. Weten we het niet
           en valt er niets meer op te vragen, dan is overleggen het veilige
           antwoord — de speler die dit beleid koos vroeg om zorgvuldig. */
        if (r.onthuld) return r.echt ? 'overleg' : 'akkoord';
        return 'overleg';
      }
      return null;
    },

    tick: function (s) {
      for (var i = 0; i < s.recepten.length; i++) {
        var r = s.recepten[i];
        if (r.fase !== 'besluit') continue;
        var keuze = A.core.protocollen.keuze(s, r);
        if (keuze) A.core.recept.doe(s, r.id, keuze);
      }
    }
  };

})(window.Apotheek);
