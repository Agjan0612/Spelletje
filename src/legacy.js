/* Alle bestaande IIFE-modules in exact de volgorde die index.html gebruikte.
   Ze hangen hun onderdelen aan window.Game; als side-effect-imports draaien ze
   in importvolgorde vóór DOMContentLoaded. Gegenereerd uit index.html — niet met
   de hand herordenen, de volgorde is afhankelijkheidsvolgorde. */
import '../js/namespace.js';
import '../js/config/instellingen.js';
import '../js/config/resources.js';
import '../js/config/jobs.js';
import '../js/config/buildings.js';
import '../js/config/ages.js';
import '../js/config/quests.js';
import '../js/config/handel.js';
import '../js/config/opdrachten.js';
import '../js/config/gebeurtenissen.js';
import '../js/config/onderzoek.js';
import '../js/config/rovers.js';
import '../js/config/standen.js';
import '../js/config/buursteden.js';
import '../js/config/scenarios.js';
import '../js/config/faam.js';
import '../js/core/rng.js';
import '../js/core/map.js';
import '../js/core/state.js';
import '../js/core/construction.js';
import '../js/core/economy.js';
import '../js/core/population.js';
import '../js/core/seasons.js';
import '../js/core/raids.js';
import '../js/core/ages.js';
import '../js/core/feesten.js';
import '../js/core/handel.js';
import '../js/core/opdrachten.js';
import '../js/core/gebeurtenissen.js';
import '../js/core/onderzoek.js';
import '../js/core/buurt.js';
import '../js/core/logistiek.js';
import '../js/core/plek.js';
import '../js/core/demografie.js';
import '../js/core/standen.js';
import '../js/core/buren.js';
import '../js/core/kroniek.js';
import '../js/core/arbeid.js';
import '../js/core/dorpelingen.js';
import '../js/core/historie.js';
import '../js/core/faam.js';
import '../js/core/save.js';
/* Alleen de gedeelde render-utilities die de Pixi-renderer en de UI nog nodig
   hebben. De oude canvas-renderer en zijn eigen tekenmodules (renderer, paths,
   raiders, props, wildlife, villagers, floaters, weer, particles) zijn vervangen
   door src/render/pixi-renderer.js en verwijderd.
   - camera:   Game.render.Camera (iso-projectie, hergebruikt)
   - beweging: Game.render.rng (render-only mulberry32)
   - atlas:    buildmenu-icoonpaden
   - sfeer:    Game.render.sfeer.licht (dagfase voor de belichting)
   - sprites:  miniatuurBron (bouwmenu/paneel) + terreinKleur (minimap)
   - lagen:    per-tegel overlay-waarden
   - minimap:  eigen minimap-canvas */
import '../js/render/camera.js';
import '../js/render/beweging.js';
import '../js/render/atlas.js';
import '../js/render/sfeer.js';
import '../js/render/sprites.js';
import '../js/render/lagen.js';
import '../js/render/minimap.js';
import '../js/ui/log.js';
import '../js/ui/audio.js';
import '../js/ui/tip.js';
import '../js/ui/hud.js';
import '../js/ui/buildmenu.js';
import '../js/ui/panel.js';
import '../js/ui/quests.js';
import '../js/ui/grafiek.js';
import '../js/ui/overlay.js';
import '../js/ui/stad.js';
import '../js/ui/onderzoek.js';
import '../js/ui/lagen.js';
import '../js/ui/kolom.js';
import '../js/devcheck.js';
