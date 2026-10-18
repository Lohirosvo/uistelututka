/* ===== UISTELUTUTKA — OMA LUOTAUS: TALLENNUS JA RUUDUKKO (luotaus.js) =====
   v179 (10.10.2026): siirretty index.html:stä sellaisenaan. aaltomalli.js käyttää näitä syvyysruudukossa
   (puraSyvyysLuokat → omaLuotausKorvaa, kiertomallin avain → omaLuotausTarkiste, kloonit → omaLuotausSolut),
   joten ne tarvitaan kaikilla sivuilla, jotka käyttävät mallia. Tuonti (.sl2/.json) ja kortti ovat index.html:ssä.
   VERSIO: sivut lataavat tiedoston nimellä luotaus.js?v=NNN; NNN = sw.js:n VERSIO-numero. */

/* ===== OMA LUOTAUS KAIKULUOTAIMELTA — 7.10.2026 (v172) =====
   Hannu 7.10.2026 (vertailu muihin, idea 2: oma luotausdata syvyyspohjaksi; valinta "1, mutta 2
   on edelleen mahdollinen"): Lowrancen .sl2-tallenne luetaan puhelimessa ilman verkkoa, ja
   syvyysmallit käyttävät omaa luotausta MML:n syvyysluokkien sijaan niissä ruuduissa, joista sitä on.
   Vaihtoehto 2 (tallenteet käsitellään Clauden kanssa) tuodaan samaan paikkaan .json-tiedostona.
   SL2-RAKENNE (avoimesti dokumentoitu, tarkistettu Hannun tallenteella Sonar0012.sl2: 7443 kehystä,
   15 369 624 tavua luettu loppuun): tiedoston otsake 8 tavua (muoto u16 = 2), sitten kehykset,
   kaikki little-endian, kehyksen alusta: +28 kehyksen koko u16, +32 kanava u16, +64 syvyys f32
   (jalkaa, anturista), +100 GPS-nopeus f32 (solmua), +104 veden lämpö f32 (°C), +108/+112 itä/
   pohjoinen i32 (Lowrancen pallomercator, R = 6 356 752,3142 m), +140 aika u32 (ms tallenteen
   alusta). +60 u32: alkukehyksissä tallenteen alkuhetki unix-sekunteina, sen jälkeen sama kuin +140
   (v173: varmistettu Sonar0012.sl2 → 12.9.2026 12.35.37 UTC, Hannun ilmoitus 12.36).
   TALLENNUS: localStorage 'uistelututka_omaluotaus' (kulkee varmuuskopiossa), pisteet noin 5 m
   välein (≥ 1 s), syvyys anturista senttimetreinä ja anturin syvyys tuonnin mukana, jotta korjauksen
   voi myöhemmin muuttaa. Tunnin uistelu ≈ 700 pistettä ≈ 15 kt.
   SIJAINTI: tämä osa on pääkoodissa (kortti ja tuonti toimivat ennen kuin karttamoduuli on ladattu);
   karttapiirto akPiirraOmaLuotaus on moduulissa aaltokarttaAlusta.
   KÄYTTÖ: puraSyvyysLuokat korvaa ruudun syvyyden luotausten mediaanilla (kaikki karttamallit:
   aalto, virtaus, syvyyskartta, kuha- ja taimenehdokkaat), syvyysPisteessa yhdistää luotauksen
   MML-arvioon (nimettyjen paikkojen syvyysrivit), kiertomallin tallennusavaimeen tulee
   luotauksen tarkiste (kierto lasketaan uudelleen). Jälki näkyy kartan Syvyyskartta-tilassa. */
