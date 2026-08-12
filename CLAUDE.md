# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"Dorp tot Stad" — a medieval city-builder game that runs entirely in the browser with **no build step, no dependencies, no server**. Vanilla HTML/CSS/JS on a 2D canvas. See `README.md` for gameplay.

## Running & testing

There is no npm, no build, no test runner in the repo.

- **Play locally:** open `index.html` directly (`file://`). This is the primary target — it must keep working.
- **Pages-like check:** the game is also served over HTTP from a **subdirectory** (GitHub Pages at `/Spelletje/`). All asset paths are relative so this works unchanged, but when touching paths, verify both routes.
- **Automated / headless testing:** `main.js` exposes the live game object as `window.spel` (and `window.spel.state`). Drive the simulation from the browser console or via Playwright (Chromium is preinstalled at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`). The pattern used for playtesting: call `window.spel.nieuwSpel()`, then repeatedly call the tick functions with a fixed `dt` (see the tick order below) while scripting `Game.core.construction.plaats(...)` and `Game.core.population.zetWerkers(...)`, and read back `s.res`, `s.bevolking`, `s.verzameld`. Balance changes must be validated this way — that a fresh village can reach age 4 without starving.
- **Config self-check:** `js/devcheck.js` runs at startup and logs `✅ Speldata gecontroleerd` or a loud list of errors to the console. Check the console after any change to `js/config/`.

## Architecture

### No ES modules — deliberate

Because the game must run from `file://` (where `import` is blocked), every file is a classic IIFE that hangs its parts on a single global `window.Game` namespace (`{ config, core, render, ui, state, util }`). `index.html` loads all scripts with plain `<script>` tags **in dependency order**. Adding a new file means adding a `<script>` tag in the correct position in `index.html`.

### Single serializable state

The entire game is one plain-object tree, `Game.state` (also `window.spel.state`). A save is literally `JSON.stringify(state)` — see `js/core/save.js`. Consequence: **never put non-JSON values in state.** The map uses `Game.core.map.ONEINDIG` (`1e9`) instead of `Infinity` for endless resource nodes precisely because `Infinity` does not survive JSON.

Derived values (housing, storage cap, defence, worker totals, global bonuses) are **not** stored authoritatively — they are recomputed by `Game.core.state.herbereken(s)`, which must be called after any change to buildings or worker assignments.

The visual/atmosphere layer (see below) keeps almost everything it needs out of `state`; the handful of fields it does add are all plain JSON-safe numbers/objects: `t.h` (per-tile terrain height for the relief/hillshade, migrated from the seed for old saves), `s.raid.vanaf`/`uitslag`/`doel` (raid approach point, outcome and hit location), and `g.geschroeid` (a scorch timer). The audio on/off preference lives in `localStorage`, not in `state`.

### Layer separation

- `js/config/` — **pure data**, the balance knobs. `buildings.js` is the heart (costs, production `wint`/`maakt`, worker slots, placement rules). Also `resources.js`, `jobs.js`, `ages.js` (age-up requirements + victory), `quests.js` (objective list).
- `js/core/` — the simulation. Each module owns one concern and exposes a `tick(s, dt)` where relevant: `economy` (production/crafting/upkeep/storage), `population` (food/happiness/growth/jobs), `seasons`, `raids`, `construction`, `ages`, plus `map` (generation), `state`, `rng` (seeded), `save`. The age-2+ **activity** modules live here too and follow the same event-with-a-timer shape as `raids.js`: `feesten` (festivals — spend food/coins for a happiness boost via the existing `moreel` field), `handel` (the travelling merchant with its trade offers), `opdrachten` (the lord's recurring delivery orders with a deadline on `s.dag`), `gebeurtenissen` (small random events — bard, harvest, frost…), and `dorpelingen` (a cosmetic named-inhabitant register kept in step with the headcount; it reads state but never changes the counts).
- `js/render/` — canvas drawing (`camera`, `sprites`, `renderer`, `atlas`). **The view is isometric (2:1 diamond tiles).** The whole projection lives in `camera.js` (`wereldNaarScherm` / `schermNaarWereld` project world *pixels* through an iso transform; `Game.render.diamant`/`padDiamant` are the shared tile-diamond helpers). `Game.state` stays a plain square grid — nothing about iso is stored, so saves stay pure JSON. Because almost everything positions itself through `cam.wereldNaarScherm` (roads, walkers, raiders, particles, wildlife, floaters, the placement grid), it tilts into the iso view for free; only the shape-drawing spots (terrain tiles, buildings, ghost/selection/resource highlights, minimap viewport) needed diamond-aware geometry. Buildings are drawn as **procedural iso volumes** (walls + roof + facade, per-building table `ISO` in `sprites.js`), so the top-down Kenney building sprites in `atlas.js` are bypassed in the iso view; trees and rocks still use the atlas as **upright billboards** (with a hand-drawn fallback), so the game keeps working from `file://` with or without the `assets/` folder. Chimney smoke and the evening window glow live in `sprites.sfeer`, driven by the real-time clock and the night value passed from `renderer.js`. Drawing runs in **two passes**: the flat ground (`sprites.tekenGrond` — diamonds, coast, fields) first, then a **single back-to-front pass** over everything that stands up — raised terrain features (`sprites.tekenKenmerk`: trees, rocks, mountains, deer), buildings and walkers — collected in `renderer.js` and sorted by iso depth (footprint-centre `x+y`, then `y`) so overlaps read correctly. Any new standing element belongs in that sorted layer, not drawn in its own later pass, or it will float on top of everything. Terrain stores a per-tile height only as a hillshade tint (`bereidTerreinVoor`); the ground itself is drawn flat, which is what keeps mouse-picking (`schermNaarWereld`) exact.
- `js/render/` — **visual/atmosphere layer** (fully decorative, derived from `state`, never stored in it): `particles.js` (smoke/sparks/fire/dust for raids, the age-up sweep and mines), `paths.js` (the street network — a minimum spanning tree over the buildings, cached on a `handtekening()` signature, drawn under them and followed by the walkers), `raiders.js` (the band that visualises the abstract raid: it marches in from `s.raid.vanaf` and plays the already-decided outcome), `floaters.js` (the "+🪵" numbers that rise when a villager delivers goods), `wildlife.js` (deer/fish/sheep that wander near the matching resource nodes), and `minimap.js` (overview canvas — a conventional top-down map, not iso). Everything here positions through `cam.wereldNaarScherm`, so it inherits the iso view without diamond-specific code. The walkers in `renderer.js` run a cosmetic loop — follow the road out → swing a tool with flying chips → carry the goods home → deliver a floater — reconciled (not rebuilt) each refresh so nobody teleports; they ride in the depth-sorted layer so they pass behind the houses in front of them. `renderer.js` draws in one deliberate stack (deep sea → flat ground → roads → depth-sorted features+buildings+walkers → sweep → wildlife → work-chips → raiders → particles → floaters → overlays) and runs the real-time effects (particles, raiders, screen-shake, age-up sweep, work sparks/dust, scorch decay, day/night) via `tickEffecten(s, dt)`, separate from the fixed simulation step. None of this touches `Game.state`, so saves stay pure JSON.
- `js/ui/` — DOM panels (`hud`, `buildmenu`, `panel`, `quests`, `acties`, `log`, `overlay`) plus `audio.js`. `acties.js` is the "Het dorp" card in the right column (throw a festival, visit the merchant, hand in the lord's order); it only reads/calls the core activity modules. `overlay.js` also hosts the merchant trade dialog and the `📖 Dorpsboek` register view. `panel.js` and `buildmenu.js` use a `handtekening()` signature-diff so they only rebuild when something visible changed. `audio.js` **synthesises** its sounds (raid horn, age-up bell, breakthrough thud, victory peal) with the Web Audio API — no audio files to fetch or embed, so it works from `file://`; the `AudioContext` is created lazily and resumed on the first user gesture (autoplay policy), and the mute preference is kept in `localStorage`.

### The game loop

`js/main.js` runs a fixed-timestep accumulator (10 logic ticks/sec) decoupled from render framerate; speed buttons multiply the number of ticks, not `dt`. One simulation step, `stap(s, dt)`, runs modules in this order — **preserve it**, later steps read state the earlier ones wrote:

```
seasons → construction → economy → population → dorpelingen → raids
        → handel → opdrachten → gebeurtenissen → feesten → quests(check) → ages(victory)
```

The activity modules (`handel`/`opdrachten`/`gebeurtenissen`/`feesten`) run after `raids` and mostly no-op before age 2. `dorpelingen.tick(s)` takes no `dt` — it just reconciles the register to the headcount. Rendering, the decorative walkers/wildlife/floaters/raiders/particles, the real-time effects (`renderer.tickEffecten`: particles, raiders, screen-shake, age-up sweep, work sparks/dust, scorch decay, day/night), HUD refresh, minimap refresh, and autosave all run on real time outside the fixed step.

### Adding content

A new building is one object appended to the `B` array in `js/config/buildings.js` (fields documented in the header comment there; production numbers are **per worker per second**). Reload and it appears in the build menu; `devcheck.js` will complain in the console if it references an unknown resource/job/node. No other file needs touching for a standard building — in the iso view it automatically gets the default procedural volume. To give it a distinct silhouette (wall height, roof style `schuin`/`punt`/`plat`/`geen`, and flourishes like `kantelen`, `wieken`, `kruis`, `vlag`), add an entry keyed by its id to the `ISO` table in `js/render/sprites.js`; that table is the only render-side hook a building has.

The activity systems are list-driven in the same spirit: a new random event is one entry in the `EVENTS` array in `gebeurtenissen.js` (`{ id, eis?, doe(s) }`), a new merchant trade one entry in `AANBOD` in `handel.js`, and a new order type one entry in `VRAAG` in `opdrachten.js`. Keep event/order effects modest and food-safe (see Conventions).

## Conventions

- **Language split:** domain code (identifiers, building/resource ids, log text) is in **Dutch**; code comments are in **English**. Match this when editing.
- **Balancing = the food economy.** The two failure modes that were deliberately engineered out: hunger must remove food-workers *last* (`population.js` `rang()`), and low happiness must not throttle food production into a death spiral (production multiplier floors at `0.75`). Keep these invariants when touching `population.js` / `economy.js`. The activity systems must not undo them: random events and lapsed orders carry no harsh food/morale penalty, and player-initiated actions (festival, trade, delivery) never fire unattended — so a fresh village still reaches age 4 without starving (validate headless).
- **The decorative layer is non-authoritative.** Walkers, particles, floaters, wildlife and the day/night glow are cosmetic and driven by a real-time clock; they must never live in `Game.state` or feed back into the simulation. New activity state that *is* saved (e.g. `s.feest`, `s.handel`, `s.opdracht`, `s.dorpelingen`) must be plain JSON and get a default in `save.herstel` so old saves keep loading.

## Branches

GitHub Pages serves the game from **`main`**, so `main` is only ever a copy of the latest published state — never develop directly on it. Feature work happens on `claude/*` branches. When a feature is ready to publish, bring `main` up to that branch (a fast-forward when the branch already contains `main`, otherwise merge `main` in first and resolve) so the two match. If a feature branch was cut from an older point, merge current `main` into it before publishing so nothing already on `main` is lost.
