# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"Dorp tot Stad" — a medieval city-builder game that runs in the browser. See `README.md` for gameplay.

**The render layer is PixiJS (WebGL) with a Vite build.** The game used to run with no build step from `file://`; that trade was made deliberately for a higher visual ceiling (see `PIXI-MIGRATIE.md`). The **simulation is untouched** by this: `js/config`, `js/core` and `js/ui` are still classic IIFE modules on `window.Game`, loaded in dependency order via `src/legacy.js`. Only the render layer changed — `src/render/pixi-renderer.js` owns `Game.render.renderer`, and what remains in `js/render/` are shared utilities (camera, sprites, lagen, minimap, sfeer, atlas, the render-only `rng`). Run it with `npm run dev` (or `npm run build` / `npm run preview`); it is no longer openable straight from `file://`.

## Running & testing

The render layer needs a Vite build (see `PIXI-MIGRATIE.md`); the balance harness still runs in bare Node.

- **Play locally:** `npm install` once, then `npm run dev` and open the printed URL (`npm run build` / `npm run preview` for the production bundle). Opening `index.html` straight from `file://` no longer works — it loads one module entry that Vite must bundle.
- **Pages-like check:** GitHub Pages serves the built `dist/` from a **subdirectory** (`/Spelletje/`) via `.github/workflows/pages.yml`. The relative `base` (`./`) keeps this working; when touching paths, verify both `npm run dev` and `npm run preview`.
- **Balance measurement — use `tools/simuleer.js`.** `node tools/simuleer.js` plays the
  whole game in Node with no browser and no dependencies (bare Node, CommonJS). It reads the script
  order out of `src/legacy.js` (plus `js/main.js`), loads only `js/config/`, `js/core/`, `js/ui/log.js`,
  `js/ui/quests.js` (both do real simulation work), `js/devcheck.js` and `js/main.js`,
  stubs the drawing layer, pins `Math.random` per seed and lets a fixed bot build a town.
  Flags: `--zaden=8 --tijd=9000 --kaart= --moeilijkheid= --scenario= --parallel= --json`.
  The seeds are independent, so it forks them across cores by default; `--parallel=1`
  keeps everything in one process. It prints
  per seed the time to each age, deaths from hunger and cold, the low-water mark of the
  larder and which age requirement it ended up stuck on — plus the **median**, which is
  the point: raids, events and births run on `Math.random`, so one run reads noise (age 3
  has been measured anywhere between 1135s and 2968s). Always measure before *and* after
  a balance change, with the same seeds; a git worktree at the old commit gives the
  before.
  The bot in that file is deliberately mediocre and deliberately fixed — the number it
  produces is only worth anything because it is the *same* player on both sides. Its
  absolute numbers are **not** comparable to a human's (it reaches age 3 around 1000s,
  faster than the 1135–2968s range measured by hand), only to its own numbers from another
  commit. And do not compare a single seed across a change that touches `map.js`: carving
  a river consumes draws from the map's `Rng`, so the same seed produces a different world
  before and after. Compare distributions, never rows.
- **The tick order lives in exactly one place.** `main.js` exposes its `stap(s, dt)` as
  `window.spel.stap`, and the harness drives that same function. Do not re-list the tick
  order anywhere else — a second copy is a second game.
