/* ===== UISTELUTUTKA — SYVYYS (syvyys.js) =====
   v180 (10.10.2026): siirretty index.html:stä sellaisenaan, jotta tilannekuva (tilanne.html) näyttää ja kirjaa
   saman syvyyden kuin etusivu: TM35-muunnos, MML-syvyysaineisto IndexedDB:stä (mmlIdbHae, luotIdb) ja sen
   arvio pisteessä (mmlArvioEN, mmlMinMax). Uutta: syvyysJarvella (sama sääntö kuin etusivun syvyysPisteessa,
   järvi parametrina) ja veneen kohdan taimensuositus (taimenVeneellaPohjasta). Tarvitsee luotaus.js:n
   (omaLuotausMinMax, omaLuotausYhdista) ja, varalähteenä, aaltomalli.js:n (akSyvyysJarvessa, akOnVetta).
   MML-aineiston haku ja tallennus (mmlHaeKaikki, mmlIdbTallenna, kortti) ovat index.html:ssä.
   VERSIO: sivut lataavat tiedoston nimellä syvyys.js?v=NNN; NNN = sw.js:n VERSIO-numero. */

// WGS84 -> ETRS-TM35FIN (EPSG:3067). Krügerin sarja, GRS80-ellipsoidi.
// Varmistettu edestakaisella muunnoksella: paluuvirhe 0,0000 m.
const TM35 = (() => {
  const a = 6378137.0, f = 1 / 298.257222101, k0 = 0.9996, E0 = 500000;
  const lon0 = 27 * Math.PI / 180;
  const n = f / (2 - f), A = a / (1 + n) * (1 + n * n / 4 + n ** 4 / 64);
  const e = Math.sqrt(f * (2 - f));
  const h = [n / 2 - 2 * n * n / 3 + 5 * n ** 3 / 16 + 41 * n ** 4 / 180,
             13 * n * n / 48 - 3 * n ** 3 / 5 + 557 * n ** 4 / 1440,
             61 * n ** 3 / 240 - 103 * n ** 4 / 140,
             49561 * n ** 4 / 161280];
  return {
    fwd(lat, lon) {
      const phi = lat * Math.PI / 180, lam = lon * Math.PI / 180 - lon0;
      const Q = Math.asinh(Math.tan(phi)) - e * Math.atanh(e * Math.sin(phi));
      const be = Math.atan(Math.sinh(Q));
      const et = Math.atanh(Math.cos(be) * Math.sin(lam));
      const nt = Math.asin(Math.sin(be) * Math.cosh(et));
      let E = et, N = nt;
      for (let j = 1; j <= 4; j++) {
        E += h[j - 1] * Math.cos(2 * j * nt) * Math.sinh(2 * j * et);
        N += h[j - 1] * Math.sin(2 * j * nt) * Math.cosh(2 * j * et);
      }
      return { E: A * k0 * E + E0, N: A * k0 * N };
    },
    // Käänteismuunnos vain diagnostiikkaa varten: kertoo missä haettu aineisto
    // oikeasti sijaitsee. Suomessa on useampi Lappajärvi, joten nimihaku voi
    // osua väärään järveen — se näkyy heti leveys- ja pituusasteista.
    inv(E, N) {
      const hi = [n / 2 - 2 * n * n / 3 + 37 * n ** 3 / 96 - n ** 4 / 360,
                  n * n / 48 + n ** 3 / 15 - 437 * n ** 4 / 1440,
                  17 * n ** 3 / 480 - 37 * n ** 4 / 840,
                  4397 * n ** 4 / 161280];
      const et = (E - E0) / (A * k0), nt = N / (A * k0);
      let e2 = et, n2 = nt;
      for (let j = 1; j <= 4; j++) {
        e2 -= hi[j - 1] * Math.cos(2 * j * nt) * Math.sinh(2 * j * et);
        n2 -= hi[j - 1] * Math.sin(2 * j * nt) * Math.cosh(2 * j * et);
      }
      const be = Math.asin(Math.sin(n2) / Math.cosh(e2));
      let Q = Math.asinh(Math.tan(be)), Q2 = Q;
      for (let i = 0; i < 8; i++) Q2 = Q + e * Math.atanh(e * Math.tanh(Q2));
      return { lat: Math.atan(Math.sinh(Q2)) * 180 / Math.PI,
               lon: (lon0 + Math.asin(Math.tanh(e2) / Math.cos(be))) * 180 / Math.PI };
    }
  };
})();

