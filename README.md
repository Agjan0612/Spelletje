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
🟠 koper en 💎 edelstenen — en verwerkt die tot 🌾 graan, 🍞 brood, 🔨 gereedschap en
🪙 munten. Daarmee klim je door vier tijdperken:

| Tijdperk | Wat je krijgt |
|---|---|
| 1 · **Nederzetting** | Boerderij, huisjes, houthakker, jacht, visserij, steengroeve, waterput |
| 2 · **Dorp** | Molen, bakkerij, marktplaats, kapel, koper- en ijzermijn, wachttoren, **haven**, **oefenveld** |
| 3 · **Handelsstad** | Smederij, wapensmid, kazerne, muren, **stadspoort**, kerk, herberg, edelsteenmijn, gildehuis |
| 4 · **Middeleeuwse stad** | Stadhuis, herenhuizen, juwelier, handelshuis, universiteit, kathedraal, kasteel |

Rechtsboven staat precies wat je nog nodig hebt voor het volgende tijdperk. Een
**adviseur** in de doelenkolom wijst je steeds op de handigste volgende stap. Je stad is
"af" zodra je 100 inwoners hebt, 70% tevredenheid, en de kathedraal, het kasteel, de
universiteit en het stadhuis staan. Daarna kun je gewoon doorbouwen.

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
- **Feesten.** Vier op het dorpsplein een feest (kost graan en munten) voor een golf van
  goed humeur door de hele gemeenschap.
- **Een reizende koopman** komt af en toe langs: hij koopt je overschotten op of laat een
  klein geschenk achter.

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
| Pauzeren | **Spatie** |
| Snelheid | **1** = normaal, **2** = snel, **3** = zeer snel |
| Menu, opslaan, uitleg | De **☰** knop rechtsboven |

Op een tablet werkt het ook: één vinger sleept, tikken selecteert of plaatst.

---

## De vijf dingen die er echt toe doen

1. **Voedsel.** Elke inwoner eet. Graan komt van de boerderij, vlees van jagers en
   vissers, brood van de bakkerij. Meerdere soorten tegelijk maakt mensen blijer dan
   één soort. Je dorp groeit pas als er minstens drie dagen voorraad ligt — zo eet je
   jezelf nooit een hongersnood in.

2. **Woonruimte.** Nieuwe dorpelingen komen alleen als er een bed vrij is. Geen huizen,
   geen groei.

3. **Tevredenheid.** Waterput, kapel, kerk, herberg en marktplaats tillen het humeur op.
   Tevreden dorpelingen werken harder én je dorp groeit sneller. Hoe groter je stad,
   hoe meer voorzieningen je nodig hebt. Beweeg met de muis over het 😀-icoon bovenin
   om te zien waar je punten vandaan komen.

4. **De winter.** Boerderijen leveren dan níets en er wordt meer gegeten. Vissershutten
   en mijnen werken gewoon door. Leg in de herfst voorraad aan.

5. **Rovers.** Vanaf tijdperk 2 komen er bandieten langs. Je krijgt altijd 45 seconden
   waarschuwing, met hun kracht en jouw verdediging erbij. Wachttorens, stadsmuren,
   soldaten in de kazerne, de wapensmid en het kasteel houden ze buiten. Verlies je,
   dan stelen ze grondstoffen en raakt een gebouw beschadigd — nooit meteen game over.

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
  resources.js          De 10 grondstoffen
  buildings.js          Alle 32 gebouwen: kosten, opbrengst, werkers, plaatsingsregels
  jobs.js               Beroepen
  ages.js               De vier tijdperken en hun eisen
  quests.js             De doelenlijst

js/core/              De simulatie
  rng.js                Seeded toeval + ruis voor de kaart
  map.js                Kaartgeneratie: bos, rots, bergen, aders, wild, visgrond
  state.js              De volledige speltoestand
  construction.js       Plaatsen, bouwen, slopen
  economy.js            Productie, verwerking, onderhoud, opslag, natuurherstel
  population.js         Eten, tevredenheid, groei, banen
  seasons.js            Dagen, seizoenen, jaren
  raids.js              Roversaanvallen
  ages.js               Tijdperkovergang en overwinning
  save.js               Opslaan en laden

js/render/            Tekenen op het canvas
  camera.js  sprites.js  renderer.js

js/ui/                De schermelementen
  hud.js  buildmenu.js  panel.js  quests.js  log.js  overlay.js

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

Getallen zoals productietempo staan **per werker per seconde**; de tooltips rekenen dat
zelf om naar "per minuut".

---

Veel plezier met bouwen! 🌾
