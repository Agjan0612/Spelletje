# Bouwplan: leven en licht — visueel 2

`VISUEEL.md` heeft het licht, de grond en de gebouwsilhouetten opgelost. Wat er nu
nog tussen dit spel en een mooi spel staat is niet méér detail, maar drie dingen
die je pas ziet als je even blijft kijken:

1. **Materiaal van dichtbij.** Daken zijn kleurvlakken, geen pannen of riet. Vanaf
   tegel-niveau is elk gebouw af; op inzoom-afstand is het een gekleurd volume.
2. **Water en lucht doen niets.** Het water beweegt maar weerspiegelt niets, de
   lucht bestaat niet (buiten de kaart is één egale diepzeekleur), en het weer is
   een seizoensfilter in plaats van iets dat gebeurt.
3. **Iedereen beweegt als een punt op een lijn.** Een dorpeling is een fractie
   `w.p` die tussen 0 en 1 kaatst (`renderer.js:205`); een rover is een vaste
   offset ten opzichte van één leiderpositie die lineair naar binnen schuift
   (`raiders.js:78`). Daar komt élk "onecht" gevoel uit voort: ze zwenken niet,
   remmen niet af, lopen door elkaar heen en glijden in formatie.

Dit plan pakt alle drie aan, in acht fasen die los van elkaar op te leveren zijn.

- **Branch:** `claude/visual-improvements-obr6qm`
- **Status:** plan — nog niks gebouwd
- **Volgt op:** `VISUEEL.md` (uitgevoerd), `ROADMAP.md`, `BOUWPLAN.md`

**Legenda moeite:** 🟢 klein (< ~100 regels) · 🟡 middel · 🔴 groot
**Legenda risico:** ✅ alleen tekenwerk · ⚠️ raakt de speltoestand of de save

---

## In het kort

| Fase | Wat | Onderdelen | Moeite |
|---|---|---|---|
| **0 · Fundering** | Eén stuurmodel en één toestandsmachine voor alles wat loopt | 3 | 🟡 |
| **1 · Materiaal** | Daken, schoorstenen, luiken, bouwputten die opbouwen | 4 | 🟡 |
| **2 · Mensen die werken** | Bouwers, straten, vracht, beroepshandelingen, dagritme | 7 | 🔴 |
| **3 · Water, lucht, weer** | Spiegelingen, hemelband, wolken, regen en mist | 4 | 🟡 |
| **4 · Grond en straten** | Akkers met groeistadia, straten die verharden en slijten | 2 | 🟢 |
| **5 · Militair leven** | Patrouilles, bemande torens, exercitie, wachtwissel | 4 | 🟡 |
| **6 · De rooftocht** | Rovers met benen, zichtbare beschieting, de vier keuzes, beleg | 6 | 🔴 |
| **7 · Momenten** | Feest, tijdperkovergang | 2 | 🟢 |
| **8 · Interface** | Iso-miniaturen, tellers, paneelovergangen, camerademping | 4 | 🟡 |

Fase 0 blokkeert 2, 5 en 6. Fase 1, 3, 4, 7 en 8 staan volledig los en kunnen
tussendoor.

---

## Uitgangspunten

Regels waar elk onderdeel hieronder zich aan houdt. Ze staan er niet voor de
netheid: ze zijn stuk voor stuk een keer duur geweest.

- **Geen bouwstap, geen modules.** Elk nieuw bestand is een IIFE die zich aan
  `window.Game` hangt, met een `<script>`-regel op de juiste plek in
  `index.html`. Het spel moet vanaf `file://` blijven werken.
- **`Game.state` blijft zuivere JSON.** Alles hieronder is afgeleide weergave.
  Eén onderdeel (0.2) haalt juist een veld wég uit state.
- **Decor stuurt de simulatie niet.** `raids.beslecht` blijft beslissen wie wint;
  de animatie laat alleen zien wat al besloten is. Dat staat zo in de kop van
  `raiders.js` en blijft zo.
- **Alles wat per tegel tekent, kost fills.** Nieuw grondwerk krijgt een
  zoomdrempel én een memoïsatie, zoals `verf()` die al heeft.
