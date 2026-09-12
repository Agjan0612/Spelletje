# 💊 Bouwplan — *Recept tot Zorg*

Een spel over het bouwen en runnen van een **openbare apotheek**, in de geest van
*Project Hospital*: tegelijk architect, manager én vakinhoudelijk apotheker.

- **Werktitel:** Recept tot Zorg *(alternatieven onderaan)*
- **Branch:** `claude/pharmacy-game-design-175sl2`
- **Status:** plan — **er is nog niets gebouwd**
- **Verwant:** hergebruikt de motor en de werkwijze van *Dorp tot Stad* (zie `CLAUDE.md`)

**Vastgelegd (12 sep 2026):** geloofwaardig vakspel · zwaartepunt op de casus ·
submap `apotheek/` in deze repo · objecten plaatsen in een vast pand.
Wat die vier keuzes betekenen staat in §15.

**Legenda moeite:** 🟢 klein · 🟡 middel · 🔴 groot
**Legenda risico:** ✅ los onderdeel · ⚠️ raakt de balans of de speltoestand

---

## 1. Waar gaat het over

Project Hospital werkt omdat het twee spellen tegelijk is die elkaar voeden:

| Laag | Project Hospital | Recept tot Zorg |
|---|---|---|
| **Macro** — architect & manager | afdelingen bouwen, artsen aannemen, geld | pand indelen, assistenten aannemen, marge halen |
| **Micro** — "word een topdokter" | de patiënt met een verborgen diagnose | **het recept met een verborgen probleem** |

Die micro-laag is wat dit spel *dit* spel maakt. Een apotheek is geen winkel maar
een zeef: er komt een voorschrift binnen en de vraag is elke keer opnieuw *klopt
dit voor déze patiënt*. Interactie, dubbelmedicatie, nierfunctie, allergie,
verkeerde sterkte, een middel dat niet leverbaar is, een patiënt die het al
maanden niet ophaalt. Dat afvangen — onder tijdsdruk, met te weinig mensen, terwijl
de wachtrij aan de balie groeit — is het spel.

### De kernlus (30 seconden)

```
recept komt binnen  →  werkvoorraad  →  medicatiebewaking  →  (overleg?)
      →  gereedmaken  →  controle  →  afhaalrek  →  uitgifte mét begeleiding
      →  tevredenheid + omzet
```

Elke pijl is een **station** in het pand, elk station heeft een **wachtrij**, en
elke overdracht kost **loopafstand**. Precies het Project Hospital-gevoel, en het
past op de motor die er al ligt: `logistiek.js` rekent nu al met "hoe ver is het
naar het depot" en `buurt.js` met "wat kan ik van hieraf bereiken".

### Twee klokken die tegen elkaar in tikken

1. **De patiënt** staat te wachten, of verwacht z'n medicijn om 15:00 thuis.
2. **Het recept** heeft een doorlooptijd waarop je wordt afgerekend.

Alles wat kwaliteit kost gaat sneller, alles wat kwaliteit oplevert kost tijd. Daar
zit de hele spanning in, en die hoeft niet uitgelegd te worden — je voelt hem in
de rij.

---

## 2. Ontwerpregels (hier niet van afwijken)

Het grootste risico van dit onderwerp is dat het een **compliance-simulator**
wordt: veel regels, weinig spel. Vier regels om dat te voorkomen.

1. **Elke regel is een zichtbare keuze.** Een voorschrift dat de speler niet kan
   beïnvloeden is geen spelregel maar belasting. Als het niet op het scherm als
   knop of afweging bestaat, hoort het er niet in.
2. **Fouten zijn zichtbaar en herstelbaar.** De mooiste momenten zijn de
   *bijna*-fouten: de controle die de verkeerde sterkte tegenhoudt. Dat moet het
   spel je laten zíen ("je tweede paar ogen heeft zich net terugverdiend"), anders
   voelt de controletafel als een tijdverspiller.