function luotIdb() {
  return new Promise(function (res, rej) {
    var r = indexedDB.open('uistelututka_syvyys', 1);
    r.onupgradeneeded = function () { r.result.createObjectStore('luotaus'); };
    r.onsuccess = function () { res(r.result); };
    r.onerror = function () { rej(r.error); };
  });
}

var mmlSyvData = null, mmlIndeksi = null;
async function mmlIdbHae() {
  if (mmlSyvData) return mmlSyvData;
  try {
    var db = await luotIdb();
    mmlSyvData = await new Promise(function (res, rej) {
      var q = db.transaction('luotaus').objectStore('luotaus').get('mml_v1');
      q.onsuccess = function () { res(q.result || null); }; q.onerror = function () { rej(q.error); };
    });
    db.close();
  } catch (e) { mmlSyvData = null; }
  return mmlSyvData;
}
function mmlRakennaIndeksi() {
  if (mmlIndeksi || !mmlSyvData) return mmlIndeksi;
  mmlIndeksi = new Map();
  mmlSyvData.jarvet.forEach(function (j, ji) {
    for (var i = 0; i < j.E.length; i++) {
      var key = Math.floor(j.E[i] / 200) + ',' + Math.floor(j.N[i] / 200);
      var a = mmlIndeksi.get(key); if (!a) mmlIndeksi.set(key, a = []);
      a.push(ji, i);
    }
  });
  return mmlIndeksi;
}
// Syvyysarvio pisteessä MML-datasta. Palauttaa null, jos 300 m sisällä ei ole mitään.
function mmlSyvyysPisteessa(lat, lon) { var t = TM35.fwd(lat, lon); return mmlArvioEN(t.E, t.N); }
function mmlArvioEN(tE, tN) {
  var ix = mmlRakennaIndeksi(); if (!ix) return null;
  var t = { E: tE, N: tN }, cx = Math.floor(t.E / 200), cy = Math.floor(t.N / 200), lista = [];
  var lahinKayra = null, lahinPiste = null;
  for (var dx = -2; dx <= 2; dx++) for (var dy = -2; dy <= 2; dy++) {
    var a = ix.get((cx + dx) + ',' + (cy + dy)); if (!a) continue;
    for (var k = 0; k < a.length; k += 2) {
      var j = mmlSyvData.jarvet[a[k]], i = a[k + 1];
      var e = Math.hypot(j.E[i] - t.E, j.N[i] - t.N);
      if (e > 300) continue;
      lista.push({ e: e, d: j.D[i] });
      if (j.L[i] === 1 && (!lahinKayra || e < lahinKayra.e)) lahinKayra = { e: e, d: j.D[i] };
      if (j.L[i] === 2 && (!lahinPiste || e < lahinPiste.e)) lahinPiste = { e: e, d: j.D[i] };
    }
  }
  if (!lista.length) return null;
  lista.sort(function (a, b) { return a.e - b.e; });
  var sw = 0, sd = 0;
  lista.slice(0, 6).forEach(function (x) { var w = 1 / Math.max(25, x.e * x.e); sw += w; sd += w * x.d; });
  return { arvio: sd / sw, lahinKayra: lahinKayra, lahinPiste: lahinPiste, n: lista.length };
}
/* ===== YHTEINEN SYVYYSKYSELY — 1.10.2026 (v124), Hannun päätös (a) vertailun jälkeen =====
   MML ensisijainen, DataDeck varalla. Vertailu v123: MML osui kaikkiin kolmeen omaan
   syvyysmerkintään (10 m käyrä; 7,5–11 m kahdesti), DataDeck kahteen; yli 6 m:n alueilla
   lähteet samaa mieltä, matalikoilla MML näyttää 1,5 m siellä missä DataDeck 3,8–6,5 m.
   Palauttaa saman muodon kuin akSyvyysPisteessa: { min, max, n } + lahde ('MML'/'DataDeck').
   MML min–max säteellä: säteen sisällä olevat käyrä- ja pistearvot sekä arviot keskeltä ja
   renkailta (r ≤ 100 m: yksi rengas, muuten r/2 ja r, 8 suuntaa). Rengaspiste ohitetaan, jos
   se on DataDeckin maskin mukaan maalla (muuten rannan käyrä painaisi minimin 1,5 metriin).
   DataDeck-varalla luetaan NYKYISEN järven kartta nimeltä, ei kortin valinnasta (v123).
   Aalto- ja virtausmallit käyttävät yhä DataDeckin ruudukkoa. */
