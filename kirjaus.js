/* ===== UISTELUTUTKA — SAALISKIRJAUS (kirjaus.js) =====
   v180 (10.10.2026): Kala kiinni toimii sekä etusivulla että tilannekuvassa samalla koodilla. Siirretty
   index.html:stä sellaisenaan: saalisloki (LS_SAALIS, lataaSaaliit, tallennaSaaliit, saalisPaivitaTalteen),
   etäisyys (haversineDistMeters) ja pyyntilokin tallennus (LS_PYYNTI*, pyyntiLue, pyyntiKirjoita). Uutta:
   kirjauspohja ja yhteinen saalisrivin rakentaja (rakennaSaalis), mallikenttien täydennys (saalisMalliTaydennys,
   siirretty kalaKiinnistä) ja GPS-piste avoimeen reissuun (pyyntiLisaaPiste, pyyntiGpsAvoimeen).
   VERSIO: sivut lataavat tiedoston nimellä kirjaus.js?v=NNN; NNN = sw.js:n VERSIO-numero. */

// Saalisloki: kaikki kirjaukset yhdessä taulukossa (etusivu ja tilannekuva).
const LS_SAALIS = 'nopeusnaytto_pro1_saaliit';

function lataaSaaliit() {
  try {
    const raw = localStorage.getItem(LS_SAALIS);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

function tallennaSaaliit(lista) {
  try { localStorage.setItem(LS_SAALIS, JSON.stringify(lista)); return true; }
  catch (e) { console.error(e); return false; }
}

/* v151: pikakirjaus: tallennettu rivi päivitetään mallikentillä ja veden liikkeellä */
function saalisPaivitaTalteen(snap) {
  try {
    const lista = lataaSaaliit();
    const ix = lista.findIndex(function (x) { return x && x.id === snap.id; });
    if (ix < 0) return;
    // säilytetään käyttäjän täydennykset, lisätään vain mallikentät ja veden liike
    const t = lista[ix];
    Object.keys(snap).forEach(function (k) { if (/^malli|^vesiLiike$/.test(k) && snap[k] !== undefined && snap[k] !== null) t[k] = snap[k]; });
    tallennaSaaliit(lista);
  } catch (e) {}
}

// Haversine-kaava kahden pisteen välisen etäisyyden laskemiseen (varajärjestelmä)
function haversineDistMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Maan säde metreinä
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/* Pyyntiloki (PYYNTIPONNISTUS JA NOLLAHETKET, v109: kuvaus index.html:ssä). */
const LS_PYYNTI = 'uistelututka_pyyntiloki';
const LS_PYYNTI_AUKI = 'uistelututka_pyynti_auki';
const PYYNTI_JAKSO_MIN = 30, PYYNTI_AUKI_MAX_H = 12, PYYNTI_MIN_MIN = 3;
const PYYNTI_JAKSO_MS = PYYNTI_JAKSO_MIN * 60000, PYYNTI_PISTEET_MAX = 1500;
function pyyntiLue(k, oletus) {
  try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? oletus : v; } catch (e) { return oletus; }
}
function pyyntiKirjoita(k, v) {
  try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); return true; }
  catch (e) { console.warn('Pyyntiloki:', e.message); return false; }
}