- **Beweging mag nooit per frame een pad zoeken.** Sturen is rekenwerk op velden
  die er al zijn; routes worden gecachet op een handtekening, zoals `paths.js`.
- **Taal:** identifiers en logtekst Nederlands, codecommentaar Engels.
- **`prefers-reduced-motion`** schakelt nieuw UI-geanimeer uit, net als nu.

---

## Fase 0 — Fundering: hoe alles beweegt

Dit is de fase met de minste zichtbare opbrengst en de grootste hefboom. Zonder
0.1 blijven de dorpelingen, de soldaten én de rovers glijden.

### 0.1 Eén stuurmodel — 🟡 ✅
**Nieuw:** `js/render/beweging.js`

Geef elke bewegende figuur `koers` (hoek) en `snelheid` in plaats van een
richting `±1`. Beide draaien/versnellen naar een doelwaarde toe met een maximum:

```
stuur(f, doelKoers, doelSnelheid, dt)   // draait max ~3 rad/s, versnelt max ~2 t/s²
```

Daarmee krijg je in één klap: bochten bij wegkruisingen in plaats van knikken,
aanzetten en uitlopen bij vertrek en aankomst, en een echte draai aan het eind
van de route in plaats van een sprite die in één frame spiegelt (`kijk` klapt nu
hard om).

**Klaar wanneer:** een wandelaar die aan het eind van zijn route omkeert, doet
daar zichtbaar een halve seconde over, en niemand verandert nog van richting
binnen één frame.

### 0.2 Wandelaars uit `Game.state` — 🟢 ⚠️
`js/render/renderer.js` · `js/core/state.js` · `js/core/save.js:134`

`s.wandelaars` staat in de speltoestand, wordt dus meegeschreven bij elke save,
en wordt bij het laden meteen weggegooid. Verplaats de lijst naar de rendermodule
(zoals `props` en `wildlife` het al doen). Saves worden kleiner en je mag er
daarna vrij velden aan hangen zonder de JSON-regel te belasten — wat fase 2, 5
en 6 allemaal willen.

**Let op:** `save.js` moet oude saves die het veld nog wél hebben blijven laden
(gewoon negeren), en `main.js` roept `verversWandelaars`/`tickWandelaars` aan met
`s` — die aanroepen blijven, alleen de opslag verhuist.

**Klaar wanneer:** `JSON.parse(Game.core.save.naarTekst(s)).wandelaars === undefined`,
en een save van vóór de wijziging laadt zonder fout.

### 0.3 Een toestand in plaats van een richting — 🟡 ✅
`js/render/beweging.js` · `js/render/renderer.js`

Vervang `richting` + `wachtT` door `bezig`: `lopen` / `werken` / `laden` /
`lossen` / `praten` / `rusten` / `huiswaarts`. Elke toestand heeft een eigen
duur, animatie en overgang. Dit is wat "handelingen doen" überhaupt mogelijk
maakt: nu bestaat er één handeling (de hakslag van een winner) en die geldt
alleen voor gebouwen met `wint` — een bakker doet visueel nooit iets.

Neem meteen **zijdelingse spreiding** mee: één vaste `zijoffset` per wandelaar
(±0,2 tegel loodrecht op de koers) plus rechts houden bij tegenliggers. Alle
wandelaars van hetzelfde gebouw lopen nu exact dezelfde polylijn en verschillen
alleen in fase — daardoor lopen ze door elkaar heen.

---

## Fase 1 — Materiaal van dichtbij

Los van alle andere fasen. Grootste kwaliteitssprong per regel code.

### 1.1 Daken krijgen materiaal — 🟡 ✅
`js/render/sprites.js` — `dakLagen`, tabel `ISO`

Rijen pannen (korte streepjes langs de nokrichting) of riet (ruwe, licht
willekeurige onderrand), gekozen met een nieuw veld `dakstijl: 'pan' | 'riet' |
'lei'` in de `ISO`-tabel, met `opties.zaad` voor de variatie die er al is.
Alleen tekenen boven `p > 34`.

Riet voor hutten en boerderijen, pannen voor burgerhuizen, lei voor kerk en
stadhuis: dan leest de standenstijging uit `standen.js` ook in het dak.

