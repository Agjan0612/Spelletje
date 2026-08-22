# 🏰 Dorp tot Stad

Een middeleeuwse city builder in de browser. Je begint met een boerderij, een huisje
en vijf dorpelingen in de wildernis, en bouwt dat uit tot een volwaardige middeleeuwse
stad met kathedraal, kasteel en universiteit.

Geen installatie, geen internet nodig, geen account. Gewoon spelen.

---

## Spelen op je eigen computer

**Dubbelklik op `index.html`.** Dat is alles — het spel opent in je browser.

Houd `index.html`, de map `css/` en de map `js/` wel bij elkaar in dezelfde map. Verplaats
je alleen `index.html`, dan blijft het scherm zwart: hij zoekt die twee mappen naast zich.

Gebruik Chrome, Edge of Firefox. Safari is strenger met opslaan in de browser, dus daar kan
het bewaren van je dorp mislukken.

## Online spelen (ook op telefoon en tablet)

Het spel staat op **https://agjan0612.github.io/Spelletje/** zodra GitHub Pages aanstaat.
Dat is eenmalig instellen:

1. Ga in deze repository naar **Settings** → **Pages**
2. Bij *Source*: kies **Deploy from a branch**
3. Kies branch **`main`** en map **`/ (root)`**, en klik op **Save**

Na een minuut of twee staat het spel live. Die link kun je gewoon delen; iedereen die hem
opent speelt zijn eigen dorp, want alles wordt lokaal in de browser opgeslagen.

---

## Wat is het idee?

Je verzamelt zes grondstoffen uit het land — 🥩 vlees, 🪵 hout, 🪨 steen, ⛓️ ijzer,
🟠 koper en 💎 edelstenen — en verwerkt die tot 🌾 graan, 🍞 brood, 🔨 gereedschap,
🐑 wol, 🧥 kleding, 🌿 hop, 🍺 bier en 🪙 munten. Daarmee klim je door vier tijdperken:

| Tijdperk | Wat je krijgt |
|---|---|
| 1 · **Nederzetting** | Boerderij, huisjes, houthakker, jacht, visserij, steengroeve, waterput, **straatjes**, **graanschuur** |
| 2 · **Dorp** | Molen, bakkerij, marktplaats, kapel, koper- en ijzermijn, wachttoren, **haven**, **oefenveld**, **schaapskooi**, **hopveld** |
| 3 · **Handelsstad** | Smederij, wapensmid, kazerne, muren, **stadspoort**, kerk, herberg, edelsteenmijn, gildehuis, **school**, **weverij**, **brouwerij**, **schatkamer** |
| 4 · **Middeleeuwse stad** | Stadhuis, herenhuizen, juwelier, handelshuis, universiteit, kathedraal, kasteel |

Rechtsboven staat precies wat je nog nodig hebt voor het volgende tijdperk. Een
**adviseur** in de doelenkolom wijst je steeds op de handigste volgende stap. Je stad is
"af" zodra je 100 inwoners hebt, 70% tevredenheid, en de kathedraal, het kasteel, de
universiteit en het stadhuis staan. Daarna kun je gewoon doorbouwen.

### Opslag, bederf en belasting

- 📦 **Drie soorten opslag.** Voedsel, goederen en schatten hebben elk hun eigen
  ruimte. Een **graanschuur** is voor eten, een **pakhuis** voor goederen, een
  **schatkamer** voor munten en edelstenen. De voorraadschuur en het dorpsplein
  bergen alles een beetje.
- 🪰 **Voedsel bederft**, het snelst in de zomer. Een graanschuur houdt het
  grootste deel tegen. Zonder schuur lekt je oogst weg vóór de winter waar hij
  voor bedoeld was.
- 💰 **Belastingtarief.** Op het dorpsplein zet je hoe hard de heer knijpt:
  mild (halve opbrengst, blijer volk), gewoon, of streng (bijna dubbel, maar je
  stad merkt het). De enige knop die je continu blijft afwegen.

### Twee echte productieketens

| Keten | Gebouwen | Waarvoor |
|---|---|---|
| 🐑 wol → 🧥 kleding | Schaapskooi (t2) → Weverij (t3) | Burgers én poorters dragen kleding |
| 🌿 hop → 🍺 bier | Hopveld (t2) → Brouwerij (t3) | Poorters drinken bier, en je herberg schenkt het |

Dit is geen decoratie: standen **verbruiken** deze waren. Raakt je kleding op,
dan zijn je burgers ontevreden en betalen ze nog maar een derde belasting. En
zonder brouwerij staat je herberg gewoon droog.