/* ===== KIRJAUSPOHJA JA SAALISRIVI — 10.10.2026 (v180) =====
   Hannu 10.10.2026: Kala kiinni myös tilannekuvaan täydellä kirjauksella, jottei sivua tarvitse vaihtaa kesken
   uistelun. Etusivun kirjaus käyttää etusivun tilaa (kyselyn vastaukset, sää, mallin syvyysennusteet, ottipaikka-
   ja kuhasuositus, lämpö- ja harppaustieto, ehdokkaat, Hirvijärven voimala). Tilannekuva ei laske niitä itse (se
   olisi toinen kopio koko sovelluksesta), joten etusivu tallentaa tilansa KIRJAUSPOHJAKSI, kun se jää taustalle,
   suljetaan tai vaihtuu tilannekuvaan, sekä 5 min välein näkyvissä ollessaan:
     localStorage 'uistelututka_kirjauspohja' = {
       versio: 1, aika (laskentahetki ISO), sovellus, paikka, avain (JARVET), kalaLaji, syvyysEhto, syvyysEhdot,
       kentat: { vesiC … ennusteAhven }           täsmälleen ne arvot, jotka kalaKiinni lukee etusivun tilasta
       aikasarja: [{ t, harppaus, lt, prof }]     laskentahetki ja 12 seuraavaa tasatuntia (harppausarvio,
                                                  pintalämpö ja sen lähde, taimenen profiilivertailu)
       ottipaikka, kuhapaikka                     suositellun paikan nimi, sijainti ja pisteet
       kuhaEhdokkaat, taimenEhdokkaat             ehdokaspaikkojen koordinaatit [[lat, lon], …] samassa järjestyksessä
       taimenKentta: { avain, hetkiMs, syote }    taimenen harppauskentän syöte; tilannekuva laskee kentän samalla
                                                  mallilla (aaltomalli.js: akTaimenKentta)
       hirvi                                      Hirvijärven voimala, Varpula ja tulovirtaama }
   Saalisrivi rakennetaan YHDELLÄ funktiolla (rakennaSaalis) molemmilla sivuilla. Etusivu antaa pohjan suoraan
   muistista, jolloin rivi on tavulleen sama kuin ennen v180:tä (testattu kiinteällä kellolla ja samalla tilalla).
   Kirjaushetken omat tiedot tulevat aina kirjaavalta sivulta: aika, GPS, nopeus, veneen kohdan pohja (sama
   syvyysJarvella-funktio) ja mallin arviot saaliin kohdalta (saalisMalliTaydennys).
   REHELLISYYS: tilannekuvan rivillä on lisäksi kirjausLahde 'tilanne', pohjan laskenta-aika (kirjauspohjaAika) ja
   GPS-pisteen ikä sekunteina (gpsIkaS). Sää, vesi ja ennusteet ovat pohjan hetkeltä — kuten etusivullakin, jossa
   ne päivittyvät vain sivun ollessa näkyvissä (sää 5 min välein) ja ennusteet vain Analysoi-napista. Pohjaa ei
   käytetä, jos se on yli 12 h vanha tai eri järveltä: silloin nämä kentät jäävät tyhjiksi (ei arvata), ja
   kirjauspohjaAika on tyhjä. */
const KIRJAUSPOHJA_LS = 'uistelututka_kirjauspohja';
const KIRJAUSPOHJA_MAX_MS = 12 * 3600e3, KIRJAUSPOHJA_TUNNIT = 12;
const KIRJAUS_KENTAT = ['vesiC', 'vesiLahde', 'vedenkorkeusCm', 'ilmaC', 'tuuliMs', 'tuuliSuunta', 'pilvisyysPros', 'paineHpa',
  'painetrendi', 'kausi', 'kirkkaus', 'termokliini', 'tuuliLuokka', 'valo', 'pohja', 'tuulenPuoli', 'kattaus', 'ennusteTaimen',
  'ennusteJarvilohi', 'ennusteKirjolohi', 'ennusteKuha', 'ennusteMuikku', 'syottiLahde', 'taimenkeli', 'ennusteHauki', 'ennusteAhven'];
// Kala kiinni -lajit (sama lista etusivulla ja tilannekuvassa)
const SAALIS_LAJIT = [{ l: 'Taimen', v: 'taimen' }, { l: 'Järvilohi', v: 'jarvilohi' }, { l: 'Kirjolohi', v: 'kirjolohi' }, { l: 'Kuha', v: 'kuha' },
  { l: 'Hauki', v: 'hauki' }, { l: 'Ahven', v: 'ahven' }, { l: 'Muu', v: 'muu' }];

function kirjauspohjaLue() {
  try {
    const P = JSON.parse(localStorage.getItem(KIRJAUSPOHJA_LS) || 'null');
    return (P && P.versio === 1 && P.kentat && Array.isArray(P.aikasarja)) ? P : null;
  } catch (e) { return null; }
}
function kirjauspohjaTyhja(paikka) {
  const k = {}; KIRJAUS_KENTAT.forEach(function (n) { k[n] = null; });
  return { versio: 1, aika: null, paikka: paikka || null, avain: null, kalaLaji: null, kentat: k, aikasarja: [],
           ottipaikka: null, kuhapaikka: null, kuhaEhdokkaat: [], taimenEhdokkaat: [], taimenKentta: null, hirvi: null };
}
/* Pohja kirjaukseen järvellä avain hetkellä t. Palauttaa { P, kelpaa, ikaMin, syy }; jos pohja ei kelpaa,
   P on tyhjä pohja (paikka = järven nimi), ja syy kertoo miksi. */
