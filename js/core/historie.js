/* De geschiedenis van je stad in cijfers.
 *
 * state.statistiek(s) geeft een momentopname en verder werd er niets bewaard:
 * je zag dát de tevredenheid 48 was, nooit dat hij drie winters geleden nog op
 * 80 stond. Dat maakt van elk probleem een raadsel — en van elke balansmeting
 * giswerk.
 *
 * Dit is de goedkoopst denkbare oplossing: één meting per seizoen in een ring
 * buffer op `s.historie`. Vier metingen per jaar, zestig jaar diep, korte
 * sleutels; dat is een paar kilobyte in een save die er al honderden telt, en
 * het blijft gewoon JSON. Alles wat gemeten wordt is afgeleid van de toestand
 * op dat moment — er wordt niets bewaard dat elders al gezaghebbend is.
 */
(function (Game) {

  var H = {};

  /* Vier per jaar, zestig jaar. Daarna schuift de oudste eruit. */
  H.MAX = 240;

  H.zorg = function (s) {
    if (!Array.isArray(s.historie)) s.historie = [];
  };

  /* Eén meting. De sleutels zijn kort omdat ze duizenden keren in een save
     terechtkomen: k = kwartaal, b = bevolking, t = tevredenheid, v = voedsel,
     m = munten, g = gebouwen, p = tijdperk. */
  H.meet = function (s, kwartaal) {
    var voedsel = 0;
    Game.config.voedselSoorten.forEach(function (r) { voedsel += s.res[r] || 0; });
    var gebouwd = 0;
    for (var i = 0; i < s.gebouwen.length; i++) if (s.gebouwen[i].gebouwd) gebouwd++;
    return {
      k: kwartaal,
      b: s.bevolking.totaal,
      t: Math.round(s.tevredenheid),
      v: Math.round(voedsel),
      m: Math.round(s.res.munten || 0),
      g: gebouwd,
      p: s.tijdperk
    };
  };

  H.tick = function (s) {
    H.zorg(s);
    var kwartaal = s.jaar * 4 + s.seizoen;
    var laatste = s.historie[s.historie.length - 1];
    if (laatste && laatste.k === kwartaal) return;
    /* Een geladen save kan midden in een seizoen verder gaan; dan hoort de
       eerste meting van dat seizoen er alsnog bij te komen. */
    s.historie.push(H.meet(s, kwartaal));
    if (s.historie.length > H.MAX) s.historie.shift();
  };

  /* Waar in de reeks een tijdperk begon — de verticale strepen in de grafiek. */
  H.tijdperkGrenzen = function (s) {
    H.zorg(s);
    var uit = [];
    for (var i = 1; i < s.historie.length; i++) {
      if (s.historie[i].p !== s.historie[i - 1].p) {
        uit.push({ index: i, tijdperk: s.historie[i].p });
      }
    }
    return uit;
  };

  /* Het jaar/seizoen van een meting, voor de bijschriften. */
  H.label = function (punt) {
    return 'jaar ' + Math.floor(punt.k / 4) + ' · ' +
      Game.core.state.SEIZOENEN[punt.k % 4];
  };

  Game.core.historie = H;

})(window.Game);
