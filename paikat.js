/* ===== UISTELUTUTKA — PAIKAT (paikat.js) =====
   v179 (10.10.2026): siirretty index.html:stä sellaisenaan, jotta tilannekuva (tilanne.html) näyttää samat
   ottipaikat ja omat merkinnät. Puhdasta dataa. index.html käyttää näitä nimillä lappajarviHotspots ja
   omatMerkinnat kuten ennenkin (globaalit const-vakiot, ladataan ennen pääskriptiä).
   VERSIO: sivut lataavat tiedoston nimellä paikat.js?v=NNN; NNN = sw.js:n VERSIO-numero. */

// ===== OMAT MERKINNÄT — OziExplorer-karttatyö 2014 =====
// Nämä ovat käyttäjän OMIA lohikalamerkintöjä Lappajärveltä, luettu .map-tiedoston
// georeferoinnista. Ne ovat projektin luotettavinta paikkatietoa: eivät artikkelista,
// videokuvasta eivätkä analogiasta toisesta järvestä, vaan tästä järvestä.
//
// MIKSI OMANA TASONAAN eikä ottipaikkoina: näissä on koordinaatti ja merkintä, mutta
// ei taktiikkaa, pohjatietoa eikä tuulisuuntaa. Jos ne muutettaisiin ottipaikoiksi,
// joutuisin keksimään ne tiedot — ja juuri sitä olemme koko projektin ajan purkaneet.
// Merkintä säilyy sellaisena kuin sen kirjoitit.
//
// MUKANA VAIN VARMAT: 18 merkintää, joissa ei ole kysymysmerkkiä. Kuusi epävarmaa
// ("LOHTA ?", "Taimenta ?", "TÄSTÄ VOIS KOKEILLA") jätettiin pois, koska ne ovat
// arvauksia eivätkä havaintoja. Kuuden pisteen luoteisrykelmä on jo omana
// ottipaikkanaan, joten se ei ole tässä uudestaan.
const omatMerkinnat = [
  { lat: 63.19349, lon: 23.58406, t: "Taimen" },
  { lat: 63.15542, lon: 23.62484, t: "Taimen itätuuli" },
  { lat: 63.15411, lon: 23.54693, t: "Taimen" },
  { lat: 63.14800, lon: 23.56630, t: "taimen 30 cm potk parvi" },
  { lat: 63.14781, lon: 23.61185, t: "taimen ip" },
  { lat: 63.14762, lon: 23.59559, t: "taimen 08:30" },
  { lat: 63.14449, lon: 23.61594, t: "TAIMEN ja JÄRVILOHI 10 m käyrä 7.7 itätuuli" },
  { lat: 63.14412, lon: 23.59857, t: "taimen ip" },
  { lat: 63.13318, lon: 23.55265, t: "Taimen" },
  { lat: 63.13192, lon: 23.56298, t: "Taimen 17.7" },
  { lat: 63.12947, lon: 23.58355, t: "Taimen" },
  { lat: 63.12888, lon: 23.55747, t: "Taimen" },
  { lat: 63.12687, lon: 23.59136, t: "Taimen" },
  { lat: 63.11291, lon: 23.58085, t: "Taimen" },
  { lat: 63.11083, lon: 23.61757, t: "Etelään 7.5-11 m vedes jalokala 7.10" },
  { lat: 63.11024, lon: 23.58779, t: "kesäkuu alku taimen iso" },
  { lat: 63.10492, lon: 23.59626, t: "Taimen 2.7 21:00" },
  { lat: 63.10202, lon: 23.62371, t: "Pohjoiseen 7.5-11 m vedes jalokala 7.10" },
];

