// Service worker — Nopeusnäyttö pro1
//
// Tehtävä: sovellus aukeaa ilman verkkoa ja ilman että Acoden palvelinta tarvitsee
// käynnistää. v178 (10.10.2026): sivu (n. 1,3 MB) lataa omat tiedostonsa: jarvet.js (järvien
// ruudukot), aaltomalli.js (aalto- ja virtausmalli, kloonihaku) ja otti.mp3 (ottipisteääni).
// v191: tilannekuvan runko kiinnitetään näkymään (alapalkki ei jää navigointipalkin alle päivityksen jälkeen); ei uusia tiedostoja.
// v190: syysohjeen reunat lasketaan uudelleen, kun aaltomallin ennuste on ladattu; reunat myös tekstinä (ei uusia tiedostoja).
// v189: syksyn sekoittuneen veden ohje taimenelle (ei uusia tiedostoja); näkösyvyystaulukon asetus luetaan käynnistyksessä.
// v188: ennusteet talteen puhelimeen (aaltomalli.js, index.html; ei uusia tiedostoja).
// v187: venelista 9 venettä, valinta tunnisteen mukaan (ei uusia tiedostoja).
// v186: kuha- ja taimenpaikat tilannekuvaan (ei uusia tiedostoja).
// v185: vene.js (oma vene ja vana: tilannekuva, aaltokortti ja syvyyskartta).
// v184: tilannekuvan alapalkki navigointipalkin yläpuolelle (viewport-fit=cover pois; ei uusia tiedostoja).
// v183: tilannekuvan oma vene ja vana (ei uusia tiedostoja).
// v182: tilannekuvan vaaka-asettelu (ei uusia tiedostoja).
// v181: päivän suunnitelma rajauksin; tilannekuvaan kaikki karttatilat (ei uusia tiedostoja).
// v180: syvyys.js ja kirjaus.js (Kala kiinni tilannekuvassa samalla saalisrivillä).
// v179: tilanne.html (veneen tilannekuva) sekä yhteiset paikat.js ja kloonit.js. Kaikki
// tallennetaan tässä puhelimeen asennuksen yhteydessä.
//
// STRATEGIA: sovellussivu haetaan verkosta ensin ja tallennetaan välimuistiin
// (network-first). Jos verkkoa ei ole, tarjotaan välimuistista. Näin päivitetty
// versio tulee käyttöön heti kun tiedosto vaihdetaan, mutta offline toimii silti.
// Muut tiedostot (kuvakkeet, manifest) haetaan välimuistista ensin — ne eivät muutu.
//
// VERSIO: kasvata tätä aina kun julkaiset uuden version. Vanha välimuisti siivotaan.
// Versionumeron kasvatus on se mekanismi joka SIIVOAA vanhan välimuistin,
// index2.html mukaan lukien. Ilman tätä poisto ei näkyisi puhelimissa.
const VERSIO = 'uistelututka-v191';
/* v178: sivun omat tiedostot ladataan nimellä tiedosto?v=NNN, jossa NNN on tämän VERSIOn numero.
   index.html:n <script src> -riveissä ja ottiäänen haussa on SAMA numero: kun julkaiset, vaihda
   molemmat. Uusi numero on uusi osoite, joten puhelin ei voi yhdistää uutta sivua vanhaan malliin
   (GitHub Pages pyytää säilyttämään tiedostoja ~10 min, ja muut kuin sivut tarjotaan täältä ensin). */
const TV = VERSIO.replace('uistelututka-v', '');
const SIVU = './';

// MUUTETTU 18.9.2026. index2.html oli keskeneräinen uusi käyttöliittymä, ja se
// poistettiin: sen aaltomalli (suunnattu pyyhkäisy, puuska, kalastusraja) on
// siirretty index.html:n aallonkorkeuskarttaan, joten kahta mallia samasta
// asiasta ei enää ole. Välimuistista poistaminen on tässä olennaista: ilman
// sitä vanha kopio jäisi puhelimiin elämään omaa elämäänsä.
//
// Lisätty aaltokartta.html ja pyyhkaisy-laskenta.html, jotka ovat jaettuja
// sivuja ja joita käytetään nimenomaan vesillä — siis juuri silloin kun
// verkkoa ei välttämättä ole. Ne puuttuivat listalta kokonaan.
const ESILADATTAVAT = [
  './',
  './index.html',
  './aaltokartta.html',
  './pyyhkaisy-laskenta.html',
  './kisa_maksimi.html',
  './Lahtoaikalaskuri.html',
  './Lahtis.html',
  './harppausennuste-2027.html',
  './tilanne.html',              // v179: veneen tilannekuva
  './paikat.js?v=' + TV,        // v179
  './luotaus.js?v=' + TV,       // v179
  './syvyys.js?v=' + TV,        // v180
  './kirjaus.js?v=' + TV,       // v180
  './kloonit.js?v=' + TV,       // v179
  './vene.js?v=' + TV,          // v185
  './jarvet.js?v=' + TV,        // v178
  './aaltomalli.js?v=' + TV,    // v178
  './otti.mp3?v=' + TV,         // v178
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-192-maskable.png',
  './icon-512-maskable.png',
  './Lappajarvi_syvyys_ja_merkinnat.kmz',
  './syvyyskartta.jpg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSIO)
      // addAll kaatuu kokonaan jos yksikin tiedosto puuttuu, joten haetaan
      // jokainen erikseen ja ohitetaan puuttuvat.
      // v178: cache:'reload' ohittaa selaimen oman välimuistin, jotta asennus saa varmasti
      // palvelimen uusimman version (sama syy kuin sivuhaussa alla, korjaus 18.9.2026).
      .then(c => Promise.all(ESILADATTAVAT.map(u =>
        c.add(new Request(u, { cache: 'reload' })).catch(err => console.warn('SW: ohitettiin', u, err))
      )))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(avaimet => Promise.all(
        avaimet.filter(a => a !== VERSIO).map(a => caches.delete(a))
      ))
      .then(() => self.clients.claim())
  );
});

