/* Random events with a choice.
 *
 * Bandits are the only thing that used to happen *to* you, and all you could
 * do was prepare. These are the rest of village life: a fire, a bard, a hard
 * frost, refugees at the gate. Every event is data plus a couple of options,
 * exactly like a building is data — adding one means appending to this list.
 *
 *   tijdperk   earliest age it can happen in
 *   gewicht    relative chance of being drawn
 *   mogelijk   extra condition on the current state (optional)
 *   maakCtx    per-firing context, must be plain JSON (optional)
 *   tekst      the story, may use the context
 *   opties     [{ tekst, uitleg, kosten, doe(s, ctx) -> log line }]
 *
 * `doe` runs after the cost is paid and returns the sentence for the log.
 * Nothing here may quietly wreck the food economy: losses are small and a
 * village can always shrug an event off by choosing the cheap option. */
(function (Game) {

  function res(s, r, n) { return Game.core.state.voegToe(s, r, n); }
  function neem(s, r, n) { s.res[r] = Math.max(0, s.res[r] - n); return Math.min(n, Math.round(n)); }
  function moreel(s, n) {
    var max = Game.core.feesten.MOREEL_MAX;
    s.moreel = Game.util.clamp((s.moreel || 0) + n, -max, max);
  }
  function naam(r) { return Game.config.resources[r].naam.toLowerCase(); }

  /* A built building that is not the town square — the thing events happen to. */
  function willekeurigGebouw(s, filter) {
    var lijst = s.gebouwen.filter(function (g) {
      if (!g.gebouwd || g.type === 'dorpsplein') return false;
      return filter ? filter(g, Game.core.state.def(g)) : true;
    });
    if (!lijst.length) return null;
    return lijst[Math.floor(Math.random() * lijst.length)];
  }

  function isMijn(g, d) { return !!d.wint && (d.wint.res === 'ijzer' || d.wint.res === 'koper' || d.wint.res === 'edelsteen'); }

  Game.config.gebeurtenissen = [

    /* ------------------------------------------------------------ tegenslag */
    {
      id: 'brand', emoji: '🔥', titel: 'Brand!', gewicht: 10, tijdperk: 2,
      mogelijk: function (s) { return !!willekeurigGebouw(s); },
      maakCtx: function (s) {
        var g = willekeurigGebouw(s);
        return g ? { id: g.id, naam: Game.core.state.def(g).naam } : null;
      },
      tekst: function (s, c) {
        return 'Er is brand uitgebroken in de ' + c.naam.toLowerCase() +
          '. De vlammen slaan al door het dak — als er niemand ingrijpt brandt het gebouw uit.';
      },
      opties: [
        {
          tekst: '🪣 Emmerbrigade vormen', kosten: { munten: 45 },
          uitleg: 'Iedereen in de rij naar de put. Kost munten, redt het gebouw.',
          doe: function (s, c) {
            moreel(s, 3);
            return '🪣 De brand in de ' + c.naam.toLowerCase() + ' is geblust. Het dorp is trots.';
          }
        },
        {
          tekst: '🔥 Laten uitbranden',
          uitleg: 'Gratis, maar het gebouw wordt een bouwput.',
          doe: function (s, c) {
            var g = Game.core.state.gebouw(s, c.id);
            if (!g) return 'Het vuur dooft vanzelf.';
            var d = Game.core.state.def(g);
            g.gebouwd = false;
            g.voortgang = d.bouwtijd * 0.35;
            g.werkers = 0;
            g.geschroeid = 26;
            moreel(s, -5);
            Game.core.state.herbereken(s);
            return '🔥 De ' + d.naam.toLowerCase() + ' is afgebrand en moet opnieuw opgebouwd worden.';
          }
        }
      ]
    },

    {
      id: 'koorts', emoji: '🤒', titel: 'Koorts in het dorp', gewicht: 8, tijdperk: 2,
      mogelijk: function (s) { return s.bevolking.totaal >= 10; },
      tekst: function () {
        return 'Een derde van het dorp ligt met koorts op bed. De kruidenvrouw uit de stad wil komen — voor een prijs.';
      },
      opties: [
        {
          tekst: '🌿 Kruiden laten komen', kosten: { munten: 70 },
          uitleg: 'Duur, maar iedereen knapt op.',
          doe: function (s) { moreel(s, 4); return '🌿 De kruiden hielpen. Binnen een week is iedereen weer op de been.'; }
        },
        {
          tekst: '🛏️ Laten uitzieken',
          uitleg: 'Gratis. Het humeur zakt, en misschien haalt niet iedereen het.',
          doe: function (s) {
            moreel(s, -7);
            if (s.bevolking.totaal > 6 && Math.random() < 0.5) {
              Game.core.population.verwijderDorpeling(s);
              return '🕯️ De koorts heeft een dorpeling geveld.';
            }
            return '🛏️ Na een zware week is de koorts uitgewoed. Iedereen heeft het gehaald.';
          }
        }
      ]
    },

    {
      id: 'wolven', emoji: '🐺', titel: 'Wolven bij de kudde', gewicht: 7, tijdperk: 2,
      mogelijk: function (s) { return s.res.vlees > 40; },
      tekst: function () {
        return 'Een roedel wolven zwerft rond de jachtgronden. De jagers durven het bos nauwelijks in.';
      },
      opties: [
        {
          tekst: '🏹 Klopjacht organiseren', kosten: { vlees: 25 },
          uitleg: 'Kost een dag jagen, maar het bos is daarna weer veilig.',
          doe: function (s) { moreel(s, 3); return '🏹 De roedel is verjaagd. Het bos is weer van jullie.'; }
        },
        {
          tekst: '🚪 Binnen blijven',
          uitleg: 'Gratis, maar de wolven halen flink wat uit de voorraad.',
          doe: function (s) {
            var weg = Math.min(s.res.vlees * 0.35, 70);
            neem(s, 'vlees', weg);
            moreel(s, -3);
            return '🐺 De wolven hebben ' + Math.round(weg) + ' ' + naam('vlees') + ' uit de rookhut gestolen.';
          }
        }
      ]
    },

    {
      id: 'vorst', emoji: '❄️', titel: 'Strenge vorst', gewicht: 8, tijdperk: 2,
      mogelijk: function (s) { return s.seizoen === 3; },
      tekst: function () {
        return 'Het vriest dat het kraakt. De oudsten zeggen dat ze zo\'n winter niet meer hebben meegemaakt.';
      },
      opties: [
        {
          tekst: '🍲 Extra rantsoen uitdelen', kosten: { graan: 45 },
          uitleg: 'Warme pap voor iedereen. Kost voorraad, houdt de moed erin.',
          doe: function (s) { moreel(s, 7); return '🍲 Niemand heeft kou geleden. Het dorp is dankbaar.'; }
        },
        {
          tekst: '🧣 Rantsoeneren',
          uitleg: 'Spaart de voorraad, maar het wordt een grimmige winter.',
          doe: function (s) { moreel(s, -7); return '🧣 De winter is doorstaan, maar er wordt gemopperd bij de put.'; }
        }
      ]
    },

    {
      id: 'instorting', emoji: '⛏️', titel: 'Instorting in de mijn', gewicht: 6, tijdperk: 3,
      mogelijk: function (s) { return !!willekeurigGebouw(s, isMijn); },
      maakCtx: function (s) {
        var g = willekeurigGebouw(s, isMijn);
        return g ? { id: g.id, naam: Game.core.state.def(g).naam } : null;
      },
      tekst: function (s, c) {
        return 'Een schacht van de ' + c.naam.toLowerCase() + ' is ingestort. Er zitten mensen achter het puin.';
      },
      opties: [
        {
          tekst: '🧰 Uitgraven met alles wat je hebt', kosten: { gereedschap: 25 },
          uitleg: 'Kost gereedschap, maar iedereen komt eruit.',
          doe: function (s) { moreel(s, 5); return '🧰 Alle mijnwerkers zijn levend uit de schacht gehaald.'; }
        },
        {
          tekst: '🪨 De schacht opgeven',
          uitleg: 'Gratis, maar het kost een dorpeling en veel goede wil.',
          doe: function (s) {
            moreel(s, -9);
            if (s.bevolking.totaal > 4) {
              Game.core.population.verwijderDorpeling(s);
              return '🪨 De schacht is dichtgegooid. Een mijnwerker is niet meer bovengekomen.';
            }
            return '🪨 De schacht is dichtgegooid.';
          }
        }
      ]
    },

    /* --------------------------------------------------------------- kansen */
    {
      id: 'bard', emoji: '🎻', titel: 'Rondtrekkende bard', gewicht: 10, tijdperk: 2,
      tekst: function () {
        return 'Een bard met een luit staat op het plein. Voor een handvol munten speelt hij de hele avond.';
      },
      opties: [
        {
          tekst: '🎶 Onthaal hem', kosten: { munten: 40 },
          uitleg: 'Een avond muziek tilt het hele dorp op.',
          doe: function (s) { moreel(s, 9); return '🎶 Tot diep in de nacht werd er gedanst op het plein.'; }
        },
        {
          tekst: '🚶 Stuur hem door',
          uitleg: 'Kost niets, maar er wordt over gepraat.',
          doe: function (s) { moreel(s, -2); return '🚶 De bard is doorgereisd naar het volgende dorp.'; }
        }
      ]
    },

    {
      id: 'vluchtelingen', emoji: '🧳', titel: 'Vluchtelingen aan de poort', gewicht: 9, tijdperk: 2,
      mogelijk: function (s) { return s.bevolking.ruimte - s.bevolking.totaal >= 2; },
      maakCtx: function (s) {
        var ruimte = s.bevolking.ruimte - s.bevolking.totaal;
        return { aantal: Math.min(4, Math.max(2, ruimte)) };
      },
      tekst: function (s, c) {
        return c.aantal + ' mensen staan voor je dorp. Hun eigen dorp is platgebrand door rovers. ' +
          'Ze vragen om onderdak.';
      },
      opties: [
        {
          tekst: '🏠 Neem ze op',
          uitleg: 'Meer handen, maar ook meer monden. Alleen als je bedden hebt.',
          doe: function (s, c) {
            var ruimte = Math.max(0, s.bevolking.ruimte - s.bevolking.totaal);
            var n = Math.min(c.aantal, ruimte);
            s.bevolking.totaal += n;
            moreel(s, 4);
            Game.core.state.herbereken(s);
            return '🏠 ' + n + ' nieuwe dorpelingen hebben zich bij je gevestigd.';
          }
        },
        {
          tekst: '🚪 Wijs ze af',
          uitleg: 'Bespaart voedsel, maar je eigen mensen kijken ervan op.',
          doe: function (s) { moreel(s, -6); return '🚪 De vluchtelingen zijn verder getrokken. Het bleef er stil van.'; }
        }
      ]
    },

    {
      id: 'pelgrims', emoji: '⛪', titel: 'Pelgrims op doorreis', gewicht: 8, tijdperk: 3,
      mogelijk: function (s) {
        return (Game.core.state.telType(s, 'kapel') + Game.core.state.telType(s, 'kerk') +
          Game.core.state.telType(s, 'kathedraal')) > 0 && s.res.brood > 40;
      },
      tekst: function () {
        return 'Een stoet pelgrims vraagt of ze bij je kapel mogen overnachten. Ze hebben brood nodig — ' +
          'en ze zijn goed voor hun geld.';
      },
      opties: [
        {
          tekst: '🍞 Onderdak en brood geven', kosten: { brood: 40 },
          uitleg: 'Zij geven een gift, jouw dorp voelt zich gezegend.',
          doe: function (s) {
            res(s, 'munten', 95);
            moreel(s, 5);
            return '⛪ De pelgrims lieten 95 munten achter bij het altaar.';
          }
        },
        {
          tekst: '🙏 Alleen een gebed',
          uitleg: 'Kost niets en levert niets op.',
          doe: function () { return '🙏 De pelgrims baden en trokken verder.'; }
        }
      ]
    },

    {
      id: 'mijnvondst', emoji: '💎', titel: 'Vondst in de mijn', gewicht: 6, tijdperk: 3,
      mogelijk: function (s) { return !!willekeurigGebouw(s, isMijn); },
      tekst: function () {
        return 'De mijnwerkers zijn op een ader gestuit die niemand verwachtte. Er ligt iets moois in het gesteente.';
      },
      opties: [
        {
          tekst: '⛏️ Voorzichtig uitgraven',
          uitleg: 'Een meevaller voor de schatkist.',
          doe: function (s) {
            var gems = res(s, 'edelsteen', 14);
            var koper = res(s, 'koper', 40);
            moreel(s, 3);
            return '💎 De ader leverde ' + Math.round(gems) + ' edelstenen en ' + Math.round(koper) + ' koper op.';
          }
        }
      ]
    },

    {
      id: 'oogst', emoji: '🌾', titel: 'Een uitzonderlijke oogst', gewicht: 8, tijdperk: 2,
      mogelijk: function (s) { return s.seizoen === 2 && Game.core.state.telType(s, 'boerderij') > 0; },
      tekst: function () {
        return 'De akkers staan er dit jaar ongekend goed bij. De schuren puilen uit.';
      },
      opties: [
        {
          tekst: '🌾 Binnenhalen',
          uitleg: 'Extra graan voor de winter.',
          doe: function (s) {
            var n = res(s, 'graan', 120);
            moreel(s, 4);
            return '🌾 ' + Math.round(n) + ' extra graan is binnengehaald. De winter kan komen.';
          }
        }
      ]
    },

    {
      id: 'ambachtsman', emoji: '🧰', titel: 'Rondreizende ambachtsman', gewicht: 7, tijdperk: 3,
      tekst: function () {
        return 'Een meestersmid trekt langs en biedt zijn hele voorraad gereedschap aan — hij wil van de last af.';
      },
      opties: [
        {
          tekst: '🪙 Alles opkopen', kosten: { munten: 130 },
          uitleg: 'Gereedschap versnelt elke mijn en groeve.',
          doe: function (s) {
            var n = res(s, 'gereedschap', 70);
            return '🧰 ' + Math.round(n) + ' gereedschap ligt nu in je schuur.';
          }
        },
        {
          tekst: '🚶 Bedanken',
          uitleg: 'Je munten blijven in de kist.',
          doe: function () { return '🚶 De smid trok verder met zijn kar.'; }
        }
      ]
    },

    {
      id: 'kar', emoji: '🐴', titel: 'Verdwaalde vrachtkar', gewicht: 6, tijdperk: 2,
      tekst: function () {
        return 'Aan de bosrand staat een omgevallen kar, verlaten. De lading ligt er nog.';
      },
      opties: [
        {
          tekst: '🪵 Meenemen naar het dorp',
          uitleg: 'Gevonden voorwerpen zijn ook voorwerpen.',
          doe: function (s) {
            var hout = res(s, 'hout', 90);
            var steen = res(s, 'steen', 35);
            return '🪵 De kar leverde ' + Math.round(hout) + ' hout en ' + Math.round(steen) + ' steen op.';
          }
        },
        {
          tekst: '📢 De eigenaar zoeken',
          uitleg: 'Eerlijk duurt het langst — en levert een beloning op.',
          doe: function (s) {
            res(s, 'munten', 55);
            moreel(s, 5);
            return '📢 De koopman was dolblij en gaf 55 munten als dank. Het dorp praat er nog over.';
          }
        }
      ]
    }
  ];

})(window.Game);