3. **Minder klikken, meer beslissen.** Net als `arbeid.js` in Dorp tot Stad: je
   handelt de eerste uren zelf recepten af, daarna stel je **protocollen** in
   ("klasse C automatisch akkoord, klasse A altijd naar de apotheker") en word je
   van uitvoerder beleidsmaker. Zonder die overgang loopt het spel na een half uur
   vast in muisarm.
4. **Realisme in dienst van de spanning.** Waar vakinhoud en plezier botsen wint
   plezier — maar vrijwel nergens botsen ze: TIB, nee-verkoop, preferentiebeleid en
   leveringstekorten zijn *van zichzelf* al spelmechanieken.

---

## 3. De micro-laag: de receptkaart

Het hart. Klik op een recept in de werkvoorraad en er opent een kaart:

- **Kop:** patiënt, leeftijd, nierfunctie, allergieën, therapietrouw — met
  duidelijk zichtbaar wat je *niet* weet (grijs = geen dossier, geen LSP-toestemming,
  geen labwaarde).
- **Voorschrift:** de regels, met sterkte, hoeveelheid, gebruik.
- **Signalen:** wat de bewaking eruit haalt. Sommige zie je meteen, sommige
  **alleen als je de gegevens hebt** — de "triple whammy" (NSAID + RAS-remmer +
  diureticum) is pas een signaal als je de nierfunctie kent. Dat maakt informatie
  een grondstof.
- **Acties**, elk met een prijs in tijd en in wie hem uitvoert:
  `afhandelen` · `overleg huisarts` (kost minuten, kan het recept veranderen) ·
  `patiënt bellen` · `substitueren` (kies een alternatief) · `lab/LSP opvragen` ·
  `escaleren naar de apotheker` · `uitstellen`.

De **apotheker is een schaarse rol**, geen tweede assistent. Alles wat naar hem toe
gaat komt in één rij, en die rij is de rem op het hele systeem. Dat is de reden dat
protocollen ertoe doen.

### Signalenbibliotheek

Eén configbestand (`js/config/signalen.js`), precies zoals `gebeurtenissen.js` nu
werkt: één object per signaal, en het spel kent het. Uitbreidbaar tot in het
oneindige zonder dat er code bij hoeft — en de eigenaar van deze repo is
apotheker, dus dat is waar de inhoudelijke diepte gratis vandaan komt.

| veld | betekenis |
|---|---|
| `klasse` | A (harde stop) · B (overleg gewenst) · C (informeren) |
| `nodig` | welke gegevens zichtbaar moeten zijn voordat het signaal opduikt |
| `acties` | welke acties zijn toegestaan, met tijd en uitkomst per actie |
| `gevolg` | wat er gebeurt als je het negeert — nu, of over drie weken |

Dat laatste is belangrijk: **niet elke fout slaat meteen terug.** Een gemiste
interactie die er over drie in-game weken uitkomt als een ziekenhuisopname is
dramatischer én eerlijker dan een directe strafpunt.

---

## 4. De macro-laag: het pand

### Ruimtes en objecten

| Zone | Wat er staat |
|---|---|
| **Publiek** | balie · zelfzorgschap (vrije marge!) · wachtbank · nummerdisplay · privacyzuil · afhaalautomaat (24/7) · inleverbak oude medicijnen |
| **Werkvloer** | bewakingswerkplek (PC) · verzamellades · controletafel · koelkast (2–8 °C) · opiumkluis · verzamelrobot · baxter-/weekdoseerwerkplek |
| **Zorg** | spreekkamer (medicatiebeoordeling, reisadvies, bloeddruk) · kantoor apotheker |
| **Logistiek** | magazijn · ontvangstplek groothandel · bezorgplek · LNA-bereidingsruimte |
| **Mensen** | koffiekamer — personeel herstelt energie; het equivalent van `tevredenheid` maar dan voor je team |