### Standen: van boeren naar poorters

Elk huis herbergt een **stand**, en die bepaalt wat de bewoners vragen én wat ze
opbrengen aan belasting:

| Stand | Woont in | Vraagt | Betaalt |
|---|---|---|---|
| 🌾 **Boeren** | Huisje | Niets bijzonders | Weinig |
| 🏘️ **Burgers** | Vakwerkhuis | 2 soorten voedsel, redelijk wat voorzieningen | Ruim 3× zoveel |
| 🎩 **Poorters** | Herenhuis | 3 soorten voedsel, véél voorzieningen | Ruim 7× zoveel |

Krijgt een stand niet wat hij vraagt, dan betaalt hij nog maar een derde en gaat er
mopperen. Zo wordt het uitbouwen van je huizen een echte afweging in plaats van een
knop die je altijd indrukt — en zo worden munten iets dat meegroeit met hoe *goed*
je stad gebouwd is.

**Ervaring.** Een werkplaats die dezelfde ploeg houdt, wordt er steeds beter in: tot
25% meer opbrengst. Haal je er werkers vanaf, dan gaat een kwart van die ervaring
verloren. Voortdurend mensen heen en weer schuiven kost je dus iets.

### Je dorp als geheel

- **Een leger dat rovers verslaat.** Soldaten uit het oefenveld, de kazerne en het kasteel
  vormen samen een leger. Is dat sterk genoeg, dan versla je een roversbende beslissend
  (met buit en een moreelboost) in plaats van ze alleen tegen te houden. Tijdens de
  waarschuwing kun je een **uitval** bevelen om ze in het open veld te verpletteren —
  meer risico, meer beloning. Elke verslagen bende maakt de volgende rovers voorzichtiger.
- **Een haven aan zee.** Drijft handel over water (munten) en laat vissershutten in de
  buurt meer vangen.
- **Samenhorigheid.** Bouw dicht om het dorpsplein in plaats van verspreid over de kaart:
  een hecht dorp is een gelukkiger dorp.
- **Voorzieningen tellen waar ze staan.** Een waterput, kapel, herberg of markt helpt
  alleen de huizen die er te voet bij kunnen. Twee dorpen met precies dezelfde gebouwen
  kunnen dus tientallen procenten in tevredenheid schelen — het gaat om je stratenplan.
  Op het dorpsplein zie je hoeveel procent van je huizen goed bediend wordt.
- **Aantrekkelijkheid.** Een fontein, kerk of kathedraal maakt de buurt prettig; een
  smederij, mijn of steengroeve maakt hem grauw. Huisjes groeien alléén uit tot
  vakwerkhuis in een nette buurt, en een herenhuis wil helemaal niet in de rook staan.
  Zet je nijverheid dus aan de rand.
- **Aanvoer.** Wat een werkplaats maakt moet naar je opslag gebracht worden. Ver van elk
  depot gaat de halve dag op aan lopen — bouw een voorraadschuur dichterbij, of leg een
  **straatje**: een geplaveide route scheelt bijna de helft van de afstand. Shift-slepen
  legt een hele straat; klik op een bestaand straatje om het weer op te breken.
- **Feesten.** Via de kaart **"Het dorp"** (rechts) vier je een feest — kost graan en
  munten en tilt het humeur van de hele gemeenschap tijdelijk op.
- **Een reizende koopman** komt af en toe langs met ruilaanbiedingen, en de **heer** stuurt
  af en toe een leveropdracht met een beloning. Beide regel je op diezelfde "Het dorp"-kaart.
- **Het Dorpsboek** houdt je inwoners bij met naam en beroep, zodat je dorp echt bevolkt voelt.
  Af en toe vraagt een van hen bij naam om iets — meestal een put of kapel in een buurt die
  vergeten is. Geef je het, dan is het hele dorp er blij mee.

---

## Besturing

