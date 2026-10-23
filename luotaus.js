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
function omaLuotausNollaa(){ window.__olKivikkoV = (window.__olKivikkoV || 0) + 1; window.__olData = undefined; window.__olPisteet = null; window.__olSolut = null; window.__olTuoreet = null; window.__olJalki = null; }
function omaLuotausPisteet(){   // kaikki pisteet anturikorjattuina; v229: + tiiviin muistin syvyysruudut (n = pisteiden määrä)
  if (window.__olPisteet) return window.__olPisteet;
  var out = [], d = omaLuotausLue();
  d.tuonnit.forEach(function(t){
    var a = typeof t.anturiM === 'number' ? t.anturiM : 0;
    for (var i = 0; i < t.lat.length; i++) out.push({ lat: t.lat[i] / 1e6, lon: t.lon[i] / 1e6, syv: t.syv[i] / 100 + a });
  });
  var M = d.muisti && d.muisti.jarvet;
  if (M) Object.keys(M).forEach(function(av){ (M[av].syv || []).forEach(function(e){ out.push({ lat: e[0] / 1e5, lon: e[1] / 1e5, syv: e[2] / 100, n: e[3] || 1 }); }); });
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
    var q = j*k.W + i, w = p.n || 1;
    (arvot[q] || (arvot[q] = [])).push(w > 1 ? [p.syv, w] : p.syv);
    n++; t = (t*31 + Math.round(p.syv*100) + q + (w > 1 ? w*7 : 0)) % 1000000007;
  }
  var solut = {}, m = 0;
  Object.keys(arvot).forEach(function(q){
    var A = arvot[q];
    if (A.every(function(x){ return typeof x === 'number'; })){
      var v = A.sort(function(x, y){ return x - y; }), h = v.length >> 1;
      solut[q] = v.length % 2 ? v[h] : (v[h - 1] + v[h]) / 2;
    } else {   // v229: painotettu mediaani (tiiviin muistin ruutu edustaa n pistettä)
      var P2 = A.map(function(x){ return typeof x === 'number' ? [x, 1] : x; }).sort(function(x, y){ return x[0] - y[0]; });
      var W2 = P2.reduce(function(s, x){ return s + x[1]; }, 0), c = 0, r2 = P2[P2.length - 1][0];
      for (var z = 0; z < P2.length; z++){ c += P2[z][1]; if (c >= W2/2){ r2 = P2[z][0]; break; } }
      solut[q] = r2;
    }
    m++;
  });
  // v228: tarkisteessa lähiruutujen säde, jotta v228:aa vanhempi kiertomallin välimuisti lasketaan uudelleen
  var r = { solut: solut, soluja: m, pisteita: n, tarkiste: n ? 'L' + OL_LAHI_M + ':' + n + ':' + t : '' };
  vm.set(k, r);
  return r;
}
/* v228 (21.10.2026): LÄHIRUUDUT TARKENTUVAT OMASTA LUOTAUKSESTA. Hannu 21.10.: "Odotin että kartta paranisi latausten
   myötä … Saisiko myös kartan parantumaan kuten Inarinjärvellä, oma data päivittymään". Ennen v228:aa vain ne ruudut, joissa
   on luotauspisteitä, saivat mitatun syvyyden (mediaani); viereiset ruudut jäivät kartan syvyysluokan keskiarvoon (esim. 3–6 m
   → 4,5 m), joten ajolinja näkyi kartassa erillisenä nauhana. Nyt jokainen mittaamaton vesiruutu enintään OL_LAHI_M päässä
   mitatuista saa niiden 1/d²-painotetun syvyyden (vähintään 25 m:n etäisyys), RAJATTUNA OMAN SYVYYSLUOKKANSA VÄLIIN (kartan
   luokka säilyy, luvun tarkkuus paranee; sama menetelmä kuin Inarin ja Ylä-Keiteleen karttakuvissa). Laskenta on kevyt
   (mitatut ruudut × 7 × 7), joten erillistä kotona ajettavaa vaihetta ei tarvita (mitattu, ks. tilannekuva v228).
   Ristiintarkistus Hannun tallenteilla (tallenne vuorollaan pois): ks. tilannekuva v228. */
var OL_LAHI_M = 150;
var OL_LUOKKA_VALI = { '0.75': [0, 1.5], '2.25': [1.5, 3], '4.5': [3, 6], '8': [6, 10], '12.5': [10, 15], '17.5': [15, 20], '22.5': [20, 25],
  '27.5': [25, 30], '32.5': [30, 35], '35': [30, 40], '37.5': [35, 40], '45': [40, 50], '55': [50, 60], '65': [60, Infinity] };
function omaLuotausLuokkaValit(k){   // [[ala, yla]] luokkaM:n järjestyksessä; tuntematon keskiarvo → puoliväli naapureihin
  var L = k && k.luokkaM; if (!L || !L.length) return null;
  var tunnetut = L.every(function(v){ return OL_LUOKKA_VALI[String(v)]; });
  return L.map(function(v, i){
    if (tunnetut) return OL_LUOKKA_VALI[String(v)];
    return [i ? (L[i - 1] + v)/2 : 0, i < L.length - 1 ? (v + L[i + 1])/2 : Infinity];
  });
}
// Kutsutaan puraSyvyysLuokat-funktiosta: vain vesiruudut (s > 0) korvataan
function omaLuotausKorvaa(k, s){
  var r = omaLuotausSolut(k);
  if (!r || !r.soluja) return 0;
  var c = 0;
  for (var q in r.solut){ var qi = +q; if (s[qi] > 0){ s[qi] = r.solut[q]; c++; } }
  r.lahiRuutuja = omaLuotausLahiruudut(k, s, r);   // v228
  return c;
}
function omaLuotausLahiruudut(k, s, r){   // v228: palauttaa tarkentuneiden ruutujen määrän
  var V = omaLuotausLuokkaValit(k); if (!V || !(OL_LAHI_M > 0)) return 0;
  var W = k.W, H = k.H, R = Math.max(1, Math.round(OL_LAHI_M/k.ruutu)), an = k.anturiM || 0, L = k.luokkaM;
  var sw = new Float64Array(W*H), sd = new Float64Array(W*H), kosketut = [];
  for (var q in r.solut){
    var qi = +q, d = r.solut[q], j0 = Math.floor(qi/W), i0 = qi - j0*W;
    if (!(s[qi] > 0)) continue;
    for (var dj = -R; dj <= R; dj++) for (var di = -R; di <= R; di++){
      if (di*di + dj*dj > R*R) continue;
      var i = i0 + di, j = j0 + dj; if (i < 0 || j < 0 || i >= W || j >= H) continue;
      var q2 = j*W + i; if (!(s[q2] > 0) || r.solut[q2] !== undefined) continue;
      var m = Math.max(0.5, Math.sqrt(di*di + dj*dj))*k.ruutu, w = 1/(m*m);
      if (!sw[q2]) kosketut.push(q2);
      sw[q2] += w; sd[q2] += w*d;
    }
  }
  var n = 0;
  for (var a = 0; a < kosketut.length; a++){
    var q3 = kosketut[a], v = s[q3] - an, l = -1;
    for (var b = 0; b < L.length; b++) if (Math.abs(L[b] - v) < 1e-3){ l = b; break; }
    if (l < 0) continue;   // ei luokan keskiarvo (esim. jo korvattu) → ennallaan
    var e = sd[q3]/sw[q3] - an, lo = V[l][0], hi = V[l][1];
    s[q3] = Math.min(Math.max(e, lo), hi - 0.05) + an; n++;   // luokan sisällä (yläraja kuuluu seuraavaan luokkaan)
  }
  return n;
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
    if (p.syv < mn) mn = p.syv; if (p.syv > mx) mx = p.syv; n += p.n || 1;   // v229: muistin ruutu = n pistettä
  }
  return n >= 3 ? { min: mn, max: mx, n: n, lahde: 'oma luotaus' } : null;
}
function omaLuotausYhdista(a, oma){
  if (!oma) return a;
  if (!a) return oma;
  return { min: Math.min(a.min, oma.min), max: Math.max(a.max, oma.max), n: (a.n || 0) + oma.n, lahde: (a.lahde || '') + ' + oma luotaus' };
}
/* v228 (21.10.2026): kartan jälki vain viimeiseltä OL_JALKI_VRK vuorokaudelta. Hannu 21.10.: "Näyttö alkaa suttaantumaan
   reiteistä. 10 vrk olisi sopiva aika ilman haittaa." Jälki kertoo, mistä mitattu syvyys on; vanhemmat tallenteet ja tallenteet
   ilman aikaa (esim. syvyyskartasta luetut) ovat edelleen syvyysmallissa (omaLuotausPisteet), vain piirto jää pois. */
