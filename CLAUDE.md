# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"Dorp tot Stad" — a medieval city-builder game that runs entirely in the browser with **no build step, no dependencies, no server**. Vanilla HTML/CSS/JS on a 2D canvas. See `README.md` for gameplay.

## Running & testing

There is no npm, no build, no test runner in the repo.

- **Play locally:** open `index.html` directly (`file://`). This is the primary target — it must keep working.
- **Pages-like check:** the game is also served over HTTP from a **subdirectory** (GitHub Pages at `/Spelletje/`). All asset paths are relative so this works unchanged, but when touching paths, verify both routes.
- **Automated / headless testing:** `main.js` exposes the live game object as `window.spel` (and `window.spel.state`). Drive the simulation from the browser console or via Playwright (Chromium is preinstalled at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`). The pattern used for playtesting: call `window.spel.nieuwSpel()`, then repeatedly call the tick functions with a fixed `dt` (see the tick order below) while scripting `Game.core.construction.plaats(...)` and `Game.core.population.zetWerkers(...)`, and read back `s.res`, `s.bevolking`, `s.verzameld`. Balance changes must be validated this way — that a fresh village can reach age 4 without starving.
  A headless run must also answer choices for the systems that wait for the
  player: `s.gebeurtenis.actief` needs `Game.core.gebeurtenissen.kies(s, 0)`,
  otherwise no further events fire.
- **Config self-check:** `js/devcheck.js` runs at startup and logs `✅ Speldata gecontroleerd` or a loud list of errors to the console. Check the console after any change to `js/config/`.

## Architecture

### No ES modules — deliberate

Because the game must run from `file://` (where `import` is blocked), every file is a classic IIFE that hangs its parts on a single global `window.Game` namespace (`{ config, core, render, ui, state, util }`). `index.html` loads all scripts with plain `<script>` tags **in dependency order**. Adding a new file means adding a `<script>` tag in the correct position in `index.html`.

### Single serializable state

The entire game is one plain-object tree, `Game.state` (also `window.spel.state`). A save is literally `JSON.stringify(state)` — see `js/core/save.js`. Consequence: **never put non-JSON values in state.** The map uses `Game.core.map.ONEINDIG` (`1e9`) instead of `Infinity` for endless resource nodes precisely because `Infinity` does not survive JSON.

Derived values (housing, storage cap, defence, worker totals, global bonuses) are **not** stored authoritatively — they are recomputed by `Game.core.state.herbereken(s)`, which must be called after any change to buildings or worker assignments. **Research works the same way:** `s.onderzoek` only stores *which* studies were bought (`{ id: true }`); the multipliers (`s.bonus.voedsel/bouw/winter/tevredenheid`, and the factors folded into `productie`, `mijnbouw`, `capaciteit`, `verdediging`) come out of `Game.core.onderzoek.bonus(s)` inside `herbereken`.

City life adds a handful of plain-JSON fields next to `s.raid`, each a phase or a timer: `s.moreel`, `s.feest`, `s.handel`, `s.opdracht`, `s.gebeurtenis`, plus `s.onderzoek`, `s.leger`, `s.dorpelingen`, `s.kaartmaat` and `s.moeilijkheid`. `s.samenhorigheid` (how compactly the town is built around its square, 0..1) is **derived** in `herbereken` and feeds the happiness target. `save.js` fills them all in for older saves.

### Layer separation

- `js/config/` — **pure data**, the balance knobs. `buildings.js` is the heart (costs, production `wint`/`maakt`, worker slots, placement rules, plus `verbetering`/`verborgen` for upgrades). Also `resources.js`, `jobs.js`, `ages.js` (age-up requirements + victory), `quests.js` (objective list), `instellingen.js` (map sizes + difficulties), `handel.js` (trade values), `opdrachten.js` (contract templates), `gebeurtenissen.js` (events with choices — their effects are functions in config, which is fine: config is not state), `onderzoek.js` (research).
- `js/core/` — the simulation. Each module owns one concern and exposes a `tick(s, dt)` where relevant: `economy` (production/crafting/upkeep/storage), `population` (food/happiness/growth/jobs), `seasons`, `raids`, `feesten` (festivals → `s.moreel`), `handel` (the travelling merchant), `opdrachten` (contracts with a deadline), `gebeurtenissen` (random events, which open a choice overlay and auto-resolve when there is no UI — that is what makes headless runs work), `construction` (place/build/**move**/**upgrade**/demolish), `ages`, `dorpelingen` (the village register: named inhabitants kept in step with the headcount, flavour only), plus `map` (generation), `state`, `onderzoek` (research bonuses, all derived), `rng` (seeded), `save`.

`raids.js` also owns the **field army**: `verdedigingSplit(s)` separates the garrison (soldiers, keeps — it can march) from positional cover (towers, walls, gates that only count on the raiders' corridor). `s.leger` stores victories and whether a sortie is ordered; a sortie that wins destroys the band outright (`uitslag: 'vernietigd'`), which buys extra peace and shaves a little off later raids.
- `js/render/` — canvas drawing (`camera`, `sprites`, `renderer`, `atlas`). **The view is isometric (2:1 diamond tiles).** The whole projection lives in `camera.js` (`wereldNaarScherm` / `schermNaarWereld` project world *pixels* through an iso transform; `Game.render.diamant`/`padDiamant` are the shared tile-diamond helpers). `Game.state` stays a plain square grid — nothing about iso is stored, so saves stay pure JSON. Because almost everything positions itself through `cam.wereldNaarScherm` (roads, walkers, raiders, particles, the placement grid), it tilts into the iso view for free; only the shape-drawing spots (terrain tiles, buildings, ghost/selection/resource highlights, minimap viewport) needed diamond-aware geometry. Buildings are drawn as **procedural iso volumes** (walls + roof, per-building table `ISO` in `sprites.js`), so the top-down Kenney building sprites in `atlas.js` are bypassed in the iso view; trees and rocks still use the atlas as **upright billboards** (with a hand-drawn fallback), so the game keeps working from `file://` with or without the `assets/` folder. Nothing in `atlas.js` touches `Game.state`. Drawing runs in **two passes**: the flat ground (`sprites.tekenGrond` — diamonds, coast, fields) first, then a **single back-to-front pass** over everything that stands up — raised terrain features (`sprites.tekenKenmerk`: trees, rocks, mountains, deer), buildings and walkers — collected in `renderer.js` and sorted by iso depth (footprint-centre `x+y`, then `y`) so overlaps read correctly. Any new standing element belongs in that sorted layer, not drawn in its own later pass, or it will float on top of everything. That is where `props.js` (yard clutter around buildings, `soort: 0.5`) and `wildlife.js` (grazing sheep, jumping fish, `soort: 0.6`) hook in; both derive their contents from the buildings/map and keep them in their own module, never in state. `floaters.js` (the rising `+🪵` yields) draws after the particles, and mirrors the production formulas from `economy.js` so the numbers on screen are the real ones. Terrain stores a per-tile height only as a hillshade tint (`bereidTerreinVoor`); the ground itself is drawn flat, which is what keeps mouse-picking (`schermNaarWereld`) exact.
- `js/ui/` — DOM panels (`hud`, `buildmenu`, `panel`, `quests`, `log`, `overlay`, `stad`, `onderzoek`, `audio`). `panel.js`, `buildmenu.js` and `stad.js` use a `handtekening()` signature-diff so they only rebuild when something visible changed, otherwise the buttons would be ripped out from under the cursor each frame; `stad.js` additionally keeps a list of small updater closures so its countdowns tick without a rebuild. `stad.js` owns the "Stadszaken" card (festival, caravan, contract), the event dialog and the overview; `overlay.js` owns the welcome/new-game/help/menu/statistics screens.

### The game loop

`js/main.js` runs a fixed-timestep accumulator (10 logic ticks/sec) decoupled from render framerate; speed buttons multiply the number of ticks, not `dt`. One simulation step, `stap(s, dt)`, runs modules in this order — **preserve it**, later steps read state the earlier ones wrote:

```
seasons → construction → economy → population → raids
        → feesten → handel → opdrachten → gebeurtenissen
        → dorpelingen → quests(check) → ages(victory)
```

Rendering, decorative walkers, HUD refresh, and autosave run on real time outside the fixed step.

### Adding content

A new building is one object appended to the `B` array in `js/config/buildings.js` (fields documented in the header comment there; production numbers are **per worker per second**). Reload and it appears in the build menu; `devcheck.js` will complain in the console if it references an unknown resource/job/node. No other file needs touching for a standard building — in the iso view it automatically gets the default procedural volume. To give it a distinct silhouette (wall height, roof style `schuin`/`punt`/`plat`/`geen`, and flourishes like `kantelen`, `wieken`, `kruis`, `vlag`), add an entry keyed by its id to the `ISO` table in `js/render/sprites.js`; that table is the only render-side hook a building has. Yard clutter is a second, optional hook: the `BIJ` table in `js/render/props.js` maps a building id to the props that appear around it.

**Upgrades** are two edits: `verbetering: { naar, tijdperk, kosten }` on the base building, and the target building itself with `verborgen: true` (kept out of the build menu) and the **same `grootte`** — the footprint must not change, since the move keeps the same tiles. `devcheck.js` checks both.

New **events**, **contracts** and **research** are likewise one object appended to their config list; nothing else needs touching.

**Difficulty and map size** come from `js/config/instellingen.js` and are chosen on the new-game screen; `state.nieuw(seed, naam, opties)` stores the ids and `raids.js` reads the difficulty.

## Conventions

- **Language split:** domain code (identifiers, building/resource ids, log text) is in **Dutch**; code comments are in **English**. Match this when editing.
- **Balancing = the food economy.** The two failure modes that were deliberately engineered out: hunger must remove food-workers *last* (`population.js` `rang()`), and low happiness must not throttle food production into a death spiral (production multiplier floors at `0.75`). Keep these invariants when touching `population.js` / `economy.js`.

## Branches

`main` is what GitHub Pages serves. Work happens on `claude/...` feature branches and is merged into `main` when it is validated.

Two lines of work once ran in parallel and were merged in commit "Twee ontwikkellijnen samenvoegen": one added the city-life systems, research, upgrades and the winter/props visuals, the other added the harbour, the field army, cohesion and the village register. If a system exists twice in the history, the version that survived is the one wired into `index.html` — check there before reviving anything from an older commit.