function kirjauspohjaKirjaukseen(avain, t, jarviNimi) {
  const P = kirjauspohjaLue();
  if (!P) return { P: kirjauspohjaTyhja(jarviNimi), kelpaa: false, ikaMin: null, syy: 'etusivun tila puuttuu' };
  const ika = t - Date.parse(P.aika), ikaMin = Math.round(ika / 60000);
  if (!(ika <= KIRJAUSPOHJA_MAX_MS)) return { P: kirjauspohjaTyhja(jarviNimi), kelpaa: false, ikaMin, syy: 'etusivun tila on yli 12 h vanha' };
  if (!avain || P.avain !== avain) return { P: kirjauspohjaTyhja(jarviNimi), kelpaa: false, ikaMin, syy: 'etusivulla on valittuna ' + (P.paikka || 'muu paikka') };
  return { P, kelpaa: true, ikaMin, syy: null };
}
/* Pohjan aikasarjasta kirjaushetken rivi: viimeisin rivi, joka ei ole hetken jälkeen. */
function kirjauspohjaHetki(P, t) {
  const A = (P && P.aikasarja) || [];
  let r = null;
  for (let i = 0; i < A.length; i++) if (A[i].t <= t) r = A[i];
  if (!r && A.length && A[0].t - t < 60e3) r = A[0];   // kello heittää hieman: laskentahetken rivi
  if (r && t - r.t > 3600e3) return null;               // aikasarja on loppunut
  return r;
}

/* SAALISRIVI. Rakentaa rivin täsmälleen kuten etusivun kalaKiinni ennen v180:tä: sama kenttäjärjestys,
   samat pyöristykset ja samat ehdot. P = kirjauspohja, x = kirjaushetken omat tiedot:
     x.nyt (Date), x.lat, x.lon (null, jos ei sijaintia), x.nopeusKmh, x.nollareissu,
     x.avain = järvi, jolla kirjataan (taimenkentän vertailu), x.veneella(dMalli) → veneen kohdan taimensuositus tai null.
   Laji, täydennys ja mallin arviot lisää kutsuja (kuten ennenkin). */
