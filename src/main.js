/* Bundel-entry (PixiJS-renderlaag).
 *
 * Laadvolgorde is bewust en afhankelijkheidsgevoelig:
 *   1. pixi-setup: zet window.PIXI vóór al het andere.
 *   2. Alle bestaande IIFE-modules (simulatie, UI, en tijdens de migratie nog
 *      de oude canvas-renderer — het bouwmenu leunt op sprites.miniatuurBron).
 *   3. De nieuwe Pixi-renderer, die Game.render.renderer overschrijft.
 *   4. js/main.js: de game-bootstrap. Hangt aan DOMContentLoaded, dat ná de
 *      module-evaluatie afvuurt, dus start() draait gewoon.
 */
import './pixi-setup.js';
import './legacy.js';
import './render/pixi-renderer.js';
import '../js/main.js';
