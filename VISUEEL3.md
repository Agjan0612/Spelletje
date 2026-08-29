# Bouwplan: de blik van Age of Empires — visueel 3

`VISUEEL.md` gaf het spel licht, zachte terreinovergangen en gebouwsilhouetten.
`VISUEEL2.md` gaf het materiaal, weer, water en een stuurmodel voor alles wat
loopt. Beide zijn af, en het spel ziet er nu *netjes* uit.

Dit plan gaat over de sprong van netjes naar **mooi**, en die sprong zit niet in
nog een detail erbij. Ik heb het spel headless gedraaid en op vier zoomniveaus
en twee dagdelen een screenshot gemaakt (zie *Hoe dit gemeten is*, onderaan).
Wat je op die screenshots ziet is vijf keer hetzelfde probleem:

1. **Het raster is zichtbaar.** Niet subtiel — op de winterschermafdruk telt het
   oog de tegels. Bomen staan in rijen, sneeuw ligt in ruitjes, gras is een
   dambord van twee groenen. Age of Empires heeft precies hetzelfde tegelraster
   en je ziet het nooit, omdat daar niets *op het midden van een tegel* staat
   en geen enkele grens recht is.
2. **Alles is een egale vlakvulling.** Op maximale zoom is een muur één vlak
   crème en een dak één vlak bruin. Er is geen korrel, geen pan, geen pleister,
   geen grasspriet. Dit is de reden dat het beeld "vector" aanvoelt en niet
   "geschilderd" — en het is veruit het grootste verschil met AoE.
3. **De wereld heeft een rand.** Uitgezoomd is de kaart een ruitvormig vlot op
   een lege blauwe verloop, met een witte zonneblob ernaast in de leegte. Dat
   leest als een maquette op tafel, niet als een landschap. AoE laat je de rand
   van de wereld nooit zien.
4. **Alles staat in dezelfde waarde.** Grond, gebouw, boom en berg zitten
   allemaal in dezelfde middentoon, matig verzadigd, olijf-grijs-bruin. Er is
   geen enkel donker en geen enkel licht. AoE zet gebouwen lichter dan de grond
   en legt er een echte donkere schaduw onder; dáár komt het reliëf vandaan.
5. **Het eerste wat je ziet zijn pictogrammen.** Op de ingezoomde schermafdruk
   staan twaalf gele waarschuwingsdriehoeken en een emoji-bordje op elk dak, op
   volle sterkte, groter dan de daken zelf. Het dorp is visueel een stapel
   iconen met huizen eronder. Dit is één avond werk en het is de grootste
   directe winst op een screenshot van het hele plan.

- **Branch:** `claude/game-graphics-overhaul-9gly1a`
- **Status:** 📋 plan — nog niets van uitgevoerd
- **Volgt op:** `VISUEEL.md` (uitgevoerd), `VISUEEL2.md` (uitgevoerd)

**Legenda moeite:** 🟢 klein (< ~100 regels) · 🟡 middel · 🔴 groot
**Legenda risico:** ✅ alleen tekenwerk · ⚠️ raakt speltoestand, save of prestaties

---

## In het kort

| Fase | Wat | Moeite | Sprong |
|---|---|---|---|
| **A · Pictogrammen** | Het bordje en de driehoek terugdringen | 🟢 | ⭐⭐⭐⭐ |
| **B · De rand weg** | Zee tot de horizon, geen zonneschijf, camera houdt de rand buiten beeld | 🟡 | ⭐⭐⭐⭐ |
| **C · Het raster breken** | Ruis over tegelgrenzen heen, decor los van de tegel, grillige grenzen | 🔴 | ⭐⭐⭐⭐⭐ |
| **D · Materiaal** | Korrel over de grond, terreinpatronen, pannen en pleister | 🔴 | ⭐⭐⭐⭐⭐ |
| **E · Licht en waarde** | Diepere schaduw, verzadigder palet, één kleurgradatie aan het eind | 🟡 | ⭐⭐⭐⭐ |
| **F · Gebouwen met erf** | Een erf onder elk gebouw, hoger silhouet, meer daklijn | 🟡 | ⭐⭐⭐ |
| **G · Mensen** | Groter, met contour en contactschaduw | 🟢 | ⭐⭐ |
| **H · Echte iso-kunst** | De `assets/iso/`-haak vullen (optioneel spoor) | 🔴 | ⭐⭐⭐⭐ |

