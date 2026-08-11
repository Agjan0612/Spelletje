# Visuele roadmap — de wereld zichtbaar laten leven

> Richting A: **top-down met dieptecues** (geen isometrische herschrijving).

Een plan voor alle zeven visuele feedbackpunten plus een reeks sfeer-aanvullingen.
De simulatie is mechanisch al rijk; wat ontbreekt is dat je de systemen die je
stuurt ook *ziet*. Alles hieronder is incrementeel, blijft binnen de regels van
het project (geen build, geen dependencies, draait vanaf `file://`) en is per
fase los op te leveren en te testen.

Basis: gelezen code van `raids.js`, `renderer.js`, `sprites.js`, `map.js`,
`construction.js`, `ages.js`, `state.js`.

## De rode draad

Rovers zijn nu een getal, verdediging een getal, een tijdperk een label. Bijna
elk punt vraagt hetzelfde: maak de wereld **levend en leesbaar**. We houden
daarom de bestaande, goed uitgebalanceerde simulatie intact en bouwen er een
**visuele laag** overheen. Decoratieve dingen (poppetjes, rovers, particles,
wegen, schaduwen) blijven waar mogelijk **buiten `state`**, zodat saves puur JSON
blijven.

## Faseoverzicht

| Fase | Wat | Feedback | Effort | Risico | Hangt af van |
|---|---|---|---|---|---|
| **0** | Fundering — render-infrastructuur | — | M | laag | — |
| **1** | Levend dorp — lopende poppetjes + wegen | 2 · 7 | M | laag | 0 |
| **2** | Reliëf & diepte — terrein | 6 | L | midden | 0 |
| **3** | Rovers in beeld | 1 · 3 | L | midden | 0 |
| **4** | Positionele verdediging | 4 | M–L | **hoog** | 3 |
| **5** | Tijdperk-look — hele stad rijpt | 5 | M | laag | 0 |
| **6** | Sfeerjuweeltjes (optioneel) | extra | S–M | laag | 0 |

- **Effort** — S = uurtjes · M = een dag(deel) · L = meerdere sessies
- **Risico** — kans dat het balans of saves raakt

**Afhankelijkheden:** fase 0 ontsluit de rest; 1/2/3/5 kunnen daarna in elke
volgorde. Alleen fase 4 (balans) wacht op de invalsrichting uit fase 3.

## Randvoorwaarden — gelden voor élke fase

- Saves blijven puur JSON: geen `Infinity` (het spel gebruikt bewust
  `ONEINDIG = 1e9`); decoratieve entiteiten buiten `state`.
- `Game.core.state.herbereken(s)` na élke wijziging aan gebouwen of werkers —
  verdediging/opslag/woonruimte zijn afgeleid, niet opgeslagen.
- De map `assets/` mag ontbreken: elke nieuwe sprite houdt zijn shape-fallback,
  anders breekt `file://`.
- Simulatie 10 Hz (vaste stap) staat los van de rAF-render; animatie/particles
  horen bij de render op echte tijd.
- Nieuw bestand = `<script>`-tag in `index.html` op de juiste plek in de
  laadvolgorde; `devcheck.js` moet groen blijven.
- Balanswijzigingen valideren via Playwright / `window.spel`: een vers dorp haalt
  tijdperk 4 zonder honger.

---

## Fase 0 — Fundering (render-infrastructuur)

**Effort: M · Risico: laag**

Gedeelde bouwstenen zodat de rest los, veilig en zonder herhaalwerk te bouwen is.

**Aanpak**

- **Tekenvolgorde herzien** in `renderer.teken()` tot één duidelijke stapeling:
  terrein → reliëf-arcering → wegen → gebouwschaduwen → gebouwen (y-gesorteerd) →
  wandelaars/rovers → particles → overlays (raster, spook, weer, dag/nacht).
- **Mini particle-systeem** (`js/render/particles.js`): rook, vonken, vuur, stof.
  Puur in de render-laag, op echte tijd. Wordt hergebruikt door fase 2, 3, 5 én
  het rook-juweel — daarom eerst.
- **Conventie "decoratieve entiteiten"**: rovers en particles staan niet in
  `state`; waar nodig worden ze herleid uit `state` (bv. `s.raid`).