var OL_LS = 'uistelututka_omaluotaus', OL_ANTURI_LS = 'uistelututka_anturi_m';
function omaLuotausLue(){
  if (window.__olData !== undefined) return window.__olData;
  var d = null;
  // literaali, ei OL_LS: funktiota voidaan kutsua ennen kuin var-rivi on suoritettu
  try { d = JSON.parse(localStorage.getItem('uistelututka_omaluotaus') || 'null'); } catch (e) { d = null; }
  if (!d || !Array.isArray(d.tuonnit)) d = { versio: 1, tuonnit: [] };
  window.__olData = d;
  return d;
}
function omaLuotausNollaa(){ window.__olKivikkoV = (window.__olKivikkoV || 0) + 1; window.__olData = undefined; window.__olPisteet = null; window.__olSolut = null; window.__olTuoreet = null; }
function omaLuotausPisteet(){   // kaikki pisteet anturikorjattuina
  if (window.__olPisteet) return window.__olPisteet;
  var out = [];
  omaLuotausLue().tuonnit.forEach(function(t){
    var a = typeof t.anturiM === 'number' ? t.anturiM : 0;
    for (var i = 0; i < t.lat.length; i++) out.push({ lat: t.lat[i] / 1e6, lon: t.lon[i] / 1e6, syv: t.syv[i] / 100 + a });
  });
  window.__olPisteet = out;
  return out;
}
// Ruudukon k ruudut, joissa on luotausta: { solut: {q: mediaani}, soluja, pisteita, tarkiste }
function omaLuotausSolut(k){
  if (!k || !k.W) return null;
  var vm = window.__olSolut || (window.__olSolut = new WeakMap());
  if (vm.has(k)) return vm.get(k);
  var P = omaLuotausPisteet(), arvot = {}, n = 0, t = 0;
  for (var a = 0; a < P.length; a++){
    var p = P[a];
    var i = Math.floor((p.lon - k.lansiLon)*111320*Math.cos(p.lat*Math.PI/180)/k.ruutu), j = Math.floor((k.pohjoisLat - p.lat)*111320/k.ruutu);
    if (i < 0 || j < 0 || i >= k.W || j >= k.H) continue;
    var q = j*k.W + i;
    (arvot[q] || (arvot[q] = [])).push(p.syv);
    n++; t = (t*31 + Math.round(p.syv*100) + q) % 1000000007;
  }
  var solut = {}, m = 0;
  Object.keys(arvot).forEach(function(q){
    var v = arvot[q].sort(function(x, y){ return x - y; }), h = v.length >> 1;
    solut[q] = v.length % 2 ? v[h] : (v[h - 1] + v[h]) / 2; m++;
  });
  var r = { solut: solut, soluja: m, pisteita: n, tarkiste: n ? n + ':' + t : '' };
  vm.set(k, r);
  return r;
}
// Kutsutaan puraSyvyysLuokat-funktiosta: vain vesiruudut (s > 0) korvataan
function omaLuotausKorvaa(k, s){
  var r = omaLuotausSolut(k);
  if (!r || !r.soluja) return 0;
  var c = 0;
  for (var q in r.solut){ var qi = +q; if (s[qi] > 0){ s[qi] = r.solut[q]; c++; } }
  return c;
}
// Pisteen ympäriltä (sadeM) luotausten min/max; vähintään 3 pistettä
function omaLuotausMinMax(lat, lon, sadeM){
  var P = omaLuotausPisteet(); if (!P.length) return null;
  var r = sadeM || 300, dLat = r/111320, kx = 111320*Math.cos(lat*Math.PI/180), dLon = r/kx, mn = Infinity, mx = -Infinity, n = 0;
  for (var a = 0; a < P.length; a++){
    var p = P[a];
    if (Math.abs(p.lat - lat) > dLat || Math.abs(p.lon - lon) > dLon) continue;
    var dy = (p.lat - lat)*111320, dx = (p.lon - lon)*kx;
    if (dx*dx + dy*dy > r*r) continue;
    if (p.syv < mn) mn = p.syv; if (p.syv > mx) mx = p.syv; n++;
  }
  return n >= 3 ? { min: mn, max: mx, n: n, lahde: 'oma luotaus' } : null;
}
function omaLuotausYhdista(a, oma){
  if (!oma) return a;
  if (!a) return oma;
  return { min: Math.min(a.min, oma.min), max: Math.max(a.max, oma.max), n: (a.n || 0) + oma.n, lahde: (a.lahde || '') + ' + oma luotaus' };
}
function omaLuotausTarkiste(k){ try { var r = omaLuotausSolut(k); return r ? r.tarkiste : ''; } catch (e) { return ''; } }