| Actie | Hoe |
|---|---|
| Over de kaart bewegen | Slepen met de muis, of **W A S D** / pijltjestoetsen |
| In- en uitzoomen | Scrollen, of **+** en **−** |
| Gebouw plaatsen | Klik een gebouw in de balk onderin, klik daarna op de kaart |
| Plaatsen stoppen | **Escape** of rechtermuisknop |
| Gebouw bekijken | Klik erop — links verschijnt het paneel met werkers en opbrengst |
| Werkers toewijzen | De **+** en **−** knoppen in dat paneel |
| Gebouw kiezen met het toetsenbord | **Shift + 1…9** (het zoveelste gebouw in het open tabblad) |
| Een hele rij neerzetten | **Shift + slepen** over de kaart (muren, straatjes) |
| Gebouw verplaatsen | Klik het aan → **✋ Verplaatsen** (kost een vijfde van de bouwkosten) |
| Laatste plaatsing terugdraaien | **Ctrl+Z** |
| Gebouw uitbouwen | Klik het aan → **⬆️ Uitbouwen** (vanaf tijdperk 3) |
| Pauzeren | **Spatie** |
| Snelheid | **1** = normaal, **2** = snel, **3** = zeer snel |
| Kaartlagen aan/uit | **L**, of de knoppen onderin het beeld |
| Feest, onderzoek, overzicht | De **🎉 📚 📋** knoppen rechtsboven |
| Menu, opslaan, uitleg | De **☰** knop rechtsboven |

Op een tablet werkt het ook: één vinger sleept, tikken selecteert of plaatst.

---

## De vijf dingen die er echt toe doen

1. **Voedsel.** Elke inwoner eet. Graan komt van de boerderij, vlees van jagers en
   vissers, brood van de bakkerij. Meerdere soorten tegelijk maakt mensen blijer dan
   één soort. Je dorp groeit pas als er minstens drie dagen voorraad ligt — zo eet je
   jezelf nooit een hongersnood in.

2. **Woonruimte.** Nieuwe dorpelingen komen alleen als er een bed vrij is. Geen huizen,
   geen groei. Een deel van de nieuwkomers zijn **kinderen**: die eten wel, maar werken
   pas over een jaar of anderhalf. Een school maakt ze eerder inzetbaar. Aan de andere
   kant van het leven worden volwassenen **ouderen**: die werken door, maar krijgen
   minder gedaan, en op een dag sterven ze. Een stad die geen mensen meer aantrekt,
   vergrijst en krimpt langzaam.

3. **Tevredenheid.** Waterput, kapel, kerk, herberg en marktplaats tillen het humeur op —
   maar **alleen voor de huizen die er te voet bij kunnen**. Bouw je voorzieningen dus
   midden tussen je huizen, niet in een verre hoek. Hoe groter je stad, hoe meer buurten
   je moet bedienen. Druk op **L** voor de kaartlaag *Voorzieningen*: groen betekent goed
   bediend, rood betekent vergeten. Beweeg met de muis over het 😀-icoon bovenin om te
   zien waar je punten vandaan komen.

4. **De winter.** Dit is het seizoen waar je je hele jaar op voorbereidt:
   - Boerderijen leveren **níets** en er wordt meer gegeten.
   - Je dorpelingen **stoken hout** om niet te bevriezen. Geen hout betekent een
     kelderend humeur en uiteindelijk doden. Hout is dus geen beginnersgrondstof
     maar een blijvende zorg.
   - Het water **bevriest**: vissershutten vangen nog maar 40% — tenzij er een
     **haven** binnen acht tegels ligt die een geul openhoudt.
   - Mijnen en groeven werken gewoon door.

   Leg in de herfst dus voorraad aan: eten én brandhout.

5. **Rovers.** Vanaf tijdperk 2 komen er bandieten langs, aangevoerd door een hoofdman
   met een naam die onthoudt wat je vorige keer deed. Je krijgt 45 seconden
   waarschuwing, en die seconden zijn nu het spannendste moment van het spel: de bende
   **marcheert** over de kaart naar je stad, en elke wachttoren, muur en poort die ze
   passeren schiet ze uitdunner. Een toren die niet op hun route staat, doet niets —
   dus zet ze op de weg die ze nemen (kaartlaag *Verdediging*). Ondertussen kies je uit
   vier dingen:

   | Keuze | Wat het doet | Wat het kost |
   |---|---|---|
   | ⚔️ **Uitval** | Win je in het veld, dan is de bende vernietigd | Verlies je, dan sta je zonder mannen op de muur |
   | 🏃 **Ontruimen** | Er valt veel minder te roven en er komt niemand om | Buiten het centrum ligt het werk stil |
   | 🔱 **Burgerwacht** | Iedereen zonder werk telt mee als verdediging | Er wordt niets gebouwd |
   | 💰 **Schatting** | Ze trekken meteen af | Ze komen sneller én sterker terug |

   Verlies je alsnog, dan stelen ze grondstoffen en raakt een gebouw beschadigd — nooit
   meteen game over. En vanaf tijdperk 4 kan een bende die je niet kan overrompelen
   besluiten je te **belegeren**: dan ligt alles buiten je stad stil tot je het beleg
   breekt met een uitval, of tot ze het opgeven.

