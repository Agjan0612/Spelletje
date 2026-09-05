/* Zet window.PIXI vóór alle andere modules.
 * ES-modules evalueren hun imports volledig vóór de body van de importeur, dus
 * dit moet in een eigen module die als eerste geïmporteerd wordt — anders pakt
 * de renderlaag window.PIXI op vóór het gezet is. */
import * as PIXI from 'pixi.js';
window.PIXI = PIXI;
export default PIXI;
