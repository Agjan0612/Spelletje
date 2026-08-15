# 🎣 Bouwplan — de speler hooked krijgen

> **Status: gebouwd.** Alle twaalf ideeën plus de bonus zijn geïmplementeerd op
> branch `claude/game-engagement-ideas-5g57qg`. De simulatiekern valideert headless
> naar tijdperk 3–4 zonder honger, en het spel laadt schoon in Chromium (devcheck
> groen, geen JS-fouten). Dit document blijft staan als ontwerpverantwoording.

De derde laag van het plan. Er liggen al twee documenten en die blijven staan:

- **`ROADMAP.md`** — de *visuele* laag: de wereld zichtbaar laten leven.
- **`BOUWPLAN.md`** — de *inhoud*: lopende poppetjes, feesten, koopman, events.

Dit document gaat over de laag die daar tussendoor loopt en die beide nog
niet raken: **waarom je blíjft spelen, terugkomt, en het aan iemand doorstuurt.**
Retentie, meesterschap, betekenisvolle keuzes en "nog één rondje". Twaalf ideeën
plus een bonus, elk met een concreet bouwplan dat binnen de spelregels van deze
codebase past: vanilla JS, geen bouwstap, draait vanaf `file://`, saves blijven
pure JSON.

**Legenda moeite:** 🟢 klein · 🟡 middel · 🔴 groot
**Legenda risico:** ✅ alleen tekenwerk/afgeleid · ⚠️ raakt de speltoestand/balans

---

## Waarom deze twaalf, en in deze groepen

Een city-builder houdt je vast met vijf krachten. Voor elke kracht staat hier
minstens één idee, gebouwd op iets dat al in de code zit:

| Kracht die bindt | Bestaat al in de code | Ideeën |
|---|---|---|
| **Getal-gaat-omhoog & meesterschap** | `verzameld` (cumulatief), `tevredenheid` | 1 · 5 · 7 |
| **Betekenisvolle keuzes** | `bonus.productie`-patroon, `moreel` | 4 · 9 · 6 |
| **Herspeelbaarheid** | `rng.js` is al **seeded** | 2 · 3 |
| **Sappigheid (game-feel)** | `audio.js` synth-motor bestaat al | 10 · 7 |
| **Terugkomen & delen** | `eindDoel`, `save.js` export als tekst | 11 · 8 · 12 · ★ |

De grootste hefboom is idee **1 (Faam)**: dat is de ruggengraat waar de meeste
andere ideeën hun beloning aan ophangen. Bouw die eerst.

---

## A · Getal-gaat-omhoog & meesterschap

### 1. Faam — één groeiend getal dat alles samenbindt 🟢 ✅
`js/core/faam.js` *(nieuw)* · `js/ui/hud.js`

Nu is er geen enkele overkoepelende maat voor "hoe goed doe ik het?". Tijdperk is
een label, tevredenheid schommelt. **Faam** wordt dat ene cijfer dat langzaam
oploopt en dat je wíl zien stijgen — de dopamine-ruggengraat van al het andere.

**Hoe:** een pure afgeleide functie `Game.core.faam.bereken(s)` uit dingen die al
in `state` staan: inwoners, gebouwen (gewogen naar tijdperk), bereikte tijdperken,
overleefde winters en verjaagde rovers (`s.raid.nummer`). Niks nieuws opslaan — het
is een som over bestaande velden, net als `herbereken()`. In de HUD een teller die
**zichtbaar omhoog telt** naar de nieuwe waarde (met een kort tik-geluidje uit idee
10). Persoonlijk record in `localStorage` (`dorp-tot-stad-beste-faam`), zoals
`audio.js` en `save.js` `localStorage` al netjes met een try/catch gebruiken.

**Waarom het bindt:** geeft elke andere verbetering een gemeenschappelijke munt, en
opent de deur naar record verbreken, dagelijkse uitdagingen en deelbare eindkaarten.

### 5. Mijlpalen & prijzenkast 🟡 ✅
`js/config/mijlpalen.js` *(nieuw)* · `js/core/mijlpalen.js` *(nieuw)* · `js/ui/`

Prestaties met een badge, een toast en een schep Faam. Het bindende mechanisme
bestaat al: het `klaar(state)`-predikaat uit `quests.js`. Dit is datzelfde patroon,
maar blijvend en verzamelbaar.