function rakennaSaalis(P, x) {
  const nyt = x.nyt, k = P.kentat || {};
  const snap = {
    id: nyt.getTime(),
    aika: nyt.toISOString(),
    nollareissu: !!x.nollareissu,
    paikka: P.paikka,
    // GPS
    lat: x.lat,
    lon: x.lon,
    nopeusKmh: x.nopeusKmh,
    // Vesi
    vesiC: k.vesiC,
    vesiLahde: k.vesiLahde,
    vedenkorkeusCm: k.vedenkorkeusCm,
    // Sää kirjaushetkeltä, vaikka analyysi katsoisi toiseen päivään
    ilmaC: k.ilmaC,
    tuuliMs: k.tuuliMs,
    tuuliSuunta: k.tuuliSuunta,
    pilvisyysPros: k.pilvisyysPros,
    paineHpa: k.paineHpa,
    painetrendi: k.painetrendi,
    // Valinnat
    kausi: k.kausi,
    kirkkaus: k.kirkkaus,
    termokliini: k.termokliini,
    tuuliLuokka: k.tuuliLuokka,
    valo: k.valo,
    pohja: k.pohja,
    tuulenPuoli: k.tuulenPuoli,
    kattaus: k.kattaus,
    // Mallin ennusteet vertailua varten
    ennusteTaimen: k.ennusteTaimen,
    ennusteJarvilohi: k.ennusteJarvilohi,
    ennusteKirjolohi: k.ennusteKirjolohi,
    ennusteKuha: k.ennusteKuha,
    ennusteMuikku: k.ennusteMuikku,
    syottiLahde: k.syottiLahde,
    taimenkeli: k.taimenkeli,
    ennusteHauki: k.ennusteHauki,
    ennusteAhven: k.ennusteAhven,
    // Täydennettävät
    laji: null, pituusCm: null, syvyysM: null, syvyysLahde: null,
    // Mallin arviot saaliin kohdalta (täydentyvät hetken päästä: saalisMalliTaydennys)
    malliAaltoM: null, malliPintavirtausKmh: null, malliPintavirtausSuunta: null,
    malliSyvaKmh: null, malliSyvaSuunta: null, malliSyvaTuuleen: null,
    malliTuuliMs: null, malliTuuliSuunta: null,
    harppausEnnuste: null, harppausLahde: null,
  };
  const H = kirjauspohjaHetki(P, nyt.getTime());
  const hp = H ? H.harppaus : null;
  snap.harppausEnnuste = hp ? hp.arvo : null; snap.harppausLahde = hp ? hp.lahde : null;
  /* 30.9.2026 (v110): veneen kohdan taimensuositus ja pohja talteen. */
  const vt = x.veneella ? x.veneella(k.ennusteTaimen) : null;
  snap.pohjaVeneellaM = vt ? vt.pohja : null; snap.veneellaTyyppi = vt ? vt.tyyppi : null;
  snap.ennusteTaimenVeneellaMin = vt ? vt.min : null; snap.ennusteTaimenVeneellaMax = vt ? vt.max : null;
  /* 22.9.2026: suositus talteen, jotta lokista näkee myöhemmin osuiko se */
  snap.suositeltuPaikka = null; snap.suositusPisteet = null; snap.etaisyysSuositukseenM = null; snap.suositusHetki = null;
  const sp = P.ottipaikka;
  if (sp) {
    snap.suositeltuPaikka = sp.name; snap.suositusPisteet = sp.pisteet;
    snap.suositusHetki = sp.hetki || null;
    if (typeof snap.lat === 'number' && typeof sp.lat === 'number')
      snap.etaisyysSuositukseenM = Math.round(haversineDistMeters(snap.lat, snap.lon, sp.lat, sp.lon));
  }
  /* 28.9.2026: kuhan suositus omiin kenttiinsä. Laji täytetään vasta myöhemmin,
     joten molemmat suositukset talteen; vertailussa valitaan lajin mukaan. */
  snap.suositeltuKuhapaikka = null; snap.kuhaSuositusPisteet = null; snap.etaisyysKuhasuositukseenM = null; snap.kuhaVedenkorkeusKorjausM = null;
  const kp = P.kuhapaikka;
  if (kp) {
    snap.suositeltuKuhapaikka = kp.name; snap.kuhaSuositusPisteet = kp.pisteet;
    if (typeof snap.lat === 'number' && typeof kp.lat === 'number')
      snap.etaisyysKuhasuositukseenM = Math.round(haversineDistMeters(snap.lat, snap.lon, kp.lat, kp.lon));
    if (typeof kp.korjausM === 'number') snap.kuhaVedenkorkeusKorjausM = kp.korjausM;
  }
  /* 4.10.2026 (v153): lähin kuhan ehdokaspaikka (syvyyskartta, malli). */
  snap.kuhaEhdokasLahinM = null; snap.kuhaEhdokasTunnus = null;
  const ke = P.kuhaEhdokkaat;
  if (ke && ke.length && typeof snap.lat === 'number') {
    ke.forEach(function (c, i) {
      const e = Math.round(haversineDistMeters(snap.lat, snap.lon, c[0], c[1]));
      if (snap.kuhaEhdokasLahinM === null || e < snap.kuhaEhdokasLahinM) { snap.kuhaEhdokasLahinM = e; snap.kuhaEhdokasTunnus = i + 1; }
    });
  }
  /* v164: pintalämpö Lämpötiedosta ja onko se mitattu ≤ 48 h, sekä profiilivertailun syvyysväli taimenelle. */
  snap.pintaLtC = null; snap.pintaLtLahde = null; snap.pintaLtMitattu = null; snap.taimenProfiiliSyvA = null; snap.taimenProfiiliSyvB = null; snap.taimenProfiiliLahde = null;
  if (H && H.lt) { snap.pintaLtC = H.lt.c; snap.pintaLtLahde = H.lt.lahde; snap.pintaLtMitattu = H.lt.mitattu; }
  if (H && H.prof) { snap.taimenProfiiliSyvA = H.prof.a; snap.taimenProfiiliSyvB = H.prof.b; snap.taimenProfiiliLahde = H.prof.lahde; }
  /* 5.10.2026 (v156): lähin taimenen hotspot-ehdokas ja mallin harppaussyvyys saaliin kohdalla. Harppaus vain,
     jos kenttä on laskettu samalle järvelle enintään 3 h päässä kirjaushetkestä. */
  snap.taimenEhdokasLahinM = null; snap.taimenEhdokasTunnus = null; snap.taimenHarppausMalliM = null; snap.taimenMalliVaihe = null;
  try {
    const te = P.taimenEhdokkaat;
    if (te && te.length && typeof snap.lat === 'number') {
      te.forEach(function (c, i) {
        const e = Math.round(haversineDistMeters(snap.lat, snap.lon, c[0], c[1]));
        if (snap.taimenEhdokasLahinM === null || e < snap.taimenEhdokasLahinM) { snap.taimenEhdokasLahinM = e; snap.taimenEhdokasTunnus = 'T' + (i + 1); }
      });
    }
    const tk = P.taimenKentta;
    if (tk && tk.K && typeof snap.lat === 'number' && x.avain === tk.avain && Math.abs(Date.now() - tk.hetkiMs) <= 3 * 3600e3) {
      const q = tk.K.kohta(snap.lat, snap.lon);
      if (q) { snap.taimenHarppausMalliM = Math.round(Math.max(0, q.hq) * 10) / 10; snap.taimenMalliVaihe = tk.K.vaihe; }
    }
  } catch (e) {}
  /* 29.9.2026 (v97): voimalan tila ja tulovirtaama talteen Hirvijärvellä. */
  snap.hirviVoimalaM3s = null; snap.hirviVoimalaAjaa = null; snap.hirviVoimalaTilaLukemia = null;
  snap.hirviVarpulaM3s = null; snap.hirviTuloM3s = null;
  const hv = P.hirvi;
  if (hv) {
    if (hv.voimala) { snap.hirviVoimalaM3s = Math.round(hv.voimala.q * 100) / 100; snap.hirviVoimalaAjaa = hv.voimala.ajaa; snap.hirviVoimalaTilaLukemia = hv.voimala.lukemia; }
    if (hv.varpula) snap.hirviVarpulaM3s = Math.round(hv.varpula.q * 100) / 100;
    if (hv.tase && hv.tase.qTulo >= 0) snap.hirviTuloM3s = Math.round(hv.tase.qTulo * 10) / 10;
  }
  return snap;
}