**Klaar wanneer:** uitgezoomd is het beeld identiek aan nu (drempel), ingezoomd
is een schaapskooi zichtbaar van ander materiaal dan een herenhuis.

### 1.2 Schoorstenen als geometrie — 🟢 ✅
`js/render/sprites.js` (`ISO`: `schoorsteen: {u, v, h}`) · `js/render/renderer.js` (`tickWerkrook`)

`tickWerkrook` laat rook opstijgen uit het niets. Zet een schoorsteenblokje op
het dak en anker de rook daaraan. Dikkere rook bij een werkende smederij of
bakkerij dan bij een huis, en 's winters rook uit élk bewoond huis — dat sluit
aan op `economy.brandhout`, dat dan toch al hout verstookt.

### 1.3 Luiken die 's nachts dichtgaan — 🟢 ✅
`js/render/sprites.js` — `gevelVlak`

De raamvlakken zijn statische donkere quads. Laat ze dicht met een luik zodra
`sfeer.licht(s).nacht` boven de drempel komt waarop `tekenVensters` de warme
gloed aanzet. Halve regel werk, en het trekt de dag/nachtcyclus tot in de gevel
door.

### 1.4 Bouwputten die opbouwen — 🟡 ✅
`js/render/sprites.js` — `tekenBouwplaats`

Nu: vier palen, een balk en een voortgangsbalkje. Wordt: steigers die met `deel`
meegroeien, een spil met touw bij `grootte >= 2`, en stapels van de grondstoffen
die het gebouw kost (`d.kosten` kent ze). Bouwen is een groot deel van de
speeltijd; het mag er beter uitzien dan de rest.

Hoort samen met 2.1 opgeleverd te worden.

---

## Fase 2 — Mensen die werken

Vereist fase 0.

### 2.1 Bouwers op de bouwplaats — 🟡 ✅
`js/render/renderer.js` — `verversWandelaars` (`renderer.js:119`)

`verversWandelaars` slaat elk gebouw met `!g.gebouwd` over. Aan een bouwput met
steigers en een voortgangsbalk werkt dus niemand, terwijl `construction.PLOEGEN`
precies weet hoeveel putten tegelijk bemand zijn en `s.bevolking.werkloos` de
ploeg is.

Genereer per actieve bouwput 2–4 bouwers (baan `bouwer`, die bestaat al in
`jobs.js`) die pendelen tussen een materiaalstapel en de steiger, met de
`werken`-toestand uit 0.3 en de hamer die `villagers.js` al kan tekenen.

**Klaar wanneer:** een net geplaatst gebouw trekt zichtbaar volk, en een
bouwput die stilligt (`raids.bouwStilgelegd`) heeft ook zichtbaar niemand.

### 2.2 Lopen over de straten die je betaalt — 🟡 ✅
`js/render/paths.js` — `P.route`

`paths.route` volgt de MST over gebouwcentra; de door de speler gelegde
`t.weg`-tegels — die in `logistiek.js` de haal met 45% verkorten — worden bij het
lopen genegeerd. De wereld spreekt daarmee de economie tegen.

Route wordt: van het gebouw naar de dichtstbijzijnde straattegel, over de straat
naar de tegel dichtst bij het doel, dan naar het doel. Op straat ~20% sneller
lopen. Cache op dezelfde handtekening plus `s.wegTeller` (die daar precies voor
bestaat).

### 2.3 Vracht die past bij de last — 🟢 ✅
`js/render/villagers.js` — `vracht`

Alles wordt boven het hoofd gedragen. Wordt: zak op de schouder (graan, meel),
kruiwagen (steen, hout, erts — de prop bestaat al in `props.js`), handkar met
twee personen bij grote leveringen, emmers bij water. En de gang moet zwaarder
worden onder last: trager, kleinere pas, meer voorover.

### 2.4 Elk beroep krijgt een handeling — 🟡 ✅
`js/render/villagers.js` · `js/render/renderer.js`

Nu heeft alleen `d.wint` een werkanimatie. Geef ook de makers er één op hun eigen
erf: de bakker schuift een schep in de oven (synchroon met de rook uit 1.2), de
smid slaat op het aambeeld (`particles.vonken` bestaat), de wever zit gebogen,
de molenaar sjouwt zakken.