const lappajarviHotspots = {
  karna: {
    id: "karna",
    // KORJATTU 2.9.2026: nimi oli väärin. Koordinaatti (63.1346278, 23.64655)
    // on Kärnänsaaren ETELÄkärki, ei pohjoiskärki. Koordinaatti on oikein —
    // se luettiin OziExplorer .map-tiedoston georeferoinnista — vain nimi oli väärä.
    name: "Kärnänsaaren eteläkärki",
    lat: 63.1346278, lon: 23.64655,
    // KORJATTU 26.8.2026 OziExplorer .map-tiedoston georeferoinnista (oma karttatyö
    // 2014). Aiempi koordinaatti (63.14007, 23.64242) oli 640 m pielessä — se oli
    // luettu videokuvakaappauksesta. Tämä on mitattu .map-tiedostosta.
    type: "1.8–3.5 m matalikkopöytä ➔ 10–16 m itäpudotus",
    hardness: "Erittäin kova (Genesis punainen)",
    targetSpecies: "Suurtaimen & Järvilohi",
    tactic: "Aja laaja lenkki 6–10 m syvänteestä 1.8–3.5 m kovan pöydän reunaan. Tee nopeita kiihdytyksiä.",
    idealWind: "Kaikki tuulet / Päävirtauksen jakaja",
    reason: "Kärki jakaa kraatterin päävirtaukset. Suuret lohikalat nousevat syvänteestä matalikolle nopeisiin syöksyihin."
  },
  karnawest: {
    id: "karnawest",
    name: "Kärnänsaaren Länsiranta",
    lat: 63.16347, lon: 23.62345,
    // KORJATTU 25.8.2026. Aiempi koordinaatti (63.12557, 23.56188) oli varmistamaton
    // arvaus Genesis-videon riviltä 24, ja se osoittautui geometrisesti mahdottomaksi:
    // se oli vain 0,6 km Kuolionniemestä ja 4,4 km Kärnänsaaren omasta pohjoiskärjestä.
    // Uusi sijainti on laskettu käyttäjän karttamittauksesta: Kärnänsaaren länsiranta
    // on 5,46 km Kuolionniemestä koilliseen (suunta n. 30°, luettu kartan
    // mittausviivasta). ARVIO — suunta on silmämääräinen, joten tarkista GPS:llä
    // ja korjaa tarvittaessa.
    type: "1.5–2.5 m rantaterassi ➔ 4–8 m penkka",
    hardness: "Kova rantapenkka / sora",
    targetSpecies: "Taimen (Tyynen puolen smyygaaja)",
    tactic: "12 vavan pintaharava 1.5 m käyrällä. Erittäin pitkät vapautuspituudet kelkalta (10–15 m) varovaiselle kalalle.",
    idealWind: "Itä-, kaakkois- tai koillistuuli (E/SE/NE) = Maatuuli",
    reason: "Länsituulella ranta on maatuulen suojassa. Tyyni pinta tarkoittaa kylmän veden kumpuamista, mutta vaatii täydellistä smyygausta (pitkät siimat)."
  },
  kuolio: {
    id: "kuolio",
    name: "Kuolionniemi & Ylivainio (30 m levyinen hylly)",   // 1.10.2026 (v125): oli "30 m Ottitasanne", luettiin syvyydeksi. 30 m = hyllyn leveys (ks. type). Hannu: ei merkittävää saalishistoriaa nimellä.
    lat: 63.12096, lon: 23.56907,
    type: "1.3–1.6 m patti ➔ 30 m levyinen 1.5–3.0 m hylly",
    hardness: "Kova kivilouhikko (Genesis punainen)",
    targetSpecies: "Taimen (Puhdas lohivesi)",
    tactic: "Aja venettä tasan 3.0 m linjalla ja levitä 12 vavan pintaharava peittämään koko 30 m kova hylly.",
    idealWind: "Länsi / Lounas (W/SW) = Maatuuli", // KORJATTU 25.8.2026: Kuolionniemi on järven LÄNSIRANNALLA (avovesi itään, Kärnänsaari 4,3 km ja Selkäsaaret 4,7 km itään), joten maa on lännessä ja maatuuli on LÄNSITUULI. Aiempi "itätuuli" oli oma virheeni: niputin Kuolionniemen Kärnänsaaren länsirannan kanssa, vaikka jälkimmäinen on SAAREN ranta (vesi lännessä) ja Kuolionniemi mantereen niemi (vesi idässä). Eri geometria, sama korjaus — huolimattomuutta.
    reason: "Länsituulella puhdas maatuuli kumpuaa viileää vettä. Hauki ja ahven ajautuvat selälle, jättäen hyllyn puhtaaksi lohikaloille."
  },
  selkasaaret: {
    id: "selkasaaret",
    name: "Selkäsaaret (Kaakkoispenkka)",
    lat: 63.11325, lon: 23.66179,
    type: "3.7–4.6 m karikko ➔ 7.8–8.2 m selkäpenkka",
    hardness: "Kova karikon reuna",
    targetSpecies: "Taimen & Karkea Ahven",
    tactic: "Vedä uistimia selkäpenkan taitoksessa 7.8 m linjalla, matalikon avoveden puoleisella reunalla.",
    idealWind: "Pohjoinen / Luode (N/NW)",
    reason: "Yli 8 °C vedessä taimen loittonee rannasta erillisille selkämatalikoille ja niiden rajapintoihin."
  },
  luodeisranta: {
    id: "luodeisranta",
    name: "Luoteisranta (Karvalasta pohjoiseen)",
    lat: 63.16232, lon: 23.54942,
    // UUSI 26.8.2026. Perustuu OMAAN kenttädataan: OziExplorer-karttamerkinnöissä
    // (2014) on tällä n. 1,5 km rantakaistalla KUUSI erillistä taimenmerkintää
    // (63.15411–63.16747 / 23.54693–23.55427). Se on aineiston tihein taimenrykelmä
    // paikassa, jota mallissa ei ollut lainkaan — lähin ottipaikka Karvala on yli
    // 1,5 km etelään. Tämä on ainoa ottipaikka, joka nojaa käyttäjän omaan
    // mitattuun aineistoon eikä artikkeliin tai videokuvaan.
    type: "Länsirannan taimenkaista, 6 merkintää n. 1,5 km matkalla",
    hardness: "ei vielä tiedossa",
    targetSpecies: "Taimen",
    tactic: "Aja rantaviivan suuntaisesti. Merkinnät ovat hajallaan koko kaistalla, joten kyse on linjasta eikä yhdestä pisteestä.",
    idealWind: "Länsi / Lounas (W/SW) = Maatuuli — sama geometria kuin Karvalalla ja Kuolionniemellä (avovesi itään).",
    reason: "Oman karttadatan tihein taimenkeskittymä. Huom: merkinnöissä ei ole päivämääriä, joten kausi on tuntematon."
  },
  karvala: {
    id: "karvala",
    name: "Karvala (10 m Länsituulilinja)",
    // KORJATTU 7.10.2026 (v170): oli 63.14251, 23.53963, joka on MML-ruudukon mukaan noin 400 m maalla,
    // joten paikka ei saanut syvyyspisteitä. Siirretty samalla leveydellä 10 m rajalle (MML-syvyysluokka
    // ≥ 10 m alkaa 23.5540, noin 300 m rannasta). Hannun valinta 7.10.
    lat: 63.14251, lon: 23.5540,
    type: "10.0 m kovuuskäyrä (14–17.5 m syvänteen laita)",
    hardness: "Kovuuden vaihettumislinja (Kova/Pehmeä)",
    targetSpecies: "Järvilohi & Taimen",
    tactic: "Aja venettä tarkasti 10 m syvyyskäyrää. Laske takilat ja Dipsy Diverit 7–10 metriin kuoreparvien päälle.",
    idealWind: "Länsituuli (W/SW/NW) = Maatuuli",
    reason: "Länsituulella Karvalan puoli on maatuulessa (korjattu 22.9.2026: luki itätuuli, vaikka idealWind ja valinta ovat länsi). Syvänteestä nouseva kylmä vesi osuu 10 metrin kovuusseinämään houkutellen lohet."
  },
  /* UUSI 7.10.2026 (v170): Hannun loppukauden taimenpaikat, Oma saalis (Hannun valinta 7.10.).
     Sijainti Lowrancen sivukaikukuvista 30.7.2026: kursorin koordinaatti + kaistan keskilinja
     kuvan mittakaavasta (20 m = 63 px, pohjoinen ylös), tarkkuus noin ±15 m. Nimet Hannun
     karttasovelluksesta (lähin rannan tai lahden nimi); paikka varmistettu MML-rantaviivan muodosta. */
  kotalahti: {
    id: "kotalahti",
    name: "Kotalahti (länsirannan kaista)",
    lat: 63.1529, lon: 23.5485,
    type: "Rantakaista 60–110 m rannasta, 2–4,5 m vettä; sivukaikukuvissa kiviä rannan puolella. Kaista n. 63,1505–63,1551 N",
    hardness: "Kiviä rannan puolella (sivukaiku)",
    targetSpecies: "Taimen",
    tactic: "Aja rannan suuntaisesti kaistan keskilinjaa (63,1505–63,1551 N). Pohjaa alle 8 m, joten pintaharava 0,1–0,7 m; takilat pinnan tuntumaan, rannan puolella on kiviä.",
    idealWind: "Länsi / Lounas (W/SW) = Maatuuli — sama geometria kuin Luoteisrannalla ja Karvalalla.",
    reason: "Oma saalis: loppukauden taimenpaikkasi. Merkinnöissä ei ole päivämääriä eikä määriä."
  },
  tervasenkari: {
    id: "tervasenkari",
    name: "Tervasenkari (karin itäreuna)",
    lat: 63.1349, lon: 23.5541,
    type: "Tervasenkarin matalan laakion itäreuna, 2–4,5 m vettä; karin kivikko rannan puolella. Kaista n. 63,1336–63,1362 N",
    hardness: "Kivikko karin puolella (sivukaiku, karttamerkit)",
    targetSpecies: "Taimen",
    tactic: "Aja karin reunaa (63,1336–63,1362 N), laakio rannan puolella. Pintaharava 0,1–0,7 m; laakiolla kiviä, takilat ylös.",
    idealWind: "Länsi / Lounas (W/SW) = Maatuuli — länsirannan geometria (avovesi itään).",
    reason: "Oma saalis: loppukauden taimenpaikkasi. Merkinnöissä ei ole päivämääriä eikä määriä."
  },
  taimen_a: {
    id: "taimen_a",
    // v171 (Hannu 7.10.2026): nimi rannalta. Lähin karttanimi Hannun karttakuvassa on Tervasenkari
    // (noin 660 m); paikka on 12,5–17,5 m selkävedessä noin 1 km länsirannasta (MML). Vanha nimi suluissa.
    name: "Tervasenkarin selkä (Taimenalue A)",
    lat: 63.1396, lon: 23.5674,
    type: "Selkävesi 12,5–17,5 m noin 1 km länsirannasta (MML) — pohjanmuoto tarkistettava Genesikseltä",
    hardness: "Ei vielä tiedossa",
    targetSpecies: "Taimen",
    tactic: "Painopiste 23 GPS-merkitystä taimensaaliista. Aja alueen läpi ja katso mitä pohja/kovuus näyttää.",
    idealWind: "Ei vielä tiedossa",
    reason: "Suurin oma taimenkeskittymäsi."
  },
  taimen_b: {
    id: "taimen_b",
    // v171: lähin ranta Kärnänsaari (noin 900 m pohjoiseen); 2–4,5 m matalikko (MML). Vanha nimi suluissa.
    name: "Kärnänsaaren lounaismatala (Taimenalue B)",
    lat: 63.1383, lon: 23.6374,
    type: "Matalikko 2–4,5 m noin 900 m Kärnänsaaren etelärannasta (MML) — pohjanmuoto tarkistettava Genesikseltä",
    hardness: "Ei vielä tiedossa",
    targetSpecies: "Taimen",
    tactic: "Painopiste 6 GPS-merkitystä taimensaaliista. Idempänä pääalueesta.",
    idealWind: "Ei vielä tiedossa",
    reason: "Pienempi mutta toistuva taimenkeskittymä."
  },
  kuha_a: {
    id: "kuha_a",
    name: "Kuha-alue A",
    lat: 63.1485, lon: 23.6102,
    type: "Ei vielä tiedossa — tarkista pohjanmuoto Genesikseltä",
    hardness: "Ei vielä tiedossa",
    targetSpecies: "Kuha",
    tactic: "Painopiste 12 GPS-merkitystä kuhasaaliista.",
    idealWind: "Ei vielä tiedossa",
    reason: "Suurin oma kuhakeskittymäsi."
  },
  kuha_b: {
    id: "kuha_b",
    name: "Kuha-alue B",
    lat: 63.1551, lon: 23.7330,
    type: "Ei vielä tiedossa — tarkista pohjanmuoto Genesikseltä",
    hardness: "Ei vielä tiedossa",
    targetSpecies: "Kuha",
    tactic: "Painopiste 5 GPS-merkitystä kuhasaaliista. Kauimpana idässä.",
    idealWind: "Ei vielä tiedossa",
    reason: "Pienempi, itäisempi kuhakeskittymä."
  },
  tarvolanniemi: {
    id: "tarvolanniemi",
    name: "Tarvolanniemi",
    lat: 63.19961, lon: 23.58304,
    type: "Ei vielä tiedossa — tarkista pohjanmuoto Genesikseltä",
    hardness: "Ei vielä tiedossa",
    targetSpecies: "Hauki (myös muut lajit)",
    tactic: "Lappajärven Kalaveikot ry:n Suurkalarekisterin (16.6.2015) mukaan täältä on vedetty järven kaksi suurinta haukea, 11,89 kg ja 10,62 kg — molemmat vetouistelulla.",
    idealWind: "Ei vielä tiedossa",
    reason: "Todistetusti tuottavin haukipaikka koko rekisterissä."
  },
  pihlajasaari: {
    id: "pihlajasaari",
    name: "Pihlajasaaren eteläkärki",
    lat: 63.09062, lon: 23.66932,
    // v174 (7.10.2026): pohjanmuoto Hannun omasta luotauksesta, luettu Genesis-syvyyskartasta (käyrät 0,25 m välein),
    // sijainti sovitettu Pihlajasaaren eteläkärkeen ja Rämäkkösaaren pohjoiskärkeen ilmakuvasta. Vedenkorkeus luotauspäivänä
    // enintään 5 cm alle 7.10.2026 tason (Hannu). Ajolinjat ovat päätelmä pohjanmuodosta, eivät saaliista.
    type: "Saarten välinen satula 2,4–3,9 m (Pihlajasaari–Rämäkkösaari, 280 m); itäreunalla pohjois–eteläsuuntainen harjanne 1,6 m, sen länsipuolella pohja laskee 6 metriin noin 180 metrissä. Pihlajasaaren länsiranta putoaa jyrkästi 3–5 metriin, itäranta loivemmin 3 metriin. Kärjen 250 m:n säteellä puolet pohjasta on 1,2–4 m (oma luotaus)",
    hardness: "Ei vielä tiedossa (sivukaikukuva PIHLAJASAARI.smf on olemassa, kovuutta ei ole arvioitu)",
    targetSpecies: "Taimen",
    tactic: "Oma ennätystaimen nostettu täältä auringonlaskun aikaan 2.11.2025. Opeteltavat linjat (päätelmä pohjanmuodosta): harjanteen länsireuna 2–3 m:n kohdalla, satulan keskilinja ja Pihlajasaaren länsirannan pudotus. Kirjaa myös tyhjät ajot.",
    idealWind: "Ei vielä tiedossa — saaressa ei ole yhtä maatuulen suuntaa",
    reason: "Oma saalis, vähän otantaa: ennätystaimen ja muutama muu kala harvoilla ajoilla. Konsensus: läheltä tiedetään saadun hyvänkokoisia."
  },
};