/* ===== v193 (11.10.2026): LÄMPÖJÄLKI JA PARVET TALLENTEISTA (tilannekuva) =====
   Tuonnit, joilla on aika (alku), enintään maxIkaMs vanhat (oletus 7 vrk), järvi avaimella. Lämpö °C, aika ms.
   Tallenteen pisteillä lampo (sadasosa-asteina) ja aikaS (sekuntia alusta) v193:sta alkaen; vanhemmissa ei ole. */
function omaLuotausTuoreet(avain, maxIkaMs){   // v194: kalat (omaLuotausKalat) samasta välimuistista
  var raja = Date.now() - (maxIkaMs || 7*86400e3), k = (avain || '') + '|' + Math.floor(raja/600000);
  if (window.__olTuoreet && window.__olTuoreet.k === k) return window.__olTuoreet.t;
  var t = omaLuotausLue().tuonnit.filter(function(x){ return x.alku && x.alku >= raja && (!avain || x.jarvi === avain); });
  window.__olTuoreet = { k: k, t: t };
  return t;
}
function omaLuotausLampoJalki(avain, maxIkaMs){   // { pisteet: [{ lat, lon, c, t, nimi }], min, max }
  var out = [], mn = Infinity, mx = -Infinity;
  omaLuotausTuoreet(avain, maxIkaMs).forEach(function(t){
    if (!Array.isArray(t.lampo)) return;
    for (var i = 0; i < t.lat.length; i++){
      var v = t.lampo[i]; if (v === null || v === undefined) continue;
      var c = v/100; if (c < mn) mn = c; if (c > mx) mx = c;
      out.push({ lat: t.lat[i]/1e6, lon: t.lon[i]/1e6, c: c, t: Array.isArray(t.aikaS) ? t.alku + t.aikaS[i]*1000 : null, nimi: t.nimi });
    }
  });
  return { pisteet: out, min: out.length ? mn : null, max: out.length ? mx : null };
}
function omaLuotausParvet(avain, maxIkaMs){
  var out = [];
  omaLuotausTuoreet(avain, maxIkaMs).forEach(function(t){
    var a = omaLuotausAnturi(t), r1 = function(v){ return Math.round(v*10)/10; };
    (t.parvet || []).forEach(function(p){
      var q = {}; for (var k in p) q[k] = p[k]; q.nimi = t.nimi;
      // v194: syvyydet pinnasta (tallenne mittaa anturista; laitteen näyttö lisää anturin syvyyden). Pohjaksi luetun pohja on kartasta.
      if (typeof q.yla === 'number') q.yla = r1(q.yla + a);
      if (typeof q.ala === 'number') q.ala = r1(q.ala + a);
      if (q.tyyppi !== 'pohjaksi' && typeof q.pohja === 'number') q.pohja = r1(q.pohja + a);
      out.push(q);
    });
  });
  return out;
}
/* ===== v194 (11.10.2026): YKSITTÄISET KALAT TALLENTEISTA (index.html olKalat) =====
   Kala: { aikaS, t, lat, lon, z (huippu anturista), pohja (anturista), yl (kaiun ylitys taustasta), luokka iso/keski/pieni,
   kaari (täysi kaari), lahella pohja/parvi/vali, parviM }. Täältä syvyydet pinnasta (zP, pohjaP) ja tallenteen nimi. */
function omaLuotausAnturi(t){ return typeof t.anturiM === 'number' ? t.anturiM : 0; }
function omaLuotausKalaLuokat(K){
  var r = { iso: 0, keski: 0, pieni: 0 };
  (K || []).forEach(function(k){ if (r[k.luokka] !== undefined) r[k.luokka]++; });
  return r;
}
function omaLuotausKalat(avain, maxIkaMs){
  var out = [];
  omaLuotausTuoreet(avain, maxIkaMs).forEach(function(t){
    var a = omaLuotausAnturi(t);
    (t.kalat || []).forEach(function(k){
      var q = {}; for (var x in k) q[x] = k[x];
      q.zP = Math.round((k.z + a)*10)/10; q.pohjaP = Math.round((k.pohja + a)*10)/10; q.nimi = t.nimi; q.med = t.kalaMed; q.jarvi = t.jarvi; q.anturi = a;
      out.push(q);
    });
  });
  return out;
}
/* Lajiepäily olosuhteista (Hannu 11.10.: "mahdollisen lajin epäilyt"; valinta: epäily olosuhteista, todisteen taso näkyviin).
   Kaikuluotain ei tunnista lajia: tämä on olosuhdepäätelmä lajien tavallisista elintavoista, ei tunnistus.
   Lappajärvi (Järviseudun kalatalousalueen käyttö- ja hoitosuunnitelma 2022): kuha merkittävin, kuore ja muikku tärkeimmät
   ulappalajit, järvilohi ja järvitaimen lähes kokonaan istutusten varassa, myös ahven, hauki, made, siika, lahna ja särki.
   Saalistajat seuraavat muikku- ja kuoreparvia; made ja lahna ovat pohjan kaloja. Muilla järvillä yleinen luettelo. */