function mmlMinMax(lat, lon, r, avainArg) {
  if (!mmlSyvData) return null;
  var ix = mmlRakennaIndeksi(); if (!ix) return null;
  var t = TM35.fwd(lat, lon), arvot = [], c = Math.ceil(r / 200) + 1;
  var cx = Math.floor(t.E / 200), cy = Math.floor(t.N / 200);
  for (var dx = -c; dx <= c; dx++) for (var dy = -c; dy <= c; dy++) {
    var a = ix.get((cx + dx) + ',' + (cy + dy)); if (!a) continue;
    for (var k = 0; k < a.length; k += 2) {
      var j = mmlSyvData.jarvet[a[k]], i = a[k + 1];
      if (Math.hypot(j.E[i] - t.E, j.N[i] - t.N) <= r) arvot.push(j.D[i]);
    }
  }
  var avain = arguments.length > 3 ? avainArg : ((typeof karttaAvain === 'function') ? karttaAvain() : null);   // v180: järvi parametrina (tilannekuva)
  var vesi = function (E, N) {
    if (!avain || typeof window.akOnVetta !== 'function') return true;
    var g = TM35.inv(E, N), v = window.akOnVetta(avain, g.lat, g.lon);
    return v !== false;
  };
  var pisteet = [[0, 0]];
  (r <= 100 ? [r] : [r / 2, r]).forEach(function (rr) {
    for (var q = 0; q < 8; q++) pisteet.push([rr * Math.cos(q * Math.PI / 4), rr * Math.sin(q * Math.PI / 4)]);
  });
  var arvioita = 0;
  pisteet.forEach(function (p, idx) {
    var E = t.E + p[0], N = t.N + p[1];
    if (idx > 0 && !vesi(E, N)) return;
    var m = mmlArvioEN(E, N); if (m) { arvot.push(m.arvio); arvioita++; }
  });
  if (!arvioita) return null;   // ei MML-tietoa 300 m sisällä -> varalle
  return { min: Math.min.apply(null, arvot), max: Math.max.apply(null, arvot), n: arvot.length, lahde: 'MML' };
}

/* ===== SYVYYS PISTEESSÄ NIMETYLLÄ JÄRVELLÄ — 10.10.2026 (v180) =====
   Sama sääntö kuin etusivun syvyysPisteessa ennen v180:tä (v124 MML ensin ja DataDeck/ruudukko varalla, v142
   syvyys tuntematon, v143 osittain luettu järvi, v172 oma luotaus), mutta järvi ja sen syvyysrajaukset annetaan
   parametrina eikä niitä lueta etusivun valitusta paikasta. Näin tilannekuvan syvyyslukema ja saaliin
   pohjaVeneellaM ovat samat kuin etusivulla samassa pisteessä.
     ehto = { avain: JARVET-avain, syvyysTuntematon: bool, syvyysOsittain: bool }
   Palauttaa { min, max, n, lahde } tai null. Etusivu: syvyysPisteessa(lat, lon, sadeM) = tämä + valittu paikka. */