Het pand **ligt er al** — je tekent geen muren, je richt in. Je begint met een
klein overgenomen pandje en koopt er later ruimte bij (de leegstaande winkel
ernaast, de zolder, de kelder): een uitbreiding is één knop die een stuk grid
vrijgeeft. Dat scheelt een compleet bouwgereedschap met muren, deuren en
ruimtebenoeming, en het sluit aan op `construction.js`, dat plaatsen, verplaatsen,
slopen en een bouwwachtrij al kan. De indeling blijft een puzzel omdat de
loopafstanden dat afdwingen; de vrijheid zit in *waar wat staat*, niet in de
plattegrond.

Elk object heeft **capaciteit, bemanning en een wachtrij**. Een tweede
bewakingswerkplek is pas nuttig als je iemand hebt om erachter te zetten — dat is
de klassieke tycoon-afweging en die werkt hier meteen.

### Loopafstand is het echte bouwprobleem

De balie ver van het verzamelrek zetten is geen esthetische fout maar een
throughput-fout. `logistiek.js` doet dit sommetje al voor karren; hier wordt het
"hoeveel stappen tussen twee stations". Een **looplijnen-overlay** (net als de
huidige aanvoer-laag, die exact dezelfde functie bevraagt als de simulatie) laat
de speler dat zien in plaats van het te laten raden.

---

## 5. De onderneming

### Geld — smalle marges, en dat is het punt

**Binnen:** terhandstellingsvergoeding per receptregel (tarief per verzekeraar, één
keer per jaar onderhandelen) · inkoopmarge (uitgehold door preferentiebeleid) ·
zelfzorgverkoop (échte marge) · betaalde zorgprestaties (medicatiebeoordeling,
weekdosering, reisadvies, stoppen-met-roken) · ANW-toeslag.

**Buiten:** loon (verreweg de grootste post) · huur · groothandel · derving door
vervaldatum · **TIB** · afschrijving robot · ICT.

De vergoeding per receptregel is min of meer vast. Dat betekent: je verdient niet
door duurder te worden maar door **beter te draaien** — meer regels per uur,
minder derving, minder nee-verkoop, meer betaalde zorg. Dat is een veel
interessanter tycoon-model dan een prijsschuifje.

### Voorraad & servicegraad

Bestelniveau per artikel, één levering per dag, en **misgrijpen** als de harde
maat. Nee-verkoop kost tijd (patiënt terug laten komen), tevredenheid en soms de
patiënt zelf. Te ruim inkopen kost geld en derving. Dit subsysteem is één-op-één
het dagelijkse werk van een apotheker en heeft nul uitleg nodig om leuk te zijn.

### Personeel

Apotheker (schaars) · apothekersassistent (de motor; vaardigheden per taak) ·
farmaceutisch consulent · bezorger · logistiek medewerker · leerling (goedkoop,
traag, maakt fouten, groeit — en een opleidingsapotheek krijgt er iets voor terug).

Met **rooster** (de ochtendpiek bemannen kost meer dan de middagdip),
**vermoeidheid** die de foutkans opdrijft, en scholing. De krappe arbeidsmarkt voor
assistenten is een gratis, herkenbare schaarste.

### Drie reputaties, niet één

| bij wie | verdien je met | levert op |
|---|---|---|
| **Patiënten** | korte wachttijd, privacy, goede begeleiding | groei van je patiëntenpopulatie |
| **Huisartsen** | goed overleg, weinig onnodig gebel, FTO | meer receptregels jouw kant op |
| **Verzekeraar / inspectie** | lage foutmarge, dossier op orde | contracttarief, geen verscherpt toezicht |

Drie los bewegende getallen maken de afwegingen echt: een twijfelachtig recept
weigeren is goed voor de inspectie, slecht voor de huisarts en slecht voor de
patiënt die voor niets kwam.

---

## 6. Ritme: de dag, de week, het jaar

- **Dag:** openingstijden met een ochtendpiek, een middagdip en de vloedgolf
  huisartsrecepten rond 16:00. Buiten openingstijd: levering uitpakken,
  herhaalservice draaien, baxterrollen klaarmaken. Het dag/nacht-licht uit
  `sfeer.js` doet dit visueel al.