---

## Je leger en je dorpsleven

- ⚔️ **Een leger.** Soldaten (oefenveld, kazerne, kasteel) vormen een veldleger.
  Dat verdedigt altijd mee, maar tijdens de 45 seconden waarschuwing kun je ook
  een **uitval** bevelen: win je in het open veld, dan is de bende *vernietigd*
  in plaats van weggejaagd — dat levert een langere rust op en maakt volgende
  bendes voorzichtiger. Verlies je, dan ben je mannen kwijt die je op de muur
  had willen hebben. De knop staat in de roversbalk en op het dorpsplein.
- ⚓ **De haven** drijft handel over zee (munten) en laat vissershutten binnen
  zes tegels 35% meer vangen. 🚪 **De stadspoort** is de sterkste schakel in je
  muur — zet hem pal op de route die de rovers nemen.
- 🤝 **Samenhorigheid.** Een dorp dat compact om het plein heen gebouwd is,
  voelt als één geheel en is merkbaar tevredener dan een reeks verspreide
  buitenposten. Je ziet het percentage op het dorpsplein.
- 📖 **Het dorpsboek** (☰ → Dorpsboek) geeft je inwoners namen, een beroep en
  het jaar dat ze kwamen. Puur sfeer — de simulatie telt gewoon koppen.

## Er gebeurt van alles in je dorp

Naast bouwen en werkers verdelen loopt er een tweede laag mee waar je iets mee
móet. Alles wat er op dat moment speelt staat in het kaartje **Stadszaken**
rechts in beeld.

- 🎉 **Feesten.** Zet graan, brood en munten om in een flinke portie
  tevredenheid voor een tijdje. Het vriendelijke spiegelbeeld van een
  roversaanval — handig na een overval of om net dat laatste stukje
  tevredenheid voor een tijdperk te halen.
- 🐴 **De reizende koopman.** Vanaf tijdperk 2 komt er af en toe een karavaan
  langs met een handvol eenmalige deals: hij verkoopt waar je weinig van hebt en
  koopt waar je in verzuipt. Eindelijk iets om je munten aan uit te geven. Een
  marktplaats, gildehuis of handelshuis knijpt zijn marge dicht.
- 📜 **Opdrachten van de heer.** "Lever 200 graan binnen 14 dagen." Op tijd
  leveren geeft munten en een blijer dorp, te laat kost je goede naam.
- 🎲 **Gebeurtenissen.** Brand, koorts, wolven, strenge vorst, een rondtrekkende
  bard, vluchtelingen aan de poort, een vondst in de mijn. Elke gebeurtenis
  geeft je een keuze: er is bijna altijd een gratis optie en een betere die
  geld of voorraad kost.

## Groeien zonder breder te bouwen

- ⬆️ **Uitbouwen.** Vanaf tijdperk 3 kan een huisje een vakwerkhuis worden, een
  boerderij een hoeve, een houthakkershut een houtzagerij, een steengroeve een
  steenhouwerij, een waterput een fontein en een wachttoren een bergfried. Klik
  het gebouw aan; het paneel laat zien wat je erop vooruitgaat.
- 📚 **Onderzoek.** Met een gildehuis (tijdperk 3) en een universiteit
  (tijdperk 4) koop je studies die voor altijd blijven werken: betere ploegen,
  diepere schachten, steigerbouw, wintervoorraad, pakhuisbeheer, wapenkunde,
  gildebrieven en dubbele boekhouding.

## Minder klikken, meer beslissen

- 👥 **Arbeidsbeleid.** Op het dorpsplein zeg je wélk werk voorrang heeft
  (voedsel, grondstoffen, ambacht, handel, voorzieningen, leger) en hoeveel
  bouwers je vrij wilt houden. Zet je *vanzelf verdelen* aan, dan nemen vrije
  dorpelingen zelf een openstaande baan in die volgorde. Er wordt nooit iemand
  wéggehaald bij zijn werk — dat zou je ervaring kosten. Wil je toch een
  schone lei, dan is er een knop *Nu opnieuw verdelen*.
- 🏗️ **Bouwrij.** Je ploegen werken aan drie bouwputten tegelijk in plaats van
  aan alles. In het paneel van een gebouw in aanbouw zie je op welke plek het
  staat, en zet je het met één knop vooraan.
