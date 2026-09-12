# CLAUDE.md — Recept tot Zorg (apotheekspel)

Richtlijnen voor werk in `apotheek/`. Het plan staat in `../BOUWPLAN-APOTHEEK.md`;
dit bestand beschrijft alleen hoe de code in elkaar zit.

## Wat dit is

Een spel over het runnen van een openbare apotheek, in de geest van *Project
Hospital*. Twee lagen: het pand en het personeel (macro), en het recept met een
verborgen probleem (micro). **Fase 0 en 1 zijn af.** De kernlus draait en de
casus is het spel: recepten stromen binnen, vijf stations verwerken ze, twee
assistenten en een apotheker lopen ertussen, en de signalen die de bewaking
eruit haalt vragen om een oordeel — dat je pas kunt vellen als je weet wat er
onder ligt.

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

Stand bij het afsluiten van fase 1 (14 zaden × 4 dagen, beleid A=uitzoeken
B=uitzoeken controle=alles): 124 afgeleverd · 1 weggelopen · 0,8 fouten de deur
uit · 2,6 door de controle gevangen · doorlooptijd 29 min · bezetting 76%
(apotheker 72%) · saldo +€231 · tevredenheid 70%.

De vlaggen `--a= --b= --controle=` zetten precies de protocollen die de speler
ook kan kiezen, dus een sweep meet echte speelstijlen en geen verzonnen botlogica.
`--knop=naam:waarde` verzet één instelling voor de duur van de run.

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

## Hoe de casus in elkaar zit

De kernlus, met de fasen zoals ze in `recept.fase` staan:

```
bewaking → [besluit ⇄ opvragen] → overleg → antwoord → gereedmaken
                                ↘ oordeel ↗              → controle → uitgifte → af
```

- **besluit** is de enige fase zonder station: daar wacht het recept op de speler
  of op zijn protocol. Dat is met opzet de flessenhals.
- **opvragen** is waar fase 1 om draait. Een signaal is pas een oordeel als je
  weet wat eronder ligt; `r.echt` is verborgen tot je het gegeven ophaalt, en dat
  lukt in 82% van de gevallen. Zonder die kans op lege handen zou opvragen altijd
  het beste antwoord zijn en was er weer niets te kiezen.
- **antwoord** is de terugbel van de huisarts (22–45 min) en kost geen enkel
  station. Dit is de duurste stilstand in het spel en de reden dat het loont om
  eerst uit te zoeken óf dat overleg wel nodig is. Een wachtende patiënt wordt
  hier naar huis gestuurd; zonder die uitweg liep vrijwel iedereen voor wie
  overlegd moest worden weg, en dan is overleggen geen dure keuze meer maar een
  verboden zet.
- **oordeel** mag alleen de apotheker doen, en voor hém gaat het vóór alles. Met
  het gegeven er al bij is hij in een derde van de tijd klaar — daar zit de ruil
  van goedkope assistententijd tegen de duurste tijd in huis.
- **controle** vangt fouten. Een gevangen fout is *herwerk*, geen pleister: een
  verkeerd doosje gaat terug naar gereedmaken, een verkeerd oordeel terug naar
  besluit. Zonder dat was "alles doorlaten, de controle vangt het wel" de
  winnende strategie.

`js/core/protocollen.js` kiest voor de speler, via exact dezelfde `recept.doe()`
die de knoppen op de receptkaart aanroepen. Er is dus geen pad waarop beleid iets
kan wat een mens niet kan, of andersom.

## Twee soorten fouten, en ze staan los van elkaar

Een **denkfout** is een verkeerd oordeel op een signaal — die maak jij, en alleen
op recepten mét een signaal. Een **verzamelfout** is het verkeerde doosje uit de
la: 3% van álle recepten, ongeacht signaal. Die tweede soort is er niet voor de
volledigheid maar omdat de controletafel anders dood gewicht wordt zodra de
speler goed leert beslissen — en dan zet hij hem terecht uit.

Een fout die de deur uit gaat kost €90 en tien punten tevredenheid, ver boven wat
een weggelopen patiënt kost. Dat is bewust: een model waarin te lang laten wachten
erger is dan een verkeerd middel afleveren, leert het verkeerde.

## Twee dingen die makkelijk fout gaan

**Doorlooptijd is niet wachttijd.** `gereed − binnen` is wat de apotheek zelf
doet; `klaar − binnen` is wat een patiënt in de zaak ervaart. Een recept dat om
elf uur klaarligt en om vier uur wordt opgehaald is snel afgehandeld, niet traag.
Ze op één hoop gooien was de eerste bevinding van het harnas.

**Werkvoorraad is niet voorraad.** `state.onderhanden` telt alleen waar nog werk
aan zit; wat klaarligt in het rek staat in `state.inHetRek`. Ze samentellen laat
een rustige ochtend eruitzien als een achterstand.

## Geprobeerd en verworpen

Staat ook in de code, maar hier bij elkaar zodat niemand het opnieuw bedenkt:

- **Veroudering in de wachtrij** (een recept schuift op naarmate het langer ligt).
  De lange staart in de doorlooptijd is geen uithongering maar de drukte van het
  laatste uur, dus het hielp niet — en sterk genoeg afgesteld om wél iets te doen,
  liet het oude ophaalrecepten vóór wachtende patiënten gaan en kostte dat zeven
  weglopers per dag.
- **Een controleoptie 'alleen wat een signaal had'.** Verzamelfouten hangen niet
  aan signalen, dus die stand was strikt slechter dan zowel alles als niets
  controleren. Vervangen door 'de helft', wat wél een eerlijke ruil is.

## Conventies

Domeincode (namen, id's, logteksten) in het **Nederlands**, commentaar in het
**Engels** — hetzelfde als bij het buurspel. Een station kan door één assistent
tegelijk gebruikt worden: dat is wat de plattegrond straks laat meetellen, dus
sloop die regel niet weg om een wachtrij op te lossen.