function omaLuotausKalaLaji(k, avain){
  var r0 = omaLuotausKalaLaji0(k, avain);
  if (typeof k.kivikko === 'number'){   // v197: sivukeilan kivikko lähimmästä 10 m:n jaksosta (enintään 25 m)
    var l = omaLuotausKivikkoLuokka(k.kivikko), p = typeof k.pohjaP === 'number' ? k.pohjaP : null;
    r0.kivikko = 'pohja sivukeilassa: ' + l.nimi + ' (' + (Math.round(k.kivikko*10)/10).toLocaleString('fi-FI') + ' kiveä / 100 m²'
      + (k.kiviMaxH >= 0.2 ? ', suurin noin ' + (Math.round(k.kiviMaxH*10)/10).toLocaleString('fi-FI') + ' m' : '') + ')'
      + (l.taso >= 2 && p !== null && p <= OL_TAIMENKIVIKKO_M ? ' · taimenkivikko (0–5 m)' : '');
  }
  return r0;
}
/* ===== v216 (18.10.2026): KAIKUJEN LAJIRYHMÄT OLOSUHTEISTA — KAUSITTAIN JA JÄRVITTÄIN =====
   Hannu 18.10.: "Hauki ahven kuha järvilohi kortteihin voisi jotain tehdä. Ei nyt suoraan voi sanoa mikä laji …" ja
   "Malli saisi toimia koko kauden. Tehdään ensin tämä syksyn malli mutta tehdään sitä muistaen koko avovesikausi."
   EI LAJITUNNISTUS: kaiku ryhmitellään paikan mukaan (pohjan tuntumassa / välivedessä / parven luona, pohjan syvyys pinnasta).
   Tutkimuksissakin lajit jaetaan kaiuille koon ja elinympäristön mukaan pyyntisaaliiden avulla (Yule ym. 2013, Fish. Res.).
   Rakenne: OL_LAJISAANNOT[järvi][kausi] = säännöt; kausi = sovelluksen kausi (spring, earlysummer, midsummer, autumn).
   Nyt vain Lappajärven syksy (Hannun tallenteet 11. ja 17.10.2026). Muut kaudet ja järvet lisätään samaan taulukkoon, kun
   niistä on havaintoja tai Hannun tieto; ilman sääntöä korttiin ei tule riviä eikä napautus muutu.
   Muistiin kesää varten (ei toteutettu): harppauskerros erottelee kesällä kuhan (yläpuolella) ja järvilohen (viileämpi vesi);
   hauki kasvillisuudessa (DownScan); pintakatve (ylin 1,75 m, OLK.Z + anturi) haittaa vähemmän, kun lohikalat ovat syvemmällä.
   Hirvijärvellä kuhapaikat ovat 2,5–3,5 m:n vedessä (Hannu), joten kuhan pohjaraja ei voi olla yhteinen kaikille järville.
   Säännön kentät: kortit (lajikortit, joille kaiku kuuluu, ja kokoluokat kortille), lahella (pohja/vali/parvi), pohjaMin/pohjaMax
   (pohja pinnasta, m), lajit (epäily), peruste, todiste (oma havainto), napautus (true = korvaa tilannekuvan napautuksen epäilyn). */
