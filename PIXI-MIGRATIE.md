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

De oude canvas-renderer en zijn eigen tekenmodules (`renderer`, `paths`,
`raiders`, `props`, `wildlife`, `villagers`, `floaters`, `weer`, `particles`)
zijn **verwijderd**. Wat in `js/render/` overblijft zijn gedeelde utilities die
de Pixi-renderer en de UI nog gebruiken:

- `camera.js` — de iso-projectie (`Game.render.Camera`), ongewijzigd hergebruikt
- `beweging.js` — `Game.render.rng`, de render-only mulberry32
- `atlas.js` — icoonpaden voor het bouwmenu
- `sfeer.js` — `sfeer.licht(s)`, de dagfase voor de belichting
- `sprites.js` — `miniatuurBron` (bouwmenu/paneel) + `terreinKleur` (minimap)
- `lagen.js` — de per-tegel overlay-waarden (`waardeOp`)
- `minimap.js` — tekent op een eigen canvas, los van het hoofdcanvas

## Status per fase — afgerond

| Fase | Onderwerp | Status |
|------|-----------|--------|
| 1 | Vite + PixiJS toolchain | ✅ |
| 2 | Terrein (seizoenskleur, hillshade, kust, rivier, straten) | ✅ |
| 3 | Gebouwen als iso-volumes (muren + dak + badge, diepte-sortering) | ✅ |
| 4 | Bouw-spook, plaatsingsraster, selectie-omlijning | ✅ |
| 5 | Dag-nacht, lucht met zon/maan, vignet, levend water | ✅ |
| 6 | Wandelaars, schapen, props, rovers | ✅ |
| 7 | Overlays (lagen), stofdeeltjes, opbrengst-floaters | ✅ |
| 8 | Oude `js/render` verwijderd, Pages-deploy | ✅ |

## GitHub Pages

Pages serveerde `main` vroeger als kale statische bestanden. Met de buildstap
publiceert `.github/workflows/pages.yml` nu de Vite-output (`dist/`): het bouwt
bij elke push naar `main` en zet het resultaat op Pages. De relatieve `base`
(`./` in `vite.config.js`) zorgt dat het onder de projectsubdirectory
(`/Spelletje/`) werkt. Lokaal: `npm run dev` of `npm run preview`.