- **Week:** maandag na het weekend is zwaar, vrijdagmiddag ook.
- **Jaar:** griepseizoen (vaccinatiecampagne + meer regels), hooikoorts,
  feestdagen (dicht — en de dag ervoor stormloop), zomer (vakantie- en reisrecepten,
  halve bezetting). De bestaande `seasons.js` levert het skelet.

### Gebeurtenissen

Griepgolf · **leveringstekort** · IGJ-bezoek · AIS-storing · koelkast defect ·
ziekmelding · inbraak · huisarts met pensioen (opvolger schrijft anders voor) ·
contractronde zorgverzekeraar · klacht/incident · nieuwe richtlijn ·
weekdoseringscontract van een verzorgingshuis · een lovend stukje in de krant.

Het **tekort** verdient een eigen mechaniek in plaats van een simpele malus, omdat
het de leukste puzzel van het echte vak is: zelfde stof/andere fabrikant zoeken →
andere sterkte omrekenen → overleg met de huisarts over een andere stof → zelf
bereiden (LNA). Vier oplossingen met oplopende kosten en oplopende bevrediging.

---

## 7. Voortgang & einde

**Groeifasen** (het equivalent van de tijdperken):

1. **Startende apotheek** — overgenomen pandje, één balie, twee assistenten
2. **Buurtapotheek** — tweede balie, herhaalservice, bezorging
3. **Wijkapotheek** — spreekkamer, weekdosering, robot
4. **Zorgapotheek** — FTO met de huisartsen, medicatiebeoordelingen, eigen bereiding
5. **Opleidingsapotheek** — je leidt zelf assistenten op

**Winst:** "Apotheek van het Jaar" — een drempel op servicegraad, doorlooptijd,
foutmarge, patiënttevredenheid én een gezonde balans tegelijk. Niet één getal, want
één getal betekent één strategie.

**Daarna gaat het door**, precies zoals `faam.js` nu doet: de beroepsgroep en de
verzekeraar blijven om dingen vragen, dus de apotheek die je gebouwd hebt houdt een
reden om te draaien.

**Verliezen** bestaat ook: failliet, of het contract kwijt na een ernstig incident.
Net als `ages.controleerEinde` — een echt einde met een echt scherm, en de
mogelijkheid om twintig seconden terug te gaan.

---

## 8. Wat we hergebruiken uit Dorp tot Stad

Dit is de reden dat dit plan realistisch is. De motor bestaat al:

| Bestaat al | Wordt |
|---|---|
| iso-camera, `wereldNaarScherm`, diamanttegels | het pand van bovenaf, zelfde projectie |
| `beweging.js` (koers, snelheid, `bezig`-toestanden) | assistenten die lopen, werken, praten, pauzeren |
| `construction.js` (plaatsen/verplaatsen/slopen/wachtrij) | inrichten van het pand |
| `logistiek.js` (afstand → factor) | loopafstand tussen stations |
| `buurt.js` (`dienstenOp`, bereik) | wat een werkplek vanaf hier kan bereiken |
| `lagen.js` (kaartlagen) | overlays: wachttijd, drukte, looplijnen, privacy, koeling |
| `historie.js` + `grafiek.js` | doorlooptijd, wachttijd, servicegraad, omzet in de tijd |
| `save.js` (3 boeken + register) | ongewijzigd |
| `devcheck.js` | idem: een signaal dat naar een onbekend artikel wijst faalt de build |
| `scenarios.js` | scenario's, zie hieronder |
| `tools/simuleer.js` | **de balanstest — cruciaal, zie §10** |
| `kolom.js`, `tip.js`, `handtekening()`-diffing | dezelfde UI-discipline |

Wat vervalt: kaartgeneratie, rivieren, seizoensoogst, rovers, standen, demografie.
Wat nieuw is: de casusmotor, de stationswachtrijen, voorraad en personeel.

**Ruwe schatting:** ~40 % van de bestaande ~16.000 regels is bruikbaar als patroon
of als code.

---

## 9. Technisch plan

Zelfde architectuur als Dorp tot Stad, want die is bewezen en de conventies staan
al in `CLAUDE.md`: IIFE-modules op één globale namespace, **één serialiseerbare
staat**, afgeleide waarden altijd hérberekenen, vaste tijdstap, Nederlandse
domeintaal en Engelse commentaren.