function syvyysJarvella(lat, lon, sadeM, ehto) {
  ehto = ehto || {};
  // v142: järvellä, jonka syvyys on vain oletus, pisteen syvyyttä ei anneta
  if (ehto.syvyysTuntematon) return null;
  var avain = ehto.avain || null;
  // v143: osittain luettu järvi (Saimaa): ei syvyyttä kattavuuden ulkopuolella
  if (ehto.syvyysOsittain && typeof window.akKatettu === 'function') {
    if (avain && window.akKatettu(avain, lat, lon) === false) return null;
  }
  var oma = null; try { oma = omaLuotausMinMax(lat, lon, sadeM || 300); } catch (e) {}   // v172
  try { var m = mmlMinMax(lat, lon, sadeM || 300, avain); if (m) return omaLuotausYhdista(m, oma); } catch (e) { console.warn('MML-syvyys:', e.message); }
  if (avain && typeof window.akSyvyysJarvessa !== 'function' && typeof window.akKaynnistaHiljaa === 'function') {
    try { window.akKaynnistaHiljaa(); } catch (e) {}
  }
  var a = null;
  if (avain && typeof window.akSyvyysJarvessa === 'function') a = window.akSyvyysJarvessa(avain, lat, lon, sadeM);
  else if (typeof window.akSyvyysPisteessa === 'function') a = window.akSyvyysPisteessa(lat, lon, sadeM);
  // v128: varalähteen nimi järven mukaan (Ähtäri ja Kivijärvi: MML:stä rakennettu ruudukko)
  if (a) a.lahde = avain === 'hirvijarvi' ? 'oma kartta' : ['ahtarinjarvi', 'kivijarvi', 'alajarvi', 'evijarvi', 'patana', 'kyrkosjarvi', 'kalajarvi'].indexOf(avain) >= 0 ? 'MML-ruudukko' : (avain === 'toisvesi' || avain === 'saimaa_imatra') ? 'karttakuva' : avain === 'lappajarvi' ? 'MML-ruudukko' : 'DataDeck';
  return omaLuotausYhdista(a, oma);   // v172
}

/* VENEEN KOHDAN TAIMENSUOSITUS — 30.9.2026 (v110), Hannun valinta A.
   Päälukema (dTaimen) pysyy ulappasuosituksena: ottipaikkojen pisteytys
   käyttää sitä. Tämä on erillinen rivi, kun GPS on tuore ja syvyyskartta ladattu.
     - pohja 0,5–8 m -> Hannun pintasääntö 0,1–0,7 m (oma käytäntö, ei malli)
     - muuten mallin luku, enintään pohja − 1 m (pohjaraja)
   Pohja = syvin ruutu 60 m säteellä (kartan 100 m ruudut, syvyysluokat).
   Syvin, jotta pintasääntö koskee vain aidosti matalaa ja pohjaraja ei
   kiristy yhden matalan ruudun takia. Aiemmin raja oli järven syvin kohta
   (currentLocation.maxDepth), ja pintasääntö oli pelkkää tekstiä.
   v180: sääntö tässä (taimenVeneellaPohjasta), jotta tilannekuvan kirjaus käyttää samaa. GPS:n tuoreus
   (VENE_GPS_MAX_MS) ja syvyyskysely (VENE_SADE_M) tarkistetaan kutsuvalla sivulla. */
const PINTASAANTO = { pohjaMin: 0.5, pohjaMax: 8, viehe: [0.1, 0.7] };
const POHJAVARA_M = 1, VENE_GPS_MAX_MS = 120000, VENE_SADE_M = 60;
function taimenVeneellaPohjasta(s, dMalli) {
  if (!s || !isFinite(s.max)) return null;
  const pohja = Math.round(s.max * 10) / 10;
  const lahde = s.lahde || 'DataDeck';
  if (pohja < PINTASAANTO.pohjaMin) return { pohja, lahde, tyyppi: 'matala', min: null, max: null };
  if (pohja <= PINTASAANTO.pohjaMax) return { pohja, lahde, tyyppi: 'pinta', min: PINTASAANTO.viehe[0], max: PINTASAANTO.viehe[1] };
  if (typeof dMalli !== 'number' || isNaN(dMalli)) return { pohja, lahde, tyyppi: 'pohja', min: null, max: null };
  const raja = Math.round((pohja - POHJAVARA_M) * 10) / 10, d = Math.round(dMalli * 10) / 10;
  return d > raja ? { pohja, lahde, tyyppi: 'raja', min: raja, max: raja, malli: d } : { pohja, lahde, tyyppi: 'malli', min: d, max: d };
}
