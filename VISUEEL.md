# Bouwplan: visuele opwaardering

Het spel speelt goed en de systemen zitten er allemaal in. Wat het beeld nog
tegenhoudt is niet de hoeveelheid detail — dat is er ruim — maar **licht,
scheiding en overgang**. Drie dingen die je op een screenshot meteen ziet:

1. **Alles staat in hetzelfde licht.** Er is een hillshade op het terrein en een
   nachtwaas over het scherm, maar geen zon: geen slagschaduwen, geen warme
   ochtend, geen blauwe avond, geen diepte naar de horizon toe. Het beeld is
   plat en middagachtig, de klok merk je alleen doordat het donkerder wordt.
2. **Gebouwen lopen in elkaar over.** Twee huisjes naast elkaar zijn één bruin
   dakvlak. Er is geen contour, geen dakoverstek en geen schaduw die het ene
   pand van het andere lostrekt.
3. **Terreinsoorten botsen.** Gras, zand, rots en water grenzen met een
   kaarsrechte diamantrand aan elkaar. Dat leest als een kaart met vlakken, niet
   als een landschap.

Daarnaast staat de interface er netjes bij maar overal identiek: elk paneel is
hetzelfde gouden kadertje op hetzelfde bruin. Er is geen hiërarchie en geen
materiaal.

Hieronder het plan, in vijf fasen, van veel effect naar afwerking.

---

## Fase V1 — Licht en lucht

Nieuw bestand `js/render/sfeer.js`: één module die het licht van de wereld
bezit. Alles erin is afgeleid van `s.tijd` en `s.seizoen` en komt **nooit** in
`Game.state`.

- **Zonnestand → lichtkleur.** Eén functie `sfeer.licht(s)` geeft de fase van de
  dag terug plus hoe warm en hoe helder het is. Iedereen die kleur nodig heeft
  vraagt het daar, zodat de lucht, de gradatie en de raamverlichting het nooit
  oneens kunnen zijn.
- **Kleurgradatie** in plaats van de huidige blauwe waas: ochtend rozig, middag
  neutraal, avond oranje, nacht diepblauw. Een dag krijgt daarmee een boog.
- **Hoogtenevel.** In een isometrisch beeld is de bovenkant van het scherm de
  verte. Een zachte nevel die naar boven toe aanzet geeft dat diepte, en kost
  één gradient per frame.
- **Vignet.** Randen van het scherm iets donkerder, zodat de blik naar het
  midden trekt en het beeld niet uitwaaiert in de balken.

## Fase V2 — Grond die in elkaar overloopt

In `js/render/sprites.js`, rond `tekenGrond`.

- **Overgangsranden.** Grenst een tegel aan een tegel van een ander terrein, dan
  loopt de kleur van de buurman in twee banden de tegel in. De harde
  diamantrand verdwijnt en gras loopt in bos, rots in gras.
- **Strand.** Grenst land aan water, dan is die overgangskleur zand. Kust wordt
  daarmee vanzelf een strandje in plaats van een snijlijn.
- **Waterdiepte.** Eén keer per kaart een afstand-tot-land over het water (BFS,
  in dezelfde cache als de hillshade, dus niet in de save). Ondiep water bij de
  kust turkoois, open water donker.

## Fase V3 — Gebouwen met karakter

Ook in `sprites.js`.

- **Slagschaduw.** Elk gebouw werpt een schaduw naar rechtsonder — dezelfde
  lichtrichting als de hillshade — met een lengte die met de hoogte meegroeit.
  Dit is de grootste enkele winst: het zet panden op de grond in plaats van
  erop geplakt.
- **Contour.** Een donkere lijn over de daknokken en de muurhoeken, zodat twee
  buren van elkaar loskomen.
- **Dakoverstek.** Het dak steekt een stukje over de muren heen. Klein detail,
  meteen herkenbaar als een huis en niet als een doos met een puntje.
- **Het embleem wordt een bordje.** De losse emoji die nu boven elk dak zweeft
  krijgt een houten plaatje met schaduw eronder, wordt kleiner, en vervaagt
  naarmate je inzoomt — dan vertelt het silhouet het al.
- **Bomen en rotsen** krijgen dezelfde schaduwrichting als de gebouwen.

## Fase V4 — De interface als perkament

In `css/style.css`.

- Palet uitbreiden met diepte (donker hout onder, warm hout boven), en de
  panelen een materiaal geven: perkament met een vleug textuur, in plaats van
  vlak bruin.
- Typografische ladder: koppen, waarden en bijschriften krijgen echt verschil in
  grootte en kleur, nu is bijna alles 12–13px perkament.
- Alle knoppen dezelfde afspraak: rust, hover, actief, uitgeschakeld, en een
  `:focus-visible` ring zodat het spel met toetsenbord bespeelbaar blijft.
- De grondstoffenbalk mag niet meer rafelen over drie rijen.
- Bouwkaarten, overlay en minimap afwerken.

## Fase V5 — Kleine dingen die veel doen

- Gebouw onder de muis licht op, zodat klikken voelt als aanwijzen.
- Selectie krijgt een gloed op de grond in plaats van alleen een stippellijn.
- Minimap krijgt een lijst en een windroos.

---

## Wat het niet is

Geen nieuwe assets, geen build-stap, geen bibliotheek. Alles blijft procedureel
canvas en handgeschreven CSS, en het spel blijft draaien vanaf `file://` zonder
de map `assets/`. Alles wat hierboven staat is afgeleide weergave: er komt geen
veld bij in `Game.state`, dus saves blijven zuivere JSON.

---

## Wat er gebouwd is

Alle vijf de fasen zijn uitgevoerd.

| Fase | Waar |
| --- | --- |
| V1 licht en lucht | `js/render/sfeer.js` (nieuw), aangehaakt onderaan `renderer.teken` |
| V2 grond | `sprites.js`: `bouwDiepte`, `bouwRanden`, `overgangen`, `waterKleur` |
| V3 gebouwen | `sprites.js`: `slagschaduw`, `contour`, dakoverstek in `dakSchuin`, `bordje`, `verscheidenheid`; bergen herzien; straten in `paths.js` |
| V4 interface | `css/style.css` |
| V5 aanwijzen | `renderer.js`: `onderMuis`, gloed op de grond, kruipende selectielijn |

Onderweg meegenomen: `js/ui/hud.js` vroeg de opslaggrens op met een veld dat niet
bestond (`e.id`), waardoor de vol/leeg-markering op de grondstoffenbalk terugviel
op de algemene capaciteit en dus loog over voedsel, munten en edelstenen.

**Wat het kost.** Gemeten in headless Chromium — softwarematig, dus een pessimistische
ondergrens — draait het spel na deze wijzigingen op ongeveer driekwart van de
framerate van daarvoor (20 → 15 fps bij zoom 1,0 op die machine). Dat zit verspreid
over de overgangsranden, de schaduwen en de sfeerlagen, elk ongeveer even veel; er is
geen enkele dure boosdoener meer over. Twee optimalisaties waren nodig om het daar te
krijgen en zijn nu structureel: `verf()` in `sprites.js` is gememoïseerd, en de
vlakke schermvullingen in `tekenGradatie` zijn tot één `fillRect` samengevoegd.
Wie hier nog iets bijbouwt: tel je fills, want ze lopen per tegel.
