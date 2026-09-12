/* Alle IIFE-modules in afhankelijkheidsvolgorde. Niet met de hand herordenen:
   het balansharnas leest deze lijst uit om te weten wat het moet laden. */
import '../js/namespace.js';
import '../js/config/instellingen.js';
import '../js/config/objecten.js';
import '../js/config/signalen.js';
import '../js/core/rng.js';
import '../js/core/pand.js';
import '../js/core/state.js';
import '../js/core/klok.js';
import '../js/core/toeloop.js';
import '../js/core/recept.js';
import '../js/core/werkvloer.js';
import '../js/core/personeel.js';
import '../js/core/geld.js';
import '../js/render/camera.js';
import '../js/render/tekenen.js';
import '../js/ui/log.js';
import '../js/ui/hud.js';
import '../js/ui/werklijst.js';
import '../js/ui/receptkaart.js';
import '../js/ui/overlay.js';
