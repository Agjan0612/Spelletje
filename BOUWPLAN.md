# 🏰 Bouwplan — Dorp tot Stad levendiger & leuker

Drie wensen van de speeltester, vertaald naar een concreet plan dat past bij hoe
het spel gebouwd is: vanilla JS, geen bouwstap, draait vanaf `file://`.

- **Wensen:** realistischer · beter zien hoe ze werken · meer te doen dan bouwen
- **Branch:** `claude/game-feedback-suggestions-enxjf3`
- **Status:** plan — nog niks gebouwd

**Legenda moeite:** 🟢 klein · 🟡 middel · 🔴 groot
**Legenda risico:** ✅ geen (alleen tekenwerk) · ⚠️ raakt de speltoestand

---

## In het kort — drie rondes, elk los speelbaar

Elke fase kan op zichzelf af en getest worden. De volgorde is bewust: we beginnen
met wat de meeste indruk maakt voor het minste risico.

| Fase | Wat | Omvang |
|---|---|---|
| **I · Levende wereld** | Poppetjes die écht lopen en zichtbaar hun werk doen, plus dieren, rook en avondlicht. Antwoord op wens 1 & 2. | 8 onderdelen · vrijwel alleen tekenwerk |
| **II · Iets te doen** | Feesten, een reizende koopman, opdrachten van de heer en losse gebeurtenissen. Antwoord op wens 3. | 4 onderdelen · raakt de speltoestand |
| **III · Later, als het bevalt** | Individuele dorpelingen met namen en eigen behoeftes — leuk, maar een grote verbouwing. | 1 onderdeel · groot · optioneel |

---

## Fase I — Levende wereld

Alles hieronder is **decoratief**. Het raakt `Game.state` niet, dus geen risico
voor de balans of de opgeslagen dorpjes.

### 1. Poppetjes laten lopen in plaats van glijden — 🟢 ✅
`js/render/renderer.js`

Kleine op-en-neer-stapjes tijdens het lopen, en het sprite spiegelen naar de kant
waar ze heen gaan. Meteen veel levendiger.

**Hoe:** in `tekenWandelaars()` een `sin(tijd)`-offset op de y-positie voor het
loopje, en de `drawImage` horizontaal spiegelen op basis van `w.richting`. De
wandelaars bestaan al en kiezen al het juiste beroepssprite via `atlas.werker()`.

### 2. Zien hoe ze werken: bijl, hengel, pikhouweel — 🟡 ✅
`js/render/renderer.js` · `js/render/sprites.js`

Als een poppetje bij de boom / het water / de rots aankomt, blijft het staan en
voert een werk-animatie uit — met houtsnippers, een splash of vonkjes.

**Hoe:** wandelaars hebben nu een `p` van 0→1 en doen bij `p≈1` niets. Daar een
korte "werk-fase" inbouwen: pauzeer bij aankomst, teken per beroep een klein
gereedschap-emoji met een swing (rotatie/offset) en spatter een paar deeltjes.
Dit is precies de haak die wens 2 invult.

### 3. Grondstof dragen op de terugweg — 🟢 ✅
`js/render/renderer.js`

Op de weg terug naar het gebouw draagt het poppetje zichtbaar zijn oogst: een 🪵,
🥩 of 🪨 boven het hoofd.

**Hoe:** de looprichting is al bekend (`w.richting`). Bij terugkeer een klein
grondstof-icoontje tekenen dat past bij `d.wint` van het gebouw. Puur cosmetisch —
de echte productie blijft in `economy.js`.

### 4. Zwevende opbrengst-cijfers — 🟢 ✅
`js/render/floaters.js` *(nieuw)*

Af en toe zweeft er een `+🪵` of `+🥩` omhoog uit een werkend gebouw. Je ziet in
één oogopslag wat er binnenkomt.

**Hoe:** een klein decoratief lijstje van "floaters" dat op echte tijd meebeweegt
(net als de wandelaars, buiten de vaste simulatiestap). Nieuw scriptbestand → één
`<script>`-regel in `index.html` op de juiste plek.

### 5. Variatie in de dorpelingen — 🟢 ✅
`js/render/atlas.js`

De Kenney-set heeft 21 poppetjes; nu gebruikt elk beroep er precies één. Een paar
varianten per beroep en de menigte ziet er niet meer uit als klonen.