Koppel de slagcadans aan `g.ervaring`: een geoefende ploeg werkt zichtbaar
vlotter. Dan zie je eindelijk wat die verborgen bonus doet.

### 2.5 Kinderen en ouderen op straat — 🟡 ✅
`js/render/villagers.js` · `js/render/renderer.js`

`demografie.js` weet al wie er zijn (`kinderen` / `volwassenen` / `ouderen`),
maar elke wandelaar ziet er hetzelfde uit. Kind = 0,65 schaal, snellere
stapfase, geen gereedschap, rent in korte spurtjes en blijft bij het plein
hangen. Oudere = gebogen romp, grijze haartuft, stok, trage pas, pauzeert op een
bank (`props` heeft `bank`). Verdeel de wandelaars naar de werkelijke
cohortverhouding.

### 2.6 Dagritme — 🟡 ✅
`js/render/renderer.js` · `js/render/sfeer.js`

Er is een volwaardige dag/nachtcyclus, maar om drie uur 's nachts is het even
druk als 's middags. Laat het aantal actieve wandelaars met `L.dag` meelopen, en
laat ze bij het invallen van de avond naar het dichtstbijzijnde huis lopen en
verdwijnen — precies de huizen waar `tekenVensters` dan aangaat. Ochtendspits
volgt gratis.

### 2.7 Kleine ontmoetingen — 🟢 ✅
`js/render/beweging.js`

Twee wandelaars die elkaar op minder dan een halve tegel passeren: kans op
`praten` — beiden stoppen 2–3 seconden, draaien naar elkaar toe, kleine
armgebaren. Het klassieke goedkope trucje dat een stad meteen bewoond laat
lijken.

**Prestatie:** dit is de enige die O(n²) dreigt te worden. Alleen wandelaars op
hetzelfde routesegment vergelijken, of een simpel tegelraster.

---

## Fase 3 — Water, lucht en weer

Los van alles.

### 3.1 Water dat weerspiegelt — 🟡 ✅
`js/render/sprites.js` — `water`, `kust`

Eén verticaal gespiegelde, uitgerekte, ~25% doorzichtige kopie van wat aan de
oever staat (bomen, gebouwen), met een sinusvervorming. Plus een glinsterspoor
richting `sfeer.SCHADUW` dat 's nachts naar koud maanlicht kleurt via
`sfeer.licht(s)`.

Alleen voor watertegels die aan land grenzen — `randen` uit `bereidTerreinVoor`
weet al welke dat zijn.

### 3.2 Een hemelband boven de kaartrand — 🟢 ✅
`js/render/sfeer.js`

Buiten de kaart is nu één egale diepzeekleur. Een verloop dat naar boven toe naar
de luchtkleur van `sfeer.licht(s)` gaat, met zon of maan als schijf die met `L.f`
over die band beweegt. Geeft de iso-horizon een eind.

### 3.3 Wolken die zelf zichtbaar zijn — 🟢 ✅
`js/render/renderer.js` — `tekenWolken`

`tekenWolken` tekent alleen schaduwen op de grond; de wolk zelf ontbreekt, wat
spookachtig oogt. Een lichte, zachte pluk boven de schaduw met parallax maakt de
beweging leesbaar.

### 3.4 Weer als toestand — 🟡 ✅
**Nieuw:** `js/render/weer.js`

Nu vallen er alleen bladeren in de herfst en sneeuw in de winter (`spawnWeer`).
Een overtrekkende **regenbui** — één timer in de rendermodule, nooit in state —
geeft gratis: een donkerder, blauwere wash, druppelstrepen, natte glans op wegen
en daken, en plassen die na afloop wegtrekken. Ochtendmist over laag terrein kost
één extra wash; de hoogtekaart ligt er al (`buurt.relief`).

**Klaar wanneer:** een sessie van tien minuten laat minstens twee verschillende
weertypes zien, en een save/load midden in een bui laadt zonder rare toestand
(want er is geen toestand).

---

## Fase 4 — Grond en straten

### 4.1 Akkers met groeistadia — 🟢 ✅
`js/render/sprites.js` — `akker`

