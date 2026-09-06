# Bouwplan — Age of Empires 2-look

Doel: de visuele stijl van *Dorp tot Stad* optrekken naar de **look-and-feel van
Age of Empires II: Definitive Edition** (de vier referentie-afbeeldingen): warme,
geschilderde terreintexturen, rijk gedetailleerde gebouwen met **spelerskleur**
(het blauw dat een stad meteen "van jou" maakt), doorschijnend water met riet en
waterlelies, dichte bossen en rotspartijen, zachte slagschaduwen en een warme,
samenhangende belichting.

**Is dit mogelijk?** Ja — grotendeels. Belangrijke nuance vooraf: AoE2 is
opgebouwd uit met de hand geschilderde raster-sprites. Wij hebben die kunst niet
en willen (net als de rest van dit project) geen externe afhankelijkheden of
online assets. De strategie is daarom **procedureel gegenereerde textuur**: bij
het opstarten bakken we ruis- en materiaaltexturen in offscreen-canvassen en
zetten die om naar `PIXI.Texture`. Dat haalt naar schatting **70–85% van het
*gevoel*** van AoE2 (warmte, textuur, materiaal, cohesie) binnen zonder één
byte aan externe kunst. De laatste ~15% — echt handgeschilderde gebouw- en
unit-sprites — komt via een **optionele asset-lane** die al in de code zit
klaargelegd (`atlas.isoGebouwMap` + `assets/iso/`, met de "nooit stuk zonder
assets"-terugval). Zo kan een kunstenaar of AI-gegenereerde sprite er later
naadloos in vallen zonder de procedurele basis te breken.

Dit document is een **plan**, geen implementatie. Het beschrijft fasen, geraakte
bestanden, effort, risico en validatie. De fasen zijn los leverbaar en in
oplopende volgorde van "meeste winst per uur".

---

## Wat AoE2 visueel *is*, ontleed

Voordat we bouwen, de referentie in losse, aanpakbare bestanddelen (met wat ons
nu ontbreekt):

| Element | AoE2 | Nu in `pixi-renderer.js` | Gat |
|---|---|---|---|
| **Terrein** | Geschilderde textuur per soort (gras/aarde/woestijn/zand), zachte geditherde overgangen | Platte diamant-vlakken met hillshade-multiply | **Groot** — dé stijlbepaler |
| **Water** | Doorschijnend, gelaagd, caustics, riet/lelies/schuim aan de oever | Dieptegradient + displacement-shimmer + rimpels | Middel |
| **Gebouwen** | Rijke sprites, steen/pleister/vakwerk, **blauwe spelerskleur** (vlaggen, banieren, daknok) | Procedurele iso-volumes, daktextuur, contour, AO | Middel — vooral *spelerskleur* en materiaal |
| **Bomen/rotsen** | Dichte, getextureerde billboards; **kliffen** bij hoogteverschil | Meerlaagse blob-bomen, poly-rotsen, bergen | Middel — kliffen ontbreken |
| **Belichting** | Warm, geschilderd, zachte schaduw, samenhangende kleurtoon | Dag/nacht-was, gloed, bloom, vignet | Klein — tuning + color-grade |
| **Units** | Spelerskleur, garnizoen, idle-animatie | Simpele poppetjes, karren, schapen, rovers | Middel — spelerskleur + variatie |
| **HUD-chroom** | Steen/hout-omlijsting, goud, perkament | `--eik`/`--paneel`/`--goud` in `style.css` | Klein — al goede basis |

De drie grootste hefbomen, in volgorde: **(1) getextureerd terrein**,
**(2) spelerskleur op gebouwen**, **(3) waterrand met riet**. Wie alleen die
drie doet, heeft al 80% van de "hé, dit lijkt op AoE2"-herkenning.

---

## Dwarsliggende randvoorwaarden (gelden in *elke* fase)

Deze zijn niet onderhandelbaar — ze staan in `CLAUDE.md` en de architectuur
hangt eraan:

1. **Determinisme.** Alle decoratieve willekeur loopt via `Game.render.rng`
   (mulberry32), **nooit** `Math.random`. De simulatie moet byte-voor-byte
   dezelfde state houden of de renderlaag nu wel of niet tikt. Nieuwe
   textuurruis seedt op `kaart.seed`, niet op de sim-RNG.
2. **Pure-JSON state.** Texturen, sprites en render-caches leven uitsluitend in
   de renderlaag (module-scope), nooit in `Game.state`. Een save blijft
   `JSON.stringify(state)`.
3. **Offline, geen nieuwe externe afhankelijkheden.** `pixi.js` en
   `pixi-filters` zijn er al; alles nieuws wordt **procedureel** gegenereerd of
   valt onder de bestaande CC0-assets. Geen CDN, geen fonts van buiten.
4. **Nooit stuk zonder assets.** Elke optionele sprite-lane valt terug op de
   procedurele tekening als het bestand ontbreekt of nog laadt (het contract dat
   `atlas.js` en de bomen/rotsen al hanteren).
5. **Fill-count bewaken.** Het terrein is duizenden tegels bij lage zoom. Nieuwe
   textuur mag **niet** per frame per tegel opnieuw getekend worden — het gebakken
   terrein moet naar een `RenderTexture` (of een handvol chunk-texturen) zodat de
   per-frame-kost vlak blijft. Zie de `verf()`-memoïsatie en de enkele-`fillRect`-
   truc in de oude `sprites.js` als precedent: dit project meet z'n fill-count.
6. **Meten.** Headless Chromium (software rendering = pessimistische vloer) voor
   de frame-kost vóór en ná elke fase; `npm run dev` én `npm run preview` (de
   Pages-subdir) na elke wijziging aan paden/assets.

---

## Fase 0 — Palet & referentie vastleggen

**Doel.** Eén bron van waarheid voor de AoE2-kleuren, vóór er textuur op komt.
Nu staan terrein-, dak- en muurkleuren verspreid als hex-constanten in
`pixi-renderer.js` (`TERREIN`, `ISO`, `ZEE`, `BLADKLEUR`, `WEGKLEUR`…).

**Werk.**
- Nieuw `js/render/palet.js` (IIFE op `Game.render.palet`): AoE2-geijkte
  paletten voor terrein per seizoen, dak-/muurmaterialen, water-diepte-ramp,
  en — nieuw — de **spelerskleur** (`Sp.SPELER = 0x2b52c0`-achtig blauw, plus
  een lichte en donkere variant voor stof/schaduw).
- `pixi-renderer.js` leest z'n kleuren uit `palet` i.p.v. lokale letterlijke
  waarden. Puur een refactor: geen zichtbare verandering, maar het maakt de rest
  van het plan één plek om te tunen.

**Effort.** Laag (½ dag). **Risico.** Laag. **Validatie.** Beeld identiek;
`devcheck` groen.

---

## Fase 1 — Getextureerd terrein (de grootste winst)

**Doel.** Van platte diamant-vlakken naar geschilderde grond: korrelig gras,
droge aarde, zand/woestijn, met AoE2's zachte geditherde overgangen. Dit is de
enkele grootste stap naar de referentie.

**Aanpak — gebakken textuur-atlas, geen live per-tegel-ruis.**
1. Bij boot (of bij nieuwe `kaart.seed`) genereren we per terreinsoort ×
   seizoen een **tegel-textuur** in een offscreen-canvas: gelaagde
   waarde-/Perlin-achtige ruis in de paletkleuren van fase 0, korrel, subtiele
   vlekken. Eén keer, gecachet op seed.
2. Deze texturen worden omgezet naar `PIXI.Texture`. Het terrein wordt getekend
   als **getextureerde diamanten** (een `PIXI.Mesh`/`Graphics` met
   texture-fill, of vooraf-gebakken diamant-sprites per (soort, variant)).
3. De bestaande **hillshade-relief** (`dh`/`relief` in `bouwTerrein`) blijft als
   multiply-tint over de textuur — dat geeft AoE2's rollende terrein.
4. **Zachte overgangen** (het huidige `overgangen`-idee: buurkleur die inbloedt)
   wordt een **dither-/stippelmasker** langs de randen i.p.v. een egale
   halftransparante driehoek — precies de korrelige terreinnaad van AoE2.
5. **Kust** blijft (zandstrand + schuim), maar het strand krijgt dezelfde
   zandtextuur i.p.v. een vlakke `#d8c48a`.
6. **Grondstoftegels** (vruchtbaar, visgrond) krijgen een eigen subtiele textuur
   (ploegvoren, rietpolletjes) zodat de speler ze — net als in de
   grondstoffen-overlay — kan *zien* liggen.

**Performance.** Bak het volledige zichtbare terrein naar één (of chunk-)
`RenderTexture` die alleen herbouwt bij seed-/seizoenwissel, niet per frame.
`bouwTerrein` draait nu al alleen bij `wereldDirty` — dat contract houden we,
maar de output wordt een texture i.p.v. duizenden poly-fills.

**Geraakt.** `pixi-renderer.js` (`bouwTerrein`, `berekenDiepte`, `TERREIN`),
nieuw `js/render/terreintextuur.js`.

**Effort.** Hoog (2–3 dagen — dit is het hart). **Risico.** Middel (performance,
naadloosheid van getegelde ruis). **Validatie.** Frame-kost headless vóór/ná
mag niet stijgen; visueel tegen de referentie; check zoom-uit (duizenden tegels)
én ingezoomd.

---

## Fase 2 — Water met oever-leven

**Doel.** AoE2-water: gelaagd doorschijnend, bewegende caustics, en vooral de
**oeverbegroeiing** (riet/lisdodde, waterlelies, schuim) die water levend maakt.

**Werk (bovenop het bestaande `waterLaag` + `DisplacementFilter` +
`tekenWaterLeven`).**
- Diepteramp verrijken: helder turquoise ondiep → diep blauwgroen, met een
  extra lichtband net onder de oever.
- **Riet/lisdodde** als kleine billboards op land-tegels grenzend aan water
  (deterministisch uit `t.v`), in de gesorteerde staande laag — net als bomen.
- **Waterlelies** als platte vlekjes op ondiepe watertegels (`diepte === 1..2`).
- **Schuim** langs de oever bestaat al; iets dynamischer maken met de
  render-klok.
- Caustics: een tweede, langzamere displacement- of additieve schitterlaag.

**Geraakt.** `pixi-renderer.js` (`bouwTerrein` kust, `tekenWaterLeven`,
`bouwKenmerken` voor riet-billboards).

**Effort.** Middel (1–1½ dag). **Risico.** Laag. **Validatie.** Kustlijn tegen
referentie 3 & 4; riet flikkert niet (stabiele `t.v`-seed).

---

## Fase 3 — Gebouwen: materiaal + spelerskleur

**Doel.** De procedurele iso-volumes (die zijn goed, deterministisch en
onderhoudsarm — we gooien ze *niet* weg) optrekken naar AoE2-rijkdom, met als
sleutel de **spelerskleur**.

**Werk.**
1. **Spelerskleur (grootste herkenning).** Voeg blauw toe aan:
   - vlaggen (`vlagTop`) en banieren op grotere gebouwen (`stadhuis`,
     `kasteel`, `kerk`, `handelshuis`…),
   - een dun blauw daknok-/lijstaccent op woon- en overheidsgebouwen,
     luifels (`luifel`) en deurlijsten (`gevel`).
   Dit is het detail dat in álle vier de screenshots meteen "jouw stad" zegt.
2. **Muurmateriaal.** Getextureerde muurvlakken: steenverband voor
   verdediging/kerken, pleister voor woonhuizen, het bestaande **vakwerk**
   (`vakwerk()`) uitbreiden. Textuur via generatie (fase 0/1-aanpak) of fijne
   proceduele lijnen.
3. **Dakmateriaal.** `dakTextuur()` bestaat al (riet/pan/lei) — verrijken met
   echte pannenrijen en warmere toon; nok- en hoekkeper-lijnen.
4. **Silhouet & diepte.** Contour (`stroke`) en AO zijn er; iets sterker maken
   voor de "uitgesneden" AoE2-look; overstek behouden.
5. **Optionele echte iso-sprite-lane.** `atlas.isoGebouwMap` is nu leeg en
   expres klaargelegd: zet je `assets/iso/<naam>.png` neer + een entry, dan
   pakt de renderer die op met terugval op het volume. Hier landen later
   handgeschilderde of AI-gegenereerde gebouw-sprites. In `pixi-renderer.js`
   moet `maakVolume`/`bouwGebouwen` dan eerst `Game.render.atlas.isoGebouw(id)`
   proberen (nu doet de Pixi-renderer dat nog niet — de oude canvas-renderer
   wel). **Klein haakje toevoegen, geen sprites vereist.**

**Geraakt.** `pixi-renderer.js` (`maakVolume`, `gevel`, `vlagTop`, `luifel`,
`dakTextuur`, `bouwGebouwen`), evt. `atlas.js`-haak.

**Effort.** Middel-hoog (2 dagen). **Risico.** Laag-middel. **Validatie.**
Straat huisjes leest gevarieerd (bestaande `zaadFactor`); blauw consistent;
`miniatuurBron`/build-menu-miniaturen blijven kloppen.

---

## Fase 4 — Bomen, rotsen, kliffen, erf

**Doel.** Dichtere, getextureerde natuur en AoE2's kenmerkende **kliffen**.

**Werk.**
- **Bomen** (`maakBoom`/`boomVorm`): meer blob-lagen met textuur/korrel,
  seizoensvariatie warmer, dichtere bosbezetting; behoud van de
  `t.amt`-gekoppelde grootte.
- **Rotsen** (`maakRots`): getextureerde facetten i.p.v. platte polys.
- **Kliffen (nieuw).** Waar de hoogtekaart (`t.h`) een steile sprong maakt tussen
  buurtegels: teken een getextureerd kliffront (AoE2-signatuur). Leest de
  `bereidTerreinVoor`-hoogte die er al is; puur render, geen sim-impact.
- **Erf-clutter** uitbreiden (`maakProps`/de oude `props.js`-tabel `BIJ`): meer
  variatie (hooibalen, marktkramen, gereedschap, wasgoed) per gebouwsoort.

**Geraakt.** `pixi-renderer.js` (`maakBoom`, `maakRots`, `maakBerg`,
`bouwKenmerken`, `maakProps`), evt. nieuw klif-hulpje.

**Effort.** Middel (1½ dag). **Risico.** Laag (kliffen = wat geometrie).
**Validatie.** Bos-dichtheid vs referentie 3; kliffen alleen bij echt
hoogteverschil; fill-count bij zoom-uit.

---

## Fase 5 — Belichting & kleurgradatie

**Doel.** De warme, samenhangende, "geschilderde" toon die alles in AoE2 bindt.

**Werk (vooral tuning van bestaande `sfeer`/`gloed`/`licht`).**
- Warmere overdag-ambient (lichte amber i.p.v. neutraal wit).
- Zachtere dag/nacht-curve; nacht minder blauw-koud, meer warm-raamgloed
  (bloom is er al via `AdvancedBloomFilter`).
- Subtiele globale **color-grade** (een lichte LUT-achtige tint over de hele
  scène) om de painterly warmte te duwen — één full-screen `ColorMatrixFilter`
  op de wereld-container, goedkoop.
- Stofdeeltjes/pollen in warm licht (bestaand deeltjessysteem hergebruiken).
- Schaduwrichting blijft `sfeer.SCHADUW` (één zon; niet laten wandelen — vecht
  anders met de hillshade).

**Geraakt.** `js/render/sfeer.js`, `pixi-renderer.js` (`tekenLicht`,
`tekenGloed`, `tekenHemel`).

**Effort.** Laag-middel (1 dag). **Risico.** Laag. **Validatie.** Zij-aan-zij
screenshots; niet te donker/verzadigd; `prefers-reduced-motion` blijft eren.

---

## Fase 6 — Units & levend beeld (optioneel)

**Doel.** Poppetjes met spelerskleur en meer leven.

**Werk.**
- **Spelerskleur** (blauw) op wandelaars/soldaten (`maakPersoon`, `maakRover`):
  een blauw tuniek-/schild-accent, zoals de blauwe legertjes in referentie 4.
- Meer variatie per beroep; garnizoen-/patrouillegedrag visueel.
- **Optionele echte unit-sprites** via de bestaande `atlas.werker`-map (nu door
  de canvas-renderer gebruikt, niet door Pixi) — zelfde nooit-stuk-terugval.

**Geraakt.** `pixi-renderer.js` (`maakPersoon`, `maakRover`, `WANDELKLEUR`),
evt. `atlas.js`-haak.

**Effort.** Middel (1 dag). **Risico.** Laag. **Validatie.** Blauw leest als
spelerskleur; determinisme (alle keuzes via `Game.render.rng`).

---

## Fase 7 — HUD-chroom (optioneel, laagste prioriteit)

**Doel.** De steen-/hout-omlijsting van de AoE2-interface.

**Werk.** `css/style.css` heeft al `--eik`, `--paneel`, `--goud`. Panelen naar
gebeitelde-steen randen, goudlijst, perkament-leesvlakken; knoppen houden hun
`:focus-visible`-ring (toegankelijkheid) en de reduced-motion-schakelaar.

**Effort.** Laag-middel (1 dag). **Risico.** Laag. **Validatie.** Speelbaar met
toetsenbord; leesbaarheid.

---

## Aanbevolen volgorde & "quick wins"

Als er beperkt tijd is, in deze volgorde voor maximale herkenning per uur:

1. **Fase 3, alleen de spelerskleur** (½ dag) — grootste "AoE2!"-effect per uur.
2. **Fase 1, getextureerd terrein** (de kern; grootste absolute winst).
3. **Fase 2, waterrand met riet.**
4. **Fase 5, kleurgradatie & warm licht** (bindt fase 1–2 samen).
5. Rest naar smaak (4 → 3-volledig → 6 → 7).

Fase 0 gaat altijd eerst (het is de tuning-plek voor al het bovenstaande).

---

## Wat dit *niet* wordt (eerlijke plafond-notie)

- Geen 1-op-1 kopie van AoE2's handgeschilderde sprites — dat vereist licentie-
  of gegenereerde kunst (dat is de optionele `assets/iso/`-lane, geen kernpad).
- Geen unit-animatiecycli op sprite-niveau; wij blijven bij procedurele
  beweging (`beweging.js`) met spelerskleur.
- Geen nieuwe externe afhankelijkheden of online assets; alle textuur wordt
  procedureel gebakken binnen het offline-contract.

Het resultaat is een **eigen** stijl die duidelijk de AoE2-taal spreekt —
warm, getextureerd, met spelerskleur en levendig water — zonder de determinisme-,
pure-JSON-, offline- en performance-invarianten van dit project te breken.

---

## Validatiechecklist per fase (samengevat)

- [ ] `npm run dev` én `npm run preview` (Pages-subdir `/Spelletje/`) tonen het
      resultaat; paden relatief (`./`).
- [ ] Headless frame-kost vóór/ná ≈ gelijk of beter (gebakken texturen, geen
      per-frame per-tegel-werk).
- [ ] `devcheck` groen; geen wijziging aan `js/config`, `js/core`, `js/ui`
      nodig (dit is puur renderlaag).
- [ ] Determinisme: sim-state byte-identiek met/zonder rendertik; alle
      decoratieve willekeur via `Game.render.rng`.
- [ ] Geen niet-JSON in `Game.state`; texturen/caches blijven in de renderlaag.
- [ ] Terugval intact: ontbrekende optionele sprites → procedurele tekening.