A en B zijn samen één avond en halen de twee dingen weg die het beeld nú het
meest tegenhouden. C en D zijn het eigenlijke werk en horen bij elkaar. E is
goedkoop en versterkt C en D. F, G, H staan los.

---

## Uitgangspunten

Dezelfde als in `VISUEEL2.md`, want ze zijn allemaal een keer duur geweest:

- **Geen bouwstap, geen modules.** Elk nieuw bestand is een IIFE aan
  `window.Game`, met een `<script>`-regel op de juiste plek in `index.html`.
  Het spel moet vanaf `file://` blijven werken.
- **`Game.state` blijft zuivere JSON.** Alles hieronder is afgeleide weergave en
  hoort in de rendermodules of in een cache op `kaart.seed`.
- **Decor stuurt de simulatie niet.** Alles wat toeval nodig heeft trekt uit
  `Game.render.rng`, nooit uit `Math.random`.
- **Alles wat per tegel tekent kost fills.** De grootste kaart is 88×64 = 5632
  tegels, en op minimale zoom staan die allemaal tegelijk in beeld. Elk nieuw
  grondwerk krijgt een zoomdrempel **en** een memoïsatie, zoals `verf()` die al
  heeft. Nieuwe regel voor dit plan: *geen `ctx.save()`/`clip()`/`restore()` per
  tegel* — dat is de ene canvas-operatie die op 5000 tegels echt pijn doet.
- **Taal:** identifiers en logtekst Nederlands, codecommentaar Engels.
- **`prefers-reduced-motion`** schakelt nieuw geanimeer uit.

---

## Fase A — De pictogrammen terugdringen

🟢 ✅ · `js/render/renderer.js` · `js/render/sprites.js`

Het goedkoopste werk in dit hele document en waarschijnlijk de grootste sprong
per regel. Op de ingezoomde schermafdruk is het dorp niet te zien: er staan
twaalf gele driehoeken en twaalf zwarte emoji-bordjes overheen.

### A.1 Het emoji-bordje verdwijnt bij spelzoom
`sprites.tekenGebouw`, functie `bordje` (regel ~1131)

Nu is het bordje volledig dekkend tot `p = 48` en vervaagt het pas tussen 48 en
70 (maximum is 88). Op elke normale speelafstand staat het er dus voluit. Draai
het om: het bordje is een *hulpmiddel bij uitzoomen*, geen versiering.

- Zichtbaar onder `p < 26` (uitgezoomd, silhouet niet leesbaar), daarboven uit.
- Bij aanwijzen of selecteren altijd zichtbaar, ongeacht zoom.
- Een `Alt`-toets (of een schakelaar in de lagenbalk) zet alle bordjes aan —
  dat is precies wat AoE met zijn gezondheidsbalken doet.
- Het bordje moet mee met het nachtlicht: nu staat het 's nachts op volle
  helderheid over de donkerwas heen (zie de avondschermafdruk).

**Klaar wanneer:** op maximale zoom is er geen enkele emoji in beeld, en op
minimale zoom is elk gebouw nog te herkennen.

### A.2 Waarschuwingen ingetogen
`renderer.js:1043`

Nu: `⚠️` op 100% dekking, op `p * (0.6 + grootte * 0.5)` boven het dak — bij
tien problemen tien felgele driehoeken die het hele dorp overschreeuwen. Het
probleem is dat de waarschuwing *per gebouw* schreeuwt terwijl de speler hem
*per stad* moet oplossen — en die lijst bestaat al, in `ui/stad.problemen`.

- Klein, halfdoorzichtig, pulserend in plaats van massief.
- Ten hoogste de ergste drie tegelijk in beeld (de rest staat in de
  problemenlijst, waar hij al staat).
- Bij `p < 20` helemaal weg.
- Bij het aanwijzen van een gebouw met een probleem: dan wél voluit, met de
  reden ernaast.

### A.3 Bouwplaatsen en overlays dempen mee
De steigers, de aanvoerpijlen en de kaartlagen zijn dezelfde soort informatie.
Eén dekkingsregel voor alles wat *informatie* is in plaats van *wereld*, in
`renderer.js`, zodat een screenshot van het dorp een screenshot van het dorp is.

---

## Fase B — De wereld heeft geen rand

🟡 ✅ · `js/render/sfeer.js` · `js/render/camera.js` · `js/render/renderer.js`