**Hoe:** een lijst als data — `{ id, titel, emoji, klaar(s), faam }`. Voorbeelden
die direct uit bestaande velden lezen: *"Eerste winter overleefd"* (`s.jaar>1` &
nooit honger gehad), *"Honderd zonder hongersnood"* (`s.bevolking.totaal>=100` &
`hongerTimer` bleef 0), *"Rovers vijf keer verjaagd"* (`s.raid.nummer`),
*"Kathedraal vóór jaar 15"*. Een tick checkt de nog-niet-behaalde predikaten (zoals
`quests.js` nu al doet) en deelt de beloning één keer uit. Behaalde mijlpalen
bewaren in `localStorage`, zodat de prijzenkast **over meerdere spellen heen** vult
— een sterke reden om nog een dorp te beginnen.

**Risico:** ✅ zolang de beloning Faam/cosmetisch is; ⚠️ als je er grondstoffen aan
koppelt (dan balans valideren).

### 7. Streaks & perfecte momenten 🟢 ✅
`js/core/*` (kleine tellers) · `js/ui/log.js` · `js/ui/audio.js`

Meesterschap voelbaar maken met reeksen: *"3 winters op rij zonder honger"*,
*"vlekkeloze verdediging"*, of een combo als er meerdere gebouwen in dezelfde
seconde afkomen. Elke stap in de reeks een iets hoger toontje en een Faam-bonus.

**Hoe:** een paar platte integers in `state` (bv. `s.hongervrijeJaren`,
opgehoogd in de bestaande seizoenwissel in `seasons.js`; gereset zodra
`s.voedselTekort>0` in `population.js`). Feedback via de bestaande log/toast plus
een oplopende synth-noot. Puur getallen → JSON-veilig.

---

## B · Betekenisvolle keuzes

### 4. Dorpsbeleid — een keuzeboom van edicten 🟡 ⚠️
`js/config/beleid.js` *(nieuw)* · `js/core/beleid.js` *(nieuw)* · `js/ui/panel.js`

Op dit moment is er nauwelijks een strategische identiteit: elk dorp speelt
hetzelfde. **Beleid** geeft je permanente, tegen elkaar afwegende keuzes —
de kern van waarom mensen een builder overspelen.

**Hoe:** bij het stadhuis (of vanaf tijdperk 2) kies je edicten die je met een
langzaam oplopende **Invloed** of met munten koopt. Elk edict is data en werkt via
het bestaande globale-modifier-patroon (`s.bonus.productie` wordt al zo opgeteld in
`herbereken()`):

- *Driehoevenstelsel* — +15% voedsel, −5 tevredenheid.
- *Gildenbrief* — +20% verwerking, maar +onderhoud.
- *Marktrecht* — betere ruilkoersen bij de koopman (idee 9).
- *Stadswacht* — +verdediging, −groei.

Sommige sluiten elkaar uit, zodat je écht kiest. Effecten toepassen in `herbereken()`
en de betrokken ticks. Toon ze in een paneel met een korte omschrijving.

**Risico:** ⚠️ balans. Houd de effecten mild en valideer via `window.spel`
headless dat een vers dorp nog steeds tijdperk 4 zonder honger haalt.

### 9. Handel met vraag & aanbod 🟡 ⚠️
`js/core/handel.js` *(nieuw)* · `js/ui/overlay.js` · marktplaats

Bouwt voort op de "reizende koopman" uit `BOUWPLAN.md` fase II, maar voegt de
diepte toe die er een *puzzel* van maakt: **dynamische prijzen**. Overschot dumpen
levert steeds minder op; schaarste inkopen kost steeds meer.

**Hoe:** een pure prijsfunctie `prijs(res, s)` uit de verhouding tussen je voorraad
`s.res[res]` en je opslagcap. Veel op voorraad → lage verkoopprijs; bijna leeg →
hoge inkoopprijs. Alles data, makkelijk te balanceren, en de bestaande `marktplaats`
en het `handelaar`-beroep passen er thematisch al bij. Koppelbaar aan *Marktrecht*
uit idee 4.

**Risico:** ⚠️ het is een economie-knop; koersen als losse data zodat je snel bij kunt
sturen, en valideren via `window.spel`.

### 6. De levende kalender — feesten met verwachting 🟡 ⚠️
`js/ui/hud.js` · `js/core/seasons.js` · haakt in op `BOUWPLAN.md` fase II