/* Mallin arviot saaliin kohdalta (siirretty etusivun kalaKiinnistä v180, sisältö ennallaan). Aaltomalli
   käynnistetään hiljaa, jos sitä ei ole avattu; arvot täydentyvät samaan tallennettuun riviin, kun ennuste on
   haettu. 4.10.2026 (v149): veden liike saaliin kohdalla ja järven osuus kussakin luokassa samalla hetkellä. */
function saalisMalliTaydennys(snap) {
  if (typeof window.akKaynnistaHiljaa === 'function') window.akKaynnistaHiljaa();
  if (typeof window.akMalliPisteessa === 'function' && snap.lat !== null) {
    window.akMalliPisteessa(snap.lat, snap.lon, new Date(snap.aika).getTime()).then(function (m) {
      if (!m) return;
      const pyor = (x, n) => (typeof x === 'number' && isFinite(x)) ? Number(x.toFixed(n)) : null;
      snap.malliAaltoM = pyor(m.aaltoM, 2);
      snap.malliPintavirtausKmh = pyor(m.pintaKmh, 2);
      snap.malliPintavirtausSuunta = pyor(m.pintaSuunta, 0);
      snap.malliSyvaKmh = pyor(m.syvaKmh, 2);
      snap.malliSyvaSuunta = pyor(m.syvaSuunta, 0);
      snap.malliSyvaTuuleen = m.syvaTuuleen || null;
      snap.malliLapiKmh = pyor(m.lapiKmh, 3);        // 29.9.2026 (v98), Hirvijärvi
      snap.malliLapiSuunta = pyor(m.lapiSuunta, 0);
      snap.malliTuuliMs = pyor(m.tuuliMs, 1);
      snap.malliTuuliSuunta = pyor(m.tuuliSuunta, 0);
      saalisPaivitaTalteen(snap);   // v151: tietue on jo tallessa, päivitetään mallikentät
    }).catch(function () {});
  }
  snap.vesiLiike = null;
  if (typeof window.akVesiLiikePisteessa === 'function' && snap.lat !== null) {
    window.akVesiLiikePisteessa(snap.lat, snap.lon, new Date(snap.aika).getTime()).then(function (v) { if (v) { snap.vesiLiike = v; saalisPaivitaTalteen(snap); } }).catch(function () {});
  }
}

/* Pyyntiloki (v109): GPS-piste avoimeen reissuun enintään kerran minuutissa (etusivun pyyntiGpsTalteen).
   v180: tilannekuva lisää pisteitä samoin säännöin, jotta jakson sijainti ei katkea, kun uistellaan tilannekuvassa.
   Olot (sää) kirjaa edelleen vain etusivu: tilannekuvalla ei ole tuoretta säätä (ks. pyyntiOlot). */
function pyyntiLisaaPiste(r, lat, lon, t) {
  const ed = r.pisteet[r.pisteet.length - 1];
  if (ed && t - ed.t < 60000) return false;
  r.pisteet.push({ t: t, lat: Math.round(lat * 1e5) / 1e5, lon: Math.round(lon * 1e5) / 1e5 });
  if (r.pisteet.length > PYYNTI_PISTEET_MAX) r.pisteet.shift();
  return true;
}
function pyyntiGpsAvoimeen(lat, lon, t) {   // palauttaa avoimen reissun tai null
  const r = pyyntiLue(LS_PYYNTI_AUKI, null);
  if (!r || !Array.isArray(r.pisteet) || Date.now() - r.alku > PYYNTI_AUKI_MAX_H * 3600000) return null;
  if (pyyntiLisaaPiste(r, lat, lon, t)) pyyntiKirjoita(LS_PYYNTI_AUKI, r);
  return r;
}
