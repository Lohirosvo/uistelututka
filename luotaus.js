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
function omaLuotausNollaa(){ window.__olData = undefined; window.__olPisteet = null; window.__olSolut = null; }
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