`BOUWPLAN.md` beschrijft feesten en events al. De ontbrekende bindende factor is
**anticipatie**: je moet ze zien aankomen zodat je ernaartoe speelt. Voeg een
compacte **kalenderstrip** in de HUD toe die het eerstvolgende beat toont:
🍂 *Oogstfeest over 4 dagen* · ❄️ *Strenge winter nadert* · 🐴 *Lentemarkt*.

**Hoe:** `seasons.js` telt al dagen/seizoenen/jaren. De strip is een pure aflezing
daarvan plus de geplande events. De feesten/koopman zelf komen uit `BOUWPLAN.md`;
dit idee is de **telegraaf** eromheen — goedkoop, en het verandert losse pop-ups in
een ritme waar je je op voorbereidt (voorraad aanleggen vóór de winter, munten
sparen vóór de markt).

**Risico:** ⚠️ alleen als het aan de feest-events gekoppeld wordt; de strip zelf is ✅.

---

## C · Herspeelbaarheid — bijna gratis, want `rng` is al seeded

### 2. Uitdaging van de dag & deelbare zaden 🟡 ⚠️(klein)
`js/ui/overlay.js` (nieuw-spel-scherm) · `js/core/rng.js` (bestaat) · `js/core/faam.js`

Dit is de goedkoopste grote hefboom in het hele document, omdat `map.genereer(seed)`
en het hele spel **al deterministisch uit een seed** draaien. Er is bijna niets voor
nodig om er een sociale, competitieve laag op te zetten.

**Hoe:**

- **Zaad kiezen/tonen** in het nieuw-spel-scherm. `S.nieuw(seed, naam)` accepteert
  al een seed — alleen de UI ontbreekt.
- **Uitdaging van de dag** = seed afgeleid van de datum (hash van `YYYY-MM-DD`).
  Iedereen speelt vandaag dezelfde kaart.
- **Doel & ranglijst** via Faam (idee 1): *"Hoogste Faam in jaar 10 op zaad X"*.
  Beste score per zaad in `localStorage`.
- **Delen**: het zaad is een kort getal; je stuurt het door en een vriend speelt
  exact jouw kaart. Combineert met de eindkaart (idee 12).

**Risico:** ⚠️ minimaal — puur een UI om een bestaand mechanisme, plus wat
`localStorage`.

### 3. Landzegen & -vloek — elke kaart speelt anders 🟡 ⚠️
`js/config/streken.js` *(nieuw)* · `js/core/economy.js` · `js/core/seasons.js`

Twee dorpen op verschillende zaden voelen nu grotendeels hetzelfde. Rol bij het
begin **1–2 streekeigenschappen** uit de seed die je speelstijl dwingen te
verschuiven — dé motor achter "nog een potje, nu anders".

**Hoe:** een datalijst van modifiers, elk een handjevol platte multipliers:

- *Vruchtbare delta* — boerderijen +25%, maar minder erts.
- *Barre winters* — winter bijt harder (de `seizoen===3`-tak bestaat al in
  `population.js`/`economy.js`).
- *Rijke aders* — mijnen +30%.
- *Kruispunt van wegen* — koopman komt vaker langs.