Uitgezoomd is dit nu een ruit op een verloop. Drie ingrepen en het is een
landschap.

### B.1 Zee tot aan de horizon
`sfeer.tekenHemel`

Nu tekent `tekenHemel` één verticaal verloop van luchtblauw naar zeeblauw over
het hele scherm, en daar tekent de kaartruit bovenop. Daardoor is "buiten de
kaart" letterlijk lucht waar water hoort.

Vervang dat door twee zones met een echte horizon ertussen:

- **Onder de horizon:** open zee in de kleur van `waterKleur()` op maximale
  diepte, met dezelfde golfbeweging en dezelfde spiegeling die de watertegels al
  hebben (`water()`, `spiegeling()`), maar als één vlak in plaats van per tegel.
  De kaartrand valt dan niet meer op, want er ligt hetzelfde water naast.
- **Boven de horizon:** de lucht, met de bestaande wolken en een sterke
  luchtnevel op de horizonlijn zelf.
- De horizonhoogte volgt de camera: de iso-projectie heeft geen echte horizon,
  dus kies een vaste schermhoogte (~28% van boven) en laat de nevel het verschil
  wegpoetsen.

Kosten: één `fillRect` met een patroon plus wat de wolken al kostten.

### B.2 De zonneschijf verdwijnt
`sfeer.tekenHemel`, regels 83–101

De zon is nu een witte radiale blob van 4,5% van het scherm die los in de lucht
hangt. Hij zit in schermruimte, dus hij schuift niet mee met de wereld, en de
schaduwrichting (`sfeer.SCHADUW`) staat er los van — de zon staat linksboven in
beeld terwijl de schaduwen naar rechtsonder vallen. Dat is precies de reden dat
hij als sticker leest.

Haal de schijf weg. Het licht dat de zon geeft ziet de speler al: in de
kleurgradatie, in de vensters, in de schaduwen. Wat ervoor terugkomt is een
warme gloed *op de horizon* aan de kant waar `SCHADUW` vandaan komt — geen
object, alleen licht. Behoud de maan wél: een maan als schijf klopt visueel
prima en geeft de nacht een anker.

### B.3 De camera laat de rand niet zien
`camera.begrens`, `camera.zoomOp`

Minimale zoom is nu 0,4 — ver genoeg uit om de hele kaart plus een brede band
leegte te zien. Maak de ondergrens dynamisch: niet verder uit dan waarop de
kaart het beeld nog vult (met een marge van een paar tegels aan elke kant). Op
een kleine kaart is dat een andere zoom dan op een grote, dus reken hem uit uit
`kaart.b/h` en de vensterafmeting.

Voor de overzichtsbehoefte die dat wegneemt: de minimap staat er al, en die is
er precies voor.

### B.4 Een kustlijn met branding
`sprites.kust`

De kust is nu een kleurovergang. Een smalle, licht bewegende schuimrand op de
tegels met `diepte === 1` maakt van de grens tussen land en zee een gebeurtenis
in plaats van een lijn — en dat is een van de dingen die je in elke AoE-kaart
meteen ziet.

---

## Fase C — Het raster breken

🔴 ✅ · `js/render/sprites.js`

Dit is de fase die op de winterschermafdruk het meest nodig is en waar de meeste
gedachte in moet. Het spel tekent per tegel, en dat mag: AoE doet dat ook. Wat
niet mag is dat *elke visuele beslissing* op de tegelgrens valt.

### C.1 Ruis die groter is dan een tegel — 🟡
`tekenGrond`, nieuw `terreinRuis()` in de `schaduwCache`

`tegel.v` is een stabiel toevalsgetal per tegel, en dat is precies het probleem:
elke tegel trekt onafhankelijk, dus het resultaat is dambordruis met een
golflengte van één tegel. Het oog ziet golflengte-1-ruis als een raster.

Bak er, naast de hillshade en `diepte`, een **meeroctaafs waardeveld** bij,
gekeyd op `kaart.seed`: drie octaven met golflengtes van ongeveer 12, 5 en 2
tegels. Gebruik dat veld voor de helderheid en lichte kleurverschuiving van de
grondtegel in plaats van `tegel.v`. Gras wordt dan een landschap met vlekken
droger en natter gras, over tientallen tegels — precies zoals een AoE-kaart
eruitziet.