- ↩️ **Ongedaan maken.** Verkeerd geklikt? **Ctrl+Z** draait de laatste
  plaatsing terug en je krijgt alles terug — ook straatjes. Een gebouw dat al
  áf is sloop je gewoon in het paneel (dan houd je de helft over).
- ❗ **Vraagt aandacht.** Rechts staat een kort lijstje met wat er nu vastloopt,
  het ergste bovenaan. Klik erop en de camera springt naar het gebouw.

## De wereld buiten je muren

Aan de rand van de kaart liggen drie **buursteden**, elk met een eigen specialiteit
en een eigen mening over je.

- 🐎 **Handelsroutes.** Vanaf tijdperk 3 open je een vaste route naar een buurstad.
  Dat kost eenmalig een wagen en een beurs, en levert daarna elke dag hun
  specialiteit én munten op. Eindelijk iets om je munten in te *investeren* in
  plaats van op te potten. Let op: ze willen er iets voor terug — lever je dat
  niet, dan rijden de karren half leeg.
- 🤝 **Aanzien.** Buursteden vragen af en toe hulp bij een misoogst of een brand.
  Help je, dan stijgt je aanzien en wordt je route winstgevender; wijs je ze af
  of laat je het verlopen, dan zakt het.
- 🔥 **En een verloren overval kost je nu meer dan je voorraad:** rovers die
  doorbreken maken de wegen onveilig, en al je routes liggen een tijd stil.

## Scenario's: hetzelfde spel, een ander probleem

Bij **Nieuw dorp stichten** kies je waar je aan begint:

| Scenario | Wat het is |
|---|---|
| 🏞️ **Vrij spel** | Het spel zoals het bedoeld is. Geen klok, geen extra regels. |
| ❄️ **Vijf winters aan de kust** | Geen akkerland. Alles moet van het water komen — en dat bevriest. |
| ⛪ **De kathedraal van Sint-Alwin** | Bouw de kathedraal binnen twintig jaar. De klok loopt. |
| 🐺 **Het jaar van de wolven** | Rovers, aan de lopende band. Versla er tien. |
| 🧳 **De vluchtelingen** | Veertig monden, bijna niets om ze te voeden. Breng ze door de eerste jaren. |

## De kroniek

Via **☰ → 📜 De kroniek** schrijft het spel de geschiedenis van je stad uit: hoe ze
begon, wie er woont, welke roverhoofdman er buiten wacht, met welke buursteden je
handelt en wat er allemaal is voorgevallen. Je kunt hem als tekst kopiëren en
bewaren of delen.

## Je eigen wereld kiezen

Bij **Nieuw dorp stichten** kies je zelf de naam, de grootte van de kaart
(klein, normaal of groot) en hoe zwaar het mag zijn (rustig, normaal of pittig —
dat stuurt hoe sterk en hoe vaak de rovers komen). Vul je een **kaartnummer** in,
dan krijg je precies dezelfde wereld terug: handig om een mooi dorp opnieuw te
spelen of een kaart met een vriend te delen.

Via **☰ → 📊 Statistieken** zie je je stad in cijfers, met een score en een
titel. Met **📷 Plaatje maken** bewaar je het beeld als PNG, en met
**☰ → 📜 De kroniek** lees je het verhaal erachter.

---

**Tip die veel spelers missen:** werkloze dorpelingen zijn je bouwers. Alles wat in
aanbouw staat, wordt gebouwd door de mensen zonder baan. Zet je iedereen aan het werk,
dan gaat bouwen ineens heel traag. Houd er dus altijd een paar vrij.

---

## Opslaan

Het spel slaat zichzelf elke 20 seconden op in je browser. Sluit je het tabblad, dan
staat je dorp er de volgende keer gewoon weer. Via **☰ → Menu** kun je je save ook als
tekst kopiëren en op een andere computer weer inplakken.

---

## Hoe zit de code in elkaar?

Alles is gewone HTML, CSS en JavaScript zonder bibliotheken of bouwstap, zodat het spel
rechtstreeks vanaf je harde schijf draait. Elk bestand hangt zijn onderdelen aan één
globale `Game`-namespace; `index.html` laadt ze in de juiste volgorde.