/* VERSION KERTOMINEN SIVULLE — lisätty 18.9.2026.
   Sivulla oli käsin kirjoitettu APP_VERSIO, jota verrattiin sw.js:n versioon.
   Kahta käsin ylläpidettävää lukua ei voi pitää synkassa: sw.js kasvoi v82:een
   ja sivun luku jäi v80:een, jolloin sovellus väitti ikuisesti olevansa
   vanhentunut vaikka se oli ajan tasalla.
   Nyt AKTIIVINEN service worker kertoo oman versionsa, ja sivu vertaa sitä
   palvelimella olevaan sw.js:ään. Kumpaakaan ei tarvitse kirjoittaa käsin. */
self.addEventListener('message', (e) => {
  if (e.data === 'versio' && e.source) e.source.postMessage({ swVersio: VERSIO });
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Ulkopuoliset rajapinnat (SYKE, Open-Meteo) menevät aina verkkoon — niitä ei
  // saa tarjota välimuistista, koska vanha sää tai vedenkorkeus olisi harhaanjohtava.
  if (url.origin !== self.location.origin) return;
  /* KORJATTU 30.9.2026 (v105). Sivun versiotarkistus hakee sw.js:n, mutta haku
     kulki alla olevaan cache-first-haaraan: ensimmäinen vastaus tallentui
     välimuistiin ja sen jälkeen tarkistus luki vanhaa sw.js:ää. Tila näytti
     "ajan tasalla", vaikka palvelimella oli uudempi versio. sw.js ohitetaan
     kokonaan, jolloin selain hakee sen verkosta (sivu pyytää no-store). */
  if (url.pathname.endsWith('/sw.js')) return;

  const onSivu = req.mode === 'navigate' ||
                 url.pathname.endsWith('/') ||
                 url.pathname.endsWith('.html');

  if (onSivu) {
    // KORJATTU 13.9.2026. Aiemmin jokaisen navigoinnin vastaus tallennettiin
    // KIINTEÄLLÄ avaimella './'. Usean sivun kanssa se rikkoo kaikki: toisen
    // sivun avaaminen olisi korvannut juuren sisällön, ja offline-tilassa
    // sovellus olisi avannut väärän sivun. Nyt jokainen sivu tallentuu omalla
    // osoitteellaan, ja juuri './' päivitetään vain kun juurta itseään pyydetään.
    // Tämä koskee yhä aaltokarttaa ja kisasivua, jotka ovat omia sivujaan.
    const juuri = url.pathname.endsWith('/') || url.pathname.endsWith('index.html');
    /* KORJATTU 18.9.2026. fetch(req) sai vastauksen SELAIMEN omasta
       välimuistista: GitHub Pages pyytää säilyttämään tiedostot noin kymmenen
       minuuttia, joten uusi versio ei näkynyt vaikka se oli jo palvelimella ja
       vaikka strategia on verkko-ensin. cache:'reload' ohittaa selaimen
       välimuistin ja hakee aina palvelimelta.
       Offline-varasto ei muutu: jos verkkoa ei ole, mennään yhä catch-haaraan. */
    e.respondWith(
      fetch(new Request(req.url, { cache: 'reload', credentials: 'same-origin' }))
        .then(vast => {
          const kopio = vast.clone();
          caches.open(VERSIO).then(c => {
            c.put(req, kopio.clone());
            if (juuri) c.put(SIVU, kopio);
          });
          return vast;
        })
        // Offline: ensin tämä sama sivu, vasta sitten juuri varalle.
        .catch(() => caches.match(req)
          .then(v => v || (juuri ? caches.match(SIVU) : null))
          .then(v => v || caches.match('./index.html')))
    );
  } else {
    // Cache-first muille: kuvakkeet ja manifest eivät muutu.
    e.respondWith(
      caches.match(req).then(v => v || fetch(req).then(vast => {
        const kopio = vast.clone();
        caches.open(VERSIO).then(c => c.put(req, kopio));
        return vast;
      }))
    );
  }
});