Bij `S.nieuw()` deterministisch uit de seed gekozen en in `state` bewaard (platte
lijst met id's → JSON-veilig). Effecten lezen in de betrokken ticks, net als de
bestaande `seizoensgevoelig`-vlag. Toon ze bij de start en in de HUD zodat de speler
zijn plan erop aanpast.

**Risico:** ⚠️ balans. Houd modifiers mild en symmetrisch; valideer dat elk profiel
tijdperk 4 haalbaar houdt via `window.spel`.

---

## D · Sappigheid — de synth-motor staat al klaar

### 10. De feedbacklaag uitbreiden (geluid + zwevend cijfer) 🟡 ✅
`js/ui/audio.js` (bestaat) · `js/render/floaters.js` *(nieuw, zie `BOUWPLAN.md` I.4)*

`audio.js` synthetiseert al een oorlogshoorn, een klok en een dreun — puur met de
Web Audio API, geen bestanden, werkt vanaf `file://`, en de aan/uit-voorkeur staat
al in `localStorage`. De motor is er; hij wordt alleen op drie momenten gebruikt.
**Voeg korte, synth-tonen toe op de kleine momenten** — dát is wat een spel
"sappig" laat voelen:

- klik bij plaatsen (`construction.plaats`),
- een heldere *ching* als een gebouw afkomt,
- een muntgeluidje bij handel,
- een zacht *plop* als er een dorpeling bijkomt (`population.groei`),
- een fanfare bij age-up (de klok is er al).

Combineer met **zwevende cijfers** (`+🪵`, `+🥩`) uit `BOUWPLAN.md` I.4 en een
korte, subtiele scherm-puls bij de grote momenten. Alles hangt aan bestaande
gebeurtenissen; niks raakt `state`.

**Waarom het bindt:** game-feel is onzichtbaar maar allesbepalend voor of iets
"lekker speelt". Grote impact, laag risico, motor al aanwezig.

---

## E · Redenen om terug te komen en te delen

### 8. Notabelen — een handvol dorpelingen met een naam en een gezicht 🟡 ✅
`js/ui/notabelen.js` *(nieuw)* · afgeleid uit `s.gebouwen`

`BOUWPLAN.md` fase III (elk poppetje een individu) is bewust een grote verbouwing
van `population.js`. **Dit is de goedkope 80/20-variant:** niet iedereen, maar een
paar *notabelen* die emotie geven zonder de simulatie aan te raken.

**Hoe:** leid uit bestaande gebouwen een handvol personen af — de smid van de
smederij, de pastoor van de kerk, de vroedvrouw, de baljuw van het stadhuis. Naam
deterministisch uit de seed (Nederlandse namenlijst als data), een simpel
portret (emoji of procedureel), en één regel humeur die **echte** `state` afleest:
tevreden bij hoge `tevredenheid`, mokkend bij `voedselTekort`, trots na een
verjaagde rooftocht. Volledig herleidbaar, dus buiten `state` → JSON blijft puur.

**Waarom het bindt:** een naam maakt een verlies persoonlijk en een overwinning
van jóu. Emotionele binding voor een fractie van de kosten van fase III.

### 11. Het spel eindigt niet — doel ná de overwinning 🟡 ⚠️
`js/core/ages.js` (victory-haak bestaat) · `js/config/` · `js/ui/overlay.js`

Nu is `eindDoel` bereiken "gewonnen" en daarna gebeurt er niets meer — precies het
moment waarop een speler stopt. Geef de eindgame een **nieuw doel**, zodat de
sterkste spelers (je ambassadeurs) blijven hangen:

- **Wonderen-race** — unieke, dure wonderen die vooral Faam opleveren; iets om naar
  toe te blijven bouwen.
- **Eindeloze horden (optioneel aan)** — rovers met oplopende `kracht` na de
  overwinning, voor wie de uitdaging zoekt.
- **Nieuwe eeuw / prestige** — je stad "met pensioen" sturen voor een blijvende
  erfenis-bonus in je volgende spel (in `localStorage`). Sluit de lus met idee 1 en 3.

**Hoe:** `ages.bevorder()`/de victory-check toont al een overlay — daar de nieuwe
modus aanhaken. Wonderen zijn gewoon gebouwen in `buildings.js`. Endless is een vlag
die de bestaande `raids.js`-schaling laat doorlopen.

**Risico:** ⚠️ balans voor endless/prestige; de wonderen-race is grotendeels ✅.

### 12. Postkaart van je stad — een deelbare eindkaart 🟢 ✅
`js/ui/overlay.js` · canvas `toDataURL`

De sociale groei-lus: aan het eind (of via het menu) een **postkaart** van je stad
— een uitsnede van het canvas met daaronder je dorpsnaam, tijdperk, inwoners, Faam
en het zaad. Doorsturen = gratis nieuwe spelers, en het zaad (idee 2) laat de
ontvanger jouw kaart spelen.

**Hoe:** het canvas bestaat al; `canvas.toDataURL()` levert een plaatje, met de stats
er als tekst overheen. Let op: vanaf `file://` is een download soms geblokkeerd —
val dan terug op de **kopieerbare tekstkaart**, precies zoals `save.js` de save al
als tekst exporteert. Dus altijd een werkende variant, ook offline.

---

## F · De haak in de eerste tien minuten

### ★ De eerste sessie als een verhaal 🟡 ✅
`js/ui/overlay.js` · `js/config/quests.js` (bestaat) · `js/core/seasons.js`

Waar spelers afhaken is de eerste sessie: te veel systemen, geen richting. De
tutorial-quests bestaan al — geef ze een **verhaallijn met inzet** in plaats van een
lijstje.

**Hoe:**

- Een intro van één scherm: *"Vijf zielen, één boerderij, en de winter komt."*
- Een zichtbare **aftelling naar de eerste winter** in de kalenderstrip (idee 6),
  zodat de eerste tutorialquests (voorraad, voedsel) urgentie krijgen.
- Een triomf-beat als je die eerste winter overleeft — toast, fanfare (idee 10) en
  de eerste mijlpaal (idee 5).

Zo wordt een systeemspel een **verhaaltje dat je afmaakt**, en precies dat brengt de
speler over de drempel naar het echte spel. Hergebruikt bijna alles wat er al is.

---

## Aanbevolen volgorde

De volgorde maximaliseert zichtbaar effect per risico, en respecteert de
afhankelijkheden (veel ideeën hangen hun beloning aan Faam).

1. **Idee 1 — Faam.** De ruggengraat. Klein, afgeleid, en het geeft al het latere
   werk een munt om in uit te betalen.
2. **Idee 10 — feedbacklaag.** Motor staat er al; maakt álles wat je verder doet
   direct lekkerder. Laag risico.
3. **Idee 2 + 3 — zaden & streken.** De grootste herspeelbaarheid voor de minste
   code, want `rng` is al seeded.
4. **Idee 5 + 7 — mijlpalen & streaks.** Meesterschap zichtbaar maken; hergebruikt
   het questpatroon en betaalt in Faam.
5. **Idee ★ + 6 — eerste-sessie-verhaal & kalender.** Houd nieuwe spelers vast en
   geef het midden-spel ritme.
6. **Idee 4 + 9 — beleid & handel.** De strategische diepte; achter balansvalidatie.
7. **Idee 8, 11, 12 — notabelen, eindgame, postkaart.** Binding en de sociale lus,
   als de kern staat.

**Snelste zichtbare winst in één oplevering:** idee **1 + 10 + 2**. Samen geven ze
een cijfer dat stijgt, een spel dat lekker klinkt, en een reden om het opnieuw te
spelen — de kern van "hooked".

---

## Bewaken tijdens het bouwen — de spelregels van deze codebase

Ongewijzigd overgenomen uit `CLAUDE.md`, `BOUWPLAN.md` en `ROADMAP.md`; elke
wijziging blijft hierbinnen.

- **Opslag blijft pure JSON.** Een save is `JSON.stringify(state)`. Geen `Infinity`
  (daarom bestaat `map.ONEINDIG`), functies of klassen in `state`. Faam, notabelen
  en de kalenderstrip zijn **afgeleid** en horen buiten de opgeslagen toestand;
  records en behaalde mijlpalen horen in `localStorage`, net als de geluidsvoorkeur.
- **`file://` moet blijven werken.** Geen bouwstap, geen ES-modules, geen externe
  dependencies. Nieuw bestand = een klassieke IIFE aan `window.Game`, plus één
  `<script>`-regel in `index.html` op de juiste plek in de laadvolgorde. De
  postkaart heeft altijd een tekst-fallback voor als een download geblokkeerd wordt.
- **De voedsel-economie is heilig.** Honger haalt voedselwerkers als *laatste* weg
  (`rang()`), en lage tevredenheid knijpt de productie niet dood (vloer op `0.75`).
  Beleid, streken en handel mogen die vangnetten niet omzeilen.
- **De tick-volgorde staat vast:** `seasons → construction → economy → population →
  raids → quests → ages`. Nieuwe simulatie (beleid, handel, mijlpalen) voegt zich
  hierin; latere stappen lezen wat eerdere schreven. Roep
  `Game.core.state.herbereken(s)` aan na élke wijziging aan gebouwen, werkers of
  globale bonussen.
- **Testen zoals bedoeld.** Elke balanswijziging (⚠️) valideren via `window.spel`
  headless of Playwright: een vers dorp haalt tijdperk 4 zonder hongersnood. Na elke
  config-wijziging checkt `devcheck.js` de console (✅ Speldata gecontroleerd).

Elke fase is los af te ronden en op de branch te zetten, zodat er nooit een
half-werkend spel klaarstaat. 🎣
</content>
</invoke>