var OL_LAJISAANNOT = {
  lappajarvi: {
    autumn: [
      { ryhma: 'kuha', kortit: { kuha: ['iso', 'keski'] }, lahella: ['pohja'], pohjaMin: 6,
        lajit: 'kuha, made tai lahna', peruste: 'pohjan tuntumassa vähintään 6 m:n vedessä (kuha siirtyy syksyllä syvemmälle)' },
      { ryhma: 'matala', kortit: { hauki: ['iso', 'keski'], ahven: ['iso'] }, lahella: ['pohja'], pohjaMax: 5, napautus: true,
        lajit: 'hauki, ahven, made tai lahna', peruste: 'pohjan tuntumassa alle 5 m:n vedessä',
        todiste: 'oma havainto: 17.10. ahven ja 11.10. hauki saatiin 1–3 min kaiun jälkeen 60–210 m:n päästä' },
      { ryhma: 'ulappa', kortit: { jarvilohi: ['iso'] }, lahella: ['vali', 'parvi'], pohjaMin: 10,
        lajit: 'järvilohi, taimen, kuha, siika tai lahna', peruste: 'välivedessä tai syöttikalaparven luona yli 10 m:n vedessä',
        todiste: 'oma havainto: isot kaiut yleensä 0,5–3,7 m parven yläpinnan yläpuolella (11. ja 17.10.)' }
    ]
  }
};
var OL_PINTAKATVE_M = 1.75;   // OLK.Z 1,5 m anturista + anturi 0,25 m: ylempää kaikuja ei poimita (v194)
// Kausi: etusivulla sovelluksen kausi (answers.season), tilannekuvassa etusivun kirjauspohjasta, muuten kuukaudesta.
function omaLuotausKausi(){
  try { if (typeof answers === 'object' && answers && answers.season) return answers.season; } catch (e) {}
  try { var P = JSON.parse(localStorage.getItem('uistelututka_kirjauspohja') || 'null'); if (P && P.kentat && P.kentat.kausi) return P.kentat.kausi; } catch (e) {}
  var m = new Date().getMonth() + 1;
  return m >= 9 && m <= 11 ? 'autumn' : m >= 7 ? 'midsummer' : m === 6 ? 'earlysummer' : m >= 4 ? 'spring' : null;
}
// Kaiun sääntö (tai null). k: kaiku (z, pohja anturista; anturi tai pohjaP).
function omaLuotausLajiSaanto(k, avain, kausi){
  var S = (OL_LAJISAANNOT[avain] || {})[kausi || omaLuotausKausi()];
  if (!S) return null;
  var pohjaP = typeof k.pohjaP === 'number' ? k.pohjaP : k.pohja + (k.anturi || 0);
  for (var i = 0; i < S.length; i++){
    var s = S[i];
    if (s.lahella.indexOf(k.lahella) < 0) continue;
    if (typeof s.pohjaMin === 'number' && !(pohjaP >= s.pohjaMin)) continue;
    if (typeof s.pohjaMax === 'number' && !(pohjaP < s.pohjaMax)) continue;
    return s;
  }
  return null;
}
// Lajikortin havainto: kaiut, jotka kuuluvat kortille, tallenteista, jotka alkoivat enintään vrk vuorokautta ennen hetkeä.
function omaLuotausLajiHavainto(avain, kortti, hetkiMs, kausi, vrk){
  var raja = hetkiMs - (vrk || 7)*86400e3, R = { n: 0, iso: 0, keski: 0, z: [], pohja: [], viim: null, saanto: null };
  omaLuotausLue().tuonnit.forEach(function(t){
    if (t.jarvi !== avain || !t.alku || t.alku < raja || t.alku > hetkiMs || !Array.isArray(t.kalat)) return;
    var a = omaLuotausAnturi(t);
    t.kalat.forEach(function(k){
      var tt = k.t || (t.alku + k.aikaS*1000); if (tt > hetkiMs) return;
      var q = { lahella: k.lahella, z: k.z, pohja: k.pohja, anturi: a }, s = omaLuotausLajiSaanto(q, avain, kausi);
      if (!s || !s.kortit[kortti] || s.kortit[kortti].indexOf(k.luokka) < 0) return;
      R.n++; R[k.luokka] = (R[k.luokka] || 0) + 1; R.z.push(k.z + a); R.pohja.push(k.pohja + a); R.saanto = s;
      if (!R.viim || tt > R.viim) R.viim = tt;
    });
  });
  if (!R.n) return null;
  R.z.sort(function(x, y){ return x - y; });
  R.zMin = R.z[0]; R.zMax = R.z[R.z.length - 1]; R.zMed = R.z.length % 2 ? R.z[R.z.length >> 1] : (R.z[R.z.length/2 - 1] + R.z[R.z.length/2]) / 2;
  R.pohjaMin = Math.min.apply(null, R.pohja); R.pohjaMax = Math.max.apply(null, R.pohja);
  return R;
}
function omaLuotausKalaLaji0(k, avain){
  var L = avain === 'lappajarvi', n1 = function(v){ return (Math.round(v*10)/10).toLocaleString('fi-FI'); };
  var sv = omaLuotausLajiSaanto(k, avain);   // v216: kausi- ja järvikohtainen sääntö, jos se korvaa napautuksen epäilyn
  if (sv && sv.napautus){
    var ero0 = k.pohja - k.z;
    return { lajit: sv.lajit, peruste: sv.peruste + ' (' + n1(ero0) + ' m pohjasta)' + (sv.todiste ? '; ' + sv.todiste : ''),
             varaus: k.lahella === 'pohja' && ero0 <= 0.5 ? 'Näin lähellä pohjaa kaari voi olla myös kivi tai pohjan muoto; sama kohta usealla ajolla viittaa kiveen.' : '' };
  }
  if (k.lahella === 'pohja'){
    var ero = k.pohja - k.z;
    return { lajit: 'kuha, made tai lahna', peruste: 'pohjan tuntumassa (' + n1(ero) + ' m pohjasta)',
             varaus: ero <= 0.5 ? 'Näin lähellä pohjaa kaari voi olla myös kivi tai pohjan muoto; sama kohta usealla ajolla viittaa kiveen.' : '' };
  }
  if (k.lahella === 'parvi') return { lajit: L ? 'kuha, taimen, järvilohi tai hauki' : 'kuha tai hauki (lohikala, jos järvessä on)',
                                      peruste: 'syöttikalaparven liepeillä' + (typeof k.parviM === 'number' ? ' (' + k.parviM + ' m)' : ''), varaus: '' };
  var mp = k.muuParvi, a = k.anturi || 0;
  return { lajit: L ? 'taimen, järvilohi, kuha, siika tai lahna' : 'kuha, hauki, siika tai lahna',
           peruste: mp ? 'välivedessä; syöttikalaparvi ' + mp.m + ' m:n päässä eri syvyydessä (' + n1(mp.yla + a) + '–' + n1(mp.ala + a) + ' m)' : 'välivedessä, ei syöttikalaparvea lähellä', varaus: '' };
}
/* Syvyys × kellonaika kaikista tämän järven tallenteista (iästä riippumatta): tunneittain tallennetut minuutit ja kalat
   syvyysluokittain pinnasta. Hannu 11.10.: "Niiden esiintymissyvyyden eri kellonaikoina". */
