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

### Layer separation

- `js/config/` — **pure data**, the balance knobs. `buildings.js` is the heart (costs, production `wint`/`maakt`, worker slots, placement rules). Also `resources.js`, `jobs.js`, `ages.js` (age-up requirements + victory), `quests.js` (objective list).
- `js/core/` — the simulation. Each module owns one concern and exposes a `tick(s, dt)` where relevant: `economy` (production/crafting/upkeep/storage), `population` (food/happiness/growth/jobs), `seasons`, `events` (travelling merchant + the festival helper), `raids` (raider battles, the field-army split and the `uitval`/sortie), `construction`, `ages`, plus `map` (generation), `state` (also computes `samenhorigheid`, the town-cohesion score), `rng` (seeded), `save`. New per-tick state (`s.leger`, `s.feest`, `s.koopman`, `s.samenhorigheid`, `s.moreel`) is all plain JSON; `save.herstel` and `raids.zorgLeger`/`events.zorg` fill in defaults for older saves.
- `js/render/` — canvas drawing (`camera`, `sprites`, `renderer`, `atlas`). **The view is isometric (2:1 diamond tiles).** The whole projection lives in `camera.js` (`wereldNaarScherm` / `schermNaarWereld` project world *pixels* through an iso transform; `Game.render.diamant`/`padDiamant` are the shared tile-diamond helpers). `Game.state` stays a plain square grid — nothing about iso is stored, so saves stay pure JSON. Because almost everything positions itself through `cam.wereldNaarScherm` (roads, walkers, raiders, particles, the placement grid), it tilts into the iso view for free; only the shape-drawing spots (terrain tiles, buildings, ghost/selection/resource highlights, minimap viewport) needed diamond-aware geometry. Buildings are drawn as **procedural iso volumes** (walls + roof, per-building table `ISO` in `sprites.js`), so the top-down Kenney building sprites in `atlas.js` are bypassed in the iso view; trees and rocks still use the atlas as **upright billboards** (with a hand-drawn fallback), so the game keeps working from `file://` with or without the `assets/` folder. Nothing in `atlas.js` touches `Game.state`. Drawing runs in **two passes**: the flat ground (`sprites.tekenGrond` — diamonds, coast, fields) first, then a **single back-to-front pass** over everything that stands up — raised terrain features (`sprites.tekenKenmerk`: trees, rocks, mountains, deer), buildings and walkers — collected in `renderer.js` and sorted by iso depth (footprint-centre `x+y`, then `y`) so overlaps read correctly. Any new standing element belongs in that sorted layer, not drawn in its own later pass, or it will float on top of everything. Terrain stores a per-tile height only as a hillshade tint (`bereidTerreinVoor`); the ground itself is drawn flat, which is what keeps mouse-picking (`schermNaarWereld`) exact.
- `js/ui/` — DOM panels (`hud`, `buildmenu`, `panel`, `quests`, `log`, `overlay`). `panel.js` and `buildmenu.js` use a `handtekening()` signature-diff so they only rebuild when something visible changed, otherwise the buttons would be ripped out from under the cursor each frame.

### The game loop

`js/main.js` runs a fixed-timestep accumulator (10 logic ticks/sec) decoupled from render framerate; speed buttons multiply the number of ticks, not `dt`. One simulation step, `stap(s, dt)`, runs modules in this order — **preserve it**, later steps read state the earlier ones wrote:

```
seasons → construction → economy → population → events → raids → quests(check) → ages(victory)
```

Rendering, decorative walkers, HUD refresh, and autosave run on real time outside the fixed step.

### Adding content

A new building is one object appended to the `B` array in `js/config/buildings.js` (fields documented in the header comment there; production numbers are **per worker per second**). Reload and it appears in the build menu; `devcheck.js` will complain in the console if it references an unknown resource/job/node. No other file needs touching for a standard building — in the iso view it automatically gets the default procedural volume. To give it a distinct silhouette (wall height, roof style `schuin`/`punt`/`plat`/`geen`, and flourishes like `kantelen`, `wieken`, `kruis`, `vlag`), add an entry keyed by its id to the `ISO` table in `js/render/sprites.js`; that table is the only render-side hook a building has.

## Conventions

- **Language split:** domain code (identifiers, building/resource ids, log text) is in **Dutch**; code comments are in **English**. Match this when editing.
- **Balancing = the food economy.** The two failure modes that were deliberately engineered out: hunger must remove food-workers *last* (`population.js` `rang()`), and low happiness must not throttle food production into a death spiral (production multiplier floors at `0.75`). Keep these invariants when touching `population.js` / `economy.js`.

## Branches

Develop on `claude/medieval-city-builder-game-89zcsx`. `main` exists as a copy at the same commit so GitHub Pages can serve it; keep them in sync when publishing.