- **Schaduw-cache**: haakje om bij het laden/starten van een spel afgeleide
  render-data één keer voor te berekenen (gebruikt door fase 2).

**Raakt:** `renderer.js`, **+** `js/render/particles.js`, `index.html`

**Datamodel:** geen — alles blijft in de render-laag.

---

## Fase 1 — Levend dorp

**Feedback 2 · 7 — Effort: M · Risico: laag**

Poppetjes lopen écht, en tussen de huizen ontstaan straten. De snelste zichtbare
winst.

**Waarom ze nu "springen"**

`verversWandelaars()` bouwt de héle lijst elke 3 seconden (én bij elk geplaatst
gebouw) opnieuw op met `p: Math.random()` — dus alle poppetjes teleporteren op
dat moment. Daarbovenop is de beweging een kale lineaire interpolatie zonder
loopcadans: ze *glijden* en springen.

**Aanpak**

- **Stop het teleporteren:** `verversWandelaars()` verzoent de lijst i.p.v. hem te
  herbouwen — bestaande poppetjes behouden hun `p`/richting op sleutel
  (gebouw-id + slot), alleen wat veranderde komt erbij of gaat eruit.
- **Loopcadans** in `tekenWandelaars()`: een goedkope verticale sinus-wieg
  (`sin(s.tijd·f + fase)`) + horizontaal spiegelen op looprichting. De
  snelheidsschaling met `s.snelheid` aftoppen zodat ze op snel spelen niet
  wegschieten.
- **Drukte groeit mee:** aantal wandelaars koppelen aan `s.bevolking.totaal`, niet
  alleen aan werkplekken — een grote stad bruist meer.
- **Wegen** (`js/render/paths.js`): bereken een stratennet als een minimum spanning
  tree vanaf het dorpsplein over alle gebouwcentra; teken aardpad/kasseien ónder
  de gebouwen. Herbereken op dezelfde haakjes als de wandelaars
  (plaatsen/slopen/age), gecachet op een gebouw-handtekening (zelfde
  `handtekening()`-truc als `panel.js`/`buildmenu.js`).
- **Synergie:** laat de wandelaars de wegen als waypoints volgen i.p.v. rechte
  lijnen — dan versterken punt 2 en 7 elkaar.

**Raakt:** `renderer.js`, **+** `js/render/paths.js`, `main.js`, `index.html`

**Beslispunt:** stratennet als **MST-naar-plein** (aanbevolen — leest als een echt
dorp) versus losse stubs per gebouw.

**Datamodel:** geen; het net is volledig herleidbaar uit de gebouwposities.

---

## Fase 2 — Reliëf & diepte

**Feedback 6 — Effort: L · Risico: midden (performance)**

Bergen, bomen, water en land krijgen volume. Grootste "wow" per regel code.

**De sleutel: hoogte-informatie**

`map.genereer()` berekent wél een hoogte (`hh`), maar bewaart die niet — alleen
`t.v` (detail-ruis) overleeft. Zonder hoogte geen reliëf. Oplossing: sla per tegel
een schaduw/hoogtewaarde `t.h` (0–1) op bij generatie (één regel). Voor oude saves
een migratie die `t.h` uit `s.seed` herberekent met dezelfde ruis — saves blijven
werken én puur JSON.

**Aanpak (deelbaar)**

- **2a · Hellingschaduw + slagschaduwen:** tint elke tegel op hoogteverschil met de
  buur richting een vaste lichtbron (linksboven) → gras en bos gaan golven.
  Klifschaduw waar berg/rots aan lager terrein grenst. De schaduw-ellips die nu
  alleen gebouwen/poppetjes hebben, ook onder bomen (`bomen()`) en rotsen
  (`rotsen()`).
- **2b · Rijker water:** meerdere golfbanden, bewegende highlights, en een lichtere
  ondiepte-rand tegen de kust.
- **2c · Kustovergang / autotiling:** verzacht de harde kleurgrenzen tussen
  terreintypes (gras↔water↔bos) met een randoverlay. Meeste werk, grootste impact.