Nu drie strepen die alleen van kleur wisselen. Wordt: stoppels → jong groen →
hoog goudkoren → geoogst, met een paar schoven bij de oogst. Dat maakt van het
seizoen een gebeurtenis in plaats van een filter.

### 4.2 Straten die verharden en slijten — 🟡 ✅
`js/render/paths.js`

Modderpad in tijdperk 1, kasseien vanaf tijdperk 3 (`s.tijdperk` lezen),
karrensporen waar veel wandelaars langskomen, plassen na regen (3.4). De
stoeprand en de kasseien staan er al; dit is vooral gelaagdheid toevoegen.

---

## Fase 5 — Het militaire leven

Vereist fase 0.

### 5.1 Soldaten patrouilleren in plaats van boodschappen doen — 🟡 ✅
`js/render/renderer.js` — `verversWandelaars` · `js/config/buildings.js:253`

De kazerne heeft `banen: {baan:'soldaat'}` maar geen `wint`/`maakt`, dus
`verversWandelaars` geeft de soldaten het dichtstbijzijnde depot als doel: ze
lopen met lege handen naar de voorraadschuur en terug.

Geef soldaten een eigen routegenerator: een **lus** langs muur, poorten en de
kaartrand aan de kant waar de vorige rovers vandaan kwamen (`s.raid.vanaf` weet
dat), met een pauze op elke wachtpost. Dit is het enige onderdeel in het plan dat
een echte fout repareert.

### 5.2 Bemande verdediging — 🟡 ✅
`js/render/renderer.js` · `js/core/raids.js` (`verdedigingSplit`, alleen lezen)

`verdedigingSplit(s)` weet exact welke torens, muren en poorten op het
roverskorridor liggen. Zet daar een figuur op: buiten een raid één slaperige
wachter, tijdens een waarschuwing een volle bezetting — schildwacht op de
torenrand, boogschutter achter de kantelen. Dat maakt van "verdediging: 34" een
plaatje dat de speler kan lezen.

### 5.3 Exercitie op het oefenveld — 🟢 ✅
`js/render/props.js` of `js/render/villagers.js`

Twee soldaten die met stokken sparren in een lus, een derde die op de pop slaat.
Puur decor, maar het geeft het gebouw een reden om bekeken te worden.

### 5.4 Wachtwissel — 🟢 ✅
`js/render/renderer.js`

Bij zonsopgang en zonsondergang lopen twee soldaten naar dezelfde post, staan
even samen stil, en één loopt terug. Vijftien regels, en het verankert de
dagcyclus in de militaire laag.

---

## Fase 6 — De rooftocht als schouwspel

Vereist fase 0 en 5. De simulatie weet hier al veel meer dan het scherm laat
zien; dit is grotendeels bestaande toestand zichtbaar maken.

### 6.1 Rovers met benen — 🟡 ✅
`js/render/raiders.js` — `R.teken`

De bende bestaat uit getinte atlas-sprites met een sinuswiebel, zonder benen: ze
lopen niet, ze zweven. Laat ze door `villagers.teken` gaan met een eigen palet en
een eigen `ACCENT`-set (gehavende kap, fakkel, bijl), zodat ze dezelfde gang
krijgen als je eigen mensen.

### 6.2 Een formatie die ademt — 🟡 ✅
`js/render/raiders.js` · `js/render/beweging.js`

Alle leden delen één positie plus een vaste offset, dus de bende schuift als één
plaat. Geef elk lid een eigen doelpunt rond de leider en laat het daar met het
stuurmodel naartoe navigeren: dan blijven achterblijvers achter en lopen ze om
obstakels heen. Aanvoerder vooraan met banier — `s.rovers` heeft al een naam en
een vete.

### 6.3 De beschieting zichtbaar maken — 🟡 ✅
`js/render/raiders.js` · `js/core/raids.js:132` (alleen lezen)

`raids.marcheer` laat elke toren, muur en poort op de route één keer vuren, trekt
dat van `r.kracht` af en zet `r.beschoten[g.id]`. Op het scherm gebeurt er niets.