var OL_SYVLUOKAT = [[0, 3, '≤ 3 m'], [3, 6, '3–6 m'], [6, 9, '6–9 m'], [9, 12, '9–12 m'], [12, 999, 'yli 12 m']];
// v207: avain null ja vainTunnistamattomat = vain tallenteet, joiden järveä ei tunnistettu (ennen: null = kaikki tallenteet,
// jolloin "ei tunnistettu järvi" -taulukko laski yhteen kaikki; Hannun varmuuskopiossa 17.10. 23 tallennetta / 2000 kalaa, oikein 2 / 17)
function omaLuotausKalaKooste(avain, vainTunnistamattomat){
  var tunnit = {}, tallenteita = 0, kaloja = 0;
  omaLuotausLue().tuonnit.forEach(function(t){
    if (!Array.isArray(t.kalat) || !t.alku || (avain && t.jarvi !== avain) || (vainTunnistamattomat && t.jarvi)) return;
    tallenteita++;
    var a = omaLuotausAnturi(t), h = function(ms){ var x = tunnit[new Date(ms).getHours()]; if (!x) x = tunnit[new Date(ms).getHours()] = { s: 0, n: OL_SYVLUOKAT.map(function(){ return 0; }), iso: OL_SYVLUOKAT.map(function(){ return 0; }) }; return x; };
    if (Array.isArray(t.aikaS)) for (var i = 1; i < t.aikaS.length; i++){ var dt = t.aikaS[i] - t.aikaS[i - 1]; if (dt > 0 && dt <= 120) h(t.alku + t.aikaS[i - 1]*1000).s += dt; }
    t.kalat.forEach(function(k){
      var z = k.z + a, j = 0; while (j < OL_SYVLUOKAT.length - 1 && z >= OL_SYVLUOKAT[j][1]) j++;
      var r = h(k.t || (t.alku + k.aikaS*1000)); r.n[j]++; if (k.luokka === 'iso') r.iso[j]++; kaloja++;
    });
  });
  return { tunnit: tunnit, tallenteita: tallenteita, kaloja: kaloja };
}
function omaLuotausViimeLampo(avain, maxIkaMs){   // uusin tallenne: { c (viimeisin), ka (keskilämpö), t (loppu), nimi }
  var paras = null;
  omaLuotausTuoreet(avain, maxIkaMs).forEach(function(t){
    if (typeof t.lampoViim !== 'number' || !Array.isArray(t.aikaS) || !t.aikaS.length) return;
    var loppu = t.alku + t.aikaS[t.aikaS.length - 1]*1000;
    if (!paras || loppu > paras.t) paras = { c: t.lampoViim, ka: t.lampoKa, t: loppu, nimi: t.nimi };
  });
  return paras;
}

