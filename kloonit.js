/* ===== UISTELUTUTKA — KLOONIPISTEIDEN YHTEISET OSAT (kloonit.js) =====
   v179 (10.10.2026): siirretty index.html:stä, jotta index.html ja tilanne.html käyttävät samaa
   kloonilokia, samaa "seuraavaksi"-valintaa, samoja tekstejä ja samaa käyntikirjausta. Kaksi
   versiota samasta valinnasta olisi juuri se virhe, jota projekti on purkanut (index2.html).
   Tässä on vain sellaista, joka ei tarvitse sivun omaa tilaa: tallennus (localStorage
   'uistelututka_kloonit'), muotoilu, PÄÄTÄ (klooniSeuraava), TOIMI (klooniKaynti), kartan kerros
   (klooniKerros) ja tiedostomuodot (OziExplorer .wpt, Lowrance .gpx).
   v180: myös laskenta ja saalisrivit (klooniLaske, osuma, saaliskentät, lajin vaihto, poisto) ovat tässä, koska
   Kala kiinni toimii myös tilannekuvassa. Sivukohtaiset osat: paneeli, hälytys ja vienti (index.html), kartta ja
   ilmoitukset (tilanne.html).
   OMA SIJAINTI: sivut asettavat window.utOmaSijainti = { lat, lon, suunta, tarkkuus, kmh, aika }.
   Seuraava kohde lasketaan siitä, jos se on enintään 10 min vanha; muuten viimeisestä iskusta.
   Taustan OODA-silmukka, sormenjälki ja painot: index.html KLOONIPISTEET-kommentti ja aaltomalli.js.
   VERSIO: sivut lataavat tiedoston nimellä kloonit.js?v=NNN; NNN = sw.js:n VERSIO-numero. */
const KLOONI_LS = 'uistelututka_kloonit', KLOONI_ASET_LS = 'uistelututka_klooni_asetukset';
const KLOONI_LAJIT = ['taimen', 'jarvilohi', 'kirjolohi', 'kuha'];
const KLOONI_LAJINIMI = { taimen: 'taimen', jarvilohi: 'järvilohi', kirjolohi: 'kirjolohi', kuha: 'kuha', hauki: 'hauki', ahven: 'ahven', muu: 'muu' };
const KLOONI_TUOREUS_MS = 24 * 3600e3;   // käynnit, osumat ja seuraava kohde: iskut enintään vuorokauden takaa

function klooniLue() {
  try {
    const d = JSON.parse(localStorage.getItem(KLOONI_LS) || 'null');
    if (d && Array.isArray(d.iskut)) { if (!d.paivat || typeof d.paivat !== 'object') d.paivat = {}; return d; }
  } catch (e) {}
  return { versio: 1, iskut: [], paivat: {} };
}
function klooniTallenna(d) { try { localStorage.setItem(KLOONI_LS, JSON.stringify(d)); return true; } catch (e) { return false; } }
function klooniAsetukset() {
  let a = {};
  try { a = JSON.parse(localStorage.getItem(KLOONI_ASET_LS) || '{}') || {}; } catch (e) { a = {}; }
  const r = (x, lo, hi, o) => (typeof x === 'number' && x >= lo && x <= hi) ? x : o;
  return { sadeKm: r(a.sadeKm, 1, 5, 3), maara: r(a.maara, 1, 5, 3), kynnys: r(a.kynnys, 50, 90, 70) };
}

