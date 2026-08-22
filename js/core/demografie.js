/* Children, workers and grandparents.
 *
 * The village used to be one number. It still is, in the sense that
 * s.bevolking.totaal remains the authority on how many mouths there are —
 * every food and housing rule keeps working untouched. What this module adds
 * is *who* those mouths are:
 *
 *   kinderen     eat, cannot work, and make a town feel alive
 *   volwassenen  the workforce
 *   ouderen      still take a job but get less done, and eventually die
 *
 * The growth rule in population.js is unchanged, so the pace of the town is
 * what it always was. What changed is that a share of each new villager
 * arrives as a child (see `geboorteAandeel`) and has to grow up first. A baby
 * boom is therefore an investment that pays off in a couple of years, and a
 * town that stops attracting people slowly greys and shrinks.
 *
 * Ageing runs as flows with fractional accumulators rather than a list of
 * ages, so it costs three numbers instead of one object per villager and the
 * save stays small and plain.
 */
(function (Game) {

  var D = {};

  function cfg() { return Game.config.leeftijd; }

  /* Older saves — and the opening seconds of a new game — get their cohorts
     derived from the headcount, with everyone counted as an adult. */
  D.zorg = function (s) {
    var b = s.bevolking;
    if (typeof b.kinderen !== 'number') b.kinderen = 0;
    if (typeof b.ouderen !== 'number') b.ouderen = 0;
    if (typeof b.volwassenen !== 'number') {
      b.volwassenen = Math.max(0, (b.totaal || 0) - b.kinderen - b.ouderen);
    }
    if (!s.leeftijd) s.leeftijd = { rijp: 0, oud: 0, dood: 0 };
    ['rijp', 'oud', 'dood'].forEach(function (k) {
      if (typeof s.leeftijd[k] !== 'number') s.leeftijd[k] = 0;
    });
    D.sluitAan(s);
  };

  /* The cohorts must always add up to the headcount: population.js may add or
     remove villagers for reasons of its own (hunger, raids, events), and it
     should never have to know these three numbers exist. Any drift is settled
     against the adults, and against the children only if that is not enough —
     hunger and bandits taking the workers first would be both grim and unfair. */
  D.sluitAan = function (s) {
    var b = s.bevolking;
    b.kinderen = Math.max(0, Math.round(b.kinderen));
    b.ouderen = Math.max(0, Math.round(b.ouderen));
    b.volwassenen = Math.max(0, Math.round(b.volwassenen));

    var verschil = b.totaal - (b.kinderen + b.volwassenen + b.ouderen);
    if (verschil === 0) return;

    if (verschil > 0) { b.volwassenen += verschil; return; }

    var tekort = -verschil;
    var vanVolwassen = Math.min(b.volwassenen, tekort);
    b.volwassenen -= vanVolwassen; tekort -= vanVolwassen;
    var vanOud = Math.min(b.ouderen, tekort);
    b.ouderen -= vanOud; tekort -= vanOud;
    b.kinderen = Math.max(0, b.kinderen - tekort);
  };

  /* How many pairs of hands the town actually has. Children are not in it. */
  D.arbeidskracht = function (s) {
    var b = s.bevolking;
    return (b.volwassenen || 0) + (b.ouderen || 0);
  };

  /* Elderly workers still fill a slot but get less done, so the town's output
     sags as it greys. Returns a multiplier around 1. */
  D.arbeidFactor = function (s) {
    var b = s.bevolking;
    var handen = D.arbeidskracht(s);
    if (handen <= 0) return 1;
    return ((b.volwassenen || 0) + (b.ouderen || 0) * cfg().ouderenArbeid) / handen;
  };

  /* A school gets children ready for work sooner. */
  function kindDuur(s) {
    var scholen = Game.core.state.telType(s, 'school');
    if (!scholen) return cfg().kindDuur;
    return cfg().kindDuur / (1 + Math.min(0.5, scholen * 0.25));
  }
  D.kindDuur = kindDuur;

  /* One new villager. population.js decides *whether* the town grows; this
     decides whether the newcomer is a baby or a family moving in. */
  D.nieuweInwoner = function (s) {
    D.zorg(s);
    var b = s.bevolking;
    if (Math.random() < cfg().geboorteAandeel) {
      b.kinderen++;
      return 'kind';
    }
    b.volwassenen++;
    return 'volwassen';
  };

  D.tick = function (s, dt) {
    D.zorg(s);
    var b = s.bevolking, l = s.leeftijd, c = cfg();

    /* --- growing up --- */
    if (b.kinderen > 0) {
      l.rijp += (b.kinderen / kindDuur(s)) * dt;
      while (l.rijp >= 1 && b.kinderen > 0) {
        l.rijp -= 1; b.kinderen--; b.volwassenen++;
      }
    } else { l.rijp = 0; }

    /* --- growing old --- */
    if (b.volwassenen > 0) {
      l.oud += (b.volwassenen / c.volwassenDuur) * dt;
      while (l.oud >= 1 && b.volwassenen > 0) {
        l.oud -= 1; b.volwassenen--; b.ouderen++;
      }
    } else { l.oud = 0; }

    /* --- and passing on. A death frees a bed and, if they held a job, a
       worker slot — population.verwijderDorpeling already knows how to let
       someone go without gutting the food supply first. --- */
    if (b.ouderen > 0) {
      l.dood += (b.ouderen / c.ouderdomDuur) * dt;
      while (l.dood >= 1 && b.ouderen > 0) {
        l.dood -= 1;
        b.ouderen--;
        /* Take the headcount down through the shared helper so worker slots
           are freed in the right order, then keep our own tally straight. */
        var voor = b.totaal;
        Game.core.population.verwijderDorpeling(s, true);
        if (b.totaal === voor) { b.ouderen++; break; }   /* refused (last villager) */
        Game.ui.log.schrijf(s, '🕯️ Een oude dorpeling is in vrede gestorven.');
      }
    } else { l.dood = 0; }

    D.sluitAan(s);
  };

  /* What the register and the HUD show. */
  D.verdeling = function (s) {
    D.zorg(s);
    var b = s.bevolking;
    return {
      kinderen: b.kinderen, volwassenen: b.volwassenen, ouderen: b.ouderen,
      handen: D.arbeidskracht(s),
      factor: D.arbeidFactor(s)
    };
  };

  Game.core.demografie = D;

})(window.Game);
