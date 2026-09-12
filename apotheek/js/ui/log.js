/* Het logboek. Schrijft naar de speltoestand én naar het scherm.
 *
 * Dat het ook in de toestand landt is met opzet: het harnas draait zonder DOM
 * en moet toch kunnen zien wat er gebeurd is. Vandaar dat elke functie hier
 * eerst controleert of er überhaupt een document is. */
(function (A) {

  var MAX = 60;

  A.ui.log = {

    schrijf: function (s, tekst) {
      if (!s) return;
      s.log.push({ tijd: s.tijd, tekst: tekst });
      if (s.log.length > MAX) s.log.shift();
      A.ui.log.ververs(s);
    },

    ververs: function (s) {
      if (typeof document === 'undefined') return;
      var box = document.getElementById('logbox');
      if (!box) return;
      var uit = '';
      for (var i = Math.max(0, s.log.length - 7); i < s.log.length; i++) {
        var r = s.log[i];
        uit += '<div class="logregel"><span class="t">' + A.util.klok(r.tijd) + '</span>' +
          escape(r.tekst) + '</div>';
      }
      box.innerHTML = uit;
      box.scrollTop = box.scrollHeight;
    }
  };

  function escape(t) {
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

})(window.Apotheek);