### Mappen

```
apotheek/
  index.html
  src/            legacy.js (laadvolgorde) · main.js · render/pixi-renderer.js
  js/config/      objecten · rollen · artikelen · signalen · recepttypen
                  gebeurtenissen · zorgprestaties · fases · doelen · scenarios
  js/core/        klok · pand · bouw · toeloop · recept · bewaking · werkvloer
                  personeel · rooster · voorraad · bestellen · geld · reputatie
                  patienten · protocollen · opleiding · gebeurtenissen
                  historie · fase · state · save · rng · loopafstand
  js/ui/          hud · werkvoorraad · receptkaart · bouwmenu · panel
                  personeel · voorraad · financien · lagen · grafiek · overlay
  js/render/      camera · sprites · beweging · lagen · sfeer   (gekopieerd, uitgekleed)
  tools/simuleer-apotheek.js
```

### Tickvolgorde (op één plek, net als nu)

```
klok(openingstijden) → toeloop(recepten & patiënten) → werkvloer(stations, wachtrijen)
  → personeel(lopen, werken, vermoeidheid) → afhandeling(casussen) → uitgifte
  → voorraad(bestellen, levering, derving) → geld → gebeurtenissen → reputatie
  → opleiding → protocollen(automatisch) → historie → doelen → fase / einde
```

### Staat (alles puur JSON)

```js
s = {
  tijd, dag, geopend, snelheid, fase,
  pand:       { breedte, hoogte, tegels[] },
  objecten:   [ { id, type, x, y, staat, bemanning[] } ],
  personeel:  [ { id, naam, rol, vaardigheden{}, energie, dienst, taak, x, y } ],
  patienten:  { bekend: [...], populatie: { aantal, samenstelling } },
  recepten:   [ { id, patient, regels[], signalen[], fase, station, klok } ],
  voorraad:   { [artikel]: { aantal, besteld, houdbaar, tekort } },
  geld, omzet{}, kosten{},
  reputatie:  { patient, huisarts, verzekeraar },
  protocollen{}, gebeurtenis, contract, doelen[], historie[]
}
```

**Twee grenzen die bewaakt moeten worden**, anders groeit een save eindeloos:
een afgehandeld recept verlaat de lijst en leeft verder als *telling* in de
historie; en `patienten.bekend` wordt gesnoeid zoals `dorpelingen.js` dat nu doet —
alleen wie langsgeweest is bestaat als individu, de rest is een aggregaat.

Verwacht aantal levende figuren: 30–120. Ruim binnen wat de Pixi-laag aankan.

---

## 10. ⚠️ Het balansrisico, en het is een ander dan bij Dorp tot Stad

Dorp tot Stad is een **voorraadspel**: te weinig eten is erg maar het schuift
geleidelijk. Dit wordt een **wachtrijnetwerk**, en die hebben een *klif*. Een
station dat 10 % te weinig capaciteit heeft, geeft geen 10 % langere wachtrij maar
een wachtrij die de hele dag blijft groeien. Tussen "prima apotheek" en "totale
chaos" zit soms één assistent.

Daaruit volgt één harde planregel:

> **De headless simulator komt vroeg — direct na het datamodel, niet aan het eind.**

`tools/simuleer-apotheek.js` in de geest van de bestaande harness: bare Node, geen
browser, een vaste middelmatige bot die een maand apotheek draait over meerdere
zaden, en dan de **mediaan** rapporteert van doorlooptijd, wachttijd, misgrijpen,
foutmarge en saldo. Zonder dat instrument is dit spel niet in te stellen — met de
hand meten leest ruis, precies zoals in `CLAUDE.md` al beschreven staat.

Concreet te bewaken: bezetting per station moet in normaal spel rond de **75–85 %**
uitkomen. Boven de 90 % ontploft de rij, onder de 60 % verveelt de speler zich.

---

## 11. Fasering