- **Automated / headless testing in a browser:** `main.js` exposes the live game object as `window.spel` (and `window.spel.state`). Drive the simulation from the browser console or via Playwright (Chromium is preinstalled at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`): call `window.spel.nieuwSpel()`, set `s.snelheid = 0` and step with `window.spel.stap(s, 0.1)` while scripting `Game.core.construction.plaats(...)` and `Game.core.population.zetWerkers(...)`. Use this for anything that touches the DOM or the canvas; use the harness above for balance.
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

- `js/config/` — **pure data**, the balance knobs. `buildings.js` is the heart (costs, production `wint`/`maakt`, worker slots, placement rules, plus `verbetering`/`verborgen` for upgrades). Also `resources.js`, `jobs.js`, `ages.js` (age-up requirements + victory), `quests.js` (objective list), `instellingen.js` (map sizes + difficulties), `handel.js` (trade values), `opdrachten.js` (contract templates), `gebeurtenissen.js` (events with choices — their effects are functions in config, which is fine: config is not state), `onderzoek.js` (research), `faam.js` (the free-city ranks and what the crown asks for each term).
**Place matters, and it is computed in one place.** `js/core/buurt.js` answers two questions about any tile: what services a household there can reach (`dienstenOp`), and how pleasant the spot is (`aantrekkelijkOp`). Happiness reads the first — `herbereken` stores the town-wide averages as `s.dienstdekking` (0..1) and `s.sfeer` — so a chapel now only comforts the homes that can walk to it, and a smithy only sours the street it stands on. A building offering happiness **must** declare a `bereik`; `devcheck.js` fails the build if it does not, because points without a reach would silently never arrive. Desirability also gates growth: `verbetering.aantrekkelijkheid` and `plaats.aantrekkelijkheid` refuse an upgrade or a placement in an ugly corner. The height map that `map.js` already generated for the hillshade now feeds the simulation too (`buurt.relief`): mills catch more wind up high, fields want low well-watered ground, and watchtowers see further from a rise.

**There is a river, and it is a wall until you bridge it.** `map.js` carves one river per
64×48 of map (`graafRivier`) before anything is seeded: a source on the most landlocked
high ground, a walk that mixes downhill with "towards the nearest sea tile" plus a
perpendicular lurch for the meander, and a `t.rivier` flag on the tiles it turns to water.
It matters mechanically before it matters visually, and it does so through the module that
already owned the question. `logistiek.route` samples the straight line from a workplace
to its depot in one pass and returns two shares: how much of it is paved (`weg`) and how
much is **water nobody has bridged** (`water`). `L.effectieveAfstand` turns that into what
the cart actually walks — `lengte * (1 - WEGWINST*weg + OMWEG*water)` — because a cart
cannot ford a river, it goes around, and around is longer. `L.OMWEG` (2.2) is that detour.
Measured on a 20-tile haul across the river: 0.50 of the output arrives with nothing built,
0.58 with a paved road that stops at the bank, 0.69 once the bridge closes the gap. That is
the whole point of the feature, and the aanvoer overlay shows it because it asks the same
function. The **bridge** (`brug` in `buildings.js`) is a `weg: true` entry with
`overWater: true`: `construction.controleerWeg` lets it onto a water tile only when
`C.aanDeOever` finds land or an existing bridge orthogonally adjacent, so it is built out
from the bank span by span. The tile **stays water** — `t.t` is untouched, the fishing
ground under it survives, buildings still cannot stand there — it only gains `t.weg` and
`t.brug`. Because `t.weg` is all logistics, `paths.js` and the aanvoer overlay know about,
they all pick the bridge up for free. `paths.tekenBruggen` draws it as a raised deck with
planks, a shadow on the water and a rail on the sides that face open water, because a
paved diamond on water reads as a raft. `logistiek.omschrijving` says *why* a workplace is
badly supplied when the route crosses water — "ver van de opslag" is useless advice when
the barn is ten tiles away on the other bank.

**Goods have to get home.** `js/core/logistiek.js` gives every workplace one number: the share of its output that actually reaches a depot (anything with `opslag` — the square, a barn, a warehouse). Full within 10 tiles, sliding to a floor of `L.MIN` (0.5) at 26; `economy.js` multiplies production by it. Streets shorten that haul by up to `L.WEGWINST` (45%), measured by sampling the straight line for `t.weg` tiles rather than by pathfinding — cheap, stable, and it tells the player something they can act on. A **street is not a building**: `weg: true` in `buildings.js` marks a config entry that sets a tile flag instead of pushing to `s.gebouwen`, finishes instantly, and toggles off (with a refund) when placed on itself. `s.wegTeller` exists purely to invalidate the logistics cache. Keeping streets out of `s.gebouwen` matters: they would otherwise swamp the MST in `paths.js`, the depth sort in `renderer.js` and every loop over buildings in the codebase.

The decorative walkers now route to the depot the simulation actually delivers to, so the carts on screen are the carts the economy pays for.

**Everything that moves shares one steering model.** `js/render/beweging.js` gives every figure — villagers, soldiers on patrol, builders, raiders, the sheep — a `koers` and a `snelheid` that ease toward a target (turns at corners, brakes into a stop), plus the `bezig` state machine (lopen / werken / laden / lossen / praten / rusten / huiswaarts) that lets a baker have a work animation as much as a woodcutter. It also owns `Game.render.rng`, a mulberry32 the **whole render layer** draws from instead of `Math.random`: decoration must never perturb the simulation's RNG stream, and now provably does not — the sim produces byte-for-byte the same state whether or not the render layer ticks. The walkers themselves live here in the render layer (a module list in `renderer.js`), not in `Game.state`, so a save stays smaller and purely JSON. `js/render/weer.js` is a second render-only state machine (never in `Game.state`): a passing rain shower with a wet-road factor (`weer.natheid`) the streets and roofs read, plus a low morning mist.

`js/render/lagen.js` + `js/ui/lagen.js` are the eye for all of this: five map overlays (voorzieningen, aantrekkelijkheid, verdediging, aanvoer, grondstoffen), toggled with **L** or the bar at the bottom of the stage. The grondstoffen layer paints endless nodes — fertile ground, fishing grounds — at full rather than leaving them blank, because those are the two a new player is hunting for. The aanvoer layer asks `logistiek.factorOpTegel` per tile — routed through the very same formula as the economy, so the map can never drift away from the simulation. Treat them as part of the feature, not decoration — a locality rule the player cannot see is a locality rule they will experience as randomness.

- `js/core/` — the simulation. Each module owns one concern and exposes a `tick(s, dt)` where relevant: `economy` (production/crafting/upkeep/storage), `population` (food/happiness/growth/jobs), `seasons`, `raids`, `feesten` (festivals → `s.moreel`), `handel` (the travelling merchant), `opdrachten` (contracts with a deadline), `gebeurtenissen` (random events, which open a choice overlay and auto-resolve when there is no UI — that is what makes headless runs work), `construction` (place/build/**move**/**upgrade**/demolish), `ages` (age-up, victory and extinction), `dorpelingen` (the village register: named inhabitants kept in step with the headcount, flavour only), `faam` (the post-victory charter), `historie` (one sample per season), plus `map` (generation, including the rivers), `state`, `onderzoek` (research bonuses, all derived), `rng` (seeded), `save` (three slots).

`buurt.js` caches its building lists on a signature (the `handtekening` trick from `paths.js`) and is queried on demand, so `herbereken` staying cheap does not depend on how often workers change.

**Less clicking, more deciding.** `js/core/arbeid.js` is a labour policy: a priority (0..3) per kind of work, a number of builders to keep free, and an automatic pass that only ever *fills* empty slots from the idle pool. It never pulls someone off a bench — that would fight the practice bonus in `economy.js`, which exists precisely to reward stable crews. `arbeid.herverdeel` is the one-off full redeal, and the player has to ask for it.

`construction.PLOEGEN` caps how many sites the crew works on at once (`construction.wachtrij` orders them, `bouwPrio` jumps one to the front), so placing ten buildings no longer means ten crawling pits. `construction.annuleer` refunds an unfinished site in full — Ctrl+Z in `main.js` walks a short in-memory stack of recent placements, deliberately kept **out** of `Game.state` because it is a comfort for the person at the keyboard, not part of the town. `ui/stad.problemen` is the short list of what is stuck, sorted by urgency, with coordinates so a click takes the camera there.

**There is a world outside the walls.** `js/core/buren.js` generates three neighbouring towns per map (plain JSON on `s.buren`), each with a speciality, a reputation and an optional trade route. A route is an *investment*: it costs a wagon and a purse once and then pays every second — but it also hauls goods away, so a route you cannot supply quietly stops earning, and a raid that breaks through calls `buren.onderbreek` and cuts every route for a while. That is the first time a lost raid costs more than a pile of stolen timber. Requests from neighbours are the main way to move reputation.

**Scenarios** (`js/config/scenarios.js`) are the cheapest replayability the codebase can buy: one object gives a starting position (`start`), rules the simulation reads (`regels.verboden`, `regels.moeilijkheid`, `regels.kaart`, `regels.roverTempo`), and an ending (`doel.klaar` / `doel.faal` / `tijdslimiet`). `state.nieuw` applies the opening, `construction.controleer` honours `verboden`, `raids.volgendeRust` honours `roverTempo`, and `ages.controleerScenario` runs **before** the standard victory so a scenario never falls back on "build a cathedral". Adding one is a config edit and nothing else.

**The town has a memory.** `js/core/historie.js` writes one sample per in-game season into
`s.historie` — a ring buffer of 240 (sixty years), short keys (`k` quarter, `b` population,
`t` happiness, `v` food, `m` coins, `g` buildings, `p` age) because they land in every
save. `js/ui/grafiek.js` draws them as four small charts stacked in the statistics screen,
one per metric with its own y-scale: putting population and happiness on one axis would
tell a story that is not in the data. The age boundaries run through all four as gold
lines, because that is the one thing they share. Everything sampled is derived from the
state at that moment — nothing here is authoritative anywhere else.

**Losing is an ending, not silence.** `ages.controleerEinde(s)` fires the moment
`s.bevolking.totaal` hits zero: it sets `s.uitgestorven`, pauses, and opens
`overlay.uitgestorven`. `population.groei` refuses to grow a town of zero (without that a
dead town could repopulate itself out of nobody's happiness, and the winter would stop
being a deadline). `main.js` clears `spel.actief` on `s.uitgestorven`, so the autosave
stops instead of overwriting the last playable town with a corpse — the offer on that
screen is "go back twenty seconds", and it has to be real.

**Three save slots, not one.** `save.js` writes `dorp-tot-stad-boek-1..3` plus a small
separate register (`dorp-tot-stad-boeken-v1`) holding only what the picker shows — name,
year, age, points. Keeping that register apart is the whole trick: listing three towns
must not parse three multi-hundred-kilobyte saves. `SL.migreer()` moves the old single
`dorp-tot-stad-save-v1` key into book 1 once. `SL.huidig` is where the autosave writes and
is deliberately **not** in `Game.state`: it says something about this browser, not about
this town.

**There is a game after the cathedral.** `js/config/faam.js` + `js/core/faam.js` are the
free-city charter, and they only run once `s.gewonnen`. Same shape as `opdrachten.js` —
one open term with a deadline, all plain JSON — with two differences that matter: it never
stops, so the economy you built keeps a reason to run, and it pays **faam points**, which
buy ranks. A rank is derived exactly like research: `s.faam` stores only the points, and
`faam.bonus(s)` returns the same shape as `onderzoek.bonus(s)` so `herbereken` can run
both through one mill (`faam.meng`). A term also carries a **norm** (a minimum population
and happiness, both scaling with the rank): delivering is one point, delivering while the
town also meets the norm is two. That is the whole design — the charter is about how well
the town is built, not how big the pile is.

**The chronicle** (`js/core/kroniek.js`) turns the log, the register, the raid tally and the neighbours into a few paragraphs. Generated on demand, never stored.

**Storage is three storehouses, not one number.** `resources.js` gives every resource a `soort` (voedsel / goed / schat) and buildings an `opslagPer: { soort: n }` next to the general `opslag`. `herbereken` derives `s.capaciteiten[res]`, and **`state.plafond(s, res)` is the only correct way to ask what fits** — `s.capaciteit` survives as the general figure but reading it directly will lie about food and coins. Food now spoils (`economy.bederf`) unless a granary stops it, and coins and gems sit in their own vault.

**Winter is a deadline, not a pause.** `economy.brandhout` burns timber per villager while it freezes (so wood is a standing worry, not a starter resource), `economy.vorstBonus` collapses the catch of fishing huts that have no harbour within reach, and food spoils all year. Knobs in `Game.config.winter`. Running out of firewood costs happiness and eventually a villager — the same shape as hunger, and just as recoverable.

**Two real production chains.** wol → kleding (schaapskooi, weverij) and hop → bier (hopveld, brouwerij). These exist to feed the standing system: `standen.eisen.waren` are goods a class *consumes* per inhabitant per second, tallied in `overzicht` and actually taken out of the store in `tick`. A class whose goods ran out is unsatisfied, so cloth and beer are what turns a village into a city rather than being decoration. `devcheck.js` fails if a standing demands something nothing can produce.

**One dial the player turns continuously:** `s.belastingtarief` (an id from `Game.config.belastingtarieven`) multiplies the tax take and costs or buys happiness. It sits in the town-square panel.

**The village is people, not a headcount.** `s.bevolking.totaal` is still the single authority on how many mouths there are — every food and housing rule is untouched — but `js/core/demografie.js` now says *who* they are: `kinderen` (eat, cannot work), `volwassenen`, `ouderen` (still take a job, get less done, eventually die). Ageing runs as three flows with fractional accumulators, not a list of ages, so it costs three numbers instead of an object per villager. `demografie.sluitAan` is called from `herbereken` and settles any drift against the adults first — hunger, raids and events change `totaal` without ever needing to know the cohorts exist. The growth rule in `population.js` is unchanged; what `nieuweInwoner` adds is that a share of newcomers (`geboorteAandeel`) arrives as a child who cannot work for a year and a half. `s.bevolking.werkloos` — which is also the building crew — now counts from `handen` (adults + elderly), and `s.bonus.arbeid` sags as the town greys.

**Balance warning for anyone tuning this:** the game uses `Math.random()` for raids, events and births, so two runs of the same seed diverge enormously — age 3 was measured anywhere between 1135s and 2968s on identical settings. Tuning against a single run reads noise. Seed `Math.random` in the page (mulberry32 over a handful of seeds, median) before believing any number.

**Standing.** `js/config/standen.js` + `js/core/standen.js` give each house a `stand` (boeren / burgers / poorters). Higher standing pays much more tax but demands food variety and local service coverage; unmet demands cut that house's tax to a third and feed a happiness penalty. This is what the housing upgrade chain was always implying, and it makes coins scale with how *well* the town is built rather than with how many market stalls it owns.

**Practice.** `g.ervaring` (0..1) rises while a workplace keeps its crew and is knocked back 25% whenever workers are pulled off (`population.zetWerkers`), for up to `economy.ERVARING_BONUS` extra output. One number per building; the point is that constantly reshuffling villagers should cost something.

**Requests.** `dorpelingen.js` grew a `s.wens`: now and then a named inhabitant of the worst-served house asks for a well or a chapel nearby, and granting it pays morale. It only ever points at a house the happiness maths was already charging for — it gives that a face rather than adding a rule.

**A raid is no longer one dice roll.** During the 45-second warning the band *marches* down the corridor and every tower, wall and gate whose coverage it crosses fires once, taking its `verdediging` straight off `s.raid.kracht` (`marcheer`, `s.raid.beschoten`). `Game.config.rovers.attritie` is **1.0 on purpose**: the arithmetic of "does my defence beat their strength" is algebraically identical to the old flat comparison, so the existing balance carries over untouched — everything new is in the telling and in the choices. Cover that has already fired is excluded from `verdedigingSplit`, so it is never counted twice.

Four verbs live on `s.raid.keuze` and are resolved in `beslecht`: **uitval** (as before), **ontruimen** (work stops outside `evacuatieStraal`, but far less is stolen and nobody dies), **burgerwacht** (idle villagers count as defence, but `construction.tick` stops), and **schatting** (pay them off; `s.rovers.schattingen` makes every later band bolder). `economy.js` and `construction.js` ask `raids.werkOnderbroken(s, g)` and `raids.bouwStilgelegd(s)` rather than knowing about raids themselves.

`s.rovers` is the captain across the field — name, grudge, tributes taken, times beaten. Wiping out a band always replaces him (`vervangKapitein`), so the feud continues with a successor. From age 4 an evenly-matched band may **besiege** instead of charging: `s.raid.fase === 'beleg'` stops all work beyond `belegStraal`, drains morale, and lifts either on its own clock or when a sortie breaks it. Balance knobs all live in `js/config/rovers.js`.

`raids.js` also owns the **field army**: `verdedigingSplit(s)` separates the garrison (soldiers, keeps — it can march) from positional cover (towers, walls, gates that only count on the raiders' corridor). `s.leger` stores victories and whether a sortie is ordered; a sortie that wins destroys the band outright (`uitslag: 'vernietigd'`), which buys extra peace and shaves a little off later raids.
- `js/render/` — canvas drawing (`camera`, `sprites`, `renderer`, `atlas`). **The view is isometric (2:1 diamond tiles).** The whole projection lives in `camera.js` (`wereldNaarScherm` / `schermNaarWereld` project world *pixels* through an iso transform; `Game.render.diamant`/`padDiamant` are the shared tile-diamond helpers). `Game.state` stays a plain square grid — nothing about iso is stored, so saves stay pure JSON. Because almost everything positions itself through `cam.wereldNaarScherm` (roads, walkers, raiders, particles, the placement grid), it tilts into the iso view for free; only the shape-drawing spots (terrain tiles, buildings, ghost/selection/resource highlights, minimap viewport) needed diamond-aware geometry. Buildings are drawn as **procedural iso volumes** (walls + roof, per-building table `ISO` in `sprites.js`), so the top-down Kenney building sprites in `atlas.js` are bypassed in the iso view; trees and rocks still use the atlas as **upright billboards** (with a hand-drawn fallback), so the game keeps working from `file://` with or without the `assets/` folder. Nothing in `atlas.js` touches `Game.state`. Drawing runs in **two passes**: the flat ground (`sprites.tekenGrond` — diamonds, coast, fields) first, then a **single back-to-front pass** over everything that stands up — raised terrain features (`sprites.tekenKenmerk`: trees, rocks, mountains, deer), buildings and walkers — collected in `renderer.js` and sorted by iso depth (footprint-centre `x+y`, then `y`) so overlaps read correctly. Any new standing element belongs in that sorted layer, not drawn in its own later pass, or it will float on top of everything. That is where `props.js` (yard clutter around buildings, `soort: 0.5`) and `wildlife.js` (grazing sheep, jumping fish, `soort: 0.6`) hook in; both derive their contents from the buildings/map and keep them in their own module, never in state. `floaters.js` (the rising `+🪵` yields) draws after the particles, and mirrors the production formulas from `economy.js` so the numbers on screen are the real ones. Terrain stores a per-tile height only as a hillshade tint (`bereidTerreinVoor`); the ground itself is drawn flat, which is what keeps mouse-picking (`schermNaarWereld`) exact.

**One sun, and it is not in `Game.state`.** `js/render/sfeer.js` owns the light: `sfeer.licht(s)` turns `s.tijd` into the phase of the day (`nacht` / `avond` / `ochtend`), and `tekenGradatie` / `tekenVensters` / `tekenNevel` / `tekenVignet` are the last four things `renderer.teken` draws, in that order — the night wash, the warm windows shining through it, the distance haze that pushes the top of an iso screen back, and the vignette that closes the frame. The sun's *colour* moves through the day; its *direction* never does. `sfeer.SCHADUW` is that one direction, and every cast shadow in the game (buildings, trees, rocks, mountains) reads it, because the hillshade baked into the terrain is lit from the top-left and a wandering shadow would fight it.

**The ground has no hard edges.** `bereidTerreinVoor` builds three derived arrays next to the hillshade, all keyed on `kaart.seed` and all outside `Game.state`: the hillshade itself, `diepte` (flood-fill distance from the coast, which is what makes shallow water turquoise and open water dark), and `randen` (a four-bit mask per tile of which edges border a different terrain, plus that neighbour's type). `overgangen` bleeds the neighbour's colour a little way in along those edges — sand where the neighbour is water, so a coastline becomes a beach — and returns immediately on the common case of a tile with no border at all. Two bands zoomed in, one zoomed out.

Buildings get a cast shadow, a dark contour over the wall corners and eaves, and a roof that springs from a slightly wider diamond than the wall top (the overhang is most of what separates "a house" from "a box with a point on it"). `opties.zaad` (the building's id) nudges its wall and roof colour a few percent, so a street of five huisjes is not one long shed. The icon badge hangs on a small board and **fades out with zoom** (gone above `p > 70`): far out it is the only thing identifying a roof, close up the silhouette and the facade already say it.

**Watch the fill count.** All of the above is per-tile canvas work on a grid that can be several thousand tiles at low zoom, so two things are load-bearing: `verf()` is memoised on (colour, factor/200) because it used to re-parse a hex string several times per tile per frame, and the flat full-screen washes in `tekenGradatie` are composited into a single `fillRect` rather than one per layer. Measured in headless Chromium (software rendering, so a pessimistic floor) the whole visual pass costs roughly a quarter of the frame budget versus the flat-shaded version.
`css/style.css` is hand-written and has no framework. Two custom properties carry the material: `--eik` for the wooden frame (top bar, build bar) and `--paneel` for anything you are meant to read. Buttons share one transition and one `:focus-visible` ring so the game stays playable from the keyboard, and everything animated is switched off under `prefers-reduced-motion`. A new panel should reach for those variables rather than inventing its own brown.

- `js/ui/` — DOM panels (`hud`, `buildmenu`, `panel`, `quests`, `log`, `overlay`, `stad`, `onderzoek`, `audio`, `tip`, `kolom`, `lagen`, `grafiek`). `panel.js`, `buildmenu.js` and `stad.js` use a `handtekening()` signature-diff so they only rebuild when something visible changed, otherwise the buttons would be ripped out from under the cursor each frame; `stad.js` additionally keeps a list of small updater closures so its countdowns tick without a rebuild. `stad.js` owns the "Stadszaken" card (festival, caravan, contract), the event dialog and the overview; `overlay.js` owns the welcome/new-game/help/menu/statistics screens.

**The interface earns its space.** Four rules that a new panel should keep:

- **Nothing on screen that is always nul.** `s.gezien` (plain `{ id: true }`, kept in step by `state.voegToe` and `state.merkOp` inside `herbereken`) says which resources this town has actually met; the HUD shows only those, so a first-age village watches five counters instead of fourteen. The shield hides itself until raiders can come.
- **One card, three tabs.** The right-hand column is `js/ui/kolom.js`: Tijdperk / Doelen / Stad, one visible at a time, each tab carrying a dot when something behind it wants attention (red for a real problem, gold for a merchant, a deliverable contract or a neighbour's request). Three stacked cards never fitted, so the bottom one was always half off-screen. The elder's one-line advice sits *above* the tabs and is therefore never hidden.
- **Tooltips are drawn, not `title`-ed.** `js/ui/tip.js` is the one tooltip in the game; `tip.hang(el, fn)` asks `fn()` for fresh HTML on every hover, so the happiness breakdown is about the town as it is now. `buildmenu.js` and `hud.js` both draw through it.
- **The build bar is sorted by what a building does**, not by the age it came from: Wonen, Voedsel, Grondstoffen, Opslag, Voorzieningen, Ambacht, Handel, Verdediging, Straten. `BM.SOORTEN` in `buildmenu.js` holds two orders that are deliberately different — the array is the tab order, `prio` is the order the tests are tried (a castle stores goods, but defence is asked first). Locked buildings stay in their drawer, greyed, so you can see what is coming.

**Where matters, so say so at the cursor.** `js/core/plek.js` answers "what is this building worth on *this* tile" and `main.js` draws it in the ghost label: the haul home (`logistiek.factorOpTegel`), how long the trees or the vein last for a full crew, water and slope under a field, wind on a mill, how many homes a chapel reaches, the desirability of a spot for a house. Every line is read out of the module that runs that rule, never re-derived, so the preview cannot promise what the economy will not pay. While a building with a `plaats.nabij` rule is on the cursor, the grondstoffen overlay switches itself on and is put back afterwards (`leenKaartlaag` in `main.js`).

**Winter is a deadline you can see coming.** `population.vooruitzicht(s)` rolls the larder forward — today's net food flow until the frost, then a winter with the fields shut down and the extra mouthfuls counted — and returns `{ dagen, tekort, dagenTotWinter, … }`. The HUD's 🍞 chip is that number, and `waarschuwVoorHonger` says it once in the autumn, when there is still a season left to act.

### The game loop

`js/main.js` runs a fixed-timestep accumulator (10 logic ticks/sec) decoupled from render framerate; speed buttons multiply the number of ticks, not `dt`. One simulation step, `stap(s, dt)`, runs modules in this order — **preserve it**, later steps read state the earlier ones wrote:

```
seasons → construction → economy → population → demografie → standen
        → raids → feesten → handel → opdrachten → gebeurtenissen
        → buren → arbeid → dorpelingen → faam → historie
        → quests(check) → ages(victory / extinction)
```

`historie` is deliberately last of the simulation steps: it is a recorder, so it must see
the state everything else has already written.

Rendering, decorative walkers, HUD refresh, and autosave run on real time outside the fixed step.

### Adding content

A new building is one object appended to the `B` array in `js/config/buildings.js` (fields documented in the header comment there; production numbers are **per worker per second**). Reload and it appears in the build menu; `devcheck.js` will complain in the console if it references an unknown resource/job/node. No other file needs touching for a standard building — in the iso view it automatically gets the default procedural volume. To give it a distinct silhouette (wall height, roof style `schuin`/`punt`/`plat`/`geen`, roof *material* `dakstijl` `pan`/`riet`/`lei`, a `schoorsteen`, and flourishes like `kantelen`, `wieken`, `kruis`, `vlag`), add an entry keyed by its id to the `ISO` table in `js/render/sprites.js`; that table is the only render-side hook a building has. The build menu and the selection panel show a cached iso *miniature* of the volume (`sprites.miniatuurBron`), so a new building looks right there with no extra work. Yard clutter is a second, optional hook: the `BIJ` table in `js/render/props.js` maps a building id to the props that appear around it.

**Upgrades** are two edits: `verbetering: { naar, tijdperk, kosten }` on the base building, and the target building itself with `verborgen: true` (kept out of the build menu) and the **same `grootte`** — the footprint must not change, since the move keeps the same tiles. `devcheck.js` checks both.

New **events**, **contracts**, **research** and **charter terms** (`faamEisen`) are likewise one object appended to their config list; nothing else needs touching. `devcheck.js` checks each of them — a charter term for a resource nothing produces, or a rank whose thresholds do not rise, fails the build.

**Difficulty and map size** come from `js/config/instellingen.js` and are chosen on the new-game screen; `state.nieuw(seed, naam, opties)` stores the ids and `raids.js` reads the difficulty.

## Conventions

- **Language split:** domain code (identifiers, building/resource ids, log text) is in **Dutch**; code comments are in **English**. Match this when editing.
- **Balancing = the food economy.** The two failure modes that were deliberately engineered out: hunger must remove food-workers *last* (`population.js` `rang()`), and low happiness must not throttle food production into a death spiral (production multiplier floors at `0.75`). Keep these invariants when touching `population.js` / `economy.js`.

## Branches

`main` is what GitHub Pages serves. Work happens on `claude/...` feature branches and is merged into `main` when it is validated.

Two lines of work once ran in parallel and were merged in commit "Twee ontwikkellijnen samenvoegen": one added the city-life systems, research, upgrades and the winter/props visuals, the other added the harbour, the field army, cohesion and the village register. If a system exists twice in the history, the version that survived is the one wired into `index.html` — check there before reviving anything from an older commit.
