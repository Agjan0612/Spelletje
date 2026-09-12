/* Bundel-entry voor het apotheekspel.
 *
 * Zelfde opzet als het buurspel: alle simulatiemodules zijn klassieke IIFE's op
 * window.Apotheek en worden in afhankelijkheidsvolgorde geladen door legacy.js.
 * Die volgorde staat op één plek, zodat tools/simuleer-apotheek.js hem kan
 * uitlezen en nooit stilletjes achterloopt op een nieuw core-bestand. */
import './legacy.js';
import '../js/main.js';