/* ---- muotoilu ---- */
function klooniPvm(ms) { const d = new Date(ms); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function klooniPvmTeksti(pvm) { const o = String(pvm).split('-'); return (+o[2]) + '.' + (+o[1]) + '.'; }
function klooniN1(x) { return (Math.round(x * 10) / 10).toFixed(1).replace('.', ','); }
function klooniN2(x) { return (Math.round(x * 100) / 100).toFixed(2).replace('.', ','); }
function klooniKello(ms) { const d = new Date(ms); return d.getHours() + '.' + String(d.getMinutes()).padStart(2, '0'); }
function klooniKohti(deg) { return ['pohjoiseen', 'koilliseen', 'itään', 'kaakkoon', 'etelään', 'lounaaseen', 'länteen', 'luoteeseen'][Math.round((((deg % 360) + 360) % 360) / 45) % 8]; }
function klooniMista(deg) { return ['pohjoisesta', 'koillisesta', 'idästä', 'kaakosta', 'etelästä', 'lounaasta', 'lännestä', 'luoteesta'][Math.round((((deg % 360) + 360) % 360) / 45) % 8]; }
function klooniMatka(la1, lo1, la2, lo2) {   // sama kaava ja säde kuin index.html:n haversineDistMeters
  const R = 6371e3, dLat = (la2 - la1) * Math.PI / 180, dLon = (lo2 - lo1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(la1 * Math.PI / 180) * Math.cos(la2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function klooniSuuntima(la1, lo1, la2, lo2) {
  const a = la1 * Math.PI / 180, b = la2 * Math.PI / 180, dl = (lo2 - lo1) * Math.PI / 180;
  const y = Math.sin(dl) * Math.cos(b), x = Math.cos(a) * Math.sin(b) - Math.sin(a) * Math.cos(b) * Math.cos(dl);
  return Math.round((Math.atan2(y, x) * 180 / Math.PI + 360) % 360) % 360;
}
function klooniMatkaTeksti(m) { return m >= 1000 ? klooniN1(m / 1000) + ' km' : (Math.round(m / 10) * 10) + ' m'; }
function klooniPuheMatka(m) { return m >= 1000 ? klooniN1(m / 1000) + ' kilometriä' : (Math.round(m / 50) * 50) + ' metriä'; }
function klooniAsentoTeksti(a, g) {
  if (!(g >= 0.3)) return 'tasainen pohja';
  const x = Math.abs(a);
  if (x >= 135) return 'tuuli puskee syvältä matalalle';
  if (x <= 45) return 'tuuli painaa matalalta syvälle';
  return 'sivutuuli, syvä ' + (a > 0 ? 'oikealla' : 'vasemmalla') + ' myötätuuleen';
}
function klooniMuotoTeksti(m) {
  if (m <= -0.8) return 'kari tai matalikko (' + klooniN1(-m) + ' m ympäristöä matalampi)';
  if (m >= 0.8) return 'kuoppa (' + klooniN1(m) + ' m ympäristöä syvempi)';
  return '';
}
function klooniPyorista(s) {
  const r = (x, n) => (typeof x === 'number' && isFinite(x)) ? Math.round(x * Math.pow(10, n)) / Math.pow(10, n) : null;
  return { pohja: r(s.pohja, 2), f: r(s.f, 2), g: r(s.g, 2), asento: r(s.asento, 0), syvaSuunta: r(s.syvaSuunta, 0),
           aalto: r(s.aalto, 3), muoto: r(s.muoto, 2), rannasta: r(s.rannasta, 0), hq: r(s.hq, 1),
           oma: !!s.oma, pohjaLahde: s.pohjaLahde || null, pohjaRuutu: r(s.pohjaRuutu, 2) };
}
function klooniIskuTeksti(I) {
  const s = I.sj || {}, o = [];
  o.push('pohja ' + klooniN1(s.pohja) + ' m (' + (s.pohjaLahde || 'ruudukko') + (typeof s.pohjaRuutu === 'number' ? '; ruudun luokka ' + klooniN1(s.pohjaRuutu) : '') + ')');
  o.push('kaltevuus ' + klooniN1(s.g) + ' m/100 m');
  o.push(klooniAsentoTeksti(s.asento, s.g));
  o.push('aalto ' + klooniN2(s.aalto) + ' m');
  const mu = klooniMuotoTeksti(s.muoto); if (mu) o.push(mu);
  if (typeof s.rannasta === 'number') o.push('rannasta ' + klooniMatkaTeksti(s.rannasta));
  if (typeof s.hq === 'number') o.push('harppaus ' + klooniN1(s.hq) + ' m (malli)');
  const t = I.tuuli || {};
  o.push('tuuli ' + Math.round(t.U) + ' m/s ' + klooniMista(t.dir) + ' (' + (t.lahde || '?') + (t.oletusKesto ? ', kesto oletettu 6 h' : '') + ')');
  if (typeof I.pyyntiSyvyys === 'number') o.push('pyyntisyvyys ' + klooniN1(I.pyyntiSyvyys) + ' m');
  if (typeof I.vesiC === 'number') o.push('vesi ' + klooniN1(I.vesiC) + ' °C (koko järvi)');
  if (I.tutkittu) o.push('kaava toistuu ' + Math.max(1, Math.round(100 * I.ehdokkaita / I.tutkittu)) + ' %:ssa hakualueen vedestä (raja ' + I.kynnys + ' %)');
  return o.join(' · ');
}
function klooniTeksti(I, c, lyhyt) {   // lyhyt: paneelin lista (pisteet, matka ja tila ovat jo rivillä)
  const A = I.sj || {}, B = c.sj || {}, o = [];
  if (!lyhyt) o.push(c.pisteet + ' % · ' + klooniMatkaTeksti(c.etaisyysM) + ' ' + klooniKohti(c.suunta) + ' iskusta ' + I.tunnus);
  o.push('pohja ' + klooniN1(B.pohja) + ' m ' + (B.oma ? 'luotaus' : 'MML') + ' (isku ' + klooniN1(A.pohja) + ')');
  o.push('kaltevuus ' + klooniN1(B.g) + ' (' + klooniN1(A.g) + ') m/100 m');
  o.push(klooniAsentoTeksti(B.asento, B.g));
  o.push('aalto ' + klooniN2(B.aalto) + ' (' + klooniN2(A.aalto) + ') m');
  const mu = klooniMuotoTeksti(B.muoto); if (mu) o.push(mu);
  if (typeof B.rannasta === 'number') o.push('rannasta ' + klooniMatkaTeksti(B.rannasta) + ' (' + klooniMatkaTeksti(A.rannasta) + ')');
  if (typeof B.hq === 'number') o.push('harppaus ' + klooniN1(B.hq) + ' (' + klooniN1(A.hq) + ') m');
  if (lyhyt) return o.join(' · ');
  if (c.osuma) o.push('🐟 osuma ' + klooniKello(new Date(c.osuma.aika).getTime()) + (c.osuma.laji ? ' (' + (KLOONI_LAJINIMI[c.osuma.laji] || c.osuma.laji) + ')' : ''));
  else if (c.kayty) o.push('✓ käyty ' + klooniKello(c.kayty));
  return o.join(' · ') + '. Malli: tarkista kaikulla.';
}
function klooniIskuSaaliille(id, d) { return (d || klooniLue()).iskut.find(x => x.id === id) || null; }
function klooniTilastoTeksti(d) {
  let k = 0, kay = 0, os = 0, osK = 0;
  d.iskut.forEach(I => I.kloonit.forEach(c => { k++; if (c.kayty) kay++; if (c.osuma) { os++; if (KLOONI_LAJIT.includes(c.osuma.laji)) osK++; } }));
  if (!k) return 'Ei vielä klooneja.';
  return 'Kaikkiaan ' + d.iskut.length + ' iskua, ' + k + ' kloonia, käyty ' + kay + ', osumia ' + os + (os !== osK ? ' (lohikala tai kuha ' + osK + ')' : '')
    + (kay ? ' = ' + Math.round(100 * os / kay) + ' % käydyistä' : '') + '. Vertailu sattumaan vaatii kymmeniä käyntejä; siihen asti luku on suuntaa-antava.';
}

/* ---- PÄÄTÄ: seuraava kohde ---- */
function klooniLahto() {   // oma sijainti, jos tuore (≤ 10 min); muuten null
  const p = window.utOmaSijainti;
  return (p && typeof p.lat === 'number' && Date.now() - (p.aika || 0) <= 600e3) ? p : null;
}
/* Avoimista klooneista (ei käyty, ei osumaa, isku ≤ 24 h) paras = pisteet − 4 %-yksikköä veneen
   etäisyyden kilometriä kohden. Ilman tuoretta sijaintia matka lasketaan viimeisestä iskusta. */
function klooniSeuraava(d, lahto) {
  d = d || klooniLue();
  if (lahto === undefined) lahto = klooniLahto();
  const nyt = Date.now(), avoimet = [];
  d.iskut.forEach(I => { if (nyt - new Date(I.aika).getTime() > KLOONI_TUOREUS_MS) return; I.kloonit.forEach(c => { if (!c.kayty && !c.osuma) avoimet.push({ I, c }); }); });
  if (!avoimet.length) return null;
  const viim = d.iskut[d.iskut.length - 1], L = lahto || { lat: viim.lat, lon: viim.lon };
  let paras = null;
  avoimet.forEach(x => {
    const e = klooniMatka(L.lat, L.lon, x.c.lat, x.c.lon), arvo = x.c.pisteet - 4 * e / 1000;
    if (!paras || arvo > paras.arvo) paras = { I: x.I, c: x.c, e, s: klooniSuuntima(L.lat, L.lon, x.c.lat, x.c.lon), arvo, gps: !!lahto };
  });
  return paras;
}

/* ---- TOIMI: käynti ----
   Käynti kirjautuu, kun vene on 100 m:n sisällä avoimesta kloonista (isku ≤ 24 h). Palauttaa
   { d, saapui (klooni tai null), lahella: [{ I, c, e, avain }] alle 60 m } — ääni ja ilmoitus ovat sivun asia. */
function klooniKaynti(lat, lon, nyt) {
  nyt = nyt || Date.now();
  const d = klooniLue(), lahella = [];
  let saapui = null;
  d.iskut.forEach(I => {
    if (nyt - new Date(I.aika).getTime() > KLOONI_TUOREUS_MS) return;
    I.kloonit.forEach(c => {
      const e = klooniMatka(lat, lon, c.lat, c.lon);
      if (e < 60) lahella.push({ I, c, e, avain: I.pvm + c.tunnus });
      if (!c.kayty && !c.osuma && e <= 100) { c.kayty = nyt; saapui = c; }
    });
  });
  if (saapui) klooniTallenna(d);
  return { d, saapui, lahella };
}

/* ---- kartan kerros: näytettävä päivä = aktiivisen (tai viimeisimmän) iskun päivä ja järvi ---- */
function klooniAktiivinenIsku(d, aktiivinenId) {
  d = d || klooniLue();
  return d.iskut.find(x => x.id === aktiivinenId) || d.iskut[d.iskut.length - 1] || null;
}
function klooniKerros(d, aktiivinenId, lahto) {
  d = d || klooniLue();
  const akt = klooniAktiivinenIsku(d, aktiivinenId);
  if (!akt) return null;
  const iskut = d.iskut.filter(x => x.pvm === akt.pvm && x.avain === akt.avain);
  const seur = klooniSeuraava(d, lahto);
  const seuraava = (seur && seur.I.pvm === akt.pvm && seur.I.avain === akt.avain) ? seur.c.tunnus : null;
  const km = klooniN1(akt.sadeM / 1000).replace(',0', '');
  const info = 'Kloonit ' + klooniPvmTeksti(akt.pvm) + ' (' + iskut.length + ' iskua): <b>violetti salmiakki</b> on paikka, jossa iskun pohja, penkan asento tuuleen ja aalto toistuvat iskuhetken tuulella (malli). '
    + '<b>Punainen pallo</b> on isku, katkoviivaympyrä ' + km + ' km hakusäde iskusta ' + akt.tunnus
    + (seuraava ? ', <b>keltainen rengas</b> seuraavaksi (' + seuraava + ')' : '') + '. Vaalea = käyty, kultainen = osuma. Napauta merkkiä.';
  return {
    avain: akt.avain, pvm: akt.pvm, aktiivinen: akt.tunnus, seuraava, seur, info,
    iskut: iskut.map(I => ({
      tunnus: I.tunnus, lat: I.lat, lon: I.lon, sadeM: I.sadeM, lajiNimi: KLOONI_LAJINIMI[I.laji] || I.laji || '',
      teksti: 'isku klo ' + klooniKello(new Date(I.aika).getTime()) + (I.laji ? ' (' + (KLOONI_LAJINIMI[I.laji] || I.laji) + ')' : '') + ': ' + klooniIskuTeksti(I),
      kloonit: I.kloonit.map(c => ({ tunnus: c.tunnus, lat: c.lat, lon: c.lon, pisteet: c.pisteet, kayty: c.kayty, osuma: c.osuma, teksti: klooniTeksti(I, c) }))
    }))
  };
}

/* ---- TIEDOSTOT — OziExplorer (.wpt) ja Lowrance (.gpx) ----
   Päivän kaikki iskut ja kloonit yhteen tiedostoon; nimen juokseva numero (sivun vienti) kasvaa joka
   viennillä, joten Bluetooth-siirto ei korvaa edellistä. Ozi: "OziExplorer Waypoint File Version 1.1",
   WGS 84, kentät: numero, nimi, lat, lon, päiväys (Delphi TDateTime), symboli, tila 1, näyttömuoto,
   tekstin ja taustan väri (BGR), kuvaus (≤ 40 merkkiä, ei pilkkuja), …, korkeus −777 = ei tiedossa.
   Merkistö ASCII (Ozi lukee ANSI). Kenttäjärjestys tarkistettu JOSM:n Ozi-lukijasta 10.10.2026. */
function klooniAscii(t) {
  return String(t).replace(/[äå]/g, 'a').replace(/[ÄÅ]/g, 'A').replace(/ö/g, 'o').replace(/Ö/g, 'O').replace(/%/g, ' pct')
    .replace(/,/g, '.').replace(/[^\x20-\x7e]/g, '').replace(/\s+/g, ' ').trim();
}
function klooniVientiPisteet(iskut) {
  const p = [];
  iskut.forEach(I => {
    const t = new Date(I.aika).getTime(), s = I.sj || {};
    p.push({ tyyppi: 'isku', ms: t, lat: I.lat, lon: I.lon, nimi: I.tunnus + ' ' + (KLOONI_LAJINIMI[I.laji] || I.laji || 'isku'),
             kuvaus: I.tunnus + ' ' + klooniKello(t) + ' pohja ' + (typeof s.pohja === 'number' ? s.pohja.toFixed(1) : '?') + 'm ' + I.kloonit.length + ' kloonia' });
    I.kloonit.forEach(c => p.push({ tyyppi: 'klooni', ms: I.laskettu || t, lat: c.lat, lon: c.lon, nimi: c.tunnus + ' ' + c.pisteet,
             kuvaus: c.tunnus + ' ' + c.pisteet + '% ' + I.tunnus + ' pohja ' + (c.sj && typeof c.sj.pohja === 'number' ? c.sj.pohja.toFixed(1) : '?') + 'm' + (c.osuma ? ' OSUMA' : c.kayty ? ' kayty' : '') }));
  });
  return p;
}
function klooniWpt(p) {
  const L = ['OziExplorer Waypoint File Version 1.1', 'WGS 84', 'Reserved 2', 'Reserved 3'];
  const VALK = 16777215, PUN = 61 * 65536 + 38 * 256 + 215, VIOL = 237 * 65536 + 58 * 256 + 124;   // TColor = B·65536 + G·256 + R
  p.forEach((x, i) => {
    const tdt = (x.ms - new Date(x.ms).getTimezoneOffset() * 60000) / 86400000 + 25569;
    L.push([i + 1, klooniAscii(x.nimi).slice(0, 24), x.lat.toFixed(6), x.lon.toFixed(6), tdt.toFixed(7), 0, 1, 3, VALK, x.tyyppi === 'isku' ? PUN : VIOL,
            klooniAscii(x.kuvaus).slice(0, 40), 0, 0, 0, -777, 6, 0, 17, 0, '10.0', 2, '', '', ''].join(','));
  });
  return L.join('\r\n') + '\r\n';
}
function klooniGpx(p, pvm) {
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const L = ['<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="Uistelututka ' + esc(typeof APP_VERSIO === 'string' ? APP_VERSIO : '') + '" xmlns="http://www.topografix.com/GPX/1/1">',
    '  <metadata><name>Kloonit ' + pvm + '</name><time>' + new Date().toISOString().replace(/\.\d{3}Z$/, 'Z') + '</time></metadata>'];
  p.forEach(x => L.push('  <wpt lat="' + x.lat.toFixed(6) + '" lon="' + x.lon.toFixed(6) + '"><time>' + new Date(x.ms).toISOString().replace(/\.\d{3}Z$/, 'Z')
    + '</time><name>' + esc(klooniAscii(x.nimi)) + '</name><desc>' + esc(klooniAscii(x.kuvaus)) + '</desc></wpt>'));
  L.push('</gpx>');
  return L.join('\r\n') + '\r\n';
}

/* ===== LASKENTA JA SAALISRIVIT — v180 (10.10.2026) =====
   Kala kiinni on nyt myös tilannekuvassa, joten iskun laskenta (klooniLaske), osuma (klooniOsumaTarkistus),
   saalisrivin klooni- ja sormenjälkikentät (klooniSaalisKentat) ja lajin vaihto (klooniLajiMuutos) ovat tässä
   yhteisinä. Siirretty index.html:stä sisältö ennallaan; sivun oma tila tulee KLOONI_SIVU-liitännöistä, jotka
   sivu asettaa käynnistyessään. Tarvitsee: kirjaus.js (lataaSaaliit, tallennaSaaliit, haversineDistMeters),
   paikat.js (karttaAvainNimesta), luotaus.js (omaLuotausPisteet) ja aaltomalli.js (akKloonit, akTuuliHetkella). */
const KLOONI_SIVU = {
  avainNyt: function () { return null; },       // sivun valittu järvi (JARVET-avain), jos saaliin paikasta ei saada
  taimenKentta: function () { return null; },   // { avain, hetkiMs, K }: taimenen harppauskenttä sormenjälkeen
  kesken: function () { return null; },         // täydennettävänä oleva saalis: sama id saa samat kentät muistiin
  laskettu: function (isku, s) {}               // isku laskettu: sivu päivittää paneelit ja kartat
};
function klooniSaalisKentat(s, kentat) {
  try {
    Object.assign(s, kentat);
    const kk = KLOONI_SIVU.kesken(); if (kk && kk.id === s.id && kk !== s) Object.assign(kk, kentat);
    const lista = lataaSaaliit(), ix = lista.findIndex(x => x && x.id === s.id);
    if (ix >= 0) { Object.assign(lista[ix], kentat); tallennaSaaliit(lista); }
  } catch (e) { console.warn('Kloonikentät:', e); }
}
// Iskupaikan pohja omasta luotauksesta: mediaani 60 m säteeltä, vähintään 3 pistettä (muuten null).
function klooniOmaPohja(lat, lon) {
  let P = [];
  try { P = omaLuotausPisteet(); } catch (e) { return null; }
  if (!P.length) return null;
  const r = 60, kx = 111320 * Math.cos(lat * Math.PI / 180), v = [];
  for (let i = 0; i < P.length; i++) {
    const p = P[i], dy = (p.lat - lat) * 111320, dx = (p.lon - lon) * kx;
    if (Math.abs(dy) > r || Math.abs(dx) > r || dx * dx + dy * dy > r * r) continue;
    v.push(p.syv);
  }
  if (v.length < 3) return null;
  v.sort((a, b) => a - b);
  return { m: v.length % 2 ? v[v.length >> 1] : (v[(v.length >> 1) - 1] + v[v.length >> 1]) / 2, n: v.length };
}
// HAVAINNOI + SUUNTAA: sormenjälki ja kloonit yhdelle saaliille. Palauttaa { ok, isku } tai { ok:false, syy }.
async function klooniLaske(s) {
  if (!s || typeof s.lat !== 'number' || typeof s.lon !== 'number') return { ok: false, syy: 'kirjauksella ei ole GPS-sijaintia (mittari ei ollut päällä)' };
  const avain = karttaAvainNimesta(s.paikka || '') || KLOONI_SIVU.avainNyt();
  if (!avain) return { ok: false, syy: 'järvellä ei ole syvyysruudukkoa' };
  if (typeof window.akKaynnistaHiljaa === 'function') { try { window.akKaynnistaHiljaa(); } catch (e) {} }
  if (typeof window.akKloonit !== 'function') return { ok: false, syy: 'karttamoduuli ei käynnistynyt' };
  try { if (typeof window.akValitseJarvi === 'function') window.akValitseJarvi(avain); } catch (e) {}
  // ennuste odotetaan enintään 8 s (hidas yhteys veneessä); muuten tuuli kirjauksesta
  try { if (typeof window.akValmiina === 'function') await Promise.race([window.akValmiina(), new Promise(r => setTimeout(r, 8000))]); } catch (e) {}
  const t = new Date(s.aika).getTime();
  let tuuli = null;
  try { tuuli = window.akTuuliHetkella(t, avain); } catch (e) { tuuli = null; }
  if (!tuuli) {
    const fmi = typeof s.malliTuuliMs === 'number' && typeof s.malliTuuliSuunta === 'number';
    const U = fmi ? s.malliTuuliMs : s.tuuliMs, dir = fmi ? s.malliTuuliSuunta : s.tuuliSuunta;
    if (typeof U === 'number' && typeof dir === 'number') tuuli = { U, dir, tunteja: 6, lahde: fmi ? 'kirjaus, FMI' : 'kirjaus, Open-Meteo', oletusKesto: true };
  }
  if (!tuuli) return { ok: false, syy: 'iskuhetken tuulta ei ole (ei ennustetta eikä kirjausta)' };
  const ps = (typeof s.syvyysM === 'number' && s.syvyysLahde === 'mitattu') ? s.syvyysM : (typeof s.viehesyvyysM === 'number' ? s.viehesyvyysM : null);
  let harppaus = null;
  try {
    const tk = KLOONI_SIVU.taimenKentta();
    if ((s.laji === 'taimen' || s.laji === 'jarvilohi') && tk && tk.avain === avain && tk.K && typeof tk.K.kohta === 'function' && Math.abs(tk.hetkiMs - t) <= 3 * 3600e3)
      harppaus = function (la, lo) { const x = tk.K.kohta(la, lo); return x ? Math.max(0, x.hq) : null; };
  } catch (e) { harppaus = null; }
  const as = klooniAsetukset(), op = klooniOmaPohja(s.lat, s.lon);
  const r = window.akKloonit({ avain, lat: s.lat, lon: s.lon, U: tuuli.U, dir: tuuli.dir, tunteja: tuuli.tunteja,
                               sadeM: as.sadeKm * 1000, maara: as.maara, kynnys: as.kynnys, pyyntiSyvyys: ps, harppaus,
                               pohjaMitattu: op ? op.m : null });
  if (!r || r.tila !== 'ok') {
    const syy = !r ? 'laskenta ei palauttanut tulosta'
      : r.tila === 'eriJarvi' ? 'kartalla on ' + (r.kortilla || '–') + ', isku on järveltä ' + r.jarvi + ' (yritä hetken päästä uudelleen)'
      : r.tila === 'eiRuutua' ? 'iskupaikka ei osu järven ruudukkoon (yli 200 m rannasta maalle?)'
      : r.tila === 'eiSyvyytta' ? 'järvellä ' + (r.jarvi || '') + ' ei ole syvyysruudukkoa'
      : 'tuntematon tila ' + r.tila;
    return { ok: false, syy };
  }
  const d = klooniLue(), pvm = klooniPvm(t), P = d.paivat[pvm] || (d.paivat[pvm] = { i: 0, k: 0, wpt: 0, gpx: 0 });
  const vanha = d.iskut.findIndex(x => x.id === s.id);
  let tunnus;
  if (vanha >= 0) { tunnus = d.iskut[vanha].tunnus; d.iskut.splice(vanha, 1); }   // uudelleenlaskenta: isku pitää tunnuksensa, kloonit saavat uudet
  else { P.i = (P.i || 0) + 1; tunnus = 'I' + P.i; }
  const sj = klooniPyorista(r.isku.sj);
  const isku = {
    id: s.id, tunnus, aika: s.aika, pvm, laji: s.laji || null, avain, jarvi: r.jarvi, lat: s.lat, lon: s.lon,
    sadeM: r.sadeM, maara: r.maara, kynnys: r.kynnys,
    tuuli: { U: Math.round(tuuli.U * 10) / 10, dir: Math.round(tuuli.dir), tunteja: tuuli.tunteja, lahde: tuuli.lahde, oletusKesto: !!tuuli.oletusKesto },
    pyyntiSyvyys: ps, vesiC: typeof s.vesiC === 'number' ? s.vesiC : null, harppaus: r.harppaus, sj,
    ehdokkaita: r.ehdokkaita, tutkittu: r.tutkittu, rajattuSyvyys: r.rajattuSyvyys, ruutu: r.ruutu, laskettu: Date.now(), versio: (typeof APP_VERSIO === 'string' ? APP_VERSIO : ''),
    kloonit: r.kloonit.map(c => {
      P.k = (P.k || 0) + 1;
      return { tunnus: 'K' + P.k, lat: Math.round(c.lat * 1e6) / 1e6, lon: Math.round(c.lon * 1e6) / 1e6, pisteet: c.pisteet, osat: c.osat,
               sj: klooniPyorista(c.sj), etaisyysM: c.etaisyysM, suunta: c.suunta, kayty: null, osuma: null };
    })
  };
  d.iskut.push(isku);
  d.iskut.sort((a, b) => String(a.aika).localeCompare(String(b.aika)));
  klooniTallenna(d);
  klooniSaalisKentat(s, {
    iskuTunnus: tunnus, klooniTunnukset: isku.kloonit.map(c => c.tunnus).join(' ') || '-',
    sjPohjaM: sj.pohja, sjKaltevuus: sj.g, sjAsento: sj.asento, sjAaltoM: sj.aalto, sjMuotoM: sj.muoto, sjRannastaM: sj.rannasta,
    sjHarppausM: sj.hq, sjTuuliMs: isku.tuuli.U, sjTuuliSuunta: isku.tuuli.dir
  });
  KLOONI_SIVU.laskettu(isku, s);
  return { ok: true, isku };
}
// TOIMI → OPI: kala 150 m:n sisällä kloonista, joka on laskettu ≤ 24 h ennen.
function klooniOsumaTarkistus(snap) {
  if (!snap || typeof snap.lat !== 'number') return null;
  const t = new Date(snap.aika).getTime(), d = klooniLue();
  let paras = null;
  d.iskut.forEach(I => {
    if (I.id === snap.id) return;
    const tI = new Date(I.aika).getTime();
    if (!(t > tI && t - tI <= KLOONI_TUOREUS_MS)) return;
    I.kloonit.forEach(c => { const e = haversineDistMeters(snap.lat, snap.lon, c.lat, c.lon); if (e <= 150 && (!paras || e < paras.e)) paras = { I, c, e }; });
  });
  if (!paras) return null;
  paras.c.osuma = { id: snap.id, laji: snap.laji || null, aika: snap.aika, etaisyysM: Math.round(paras.e) };
  if (!paras.c.kayty) paras.c.kayty = t;
  klooniTallenna(d);
  klooniSaalisKentat(snap, { klooniOsuma: paras.c.tunnus, klooniOsumaPisteet: paras.c.pisteet, klooniOsumaM: Math.round(paras.e) });
  return paras;
}
// Täydennys tai lajin vaihto pikakirjauksen jälkeen: osumamerkinnän laji, iskun laji tai iskun poisto, jos laji ei
// enää käynnistä klooneja. Palauttaa { muutos, poistettu, laske } — laske: iskua ei ole ja laji käynnistää kloonit.
function klooniLajiMuutos(s) {
  const d = klooniLue(), I = klooniIskuSaaliille(s.id, d);
  let muutos = false, poistettu = false;
  d.iskut.forEach(x => x.kloonit.forEach(c => { if (c.osuma && c.osuma.id === s.id && c.osuma.laji !== (s.laji || null)) { c.osuma.laji = s.laji || null; muutos = true; } }));
  if (I && !KLOONI_LAJIT.includes(s.laji)) {
    d.iskut = d.iskut.filter(x => x.id !== s.id); muutos = true; poistettu = true;   // numerot eivät palaa käyttöön
    klooniSaalisKentat(s, { klooniTunnukset: null, iskuTunnus: null });
  } else if (I && I.laji !== s.laji) { I.laji = s.laji; muutos = true; }
  if (muutos) klooniTallenna(d);
  return { muutos, poistettu, laske: !I && KLOONI_LAJIT.includes(s.laji) && typeof s.lat === 'number' };
}
// Kirjaus poistettu (Poista kirjaus / Kumoa): saaliin isku ja kloonin osumamerkintä pois; käynti jää (vene oli siellä).
// v180: ennen tätä poistetun saaliin isku ja kloonit jäivät kartalle ja kloonilokiin.
function klooniSaalisPoistettu(id) {
  const d = klooniLue(), n = d.iskut.length;
  let muutos = false;
  d.iskut = d.iskut.filter(x => x.id !== id); if (d.iskut.length !== n) muutos = true;
  d.iskut.forEach(I => I.kloonit.forEach(c => { if (c.osuma && c.osuma.id === id) { c.osuma = null; muutos = true; } }));
  if (muutos) klooniTallenna(d);
  return muutos;
}