- **2d · Bergen:** een gelaagde bergrug met geschaduwde flanken en variabele
  sneeuwtop i.p.v. één driehoek.

**Raakt:** `map.js` (`t.h`), `save.js` (migratie), `sprites.js`, `renderer.js`

**Let op — performance:** schaduw/arcering **één keer voorberekenen** bij
kaartwijziging, niet per frame; de bestaande `zichtbaar()`-culling behouden.

**Datamodel:** `t.h` per tegel (JSON-safe getal) + save-migratie.

---

## Fase 3 — Rovers in beeld

**Feedback 1 · 3 — Effort: L · Risico: midden (timing) · géén balanswijziging**

Je ziet ze aankomen en binnenvallen — zonder de sim (en dus de balans) te
wijzigen.

**Idee: een decoratieve laag op de bestaande abstracte sim**

`raids.js` is nu volledig abstract: een countdown en één `beslecht()` die
`s.verdediging` tegen `s.raid.kracht` afweegt. We laten die logica intact en
*visualiseren* alleen de al-bepaalde uitkomst — net zoals `wandelaars` puur
cosmetisch is.

**Aanpak**

- **Roverentiteiten** (`js/render/raiders.js`): decoratief, op echte tijd, buiten
  `state`.
- **Waarschuwingsfase:** spawn een bende (aantal ~ `r.kracht`) aan één kaartrand;
  bewaar de invalsrichting in `s.raid.vanaf` (plat gegeven — nodig voor fase 4).
- **De 45 seconden:** de rovers marcheren zichtbaar van de rand naar het
  dorpsplein, getimed om de perimeter te bereiken precies als de timer op 0 loopt.
- **Bij `beslecht()`** speelt de uitkomst zich af: *verjaagd* → omkeren en
  vluchten; *ternauwernood* → korte botsing aan de rand; *doorgebroken* → ze
  bereiken het centrum, vuur/rook-particles op het beschadigde gebouw, dan
  vertrek.
- **Saven midden in een raid:** bij laden worden de rovers herleid uit `s.raid`
  (fase/timer/vanaf) → consistent en puur JSON.
- **Randjes:** een markering op de kaartrand waar ze vandaan komen; de bestaande
  ⚠️ per gebouw blijft.

**Raakt:** **+** `js/render/raiders.js`, `raids.js`, `renderer.js`, `main.js`,
`particles.js`

**Datamodel:** `s.raid.vanaf` (richting, plat). Rovers zelf niet in `state`.

---

## Fase 4 — Positionele verdediging

**Feedback 4 — Effort: M–L · Risico: hoog (balans) — achter validatie**

Wáár je torens en muren staan gaat ertoe doen. Bouwt voort op de invalsrichting
uit fase 3.

**Waarom plaatsing nu niets doet**

`wachttoren` heeft geen `plaats`-regel en levert een platte `verdediging: 18`.
Verdediging is één globale scalar; een toren in de hoek telt even zwaar als een
toren bij de poort.

**Aanpak**

- **Dekkingsgebied** per verdedigingsgebouw: wachttoren = straal, stadsmuur =
  frontage, kazerne/kasteel = garnizoen dat uitrukt (telt breed mee).
- **Effectieve verdediging** bij een raid = de dekking die de invalscorridor (band
  van rand naar plein) raakt; het garnizoen telt altijd mee.
- **Toon de corridor** tijdens de waarschuwing — eerlijk, en het leert de
  mechaniek. Hergebruik de straal-tekening die `tekenSpook()` al doet bij
  plaatsen.
- **HUD:** "effectieve vs totale verdediging", zodat de speler snapt waarom een
  aanval doorkwam.

**Raakt:** `buildings.js`, `raids.js`, `state.js`, `renderer.js`, `hud.js`

**Balansrisico — achter validatie:** dit maakt raids zwaarder bij verspreide
verdediging. Valideren met Playwright via `window.spel`. Begin **zacht** (ruime
corridor + garnizoen telt altijd mee), meet of een redelijk ommuurd dorp nog wint,
en draai het pas daarna aan.

**Datamodel:** dekkingsparameters (plat, in `buildings.js`); `s.raid.vanaf` komt al
uit fase 3.

