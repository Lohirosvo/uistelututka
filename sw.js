// Service worker — Nopeusnäyttö pro1
//
// Tehtävä: sovellus aukeaa ilman verkkoa ja ilman että Acoden palvelinta tarvitsee
// käynnistää. Sivu on yksi iso HTML-tiedosto (n. 1,6 MB, josta ottipisteääni on
// noin 0,9 MB), joten välimuistiin riittää käytännössä se, jaetut sivut ja kuvakkeet.
//
// STRATEGIA: sovellussivu haetaan verkosta ensin ja tallennetaan välimuistiin
// (network-first). Jos verkkoa ei ole, tarjotaan välimuistista. Näin päivitetty
// versio tulee käyttöön heti kun tiedosto vaihdetaan, mutta offline toimii silti.
// Muut tiedostot (kuvakkeet, manifest) haetaan välimuistista ensin — ne eivät muutu.
//
// VERSIO: kasvata tätä aina kun julkaiset uuden version. Vanha välimuisti siivotaan.
// Versionumeron kasvatus on se mekanismi joka SIIVOAA vanhan välimuistin,
// index2.html mukaan lukien. Ilman tätä poisto ei näkyisi puhelimissa.
const VERSIO = 'uistelututka-v85';
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
      .then(c => Promise.all(ESILADATTAVAT.map(u =>
        c.add(u).catch(err => console.warn('SW: ohitettiin', u, err))
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
