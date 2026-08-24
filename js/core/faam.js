/* De vrijstad: het spel ná de overwinning.
 *
 * Dezelfde vorm als js/core/opdrachten.js — één lopende termijn met een
 * deadline, alles platte JSON — maar met twee verschillen die ertoe doen.
 * Ten eerste houdt hij nooit op: er is altijd een volgende termijn, dus de
 * economie die je gebouwd hebt houdt een reden om te draaien. Ten tweede
 * levert hij rangen op, en die rangen werken precies als onderzoek: het
 * enige dat opgeslagen wordt is hoeveel faampunten je hebt, de bonussen zelf
 * leidt state.herbereken() er elke keer opnieuw uit af.
 */
(function (Game) {

  var F = {};

  function cfg() { return Game.config.faam; }

  F.zorg = function (s) {
    if (!s.faam) {
      s.faam = { punten: 0, termijn: null, rust: cfg().rustNa, klaar: 0, gemist: 0, laatste: null };
    }
    ['punten', 'klaar', 'gemist'].forEach(function (k) {
      if (typeof s.faam[k] !== 'number') s.faam[k] = 0;
    });
    if (typeof s.faam.rust !== 'number') s.faam.rust = cfg().rustNa;
  };

  /* --------------------------------------------------------------- rangen */

  F.rangVan = function (punten) {
    var rangen = Game.config.faamRangen;
    var uit = rangen[0];
    for (var i = 0; i < rangen.length; i++) if (punten >= rangen[i].drempel) uit = rangen[i];
    return uit;
  };

  F.rang = function (s) {
    F.zorg(s);
    return F.rangVan(s.faam.punten);
  };

  F.volgendeRang = function (s) {
    F.zorg(s);
    var rangen = Game.config.faamRangen;
    for (var i = 0; i < rangen.length; i++) {
      if (rangen[i].drempel > s.faam.punten) return rangen[i];
    }
    return null;
  };

  /* Dezelfde vorm als onderzoek.bonus, zodat herbereken beide door één molen
     kan halen. Geen faam (of nog niet gewonnen) = precies geen effect. */
  F.bonus = function (s) {
    var b = {
      productie: 1, voedsel: 1, mijnbouw: 1, bouw: 1,
      verdediging: 1, winter: 1, opslag: 1, tevredenheid: 0
    };
    if (!s.gewonnen || !s.faam) return b;
    var effect = F.rangVan(s.faam.punten).effect || {};
    for (var sleutel in effect) {
      if (sleutel === 'tevredenheid') b.tevredenheid += effect[sleutel];
      else if (b[sleutel] !== undefined) b[sleutel] *= effect[sleutel];
    }
    return b;
  };

  /* Twee bonussen van dezelfde vorm samenvoegen. */
  F.meng = function (a, b) {
    var uit = {};
    for (var sleutel in a) {
      uit[sleutel] = sleutel === 'tevredenheid' ? a[sleutel] + b[sleutel] : a[sleutel] * b[sleutel];
    }
    return uit;
  };

  /* -------------------------------------------------------------- termijn */

  F.bevolkingsnorm = function (s) {
    F.zorg(s);
    return cfg().bevolkingBasis + cfg().bevolkingPerRang * F.rang(s).nr;
  };

  F.normGehaald = function (s) {
    return s.bevolking.totaal >= F.bevolkingsnorm(s) &&
      s.tevredenheid >= cfg().tevredenheidNorm;
  };

  function geschikt(s, sjabloon) {
    if (sjabloon.nodig && Game.core.state.telType(s, sjabloon.nodig) === 0) return false;
    return s.verzameld[sjabloon.res] > 0;
  }

  F.aantalVoor = function (s, sjabloon) {
    var ruw = (sjabloon.basis + sjabloon.perInwoner * s.bevolking.totaal) *
      (1 + 0.35 * F.rang(s).nr);
    return Math.max(20, Math.round(ruw / 10) * 10);
  };

  function nieuweTermijn(s) {
    var mogelijk = Game.config.faamEisen.filter(function (sj) { return geschikt(s, sj); });
    if (!mogelijk.length) { s.faam.rust = 60; return; }

    var keuze = mogelijk[Math.floor(Math.random() * mogelijk.length)];
    if (mogelijk.length > 1 && keuze.id === s.faam.laatste) {
      keuze = mogelijk[(mogelijk.indexOf(keuze) + 1) % mogelijk.length];
    }

    var rang = F.rang(s);
    s.faam.termijn = {
      id: keuze.id,
      res: keuze.res,
      aantal: F.aantalVoor(s, keuze),
      eindDag: s.dag + cfg().dagen,
      munten: cfg().muntenBasis + cfg().muntenPerRang * rang.nr,
      tekst: keuze.tekst,
      norm: { bevolking: F.bevolkingsnorm(s), tevredenheid: cfg().tevredenheidNorm }
    };
    s.faam.laatste = keuze.id;

    Game.ui.log.schrijf(s, '📯 De kroon opent een nieuwe termijn: ' +
      s.faam.termijn.aantal + ' ' + Game.config.resources[keuze.res].naam.toLowerCase() +
      ' binnen ' + cfg().dagen + ' dagen.', 'goed');
  }

  function verlopen(s) {
    var t = s.faam.termijn;
    s.faam.termijn = null;
    s.faam.gemist++;
    s.faam.punten = Math.max(0, s.faam.punten - 1);
    s.faam.rust = cfg().rustNa;
    s.moreel = Math.max(-Game.core.feesten.MOREEL_MAX, (s.moreel || 0) - cfg().moreelSlecht);
    Game.ui.log.schrijf(s, '📯 De termijn voor ' + t.aantal + ' ' +
      Game.config.resources[t.res].naam.toLowerCase() +
      ' is verstreken. De kroon noteert het.', 'slecht');
    Game.core.state.herbereken(s);
  }

  F.tick = function (s, dt) {
    if (!s.gewonnen || s.uitgestorven) return;
    F.zorg(s);

    if (s.faam.termijn) {
      if (s.dag > s.faam.termijn.eindDag) verlopen(s);
      return;
    }
    s.faam.rust -= dt;
    if (s.faam.rust <= 0) nieuweTermijn(s);
  };

  F.dagenOver = function (s) {
    if (!s.faam || !s.faam.termijn) return 0;
    return Math.max(0, s.faam.termijn.eindDag - s.dag);
  };

  F.kanLeveren = function (s) {
    var t = s.faam && s.faam.termijn;
    return !!t && s.res[t.res] >= t.aantal;
  };

  F.lever = function (s) {
    if (!F.kanLeveren(s)) return false;
    var t = s.faam.termijn;
    var metNorm = F.normGehaald(s);

    s.res[t.res] -= t.aantal;
    Game.core.state.voegToe(s, 'munten', t.munten);
    s.moreel = Math.min(Game.core.feesten.MOREEL_MAX, (s.moreel || 0) + cfg().moreelGoed);

    var vorige = F.rang(s);
    /* Leveren is één punt; leveren terwijl je stad ook aan de norm voldoet is
       er twee. Daar zit het verschil tussen een grote stapel en een goede stad. */
    s.faam.punten += metNorm ? 2 : 1;
    s.faam.klaar++;
    s.faam.termijn = null;
    s.faam.rust = cfg().rustNa;

    Game.ui.log.schrijf(s, '📯 Termijn vervuld' + (metNorm ? ' — en de stad staat als een huis.' : '.') +
      ' De kroon stuurt ' + t.munten + ' munten.', 'goed');

    var nu = F.rang(s);
    if (nu.nr !== vorige.nr) {
      Game.ui.log.schrijf(s, nu.emoji + ' ' + s.dorpsnaam + ' is voortaan een ' +
        nu.naam + '!', 'goed');
      if (Game.ui.overlay.faamRang) Game.ui.overlay.faamRang(s, nu);
      if (Game.ui.audio && Game.ui.audio.klok) Game.ui.audio.klok();
    }
    Game.core.state.herbereken(s);
    return true;
  };

  Game.core.faam = F;

})(window.Game);
