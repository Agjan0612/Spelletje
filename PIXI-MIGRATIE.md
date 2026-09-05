# PixiJS-migratie

De renderlaag stapt over van hand-geschreven canvas 2D naar **PixiJS** (WebGL),
met een echte build (Vite) en npm-dependencies. Dit breekt bewust de oude
"dubbelklik `index.html` vanuit `file://`"-belofte — dat was de afweging voor
een hoger visueel plafond (GPU-snelheid, veel meer particles, filters/shaders,
vloeiende zoom).

## Draaien

```bash
npm install      # eenmalig (pixi.js + vite)
npm run dev      # ontwikkelserver met hot reload
npm run build    # productiebundel naar dist/
npm run preview  # dist/ lokaal serveren (poort 4173)
```

`index.html` laadt nu één module-entry (`src/main.js`); openen vanaf schijf
zonder buildserver werkt niet meer.

## Architectuur

De simulatie is **niet** aangeraakt. `js/config`, `js/core` en `js/ui` blijven
klassieke IIFE-modules die aan `window.Game` hangen; `src/legacy.js` importeert
ze in exact dezelfde afhankelijkheidsvolgorde als de oude scripttags (dat
bestand is gegenereerd uit `index.html` — niet met de hand herordenen).

`src/render/pixi-renderer.js` neemt `Game.render.renderer` volledig over. De
koppeling met `main.js` is dezelfde smalle interface als voorheen
(`init / pasMaatAan / verversWereld / verversGebouwen / teken / tegelInfo`, plus
de walker/effect-hooks). De iso-projectie uit `js/render/camera.js` wordt
ongewijzigd hergebruikt: elk element staat op zijn iso-coördinaat in één
wereld-container, en pan/zoom zijn container-transformaties (scale + position) —
dat is de kern van de winst tegenover het per-frame herprojecteren van de oude
renderer.

Tijdens de migratie blijven de oude `js/render/*`-modules meelopen: het
bouwmenu leunt op `sprites.miniatuurBron` voor de icoontjes, en minimap +
lagen-data draaien los van het hoofdcanvas. Ze worden in de laatste fase
verwijderd.

## Status per fase

| Fase | Onderwerp | Status |
|------|-----------|--------|
| 1 | Vite + PixiJS toolchain | ✅ |
| 2 | Terrein (seizoenskleur, hillshade, kust, rivier, straten) | ✅ |
| 3 | Gebouwen als iso-volumes (muren + dak + badge, diepte-sortering) | ✅ (basis) |
| 4 | Bouw-spook, plaatsingsraster, selectie-highlight | ⏳ (picking werkt al via de gedeelde camera) |
| 5 | Dag-nacht + water-/weerfilters (Pixi filters) | ⏳ |
| 6 | Wandelaars, props, wildlife, raiders | ⏳ |
| 7 | Overlays (lagen), floaters, particles in Pixi | ⏳ |
| 8 | Oude `js/render` verwijderen, Pages-deploy afronden | ⏳ |

De nog niet geporte teken-hooks (`verversWandelaars`, `tickWandelaars`,
`tickEffecten`, `tijdperkSweep`, …) zijn voorlopig veilige no-ops, zodat de rest
van de code onveranderd blijft werken.

## GitHub Pages

Pages serveerde `main` als statische bestanden. Met een buildstap moet de output
(`dist/`) gepubliceerd worden — via een GitHub Action of de Pages-build. Dat is
onderdeel van fase 8; tot die tijd draait het spel via `npm run dev`/`preview`.