`tegel.v` blijft waar hij hoort: voor de dingen die *per tegel* moeten
verschillen (welke boomsprite, hoeveel keien).

**Klaar wanneer:** een schermafdruk van een leeg grasveld op maximale zoom heeft
geen zichtbare ruitjes meer.

### C.2 Decor staat niet meer op het midden van een tegel — 🟡
`bomen`, `rotsen`, `wild`, `props.js`

De boomverspreiding is nu `ox = d.cx + p * (jitter over ±0,23 tegel)` en
`oy = d.cy + p * (jitter over ±0,06)`. Die y-spreiding van 6% is de reden dat
bomen in **rijen** staan: ze mogen zijwaarts wel wat zwerven, maar nooit naar
voren of naar achteren.

- Spreiding naar ±0,45 tegel in x én y — decor mag over de tegelgrens heen.
- Schaal per exemplaar 0,72–1,35 in plaats van één maat, uit hetzelfde
  toevalsgetal.
- Kleurtoon per exemplaar een paar procent, zoals `verscheidenheid()` dat voor
  gebouwen al doet.
- Het aantal bomen per tegel uit het meeroctaafs veld van C.1 in plaats van
  alleen uit `amt/max`, zodat een bos dichte en open plekken krijgt.

Let op de tekenvolgorde: decor dat over de tegelgrens hangt moet nog steeds in
de diepte-gesorteerde laag van `renderer.js` mee (`soort: 0`), en de sorteersleutel
is nu de tegel, niet het exemplaar. Voor bomen die ver van hun tegelmidden staan
kan dat één rij te vroeg tekenen. Oplossing: sorteer op de *werkelijke* wereldpositie
van het exemplaar, niet op de tegel — dat betekent dat `tekenKenmerk` zijn
exemplaren moet kunnen *opsommen* voordat het ze tekent. Eén extra functie
`S.kenmerkDelen(tegel, x, y)` die de lijst teruggeeft; `renderer.js` duwt die
los in `laag`.

### C.3 Grillige terreingrenzen — 🟡
`overgangen`, `band`

De overgang tussen twee terreinen is nu twee rechte quads langs de diamantrand.
Recht is het probleem: een kustlijn is nooit recht. Vervang `band()` door een
rand die langs zijn lengte golft: verdeel de rand in 4–6 segmenten en varieer de
insteekdiepte per segment uit een toevalsgetal dat aan de *rand* hangt (beide
tegels moeten dezelfde waarde uitrekenen, anders ontstaat er een naad — dus
hash op de gesorteerde tegelindices, niet op één tegel).

Zelfde truc voor `sneeuwdek`: sneeuw ligt nu als een ruitvormige mat per tegel.
Met een golvende rand en de ruis van C.1 wordt het een sneeuwveld.

### C.4 Bos als massa in plaats van als tegels — 🟢
`bomen`

Op tegels waarvan alle vier de buren ook bos zijn: één donker bladerdek onder de
bomen (een grote, zachte, donkergroene vlek) voordat de individuele bomen
getekend worden. Dat is wat een bos in AoE dicht maakt — je ziet geen grond meer
tussen de stammen door. Aan de bosrand niet, daar wil je de losse bomen zien.
De randinformatie hiervoor staat al in `schaduwCache.randen`.

---

## Fase D — Materiaal: van vlakvulling naar geschilderd

🔴 ⚠️ (prestaties) · `js/render/sprites.js`

Dit is het verschil tussen dit spel en Age of Empires, en het is één ding: AoE
tekent geschilderde texturen, dit spel tekent `ctx.fill()` met een hex. Alles
hieronder gaat over textuur terugbrengen zonder de belofte te breken dat het
spel zonder `assets/` werkt.

### D.1 Eén korrellaag over de hele grond — 🟢, en verrassend groot
`renderer.teken`, na de grondlaag

De goedkoopste echte texture die er is: maak één keer een tegelbaar canvas van
128×128 met fijne ruis (een paar duizend puntjes in drie grijswaarden), maak er
een `createPattern(..., 'repeat')` van, en leg dat als **één `fillRect` over het
hele scherm** met `globalCompositeOperation = 'soft-light'` op ~0,10 dekking.

Twee dingen maken dit goed in plaats van goedkoop:

- Het patroon moet **meeschuiven met de camera**, anders zwemt de textuur over
  de wereld heen bij het pannen. `pattern.setTransform(new DOMMatrix()
  .translate(-offsetX % 128, -offsetY % 128))` — de offset komt uit
  `cam.wereldNaarScherm(0,0)`.
- Het moet vóór de opstaande laag, niet erna: gebouwen en bomen hebben hun eigen
  materiaal en willen deze korrel niet over zich heen.

Kosten: één `fillRect` per frame. Opbrengst: elke vierkante centimeter grond in
het spel houdt op met plat zijn. Dit is de hoogste opbrengst-per-regel in dit
hele document en het zou als eerste van fase D gebouwd moeten worden.

### D.2 Terreinpatronen per soort — 🟡 ⚠️
`tekenGrond`

Voor de zoomniveaus waarop het telt (`p >= 30`): per terreinsoort per seizoen
één offscreen patroon van 64×64 — grasspriet-arceringen voor gras,
ploegvoren-arcering voor `vruchtbaar`, korrelige spikkel voor rots, gebroken
vlekken voor bos. Twaalf patronen in totaal, één keer gebouwd, gecachet naast de
hillshade.

Het vullen van de diamant met dat patroon moet **zonder `clip()` per tegel**
(zie Uitgangspunten). Dat kan: `padDiamant()` bouwt al een pad, en
`ctx.fillStyle = patroon; ctx.fill()` vult dat pad direct met het patroon — geen
clip, geen save/restore. Het patroon moet wel camera-gebonden getransformeerd
zijn zoals in D.1, anders schuift de textuur onder de tegel door.

Bewaak de kosten met de bestaande zoomdrempels en meet met het bestaande
frame-budget (zie *Hoe dit gemeten is*).

### D.3 Daken en muren krijgen echt materiaal — 🟡
`dakLagen`, `isoMuren`, `gevelVlak`

`VISUEEL2.md` fase 1.1 heeft `dakstijl` (`pan`/`riet`/`lei`) ingevoerd, maar op
de schermafdruk op maximale zoom is er geen pan te bekennen — het effect is te
subtiel om te bestaan. Zet het door:

- **Pannen:** rijen halve-cirkelbogen langs de nokrichting, in twee tinten, met
  een donkere lijn per rij. Op ~`p >= 40` zichtbaar, daaronder één toon.
- **Riet:** een dikke, onregelmatige onderrand plus verticale arcering, en de
  nok als een dikkere donkere richel.
- **Lei:** onregelmatige vierhoekige leien in drie grijstinten.
- **Pleister:** lichte vlekkerigheid over het muurvlak (dezelfde korrel als D.1
  maar per gebouw en sterker), plus vuil onderaan de muur waar hij de grond
  raakt. Die vuilrand is een klassieke schildertruc en hij zet een gebouw
  vast op de grond.
- **Hout:** de balken van `vakwerk()` krijgen nerf.

### D.4 Water dat iets doet — 🟡
`water`, `spiegeling`

Het water heeft golfbeweging en een spiegeling, maar leest als effen blauw met
strepen. Wat ontbreekt is **contrast tussen golf en dal**: een lichte glans op
de golfkoppen (bijna wit, klein, kort) en een donkerder dal. Plus een tweede
golfrichting met een andere frequentie, zodat het patroon niet herhaalt.

---

## Fase E — Licht en waarde

🟡 ✅ · `js/render/sfeer.js` · `js/render/sprites.js`

Fase C en D geven textuur; deze fase geeft het beeld *reliëf*. Alles hier is
klein werk met veel effect.

### E.1 Schaduwen die er zijn — 🟢
`slagschaduw` (sprites.js:1095), `grondschaduw`

De slagschaduw van een gebouw is nu `rgba(24,20,14,.22)` en die van een boom
`0.2`. Op de schermafdruk zie je ze nauwelijks. In AoE is de schaduw onder een
gebouw het donkerste in beeld, en dát is waarom het gebouw ergens staat.

- Dekking naar ~0,38 voor gebouwen, ~0,3 voor bomen.
- De schaduwkleur uit `sfeer.licht(s)` halen in plaats van vast: 's ochtends en
  's avonds langer en warmer, midden op de dag korter en koeler-blauw. De
  richting blijft vast (`sfeer.SCHADUW`) — dat is een bewuste keuze uit
  `VISUEEL.md` en die moet blijven, want de hillshade is er in gebakken.