Dit is de beste kandidaat van het hele plan: een pijlsalvo dat van die toren naar
de bende vliegt op precies het moment dat `beschoten[g.id]` waar wordt, én **een
rover die valt** — laat het aantal zichtbare leden meelopen met `r.kracht` in
plaats van bij `spawn` vast te staan. Dan zijn die 45 seconden aanloop een
gevecht dat je kunt volgen, en zie je wat je torens waard zijn.

### 6.4 Vier keuzes, vier beelden — 🔴 ✅
`js/render/raiders.js` · `js/render/renderer.js`

De vier verbs op `s.raid.keuze` hebben nu geen enkel beeld:

| Keuze | Wat je ziet |
|---|---|
| **ontruimen** | wandelaars buiten `evacuatieStraal` laten hun werk vallen en stromen naar het centrum |
| **burgerwacht** | werklozen lopen naar het korridor en gaan met hooivorken in een rij staan; de bouwers gaan zichtbaar mee (het bouwen ligt toch stil) |
| **schatting** | een kar met munten rijdt naar de bende en komt leeg terug |
| **uitval** | het garnizoen marcheert in formatie de poort uit, stelt zich op tussen stad en bende, en botst |

De uitval is het dramatischste dat de simulatie kent en is nu een vinkje met een
logregel. `uitslag: 'vernietigd'` verdient een korte melee met stofwolk, en een
terugtocht die trager en ongeordender is dan de opmars.

### 6.5 Het belegkamp — 🟡 ✅
`js/render/raiders.js`

Bij `s.raid.fase === 'beleg'`: tenten op de perimeter, een kampvuur, gestalten
die eromheen zitten en af en toe opstaan, patrouilles langs de rand van
`belegStraal`. Een beleg duurt lang genoeg om naar te kijken en is nu alleen een
balk in de UI.

### 6.6 Nacht, fakkels en plundering — 🟡 ✅
`js/render/raiders.js` · `js/render/sfeer.js`

Fakkels als lichtbron in de nachtwash (dezelfde `lighter`-compositie als
`tekenVensters`). En bij `doorgebroken` niet één brandje op het doelgebouw, maar
rovers die zich verspreiden, elk kort bij een gebouw stilstaan en met een last
wegrennen. Het verschil tussen "de raid is verloren" en "ze nemen mijn spullen
mee" zit helemaal in die animatie.

---

## Fase 7 — Momenten

### 7.1 Het feest — 🟢 ✅
`js/render/props.js` — `tekenFeest`

Nu vlaggetjes. Wordt: een vreugdevuur op het plein, dorpelingen die er in een
kring omheen bewegen (de `praten`/`rusten`-toestanden uit 0.3 volstaan), en
lampionnen die 's avonds meedoen met `tekenVensters`.

### 7.2 De tijdperkovergang — 🟢 ✅
`js/render/renderer.js` — `tekenSweep` · `js/ui/overlay.js`

De sweep bestaat al. Een perkament-wipe over het hele scherm met de naam van het
nieuwe tijdperk maakt er een mijlpaal van in plaats van een logregel.

---

## Fase 8 — Interface en camera

### 8.1 Iso-miniaturen in menu en paneel — 🟡 ✅
`js/ui/buildmenu.js` · `js/ui/panel.js`

De bouwknoppen tonen een emoji. `sprites.tekenGebouw` kan naar een offscreen
canvas van 48×48 renderen — één keer per gebouwtype, gecachet — zodat je in het
menu het échte volume ziet dat je gaat neerzetten. Zelfde truc in het
selectiepaneel, met een voortgangsring tijdens de bouw.

**Let op:** de `handtekening()`-diff in beide bestanden mag hier niet door
kapotgaan; de miniatuur hoort bij de knop, niet bij de herbouw.

### 8.2 Tellers die tellen — 🟢 ✅
`js/ui/hud.js`

Getallen tellen op en af in plaats van te springen, met een korte kleurpuls bij
verandering en een rustige rode pols bij een tekort.

### 8.3 Paneelovergangen — 🟢 ✅
`css/style.css`

Panelen schuiven in en uit met de bestaande `--soepel`-transitie in plaats van
hard te verschijnen. Valt onder de bestaande `prefers-reduced-motion`-uitschakelaar.

### 8.4 Camerademping — 🟢 ✅
`js/render/camera.js`

