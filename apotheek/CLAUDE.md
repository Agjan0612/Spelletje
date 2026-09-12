# CLAUDE.md — Recept tot Zorg (apotheekspel)

Richtlijnen voor werk in `apotheek/`. Het plan staat in `../BOUWPLAN-APOTHEEK.md`;
dit bestand beschrijft alleen hoe de code in elkaar zit.

## Wat dit is

Een spel over het runnen van een openbare apotheek, in de geest van *Project
Hospital*. Twee lagen: het pand en het personeel (macro), en het recept met een
verborgen probleem (micro). **Fase 0 is af**: het skelet draait — recepten
stromen binnen, drie stations verwerken ze, twee assistenten lopen ertussen, en
één signaaltype vraagt om een besluit van de speler.

Het staat naast *Dorp tot Stad* in dezelfde repo maar deelt er geen code mee. De
renderlaag is een uitgeklede kopie, bewust geen gedeelde motor: dat zou eerst het
andere spel verbouwen voordat dit spel iets doet.

## Draaien en meten

- **Spelen:** `npm run dev` in de repo-wortel, dan `/apotheek/`. Of
  `npm run build && npm run preview`.
- **Balans meten:** `npm run balans:apotheek` (= `node apotheek/tools/simuleer-apotheek.js`).
  Bare Node, geen browser, geen dependencies. Vlaggen: `--zaden= --dagen=
  --beleid=overleg|akkoord|gemengd --drempel= --recepten= --json`.

**Meet vóór en na elke balanswijziging, met dezelfde zaden.** Dit spel is een
wachtrijnetwerk en die hebben een klif: een station met tien procent te weinig
capaciteit geeft geen tien procent langere rij maar een rij die de hele dag
groeit. Streefwaarde voor de bezetting van het personeel is **0,75–0,85**; het
harnas zegt het er zelf bij.

Stand bij het afsluiten van fase 0 (10 zaden × 3 dagen, standaardbeleid):
108 afgeleverd · 5 weggelopen · 1,8 fouten · doorlooptijd 18 min · bezetting 81%
· saldo +€140 · tevredenheid 81%.

## Architectuur

Zelfde patroon als het buurspel, om dezelfde redenen:

- **Klassieke IIFE-modules op `window.Apotheek`** (`{config, core, render, ui,
  state, util}`). Geen ES-modules in de spelcode zelf; `src/legacy.js` bepaalt de
  laadvolgorde en dat is een **afhankelijkheidsvolgorde** — niet met de hand
  herordenen. Het harnas leest die lijst uit, dus een nieuw core-bestand doet
  daar vanzelf mee.
- **Eén serialiseerbare speltoestand.** Nooit functies, `Infinity` of
  verwijzingen naar elkaar in `s`: recepten en personeel verwijzen met een id.
  De tekenlaag houdt zijn eigen spullen bij en staat niet in `s`.
- **De tickvolgorde staat op één plek**, in `js/main.js` als `spel.stap(s, dm)`.
  Het harnas draait letterlijk diezelfde functie. Een tweede kopie van die
  volgorde is een tweede spel.
- **`dm` is speelminuten**, geen seconden. De hele kern rekent in minuten van de
  werkdag. Eén echte seconde is één speelminuut bij 1×; de snelheidsknoppen
  vermenigvuldigen het *aantal* stappen, nooit de grootte.
- **De generator loopt mee in de toestand** (`s.rngS`). `Math.random` komt in de
  simulatie nergens voor, dus een save hervat dezelfde toekomst en het harnas kan
  een dag exact herhalen.

## Waar wat zit

| Map | Wat |
|---|---|
| `js/config/` | pure data. `instellingen.js` is de balans, en dat is de enige plek waar getallen horen |
| `js/core/` | de simulatie: `klok` · `toeloop` · `recept` · `werkvloer` · `personeel` · `geld` · `pand` · `state` · `rng` |
| `js/render/` | `camera.js` (iso-projectie, kopie) en `tekenen.js` (Canvas 2D) |
| `js/ui/` | DOM-panelen. `werklijst.js` gebruikt een handtekening-diff, anders bouwt het paneel zich onder de cursor vandaan |
| `tools/` | het balansharnas |

## Twee dingen die makkelijk fout gaan

**Doorlooptijd is niet wachttijd.** `gereed − binnen` is wat de apotheek zelf
doet; `klaar − binnen` is wat een patiënt in de zaak ervaart. Een recept dat om
elf uur klaarligt en om vier uur wordt opgehaald is snel afgehandeld, niet traag.
Ze op één hoop gooien was de eerste bevinding van het harnas.

**Werkvoorraad is niet voorraad.** `state.onderhanden` telt alleen waar nog werk
aan zit; wat klaarligt in het rek staat in `state.inHetRek`. Ze samentellen laat
een rustige ochtend eruitzien als een achterstand.

## Conventies

Domeincode (namen, id's, logteksten) in het **Nederlands**, commentaar in het
**Engels** — hetzelfde als bij het buurspel. Een station kan door één assistent
tegelijk gebruikt worden: dat is wat de plattegrond straks laat meetellen, dus
sloop die regel niet weg om een wachtrij op te lossen.