- Schaduwen van bomen en gebouwen moeten *op elkaar* kunnen vallen. Dat kan
  zonder echte projectie: teken alle grondschaduwen van de opstaande laag in één
  voorafgaande doorloop, in één `globalAlpha`, zodat ze samensmelten in plaats
  van elkaar donkerder te maken.

### E.2 Verzadiging en waardebereik — 🟢
`TERREIN`-tabel, `TIER_PALET`, `ISO`

De hele palet-tabel zit tussen 40% en 65% helderheid en onder ~35% verzadiging.
Dat is de reden dat een screenshot vlak aanvoelt, ook al staat er van alles op.

- Gras en bos warmer en verzadigder (AoE-gras zit rond `#7a9a3c`, niet
  `#6f8f4a`), en het verschil tussen `gras` en `bos` groter.
- Daken donkerder en roder, muren lichter. Nu zitten muur (`#c9b491`) en dak
  (`#7c4b2e`) 30 helderheidspunten uit elkaar; maak daar 45 van. Een gebouw moet
  lichter zijn dan de grond eromheen — dat is wat het naar voren haalt.
- Eén verzadigd accent per gebouwtype dat het verdient (vlag, luifel, deur), en
  verder niets. Een enkel rood in een olijfgroen veld doet meer dan tien.

### E.3 Eén kleurgradatie aan het eind — 🟡
`sfeer.tekenGradatie`

Er ligt al een dagdeel-was. Maak er een echte grade van: naast de kleurwas ook
een lichte S-curve op het contrast (donkerder donkers, iets warmere lichten),
per seizoen anders — winter blauwig en laag contrast, zomer warm en hoog. Dit is
één samengestelde bewerking over het hele scherm en het bindt alles wat eronder
ligt tot één beeld. Het is ook wat een screenshot van een spel onderscheidt van
een screenshot van een tekening.

---

## Fase F — Gebouwen die je herkent zonder pictogram

🟡 ✅ · `js/render/sprites.js` · `js/render/props.js`

Fase A haalt de emoji weg; deze fase zorgt dat je hem niet mist.

### F.1 Een erf onder elk gebouw — 🟢, en het meest "AoE" van alles
Voor `tekenGebouw` de wanden tekent: een onregelmatige vlek aangestampte aarde
onder en rond de voetafdruk, iets groter dan het gebouw, met een golvende rand
(dezelfde techniek als C.3). Elk gebouw in AoE staat op zo'n plek, en het is een
van de sterkste redenen dat een AoE-dorp als *nederzetting* leest en niet als
losse huizen in een weiland.

Twee bijvangsten: het erf verbergt de tegelgrens onder het gebouw, en het geeft
`props.js` een natuurlijke ondergrond voor zijn rommel.

### F.2 Hoger silhouet, meer daklijn — 🟡
De `ISO`-tabel zit rond `muurH: 0.5` en `dakH: 0.46`. Dat is bouwkundig
verantwoord en visueel saai: alle gebouwen zijn ongeveer even hoog, dus het dorp
is één vlak. Vergroot het bereik — hutten lager, hallen en kerken fors hoger — en
voeg vormen toe die het silhouet breken: dakkapellen, een aanbouw met een lager
dak, een uitkragende bovenverdieping op de vakwerkhuizen, een luifel op de
werkplaatsen.

### F.3 Gebouwen die zichtbaar bezig zijn — 🟡
De schoorsteenrook uit `tickWerkrook` doet dit al goed en is het model: iets dat
zichtbaar verandert omdat de simulatie verandert. Meer daarvan — wasgoed tussen
twee huizen, karren bij de opslag, een houtstapel bij de houthakker die groeit
met de voorraad, een marktkraam die vult als er handel is. `props.js` heeft de
haak (`BIJ`) — het gaat hier om meer en betere props, niet om nieuwe techniek.

---

## Fase G — Mensen

🟢 ✅ · `js/render/villagers.js`

De dorpelingen zijn op de schermafdruk nauwelijks te vinden. Drie kleine dingen:
een donkere contourlijn om de figuur (AoE-eenheden hebben allemaal een outline,
dat is wat ze leesbaar houdt op elke ondergrond), een echte contactschaduw
onder de voeten, en ~20% groter. Kleurcontrast in de kleding: één verzadigd
kledingstuk per beroep.

---

## Fase H — Het spoor naar echte iso-kunst

