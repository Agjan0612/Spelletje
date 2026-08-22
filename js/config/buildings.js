/* Building definitions — the heart of the game's balance.
 *
 * Every field is optional except id/naam/emoji/tijdperk/kosten.
 *
 *   tijdperk        age in which the building unlocks (0 = always, start only)
 *   grootte         footprint in tiles (grootte x grootte)
 *   kosten          one-off build cost
 *   bouwtijd        build effort in seconds for a single builder
 *   banen           { aantal, baan } worker slots and their job id
 *   wint            extraction: { node, straal, res, tempo } per worker per second
 *   maakt           crafting: { in: {res: perSec}, uit: {res: perSec} } per worker per second
 *   woonruimte      housing capacity
 *   opslag          added to the cap of every resource
 *   tevredenheid    happiness points this building offers the homes that can
 *                   reach it (diminishing per extra copy in the same reach)
 *   bereik          how many tiles those happiness points carry — required
 *                   whenever `tevredenheid` is set (see js/core/buurt.js)
 *   aantrekkelijkheid  how pleasant this makes the surrounding tiles: a
 *                   fountain lifts them, a smithy or quarry drags them down
 *   sfeerStraal     how far that pleasantness reaches (default 6)
 *   verdediging     flat defence strength
 *   verdPerWerker   defence strength per assigned worker
 *   productieBonus  global multiplier on all production (0.1 = +10%)
 *   onderhoud       upkeep per second for the whole building
 *   plaats          placement rule { nabij: {node, straal}, opRuwTerrein }
 *                   opRuwTerrein lets mines and quarries stand in the rocks
 *   max             maximum number of copies
 *   verbetering     { naar, kosten, tijdperk, aantrekkelijkheid } upgrade into
 *                   another building; `aantrekkelijkheid` demands a minimum
 *                   desirability on the spot before it may be built
 *   plaats.aantrekkelijkheid  same demand, but for a fresh placement
 *   verborgen       true = never in the build menu; only reachable as an
 *                   upgrade target (same footprint as what it grows out of)
 */