Elke fase is los speelbaar en los te testen. De volgorde is bewust: eerst iets dat
draait, dan diepte, dan breedte.

| Fase | Wat | Omvang | Speelbaar? |
|---|---|---|---|
| **0 · Skelet** | pand-grid, 3 objecten, 2 assistenten, recepten stromen binnen, één signaaltype, uitgifte, wachttijd, geld | 🟡 | ja — de kernlus draait |
| **0b · Meetlat** | `simuleer-apotheek.js` + eerste balans | 🟡 ⚠️ | n.v.t. — maar onmisbaar |
| **1 · De casus** | receptkaart, signalenbibliotheek, dossier & ontbrekende gegevens, overleg, de apotheker als flessenhals, fouten & bijna-fouten, protocollen | 🔴 ⚠️ | dit is het spel |
| **2 · Het pand** | volledige objectcatalogus, bouwmenu, loopafstand, overlays, koelkast/kluis/robot, spreekkamer, ruimte bijkopen | 🟡 | tycoon-laag erbij |
| **3 · De onderneming** | voorraad, groothandel, servicegraad, TIB, volledig geldmodel, personeel + rooster + opleiding, drie reputaties | 🔴 ⚠️ | het wordt een bedrijf |
| **4 · De wereld** | gebeurtenissen, tekortenmechaniek, huisartsen & FTO, verzekeraarscontract, seizoenen, inspectie | 🟡 ⚠️ | het wordt onvoorspelbaar |
| **5 · Vorm** | groeifasen, doelen, scenario's, statistieken, kroniek, geluid, uitleg voor nieuwe spelers | 🟡 | het wordt af |
| **6 · Optioneel** | casusmodus (alleen recepten beoordelen, zonder bouwen), tweede vestiging, dienstapotheek | 🟡 | zie §12 |

### Fase 0 in detail — de kleinste versie die al leuk is

Eén ruimte, drie objecten (balie · bewakingswerkplek · verzamellade), twee
assistenten die er tussen lopen. Recepten druppelen binnen met één soort signaal
("interactie — akkoord of overleg?"). Je kunt te langzaam zijn en dan loopt de
wachtkamer vol. Meer niet. Als dát al spanning geeft, klopt het fundament en is de
rest aankleding. Zo niet, dan hebben we dat geleerd voor de prijs van één fase in
plaats van zes.

---

## 12. Scenario's — de goedkoopste herspeelbaarheid, en misschien meer dan dat

Net als `scenarios.js` nu: één object met een startsituatie, een paar regels en een
doel. Kandidaten:

- **Overname** — een verwaarloosde apotheek: rommelig pand, boze patiënten, wanorde in de voorraad
- **Griepgolf** — houd de doorlooptijd onder de norm bij het dubbele aanbod
- **Tekortenwinter** — de halve lijst is niet leverbaar
- **De buurapotheek sluit** — je populatie verdubbelt volgende week
- **Baxter voor het verzorgingshuis** — 80 rollen per week erbij, kun je dat aan?
- **Inspectie over 30 dagen** — krijg het dossier op orde zonder de winkel plat te leggen

Deze zijn ook de brug naar een mogelijke **oefenmodus voor het team**: dezelfde
casusmotor, zonder pand, met een stapel recepten die beoordeeld moet worden. Dat is
na fase 1 vrijwel gratis — maar het is een andere keuze dan "een spel maken", dus
zie de vragen hieronder.

---

## 13. Risico's

| Risico | Tegenmaatregel |
|---|---|
| Wordt een compliance-simulator | ontwerpregel 1: geen regel zonder zichtbare keuze |
| Wachtrijklif maakt de balans onmogelijk | simulator in fase 0b, vóór de inhoud |
| Muisarm door recept na recept | protocollen in fase 1, niet later |
| Te veel vakjargon voor niet-apothekers | elk signaal heeft één zin uitleg in gewone taal in de tip |
| Twee spellen in één repo lopen elkaar in de weg | apart pand: eigen map, eigen entry, gekopieerde render-laag |
| Scope | fase 0 is expres af te maken en op zichzelf leuk |