🔴 ⚠️ · `js/render/atlas.js` · `assets/iso/`

Eerlijk over het plafond van alles hierboven: procedureel getekende volumes met
textuur komen tot een jaar of 2000 — *Settlers II*, *Anno 1602*. Age of Empires
II ziet eruit zoals het eruitziet omdat elk gebouw met de hand geschilderd is in
vier bouwfasen. Fase A tot G halen misschien 75% van het gat dicht. De laatste
25% is kunst, geen code.

De haak bestaat al: `atlas.isoGebouwMap` is leeg en `tekenGebouw` valt terug op
het procedurele volume zodra een sprite ontbreekt (`sprites.js:1019`). Dat
contract is precies goed en moet zo blijven — het spel moet zonder `assets/`
blijven werken.

Een realistisch spoor:

1. Begin met **vier heldengebouwen**: dorpsplein, kathedraal, kasteel, stadhuis.
   Die zijn groot, uniek en staan altijd in beeld.
2. Één sprite per gebouw, gerenderd op de grootste zoom die de camera toelaat
   (`2.6 * 34 = 88px` per tegel, dus een 4-tegelgebouw is ~360px breed).
3. De rest van het dorp blijft procedureel. Dat mengt beter dan je denkt zolang
   fase D de materialen op elkaar afstemt — en als het niet mengt, is de haak
   per gebouw, dus je kunt terug.

Alternatief zonder tekenaar: de volumes uit `sprites.js` één keer offline naar
een grote canvas renderen, daar met de hand of met een filter textuur overheen
leggen, en die als sprite inladen. Dan koop je detail zonder per-frame kosten en
zonder stijlbreuk.

---

## Waar te beginnen

Als er één oplevering in zit: **A + B + D.1 + E.1 + E.2**. Dat is samen een
kleine dag, raakt geen enkel systeem, en het is precies de verzameling die een
screenshot omgooit — de pictogrammen weg, de vlotrand weg, korrel op de grond,
echte schaduwen, een palet met bereik.

Daarna **C** (het raster) en **D.2/D.3** (materiaal) als het eigenlijke werk, en
**E.3** als sluitstuk, omdat een kleurgradatie pas zin heeft als er iets onder
ligt om te binden.

**F** en **G** kunnen er op elk moment tussendoor. **H** is een besluit, geen
taak: het gaat over of dit spel getekende kunst gaat krijgen of niet.

---

## Prestatiebudget

`VISUEEL.md` stelde vast dat de visuele laag ongeveer een kwart van het
frame-budget kost in headless Chromium met software-rendering. Fase C en D zijn
de enige twee die daaraan komen. Regels:

- Meet met dezelfde methode: headless Chromium, software-rendering, de grootste
  kaart (88×64) op minimale zoom, want dat is het slechtste geval.
- Elk nieuw effect krijgt een zoomdrempel. Wat je op `p < 20` niet kunt zien,
  teken je op `p < 20` niet.
- Nieuwe patronen en velden horen in `schaduwCache`, gekeyd op `kaart.seed`,
  net als de hillshade, `diepte` en `randen`. Nooit per frame opbouwen.
- Geen `clip()` per tegel. Een patroon vult een pad direct.

---

## Hoe dit gemeten is

De diagnose hierboven komt niet uit het lezen van de code maar uit vijf
schermafdrukken, gemaakt met Playwright tegen `file://index.html` volgens de
methode in `CLAUDE.md`: `window.spel.nieuwSpel()`, tijdperk 3, voorraad
opgehoogd, twintig gebouwen geplaatst rond het dorpsplein, straten erbij, zestig
seconden gesimuleerd met `spel.stap(s, 0.1)`, en daarna vier camerastanden:

| Bestand | Zoom | Wat het laat zien |
|---|---|---|
| `01-dag` | 1,3 | het dorp op speelafstand |
| `02-inzoom` | 2,6 (max) | materiaal, of het gebrek eraan |
| `03-uitzoom` | 0,45 (min) | de vlotrand en de zonneblob |
| `04-avond` | 2,0, `tijd = 205` | het nachtlicht (dat werkt goed) |
| `05-winter` | 1,6, `seizoen = 3` | het raster, onontkoombaar |

Herhaal deze vijf na elke fase, met dezelfde zaad en dezelfde standen. Dat is de
enige manier om te zien of iets echt beter werd of alleen anders.