var OL_JALKI_VRK = 10;
function omaLuotausJalki(){
  var raja = Date.now() - OL_JALKI_VRK*86400e3, kk = Math.floor(raja/600000);
  if (window.__olJalki && window.__olJalki.k === kk) return window.__olJalki.p;
  var out = [];
  omaLuotausLue().tuonnit.forEach(function(t){
    if (!t.alku || t.alku < raja) return;
    var a = typeof t.anturiM === 'number' ? t.anturiM : 0;
    for (var i = 0; i < t.lat.length; i++) out.push({ lat: t.lat[i] / 1e6, lon: t.lon[i] / 1e6, syv: t.syv[i] / 100 + a });
  });
  window.__olJalki = { k: kk, p: out };
  return out;
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
      out.push({ lat: t.lat[i]/1e6, lon: t.lon[i]/1e6, c: c, t: Array.isArray(t.aikaS) ? t.alku + t.aikaS[i]*1000 : null, nimi: omaLuotausNimi(t) });   // v231: nimi + alku
    }
  });
  return { pisteet: out, min: out.length ? mn : null, max: out.length ? mx : null };
}
function omaLuotausParvet(avain, maxIkaMs){
  var out = [];
  omaLuotausTuoreet(avain, maxIkaMs).forEach(function(t){
    var a = omaLuotausAnturi(t), r1 = function(v){ return Math.round(v*10)/10; };
    (t.parvet || []).forEach(function(p){
      var q = {}; for (var k in p) q[k] = p[k]; q.nimi = omaLuotausNimi(t);
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
/* v218: parven luona (lahella 'parvi') olevalle kaiulle parven yläpinta samasta tallenteesta (±90 s, enintään 150 m, lähin ajassa),
   jotta "parven yläpuolella" voidaan päätellä myös silloin, kun kaiku on alle 2 m parven yläpuolella (järvilohi-epäily). Anturista. */
function omaLuotausParviYla(t, k){
  if (k.lahella !== 'parvi' || !Array.isArray(t.parvet)) return null;
  var kt = k.t || (t.alku + k.aikaS*1000), paras = null, pe = Infinity;
  t.parvet.forEach(function(p){
    if (p.tyyppi !== 'parvi' || typeof p.t !== 'number') return;
    var dt = Math.abs(p.t - kt); if (dt > 90000) return;
    var dy = (p.lat - k.lat) * 111320, dx = (p.lon - k.lon) * 111320 * Math.cos(k.lat * Math.PI / 180);
    if (Math.sqrt(dx*dx + dy*dy) > 150) return;
    if (dt < pe){ pe = dt; paras = p; }
  });
  return paras ? paras.yla : null;
}
function omaLuotausKalat(avain, maxIkaMs){
  var out = [];
  omaLuotausTuoreet(avain, maxIkaMs).forEach(function(t){
    var a = omaLuotausAnturi(t);
    (t.kalat || []).forEach(function(k){
      var q = {}; for (var x in k) q[x] = k[x];
      q.parviYla = omaLuotausParviYla(t, k);   // v218
      q.zP = Math.round((k.z + a)*10)/10; q.pohjaP = Math.round((k.pohja + a)*10)/10; q.nimi = omaLuotausNimi(t); q.med = t.kalaMed; q.jarvi = t.jarvi; q.anturi = a;
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
      { ryhma: 'kuha', kortit: { kuha: ['iso', 'keski'] }, lahella: ['pohja'], pohjaMin: 6, vari: '#ffa53d', nimi: 'kuha',
        lajit: 'kuha, made tai lahna', peruste: 'pohjan tuntumassa vähintään 6 m:n vedessä (kuha siirtyy syksyllä syvemmälle)' },
      { ryhma: 'matala', kortit: { hauki: ['iso', 'keski'], ahven: ['iso'] }, lahella: ['pohja'], pohjaMax: 5, napautus: true, vari: '#7bd389', nimi: 'hauki tai ahven',
        lajit: 'hauki, ahven, made tai lahna', peruste: 'pohjan tuntumassa alle 5 m:n vedessä',
        todiste: 'oma havainto: 17.10. ahven ja 11.10. hauki saatiin 1–3 min kaiun jälkeen 60–210 m:n päästä; Hannu: matalassa ahvenia kiloon ja haukia noin 2 kg:aan asti' },   // v217: Hannu 18.10.
      // v218: Hannu 19.10.: "Myös järvilohi ja taimen epäily saisi erottua." Ennen ulappaa (ensimmäinen osuva sääntö voittaa).
      { ryhma: 'lohi', kortit: { jarvilohi: ['iso'] }, lahella: ['vali', 'parvi'], pohjaMin: 10, parvenYlla: true, napautus: true, vari: '#b388ff', nimi: 'järvilohi-epäily',
        lajit: 'järvilohi, taimen tai kuha', peruste: 'syöttikalaparven yläpuolella yli 10 m:n vedessä',
        todiste: 'oma havainto: isot kaiut yleensä 0,5–3,7 m parven yläpinnan yläpuolella (11. ja 17.10.); Hannu: järvilohi Lintuselällä 15–20 m:n veden päällä' },
      { ryhma: 'taimen', kortit: {}, lahella: ['vali'], pohjaMax: 5, napautus: true, vari: '#ff6fb1', nimi: 'taimen-epäily',
        lajit: 'taimen, ahven tai hauki', peruste: 'välivedessä rantavyöhykkeellä (pohja alle 5 m)',
        todiste: 'Hannu: syksyn taimenet 1,2–4 m:n syvyydessä; luotain näkee vasta 1,75 m:stä, joten pintaa uiva taimen ei näy' },
      { ryhma: 'ulappa', kortit: { jarvilohi: ['iso'] }, lahella: ['vali', 'parvi'], pohjaMin: 10, vari: '#ff5a5f', nimi: 'laji avoin',
        lajit: 'järvilohi, taimen, kuha, siika tai lahna', peruste: 'välivedessä tai syöttikalaparven luona yli 10 m:n vedessä',
        todiste: 'oma havainto: isot kaiut yleensä 0,5–3,7 m parven yläpinnan yläpuolella (11. ja 17.10.)' }
    ]
  }
};
/* v218 (19.10.2026): SYÖTTIKALAPARVIEN LAJIEPÄILY samalla periaatteella (Hannu 19.10.: "Voidaanko parvien syvyydestä, sijainnista ja
   muodosta sekä kellonajasta, lämpötilavyöhykkeestä epäillä lajia … ahven muikku salakka kuore?" ja "Pallomaista parvea on pidetty
   muikkuna. Erotellaan eri väreillä epäilyt tilannekuvaan."). Tutkittu: muikku ja kuore parvina päivällä, yöllä hajaantuvat ja nousevat
   (Jurvelius ym. 2000, kaksi suomalaista järveä); ahven syksyllä syvemmälle ja päivällä pohjassa (Eckmann & Imbrock 1996).
   Pallomuoto 2D-kaikukuvasta: veneen alittama poikkileikkaus, pituus korjataan keilan leveydellä (0,35 × syvyys, noin 20° keila,
   arvio) ja verrataan korkeuteen. Lyhyt parvi voi olla myös reunalta ylitetty, joten raja on säädettävä (OL_PALLO).
   Lämpötila erottelee vasta kesän kerrostuneisuudessa ja vaatii syvyyden lämmön (ei luotaimesta). Salakka on kesällä pinnassa
   (pintakatve); parvi tunnistetaan vasta 1,75 m:stä 0,8 m pohjan yläpuolelle ja vähintään 0,7 m paksuna, joten alle noin 3,3 m:n
   vedessä parvia ei löydy lainkaan. */
/* v219 (19.10.2026): Lappajärvellä kuore ensin. Hannu 19.10.: saaliskalojen vatsoissa kuoretta PALJON enemmän kuin muikkua ("varma
   tieto"). Lähteet: tehokalastuksessa 2001–2004 kuoretta 322,7 t ja muikkua 23,5 t, minkä jälkeen kuore harveni ja muikku runsastui
   (Teppo ym. 2010, Etelä-Pohjanmaan ELY 3/2010); kalatalousalueen KHS-ehdotus 2022: lajien suhteesta ei ole tutkimustietoa.
   Pallosääntö pysyy muikkuna (Hannun kokemus). Lajin runsaus ei nimeä yksittäistä parvea, joten molemmat lajit jäävät nimeen. */
var OL_KUORE_TODISTE = 'oma havainto (Hannu 19.10.): saaliskalojen vatsoissa kuoretta paljon enemmän kuin muikkua; tehokalastuksessa 2001–2004 kuoretta 323 t, muikkua 24 t (Teppo ym. 2010)';
var OL_PALLO = { suhde: 1.0, korkeusMin: 1.5, keila: 0.35 };
var OL_PARVISAANNOT = {
  lappajarvi: {
    autumn: [
      { ryhma: 'muikku', pallo: true, vari: '#7fd4ff', nimi: 'muikku (pallo)', lajit: 'muikku',
        peruste: 'pallomainen parvi (pituus keilalla korjattuna enintään korkeus)', todiste: 'konsensus: pallomaista parvea pidetään muikkuna (Hannu)' },
      { ryhma: 'ulappa', pohjaValiMin: 2, vari: '#ffd166', nimi: 'kuore tai muikku', lajit: 'kuore tai muikku',
        peruste: 'välivedessä, alapinta vähintään 2 m pohjasta', todiste: 'tutkittu: muikku ja kuore parvina ulapalla päivällä (Jurvelius ym. 2000); ' + OL_KUORE_TODISTE },
      { ryhma: 'pohja', pohjaValiMax: 1, vari: '#c0ca33', nimi: 'kuore, ahven tai muikku', lajit: 'kuore, ahven tai muikku',
        peruste: 'pohjan tuntumassa, alapinta alle 1 m pohjasta', todiste: 'tutkittu: ahven päivällä pohjassa (Eckmann & Imbrock 1996); myös muikku ja kuore painuvat päivällä pohjaan (Jurvelius ym. 2000)' }
    ]
  }
};
// Parven sääntö (tai null). p: parvi anturista (yla, ala, pohja, pituusM); 1–2 m pohjasta jää ilman sääntöä (epäselvä).
function omaLuotausParviSaanto(p, avain, kausi){
  var S = (OL_PARVISAANNOT[avain] || {})[kausi || omaLuotausKausi()];
  if (!S || p.tyyppi === 'pohjaksi' || typeof p.yla !== 'number' || typeof p.ala !== 'number') return null;
  var H = p.ala - p.yla, z = (p.ala + p.yla) / 2, Lk = Math.max(0, (p.pituusM || 0) - OL_PALLO.keila * z), vali = typeof p.pohja === 'number' ? p.pohja - p.ala : null;
  for (var i = 0; i < S.length; i++){
    var s = S[i];
    if (s.pallo && !(H >= OL_PALLO.korkeusMin && Lk <= OL_PALLO.suhde * H)) continue;
    if (typeof s.pohjaValiMin === 'number' && !(vali !== null && vali >= s.pohjaValiMin)) continue;
    if (typeof s.pohjaValiMax === 'number' && !(vali !== null && vali < s.pohjaValiMax)) continue;
    return s;
  }
  return null;
}
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
    if (s.parvenYlla && !((k.muuParvi && typeof k.muuParvi.yla === 'number' && k.z < k.muuParvi.yla - 0.3)
                          || (typeof k.parviYla === 'number' && k.z < k.parviYla - 0.3))) continue;   // v218: yli 0,3 m parven yläpinnan yläpuolella
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
      var q = { lahella: k.lahella, z: k.z, pohja: k.pohja, anturi: a, muuParvi: k.muuParvi, parviYla: omaLuotausParviYla(t, k) }, s = omaLuotausLajiSaanto(q, avain, kausi);
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
/* ===== v217 (18.10.2026): RANNAN JA SELÄN PINTALÄMPÖ OMASTA LUOTAIMESTA (taimenkortti) =====
   Hannu 18.10.: taimenkorttiin luotaimen rajoitus ja rantavyöhykkeen pintalämpö. Havainto 11.10.: ranta (alle 3 m) 0,6–0,8 °C selkää
   kylmempi samoilla puolen tunnin jaksoilla, kun ilma oli 6–8 °C vettä kylmempää; 17.10. ei eroa (ilma lähes veden lämpöinen).
   Uusin tallennepäivä enintään vrk vuorokautta ennen hetkeä. Ranta = pohja pinnasta alle OL_RANTA_M (taimenkivikon 0–5 m),
   selkä = vähintään OL_SELKA_M. Ero lasketaan vain puolen tunnin jaksoista, joilla molempia on vähintään 5 pistettä (kellonajan
   vaikutus pois). Lämpö mitataan anturilta (0,25 m), ei syvyydeltä. */
var OL_RANTA_M = 5, OL_SELKA_M = 8;
function omaLuotausRantaLampo(avain, hetkiMs, vrk){
  var raja = hetkiMs - (vrk || 7)*86400e3, P = [];
  omaLuotausLue().tuonnit.forEach(function(t){
    if (t.jarvi !== avain || !t.alku || t.alku < raja || t.alku > hetkiMs || !Array.isArray(t.lampo) || !Array.isArray(t.aikaS) || !Array.isArray(t.syv)) return;
    var a = omaLuotausAnturi(t);
    for (var i = 0; i < t.lampo.length; i++){
      var c = t.lampo[i], s = t.syv[i], ms = t.alku + t.aikaS[i]*1000;
      if (c === null || c === undefined || s === null || s === undefined || s <= 0 || ms > hetkiMs) continue;
      P.push({ ms: ms, c: c/100, p: s/100 + a });
    }
  });
  if (!P.length) return null;
  var viim = Math.max.apply(null, P.map(function(q){ return q.ms; })), d = new Date(viim), pv = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  P = P.filter(function(q){ return q.ms >= pv && q.ms < pv + 86400e3; });
  var ka = function(A){ return A.length ? A.reduce(function(s, q){ return s + q.c; }, 0) / A.length : null; };
  var R = P.filter(function(q){ return q.p < OL_RANTA_M; }), S = P.filter(function(q){ return q.p >= OL_SELKA_M; }), W = {};
  P.forEach(function(q){ var k = Math.floor(q.ms / 1800000), w = W[k] || (W[k] = { r: [], s: [] }); if (q.p < OL_RANTA_M) w.r.push(q); else if (q.p >= OL_SELKA_M) w.s.push(q); });
  var erot = [];
  Object.keys(W).forEach(function(k){ var w = W[k]; if (w.r.length >= 5 && w.s.length >= 5) erot.push(ka(w.r) - ka(w.s)); });
  return { pv: new Date(pv), ranta: ka(R), selka: ka(S), nRanta: R.length, nSelka: S.length,
           ero: erot.length ? erot.reduce(function(s, x){ return s + x; }, 0) / erot.length : null, jaksoja: erot.length,
           min: Math.min.apply(null, P.map(function(q){ return q.c; })), max: Math.max.apply(null, P.map(function(q){ return q.c; })) };
}
function omaLuotausKalaLaji0(k, avain){
  var L = avain === 'lappajarvi', n1 = function(v){ return (Math.round(v*10)/10).toLocaleString('fi-FI'); };
  var sv = omaLuotausLajiSaanto(k, avain);   // v216: kausi- ja järvikohtainen sääntö, jos se korvaa napautuksen epäilyn
  if (sv && sv.napautus){
    var ero0 = k.pohja - k.z, mp0 = k.muuParvi, a0 = k.anturi || 0;
    return { lajit: sv.lajit, vari: sv.vari, ryhma: sv.ryhma,
             peruste: sv.peruste + (k.lahella === 'pohja' ? ' (' + n1(ero0) + ' m pohjasta)' : mp0 ? ' (syöttikalaparvi ' + mp0.m + ' m:n päässä, ' + n1(mp0.yla + a0) + '–' + n1(mp0.ala + a0) + ' m)'
               : typeof k.parviYla === 'number' ? ' (parven yläpinta ' + n1(k.parviYla + a0) + ' m' + (typeof k.parviM === 'number' ? ', ' + k.parviM + ' m:n päässä' : '') + ')' : '')
               + (sv.todiste ? '; ' + sv.todiste : ''),
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
    if (!paras || loppu > paras.t) paras = { c: t.lampoViim, ka: t.lampoKa, t: loppu, nimi: omaLuotausNimi(t) };
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
                 taimen: l.taso >= 2 && p <= OL_TAIMENKIVIKKO_M, nimi: omaLuotausNimi(t) });
    });
  });
  // v229: tiiviin muistin kivikkoruudut (50 m, tihein jakso; anturi jo mukana)
  var M = omaLuotausLue().muisti, MJ = M && M.jarvet ? M.jarvet : {};
  Object.keys(MJ).forEach(function(av){
    if (avain && av !== avain) return;
    (MJ[av].kivikko || []).forEach(function(e){
      var p = e[3] / 100, l = omaLuotausKivikkoLuokka(e[4]);
      out.push({ lat: e[1] / 1e5, lon: e[2] / 1e5, t: e[0] ? e[0]*1000 : null, tiheys: e[4], maxH: e[5] / 100, kivet: e[6], ala: e[7], pohjaP: Math.round(p*10)/10,
                 luokka: l.nimi, taso: l.taso, taimen: l.taso >= 2 && p <= OL_TAIMENKIVIKKO_M, nimi: omaLuotausMuistiNimi(M, e[0] ? e[0]*1000 : null, av) });   // v231
    });
  });
  window.__olKivikko = { k: k, j: out };
  return out;
}
/* ===== v220 (19.10.2026): VIIMEISET 10 VRK TALLENTEISTA PAIKOITTAIN (Raportit, ottipaikkojen perustelut) =====
   Hannu 19.10.: "Raportteihin saisi laittaa luotauksista tehtyjä päätelmiä viimeisen 10 päivän ajalta eli jos perjantaina on käyty
   siitä muistellaan seuraavana sunnuntainakin." Valinta 19.10.: EI pisteitä, vain teksti, koska kaikkea ajoa ei voi tallentaa
   (.sl2:ssa muistikortin raja tulee vastaan): puuttuva tallenne ei tarkoita, ettei paikalla käyty.
   Alue = lähin annetuista paikoista, enintään maxM (päällekkäisyys pois: jokainen piste, kaiku ja parvi yhdelle paikalle).
   Uisteltu = tallenteen pisteet nopeudella 1–7 km/h (siirtoajo pois), väli enintään 120 s. Isot kaiut lajiepäilyn ryhmittäin
   (OL_LAJISAANNOT), parvet (OL_PARVISAANNOT). Ikkuna: tallenteen piste, kaiku tai parvi aikavälillä [hetki − vrk, hetki]. */
var OL_ALUE_M = 1500, OL_ALUE_VRK = 10;
function omaLuotausAlueet(avain, paikat, hetkiMs, vrk, maxM, kausi){
  vrk = vrk || OL_ALUE_VRK; maxM = maxM || OL_ALUE_M;
  var raja = hetkiMs - vrk*86400e3, T = omaLuotausLue().tuonnit;
  var ck = [avain, Math.floor(hetkiMs / 600000), vrk, maxM, kausi || '', T.length, window.__olKivikkoV || 0, paikat.map(function(p){ return p.key; }).join(',')].join('|');
  if (window.__olAlueet && window.__olAlueet.k === ck) return window.__olAlueet.r;
  var R = { raja: raja, loppu: hetkiMs, paivat: {}, tallenteita: 0, sek: 0, alueet: {} };
  paikat.forEach(function(p){ R.alueet[p.key] = { sek: 0, paivat: {}, kaiutN: 0, kaiut: {}, parvetN: 0, parvet: {} }; });
  var cosL = Math.cos((paikat.length ? paikat[0].lat : 63) * Math.PI / 180), m2 = maxM * maxM;
  function lahin(lat, lon){
    var paras = null, pe = m2;
    for (var i = 0; i < paikat.length; i++){
      var dy = (lat - paikat[i].lat) * 111320, dx = (lon - paikat[i].lon) * 111320 * cosL, e = dx*dx + dy*dy;
      if (e <= pe){ pe = e; paras = paikat[i].key; }
    }
    return paras;
  }
  function pv(ms){ var d = new Date(ms); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  T.forEach(function(t){
    if (t.jarvi !== avain || !t.alku || !Array.isArray(t.aikaS) || !t.aikaS.length) return;
    var loppuT = t.alku + t.aikaS[t.aikaS.length - 1]*1000;
    if (loppuT < raja || t.alku > hetkiMs) return;
    var mukana = false;
    for (var i = 1; i < t.lat.length; i++){
      var ms = t.alku + t.aikaS[i]*1000, dt = t.aikaS[i] - t.aikaS[i-1];
      if (ms < raja || ms > hetkiMs || dt <= 0 || dt > 120) continue;
      var la = t.lat[i]/1e6, lo = t.lon[i]/1e6, la0 = t.lat[i-1]/1e6, lo0 = t.lon[i-1]/1e6;
      var v = Math.sqrt(Math.pow((la - la0)*111320, 2) + Math.pow((lo - lo0)*111320*cosL, 2)) / dt * 3.6;
      mukana = true; R.paivat[pv(ms)] = 1;
      if (v < 1 || v > 7) continue;
      R.sek += dt;
      var k = lahin(la, lo); if (!k) continue;
      R.alueet[k].sek += dt; R.alueet[k].paivat[pv(ms)] = (R.alueet[k].paivat[pv(ms)] || 0) + dt;
    }
    if (!mukana) return;
    R.tallenteita++;
    var a = omaLuotausAnturi(t);
    (t.kalat || []).forEach(function(q){
      if (q.luokka !== 'iso') return;
      var ms = q.t || (t.alku + q.aikaS*1000); if (ms < raja || ms > hetkiMs) return;
      var k = lahin(q.lat, q.lon); if (!k) return;
      var s = omaLuotausLajiSaanto({ lahella: q.lahella, z: q.z, pohja: q.pohja, anturi: a, muuParvi: q.muuParvi, parviYla: omaLuotausParviYla(t, q) }, avain, kausi);
      var n = s ? s.nimi : 'muu';
      R.alueet[k].kaiutN++; R.alueet[k].kaiut[n] = (R.alueet[k].kaiut[n] || 0) + 1;
    });
    (t.parvet || []).forEach(function(p){
      if (p.tyyppi !== 'parvi') return;
      var ms = p.t || (t.alku + (p.aikaS || 0)*1000); if (ms < raja || ms > hetkiMs) return;
      var k = lahin(p.lat, p.lon); if (!k) return;
      var s = omaLuotausParviSaanto(p, avain, kausi), n = s ? s.nimi : 'epäselvä';
      R.alueet[k].parvetN++; R.alueet[k].parvet[n] = (R.alueet[k].parvet[n] || 0) + 1;
    });
  });
  window.__olAlueet = { k: ck, r: R };
  return R;
}
/* ===== v221 (19.10.2026): LAJIRYHMÄN ISOT KAIUT AIKAIKKUNASTA (järvilohireitin lenkki, tilanne.html) =====
   Hannu 19.10.: "Huomioidaan järvilohi epäiltyjen kaikuluotaus tulosten sijainnit apuna Kivijärven mallin kanssa vaikka
   pidentämällä ajettavaa ohjelenkkiä. Jos on 2 km säteellä. Näin pienellä otannalla se vaikutti lupaavalta."
   Isot kaiut, joiden sääntö (OL_LAJISAANNOT) on ryhmää ryhma, aikavälillä [hetki − vrk, hetki]. Syvyydet pinnasta. */
function omaLuotausRyhmaKaiut(avain, ryhma, hetkiMs, vrk, kausi){
  var raja = hetkiMs - (vrk || 10)*86400e3, out = [];
  omaLuotausLue().tuonnit.forEach(function(t){
    if (t.jarvi !== avain || !t.alku || t.alku > hetkiMs || !Array.isArray(t.kalat)) return;
    var a = omaLuotausAnturi(t);
    t.kalat.forEach(function(k){
      if (k.luokka !== 'iso') return;
      var ms = k.t || (t.alku + k.aikaS*1000); if (ms < raja || ms > hetkiMs) return;
      var s = omaLuotausLajiSaanto({ lahella: k.lahella, z: k.z, pohja: k.pohja, anturi: a, muuParvi: k.muuParvi, parviYla: omaLuotausParviYla(t, k) }, avain, kausi);
      if (!s || s.ryhma !== ryhma) return;
      out.push({ lat: k.lat, lon: k.lon, t: ms, z: Math.round((k.z + a)*10)/10, pohja: Math.round((k.pohja + a)*10)/10, nimi: omaLuotausNimi(t) });
    });
  });
  return out.sort(function(x, y){ return x.t - y.t; });
}


/* ===== v229 (21.10.2026): TIIVIS MUISTI — vanhat tallenteet tiivistetään, tila ei lopu =====
   Hannu 21.10.: "poistetaan yli 10 vrk tallenteet millä ei ole käyttöä joiden muutokset on jo kartassa kivikoissa jne" →
   (Claude: muutokset EIVÄT olleet pysyvästi kartassa, vaan ne laskettiin tallenteista joka kerta) → tiivistys ennen poistoa.
   "vuodenvanhat isot järvilohi ja taimen epäilykaiut samalta viikolta saisi näkyviin tulevina vuosina vaatisi niiden
   tallentamisen" → "Lisätään kuhakin joukkoon ja keskikokoiset oletus yli 40 cm kala" (Claude: kokoluokka on kaiun voimakkuudesta,
   pituutta ei ole kalibroitu) → "Kun tulee täyteen 3 % ennen vanhojen automaattinen poisto ettei kaadu" → "Tehdään".
   MUISTI d.muisti = { versio, tallenteet: [{ tunniste, id, nimi, jarvi, alku, pisteita, kestoS, tiivistetty }],
     jarvet: { avain|'_': { syv, kaiut, parvet, kivikko } } }, kaikki taulukkoina (ei kenttänimiä) tilan säästämiseksi:
     syv     [lat·1e5, lon·1e5, syvyys cm (anturi mukana), n]  — 50 m:n kiinteä ruutu (ei järven ruudukko, joka voi vaihtua);
             sama ruutu uudessa tiivistyksessä: n-painotettu keskiarvo; pisteet → omaLuotausPisteet (n-painotettu mediaani)
     kaiut   [t s, lat·1e5, lon·1e5, z cm, pohja cm, voimakkuus, 'i'|'k', kaari 0/1, lahella, parviM, muuParvi [m, yla dm, ala dm]|null,
              vesi °C·10|null, parviYla dm|null] — isot ja keskikokoiset kaikki (pohja = kuha, väli/parvi = järvilohi, taimen); lajisäännöt
             voi ajaa uudelleen. v230: 13 kenttää, syvyydet anturi mukana, vesi = pintalämpö kaiun hetkellä (lähin piste ajassa) ja
             parviYla (parven yläpinta, sääntö "parven yläpuolella"); v229:n 11 kentän riveissä syvyydet anturista, ei lämpöä.
     parvet  [t s, lat·1e5, lon·1e5, yla dm, ala dm, pohja dm, voima, tyyppi, pituusM, kestoS, vesi °C·10|null (v230)]
     kivikko [t s, lat·1e5, lon·1e5, syv cm (anturi mukana), tiheys, maxH cm, kivet, ala] — 50 m:n ruuduittain tihein jakso (≥ 1)
   POISTUU: pisteittäinen jälki (sijainti, syvyys, lämpö, aika), pienet kaiut, kiviyksityiskohdat, takila, pohjaksi luetut.
   Mitattu 18.10. varmuuskopiolla: ks. tilannekuva v229. Kokonaiset tallenteet säilyvät, kunnes ne tiivistetään (nappi:
   yli 10 vrk; automaattisesti, kun tila on 97 % täynnä: vanhin ensin). */
var OL_MUISTI_RUUTU_M = 50;
function omaLuotausMuistiRuutu(lat, lon){ return Math.floor(lat*111320/OL_MUISTI_RUUTU_M) + ':' + Math.floor(lon*111320*Math.cos(lat*Math.PI/180)/OL_MUISTI_RUUTU_M); }
function omaLuotausMuisti(d){
  if (!d.muisti || typeof d.muisti !== 'object') d.muisti = { versio: 1, tallenteet: [], jarvet: {} };
  if (!Array.isArray(d.muisti.tallenteet)) d.muisti.tallenteet = [];
  if (!d.muisti.jarvet) d.muisti.jarvet = {};
  return d.muisti;
}
function omaLuotausMuistissa(d, tunniste, id){
  var T = d && d.muisti && d.muisti.tallenteet; if (!T) return null;
  for (var i = 0; i < T.length; i++) if ((tunniste && T[i].tunniste === tunniste) || (id && T[i].id === id)) return T[i];
  return null;
}
var omaLuotausR1 = function(x){ return Math.round(x*10)/10; };
// Tiivistää valitut tuonnit muistiin ja poistaa ne d.tuonnit-listasta. Palauttaa { tallenteita, ennen, jalkeen } (merkkejä).
function omaLuotausTiivista(d, valitse, nyt){
  var ennen = JSON.stringify(d).length, M = omaLuotausMuisti(d), pois = d.tuonnit.filter(valitse);
  if (!pois.length) return { tallenteita: 0, ennen: ennen, jalkeen: ennen };
  var e5 = function(x){ return Math.round(x*1e5); }, s = function(ms){ return ms ? Math.round(ms/1000) : null; };
  var indeksit = {};
  pois.forEach(function(t){
    var av = t.jarvi || '_', J = M.jarvet[av] || (M.jarvet[av] = { syv: [], kaiut: [], parvet: [], kivikko: [] });
    ['syv', 'kaiut', 'parvet', 'kivikko'].forEach(function(x){ if (!Array.isArray(J[x])) J[x] = []; });
    // syvyys 50 m:n ruuduittain: mediaani ja painotettu keskisijainti
    var I = indeksit[av];
    if (!I){ I = indeksit[av] = {}; J.syv.forEach(function(e, n){ I[omaLuotausMuistiRuutu(e[0]/1e5, e[1]/1e5)] = n; }); }
    var a = typeof t.anturiM === 'number' ? t.anturiM : 0, R = {};
    for (var i = 0; i < t.lat.length; i++){
      var la = t.lat[i]/1e6, lo = t.lon[i]/1e6, q = omaLuotausMuistiRuutu(la, lo), r = R[q] || (R[q] = { la: 0, lo: 0, v: [] });
      r.la += la; r.lo += lo; r.v.push(t.syv[i]/100 + a);
    }
    Object.keys(R).forEach(function(q){
      var r = R[q], v = r.v.sort(function(x, y){ return x - y; }), h = v.length >> 1, m = v.length % 2 ? v[h] : (v[h - 1] + v[h])/2, n = v.length;
      var la = r.la/n, lo = r.lo/n;
      if (I[q] !== undefined){
        var e = J.syv[I[q]], n0 = e[3] || 1, N = n0 + n;
        e[0] = Math.round((e[0]*n0 + la*1e5*n)/N); e[1] = Math.round((e[1]*n0 + lo*1e5*n)/N); e[2] = Math.round((e[2]*n0 + m*100*n)/N); e[3] = N;
      } else { I[q] = J.syv.length; J.syv.push([e5(la), e5(lo), Math.round(m*100), n]); }
    });
    // isot ja keskikokoiset kaiut (kaikki sijainnit); v230: anturi mukaan, pintalämpö ja parven yläpinta
    var dC = function(v){ return typeof v === 'number' && isFinite(v) ? Math.round(v*10) : null; };
    (t.kalat || []).forEach(function(k){
      if (k.luokka !== 'iso' && k.luokka !== 'keski') return;
      var py = omaLuotausParviYla(t, k);
      J.kaiut.push([s(k.t || (t.alku ? t.alku + (k.aikaS || 0)*1000 : null)), e5(k.lat), e5(k.lon), Math.round(((k.z || 0) + a)*100), Math.round(((k.pohja || 0) + a)*100), k.yl,
                    k.luokka === 'iso' ? 'i' : 'k', k.kaari ? 1 : 0, k.lahella || null, typeof k.parviM === 'number' ? k.parviM : null,
                    k.muuParvi ? [k.muuParvi.m, Math.round((k.muuParvi.yla + a)*10), Math.round((k.muuParvi.ala + a)*10)] : null,
                    dC(omaLuotausHetkenLampo(t, k.aikaS)), typeof py === 'number' ? Math.round((py + a)*10) : null]);
    });
    (t.parvet || []).forEach(function(p){
      J.parvet.push([s(p.t), e5(p.lat), e5(p.lon), Math.round((p.yla || 0)*10), Math.round((p.ala || 0)*10), Math.round((p.pohja || 0)*10), p.voima, p.tyyppi, p.pituusM, p.kestoS,
                     dC(omaLuotausHetkenLampo(t, p.aikaS))]);
    });
    // kivikko: 50 m:n ruuduittain tihein jakso (tiheys ≥ 1)
    if (t.kivikko && Array.isArray(t.kivikko.jaksot)){
      var K = {};
      J.kivikko.forEach(function(e, n){ K[omaLuotausMuistiRuutu(e[1]/1e5, e[2]/1e5)] = n; });
      t.kivikko.jaksot.forEach(function(j){
        if (j.tiheys === null || j.tiheys === undefined || j.tiheys < 1) return;
        var q = omaLuotausMuistiRuutu(j.lat, j.lon), uusi = [s(j.t), e5(j.lat), e5(j.lon), Math.round((j.syv + a)*100), omaLuotausR1(j.tiheys), Math.round((j.maxH || 0)*100), j.kivet, j.ala];
        if (K[q] === undefined){ K[q] = J.kivikko.length; J.kivikko.push(uusi); }
        else if (J.kivikko[K[q]][4] < uusi[4]) J.kivikko[K[q]] = uusi;
      });
    }
    M.tallenteet.push({ tunniste: t.tunniste || null, id: t.id, nimi: t.nimi, jarvi: t.jarvi || null, alku: t.alku || null, pisteita: t.lat.length,
                        kestoS: t.kestoS || null, tiivistetty: nyt || Date.now(), lampoKa: omaLuotausKeskilampo(t), anturiM: a, tuotu: t.tuotu || null,
      loppu: t.alku && Array.isArray(t.aikaS) && t.aikaS.length ? t.alku + t.aikaS[t.aikaS.length - 1]*1000 : null });   // v230: lampoKa, anturiM; v231: tuotu, loppu (kaikujen ja kivikon tallenne)
  });
  d.tuonnit = d.tuonnit.filter(function(t){ return pois.indexOf(t) < 0; });
  return { tallenteita: pois.length, ennen: ennen, jalkeen: JSON.stringify(d).length };
}
function omaLuotausMuistiYhteenveto(d){
  var M = d && d.muisti; if (!M || !M.tallenteet || !M.tallenteet.length) return null;
  var y = { tallenteita: M.tallenteet.length, syv: 0, kaiut: 0, isot: 0, parvet: 0, kivikko: 0, alku: null, loppu: null, merkkeja: JSON.stringify(M).length };
  M.tallenteet.forEach(function(t){ if (t.alku){ if (!y.alku || t.alku < y.alku) y.alku = t.alku; if (!y.loppu || t.alku > y.loppu) y.loppu = t.alku; } });
  Object.keys(M.jarvet || {}).forEach(function(av){ var J = M.jarvet[av];
    y.syv += (J.syv || []).length; y.kaiut += (J.kaiut || []).length; y.isot += (J.kaiut || []).filter(function(e){ return e[6] === 'i'; }).length;
    y.parvet += (J.parvet || []).length; y.kivikko += (J.kivikko || []).length; });
  return y;
}

/* v230: pintalämpö tallenteen hetkellä (sekunteina alusta): lähin piste ajassa (t.aikaS, t.lampo sadasosa-asteina); jos pisteillä
   ei ole lämpöä, tallenteen keskilämpö (lampoKa tai lampoMin/Max puoliväli). */
function omaLuotausKeskilampo(t){
  if (typeof t.lampoKa === 'number') return Math.round(t.lampoKa*100)/100;
  if (typeof t.lampoMin === 'number' && typeof t.lampoMax === 'number') return Math.round((t.lampoMin + t.lampoMax)*50)/100;
  return null;
}
function omaLuotausHetkenLampo(t, aikaS){
  var A = t.aikaS, L = t.lampo;
  if (typeof aikaS === 'number' && Array.isArray(A) && Array.isArray(L) && A.length === L.length && A.length){
    var lo = 0, hi = A.length - 1;
    while (hi - lo > 1){ var m = (lo + hi) >> 1; if (A[m] < aikaS) lo = m; else hi = m; }
    var ehd = [lo, hi].sort(function(x, y){ return Math.abs(A[x] - aikaS) - Math.abs(A[y] - aikaS); });
    for (var e = 0; e < 2; e++){ var v = L[ehd[e]]; if (v !== null && v !== undefined && Math.abs(A[ehd[e]] - aikaS) <= 120) return v/100; }
  }
  return omaLuotausKeskilampo(t);
}

/* ===== v230 (21.10.2026): VUOSI SITTEN SAMASSA VEDESSÄ =====
   Hannu 21.10.: "Tehdään se vuosi sitten unohtuu muuten mutta pohditaan ensin olisiko helppo tehdä vuosisitten vastaavassa veden
   lämpötilassa? 1 asteen tarkkuudella olisi parempaa dataa." → valinnat 21.10. klo 5.48: jako lämpenevään ja jäähtyvään
   vuodenpuoliskoon heinäkuun puolivälistä: kyllä; lämmöttömille kaiuille kalenteriviikko ±7 vrk: kyllä ("oletan että on harvinaista").
   Aiempien vuosien (vuosi < nyt) isot ja keskikokoiset kaiut tältä järveltä, samalta vuodenpuoliskolta (lämpenevä 1.1.–15.7.,
   jäähtyvä 16.7.–31.12.), joiden pintavesi oli ±OL_VUOSI_LAMPO °C nykyisestä. Jos kaiulta puuttuu lämpö (v229:n tiivistys) tai
   nykyistä lämpöä ei tiedetä: kalenteripäivä ±OL_VUOSI_VRK. Lähteet: kokonaiset tallenteet ja tiivis muisti. */
var OL_VUOSI_LAMPO = 1.0, OL_VUOSI_VRK = 7;
function omaLuotausPuolisko(ms){ var d = new Date(ms), m = d.getMonth() + 1; return (m < 7 || (m === 7 && d.getDate() <= 15)) ? 'lampeneva' : 'jaahtyva'; }
function omaLuotausVuosiSitten(avain, nytMs, nytLampo){
  var nyt = new Date(nytMs), vuosi = nyt.getFullYear(), puol = omaLuotausPuolisko(nytMs), lampoOn = typeof nytLampo === 'number' && isFinite(nytLampo);
  var paivaEro = function(ms){
    var a = new Date(ms), A = Date.UTC(2001, a.getMonth(), a.getDate()), B = Date.UTC(2001, nyt.getMonth(), nyt.getDate()), e = Math.abs(A - B)/86400e3;
    return Math.min(e, 365 - e);
  };
  var peruste = function(tms, vesi){
    if (!tms || new Date(tms).getFullYear() >= vuosi || omaLuotausPuolisko(tms) !== puol) return null;
    if (lampoOn && typeof vesi === 'number') return Math.abs(vesi - nytLampo) <= OL_VUOSI_LAMPO + 1e-9 ? 'lampo' : null;
    return paivaEro(tms) <= OL_VUOSI_VRK ? 'kalenteri' : null;
  };
  var out = [], d = omaLuotausLue();
  d.tuonnit.forEach(function(t){
    if ((avain && t.jarvi !== avain) || !t.alku || new Date(t.alku).getFullYear() >= vuosi) return;
    var a = omaLuotausAnturi(t);
    (t.kalat || []).forEach(function(k){
      if (k.luokka !== 'iso' && k.luokka !== 'keski') return;
      var kt = k.t || (t.alku + (k.aikaS || 0)*1000), vesi = omaLuotausHetkenLampo(t, k.aikaS), p = peruste(kt, vesi); if (!p) return;
      var q = {}; for (var x in k) q[x] = k[x];
      q.t = kt; q.parviYla = omaLuotausParviYla(t, k); q.zP = Math.round((k.z + a)*10)/10; q.pohjaP = Math.round((k.pohja + a)*10)/10;
      q.anturi = a; q.nimi = omaLuotausNimi(t); q.vesi = vesi; q.peruste = p; q.jarvi = t.jarvi; out.push(q);
    });
  });
  var J = d.muisti && d.muisti.jarvet && d.muisti.jarvet[avain];
  ((J && J.kaiut) || []).forEach(function(e){
    var tms = e[0] ? e[0]*1000 : null, uusi = e.length >= 13, vesi = uusi && e[11] !== null ? e[11]/10 : null, p = peruste(tms, vesi); if (!p) return;
    out.push({ t: tms, lat: e[1]/1e5, lon: e[2]/1e5, z: e[3]/100, pohja: e[4]/100, zP: Math.round(e[3]/10)/10, pohjaP: Math.round(e[4]/10)/10, anturi: 0,
               yl: e[5], luokka: e[6] === 'i' ? 'iso' : 'keski', kaari: !!e[7], lahella: e[8], parviM: e[9],
               muuParvi: e[10] ? { m: e[10][0], yla: e[10][1]/10, ala: e[10][2]/10 } : null, parviYla: uusi && e[12] !== null ? e[12]/10 : null,
               vesi: vesi, peruste: p, nimi: omaLuotausMuistiNimi(d.muisti, tms, avain), jarvi: avain });   // v231
  });
  return { kaiut: out, vesi: lampoOn ? nytLampo : null, puolisko: puol, lampo: out.filter(function(q){ return q.peruste === 'lampo'; }).length,
           kalenteri: out.filter(function(q){ return q.peruste === 'kalenteri'; }).length };
}

/* ===== v231 (23.10.2026): SAMAN TALLENTEEN TUNNISTUS =====
   Hannu 23.10.: kortti luetaan joskus kesken päivän ja tyhjennetään, ja Lowrance aloittaa nimet alusta (Sonar0000…), joten sama
   nimi toistuu. Tuonti ilmoitti "Sonar0011.sl2 oli jo tuotu ja tiivistetty muistiin" (tila 38 %). Selvitys (v230:n koodi):
   tunniste = nimi|koko tavuina|lat[0]|lon[0]; muu koodi ei vertaa pelkkää nimeä; eri tallenteella sama tunniste vaatisi saman
   tavumäärän ja alkupisteen → torjuttu oli lähes varmasti sama vanha tiedosto (ei varmistettu). Aukot: sama tallenne eri nimellä
   ("Sonar0011 (1).sl2") meni tuplana, ja pidempi versio samasta tallenteesta sai eri tunnisteen.
   UUSI: tunniste nimi|koko|lat0|lon0|a<alku ms> (vanhat 4 kentän tunnisteet luetaan edelleen). Vertailu (omaLuotausVertaa):
   alkupiste sama JA (alkuhetket samat ±OL_ALKU_TOL_MS tai jommaltakummalta puuttuu) → koko sama = sama tallenne (nimestä
   riippumatta), koko eri ja alku tiedossa molemmilla = pidempi/lyhyempi versio samasta; alkuhetket eroavat yli 2 s = eri tallenne,
   vaikka nimi, koko ja alkupiste täsmäävät. */
var OL_ALKU_TOL_MS = 2000;
function omaLuotausAikaTeksti(ms){
  if (!ms) return 'alku ei tiedossa';
  var d = new Date(ms), p = function(x){ return String(x).padStart(2, '0'); };
  return d.getDate() + '.' + (d.getMonth() + 1) + '.' + d.getFullYear() + ' klo ' + p(d.getHours()) + '.' + p(d.getMinutes());
}
function omaLuotausNimi(t){   // näyttönimi: samannimiset erottuvat alkuhetkestä
  var n = (t && (t.nimi || t.id)) || 'tallenne';
  return t && t.alku ? n + ' (' + omaLuotausAikaTeksti(t.alku) + ')' : n;
}
function omaLuotausTunnisteOsat(tunniste){
  if (typeof tunniste !== 'string') return null;
  var o = tunniste.split('|'), alku = null;
  if (o.length >= 5 && /^a\d*$/.test(o[o.length - 1])){ alku = +o.pop().slice(1) || null; }
  if (o.length < 4) return null;
  var lon0 = +o.pop(), lat0 = +o.pop(), koko = +o.pop();
  return { nimi: o.join('|'), koko: koko, lat0: lat0, lon0: lon0, alku: alku };
}
function omaLuotausTunniste(nimi, koko, lat0, lon0, alku){ return nimi + '|' + koko + '|' + lat0 + '|' + lon0 + '|a' + (alku ? Math.round(alku) : ''); }
// F ja R: { koko, lat0, lon0, alku }. Palauttaa 'sama' | 'pidempi' (F pidempi) | 'lyhyempi' | null
function omaLuotausVertaa(F, R){
  if (!F || !R || typeof F.lat0 !== 'number' || isNaN(F.lat0) || !(R.lat0 === F.lat0 && R.lon0 === F.lon0)) return null;
  // 2^32 ms: v172–v194 luki kehyksen ajan etumerkittömänä (v195:n korjaus), jolloin jatkotallenteen alkuhetki saattoi jäädä tasan 2^32 ms
  // (49 vrk 17 h 03 min) liian aikaiseksi. Sama tiedosto uudelleen tuotuna on silloin sama tallenne, ei uusi.
  var ero = F.alku && R.alku ? Math.abs(F.alku - R.alku) : null;
  var molemmat = ero !== null, samaAlku = molemmat && (ero <= OL_ALKU_TOL_MS || Math.abs(ero - 4294967296) <= OL_ALKU_TOL_MS);
  if (molemmat && !samaAlku) return null;
  if (F.koko === R.koko) return 'sama';
  if (!samaAlku) return null;
  return F.koko > R.koko ? 'pidempi' : 'lyhyempi';
}
// Etsii tuotavalle (F) saman tallenteen kokonaisista tuonneista ja muistista: { tyyppi, raaka, muisti, R } tai null
function omaLuotausEtsiSama(d, F){
  var paras = null, jarj = { sama: 0, pidempi: 1, lyhyempi: 2 };
  var kokeile = function(R, raaka, muisti){
    var v = omaLuotausVertaa(F, R); if (!v) return;
    if (!paras || jarj[v] < jarj[paras.tyyppi]) paras = { tyyppi: v, raaka: raaka, muisti: muisti, R: R };
  };
  (d.tuonnit || []).forEach(function(t){
    var o = omaLuotausTunnisteOsat(t.tunniste); if (!o) return;
    kokeile({ nimi: t.nimi, koko: o.koko, lat0: Array.isArray(t.lat) && t.lat.length ? t.lat[0] : o.lat0, lon0: Array.isArray(t.lon) && t.lon.length ? t.lon[0] : o.lon0,
              alku: t.alku || o.alku || null, tuotu: t.tuotu || null, pisteita: (t.lat || []).length }, t, null);
  });
  ((d.muisti && d.muisti.tallenteet) || []).forEach(function(m){
    var o = omaLuotausTunnisteOsat(m.tunniste); if (!o) return;
    var tu = m.tuotu || (/^sl2-(\d+)-/.exec(m.id || '') || [])[1];
    kokeile({ nimi: m.nimi, koko: o.koko, lat0: o.lat0, lon0: o.lon0, alku: m.alku || o.alku || null, tuotu: tu ? +tu : null, tiivistetty: m.tiivistetty || null,
              pisteita: m.pisteita }, null, m);
  });
  return paras;
}
// v231: tiivistetyn muistin kaiun tai kivikon tallenne alkuhetkestä (muistin tallenteet: alku, loppu tai kestoS); muuten 'tiivistetty muisti'
function omaLuotausMuistiNimi(M, tms, jarvi){
  var T = M && M.tallenteet; if (!T || !tms) return 'tiivistetty muisti';
  var av = jarvi === '_' ? null : jarvi;
  for (var i = 0; i < T.length; i++){
    var m = T[i]; if (!m.alku || (av && m.jarvi && m.jarvi !== av)) continue;
    var loppu = m.loppu || (m.alku + (m.kestoS || 0)*1000);
    if (tms >= m.alku - 60e3 && tms <= loppu + 60e3) return omaLuotausNimi(m) + ', tiivistetty muistiin';
  }
  return 'tiivistetty muisti';
}