Inertie bij slepen, soepel inzoomen naar de cursor. Technisch geen render, maar
het is het eerste wat "goedkoop" aanvoelt aan een citybuilder.

---

## Prestatiebudget

`VISUEEL.md` sloot af met een meting: 20 → 15 fps in headless Chromium
(softwarematig, dus een pessimistische ondergrens) na de vorige ronde. Dat is de
lat. Afspraken voor deze ronde:

- **Meet vóór en ná elke fase** met dezelfde methode (headless Chromium, zoom
  1,0, vaste seed). Een fase die meer dan ~5% kost, gaat niet mee zoals hij is.
- **Zoomdrempels** op al het detailwerk: dakmateriaal en luiken boven `p > 34`,
  spiegelingen boven `p > 20`, wandelaars staan al op `p > 15`.
- **Memoïseer** elke nieuwe kleurberekening op dezelfde manier als `verf()`.
- **Voeg geen full-screen fill toe** zonder een bestaande fill mee te nemen; de
  gradaties in `tekenGradatie` zijn niet voor niets samengevoegd.
- De wandelaarslimiet van 90 (`limiet` in `verversWandelaars`) blijft staan.
  Bouwers, soldaten en rovers tellen mee in dat budget.

---

## Testprotocol

Er is geen testrunner; dit is wat er in de plaats komt, per oplevering:

1. **`file://`** — `index.html` direct openen, want dat is het hoofddoel.
2. **Subpad** — ook serveren vanuit een submap (zoals GitHub Pages op
   `/Spelletje/`), omdat alle assetpaden relatief zijn.
3. **Console** — `js/devcheck.js` moet `✅ Speldata gecontroleerd` blijven
   melden. Nieuwe velden in `ISO` of `BIJ` horen daar geen fout op te leveren.
4. **Headless doorloop** — via `window.spel`: `nieuwSpel()`, dan de tickfuncties
   in de vaste volgorde met een vaste `dt`, met `Game.core.gebeurtenissen.kies(s, 0)`
   voor elke `s.gebeurtenis.actief`. Een vers dorp moet tijdperk 4 halen zonder
   honger. **Geen enkel onderdeel in dit plan mag die uitkomst veranderen** — als
   het wel gebeurt, is er per ongeluk simulatie geraakt.
5. **Save/load** — een save van vóór de wijziging moet laden; na 0.2 mag
   `wandelaars` niet meer in de JSON staan.
6. **Raid met de hand** — een raid forceren en alle vier de keuzes doorlopen, plus
   een beleg, want fase 6 is niet te bereiken door gewoon te spelen.

---

## Nieuwe bestanden

Drie stuks, elk een IIFE met een `<script>`-regel in `index.html`:

| Bestand | Wat | Waar in de laadvolgorde |
|---|---|---|
| `js/render/beweging.js` | stuurmodel + toestandsmachine | ná `camera.js`, vóór `renderer.js` |
| `js/render/weer.js` | regen, mist, plassen | naast `particles.js` |
| (optioneel) `js/render/volk.js` | de wandelaarslijst, als 0.2 hem uit state haalt | vóór `renderer.js` |

---

## Wat state raakt

Vrijwel niets — en dat is het punt.

**Raakt state:** alleen 0.2, en dan door een veld te **verwijderen**
(`s.wandelaars`). `save.js` moet oude saves blijven accepteren.

**Blijft er buiten:** het stuurmodel en alle toestanden van wandelaars, soldaten
en rovers; het weer; de spiegelingen en de hemelband; het belegkamp; de
miniaturen. Fase 6 léést veel uit `s.raid` (`beschoten`, `keuze`, `kracht`,
`fase`) maar schrijft er nooit in.

---

## Waar te beginnen

**Fase 0 + 2.1 + 6.3 + 5.1** als eerste oplevering. Die vier delen dezelfde
fundering, raken alle drie de groepen die bewegen, en repareren onderweg de
soldaten die nu boodschappen doen. Daarna **fase 1** (materiaal) voor de grootste
sprong op een screenshot, en **fase 3** (water en lucht) als tweede.

Fase 4, 7 en 8 zijn afwerking en kunnen op elk moment ertussendoor.
