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
- `js/core/` — the simulation. Each module owns one concern and exposes a `tick(s, dt)` where relevant: `economy` (production/crafting/upkeep/storage), `population` (food/happiness/growth/jobs), `seasons`, `raids`, `construction`, `ages`, plus `map` (generation), `state`, `rng` (seeded), `save`.
- `js/render/` — canvas drawing (`camera`, `sprites`, `renderer`, `atlas`). Buildings, trees, rocks and villagers are drawn from **local CC0 sprite images** (`assets/kenney/`, Kenney "RTS Pack: Medieval") loaded by `atlas.js`; everything else (terrain base colours + seasons, water waves, mountains, farmland, the windmill's turning sails, the town wall) is still drawn with shapes. The sprite layer is **optional and non-authoritative**: `atlas.js` preloads the images and every caller falls back to the original shape/emoji drawing while an image is still loading or if the `assets/` folder is missing, so the game keeps working from `file://` with or without the assets. Nothing in `atlas.js` touches `Game.state`, so saves stay pure JSON.
- `js/render/` — **visual/atmosphere layer** (fully decorative, derived from `state`, never stored in it): `particles.js` (smoke/sparks/fire/dust, real time), `paths.js` (the street network — a minimum spanning tree over the buildings, cached on a `handtekening()` signature, drawn under them and followed by the walkers), `raiders.js` (the raider band that visualises the abstract raid: it marches in from `s.raid.vanaf` and plays the already-decided outcome), and `minimap.js` (overview canvas). `sprites.js` also holds the relief/hillshade cache (built once per map by `bereidTerreinVoor`) and the per-age building tier-look. `renderer.js` draws in one deliberate stack (deep sea → terrain+relief → roads → buildings → walkers+raiders → particles → overlays) and runs the real-time effects (particles, raiders, screen-shake, age-up sweep, work-smoke, scorch decay, day/night) via `tickEffecten(s, dt)`, separate from the fixed simulation step.
- `js/ui/` — DOM panels (`hud`, `buildmenu`, `panel`, `quests`, `log`, `overlay`) plus `audio.js`. `panel.js` and `buildmenu.js` use a `handtekening()` signature-diff so they only rebuild when something visible changed, otherwise the buttons would be ripped out from under the cursor each frame. `audio.js` **synthesises** its sounds (raid horn, age-up bell, breakthrough thud, victory peal) with the Web Audio API — no audio files to fetch or embed, so it works from `file://`; the `AudioContext` is created lazily and resumed on the first user gesture (autoplay policy), and the mute preference is kept in `localStorage`.

### The game loop

`js/main.js` runs a fixed-timestep accumulator (10 logic ticks/sec) decoupled from render framerate; speed buttons multiply the number of ticks, not `dt`. One simulation step, `stap(s, dt)`, runs modules in this order — **preserve it**, later steps read state the earlier ones wrote:

```
seasons → construction → economy → population → raids → quests(check) → ages(victory)
```

Rendering, decorative walkers, the real-time effects (`renderer.tickEffecten`: particles, raiders, screen-shake, age-up sweep, work-smoke, scorch decay, day/night), HUD refresh, minimap refresh, and autosave all run on real time outside the fixed step.

### Adding content

A new building is one object appended to the `B` array in `js/config/buildings.js` (fields documented in the header comment there; production numbers are **per worker per second**). Reload and it appears in the build menu; `devcheck.js` will complain in the console if it references an unknown resource/job/node. No other file needs touching for a standard building.

## Conventions

- **Language split:** domain code (identifiers, building/resource ids, log text) is in **Dutch**; code comments are in **English**. Match this when editing.
- **Balancing = the food economy.** The two failure modes that were deliberately engineered out: hunger must remove food-workers *last* (`population.js` `rang()`), and low happiness must not throttle food production into a death spiral (production multiplier floors at `0.75`). Keep these invariants when touching `population.js` / `economy.js`.

## Branches

Develop on `claude/medieval-city-builder-game-89zcsx`. `main` exists as a copy at the same commit so GitHub Pages can serve it; keep them in sync when publishing.