```
index.html            Startpunt, laadt alle scripts
css/style.css         Alle vormgeving

js/config/            De speldata — hier pas je de balans aan
  instellingen.js       Kaartgroottes en moeilijkheidsgraden
  resources.js          De 10 grondstoffen
  buildings.js          Alle gebouwen: kosten, opbrengst, werkers, plaatsingsregels
  jobs.js               Beroepen
  ages.js               De vier tijdperken en hun eisen
  quests.js             De doelenlijst
  handel.js             Wat de koopman voor je spullen geeft
  opdrachten.js         De opdrachten van de heer
  gebeurtenissen.js     De gebeurtenissen met een keuze
  buursteden.js         De buursteden en wat een handelsroute doet
  scenarios.js          De vijf scenario's met hun eigen doel
  onderzoek.js          De studies van gildehuis en universiteit
  rovers.js             De roverhoofdmannen en de knoppen van hun aanval
  standen.js            De drie standen en het tempo van een mensenleven

js/core/              De simulatie
  rng.js                Seeded toeval + ruis voor de kaart
  map.js                Kaartgeneratie: bos, rots, bergen, aders, wild, visgrond
  state.js              De volledige speltoestand
  construction.js       Plaatsen, bouwen, slopen
  economy.js            Productie, verwerking, onderhoud, opslag, natuurherstel
  population.js         Eten, tevredenheid, groei, banen
  seasons.js            Dagen, seizoenen, jaren
  raids.js              Roversaanvallen
  buurt.js              Wat er per plek in de buurt staat (voorzieningen, sfeer)
  logistiek.js          Hoe ver het sjouwen is naar de dichtstbijzijnde opslag
  demografie.js         Kinderen, volwassenen en ouderen
  standen.js            Wat elke stand vraagt en aan belasting opbrengt
  arbeid.js             Arbeidsbeleid: wie doet welk werk
  buren.js              Buursteden, handelsroutes en aanzien
  kroniek.js            Schrijft de geschiedenis van je stad
  ages.js               Tijdperkovergang en overwinning
  feesten.js            Feesten en het moreel
  handel.js             De reizende koopman
  opdrachten.js         Opdrachten met een deadline
  gebeurtenissen.js     Wanneer er iets gebeurt en wat je keuze doet
  onderzoek.js          Onderzoek en de bonussen die eruit komen
  save.js               Opslaan en laden

js/render/            Tekenen op het canvas
  camera.js  sprites.js  renderer.js  villagers.js  atlas.js
  paths.js              Het stratennet
  particles.js          Rook, vonken, stof, weer
  props.js              Erf rond de gebouwen (houtstapels, kramen, hekken)
  wildlife.js           Schapen en springende vissen
  floaters.js           Zwevende opbrengstcijfers
  lagen.js              De vijf kaartlagen
  raiders.js  minimap.js

js/ui/                De schermelementen
  hud.js  buildmenu.js  panel.js  quests.js  log.js  overlay.js
  lagen.js              De knoppenbalk voor de kaartlagen
  stad.js               Stadszaken: feest, koopman, opdracht, overzicht
  onderzoek.js          Het onderzoeksscherm
  audio.js              Geluid (volledig gesynthetiseerd)

js/devcheck.js        Controleert bij het opstarten of de speldata klopt
js/main.js            Spel-loop, muis en toetsenbord
```

### Zelf iets toevoegen

Een nieuw gebouw is één object in `js/config/buildings.js`. Bijvoorbeeld een bijenstal:

```js
{
  id: 'bijenstal', naam: 'Bijenstal', emoji: '🐝', tijdperk: 2, grootte: 1,
  kosten: { hout: 50 }, bouwtijd: 12, muur: '#d8c39a', dak: '#c9a227',
  banen: { aantal: 2, baan: 'boer' },
  maakt: { in: {}, uit: { vlees: 0.12 } },
  tevredenheid: 3,
  beschrijving: 'Honing voor op het brood. Zoet en geliefd.'
}
```

Herlaad de pagina en hij staat in het bouwmenu. `js/devcheck.js` waarschuwt in de
console (F12) als je per ongeluk een grondstof of baan gebruikt die niet bestaat.

Wil je dat een gebouw later kan uitgroeien tot iets groters, geef het dan een
`verbetering: { naar: 'id', tijdperk: 3, kosten: {...} }` en zet het doelgebouw
erbij met `verborgen: true` en dezelfde `grootte`. Het verschijnt dan niet in het
bouwmenu, maar als knop in het paneel van het gebouw zelf.

Getallen zoals productietempo staan **per werker per seconde**; de tooltips rekenen dat
zelf om naar "per minuut".

---

Veel plezier met bouwen! 🌾
