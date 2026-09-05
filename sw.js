// Service worker — Nopeusnäyttö pro1
//
// Tehtävä: sovellus aukeaa ilman verkkoa ja ilman että Acoden palvelinta tarvitsee
// käynnistää. Sivu on yksi iso HTML-tiedosto (n. 1,2 MB, sisältää ottipisteäänen),
// joten välimuistiin riittää käytännössä se ja kuvakkeet.
//
// STRATEGIA: sovellussivu haetaan verkosta ensin ja tallennetaan välimuistiin
// (network-first). Jos verkkoa ei ole, tarjotaan välimuistista. Näin päivitetty
// versio tulee käyttöön heti kun tiedosto vaihdetaan, mutta offline toimii silti.
// Muut tiedostot (kuvakkeet, manifest) haetaan välimuistista ensin — ne eivät muutu.
//
// VERSIO: kasvata tätä aina kun julkaiset uuden version. Vanha välimuisti siivotaan.
const VERSIO = 'uistelututka-v45';
const SIVU = './';

const ESILADATTAVAT = [
  './',
  './index.html',
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

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Ulkopuoliset rajapinnat (SYKE, Open-Meteo) menevät aina verkkoon — niitä ei
  // saa tarjota välimuistista, koska vanha sää tai vedenkorkeus olisi harhaanjohtava.
  if (url.origin !== self.location.origin) return;

  const onSivu = req.mode === 'navigate' ||
                 url.pathname.endsWith('/') ||
                 url.pathname.endsWith('index.html');

  if (onSivu) {
    // Network-first: tuore versio jos verkko toimii, muuten välimuisti.
    e.respondWith(
      fetch(req)
        .then(vast => {
          const kopio = vast.clone();
          caches.open(VERSIO).then(c => c.put(SIVU, kopio));
          return vast;
        })
        .catch(() => caches.match(SIVU).then(v => v || caches.match('./index.html')))
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