/* ===== v197 (12.10.2026): KIVIKKO SIVUKEILASTA (index.html olKiviLaske) =====
   Jakso (10 m matkaa): { lat, lon, t, aikaS, syv (anturista), kivet, ala (m²), maxH, tiheys (kiveä / 100 m² tai null) }.
   Pohja ei muutu, joten kerros käyttää kaikkia tämän järven tallenteita iästä riippumatta.
   Taimenkivikko: kivikko (vähintään 3 kiveä / 100 m²) enintään 5 m:n syvyydessä pinnasta. Hannu 12.10.: "Lappajärvellä
   0–5 m kivikko, kirkkaammissa vesissä varmaan enemmän." Raja on Hannun kokemus Lappajärveltä; muilla järvillä sama
   5 m, kunnes näkösyvyyteen sidottu raja tarkistetaan. Kuhalle ja ahvenelle kivikkoa ei korosteta ("Kuhalle käy kaikki"). */
var OL_TAIMENKIVIKKO_M = 5;
function omaLuotausKivikkoLuokka(ti){
  if (ti === null || ti === undefined) return { nimi: 'ei arvioitavissa', taso: -1 };
  if (ti < 1) return { nimi: 'ei kiviä', taso: 0 };
  if (ti < 3) return { nimi: 'harvakseltaan kiviä', taso: 1 };
  if (ti < 8) return { nimi: 'kivikko', taso: 2 };
  return { nimi: 'tiheä kivikko', taso: 3 };
}
function omaLuotausKivikko(avain){
  var k = (avain || '') + '|' + (window.__olKivikkoV || 0);
  if (window.__olKivikko && window.__olKivikko.k === k) return window.__olKivikko.j;
  var out = [];
  omaLuotausLue().tuonnit.forEach(function(t){
    if (!t.kivikko || !Array.isArray(t.kivikko.jaksot) || (avain && t.jarvi !== avain)) return;
    var a = omaLuotausAnturi(t);
    t.kivikko.jaksot.forEach(function(j){
      if (j.tiheys === null || j.tiheys < 1) return;
      var p = Math.round((j.syv + a)*10)/10, l = omaLuotausKivikkoLuokka(j.tiheys);
      out.push({ lat: j.lat, lon: j.lon, t: j.t, tiheys: j.tiheys, maxH: j.maxH, kivet: j.kivet, ala: j.ala, pohjaP: p, luokka: l.nimi, taso: l.taso,
                 taimen: l.taso >= 2 && p <= OL_TAIMENKIVIKKO_M, nimi: t.nimi });
    });
  });
  window.__olKivikko = { k: k, j: out };
  return out;
}