---

## Fase 5 — Tijdperk-look

**Feedback 5 — Effort: M · Risico: laag (mits cosmetisch)**

Bij elke tijdperkovergang wordt je hele stad zichtbaar volwassener.

**Waarom er nu niets zichtbaar upgradet**

`ages.bevorder()` betaalt kosten, verhoogt `s.tijdperk`, ontgrendelt nieuwe
gebouwen en toont een overlay — maar bestaande gebouwen veranderen niet. Een
`huisje` ziet er in tijdperk 4 exact zo uit als in tijdperk 1.

**Aanpak (cosmetisch — het mechanische gewicht zit al in nieuwe gebouwen)**

- **Tier-look gekoppeld aan `s.tijdperk`:** de shape-fallback (`huis`, `hal`, …)
  krijgt per tier een ander palet + detail — leem → hout → steen → vakwerk, riet →
  pannen, schoorstenen erbij.
- **Age-up-moment** in `ages.bevorder()`: een korte "opbouw"-sweep over de stad
  (steigers + stof-particles), dan de nieuwe look. Hergebruikt de bouwvisuals en
  fase 0-particles.
- **Atlas (optioneel, asset-werk):** per-tier sprite-varianten in `atlas.js`; de
  fallback blijft altijd bestaan zodat `file://` zonder assets werkt.
- **Optioneel mini-mechanisch tintje** per tier (bv. +opbrengst of +woonruimte) —
  alleen mét balansvalidatie; standaard uit.

**Raakt:** `sprites.js`, `renderer.js`, `ages.js`, `atlas.js` (optioneel)

**Datamodel:** geen nieuw — de tier is afgeleid van `s.tijdperk`. Optioneel
`g.tijdperk` bij plaatsen als je per-gebouw "bouwjaar" wil (plat). Grootste
asset-afhankelijkheid van alle fases; daarom als laatste van de kernpunten.

---

## Fase 6 — Sfeerjuweeltjes (optioneel)

**Effort: S–M · Risico: laag**

De "unknown knowns" — klein, optioneel, overal tussen te schuiven.

- **Dag/nacht** — `s.tijd` bestaat al. Ambient-tint die cyclet + raamgloed 's
  nachts. Aparte laag van de vaste hillshade-lichtbron. *(S–M)*
- **Werk-signalen** — rook uit bakkerij/smederij, stof bij de groeve:
  particle-emitters op actieve productiegebouwen. *(M)*
- **Event-feedback** — korte screen-shake + flits bij een rooftocht en bij age-up.
  Maakt de grote momenten voelbaar. *(S)*
- **Minimap** — klein overzichtscanvas (terrein + gebouwen + invalsrichting).
  Ondersteunt navigatie voor fase 2/3/4. *(M)*
- **Raid-sporen** — schroei/puin-decal op een beschadigd gebouw tot het herbouwd
  is (`g.geschroeid`-timer, plat). *(S)*
- **Geluid** — minimale lokale audio (hoorn bij raid, klok bij age-up).
  `file://`-autoplay is lastig; embedden. Grootste lift — als laatste. *(M–L)*

---

## Datamodel & save-veiligheid

Bijna alles blijft in de render-laag. Slechts een handvol velden raakt `state` —
allemaal JSON-safe:

**Raakt state (JSON-safe)**

- `t.h` — per-tegel hoogte/schaduw (fase 2, met migratie uit `seed`)
- `s.raid.vanaf` — invalsrichting (fase 3 & 4)
- `g.tijdperk` — optioneel bouwjaar (fase 5)
- `g.geschroeid` — optionele schroei-timer (fase 6)

**Blijft buiten state (herleidbaar)**

- Verfijnde wandelaars & het wegennet
- Roverentiteiten & alle particles
- De schaduw-/reliëf-cache
- Minimap-render

---

## Waar te beginnen

**Fase 0 + 1** als eerste oplevering: klein, laag risico, en meteen zichtbaar
(lopende poppetjes + straten). Daarna **fase 2** (reliëf) voor de grootste visuele
sprong, en dan **fase 3** (rovers in beeld). Fase 4 en 5 als de basis staat.