**Hoe:** `werkerMap` uitbreiden naar meerdere sprites per beroep en er
deterministisch één kiezen op basis van een stabiele waarde per wandelaar (zoals
`boom()`/`rots()` nu al doen), zodat ze niet flikkeren tussen frames.

### 6. Variatie in huisjes en daken — 🟢 ✅
`js/render/atlas.js` · `js/render/sprites.js`

Een rij identieke huisjes wordt levendiger als elk huisje net een andere
sprite-variant of daktint krijgt.

**Hoe:** per gebouw een stabiele variant kiezen uit een paar structure-sprites, of
de handmatig getekende huisjes een lichte kleurvariatie geven op basis van hun
positie/id. Het gebouw zelf blijft in de simulatie precies hetzelfde.

### 7. Schoorsteenrook & raamgloed in de avond — 🟡 ✅
`js/render/sprites.js`

Warme raampjes als het donker wordt en een rookpluimpje uit huizen, de bakkerij en
de smederij. Enorm veel sfeer voor weinig code.

**Hoe:** er bestaat al een dag/nacht-waarde `s.tijd` (de molen gebruikt hem al voor
z'n draaiende wieken). Bij lage lichtstand een warme gloed over de ramen leggen en
uit "warme" gebouwen een langzaam opstijgend rookpluimpje tekenen op echte tijd.

### 8. Dieren en details op de kaart — 🟡 ✅
`js/render/wildlife.js` *(nieuw)* · `js/render/renderer.js`

Herten bij de jachtgrond, springende vissen bij de visgrond, schapen bij het dorp,
bloemetjes en struikjes. Maakt de wereld écht — en laat meteen zien wáár er gejaagd
en gevist wordt.

**Hoe:** decoratieve dieren die rond de bijbehorende map-nodes (wild, visgrond)
dwalen, net als de wandelaars losgekoppeld van de simulatie. Dit dient wens 1 én
wens 2 tegelijk: de speler ziet de bron waar het beroep werkt.

---

## Fase II — Iets te doen dan alleen bouwen

Deze onderdelen raken de speltoestand. De blauwdruk bestaat al: rovers
(`raids.js`) laten zien hoe je een getimede gebeurtenis maakt, en er is al een
`moreel`-veld dat de tevredenheid voedt.

### 1. Feesten & markten 🎉 — 🟢 ⚠️
`js/core/feesten.js` *(nieuw)* · `js/ui/hud.js`

Een knop om graan of munten uit te geven aan een oogstfeest, dat een tijd lang de
tevredenheid flink opkrikt. Een echte keuze — het vriendelijke spiegelbeeld van een
roversaanval.

**Hoe:** het `moreel`-veld bestaat al en telt mee in `tevredenheidDetail()`; rovers
verhogen/verlagen het nu al. Een feest trekt grondstoffen af en zet `moreel` omhoog
voor een periode. Één knop in de HUD, en de bestaande log/toast voor de melding.

### 2. Reizende koopman 🐴 — 🟡 ⚠️
`js/core/handel.js` *(nieuw)* · `js/ui/overlay.js`

Af en toe komt een karavaan langs. Jij kiest of je overschot ruilt voor een schaarse
grondstof of munten. Beslissingen buiten het bouwen om.

**Hoe:** een getimede gebeurtenis in de stijl van `raids.js` (rust → aankomst), maar
met een keuze-overlay. Er is al een marktplaats en een `handelaar`-beroep, dus het
past thematisch. Ruilkoersen als pure data, makkelijk te balanceren.

### 3. Opdrachten van de heer 📜 — 🟡 ⚠️
`js/config/quests.js` · `js/core/opdrachten.js` *(nieuw)* · `js/ui/quests.js`

"Lever 50 brood voor de winter" → beloning in munten of tevredenheid. Doorlopende
doelen die het spel richting geven.

**Hoe:** het questsysteem met `klaar(state)`-predikaten en beloningen bestaat al,
maar wordt nu alleen als tutorial gebruikt. Uitbouwen tot terugkerende opdrachten
met een deadline (koppelbaar aan het bestaande dagen/seizoenen-systeem) en een
beloning zoals de quests die al uitdelen.

### 4. Losse gebeurtenissen 🎲 — 🟡 ⚠️
`js/core/gebeurtenissen.js` *(nieuw)* · `js/ui/overlay.js`

Naast rovers ook goede: een rondtrekkende bard (blijdschap), een goed oogstjaar, of
een brandje waar je op reageert. Kleine pop-ups met een keuze zorgen voor afwisseling.

**Hoe:** een centrale gebeurtenissen-tick die af en toe een event uit een lijst
trekt. Elk event is data (voorwaarde, tekst, effect), net zoals gebouwen dat zijn —
makkelijk uit te breiden. Draait mee in de bestaande vaste simulatiestap, ná `raids`.

> **Volgorde binnen fase II:** begin met *feesten* (kleinste, gebruikt bestaand
> `moreel`) en *opdrachten* (hergebruikt het questsysteem). Koopman en losse
> gebeurtenissen bouwen daar logisch op voort.

---

## Fase III — Later, als het bevalt

Bewust apart gehouden: dit verandert het hart van de simulatie en is geen goede
eerste stap.

### ★ Individuele dorpelingen met namen & behoeftes — 🔴 ⚠️
`js/core/population.js` · `js/core/state.js`

Elk poppetje een naam, een humeur en een eigen verhaal, in plaats van aantallen per
groep.

**Waarom later:** de simulatie telt nu *groepen* (`s.bevolking` = aantallen), geen
losse mensen. Individuen betekent de kern van `population.js` en de opgeslagen
toestand herzien — leuk, maar niet vóór fase I en II staan en bevallen.

---

## Bewaken tijdens het bouwen — de spelregels van deze codebase

Uit `CLAUDE.md` en de architectuur. Elke wijziging moet hier binnen blijven.

- **Opslag blijft pure JSON.** Een save is `JSON.stringify(state)`. Geen `Infinity`,
  functies of klassen in `state` — daarom bestaat `map.ONEINDIG`. Decoratieve dingen
  (wandelaars, dieren, floaters) buiten de opgeslagen toestand houden.
- **`file://` moet blijven werken.** Geen bouwstap, geen ES-modules, geen externe
  dependencies. Nieuw bestand = een klassieke IIFE die aan `window.Game` hangt, plus
  één `<script>`-regel in `index.html` op de juiste plek in de laadvolgorde.
- **De tekenlaag is niet-gezaghebbend.** Sprites en animaties zijn optioneel: als een
  afbeelding nog laadt of ontbreekt, valt de tekencode terug op vormen/emoji. Alle
  fase I-werk volgt dat patroon, zodat het spel zonder `assets/` blijft draaien.
- **De voedsel-economie is heilig.** Twee ingebouwde vangnetten blijven: honger haalt
  voedselwerkers als *laatste* weg (`rang()`), en lage tevredenheid knijpt de productie
  niet dood (vloer op `0.75`). Feesten en events mogen die balans niet omzeilen.
- **De tick-volgorde staat vast.** `seasons → construction → economy → population →
  raids → quests → ages`. Nieuwe simulatie (feesten, handel, gebeurtenissen) voegt zich
  hierin, meestal ná `raids`; latere stappen lezen wat eerdere schreven.
- **Testen zoals het bedoeld is.** Balanswijzigingen valideren via `window.spel`
  headless (of Playwright met de voorgeïnstalleerde Chromium): een vers dorp moet
  tijdperk 4 halen zonder hongersnood. En na elke config-wijziging checkt `devcheck.js`
  de console.

---

## Aanbevolen volgorde

1. **Fase I eerst, in één keer speelbaar.** De "levende wereld" geeft de grootste
   zichtbare sprong voor het minste risico — precies wat de speeltester het eerst
   opvalt. Bijna alleen tekenwerk.
2. **Laten spelen, dan pas verder.** Fase I uitproberen. Wat werkt, wat mag drukker of
   rustiger? Die feedback bepaalt de details van fase II.
3. **Fase II gefaseerd.** Beginnen met feesten en opdrachten (hergebruiken bestaande
   systemen), daarna koopman en losse gebeurtenissen.
4. **Fase III alleen als de rest bevalt.** Individuele dorpelingen zijn een apart,
   groter project — geen voorwaarde voor de rest.

Elke fase is los af te ronden en op de branch te zetten, zodat er nooit een
half-werkend spel klaarstaat. 🌾