(function (Game) {

  var B = [

    /* ================= Tijdperk 0 — startgebouw ================= */
    {
      id: 'dorpsplein', naam: 'Dorpsplein', emoji: '🏛️', tijdperk: 0, grootte: 2,
      kosten: {}, bouwtijd: 20, max: 1, muur: '#c8b48c', dak: '#8a5a3a',
      woonruimte: 4, opslag: 300, tevredenheid: 4, bereik: 10,
      aantrekkelijkheid: 6, sfeerStraal: 9,
      beschrijving: 'Het hart van je nederzetting. Hier komen nieuwe dorpelingen aan en hier ligt je voorraad.'
    },

    /* ================= Tijdperk 1 — Nederzetting ================= */
    {
      id: 'huisje', naam: 'Huisje', emoji: '🏠', tijdperk: 1, grootte: 1,
      kosten: { hout: 30 }, bouwtijd: 8, muur: '#d8c39a', dak: '#7c4b2e',
      woonruimte: 4,
      verbetering: { naar: 'vakwerkhuis', tijdperk: 3, kosten: { hout: 45, steen: 35 }, aantrekkelijkheid: 8 },
      beschrijving: 'Een eenvoudige hut van leem en riet. Biedt onderdak aan vier dorpelingen.'
    },
    {
      id: 'boerderij', naam: 'Boerderij', emoji: '🌾', tijdperk: 1, grootte: 2,
      kosten: { hout: 45 }, bouwtijd: 14, muur: '#cbb48a', dak: '#9a6b3c',
      banen: { aantal: 3, baan: 'boer' },
      maakt: { in: {}, uit: { graan: 0.55 } },
      seizoensgevoelig: true,
      plaats: { nabij: { node: 'vruchtbaar', straal: 3 } },
      verbetering: { naar: 'hoeve', tijdperk: 3, kosten: { hout: 70, steen: 45 } },
      beschrijving: 'Verbouwt graan op vruchtbare grond. Levert niets in de winter — leg dus voorraad aan.'
    },
    {
      id: 'houthakkershut', naam: 'Houthakkershut', emoji: '🪓', tijdperk: 1, grootte: 1,
      kosten: { hout: 25 }, bouwtijd: 8, muur: '#b99a70', dak: '#6d4326',
      banen: { aantal: 3, baan: 'houthakker' },
      wint: { node: 'hout', straal: 6, res: 'hout', tempo: 0.45 },
      plaats: { nabij: { node: 'hout', straal: 6 } },
      verbetering: { naar: 'houtzagerij', tijdperk: 3, kosten: { hout: 60, gereedschap: 12 } },
      beschrijving: 'Kapt bomen in de omliggende bossen. Bossen groeien langzaam weer aan.'
    },
    {
      id: 'jachthut', naam: 'Jachthut', emoji: '🏹', tijdperk: 1, grootte: 1,
      kosten: { hout: 35 }, bouwtijd: 10, muur: '#b99a70', dak: '#5d4a2e',
      banen: { aantal: 2, baan: 'jager' },
      wint: { node: 'wild', straal: 6, res: 'vlees', tempo: 0.30 },
      seizoensgevoelig: true,
      aantrekkelijkheid: -3, sfeerStraal: 4,
      plaats: { nabij: { node: 'wild', straal: 6 } },
      beschrijving: 'Jaagt op hert en zwijn. In de winter is de jacht mager.'
    },
    {
      id: 'vissershut', naam: 'Vissershut', emoji: '🎣', tijdperk: 1, grootte: 1,
      kosten: { hout: 40 }, bouwtijd: 10, muur: '#b0a184', dak: '#4f6a72',
      banen: { aantal: 2, baan: 'visser' },
      wint: { node: 'vis', straal: 4, res: 'vlees', tempo: 0.26 },
      plaats: { nabij: { node: 'vis', straal: 4 } },
      beschrijving: 'Vist aan de oever. Levert het hele jaar door voedsel, ook in de winter.'
    },
    {
      id: 'steengroeve', naam: 'Steengroeve', emoji: '⛏️', tijdperk: 1, grootte: 1,
      kosten: { hout: 60 }, bouwtijd: 14, muur: '#a49a8c', dak: '#6a6259',
      banen: { aantal: 3, baan: 'steenhouwer' },
      wint: { node: 'steen', straal: 5, res: 'steen', tempo: 0.24 },
      aantrekkelijkheid: -8, sfeerStraal: 6,
      plaats: { nabij: { node: 'steen', straal: 5 }, opRuwTerrein: true },
      verbetering: { naar: 'steenhouwerij', tijdperk: 3, kosten: { hout: 70, gereedschap: 12 } },
      beschrijving: 'Hakt bouwsteen uit de rotsen. Gereedschap maakt de groeve een stuk sneller.'
    },
    {
      id: 'voorraadschuur', naam: 'Voorraadschuur', emoji: '📦', tijdperk: 1, grootte: 1,
      kosten: { hout: 70 }, bouwtijd: 14, muur: '#c2a97e', dak: '#6d4326',
      opslag: 400, aantrekkelijkheid: -2, sfeerStraal: 3,
      beschrijving: 'Verhoogt de opslagruimte voor elke grondstof met 400.'
    },
    {
      id: 'waterput', naam: 'Waterput', emoji: '💧', tijdperk: 1, grootte: 1,
      kosten: { hout: 20, steen: 30 }, bouwtijd: 10, muur: '#9aa0a6', dak: '#6d5a44',
      tevredenheid: 6, bereik: 7, aantrekkelijkheid: 4, sfeerStraal: 6,
      verbetering: { naar: 'fontein', tijdperk: 3, kosten: { steen: 70, munten: 50 }, aantrekkelijkheid: 4 },
      beschrijving: 'Schoon drinkwater vlakbij huis. Maakt je dorpelingen merkbaar tevredener.'
    },

    /* ================= Tijdperk 2 — Dorp ================= */
    {
      id: 'molen', naam: 'Molen', emoji: '🌬️', tijdperk: 2, grootte: 1,
      kosten: { hout: 90, steen: 30 }, bouwtijd: 18, muur: '#d5c7a4', dak: '#7c4b2e',
      banen: { aantal: 1, baan: 'molenaar' },
      boerderijBonus: 0.30, boerderijStraal: 6,
      beschrijving: 'Maalt het graan ter plaatse. Boerderijen binnen 6 tegels leveren 30% meer graan.'
    },
    {
      id: 'bakkerij', naam: 'Bakkerij', emoji: '🍞', tijdperk: 2, grootte: 1,
      kosten: { hout: 60, steen: 50 }, bouwtijd: 18, muur: '#d8c39a', dak: '#8a5a3a',
      banen: { aantal: 2, baan: 'bakker' },
      maakt: { in: { graan: 0.50 }, uit: { brood: 0.42 } },
      aantrekkelijkheid: 2, sfeerStraal: 4,
      beschrijving: 'Bakt brood van graan. Brood voedt beter dan graan en maakt dorpelingen blijer.'
    },
    {
      id: 'marktplaats', naam: 'Marktplaats', emoji: '⚖️', tijdperk: 2, grootte: 2,
      kosten: { hout: 100, steen: 60 }, bouwtijd: 22, muur: '#c9b48c', dak: '#a9552f',
      banen: { aantal: 3, baan: 'handelaar' },
      maakt: { in: {}, uit: { munten: 0.20 } },
      tevredenheid: 5, bereik: 10, aantrekkelijkheid: 5, sfeerStraal: 8,
      beschrijving: 'Handel met reizende kooplieden levert munten op en brengt leven in de brouwerij.'
    },
    {
      id: 'kapel', naam: 'Kapel', emoji: '⛪', tijdperk: 2, grootte: 1,
      kosten: { hout: 70, steen: 90 }, bouwtijd: 20, muur: '#ddd4bc', dak: '#7a6a58',
      banen: { aantal: 1, baan: 'priester' },
      tevredenheid: 9, bereik: 9, aantrekkelijkheid: 6, sfeerStraal: 7,
      beschrijving: 'Een klein bedehuis. Geeft de dorpelingen troost en houvast.'
    },
    {
      id: 'kopermijn', naam: 'Kopermijn', emoji: '🟠', tijdperk: 2, grootte: 1,
      kosten: { hout: 90, steen: 70 }, bouwtijd: 22, muur: '#a08050', dak: '#5c4632',
      banen: { aantal: 3, baan: 'mijnwerker' },
      wint: { node: 'koper', straal: 5, res: 'koper', tempo: 0.13 },
      aantrekkelijkheid: -7, sfeerStraal: 6,
      plaats: { nabij: { node: 'koper', straal: 5 }, opRuwTerrein: true },
      beschrijving: 'Delft koper uit de bergen. Koper is onmisbaar voor de grote gebouwen.'
    },
    {
      id: 'ijzermijn', naam: 'IJzermijn', emoji: '⛓️', tijdperk: 2, grootte: 1,
      kosten: { hout: 90, steen: 70 }, bouwtijd: 22, muur: '#8794a3', dak: '#4d4a45',
      banen: { aantal: 3, baan: 'mijnwerker' },
      wint: { node: 'ijzer', straal: 5, res: 'ijzer', tempo: 0.13 },
      aantrekkelijkheid: -7, sfeerStraal: 6,
      plaats: { nabij: { node: 'ijzer', straal: 5 }, opRuwTerrein: true },
      beschrijving: 'Delft ijzererts. IJzer maakt gereedschap en wapens mogelijk.'
    },
    {
      id: 'wachttoren', naam: 'Wachttoren', emoji: '🗼', tijdperk: 2, grootte: 1,
      kosten: { hout: 60, steen: 80 }, bouwtijd: 18, muur: '#a49a8c', dak: '#7a3b2c',
      verdediging: 18, dekking: { straal: 6 },
      verbetering: { naar: 'bergfried', tijdperk: 3, kosten: { steen: 110, ijzer: 30 } },
      beschrijving: 'Uitkijkpost tegen rovers. Voegt 18 verdediging toe — het meest waard dicht bij waar de rovers binnenvallen.'
    },
    {
      id: 'haven', naam: 'Haven', emoji: '⚓', tijdperk: 2, grootte: 2,
      kosten: { hout: 120, steen: 60 }, bouwtijd: 24, muur: '#b0a184', dak: '#3f5a6a',
      banen: { aantal: 3, baan: 'schipper' },
      maakt: { in: { hout: 0.06 }, uit: { munten: 0.26 } },
      visserijBonus: 0.35, visserijStraal: 6,
      tevredenheid: 4, bereik: 6, aantrekkelijkheid: -2, sfeerStraal: 5,
      plaats: { nabij: { node: 'vis', straal: 2 } },
      beschrijving: 'Kades aan het water. Schippers drijven handel over zee (munten) en vissershutten binnen 6 tegels vangen 35% meer.'
    },
    {
      id: 'oefenveld', naam: 'Oefenveld', emoji: '🎯', tijdperk: 2, grootte: 2,
      kosten: { hout: 70, steen: 40 }, bouwtijd: 18, muur: '#a7a488', dak: '#6a5a3a',
      banen: { aantal: 4, baan: 'soldaat' },
      verdPerWerker: 9, aantrekkelijkheid: -4, sfeerStraal: 5,
      beschrijving: 'Hier oefent de dorpsmilitie met boog en speer. Een vroeg begin van je leger, lang vóór de kazerne.'
    },

    /* ================= Tijdperk 3 — Handelsstad ================= */
    {
      id: 'smederij', naam: 'Smederij', emoji: '🔨', tijdperk: 3, grootte: 1,
      kosten: { hout: 110, steen: 90, ijzer: 40 }, bouwtijd: 26, muur: '#8a7d6c', dak: '#3f3a34',
      banen: { aantal: 2, baan: 'smid' },
      maakt: { in: { ijzer: 0.09, hout: 0.12 }, uit: { gereedschap: 0.055 } },
      aantrekkelijkheid: -10, sfeerStraal: 6,
      beschrijving: 'Smeedt gereedschap uit ijzer en hout. Gereedschap versnelt álle mijnen en groeven.'
    },
    {
      id: 'wapensmid', naam: 'Wapensmid', emoji: '⚔️', tijdperk: 3, grootte: 1,
      kosten: { steen: 110, ijzer: 70, hout: 60 }, bouwtijd: 26, muur: '#8a7d6c', dak: '#5a2f26',
      banen: { aantal: 2, baan: 'wapensmid' },
      onderhoud: { ijzer: 0.04 },
      verdPerWerker: 16, aantrekkelijkheid: -9, sfeerStraal: 6,
      beschrijving: 'Bewapent je wacht. Elke wapensmid voegt 16 verdediging toe, maar verbruikt ijzer.'
    },
    {
      id: 'kazerne', naam: 'Kazerne', emoji: '🛡️', tijdperk: 3, grootte: 2,
      kosten: { hout: 140, steen: 140, ijzer: 40 }, bouwtijd: 30, muur: '#9a8f7c', dak: '#6a3b2c',
      banen: { aantal: 6, baan: 'soldaat' },
      verdPerWerker: 14, aantrekkelijkheid: -5, sfeerStraal: 6,
      beschrijving: 'Huisvest soldaten. Soldaten werken niet mee in de economie, maar houden rovers buiten.'
    },
    {
      id: 'stadsmuur', naam: 'Stadsmuur', emoji: '🧱', tijdperk: 3, grootte: 1,
      kosten: { steen: 45 }, bouwtijd: 6, muur: '#9aa0a6', dak: '#7e848a',
      verdediging: 6, dekking: { straal: 3 },
      beschrijving: 'Een muursegment. Beschermt vooral het stuk waar het staat — zet ze op de weg die rovers nemen.'
    },
    {
      id: 'poort', naam: 'Stadspoort', emoji: '🚪', tijdperk: 3, grootte: 1,
      kosten: { steen: 90, hout: 30, ijzer: 20 }, bouwtijd: 16, max: 4, muur: '#8f8578', dak: '#6a3b2c',
      verdediging: 30, dekking: { straal: 4 },
      beschrijving: 'Een zwaar bewaakte poort. Verreweg de sterkste muurschakel — zet hem pal op de route die de rovers nemen.'
    },
    {
      id: 'herberg', naam: 'Herberg', emoji: '🍺', tijdperk: 3, grootte: 1,
      kosten: { hout: 130, steen: 70 }, bouwtijd: 25, muur: '#c9a878', dak: '#7c4b2e',
      banen: { aantal: 2, baan: 'waard' },
      onderhoud: { brood: 0.05 },
      tevredenheid: 12, bereik: 8, aantrekkelijkheid: 3, sfeerStraal: 5,
      beschrijving: 'Bier, verhalen en warmte. Verbruikt brood, maar houdt het humeur hoog.'
    },
    {
      id: 'kerk', naam: 'Kerk', emoji: '⛪', tijdperk: 3, grootte: 2,
      kosten: { hout: 160, steen: 220, koper: 30 }, bouwtijd: 40, muur: '#e2dac4', dak: '#6a6258',
      banen: { aantal: 2, baan: 'priester' },
      tevredenheid: 18, bereik: 14, aantrekkelijkheid: 10, sfeerStraal: 11,
      beschrijving: 'Een echte kerk met een koperen klok. Het geestelijke middelpunt van je stad.'
    },
    {
      id: 'edelsteenmijn', naam: 'Edelsteenmijn', emoji: '💎', tijdperk: 3, grootte: 1,
      kosten: { hout: 130, steen: 160, gereedschap: 20 }, bouwtijd: 30, muur: '#7c6f8a', dak: '#3f3a4a',
      banen: { aantal: 3, baan: 'mijnwerker' },
      wint: { node: 'edelsteen', straal: 5, res: 'edelsteen', tempo: 0.045 },
      aantrekkelijkheid: -6, sfeerStraal: 6,
      plaats: { nabij: { node: 'edelsteen', straal: 5 }, opRuwTerrein: true },
      beschrijving: 'Diepe schacht naar de edelsteenaders. Traag werk, maar edelstenen zijn goud waard.'
    },
    {
      id: 'gildehuis', naam: 'Gildehuis', emoji: '🏦', tijdperk: 3, grootte: 1,
      kosten: { hout: 160, steen: 140, gereedschap: 15 }, bouwtijd: 35, max: 3, muur: '#c4b18c', dak: '#6b4a2c',
      onderhoud: { munten: 0.05 },
      productieBonus: 0.10,
      beschrijving: 'De ambachtslieden bundelen hun kennis: +10% op álle productie. Kost munten.'
    },
    {
      id: 'pakhuis', naam: 'Pakhuis', emoji: '🏬', tijdperk: 3, grootte: 2,
      kosten: { hout: 170, steen: 120 }, bouwtijd: 25, muur: '#b09a74', dak: '#5d3c26',
      opslag: 1200, aantrekkelijkheid: -3, sfeerStraal: 5,
      beschrijving: 'Groot stenen pakhuis: 1200 extra opslag voor elke grondstof.'
    },

    /* ================= Tijdperk 4 — Middeleeuwse stad ================= */
    {
      id: 'herenhuis', naam: 'Herenhuis', emoji: '🏘️', tijdperk: 4, grootte: 1,
      kosten: { hout: 110, steen: 140, gereedschap: 10 }, bouwtijd: 20, muur: '#e0d0aa', dak: '#8a3f2e',
      woonruimte: 10, tevredenheid: 2, bereik: 4, aantrekkelijkheid: 3, sfeerStraal: 4,
      plaats: { aantrekkelijkheid: 12 },
      beschrijving: 'Een deftig stadshuis van steen. Biedt onderdak aan tien inwoners — maar deftige lieden bouwen alleen in een nette buurt.'
    },
    {
      id: 'stadhuis', naam: 'Stadhuis', emoji: '🏛️', tijdperk: 4, grootte: 2,
      kosten: { hout: 220, steen: 320, gereedschap: 40, koper: 40 }, bouwtijd: 45, max: 1,
      muur: '#e6dcc0', dak: '#7a4030',
      opslag: 800, tevredenheid: 10, bereik: 16, productieBonus: 0.05,
      aantrekkelijkheid: 10, sfeerStraal: 13,
      beschrijving: 'Zetel van het stadsbestuur. Meer opslag, meer trots, en een efficiënter bestuur.'
    },
    {
      id: 'juwelier', naam: 'Juwelier', emoji: '💍', tijdperk: 4, grootte: 1,
      kosten: { hout: 150, steen: 160, gereedschap: 30 }, bouwtijd: 30, muur: '#d0c0a0', dak: '#4a4360',
      banen: { aantal: 2, baan: 'juwelier' },
      maakt: { in: { edelsteen: 0.028, koper: 0.05 }, uit: { munten: 0.55 } },
      beschrijving: 'Zet edelstenen en koper om in sieraden — verreweg de rijkste bron van munten.'
    },
    {
      id: 'handelshuis', naam: 'Handelshuis', emoji: '⚓', tijdperk: 4, grootte: 2,
      kosten: { hout: 220, steen: 180, munten: 150 }, bouwtijd: 35, muur: '#c8b48c', dak: '#3f5a6a',
      banen: { aantal: 4, baan: 'handelaar' },
      maakt: { in: { hout: 0.08 }, uit: { munten: 0.32 } },
      tevredenheid: 4, bereik: 8, aantrekkelijkheid: 2, sfeerStraal: 6,
      beschrijving: 'Handel over land en water met verre steden. Een gestage stroom munten.'
    },
    {
      id: 'universiteit', naam: 'Universiteit', emoji: '📚', tijdperk: 4, grootte: 2,
      kosten: { hout: 300, steen: 420, gereedschap: 60, koper: 80 }, bouwtijd: 60, max: 1,
      muur: '#e6dcc0', dak: '#4a4360',
      banen: { aantal: 4, baan: 'geleerde' },
      onderhoud: { munten: 0.15 },
      productieBonus: 0.15, tevredenheid: 6, bereik: 14,
      aantrekkelijkheid: 8, sfeerStraal: 11,
      beschrijving: 'Geleerden verbeteren elk ambacht: +15% op alle productie in je stad.'
    },
    {
      id: 'kathedraal', naam: 'Kathedraal', emoji: '⛪', tijdperk: 4, grootte: 3,
      kosten: { hout: 320, steen: 620, koper: 100, edelsteen: 50, gereedschap: 50 }, bouwtijd: 80, max: 1,
      muur: '#efe6cc', dak: '#5a6a72',
      banen: { aantal: 3, baan: 'priester' },
      tevredenheid: 28, bereik: 22, aantrekkelijkheid: 18, sfeerStraal: 17,
      beschrijving: 'Het pronkstuk van je stad. Torens tot in de wolken en glas in lood.'
    },
    {
      id: 'kasteel', naam: 'Kasteel', emoji: '🏰', tijdperk: 4, grootte: 3,
      kosten: { hout: 400, steen: 820, ijzer: 200, gereedschap: 80 }, bouwtijd: 90, max: 1,
      muur: '#b8b0a2', dak: '#5a3a30',
      banen: { aantal: 8, baan: 'soldaat' },
      verdediging: 90, verdPerWerker: 18, tevredenheid: 6, bereik: 12, opslag: 400,
      aantrekkelijkheid: 4, sfeerStraal: 10,
      beschrijving: 'Een machtige burcht. Rovers wagen zich niet graag aan een stad met een kasteel.'
    },

    /* ============ Verbeteringen — niet in het bouwmenu ============
       Deze staan nooit in de bouwbalk: je groeit ernaartoe met de
       verbeterknop in het paneel van het gebouw waar ze uit voortkomen.
       De voetafdruk (grootte) moet dus gelijk zijn aan die van het
       oorspronkelijke gebouw, anders klopt de plattegrond niet meer. */
    {
      id: 'vakwerkhuis', naam: 'Vakwerkhuis', emoji: '🏡', tijdperk: 3, grootte: 1, verborgen: true,
      kosten: { hout: 75, steen: 35 }, bouwtijd: 12, muur: '#e6d9bb', dak: '#6b3f28',
      woonruimte: 8, tevredenheid: 1, bereik: 3, aantrekkelijkheid: 2, sfeerStraal: 3,
      beschrijving: 'Een huisje met een verdieping erop: balken, witte vakken en plek voor acht mensen.'
    },
    {
      id: 'hoeve', naam: 'Hoeve', emoji: '🚜', tijdperk: 3, grootte: 2, verborgen: true,
      kosten: { hout: 115, steen: 45 }, bouwtijd: 20, muur: '#d6c096', dak: '#8a5c33',
      banen: { aantal: 4, baan: 'boer' },
      maakt: { in: {}, uit: { graan: 0.64 } },
      seizoensgevoelig: true,
      plaats: { nabij: { node: 'vruchtbaar', straal: 3 } },
      beschrijving: 'Een boerderij met schuur en stallen. Meer akkers, meer handen, meer graan.'
    },
    {
      id: 'houtzagerij', naam: 'Houtzagerij', emoji: '🪚', tijdperk: 3, grootte: 1, verborgen: true,
      kosten: { hout: 85, gereedschap: 12 }, bouwtijd: 14, muur: '#c1a077', dak: '#5f3a20',
      banen: { aantal: 4, baan: 'houthakker' },
      wint: { node: 'hout', straal: 7, res: 'hout', tempo: 0.58 },
      aantrekkelijkheid: -3, sfeerStraal: 4,
      plaats: { nabij: { node: 'hout', straal: 6 } },
      beschrijving: 'Met zaagbok en span ossen haal je veel meer uit hetzelfde bos.'
    },
    {
      id: 'steenhouwerij', naam: 'Steenhouwerij', emoji: '🪏', tijdperk: 3, grootte: 1, verborgen: true,
      kosten: { hout: 130, gereedschap: 12 }, bouwtijd: 18, muur: '#b0a598', dak: '#5f5851',
      banen: { aantal: 4, baan: 'steenhouwer' },
      wint: { node: 'steen', straal: 6, res: 'steen', tempo: 0.32 },
      aantrekkelijkheid: -8, sfeerStraal: 6,
      plaats: { nabij: { node: 'steen', straal: 5 }, opRuwTerrein: true },
      beschrijving: 'Een groeve met hijskranen en houwersloodsen. Steen komt er in blokken uit.'
    },
    {
      id: 'fontein', naam: 'Fontein', emoji: '⛲', tijdperk: 3, grootte: 1, verborgen: true,
      kosten: { steen: 100, munten: 50 }, bouwtijd: 16, muur: '#cfd4d8', dak: '#8fa3ad',
      tevredenheid: 13, bereik: 9, aantrekkelijkheid: 12, sfeerStraal: 8,
      beschrijving: 'Stromend water midden op het plein. Het pronkstuk waar iedereen elkaar treft.'
    },
    {
      id: 'bergfried', naam: 'Bergfried', emoji: '🏯', tijdperk: 3, grootte: 1, verborgen: true,
      kosten: { steen: 190, ijzer: 30 }, bouwtijd: 26, muur: '#b3aa9c', dak: '#5f3229',
      verdediging: 34, dekking: { straal: 7 },
      beschrijving: 'Een zware stenen toren met kantelen. Wie hier langs wil, betaalt de prijs.'
    }
  ];

  /* Index by id and expose both forms. */
  Game.config.buildingList = B;
  Game.config.buildings = {};
  B.forEach(function (b) {
    b.grootte = b.grootte || 1;
    b.bouwtijd = b.bouwtijd || 10;
    Game.config.buildings[b.id] = b;
  });

  Game.config.gebouw = function (id) { return Game.config.buildings[id]; };

})(window.Game);