---

## 14. Naam

| Titel | Toon |
|---|---|
| **Recept tot Zorg** | rijmt op *Dorp tot Stad*, dekt de lading |
| **Aan de Balie** | warm, herkenbaar |
| **De Apotheek** | rustig, klassiek |
| **Zonder Recept Niet Verkrijgbaar** | knipoog |
| **Werkvoorraad** | vakjargon als grap — alleen leuk voor collega's |

---

## 15. Vastgelegde keuzes

De vier vragen uit de eerste versie van dit plan zijn beantwoord. Ze staan hier
met hun gevolg, zodat later duidelijk is waarom het spel zo in elkaar zit.

### 1. Het wordt een geloofwaardig vakspel

Een echt spel, maar de vakinhoud klopt. Een collega herkent z'n werk, een
buitenstaander kan het spelen zonder apotheker te zijn.

**Gevolg:** de signalen, de tekorten, de tarieven en de servicegraad worden
gemodelleerd zoals ze werkelijk werken, niet als abstracte getallen. Elk signaal
krijgt naast z'n vakinhoudelijke naam **één zin in gewone taal** in de tooltip —
dat is wat het speelbaar houdt voor wie het vak niet kent, en het is de goedkoopste
verzekering tegen jargon-overdaad. De configbestanden (`signalen.js`,
`artikelen.js`, `zorgprestaties.js`) worden bewust zo opgezet dat de inhoud
uitgebreid kan worden zonder één regel code — dat is waar de diepte vandaan komt.

### 2. Het zwaartepunt ligt op de casus

Het recept met een verborgen probleem is het hart; het pand is de context eromheen.

**Gevolg:** fase 1 is de grootste en belangrijkste fase, en de bouwlaag mag
eenvoudiger blijven dan in Project Hospital. Als er ergens geschrapt moet worden,
wordt er in de tycoon-laag geschrapt en niet in de casuslaag. De apotheker als
schaarse flessenhals, de ontbrekende gegevens en de protocollen zijn geen extra's
maar de kern.

### 3. Het komt in een submap van deze repo

`apotheek/` naast het bestaande spel, met een eigen entry en een eigen bundel.

**Gevolg:** de renderlaag (camera, beweging, sfeer, lagen) wordt **gekopieerd en
uitgekleed**, niet gedeeld. Dat is bewust: een gedeelde motor uittrekken zou eerst
*Dorp tot Stad* verbouwen voordat het nieuwe spel iets doet, en die verbouwing
levert pas iets op als beide spellen af zijn. Kopiëren betekent dat er twee
versies van `camera.js` bestaan die uit elkaar kunnen groeien — dat is hier de
goedkopere fout. Het bestaande spel kan hierdoor niet breken.

Praktisch: `vite.config.mjs` krijgt een tweede ingang, en de Pages-workflow
publiceert straks beide spellen onder één `dist/` (`/Spelletje/` en
`/Spelletje/apotheek/`). Dat wordt bij fase 0 meteen goed gezet, want achteraf
paden verbouwen is precies het soort werk dat niemand leuk vindt.

### 4. Je richt een vast pand in

Geen muren tekenen, wel objecten plaatsen — en later ruimte bijkopen.

**Gevolg:** zie §4. Dit scheelt naar schatting een halve fase aan bouwgereedschap
en het maakt de looproutes eenvoudig te berekenen (geen deuren, geen onbereikbare
hoeken), wat de wachtrij-balans uit §10 een stuk voorspelbaarder maakt. Mocht vrij
bouwen later toch gemist worden, dan is het een uitbreiding en geen verbouwing:
de objecten en de loopafstandsfunctie veranderen er niet van.

---

## 16. Wat er nu klaarstaat

Dit document is het plan; er is nog geen regel code geschreven. De eerstvolgende
stap is **fase 0 uit §11**: het skelet met drie objecten, twee assistenten en één
soort signaal — de kleinste versie die al spanning geeft. Daarna meteen §10, de
meetlat, voordat er inhoud bij komt.
