/* ===== UISTELUTUTKA — AALTO- JA VIRTAUSMALLI (aaltomalli.js) =====
   Siirretty index.html:stä 10.10.2026 (v178) sanasta sanaan; ainoa muutos on, että järvien ruudukot
   luetaan jarvet.js:stä (window.UT_JARVET). Sisältö: aallonkorkeus, murtuva aallokko, pinta- ja
   syvempi virtaus, vajoama/kumpuama/konvergenssi, syvyyskartta, kuha- ja taimenehdokkaat,
   kloonipisteet (v177), kartan piirto ja aaltokortin käyttöliittymä. Kaikki muutoshistoria on
   kunkin kohdan omassa kommentissa.
   KÄYNNISTYS: index.html kutsuu aaltokarttaAlusta() laiskasti (kortti avataan tai saalis kirjataan).
   Rajapinta pääkoodille: window.ak*-funktiot (akMalliSync, akKloonit, akSyvyysJarvessa, …).
   Tarvitsee pääkoodista: TM35, omaLuotausSolut/-Korvaa, haversine ym. (globaalit, kutsuhetkellä).
   v179: toimii myös ilman aaltokorttia (PIILORUNKO) ja antaa tilannekuvalle pohjakuvan (akRenderoi);
   oma sijainti (window.utOmaSijainti) piirretään aaltokarttaan.
   VERSIO: sivut lataavat tiedoston nimellä aaltomalli.js?v=NNN; NNN = sw.js:n VERSIO-numero. */
function aaltokarttaAlusta(){
"use strict";
var $ = function(id){ return document.getElementById(id); };
var g = 9.81;

/* v179 (10.10.2026): PIILORUNKO. tilanne.html käyttää tätä samaa mallia ilman aaltokorttia. Malli kirjoittaa
   korttinsa elementteihin (leima, taulukko, liukusäädin, venevalinta …), joten jos sivulla ei ole korttia
   (#aaltokartta), luodaan näkymätön runko samoilla tunnisteilla ja elementtityypeillä. index.html:ssä
   runkoa ei luoda. Jos kortille lisätään uusi id, jota malli käyttää, se lisätään myös tähän. */
var akPiilorunko = false;
if (!document.getElementById('aaltokartta')){
  var akRunko = document.createElement('div'); akRunko.id = 'akPiilorunko'; akRunko.hidden = true; akRunko.style.display = 'none';
  akRunko.innerHTML = '<section id="aaltokartta"><select id="akJarvi"></select><canvas id="akKuva" width="300" height="300"></canvas>'
    + '<button type="button" id="akZoomTaso"></button><div id="akLeima"></div><div id="akTuuli"></div>'
    + '<p id="akKumpuInfo"></p><p id="akKuhaInfo"></p><p id="akTaimenInfo"></p><p id="akKlooniInfo"></p><div id="akAsteikko"></div>'
    + '<input type="checkbox" id="akKayrat"><input type="checkbox" id="akKuhaMerkit"><input type="checkbox" id="akTaimenMerkit">'
    + '<input type="checkbox" id="akKlooniMerkit"><input type="checkbox" id="akKorosta">'
    + '<select id="akNaytto"><option value="aalto">Aallonkorkeus</option><option value="murtuva">Murtuva aallokko</option>'
    + '<option value="virtaus">Pintavirtaus</option><option value="syva">Syvempi vesi</option><option value="vajoama">Vajoama</option>'
    + '<option value="kumpuama">Kumpuama</option><option value="konvergenssi">Konvergenssi</option><option value="syvyys">Syvyyskartta</option></select>'
    + '<span id="akYksikko"></span><button type="button" id="akOziNappi"></button><p id="akOziTila"></p><div id="akPiste"></div>'
    + '<select id="akVene"></select><input type="range" id="akRaja" min="0.10" max="0.60" step="0.01" value="0.20"><span id="akRajaL"></span>'
    + '<div id="akRulla"><div id="akRullaSisus"></div></div><div id="akJana"></div><div id="akPaivat"></div>'
    + '<span id="akAlku"></span><span id="akLoppu"></span><input type="range" id="akLiuku" min="0" max="0" value="0"><div id="akTaulu"></div></section>';
  (document.body || document.documentElement).appendChild(akRunko);
  akPiilorunko = true;
}

// ================== JÄRVET ==================
// v178 (10.10.2026): järvien ruudukot (maski, syvyysluokat, kattavuus) ovat omassa tiedostossaan
// jarvet.js (window.UT_JARVET). Uusi tai päivitetty järvi liitetään sinne, ei tähän.
var JARVET = window.UT_JARVET;
if (!JARVET){
  var lvirhe = $("akLeima");
  if (lvirhe) lvirhe.innerHTML = '<small>järvikartat puuttuvat (jarvet.js ei latautunut)</small>';
  return;   // ilman järviä malli ei käynnisty; pääkoodi tarkistaa window.ak*-funktiot typeof-ehdolla
}
// ============================================

// ---- Väriasteikko, Forecan tyyliin -------------------------------------
// Järvimitoitus: painopiste 0,1-0,8 m, jossa järven aallot oikeasti ovat.
var RAJAT = [0, .05, .10, .15, .20, .30, .40, .50, .65, .80, 1.00, 1.30];
var VARIT = ["#cfe0e6","#7fc6a0","#3faa62","#8cc63f","#c8d422","#f2c200",
             "#f79800","#ee6f1e","#dc4426","#bd2430","#8f1414","#5c0b0b"];

// Korostustilassa asteikko venytetään tunnin omaan huippuun, jolloin
// erot näkyvät myös tyynenä päivänä.
var korosta = false, venytys = 1;

/* PINTAVIRTAUS — siirretty VJAKumpu.html:stä 22.9.2026. Sama kartta, sama
   pyyhkäisykenttä ja sama tuuli; vain laskettava suure vaihtuu. Kaava on
   VJAKumpun: 2 % tuulesta (pintavirran tavallinen nyrkkisääntö on 2–3 %),
   kerrottuna syvyydellä (matala nopeuttaa, enintään 1,75×) ja pyyhkäisyllä.
   Tämä on ARVIO, ei mittaus: se ei tunne paluuvirtausta syvänteissä eikä
   rantojen ohjaamaa kiertoa. Tarkennus on tulossa. */
var akTila = 'aalto', akSyvyys = null;
var RAJAT_V = [0, .05, .10, .15, .20, .25, .30, .40, .50, .65, .80, 1.00]; // km/h
/* v145 VAJOAMA (Hannun luonnos 3.10.2026, korjattu). Pintavesi painuu alas, kun tuulen ajama
   pintavirta kohtaa nousevan pohjan tai rannan: pinnan kuljetus pienenee virtauksen suunnassa,
   ja ylijäämä painuu (konvergenssi -> vajoaminen; kumpuamisen vastinpari tuulen alapuolella).
   Indeksi = pintavirta (km/h) × K × kestokerroin, skaalattu 0–100 (0,6 km/h × K = 1 -> 100).
   K = max( pohjan nousu virtauksen suunnassa / 3 %, rannan läheisyys 150 m sisällä ).
   Kestokerroin 0,55 + 0,45 × min(1, tuulen kesto / 6 h) (pinnan kasautuminen vie aikaa; luonnoksen arvo).
   Pehmennetään 3×3 ruutua, jotta näkyy alue eikä yksittäisiä ruutuja. Suhteellinen MALLI-indeksi,
   ei mitattu pystyvirtaus; luonnoksen lajisyvyyskerroin jätetty pois (se on kalastusmieltymys). */
var RAJAT_VI = [0, 5, 10, 15, 20, 30, 40, 50, 60, 70, 85, 100];
/* v150 KONVERGENSSI: vajoama − kumpuama (−100…+100). Punainen = vesi kasautuu ja painuu (konvergenssi),
   sininen = vesi erkanee ja nousee (divergenssi). Päälle VIRTASAUMAT: vierekkäiset ruudut, joissa
   syvemmän veden virrat menevät yli 120° eri suuntiin ja molemmat ≥ 2 cm/s (0,072 km/h; kynnys:
   taimen ja harjus aistivat virran noin 2 cm/s:sta, Hauer ym. 2026, sovelluksen lähde). Ravinto
   kasautuu konvergensseihin: eläinplankton (Daphnia) kerääntyi Langmuir-kiertojen alavirtauksiin
   laboratoriossa (Gurung ym. 2024, Limnology & Oceanography). Pinnan vaahtojuovat (metreistä
   kymmeniin metreihin, minuutteja) ovat alle ruudukon ja tunnin tarkkuuden: ne etsitään silmällä. */
var RAJAT_K = [-100, -60, -35, -20, -10, -4, 4, 10, 20, 35, 60, 85];
/* v152 SYVYYSKARTTA (Hannu 4.10.2026: käyrät ja ajo OziExplorerilla). Värit syvyysluokittain, käyrät
   marching squares -menetelmällä pehmennetystä syvyydestä (±75 m), zoomattuna syvyysluvut.
   EI NAVIGOINTIKARTTA: syvyydet ovat MML:n käyristä/pisteistä tai karttakuvista interpoloituja. */
var RAJAT_S = [0, 1.5, 3, 6, 10, 15, 20, 25, 30, 40, 50, 60];
var VARIT_S = ['#e6f4fb','#cfe9f6','#b5ddf1','#97cdea','#78bbe1','#5aa7d6','#4192c8','#2f7cb6','#22669f','#185286','#103f6c','#0a2e52'];
var KAYRAT_PAA = [3, 10, 20, 30, 40, 50], KAYRAT_KAIKKI = [1.5, 3, 6, 10, 15, 20, 25, 30, 40, 50];
var akVientiKerroin = 1;   // Ozi-vienti piirtää isommalla tarkkuudella
var akSileaVM = null;      // { jarvi, kentta }
function akSileaSyvyys(){
  if (!akSyvyys || !jarvi) return null;
  if (akSileaVM && akSileaVM.jarvi === jarvi) return akSileaVM.kentta;
  var k = jarvi.kartta, W = k.W, H = k.H, r = Math.max(1, Math.round(75/k.ruutu)), out = new Float32Array(mask.length);
  // v176 (Hannu 7.10.: "sais vain korjata karttaa"): omalla luotauksella mitattua ruutua ei tasoiteta naapureihin,
  // vaan kartta näyttää mitatun mediaanin sellaisenaan. Muut ruudut tasoitetaan kuten ennen (mitatut mukana).
  var oma = null; try { var ro = omaLuotausSolut(k); oma = ro && ro.soluja ? ro.solut : null; } catch (e) {}
  for (var q = 0; q < mask.length; q++){
    if (!mask[q]) continue;
    if (oma && oma[q] !== undefined){ out[q] = akSyvyys[q]; continue; }
    var i = q % W, j = (q/W)|0, s = 0, n = 0;
    for (var a = -r; a <= r; a++) for (var b = -r; b <= r; b++){
      var ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue;
      var q2 = jj*W + ii; if (!mask[q2]) continue; s += akSyvyys[q2]; n++;
    }
    out[q] = n ? s/n : akSyvyys[q];
  }
  akSileaVM = { jarvi: jarvi, kentta: out };
  return out;
}
/* Marching squares: ruutujen keskipisteiden muodostamat neliöt; maa = 0 m, joten matalin käyrä
   kulkee rannan tuntumassa. Palauttaa janat kankaan koordinaateissa. */
function akKayraJanat(f, taso, win, S){
  var k = jarvi.kartta, W = k.W, H = k.H, out = [];
  var arvo = function(i, j){ var q = j*W + i; return mask[q] ? f[q] : 0; };
  for (var j = Math.max(0, win.j0 - 1); j < Math.min(H - 1, win.j0 + win.h); j++){
    for (var i = Math.max(0, win.i0 - 1); i < Math.min(W - 1, win.i0 + win.w); i++){
      var a = arvo(i, j), b = arvo(i+1, j), c = arvo(i+1, j+1), d = arvo(i, j+1);
      var tapaus = (a >= taso ? 8 : 0) | (b >= taso ? 4 : 0) | (c >= taso ? 2 : 0) | (d >= taso ? 1 : 0);
      if (tapaus === 0 || tapaus === 15) continue;
      var x0 = (i - win.i0 + 0.5)*S, y0 = (j - win.j0 + 0.5)*S;
      var ip = function(p, q2){ return (taso - p)/((q2 - p) || 1e-9); };
      var Y = [x0 + ip(a, b)*S, y0], O = [x0 + S, y0 + ip(b, c)*S], A = [x0 + ip(d, c)*S, y0 + S], V = [x0, y0 + ip(a, d)*S];
      var E = { 1:[[V,A]], 2:[[A,O]], 3:[[V,O]], 4:[[Y,O]], 5:[[V,Y],[A,O]], 6:[[Y,A]], 7:[[V,Y]], 8:[[V,Y]], 9:[[Y,A]], 10:[[Y,O],[V,A]], 11:[[Y,O]], 12:[[V,O]], 13:[[A,O]], 14:[[V,A]] }[tapaus];
      for (var e = 0; e < E.length; e++) out.push(E[e]);
    }
  }
  return out;
}
function akPiirraKayrat(ctx, win, S, LW){
  var f = akSileaSyvyys(); if (!f) return;
  var tasot = S >= 3 ? KAYRAT_KAIKKI : KAYRAT_PAA;
  tasot.forEach(function(taso){
    var paa = KAYRAT_PAA.indexOf(taso) >= 0, jt = akKayraJanat(f, taso, win, S);
    if (!jt.length) return;
    ctx.strokeStyle = paa ? "rgba(12,38,64,.70)" : "rgba(12,38,64,.38)";
    ctx.lineWidth = akKayraLeveys ? (paa ? akKayraLeveys.paa : akKayraLeveys.muu)   // v179: tilannekuvan pohjakuva (zoomataan, ohuemmat viivat)
                                  : (paa ? Math.max(1.2, LW/420) : Math.max(0.8, LW/800));
    ctx.beginPath();
    jt.forEach(function(l){ ctx.moveTo(l[0][0], l[0][1]); ctx.lineTo(l[1][0], l[1][1]); });
    ctx.stroke();
  });
}
/* v152: konvergenssin SYVÄ REUNA (Hannu: kalat punaisen alueen syvältä puolelta; ≥ 1,5 m ajettavaa).
   Ruudut, joissa pehmennetty syvyys ≥ 1,5 m ja 150 m sisällä on vahvaa kasautumista (≥ 25). */
var REUNA_SYV = 1.5;
function akKonvReuna(kf){
  var f = akSileaSyvyys(); if (!f || !kf) return null;
  var k = jarvi.kartta, W = k.W, H = k.H, r = Math.max(1, Math.round(150/k.ruutu)), vahva = new Uint8Array(mask.length);
  for (var q = 0; q < mask.length; q++) if (mask[q] && kf[q] >= 25) vahva[q] = 1;
  var reuna = new Uint8Array(mask.length), n = 0, vn = 0;
  for (var q2 = 0; q2 < mask.length; q2++){
    if (!mask[q2]) continue; vn++;
    if (f[q2] < REUNA_SYV) continue;
    var i = q2 % W, j = (q2/W)|0, lo = false;
    for (var a = -r; a <= r && !lo; a++) for (var b = -r; b <= r && !lo; b++){
      var ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue;
      if (vahva[jj*W + ii]) lo = true;
    }
    if (lo){ reuna[q2] = 1; n++; }
  }
  return { reuna: reuna, osuus: vn ? n/vn : 0 };
}
var VARIT_K = ['#1d3f8f','#2f63b7','#5b8fd6','#93b9e8','#c6dbf3','#eef1f3','#f6e3e0','#f2bcb2','#e88b7a','#d45a48','#b3302a','#7e1717'];
var akKayrat = false;
try { akKayrat = localStorage.getItem('aaltokartta_kayrat') === '1'; } catch(e){}
/* v153: kuhapaikkojen merkit kartalla. Pääkoodi (kuhaPaneeliHtml) asettaa window.akKuhaKohteet:
   { avain, hetki, kohteet: [{ lat, lon, tyyppi: 'oma'|'ehdokas', paras, tunnus, nimi, teksti }] }.
   Merkit piirretään vain, kun kortilla on sama järvi kuin laskennassa. */
var akKuhaMerkit = false;
try { akKuhaMerkit = localStorage.getItem('aaltokartta_kuha') === '1'; } catch(e){}

/* SYVYYSLUOKAT METREIKSI — kaikki rajat varmistettu 22.9.2026.
   DataDeck-kartan väriasteikko: 2,5 / 5 / 8 / 10 / 15 / 20 / 25 m.
   Todisteet (luotaukset värin päällä, kuvat kohdistettu käyrien, rannan ja
   väyläviivan avulla):
     raja 2,5 m: Kiipiska 2,0 alla, 2,3 täsmälleen rajalla, 3,1 yli;
                 Karppa 0,9–1,9 alla, 2,8 yli
     raja 5 m:   Karppa 2,8–4,9 alla (4,8 ja 4,9 rajalla), 5,3–7,4 yli
     raja 8 m:   Kotikari 7,4–8,0 alla, 8,6–9,0 yli (8,0 kummallakin puolella)
     rajat 10 / 15 / 20 / 25 m: nimetyt syvyyskäyrät, 9/10 syvää luotausta osui
   Yhteensä noin 55 luotausta, ei yhtään ristiriitaa.
   Ruudukko on luettu koko järven yleiskuvasta, jonka värit ovat haaleampia.
   Paikansin zoomikuvat siitä ja vertasin samoja kohtia (~36 000 näytettä):
     yleisluokat 0–4 = zoomin 0–4, yleisluokka 5 = 10–15 m (385/444),
     yleisluokka 6 = 15–25 m (15–20 ja 20–25 puoliksi), yleisluokka 7 = yli 25.
   Arvo on luokan keskikohta; syvin (25–36 m) 29 m.
   AUKI: keskisyvyys näillä noin 7,9 m, Luken mukaan noin 6,9 m. Rajat eivät
   enää selitä eroa; jäljellä luokkien sisäinen jakauma (keskikohta on karkea
   oletus) ja se, mistä luotauksista Luken luku on laskettu. */
var SYV_LUOKKA_M = [1.25, 3.75, 6.5, 9, 12.5, 12.5, 20, 29];

/* SYVEMPI VESI — tuulen ajama kierto, lisätty 22.9.2026.
   Pintavirtaus kertoo vain ylimmän kerroksen, joka kulkee aina tuulen mukana.
   Järvi ei kuitenkaan voi kasata vettä loputtomasti tuulen alapuolelle:
   pinta kallistuu, ja vesi palaa takaisin. Tämä malli laskee sen paluun.
   Pysyvä tila, syvyyskeskiarvoinen, lineaarinen pohjakitka r:
       ∇·( (r/h²) ∇ψ ) = ∇×( τ/(ρ h) ),   U = (−∂ψ/∂y, ∂ψ/∂x),  ψ = 0 rannalla
   Tuloksena matalikoilla vesi kulkee tuulen mukana ja syvänteissä vastatuuleen
   (Lappajärvellä testattuna: syvänteistä 68–75 % vastatuuleen, matalikoista
   78–86 % myötätuuleen, kaikilla tuulensuunnilla). Suunnat ovat mallin vahvin
   osa, koska ne riippuvat vain pohjan muodosta. Nopeus skaalautuu kitkan r
   mukaan, joka on arvio (1e-3 m/s) — se voi olla 2–3 kertaa kumpaan suuntaan.
   Yksinkertaistukset: saarten ympäri ei kulje nettovirtaa (ψ = 0 kaikella
   maalla), maapallon pyörimistä ei ole mukana.
   Malli on lineaarinen, joten kaksi pohjatapausta (itä- ja pohjoistuuli)
   ratkaistaan kerran järveä kohden, ja muut suunnat ovat niiden yhdistelmiä. */
var AK_KITKA_R = 1e-3, AK_CD = 1.3e-3, AK_ILMA = 1.2, AK_VESI = 1000;
var akKiertoData = null;
function akKiertoPohjat(mask, h, W, H, dx, r){
  // vesiruudut ja naapurit kerran; operaattori riippuu vain syvyydestä
  var vesi = [], idx = new Int32Array(W*H).fill(-1);
  for (var q = 0; q < W*H; q++) if (mask[q]){ idx[q] = vesi.length; vesi.push(q); }
  var N = vesi.length, nb = new Int32Array(N*4).fill(-1), af = new Float64Array(N*4), sum = new Float64Array(N);
  var A = function(q){ return r/(h[q]*h[q]); };
  for (var p = 0; p < N; p++){
    var q = vesi[p], i = q % W, j = (q/W)|0;
    var nn = [[i+1,j],[i-1,j],[i,j+1],[i,j-1]];
    for (var k = 0; k < 4; k++){
      var ii = nn[k][0], jj = nn[k][1], qq = jj*W+ii;
      if (ii<0||ii>=W||jj<0||jj>=H||!mask[qq]){ af[p*4+k] = A(q); }
      else { nb[p*4+k] = idx[qq]; af[p*4+k] = 0.5*(A(q)+A(qq)); }
      sum[p] += af[p*4+k];
    }
  }
  // 1/h:n gradientti (x itään, y pohjoiseen; j kasvaa etelään)
  var gx = new Float64Array(N), gy = new Float64Array(N);
  for (var p = 0; p < N; p++){
    var q = vesi[p], c = 1/h[q];
    var v = function(k){ var n2 = nb[p*4+k]; return n2 >= 0 ? 1/h[vesi[n2]] : null; };
    var e = v(0), w = v(1), s = v(2), n = v(3);
    gx[p] = (e!==null&&w!==null) ? (e-w)/(2*dx) : e!==null ? (e-c)/dx : w!==null ? (c-w)/dx : 0;
    gy[p] = (n!==null&&s!==null) ? (n-s)/(2*dx) : n!==null ? (n-c)/dx : s!==null ? (c-s)/dx : 0;
  }
  function ratkaise(tx, ty){
    var psi = new Float64Array(N), rhs = new Float64Array(N);
    for (var p = 0; p < N; p++) rhs[p] = (ty*gx[p] - tx*gy[p])*dx*dx;
    /* v144: optimaalinen ylirelaksaatio ~ 2/(1+π/n), n = ruudukon lineaarinen koko. Kiinteä 1,9
       suppeni hitaasti isoilla ruudukoilla (50 m Lappajärvi). Ratkaisu on sama, vain nopeampi. */
    var omega = Math.min(1.97, Math.max(1.9, 2/(1 + Math.PI/Math.sqrt(N))));
    for (var it = 0; it < 12000; it++){
      var muutos = 0, suurin = 1e-30;
      for (var p = 0; p < N; p++){
        var o = p*4, s2 = 0;
        for (var k = 0; k < 4; k++){ var n2 = nb[o+k]; if (n2 >= 0) s2 += af[o+k]*psi[n2]; }
        var d = (s2 - rhs[p])/sum[p] - psi[p];
        psi[p] += omega*d;
        var ad = d < 0 ? -d : d; if (ad > muutos) muutos = ad;
        var ap = psi[p] < 0 ? -psi[p] : psi[p]; if (ap > suurin) suurin = ap;
      }
      if (muutos < 1e-6*suurin) break;
    }
    // u = U/h, U = (−∂ψ/∂y, ∂ψ/∂x)
    var ue = new Float32Array(W*H), un = new Float32Array(W*H);
    for (var p = 0; p < N; p++){
      var P = function(k){ var n2 = nb[p*4+k]; return n2 >= 0 ? psi[n2] : 0; };
      var q = vesi[p];
      var dPx = (P(0)-P(1))/(2*dx), dPy = (P(3)-P(2))/(2*dx);
      ue[q] = -dPy/h[q]; un[q] = dPx/h[q];
    }
    return { ue: ue, un: un, iter: it };
  }
  return { ita: ratkaise(1,0), pohjoinen: ratkaise(0,1) };
}

/* v150: kiertomallin kantakentät talteen puhelimeen. 50 m Lappajärven ratkaisu vie puhelimessa
   noin 10 s; se lasketaan kerran ja luetaan seuraavilla kerroilla IndexedDB:stä (avain: järvi,
   ruudukon koko ja syvyysdatan tarkiste, joten ruudukon vaihtuessa lasketaan uudelleen). */
var AK_KIERTO_DB = 'uistelututka_kierto';
function akKiertoAvain(){
  var k = jarvi.kartta, t = 0, sl = k.syvyysLuokat || '', ms = k.maski || '';
  for (var i = 0; i < sl.length; i += 7) t = (t*31 + sl.charCodeAt(i)) % 1000000007;
  for (var j = 0; j < ms.length; j += 7) t = (t*31 + ms.charCodeAt(j)) % 1000000007;
  return jarvi.nimi + '|' + k.W + 'x' + k.H + '|' + k.ruutu + '|' + t + '|' + omaLuotausTarkiste(k);   // v172: oma luotaus muuttaa syvyyttä
}
function akKiertoDb(){
  return new Promise(function(ok, ei){
    if (!window.indexedDB) return ei(new Error('ei IndexedDB'));
    var r = indexedDB.open(AK_KIERTO_DB, 1);
    r.onupgradeneeded = function(){ r.result.createObjectStore('pohjat'); };
    r.onsuccess = function(){ ok(r.result); }; r.onerror = function(){ ei(r.error); };
  });
}
function akKiertoTallenna(avain, P){
  akKiertoDb().then(function(db){
    var tx = db.transaction('pohjat', 'readwrite');
    tx.objectStore('pohjat').put({ iu: P.ita.ue, in_: P.ita.un, pu: P.pohjoinen.ue, pn: P.pohjoinen.un }, avain);
    tx.oncomplete = function(){ db.close(); };
  }).catch(function(){});
}
var akKiertoValmisPohjat = null;   // { avain, pohjat } IndexedDB:stä
function akKiertoLataa(){
  if (!jarvi || !jarvi.kartta) return Promise.resolve(null);
  var avain = akKiertoAvain();
  return akKiertoDb().then(function(db){
    return new Promise(function(ok){
      var q = db.transaction('pohjat', 'readonly').objectStore('pohjat').get(avain);
      q.onsuccess = function(){ db.close(); var v = q.result;
        if (v && v.iu) akKiertoValmisPohjat = { avain: avain, pohjat: { ita: { ue: v.iu, un: v.in_ }, pohjoinen: { ue: v.pu, un: v.pn } } };
        ok(!!v); };
      q.onerror = function(){ db.close(); ok(false); };
    });
  }).catch(function(){ return false; });
}
function akKierto(){
  if (akKiertoData) return akKiertoData;
  if (!akSyvyys || !mask || !jarvi || !jarvi.kartta) return null;
  var k = jarvi.kartta, W = k.W, H = k.H, h = new Float64Array(W*H), summa = 0, n = 0;
  // 3x3-pehmennys vesiruutujen yli: syvyysluokkien porrastus tekisi muuten
  // luokkarajoille keinotekoisia virtapiikkejä
  for (var j = 0; j < H; j++) for (var i = 0; i < W; i++){
    var q = j*W+i; if (!mask[q]) continue;
    var s = 0, c = 0;
    for (var dj = -1; dj <= 1; dj++) for (var di = -1; di <= 1; di++){
      var ii = i+di, jj = j+dj, qq = jj*W+ii;
      if (ii>=0 && ii<W && jj>=0 && jj<H && mask[qq]){ s += akSyvyys[qq]; c++; }
    }
    h[q] = Math.max(1, s/c); summa += h[q]; n++;
  }
  var avainK = akKiertoAvain(), pohjat;
  if (akKiertoValmisPohjat && akKiertoValmisPohjat.avain === avainK) pohjat = akKiertoValmisPohjat.pohjat;
  else { pohjat = akKiertoPohjat(mask, h, W, H, k.ruutu, AK_KITKA_R); akKiertoTallenna(avainK, pohjat); }
  akKiertoData = { pohjat: pohjat, h: h, hKesk: n ? summa/n : 7 };
  return akKiertoData;
}

/* LÄPIVIRTAUS — 29.9.2026 (v98), vain Hirvijärvi.
   Potentiaalivirtaus  ∇·(h²∇Φ) = lähde − nielu,  virtaus u = −h∇Φ.
   Sama h²-painotus kuin Syvempi vesi -mallissa (käänteisluku r/h²), joten
   kitka kumoutuu nopeudesta: virtaus riippuu vain vesimäärästä ja syvyydestä.
   Jokaiselle tulolle ja otolle lasketaan kerran yksikkökenttä (1 m³/s). Kentässä
   vesi jakautuu tasaisesti koko altaan pinnan nousuksi, joten jokainen kenttä on
   yksinään tasapainossa ja ne voidaan summata:
       kenttä = Q_kanava·F_kanava + Q_tausneva·F_tausneva + Q_varpula·F_varpula − Q_otto·F_otto
   Tarkistettu Pythonilla 29.9.: 15 m³/s kanavalta ottoon → max 0,31 km/h, sama kuin
   aiempi laskelma. Todellisilla luvuilla (tulo 5, otto 15) max noin 0,1 km/h: ajon
   aikana vesi tulee pääosin altaan varastosta, ei eteläkanavasta.
   Syvyys sama kuin akKierto (3x3-pehmennys, väh. 1 m). Rajat: 10 m kaivetut uomat
   ovat alle ruudun, joten todellinen virta keskittyy niihin; ruutu näyttää keskiarvon.
   Pisteet: kanava = eteläisin vesiruutu; otto = lähin vesiruutu Nurmon Satamaan;
   Tausneva = Hannun piste (koilliskulma, uoma Tiisnevalta); Varpula = Hannun piste
   29.9. (padon syöttö Hirvijärveen, 62°48'39.69" N 23°7'19.23" E; piste on rantaruudussa,
   tulo sijoitetaan lähimpään vesiruutuun). */
var HIRVI_LAPI_PISTEET = { otto: [62.80809, 23.04767], tausneva: [62.83226, 23.13712], varpula: [62.81102, 23.12201] };
var akLapiData = null, akLapiValimuisti = null;
function akLapiPohjat(){
  if (akLapiData) return akLapiData;
  if (!jarvi || jarvi !== JARVET.hirvijarvi || !mask || !akSyvyys) return null;
  var kd = akKierto(); if (!kd) return null;
  var k = jarvi.kartta, W = k.W, H = k.H, dx = k.ruutu, h = kd.h;
  var vesi = [], idx = new Int32Array(W*H).fill(-1);
  for (var q = 0; q < W*H; q++) if (mask[q]){ idx[q] = vesi.length; vesi.push(q); }
  var N = vesi.length, nb = new Int32Array(N*4).fill(-1), af = new Float64Array(N*4), sum = new Float64Array(N);
  for (var p = 0; p < N; p++){
    var q0 = vesi[p], i = q0 % W, j = (q0/W)|0, nn = [[i+1,j],[i-1,j],[i,j+1],[i,j-1]];
    for (var kk = 0; kk < 4; kk++){
      var ii = nn[kk][0], jj = nn[kk][1], qq = jj*W+ii;
      if (ii<0||ii>=W||jj<0||jj>=H||!mask[qq]) continue;      // ranta: ei virtaa läpi
      nb[p*4+kk] = idx[qq]; af[p*4+kk] = 0.5*(h[q0]*h[q0] + h[qq]*h[qq]); sum[p] += af[p*4+kk];
    }
  }
  function ratkaise(lahde){
    var phi = new Float64Array(N), S = new Float64Array(N).fill(-1/N);
    S[idx[lahde]] += 1;
    for (var it = 0; it < 20000; it++){
      var muutos = 0, suurin = 1e-30;
      for (var p = 0; p < N; p++){
        if (!sum[p]) continue;
        var o = p*4, s2 = S[p];
        for (var kk = 0; kk < 4; kk++){ var n2 = nb[o+kk]; if (n2 >= 0) s2 += af[o+kk]*phi[n2]; }
        var dd = s2/sum[p] - phi[p]; phi[p] += 1.9*dd;
        var ad = dd < 0 ? -dd : dd; if (ad > muutos) muutos = ad;
        var ap = phi[p] < 0 ? -phi[p] : phi[p]; if (ap > suurin) suurin = ap;
      }
      if (muutos < 1e-7*suurin) break;
    }
    var ue = new Float32Array(W*H), un = new Float32Array(W*H);
    for (var p = 0; p < N; p++){
      var o = p*4, F = [0,0,0,0];
      for (var kk = 0; kk < 4; kk++){ var n2 = nb[o+kk]; if (n2 >= 0) F[kk] = af[o+kk]*(phi[p] - phi[n2]); }
      var q1 = vesi[p];
      ue[q1] = (F[0] - F[1])/(2*dx)/h[q1];      // itään
      un[q1] = (F[3] - F[2])/(2*dx)/h[q1];      // pohjoiseen (j kasvaa etelään)
    }
    return { ue: ue, un: un, iter: it };
  }
  var etela = vesi.reduce(function(a, q){ var ja = (a/W)|0, jq = (q/W)|0; return (jq > ja || (jq === ja && Math.abs(q%W-24) < Math.abs(a%W-24))) ? q : a; }, vesi[0]);
  var piste = function(ll){ return ll ? akRuutuPisteelle(k, ll[0], ll[1]) : -1; };
  var ruudut = { kanava: etela, otto: piste(HIRVI_LAPI_PISTEET.otto), tausneva: piste(HIRVI_LAPI_PISTEET.tausneva), varpula: piste(HIRVI_LAPI_PISTEET.varpula) };
  var kentat = {};
  Object.keys(ruudut).forEach(function(nimi){ if (ruudut[nimi] >= 0) kentat[nimi] = ratkaise(ruudut[nimi]); });
  akLapiData = { kentat: kentat, ruudut: ruudut };
  return akLapiData;
}
/* Nykyhetken läpivirtaus. Q tulee pääkoodin hirviLapiQ():sta (voimala, Varpula,
   vesitase). Voimalan tila tiedetään vain nyt, joten kenttää ei lisätä yli 2 h
   päähän nykyhetkestä. Palauttaa null, jos järvi ei ole Hirvijärvi tai dataa ei ole. */
function akLapiNyt(aikaMs){
  if (!jarvi || jarvi !== JARVET.hirvijarvi) return null;
  if (aikaMs != null && Math.abs(aikaMs - Date.now()) > 2*3600e3) return null;
  var Q = (typeof window.hirviLapiQ === 'function') ? window.hirviLapiQ() : null;
  if (!Q) return null;
  var pk = akLapiPohjat(); if (!pk) return null;
  var avain = JSON.stringify(Q);
  if (akLapiValimuisti && akLapiValimuisti.avain === avain) return akLapiValimuisti;
  var n = mask.length, ue = new Float32Array(n), un = new Float32Array(n);
  var kerroin = { kanava: Q.kanava, tausneva: Q.tausneva, varpula: Q.varpula, otto: Q.otto == null ? null : -Q.otto };
  Object.keys(kerroin).forEach(function(nimi){
    var c = kerroin[nimi], F = pk.kentat[nimi];
    if (!c || !F) return;
    for (var q = 0; q < n; q++){ ue[q] += c*F.ue[q]; un[q] += c*F.un[q]; }
  });
  akLapiValimuisti = { avain: avain, ue: ue, un: un, Q: Q, mukana: Object.keys(pk.kentat) };
  return akLapiValimuisti;
}

/* 30.9.2026 (v101): kutsutaan, kun SYKEn data saapuu. Jos Syvempi vesi -kartta
   on Hirvijärvellä jo piirretty ilman läpivirtausta, piirretään se uudelleen. */
window.akOnHirvi = function(){ return !!jarvi && jarvi === JARVET.hirvijarvi; };
window.akValmiina = function(){ return Promise.resolve(akLatausLupaus); };
window.akLapiPaivita = function(){
  if (!jarvi || jarvi !== JARVET.hirvijarvi || akTila !== 'syva' || !akSyvyys || !data || !data.length) return;
  piirra();
};

/* v172: oma luotaus kartalle (pääosa pääkoodissa, ks. OMA LUOTAUS KAIKULUOTAIMELTA). */
// Kartta: jälki pisteinä Syvyyskartta-tilassa
function akPiirraOmaLuotaus(ctx, win, S){
  if (akTila !== 'syvyys' || !jarvi || !jarvi.kartta || akKayraLeveys) return;   // v179: tilannekuva piirtää jäljen itse ohuena
  var P = omaLuotausPisteet(); if (!P.length) return;
  var k = jarvi.kartta, kerr = akVientiKerroin > 1 ? akVientiKerroin : 1, r = 1.5*kerr;
  ctx.fillStyle = 'rgba(45,18,80,.16)';   // v176: himmeä, kertoo vain mistä mitattu syvyys on (Hannu 7.10.)
  for (var a = 0; a < P.length; a++){
    var p = P[a];
    var i = (p.lon - k.lansiLon)*111320*Math.cos(p.lat*Math.PI/180)/k.ruutu, j = (k.pohjoisLat - p.lat)*111320/k.ruutu;
    if (i < win.i0 || j < win.j0 || i >= win.i0 + win.w || j >= win.j0 + win.h) continue;
    ctx.beginPath(); ctx.arc((i - win.i0)*S, (j - win.j0)*S, r, 0, 6.2832); ctx.fill();
  }
}

// v172: pääkoodi tarvitsee järven nimen ja ruudukon (JARVET on tämän moduulin sisällä)
window.akJarviNimi = function(av){ return JARVET[av] ? JARVET[av].nimi : null; };
window.akJarviKartta = function(av){ return JARVET[av] ? JARVET[av].kartta : null; };

function puraSyvyysLuokat(k){
  if (!k || !k.syvyysLuokat) return null;
  var raaka = atob(k.syvyysLuokat), n = k.W*k.H, s = new Float32Array(n);
  // järvikohtaiset luokkasyvyydet (Hirvijärvi), muuten Lappajärven SYV_LUOKKA_M
  var luokat = k.luokkaM || SYV_LUOKKA_M, anturi = k.anturiM || 0;
  for (var i = 0; i < n; i++){
    var tavu = raaka.charCodeAt(i >> 1);
    var l = (i & 1) ? (tavu & 15) : (tavu >> 4);
    s[i] = l < luokat.length ? luokat[l] + anturi : 0;
  }
  try { omaLuotausKorvaa(k, s); } catch (e) { console.warn('Oma luotaus:', e && e.message); }   // v172
  return s;
}

/* Virtaus kulkee tuulen alapuolelle, ja maapallon pyöriminen kääntää sitä
   oikealle; VJAKumpun +15° säilytetty. Suunta kerrotaan KOHTI-muodossa,
   koska veneessä kysytään mihin vesi vie, ei mistä se tulee. */
function akVirtausSuunta(tuuliDir){ return ((tuuliDir + 180 + 15) % 360 + 360) % 360; }
function akKohti(deg){
  var n = ["pohjoiseen","koilliseen","itään","kaakkoon","etelään",
           "lounaaseen","länteen","luoteeseen"];
  return n[Math.round(((deg%360)+360)%360/45)%8];
}

/* Veneet ja kalastusrajat. turva = kestääkö runko. kalaOletus = se aalto jossa
   uistelu on vielä kalastusta eikä työtä; varovainen arvio pyytävän alueen
   rajasta eikä veneen kyky, ja se muuttuu kokemuksen karttuessa. Säädetty arvo
   muistetaan venekohtaisesti. Raja ei ole järvikohtainen: aalto on aalto, ja
   matalan järven pienempi aalto näkyy kartassa itsestään. */
var AK_VENEET = [
  { id:'paijan470', nimi:'Päijän 470/471 · sähkö', turva:0.30, kalaOletus:0.15 },
  { id:'paijan520', nimi:'Päijän 520 · 10 hv',     turva:0.40, kalaOletus:0.18 },
  { id:'sunbuster', nimi:'Sun Buster · 30 hv',      turva:0.50, kalaOletus:0.20 },
  { id:'ph500',     nimi:'Pilothouse 500 · 80 hv',  turva:0.60, kalaOletus:0.20 },
  { id:'dorado100', nimi:'Silver Dorado · 100 hv',  turva:0.60, kalaOletus:0.20 }
];
var AK_LS_RAJAT = 'aaltokartta_kalastusrajat', AK_LS_VENE = 'aaltokartta_vene';
function akLueRajat(){
  try { var r = JSON.parse(localStorage.getItem(AK_LS_RAJAT));
        return (r && typeof r === 'object') ? r : {}; } catch(e){ return {}; }
}
function akVene(){
  var i = $("akVene") ? $("akVene").selectedIndex : 3;
  return AK_VENEET[i] || AK_VENEET[3];
}
function akKalaRaja(){
  var v = akVene(), r = akLueRajat();
  return Math.min(typeof r[v.id] === 'number' ? r[v.id] : v.kalaOletus, v.turva);
}

function vari(h){
  if (akTila === 'syvyys'){
    for (var is = RAJAT_S.length-1; is >= 0; is--) if (h >= RAJAT_S[is]) return VARIT_S[is];
    return VARIT_S[0];
  }
  if (akTila === 'konvergenssi'){
    var xk = h*venytys;
    for (var ik = RAJAT_K.length-1; ik >= 0; ik--) if (xk >= RAJAT_K[ik]) return VARIT_K[ik];
    return VARIT_K[0];
  }
  var x = h*venytys, R = (akTila === 'vajoama' || akTila === 'kumpuama') ? RAJAT_VI : (akTila === 'virtaus' || akTila === 'syva') ? RAJAT_V : RAJAT;
  for (var i = R.length-1; i >= 0; i--) if (x >= R[i]) return VARIT[i];
  return VARIT[0];
}

// ---- Fysiikka ----------------------------------------------------------
function jonswapHs(F, U){ return 0.0016*Math.sqrt(g*F/(U*U))*U*U/g; }
function jonswapTp(F, U){ return 0.286*Math.cbrt(g*F/(U*U))*U/g; }
function syvyysKatto(d, U){ return 0.283*(U*U/g)*Math.tanh(0.53*Math.pow(g*d/(U*U),0.75)); }
function kestonPyyhkaisy(t, U){ return Math.pow(t*Math.pow(U,0.34)*Math.pow(g,0.33)/77.23, 1/0.67); }

/* ===== MURTUVA AALLOKKO JA PAIKALLINEN SYVYYSRAJA (v167, 5.10.2026) =====
   Hannu 5.10.2026: murtuvan ja hankalan aallokon paikallistaminen (jyrkkyys, pohjan gradientti, murtumisindeksi,
   vastavirta, MCDA-taso; SWAN on liian raskas puhelimeen). Valinnat: paikallinen syvyysraja myös aaltokarttaan ja
   veneen rajaan; vaara omana karttatilana ja napautuksessa; tarkistus kartalta (tunnettuja pahoja paikkoja ei ole).
   Ennen: Hs = min(JONSWAP(F, U), SPM-syvyysraja järven YHDELLÄ syvyydellä), joten matalikoilla yliarvio.
   Nyt ruuduittain (akAaltoRuutu):
   - Madaltuminen Ks = √(cg0/cg), lineaarinen teoria; aallonpituus Fenton & McKee 1990 -likiarvolla.
   - Syvyysraja Hs ≤ γ·d: γ = 0,55 tasaisella pohjalla (Nelson 1994: vaakapohjalla H/d ≤ 0,55 myös epäsäännöllisillä
     aalloilla), 0,73 rinteellä (Battjes & Janssen 1978 / Battjes & Stive 1985, SWANin oletus); välissä lineaarisesti
     kaltevuuden 0,5–3 % mukaan (Arvio). Kaltevuus pehmennetystä syvyydestä (±75 m).
   Murtuva-tila (akMurtuvaKentta):
   - Murtumisindeksi B = Hs_tuleva/(γ·d); jyrkkyys S = Hmax/(0,142·L·tanh(kd)) eli suhde Michen rajaan;
     Hmax = 1,86·Hs (sama kerroin kuin "Suurin yksittäinen"). Jyrkkyys lasketaan riskiin vain, kun syvyys tai
     vastavirta on jyrkentänyt sitä ≥ 15 % avoveteen verrattuna (muuten koko selkä ja lyhyen pyyhkäisyn ranta-alue
     näkyisivät vaahtopäiden takia "murtuvina", mikä ei ole paikallinen vaara).
   - Vastavirta: syvemmän veden kierto + läpivirtaus aallon kulkua vastaan; syvän veden ratkaisu c/c0 = (1+√(1−4V/c0))/2,
     H/H0 = c0/√(c(c−2V)) (Longuet-Higgins & Stewart 1961). V ≥ c0/4: aalto ei etene, murtuu. Järvessä yleensä pieni.
   - Penkka: syvyyden lasku aallon kulkusuuntaan → Iribarrenin luku ξ = tanβ/√(H/L0) (Battjes 1974): alle 0,5 kuohuva,
     0,5–3,3 syöksyvä ("seinä"), yli 3,3 nouseva.
   - Luokat (Arvio): R = max(B, S): < 0,6 ei; 0,6–0,8 jyrkkenevä; 0,8–1 osa murtuu; ≥ 1 murtuu; syöksyvä erikseen.
     Värit vain, kun Hmax ≥ max(0,15 m, puolet veneen rajasta).
   Rajoitukset: syvyydet osin luokkina; ei taittumista eikä aallon kiertymistä saarten taakse (sen tekisi SWAN). */
var AK_GAMMA_TASA = 0.55, AK_GAMMA_RINNE = 0.73, AK_HMAX = 1.86;
var AK_MURT_VARIT = ['#d7e4e8', '#ffe066', '#ff9f40', '#e8453c', '#7a1446'];
var AK_MURT_NIMET = ['ei murru', 'jyrkkenevä', 'osa murtuu', 'murtuu', 'syöksyvä'];
var akGradVM = null;
function akGradientti(){
  var sl = akSileaSyvyys(); if (!sl) return null;
  if (akGradVM && akGradVM.jarvi === jarvi) return akGradVM;
  var k = jarvi.kartta, W = k.W, H = k.H, R = k.ruutu, n = mask.length;
  var gx = new Float32Array(n), gy = new Float32Array(n), jyrk = new Float32Array(n);
  for (var q = 0; q < n; q++){
    if (!mask[q]) continue;
    var i = q % W, j = (q/W)|0;
    var qe = (i < W-1 && mask[q+1]) ? q+1 : q, qw = (i > 0 && mask[q-1]) ? q-1 : q;
    var qs = (j < H-1 && mask[q+W]) ? q+W : q, qn = (j > 0 && mask[q-W]) ? q-W : q;
    var dxm = ((qe !== q ? 1 : 0) + (qw !== q ? 1 : 0))*R, dym = ((qs !== q ? 1 : 0) + (qn !== q ? 1 : 0))*R;
    gx[q] = dxm ? (sl[qe] - sl[qw])/dxm : 0;    // syvyys kasvaa itään
    gy[q] = dym ? (sl[qn] - sl[qs])/dym : 0;    // syvyys kasvaa pohjoiseen
    jyrk[q] = Math.sqrt(gx[q]*gx[q] + gy[q]*gy[q]);
  }
  akGradVM = { jarvi: jarvi, gx: gx, gy: gy, jyrk: jyrk };
  return akGradVM;
}
function akAallonpituus(T, d){
  var L0 = g*T*T/(2*Math.PI);
  if (!(d > 0)) return L0;
  return L0*Math.pow(Math.tanh(Math.pow(2*Math.PI*Math.sqrt(d/g)/T, 1.5)), 2/3);
}
function akMadaltuminen(T, L, d){
  var kd = 2*Math.PI*d/L;
  if (!(kd > 0) || kd > 3) return 1;
  var n = 0.5*(1 + 2*kd/Math.sinh(2*kd));
  return Math.sqrt((g*T/(4*Math.PI))/(n*L/T));
}
function akGamma(q){
  var G = akGradientti(); if (!G) return AK_GAMMA_RINNE;
  var t = Math.min(1, Math.max(0, (G.jyrk[q] - 0.005)/0.025));
  return AK_GAMMA_TASA + (AK_GAMMA_RINNE - AK_GAMMA_TASA)*t;
}
function akAaltoRuutu(q, Fq, U, katto){
  var F = Math.max(Fq, 50), hs0 = Math.min(jonswapHs(F, U), katto), Tp = jonswapTp(F, U);
  var r = { hs: hs0, hsIn: hs0, hs0: hs0, Tp: Tp, d: null, L: g*Tp*Tp/(2*Math.PI), Ks: 1, gamma: null, B: 0, rajattu: false };
  if (!akSyvyys) return r;
  var dq = Math.max(0.2, akSyvyys[q]), L = akAallonpituus(Tp, dq), Ks = akMadaltuminen(Tp, L, dq), ga = akGamma(q);
  r.d = dq; r.L = L; r.Ks = Ks; r.gamma = ga;
  r.hsIn = hs0*Ks; r.B = r.hsIn/(ga*dq);
  r.rajattu = r.hsIn > ga*dq; r.hs = r.rajattu ? ga*dq : r.hsIn;
  return r;
}
function akVirtaVektori(q, d, kd, lp){   // m/s: syvemmän veden kierto (sama skaalaus kuin akMalliLaske) + läpivirtaus
  var ue = 0, un = 0;
  if (kd){
    var U = Math.max(0.5, d.U), ta = (d.dir + 180)*Math.PI/180, tx = Math.sin(ta), ty = Math.cos(ta);
    var ker = AK_ILMA*AK_CD*U*U/AK_VESI*(1 - Math.exp(-d.tunteja*3600*AK_KITKA_R/kd.hKesk)), P = kd.pohjat;
    ue += (tx*P.ita.ue[q] + ty*P.pohjoinen.ue[q])*ker; un += (tx*P.ita.un[q] + ty*P.pohjoinen.un[q])*ker;
  }
  if (lp){ ue += lp.ue[q]; un += lp.un[q]; }
  return { ue: ue, un: un };
}
function akMurtuvaKentta(d, kentta, Fkesto, U, katto){
  var n = mask.length, G = akGradientti();
  var luokka = new Uint8Array(n), B = new Float32Array(n), S = new Float32Array(n), xi = new Float32Array(n), vasta = new Float32Array(n), hsU = new Float32Array(n), est = new Uint8Array(n);
  var kd = null, lp = null;
  try { kd = akKierto(); } catch(e){ kd = null; }
  try { lp = akLapiNyt(d.aika.getTime()); } catch(e){ lp = null; }
  var ta = (d.dir + 180)*Math.PI/180, ex = Math.sin(ta), ey = Math.cos(ta);   // aallon kulkusuunta (itä, pohjoinen)
  var kynnys = Math.max(0.15, 0.5*akKalaRaja()), lkm = [0, 0, 0, 0, 0];
  for (var q = 0; q < n; q++){
    if (!mask[q]) continue;
    var a = akAaltoRuutu(q, Math.min(kentta[q], Fkesto), U, katto);
    hsU[q] = a.hs; B[q] = a.B;
    if (a.d === null) continue;
    var V = 0;
    if (kd || lp){ var vv = akVirtaVektori(q, d, kd, lp); V = Math.max(0, -(vv.ue*ex + vv.un*ey)); }
    vasta[q] = V;
    var c0 = g*a.Tp/(2*Math.PI), hf = 1, lf = 1;
    if (V > 0.005){
      var dis = 1 - 4*V/c0;
      if (dis <= 0) est[q] = 1;
      else { var cc = c0*(1 + Math.sqrt(dis))/2, den = cc*(cc - 2*V); lf = cc/c0; hf = den > 0 ? Math.min(2, c0/Math.sqrt(den)) : 2; }
    }
    var Lv = a.L*lf, Hmax = AK_HMAX*a.hs*hf, raja = 0.142*Lv*Math.tanh(2*Math.PI*a.d/Lv);
    S[q] = est[q] ? 2 : Hmax/raja;
    /* Kovalla tuulella nuori aallokko on jyrkkää koko selällä ja lyhyellä pyyhkäisyllä rannan tuntumassa (vaahtopäät),
       joten jyrkkyys lasketaan riskiin vain, kun syvyys tai vastavirta on jyrkentänyt sitä ≥ 15 % avoveteen verrattuna. */
    var S0 = AK_HMAX*a.hs0/(0.142*g*a.Tp*a.Tp/(2*Math.PI)), Srel = S0 > 0 ? S[q]/S0 : 1;
    var Sk = (est[q] || Srel >= 1.15) ? S[q] : 0;
    var R = Math.max(a.B, Sk);
    var tb = G ? -(G.gx[q]*ex + G.gy[q]*ey) : 0, L0 = g*a.Tp*a.Tp/(2*Math.PI);
    xi[q] = (tb > 0.002 && a.hsIn > 0) ? tb/Math.sqrt(a.hsIn/L0) : 0;
    var c = 0;
    if (Hmax >= kynnys){
      c = R >= 1 ? 3 : R >= 0.8 ? 2 : R >= 0.6 ? 1 : 0;
      if (c >= 2 && xi[q] >= 0.5 && xi[q] <= 3.3) c = 4;
    }
    luokka[q] = c; lkm[c]++;
  }
  return { luokka: luokka, B: B, S: S, xi: xi, vasta: vasta, hs: hsU, est: est, lkm: lkm, kynnys: kynnys, kierto: !!kd, lapi: !!lp };
}

function kompassi(dir){
  var n = ["pohjoisesta","koillisesta","idästä","kaakosta","etelästä",
           "lounaasta","lännestä","luoteesta"];
  return n[Math.round(((dir%360)+360)%360/45)%8];
}

// ---- Maskin purku ------------------------------------------------------
function puraMaski(k){
  var raaka = atob(k.maski), mask = new Uint8Array(k.W*k.H);
  for (var i = 0; i < mask.length; i++){
    mask[i] = (raaka.charCodeAt(i>>3) >> (7-(i&7))) & 1;
  }
  return mask;
}

// ---- Pyyhkäisy: pyyhkäisymatka JOKAISELLE ruudulle ---------------------
// Sama yhdensuuntainen pyyhkäisy kuin laskennassa, mutta juokseva
// vesijakson pituus tallennetaan matkan varrella eikä vain maksimia.
function pyyhkaisyKentta(mask, W, H, ruutu, suunta){
  var rad = (suunta + 180)*Math.PI/180;
  var ux = Math.sin(rad), uy = -Math.cos(rad), px = -uy, py = ux;
  var kentta = new Float32Array(W*H);
  var dia = Math.ceil(Math.sqrt(W*W + H*H)), cx = W/2, cy = H/2;

  for (var n = -dia; n <= dia; n++){
    var sx = cx + px*n - ux*dia/2, sy = cy + py*n - uy*dia/2, jakso = 0;
    for (var s = 0; s < dia; s++){
      var i = Math.round(sx + ux*s), j = Math.round(sy + uy*s);
      if (i < 0 || i >= W || j < 0 || j >= H){ jakso = 0; continue; }
      var k = j*W + i;
      if (mask[k]){
        jakso++;
        var m = jakso*ruutu;
        if (m > kentta[k]) kentta[k] = m;   // sama ruutu voi osua monelle viivalle
      } else jakso = 0;
    }
  }

  // viivapyyhkäisy ohittaa pyöristyksen takia satunnaisen ruudun.
  // Paikataan tyhjät vesiruudut naapurien suurimmalla arvolla.
  for (var j2 = 0; j2 < H; j2++){
    for (var i2 = 0; i2 < W; i2++){
      var k2 = j2*W + i2;
      if (!mask[k2] || kentta[k2] > 0) continue;
      var paras = 0;
      for (var dy = -1; dy <= 1; dy++){
        for (var dx = -1; dx <= 1; dx++){
          var jj = j2+dy, ii = i2+dx;
          if (jj < 0 || jj >= H || ii < 0 || ii >= W) continue;
          var n2 = jj*W + ii;
          if (mask[n2] && kentta[n2] > paras) paras = kentta[n2];
        }
      }
      kentta[k2] = paras || ruutu;
    }
  }
  return kentta;
}

// ---- Piirto ------------------------------------------------------------
var data = [], valittu = 0, jarvi = null, mask = null, kentta = null, viimeSuunta = null;
var akLatausLupaus = null;   // saaliin kirjaus odottaa tätä, jos kortti käynnistettiin hiljaa

/* Pyyhkäisykenttien välimuisti suunnittain. Jana tarvitsee kentän jokaiselle
   tunnille, ja ilman välimuistia sama suunta laskettaisiin uudestaan joka
   kerta. Tyhjennetään järven vaihdossa. */
var akKentat = {};
function akKentta(suunta){
  if (!akKentat[suunta]){
    akKentat[suunta] = pyyhkaisyKentta(mask, jarvi.kartta.W, jarvi.kartta.H,
                                       jarvi.kartta.ruutu, suunta);
  }
  return akKentat[suunta];
}

function piirra(){
  var d = data[valittu], k = jarvi.kartta;
  if (!d || !k) return;

  // pyyhkäisykenttä lasketaan vain kun suunta vaihtuu
  var suunta = Math.round(d.dir/5)*5;
  if (suunta !== viimeSuunta){
    kentta = akKentta(suunta);
    viimeSuunta = suunta;
  }

  var U = Math.max(0.5, d.U);
  var Fkesto = kestonPyyhkaisy(d.tunteja*3600, U);
  var katto = syvyysKatto(jarvi.syvyys, U);

  // Korostustilassa etsitään ensin tunnin korkein arvo ja venytetään
  // asteikko siihen, muuten käytetään kiinteää järviasteikkoa.
  // Aallonkorkeus jokaiselle ruudulle
  var hs = new Float32Array(mask.length), korkein = 0;
  var vir = akSyvyys ? new Float32Array(mask.length) : null, virMax = 0;   // km/h
  var kalaRaja = akKalaRaja(), kelpaa = 0, vesiruutuja = 0;
  for (var q = 0; q < mask.length; q++){
    if (!mask[q]) continue;
    var Fq = Math.min(kentta[q], Fkesto);
    hs[q] = akAaltoRuutu(q, Fq, U, katto).hs;   // v167: madaltuminen ja paikallinen syvyysraja
    if (hs[q] > korkein) korkein = hs[q];
    vesiruutuja++;
    if (hs[q] <= kalaRaja) kelpaa++;
    if (vir){
      var syvK = 1.0 + (5.0 - Math.min(akSyvyys[q], 5.0)) * 0.15;
      var pyyK = 0.4 + 0.6 * Math.min(1, Fq/3000);
      vir[q] = U * 2 * syvK * pyyK * 0.036;        // cm/s -> km/h
      if (vir[q] > virMax) virMax = vir[q];
    }
  }
  d.osuus = vesiruutuja ? kelpaa/vesiruutuja : 0;
  d.virMax = virMax;

  /* SYVEMPI VESI: pohjaratkaisut yhdistetään tämän tunnin tuulen suuntaan ja
     skaalataan tuulijännityksellä τ/ρ = ρa·Cd·U²/ρ. Kierto kehittyy tuntien
     mittaan: kitkan aikavakio on keskisyvyys / r (Lappajärvellä noin 2 h),
     joten lyhyt tuuli saa vain osan pysyvän tilan virrasta. */
  var syva = false, kue = null, kun = null, kv = null, kvMax = 0;
  if ((akTila === 'syva' || akTila === 'konvergenssi') && akSyvyys){
    var sk = akSyvaKentta(d);
    if (sk){
      syva = akTila === 'syva'; kue = sk.kue; kun = sk.kun; kv = sk.kv; kvMax = sk.kvMax;
      d.kvMax = kvMax; d.vastaOsuus = sk.vastaOsuus; d.kehitys = sk.kehitys; d.lapiMukana = sk.lapiMukana;
    }
  }

  // v145: VAJOAMA (ks. RAJAT_VI-kommentti); v147: laskenta akVajoamaKentta-funktiossa (myös raportti käyttää)
  var vajoama = false, vi = null, viMax = 0, viOsuus = 0;
  if ((akTila === 'vajoama' || akTila === 'kumpuama') && vir && akSyvyys){
    var vk = akVajoamaKentta(d, vir, akTila === 'kumpuama');
    vajoama = true; vi = vk.vi; viMax = vk.viMax; viOsuus = vk.osuus;
    d.viMax = viMax; d.viOsuus = viOsuus;
  }

  // v150: KONVERGENSSI = vajoama − kumpuama, ja virtasaumat syvemmän veden kentästä
  var konv = false, kf = null, saumat = null;
  if (akTila === 'konvergenssi' && vir && akSyvyys){
    konv = true;
    var vkA = akVajoamaKentta(d, vir), vkB = akVajoamaKentta(d, vir, true);
    kf = new Float32Array(mask.length);
    var kMax = 0, kMin = 0;
    for (var qk = 0; qk < mask.length; qk++){ if (!mask[qk]) continue; kf[qk] = vkA.vi[qk] - vkB.vi[qk]; if (kf[qk] > kMax) kMax = kf[qk]; if (kf[qk] < kMin) kMin = kf[qk]; }
    if (kue) saumat = akSaumat({ kue: kue, kun: kun, kv: kv });
    d.konvMax = kMax; d.konvMin = kMin; d.saumoja = saumat ? saumat.maara : null; d.saumaOsuus = saumat ? saumat.osuus : null;
  }
  var reunaK = konv ? akKonvReuna(kf) : null;   // v152
  if (konv) d.reunaOsuus = reunaK ? reunaK.osuus : null;
  var syvK = (akTila === 'syvyys' && akSyvyys) ? akSileaSyvyys() : null;   // v152 syvyyskartta
  var murt = (akTila === 'murtuva' && akSyvyys) ? akMurtuvaKentta(d, kentta, Fkesto, U, katto) : null;   // v167
  if (murt) d.murtLkm = murt.lkm;
  var virtaus = (akTila === 'virtaus' && vir);
  var arvot = syvK ? syvK : konv ? kf : vajoama ? vi : syva ? kv : virtaus ? vir : hs;
  var huippu = syvK ? 1 : konv ? Math.max(d.konvMax || 0, -(d.konvMin || 0)) : vajoama ? viMax : syva ? kvMax : virtaus ? virMax : korkein;
  var R = vajoama ? RAJAT_VI : (virtaus || syva) ? RAJAT_V : RAJAT;

  venytys = 1;
  if (korosta && huippu > 0.02) venytys = R[R.length-1]/(huippu*1.02);
  piirraAsteikko();

  // Piirretään moninkertaisella tarkkuudella ja pehmennetään aallonkorkeus
  // ruutujen välillä. Näin ranta pysyy terävänä mutta pinta ei ole porrasteinen.
  // v136: vahva kumpuaminen -> pinkki alue
  var kumpu = null, kumpuInfo = $("akKumpuInfo"), kumpuArvioVain = false;
  try {
    /* Kesto: ennustesarjan alusta laskettu kesto + havaittu tuuli ennen sarjaa, jos tuuli on
       pysynyt samana sarjan alusta asti. Pyyhkäisymatka tuulen suunnassa (akSuunnattuMitta). */
    var tunt = d.tunteja, ix = data.indexOf(d);
    if (ix >= 0 && d.tunteja >= ix + 1 && typeof window.kumpuHistoriaTunteja === 'function') tunt += window.kumpuHistoriaTunteja(data[0].dir);
    var Lk = (typeof window.akSuunnattuMitta === 'function') ? window.akSuunnattuMitta(d.dir, jarvi.nimi) : null;
    if (!(Lk > 200)) Lk = d.Fpahin || 0;
    var ka = (typeof window.kumpuArvio === 'function') ? window.kumpuArvio(U, Lk, tunt) : null;
    if (ka && ka.vahva) kumpu = akKumpuAlue(d.dir);
    kumpuArvioVain = !!(kumpu && !ka.mitattu);
    if (kumpuInfo){
      if (kumpu){ kumpuInfo.style.display = '';
        kumpuInfo.textContent = (kumpuArvioVain ? 'Vaaleanpinkki = ARVIOITU kumpuamisalue' : 'Pinkki = todennäköinen kumpuamisalue') + ': kylmää alusvettä nousee. Wedderburn-luku '
          + ka.W.toFixed(2).replace('.', ',') + ' (≤ 1), tuuli kestänyt ' + tunt + ' h (tarve noin ' + Math.max(1, Math.round(ka.kestoH)) + ' h). Kerrostuneisuus: ' + ka.lahde + '.'; }
      else { kumpuInfo.style.display = 'none'; kumpuInfo.textContent = ''; }
    }
  } catch (e) { kumpu = null; }

  var win = akIkkuna(k);
  var S = Math.min(24, Math.max(2, Math.round(380/win.w)));
  if (akVientiKerroin > 1) S = Math.max(S, Math.min(S*akVientiKerroin, Math.floor(4200/Math.max(win.w, win.h))));   // v152 Ozi-vienti
  var LW = win.w*S, LH = win.h*S;
  var c = $("akKuva");
  c.width = LW; c.height = LH;
  var ctx = c.getContext("2d"), kuva = ctx.createImageData(LW, LH);
  var talteen = {};

  function rgb(v){
    var avain = Math.round(v*400);
    if (talteen[avain]) return talteen[avain];
    var h = vari(v);
    var t = [parseInt(h.substr(1,2),16), parseInt(h.substr(3,2),16), parseInt(h.substr(5,2),16)];
    talteen[avain] = t;
    return t;
  }

  for (var y = 0; y < LH; y++){
    var v0 = y/S - 0.5 + win.j0, j0 = Math.floor(v0), fy = v0 - j0;
    for (var x = 0; x < LW; x++){
      var o = (y*LW + x)*4;
      // Ranta ratkaistaan lähimmästä ruudusta, jotta reuna ei leviä.
      var ni = Math.min(k.W-1, Math.max(0, Math.round(x/S - 0.5) + win.i0));
      var nj = Math.min(k.H-1, Math.max(0, Math.round(v0)));
      if (!mask[nj*k.W + ni]){
        kuva.data[o] = 232; kuva.data[o+1] = 236; kuva.data[o+2] = 231; kuva.data[o+3] = 255;
        continue;
      }
      var u0 = x/S - 0.5 + win.i0, i0 = Math.floor(u0), fx = u0 - i0;
      var summa = 0, paino = 0;
      for (var dy = 0; dy < 2; dy++){
        for (var dx = 0; dx < 2; dx++){
          var ii = i0+dx, jj = j0+dy;
          if (ii < 0 || ii >= k.W || jj < 0 || jj >= k.H) continue;
          var kk = jj*k.W + ii;
          if (!mask[kk]) continue;            // maa ei osallistu pehmennykseen
          var p = (dx ? fx : 1-fx) * (dy ? fy : 1-fy);
          summa += arvot[kk]*p; paino += p;
        }
      }
      var arvo = paino > 0 ? summa/paino : arvot[nj*k.W + ni];
      var t = rgb(arvo);
      if (murt){   // v167: murtuva aallokko luokittain, lähin ruutu (terävät reunat)
        var mv = AK_MURT_VARIT[murt.luokka[nj*k.W + ni]];
        kuva.data[o] = parseInt(mv.substr(1,2),16); kuva.data[o+1] = parseInt(mv.substr(3,2),16); kuva.data[o+2] = parseInt(mv.substr(5,2),16);
      } else if (!virtaus && !syva && !vajoama && !konv && !syvK && arvo > kalaRaja){
        /* Rajan yli: himmennetään kohti tummaa. Väri jää luettavaksi mutta
           kelvollinen alue hyppää esiin. Turvarajan yli vielä enemmän. */
        var kerroin = arvo > akVene().turva ? 0.30 : 0.55;
        kuva.data[o]   = Math.round(t[0]*kerroin);
        kuva.data[o+1] = Math.round(t[1]*kerroin);
        kuva.data[o+2] = Math.round(t[2]*kerroin);
      } else {
        kuva.data[o] = t[0]; kuva.data[o+1] = t[1]; kuva.data[o+2] = t[2];
      }
      if (kumpu && kumpu[nj*k.W + ni]){   // v136: pinkki; v137: arvio vaaleampi
        var pa = kumpuArvioVain ? 0.5 : 0.8, pg = kumpuArvioVain ? 140 : 64, pb = kumpuArvioVain ? 200 : 170;
        kuva.data[o]   = Math.round(kuva.data[o]*(1-pa) + 255*pa);
        kuva.data[o+1] = Math.round(kuva.data[o+1]*(1-pa) + pg*pa);
        kuva.data[o+2] = Math.round(kuva.data[o+2]*(1-pa) + pb*pa);
      }
      kuva.data[o+3] = 255;
    }
  }
  ctx.putImageData(kuva, 0, 0);

  // Nuolet: mihin aalto (tai virtaus) kulkee; v152: syvyyskartalla ei nuolia
  var rad = ((virtaus || vajoama || konv) ? akVirtausSuunta(d.dir) : d.dir + 180)*Math.PI/180;
  var nuoletPois = !!syvK;
  var ax = Math.sin(rad), ay = -Math.cos(rad);
  var vali = Math.max(6, Math.round(win.w/13))*S, pit = vali*0.40;
  ctx.strokeStyle = "rgba(16,24,22,.55)";
  ctx.lineWidth = Math.max(1.1, LW/300);
  ctx.lineCap = "round";
  ctx.beginPath();
  for (var jy = vali; jy < LH; jy += vali){
    for (var jx = vali; jx < LW; jx += vali){
      var mi = Math.min(k.W-1, Math.floor(jx/S) + win.i0), mj = Math.min(k.H-1, Math.floor(jy/S) + win.j0);
      if (!mask[mj*k.W + mi] || nuoletPois) continue;
      if (syva){
        /* Syvemmässä vedessä suunta vaihtelee paikasta toiseen, joten nuoli
           piirretään ruudun omaan suuntaan. Lähes seisova vesi jää ilman. */
        var mq = mj*k.W + mi, ve = kue[mq], vn = kun[mq], vv = Math.sqrt(ve*ve + vn*vn);
        if (vv*3.6 < 0.01) continue;
        ax = ve/vv; ay = -vn/vv;
      }
      var x1 = jx - ax*pit, y1 = jy - ay*pit, x2 = jx + ax*pit, y2 = jy + ay*pit;
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.moveTo(x2, y2); ctx.lineTo(x2 - ax*pit*0.45 - ay*pit*0.28, y2 - ay*pit*0.45 + ax*pit*0.28);
      ctx.moveTo(x2, y2); ctx.lineTo(x2 - ax*pit*0.45 + ay*pit*0.28, y2 - ay*pit*0.45 - ax*pit*0.28);
    }
  }
  ctx.stroke();

  /* v150: virtasaumat viivoina (violetti), vain konvergenssitilassa */
  if (konv && saumat){
    // saumaruudut violetteina pisteinä; vierekkäiset pisteet muodostavat viivan
    ctx.fillStyle = "rgba(76,20,110,.85)";
    var ps = Math.max(1.6, S*0.7), po = (S - ps)/2;
    for (var js = win.j0; js < win.j0 + win.h; js++){
      for (var is2 = win.i0; is2 < win.i0 + win.w; is2++){
        var qs = js*k.W + is2; if (!saumat.sauma[qs]) continue;
        ctx.fillRect((is2 - win.i0)*S + po, (js - win.j0)*S + po, ps, ps);
      }
    }
  }

  /* v152 SYVYYSKÄYRÄT: marching squares pehmennetystä syvyydestä (v145–v151 piirsi ruutujen reunoja,
     mikä porrasti 50 m ruudukossa). Syvyyskartalla aina; muissa tiloissa kytkimellä. */
  if ((akKayrat || syvK) && akSyvyys) akPiirraKayrat(ctx, win, S, LW);

  /* v152: konvergenssin syvä reuna (≥ 1,5 m) ruskealla ääriviivalla */
  if (konv && reunaK){
    ctx.strokeStyle = "rgba(120,62,12,.9)"; ctx.lineWidth = Math.max(1.4, S/3); ctx.beginPath();
    for (var jr = win.j0; jr < win.j0 + win.h; jr++){
      for (var ir = win.i0; ir < win.i0 + win.w; ir++){
        var qr = jr*k.W + ir; if (!reunaK.reuna[qr]) continue;
        var xr = (ir - win.i0)*S, yr = (jr - win.j0)*S;
        if (ir + 1 >= k.W || !reunaK.reuna[qr+1]){ ctx.moveTo(xr+S, yr); ctx.lineTo(xr+S, yr+S); }
        if (ir - 1 < 0 || !reunaK.reuna[qr-1]){ ctx.moveTo(xr, yr); ctx.lineTo(xr, yr+S); }
        if (jr + 1 >= k.H || !reunaK.reuna[qr+k.W]){ ctx.moveTo(xr, yr+S); ctx.lineTo(xr+S, yr+S); }
        if (jr - 1 < 0 || !reunaK.reuna[qr-k.W]){ ctx.moveTo(xr, yr); ctx.lineTo(xr+S, yr); }
      }
    }
    ctx.stroke();
  }

  /* v152: syvyysluvut merikartan tapaan, kun ruutu on vähintään 5 px (zoomattuna tai Ozi-viennissä) */
  if (syvK && S >= 5){
    var askelL = Math.max(2, Math.ceil(70/S)), fs = Math.max(10, Math.min(15, Math.round(S*1.4)));
    ctx.font = fs + "px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.lineWidth = Math.max(2, fs/4); ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.fillStyle = "#0b2f55";
    for (var jl = win.j0 + Math.floor(askelL/2); jl < win.j0 + win.h; jl += askelL){
      for (var il = win.i0 + Math.floor(askelL/2); il < win.i0 + win.w; il += askelL){
        var ql = jl*k.W + il; if (!mask[ql]) continue;
        if (il < 1 || jl < 1 || il >= k.W - 1 || jl >= k.H - 1 || !mask[ql-1] || !mask[ql+1] || !mask[ql-k.W] || !mask[ql+k.W]) continue;
        var hl = syvK[ql], tx = hl < 10 ? hl.toFixed(1).replace('.', ',') : String(Math.round(hl));
        var xl = (il - win.i0 + 0.5)*S, yl = (jl - win.j0 + 0.5)*S;
        ctx.strokeText(tx, xl, yl); ctx.fillText(tx, xl, yl);
      }
    }
  }

  /* Talteen napautusta varten: nämä ovat piirron paikallisia, mutta napautus
     tarvitsee ne piirron jälkeen. */
  akViime = { murt:murt, hs:hs, vir:vir, vi:vi, kf:kf, saumat:saumat, reuna:reunaK, syvK:syvK, kue:kue, kun:kun, kv:kv, kentta:kentta, k:k, S:S, win:win, kalaRaja:kalaRaja, turva:akVene().turva, dir:d.dir };
  akPiirraKuhaMerkit(ctx, win, S);   // v153
  akPiirraTaimenMerkit(ctx, win, S);   // v156
  try { akPiirraKloonit(ctx, win, S); } catch (e) {}   // v177
  try { akPiirraOmaSijainti(ctx, win, S); } catch (e) {}   // v179
  try { akPiirraOmaLuotaus(ctx, win, S); } catch (e) {}   // v172
  akPiirraMerkki(ctx, S);
  akKuhaInfoPaivita();
  akTaimenInfoPaivita();   // v156
  try { akKlooniInfoPaivita(); } catch (e) {}   // v177

  d.korkein = korkein;
  d.Tp = jonswapTp(Math.min(d.Fpahin, Fkesto), U);
  naytaTiedot(d);
  akNaytaPiste();
}

var akViime = null, akValittu = null;

/* ===== OZIEXPLORER-VIENTI — 4.10.2026 (v148) =====
   Hannun pyyntö: nappi, joka tallentaa näkyvän kartan kuvana ja tekee OziExplorerin .map-
   kalibrointitiedoston. Kartan ruudukossa leveysaste on lineaarinen pystysuunnassa, mutta
   pituusaste riippuu rivin leveysasteesta (ruutu = metriä, cos(lat)). Siksi kuva muunnetaan
   ennen tallennusta rivi kerrallaan lat/lon-ruudukkoon: x lineaarinen pituusasteessa, y lineaarinen
   leveysasteessa. Silloin .map-tiedoston projektio "Latitude/Longitude" ja neljä kulmapistettä
   ovat tarkkoja koko kuvalle (ei kalibrointivirhettä reunoilla). Datum WGS 84 (kartat ovat
   ETRS89/WGS84-koordinaateissa; ero < 1 m). Formaatti: OziExplorer Map Data File Version 2.2. */
function akOziAste(v, pos, neg, lev){
  var h = v >= 0 ? pos : neg, a = Math.abs(v), d = Math.floor(a), m = (a - d)*60;
  if (m >= 59.99995){ d += 1; m = 0; }
  var ds = String(d); while (ds.length < lev) ds = ' ' + ds;
  var ms = m.toFixed(4); while (ms.length < 8) ms = ' ' + ms;   // Ozin oma muoto: '  63, 15.8904,N'
  return ds + ',' + ms + ',' + h;
}
window.akTallennaOzi = function(){
  var tila = $("akOziTila");
  var nayta = function(t){ if (tila){ tila.style.display = ''; tila.textContent = t; } };
  // v152: piirretään vientiä varten noin 3× tarkkuudella (enintään 4200 px), palautetaan sen jälkeen
  var valittuTalteen = akValittu; akValittu = null;   // valintarengas ei kuulu vientikuvaan
  try { akVientiKerroin = 3; piirra(); } catch(e0){ akVientiKerroin = 1; }
  var palauta = function(){ akVientiKerroin = 1; akValittu = valittuTalteen; try { piirra(); } catch(e1){} };
  try {
    if (!akViime || !jarvi || !jarvi.kartta){ nayta('Kartta ei ole vielä valmis.'); return; }
    var c = $("akKuva"), LW = c.width, LH = c.height, k = akViime.k, S = akViime.S, win = akViime.win;
    var lon0 = k.lansiLon, lat0 = k.pohjoisLat, rr = k.ruutu;
    var latY = function(y){ return lat0 - (y/S + win.j0)*rr/111320; };
    var lonXY = function(x, y){ var la = latY(y); return lon0 + (x/S + win.i0)*rr/(111320*Math.cos(la*Math.PI/180)); };
    var latN = latY(0), latS = latY(LH);
    var lonMin = Math.min(lonXY(0, 0), lonXY(0, LH)), lonMax = Math.max(lonXY(LW, 0), lonXY(LW, LH));
    var keskiLeveys = lonXY(LW, LH/2) - lonXY(0, LH/2);
    var WO = Math.round(LW*(lonMax - lonMin)/keskiLeveys), HO = LH;
    var src = c.getContext('2d').getImageData(0, 0, LW, LH).data;
    var out = document.createElement('canvas'); out.width = WO; out.height = HO;
    var octx = out.getContext('2d'), img = octx.createImageData(WO, HO), od = img.data;
    for (var y = 0; y < HO; y++){
      var la = latN + (latS - latN)*(y + 0.5)/HO, cosl = Math.cos(la*Math.PI/180), sy = Math.min(LH - 1, Math.max(0, Math.floor(y)));
      for (var x = 0; x < WO; x++){
        var lo = lonMin + (lonMax - lonMin)*(x + 0.5)/WO;
        var sx = Math.floor(((lo - lon0)*111320*cosl/rr - win.i0)*S);
        var o = (y*WO + x)*4;
        if (sx < 0 || sx >= LW){ od[o] = 232; od[o+1] = 236; od[o+2] = 231; od[o+3] = 255; continue; }
        var si = (sy*LW + sx)*4;
        od[o] = src[si]; od[o+1] = src[si+1]; od[o+2] = src[si+2]; od[o+3] = 255;
      }
    }
    octx.putImageData(img, 0, 0);
    var d = data[valittu] || {}, pv = d.aika || new Date();
    var p2 = function(n){ return ('0' + n).slice(-2); };
    var tilaNimi = { aalto: 'aallot', virtaus: 'pintavirta', syva: 'syvavesi', vajoama: 'vajoama', kumpuama: 'kumpuama', konvergenssi: 'konvergenssi', syvyys: 'syvyyskartta' }[akTila] || akTila;
    var jn = (jarvi.nimi || 'jarvi').toLowerCase().replace(/[åä]/g, 'a').replace(/ö/g, 'o').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    var nimi = 'uistelututka_' + jn + '_' + tilaNimi + '_' + pv.getFullYear() + p2(pv.getMonth() + 1) + p2(pv.getDate()) + '_' + p2(pv.getHours()) + '00';
    var mpp = (latN - latS)*111320/HO;
    var pisteet = [[0, 0, latN, lonMin], [WO, 0, latN, lonMax], [WO, HO, latS, lonMax], [0, HO, latS, lonMin]];
    var L = [];
    L.push('OziExplorer Map Data File Version 2.2');
    // OziExplorer lukee .map-tiedoston ANSI-merkistönä: otsikko ilman ääkkösiä
    var ascii = function(t){ return String(t).replace(/[äå]/g, 'a').replace(/[ÄÅ]/g, 'A').replace(/ö/g, 'o').replace(/Ö/g, 'O').replace(/[^\x20-\x7e]/g, ''); };
    L.push(ascii(jarvi.nimi) + ' ' + tilaNimi + ' ' + pv.getDate() + '.' + (pv.getMonth() + 1) + '.' + pv.getFullYear() + ' klo ' + p2(pv.getHours())
      + (d.U ? ', tuuli ' + Math.round(d.U) + ' m/s ' + Math.round(d.dir) + ' deg' : '') + ' (uistelututka)');
    L.push(nimi + '.png');
    L.push('1 ,Map Code,');
    L.push('WGS 84,WGS 84,   0.0000,   0.0000,WGS 84');
    L.push('Reserved 1'); L.push('Reserved 2');
    L.push('Magnetic Variation,,,E');
    L.push('Map Projection,Latitude/Longitude,PolyCal,No,AutoCalOnly,No,BSBUseWPX,No');
    for (var n = 1; n <= 30; n++){
      var nn = 'Point' + p2(n), pp = pisteet[n - 1];
      if (pp) L.push(nn + ',xy,' + ('     ' + pp[0]).slice(-5) + ',' + ('     ' + pp[1]).slice(-5) + ',in, deg,' + akOziAste(pp[2], 'N', 'S', 4) + ',' + akOziAste(pp[3], 'E', 'W', 4) + ', grid,   ,           ,           ,N');
      else L.push(nn + ',xy,     ,     ,in, deg,    ,        ,N,    ,        ,E, grid,   ,           ,           ,N');
    }
    L.push('Projection Setup,,,,,,,,,,');
    L.push('Map Feature = MF ; Map Comment = MC     These follow if they exist');
    L.push('Track File = TF      These follow if they exist');
    L.push('Moving Map Parameters = MM?    These follow if they exist');
    L.push('MM0,Yes');
    L.push('MMPNUM,4');
    pisteet.forEach(function(pp, i){ L.push('MMPXY,' + (i + 1) + ',' + pp[0] + ',' + pp[1]); });
    pisteet.forEach(function(pp, i){ L.push('MMPLL,' + (i + 1) + ',' + pp[3].toFixed(6) + ',' + pp[2].toFixed(6)); });
    L.push('MM1B,' + mpp.toFixed(6));
    L.push('MOP,Map Open Position,0,0');
    L.push('IWH,Map Image Width/Height,' + WO + ',' + HO);
    var mapTxt = L.join('\r\n') + '\r\n';
    var lataa = function(blob, tiedosto){
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = tiedosto;
      document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    };
    palauta();
    out.toBlob(function(png){
      lataa(png, nimi + '.png');
      setTimeout(function(){ lataa(new Blob([mapTxt], { type: 'application/octet-stream' }), nimi + '.map'); }, 700);
      nayta('Tallennettu Latauksiin: ' + nimi + '.png ja .map (' + WO + ' × ' + HO + ' px, ' + mpp.toFixed(1).replace('.', ',') + ' m/px). '
        + 'Pidä tiedostot samassa kansiossa ja avaa .map OziExplorerissa. Jos selain kysyy usean tiedoston latausta, salli se.');
    }, 'image/png');
  } catch (e){ palauta(); nayta('Tallennus epäonnistui: ' + (e && e.message || e)); }
};

/* v147: vajoamakenttä tunnille d. vir = pintavirta km/h ruuduittain (piirra laskee sen; raportille
   lasketaan tässä samalla kaavalla). Palauttaa { vi, viMax, osuus } (osuus = vesiruuduista ≥ 30). */
function akPintavirtaKentta(d){
  var k = jarvi.kartta, U = Math.max(0.5, d.U);
  var ke = akKentta(Math.round(d.dir/5)*5), Fk = kestonPyyhkaisy(d.tunteja*3600, U);
  var vir = new Float32Array(mask.length);
  for (var q = 0; q < mask.length; q++){
    if (!mask[q]) continue;
    var Fq = Math.min(ke[q], Fk);
    var syvK = 1.0 + (5.0 - Math.min(akSyvyys[q], 5.0)) * 0.15, pyyK = 0.4 + 0.6 * Math.min(1, Fq/3000);
    vir[q] = U * 2 * syvK * pyyK * 0.036;
  }
  return vir;
}
/* v149: kaanteinen = KUMPUAMA, vajoaman peilikuva: pintavesi työntyy pois rannalta (ranta virran
   yläpuolella 150 m sisällä) tai virtaa syvenevän pohjan yli (kuljetus kasvaa -> pinta erkanee).
   Kerrostuneessa järvessä sieltä nousee alusvettä; pinkki VAHVA kumpuamisalue tulee edelleen vain
   Wedderburn-ehdoilla (kumpuArvio), tämä on pelkkä liikeindeksi. */
function akVajoamaKentta(d, vir, kaanteinen){
  var k = jarvi.kartta;
  var vb = (akVirtausSuunta(d.dir) + (kaanteinen ? 180 : 0))*Math.PI/180, vsx = Math.sin(vb), vsy = -Math.cos(vb);   // ruudukossa j kasvaa etelään
  var Wk = k.W, Hk = k.H, rr = k.ruutu, raw = new Float32Array(mask.length);
  var kestoK = 0.55 + 0.45*Math.min(1, d.tunteja/6), rantaAskel = Math.max(1, Math.round(150/rr));
  for (var qv = 0; qv < mask.length; qv++){
    if (!mask[qv]) continue;
    var iv = qv % Wk, jv = (qv/Wk)|0, hc = akSyvyys[qv];
    var hE = (iv+1 < Wk && mask[qv+1]) ? akSyvyys[qv+1] : hc, hW = (iv > 0 && mask[qv-1]) ? akSyvyys[qv-1] : hc;
    var hS = (jv+1 < Hk && mask[qv+Wk]) ? akSyvyys[qv+Wk] : hc, hN = (jv > 0 && mask[qv-Wk]) ? akSyvyys[qv-Wk] : hc;
    var dhds = (hE - hW)/(2*rr)*vsx + (hS - hN)/(2*rr)*vsy;
    /* v149: pohjan muoto vaikuttaa tuulen ajamaan pintakerrokseen vain matalassa vedessä: paino
       1 − h/8 m (päätelmä: pintakerros on muutaman metrin paksu). Aiemmin syvän uoman jyrkät reunat
       20–30 m:ssä nousivat vahvimmiksi, vaikka pintavesi ei niitä "tunne". Ranta-termi ennallaan. */
    var matalaK = Math.max(0, 1 - hc/8);
    var nousu = dhds < 0 ? Math.min(1, -dhds/0.03)*matalaK : 0;
    var ranta = 0;
    for (var st = 1; st <= rantaAskel; st++){
      var ri = Math.round(iv + vsx*st), rj = Math.round(jv + vsy*st);
      if (ri < 0 || rj < 0 || ri >= Wk || rj >= Hk || !mask[rj*Wk + ri]){ ranta = 1 - (st - 1)/rantaAskel; break; }
    }
    raw[qv] = vir[qv]*Math.max(nousu, ranta)*kestoK/0.6*100;
  }
  var vi = new Float32Array(mask.length), viMax = 0, viYli = 0, viN = 0, rP = Math.max(1, Math.round(100/rr));
  for (var qw = 0; qw < mask.length; qw++){
    if (!mask[qw]) continue;
    var iw = qw % Wk, jw = (qw/Wk)|0, sm = 0, nn = 0;
    for (var a1 = -rP; a1 <= rP; a1++) for (var b1 = -rP; b1 <= rP; b1++){
      var i2 = iw + a1, j2 = jw + b1; if (i2 < 0 || j2 < 0 || i2 >= Wk || j2 >= Hk) continue;
      var q3 = j2*Wk + i2; if (!mask[q3]) continue; sm += raw[q3]; nn++;
    }
    vi[qw] = Math.min(100, nn ? sm/nn : 0);
    if (vi[qw] > viMax) viMax = vi[qw];
    viN++; if (vi[qw] >= 30) viYli++;
  }
  return { vi: vi, viMax: viMax, osuus: viN ? viYli/viN : 0 };
}
/* v147: RAPORTTIA VARTEN. Vahvin vajoama-alue järven osana (ilmansuunta painopisteestä) ja enintään
   kaksi pistettä, joiden ympärillä on vettä vähintään 200 m (3.10. opittu: rantaruudut osuvat maalle). */
/* v149: SAALIIN VEDEN LIIKE. Kirjataan saaliiseen: vajoama- ja kumpuamaindeksi saaliin ruudussa,
   oliko pinkki (vahva) kumpuamisalue, ja kuinka suuri osa järvestä oli samalla hetkellä kussakin
   luokassa (odotusarvo satunnaiselle paikalle). Luokka: kumpu (pinkki) > vajoama (≥ 30 ja ≥ kumpuama)
   > kumpuama (≥ 30) > muu. Välimuisti tunnin mukaan, koska kenttä lasketaan koko järvelle. */
var akVLValimuisti = {};
/* v150: syvemmän veden kenttä tunnille d (sama kaava kuin ennen piirra-funktiossa). */
function akSyvaKentta(d){
  var kd = akKierto(); if (!kd) return null;
  var U = Math.max(0.5, d.U);
  var ta = (d.dir + 180)*Math.PI/180, tx = Math.sin(ta), ty = Math.cos(ta);
  var tau = AK_ILMA*AK_CD*U*U/AK_VESI;
  var kehitys = 1 - Math.exp(-d.tunteja*3600*AK_KITKA_R/kd.hKesk);
  var P = kd.pohjat, kerroin = tau*kehitys, vastaan = 0, kvN = 0, kvMax = 0;
  var kue = new Float32Array(mask.length), kun = new Float32Array(mask.length), kv = new Float32Array(mask.length);
  var lapi = akLapiNyt(d.aika ? d.aika.getTime() : null);   // 29.9.2026: Hirvijärven läpivirtaus
  for (var q2 = 0; q2 < mask.length; q2++){
    if (!mask[q2]) continue;
    kue[q2] = (tx*P.ita.ue[q2] + ty*P.pohjoinen.ue[q2])*kerroin + (lapi ? lapi.ue[q2] : 0);
    kun[q2] = (tx*P.ita.un[q2] + ty*P.pohjoinen.un[q2])*kerroin + (lapi ? lapi.un[q2] : 0);
    kv[q2] = Math.sqrt(kue[q2]*kue[q2] + kun[q2]*kun[q2])*3.6;       // km/h
    if (kv[q2] > kvMax) kvMax = kv[q2];
    // 29.9.2026 (v100): osuus vastatuuleen pelkästä tuulikierrosta (ei läpivirtausta)
    kvN++; if ((tx*P.ita.ue[q2] + ty*P.pohjoinen.ue[q2])*tx + (tx*P.ita.un[q2] + ty*P.pohjoinen.un[q2])*ty < 0) vastaan++;
  }
  return { kue: kue, kun: kun, kv: kv, kvMax: kvMax, vastaOsuus: kvN ? vastaan/kvN : 0, kehitys: kehitys, lapiMukana: !!lapi };
}
/* v150: virtasaumat. Vastakkaisten virtojen rajalla virta hidastuu lähes nollaan, joten verrataan
   virtoja sauman molemmin puolin noin 150 m päästä (ei vierekkäisiä ruutuja): jos ne menevät yli
   120° eri suuntiin ja molemmat ≥ 0,072 km/h (2 cm/s), väliin jäävä ruutu on sauma. Vertailu
   neljään suuntaan (itä, etelä, kaakko, lounas). lahella = ruudut ≤ 100 m saumasta. */
function akSaumat(sk){
  var k = jarvi.kartta, W = k.W, H = k.H, sa = new Uint8Array(mask.length), n = 0, RAJA = 0.072;
  var rS = Math.max(1, Math.round(75/k.ruutu));   // puoliväli: vertailtavat ruudut 2·rS päässä toisistaan
  var SUUNNAT = [[1,0],[0,1],[1,1],[-1,1]];
  for (var q = 0; q < mask.length; q++){
    if (!mask[q]) continue;
    var i = q % W, j = (q/W)|0;
    for (var t = 0; t < SUUNNAT.length && !sa[q]; t++){
      var di = SUUNNAT[t][0]*rS, dj = SUUNNAT[t][1]*rS;
      var ia = i - di, ja = j - dj, ib = i + di, jb = j + dj;
      if (ia < 0 || ja < 0 || ib < 0 || jb < 0 || ia >= W || ib >= W || ja >= H || jb >= H) continue;
      var qa = ja*W + ia, qb = jb*W + ib;
      if (!mask[qa] || !mask[qb] || sk.kv[qa] < RAJA || sk.kv[qb] < RAJA) continue;
      // vastakkain = suuntaero yli 120° (cos < −0,5); 90° oli liian väljä, kova tuuli teki saumaa viidennekseen järvestä
      var ka2 = sk.kv[qa]/3.6, kb2 = sk.kv[qb]/3.6;
      if (sk.kue[qa]*sk.kue[qb] + sk.kun[qa]*sk.kun[qb] < -0.5*ka2*kb2) sa[q] = 1;
    }
  }
  var lahella = new Uint8Array(mask.length), rr = Math.max(1, Math.round(100/k.ruutu)), vn = 0, ln = 0;
  for (var q2 = 0; q2 < mask.length; q2++){
    if (!sa[q2]) continue; n++;
    var i2 = q2 % W, j2 = (q2/W)|0;
    for (var a = -rr; a <= rr; a++) for (var b = -rr; b <= rr; b++){
      var ii = i2 + a, jj = j2 + b; if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue;
      var q3 = jj*W + ii; if (mask[q3]) lahella[q3] = 1;
    }
  }
  for (var q4 = 0; q4 < mask.length; q4++){ if (!mask[q4]) continue; vn++; if (lahella[q4]) ln++; }
  return { sauma: sa, lahella: lahella, maara: n, osuus: vn ? ln/vn : 0 };
}
/* v153: tunnin vesiliikekentät omaksi funktioksi (ennen akVesiLiikePisteessa-funktion sisällä),
   jotta myös kuhan ehdokaspaikat (akKuhaEhdokkaat) saavat konvergenssin syvän reunan samasta
   välimuistista. Laskenta on ennallaan. null, jos tuuliennustetta ei ole 3 h sisällä hetkestä. */
function akVLKentat(aikaMs){
    if (!jarvi || !jarvi.kartta || !mask || !data.length || !akSyvyys) return null;
    var idx = 0, pe = Infinity;
    for (var n = 0; n < data.length; n++){ var e = Math.abs(data[n].aika.getTime() - aikaMs); if (e < pe){ pe = e; idx = n; } }
    if (pe > 3*3600e3) return null;
    var avain = jarvi.nimi + '|' + idx + '|' + data[idx].aika.getTime(), c = akVLValimuisti[avain];
    if (!c){
      var d = data[idx], virK = akPintavirtaKentta(d), vk = akVajoamaKentta(d, virK), kk = akVajoamaKentta(d, virK, true);
      var U = Math.max(0.5, d.U), tunt = d.tunteja;
      if (d.tunteja >= idx + 1 && typeof window.kumpuHistoriaTunteja === 'function') tunt += window.kumpuHistoriaTunteja(data[0].dir);
      var Lk = (typeof window.akSuunnattuMitta === 'function') ? window.akSuunnattuMitta(d.dir, jarvi.nimi) : null;
      if (!(Lk > 200)) Lk = d.Fpahin || 0;
      var ka = (typeof window.kumpuArvio === 'function') ? window.kumpuArvio(U, Lk, tunt) : null;
      var zona = (ka && ka.vahva) ? akKumpuAlue(d.dir) : null, zn = 0, wn = 0;
      for (var q2 = 0; q2 < mask.length; q2++){ if (!mask[q2]) continue; wn++; if (zona && zona[q2]) zn++; }
      var skS = null; try { var sk9 = akSyvaKentta(d); if (sk9) skS = akSaumat(sk9); } catch(e9){}   // v150
      var kfS = new Float32Array(mask.length); for (var q7 = 0; q7 < mask.length; q7++) if (mask[q7]) kfS[q7] = vk.vi[q7] - kk.vi[q7];
      var reS = akKonvReuna(kfS);   // v152
      c = akVLValimuisti[avain] = { vk: vk, kk: kk, zona: zona, zOsuus: wn ? zn/wn : 0, kumpuMitattu: !!(ka && ka.mitattu), saumat: skS, reuna: reS, kf: kfS };   // v153: kf talteen (kuhan ehdokkaat)
    }
    return c;
}
window.akVesiLiikePisteessa = function(lat, lon, aikaMs){
  return Promise.resolve(akLatausLupaus).then(function(){
    if (!jarvi || !jarvi.kartta || !mask || !data.length || !akSyvyys || lat == null) return null;
    var k = jarvi.kartta, q = akRuutuPisteelle(k, lat, lon);
    if (q < 0) return null;
    var c = akVLKentat(aikaMs);
    if (!c) return null;
    var vaj = Math.round(c.vk.vi[q]), kum = Math.round(c.kk.vi[q]), pinkki = !!(c.zona && c.zona[q]);
    var luokka = pinkki ? 'kumpu' : (vaj >= 30 && vaj >= kum) ? 'vajoama' : kum >= 30 ? 'kumpuama' : 'muu';
    return { vajoama: vaj, kumpuama: kum, kumpu: pinkki, kumpuMitattu: pinkki ? c.kumpuMitattu : null, luokka: luokka,
             osuusVajoama: +c.vk.osuus.toFixed(3), osuusKumpuama: +c.kk.osuus.toFixed(3), osuusKumpu: +c.zOsuus.toFixed(3),
             sauma: c.saumat ? !!c.saumat.lahella[q] : null, osuusSauma: c.saumat ? +c.saumat.osuus.toFixed(3) : null,
             konvReuna: c.reuna ? !!c.reuna.reuna[q] : null, osuusKonvReuna: c.reuna ? +c.reuna.osuus.toFixed(3) : null, malli: 'v152' };
  });
};
window.akVajoamaYhteenveto = function(aikaMs){
  return Promise.resolve(akLatausLupaus).then(function(){
    if (!jarvi || !jarvi.kartta || !mask || !data.length || !akSyvyys) return null;
    var idx = 0, pe = Infinity;
    for (var n = 0; n < data.length; n++){ var e = Math.abs(data[n].aika.getTime() - aikaMs); if (e < pe){ pe = e; idx = n; } }
    if (pe > 3*3600e3) return null;
    var d = data[idx], k = jarvi.kartta, virK = akPintavirtaKentta(d), vk = akVajoamaKentta(d, virK), kk = akVajoamaKentta(d, virK, true);
    var W = k.W, H = k.H, sx = 0, sy = 0, sn = 0, vx = 0, vy = 0, vn = 0, raja = 0.6*vk.viMax;
    for (var q = 0; q < mask.length; q++){
      if (!mask[q]) continue;
      var i = q % W, j = (q/W)|0; sx += i; sy += j; sn++;
      if (vk.viMax >= 15 && vk.vi[q] >= raja){ vx += i*vk.vi[q]; vy += j*vk.vi[q]; vn += vk.vi[q]; }
    }
    var sektori = null;
    if (vn > 0){
      var cx = sx/sn, cy = sy/sn, ex = vx/vn - cx, ey = vy/vn - cy, et = Math.sqrt(ex*ex + ey*ey);
      var ulottuma = Math.sqrt(sn)/2;
      if (et > 0.15*ulottuma){
        var kulma = (Math.atan2(ex, -ey)*180/Math.PI + 360) % 360;
        sektori = ['pohjois','koillis','itä','kaakkois','etelä','lounais','länsi','luoteis'][Math.round(kulma/45) % 8] + 'osassa';
      } else sektori = 'eri puolilla järveä';
    }
    /* v152: pisteet konvergenssin SYVÄLTÄ REUNALTA (Hannu 4.10.: kalat punaisen syvältä puolelta,
       ajettava ≥ 1,5 m): syvyys ≥ 1,5 m, ≥ 100 m rannasta, vahva vajoama 150 m sisällä. */
    var fP = akSileaSyvyys(), rV = Math.max(1, Math.round(100/k.ruutu)), rL = Math.max(1, Math.round(150/k.ruutu)), ehd = [], pRaja = Math.max(20, raja);
    var vahvaP = new Uint8Array(mask.length);
    for (var qv0 = 0; qv0 < mask.length; qv0++) if (mask[qv0] && vk.vi[qv0] >= pRaja) vahvaP[qv0] = 1;
    for (var q2 = 0; q2 < mask.length; q2++){
      if (!mask[q2] || !fP || fP[q2] < REUNA_SYV) continue;
      var lahV = false, i8 = q2 % W, j8 = (q2/W)|0;
      for (var a8 = -rL; a8 <= rL && !lahV; a8++) for (var b8 = -rL; b8 <= rL && !lahV; b8++){
        var ii8 = i8 + a8, jj8 = j8 + b8; if (ii8 < 0 || jj8 < 0 || ii8 >= W || jj8 >= H) continue;
        if (vahvaP[jj8*W + ii8]) lahV = true;
      }
      if (!lahV) continue;
      var i2 = q2 % W, j2 = (q2/W)|0, ok = true;
      for (var a = -rV; a <= rV && ok; a++) for (var b = -rV; b <= rV && ok; b++){
        var ii = i2 + a, jj = j2 + b;
        if (ii < 0 || jj < 0 || ii >= W || jj >= H || !mask[jj*W + ii]) ok = false;
      }
      if (ok) ehd.push(q2);
    }
    ehd.sort(function(x, y){ return vk.vi[y] - vk.vi[x]; });
    var pisteet = [];
    for (var t = 0; t < ehd.length && pisteet.length < 2; t++){
      var q3 = ehd[t], i3 = q3 % W, j3 = (q3/W)|0;
      var lat = k.pohjoisLat - (j3 + 0.5)*k.ruutu/111320, lon = k.lansiLon + (i3 + 0.5)*k.ruutu/(111320*Math.cos(lat*Math.PI/180));
      if (pisteet.some(function(p){ return Math.hypot((p.lat - lat)*111320, (p.lon - lon)*111320*Math.cos(lat*Math.PI/180)) < 1500; })) continue;
      pisteet.push({ lat: +lat.toFixed(5), lon: +lon.toFixed(5), vi: Math.round(vk.vi[q3]), syv: Math.round(fP[q3]*10)/10 });
    }
    // v149: kumpuaman vahvin osa samalla periaatteella
    var kx = 0, ky = 0, kn = 0, kRaja = 0.6*kk.viMax, ksektori = null;
    for (var q4 = 0; q4 < mask.length; q4++){
      if (!mask[q4] || kk.viMax < 15 || kk.vi[q4] < kRaja) continue;
      kx += (q4 % W)*kk.vi[q4]; ky += ((q4/W)|0)*kk.vi[q4]; kn += kk.vi[q4];
    }
    if (kn > 0){
      var cx2 = sx/sn, cy2 = sy/sn, ex2 = kx/kn - cx2, ey2 = ky/kn - cy2, et2 = Math.sqrt(ex2*ex2 + ey2*ey2);
      ksektori = et2 > 0.15*Math.sqrt(sn)/2 ? ['pohjois','koillis','itä','kaakkois','etelä','lounais','länsi','luoteis'][Math.round(((Math.atan2(ex2, -ey2)*180/Math.PI + 360) % 360)/45) % 8] + 'osassa' : 'eri puolilla järveä';
    }
    return { jarvi: jarvi.nimi, aika: d.aika, viMax: Math.round(vk.viMax), osuus: vk.osuus, sektori: sektori, pisteet: pisteet,
             kumpuamaMax: Math.round(kk.viMax), kumpuamaOsuus: kk.osuus, kumpuamaSektori: ksektori,
             tuuliMs: d.U, tuuliSuunta: d.dir, tunteja: d.tunteja, pintaSuunta: akVirtausSuunta(d.dir) };
  });
};

/* v137: ZOOM. Pitkissä ja kapeissa järvissä koko järven kuva on karkea. Zoomaus piirtää
   osaikkunan ruudukosta isommilla pikseleillä; mallit lasketaan koko järvelle kuten ennen.
   Keskipiste = valittu piste (napautus), muuten edellinen keskipiste tai järven keskusta. */
var akZoom = 1, akZoomKeski = null;
function akIkkuna(k){
  if (akZoom <= 1) return { i0: 0, j0: 0, w: k.W, h: k.H };
  var w = Math.max(8, Math.ceil(k.W/akZoom)), h = Math.max(8, Math.ceil(k.H/akZoom));
  w = Math.min(w, k.W); h = Math.min(h, k.H);
  var c = akZoomKeski || { i: k.W/2, j: k.H/2 };
  var i0 = Math.min(Math.max(0, Math.round(c.i - w/2)), k.W - w), j0 = Math.min(Math.max(0, Math.round(c.j - h/2)), k.H - h);
  return { i0: i0, j0: j0, w: w, h: h };
}
window.akZoomTila = function(){ return { zoom: akZoom, keski: akZoomKeski, valittu: akValittu, win: akViime && akViime.win, S: akViime && akViime.S }; };   // testiä varten
window.akZoomaa = function(kerroin){
  if (!jarvi || !jarvi.kartta) return;
  if (kerroin === 0) akZoom = 1;
  else akZoom = Math.min(16, Math.max(1, akZoom*kerroin));
  if (akValittu) akZoomKeski = { i: akValittu.i, j: akValittu.j };
  var b = $("akZoomTaso"); if (b) b.textContent = (akZoom <= 1 ? 1 : akZoom) + '×';
  piirra();
};

/* v136: kumpuamisalue = vesiruudut, joista tuulen yläpuolelle (tuulen tulosuuntaan) 300 m
   sisällä on rantaa. Siellä pintavesi työntyy pois rannasta ja tilalle nousee syvempää vettä.
   Piirretään vain, kun pääkoodin Wedderburn-arvio on VAHVA (kumpuArvio). */
function akKumpuAlue(dir){
  var k = jarvi.kartta, W = k.W, H = k.H, z = new Uint8Array(mask.length), n = 0;
  var a = dir*Math.PI/180, sx = Math.sin(a), sy = -Math.cos(a);
  for (var q = 0; q < mask.length; q++){
    if (!mask[q]) continue;
    var i = q % W, j = (q/W)|0;
    for (var st = 1; st <= 3; st++){
      var ii = Math.round(i + sx*st), jj = Math.round(j + sy*st);
      if (ii < 0 || jj < 0 || ii >= W || jj >= H || !mask[jj*W + ii]){ z[q] = 1; n++; break; }
    }
  }
  return n ? z : null;
}

/* Yhden tunnin uisteltava osuus. Sama laskenta kuin kartassa, mutta ilman
   piirtoa: vain osuus rajan alla. */
function akOsuus(d, kalaRaja){
  var k = jarvi.kartta, ke = akKentta(Math.round(d.dir/5)*5);
  var U = Math.max(0.5, d.U);
  var Fkesto = kestonPyyhkaisy(d.tunteja*3600, U), katto = syvyysKatto(jarvi.syvyys, U);
  var n = 0, vesi = 0;
  for (var q = 0; q < mask.length; q++){
    if (!mask[q]) continue;
    vesi++;
    if (Math.min(jonswapHs(Math.max(Math.min(ke[q], Fkesto), 50), U), katto) <= kalaRaja) n++;
  }
  return vesi ? n/vesi : 0;
}

function akPiirraJana(){
  var el = $("akJana");
  if (!el || !data.length || !mask) return;
  var raja = akKalaRaja();
  el.innerHTML = data.map(function(d, i){
    var o = akOsuus(d, raja);
    var v = o >= 0.25 ? "#3faa62" : o > 0.05 ? "#f2c200" : "#bd2430";
    /* Purskeinen tunti ei saa näyttää puhtaan vihreältä vaikka aalto olisi
       matala: puuska ei kasvata aaltoa mutta vie vavan kädestä. */
    var tyyli = akPuuskainen(d)
      ? "background:repeating-linear-gradient(45deg," + v + "," + v
        + " 3px,#10201c 3px,#10201c 5px)"
      : "background:" + v;
    return '<i data-i="' + i + '" style="' + tyyli + '"></i>';
  }).join("");
  akPiirraPaivat();
  akKorostaJana();
}
/* Päivämerkit janan alle. Sijoitetaan suhteellisesti samalle kohdalle kuin
   vastaava palkki: palkin keskikohta on (i + 0.5)/n nauhan leveydestä. */

/* Jäänyt käyttöön ohjelmallisesti: rulla korvasi napit, mutta 'nyt' on
   hyödyllinen kutsuttavaksi muualta. */
function akSiirra(mihin){
  var el = $("akLiuku");
  if(!el || !data || !data.length) return;
  var n = data.length - 1, uusi = valittu;
  if(mihin === 'alku') uusi = 0;
  else if(mihin === 'loppu') uusi = n;
  else if(mihin === 'nyt'){
    var nyt = Date.now(), ero = Infinity;
    data.forEach(function(d, i){
      var e = Math.abs(d.aika.getTime() - nyt);
      if(e < ero){ ero = e; uusi = i; }
    });
  } else uusi = Math.max(0, Math.min(n, valittu + mihin));
  valittu = uusi; el.value = uusi;
  if(typeof akKorostaJana === 'function') akKorostaJana();
  piirra();
}


/* ===== AIKARULLA ===== */
var akRullaOdottaa = false;

function akPiirraRulla(){
  var sis = $("akRullaSisus");
  if (!sis || !data.length) return;
  var korkein = 0;
  for (var i = 0; i < data.length; i++) if (data[i].U > korkein) korkein = data[i].U;
  if (korkein <= 0) korkein = 1;
  var pad = function(n){ return ("0"+n).slice(-2); };
  sis.innerHTML = data.map(function(d, i){
    /* Korkeus tuulesta, ei aallosta — ks. CSS-kommentti. Aallon oma väri
       näkyy alla janassa, joten kaksi eri suuretta ei sekoitu. */
    var h = Math.max(4, Math.round(34 * d.U / korkein));
    var vrk = (d.aika.getHours() === 0) ? " vrk" : "";
    var nyt = (i === valittu) ? " valittu" : "";
    return '<div class="ak-tunti' + vrk + nyt + '" data-i="' + i + '">'
      + '<b style="height:' + h + 'px"></b>'
      + '<span>' + (d.aika.getHours() % 6 === 0 ? pad(d.aika.getHours()) : '') + '</span></div>';
  }).join("");
}

function akKeskitaRulla(i, pehmea){
  var r = $("akRulla"), sis = $("akRullaSisus");
  if (!r || !sis || !sis.children[i]) return;
  var el = sis.children[i];
  r.scrollTo({ left: el.offsetLeft - r.clientWidth/2 + el.offsetWidth/2,
               behavior: pehmea ? "smooth" : "auto" });
}

function akValitseTunti(i){
  if (i < 0 || i >= data.length || i === valittu) return;
  valittu = i;
  var liuku = $("akLiuku");
  if (liuku) liuku.value = i;          // piilotettu liuku synkassa
  var sis = $("akRullaSisus");
  if (sis) for (var k = 0; k < sis.children.length; k++)
    sis.children[k].classList.toggle("valittu", k === valittu);
  akKorostaJana();
  piirra();
}

(function akRullaKuuntelijat(){
  var r = $("akRulla");
  if (!r) return;
  /* Vieritys valitsee keskimmäisen tunnin. requestAnimationFrame rajoittaa
     laskennan yhteen kertaan ruudunpäivitystä kohti — muuten piirra() ajettaisiin
     kymmeniä kertoja sekunnissa vierityksen aikana. */
  r.addEventListener("scroll", function(){
    if (akRullaOdottaa) return;
    akRullaOdottaa = true;
    requestAnimationFrame(function(){
      akRullaOdottaa = false;
      var sis = $("akRullaSisus");
      if (!sis || !sis.children.length) return;
      var leveys = sis.children[0].offsetWidth || 15;
      var i = Math.round((r.scrollLeft + r.clientWidth/2 - leveys/2) / leveys);
      akValitseTunti(Math.max(0, Math.min(data.length-1, i)));
    });
  }, { passive:true });

  r.addEventListener("click", function(e){
    var el = e.target.closest ? e.target.closest(".ak-tunti") : null;
    if (el){ var i = +el.getAttribute("data-i"); akValitseTunti(i); akKeskitaRulla(i, true); }
  });
})();

function akPiirraPaivat(){
  var el = $("akPaivat");
  if (!el || !data.length) return;
  var pv = ["su","ma","ti","ke","to","pe","la"], n = data.length, ulos = "";
  for (var i = 0; i < n; i++){
    if (data[i].aika.getHours() !== 7) continue;
    var x = (i + 0.5)/n*100;
    /* Reunoilla nimi valuisi ulos, joten se vedetään sisään. */
    var siirto = x < 6 ? "translateX(-10%)" : x > 94 ? "translateX(-90%)" : null;
    ulos += '<span style="left:' + x.toFixed(2) + '%'
          + (siirto ? ';transform:' + siirto : '') + '">'
          + pv[data[i].aika.getDay()] + ' 7</span>';
  }
  el.innerHTML = ulos;
}

/* SUUNNATTU JÄRVENMITTA MUILLE OSILLE — 15.9.2026.
   Kumpuamisanalyysi käytti pyyhkäisymatkana pinta-alan ympyräekvivalenttia, ja
   sen oma kommentti sanoo miksi se on huono: se on keskiarvo eikä suunnattu
   matka. Sama korjaus kuin aallonkorkeudessa. Maski on jo purettu tässä
   moduulissa, joten tarjotaan pisin yhtenäinen vesimatka tuulen suunnassa.
   Julkaistaan globaaliin, koska kumpuamisanalyysi on toisessa lohkossa.
   Palauttaa metrejä, tai null jos karttaa ei ole avattu tai järvi on eri. */
/* JÄRVEN KESKIPISTE MASKISTA — 18.9.2026.
   Kumpuamisen tulkinta tarvitsee suuntiman järven keskeltä mittausasemalle.
   Aiemmin vertailupisteenä oli currentLocation, joka on kotiranta tai
   kalastusalue — Lappajärvellä noin 6 km järven todellisesta keskipisteestä
   lounaaseen. Siitä laskettu suuntima olisi ollut systemaattisesti vinossa.
   Vesiruutujen painopiste maskista on oikea keskipiste, ja se on jo laskettu
   tässä moduulissa muuta varten. */
window.akJarvenKeskipiste = function(){
  try {
    if (!mask || !jarvi || !jarvi.kartta) return null;
    /* Varmistus: jos kartalla on eri järvi kuin sovelluksessa, keskipistettä
       ei anneta lainkaan. Väärä keskipiste on pahempi kuin ei keskipistettä,
       koska se näyttää oikealta. */
    if (typeof currentLocation === 'object' && currentLocation && currentLocation.name
        && jarvi.nimi && currentLocation.name.slice(0,6) !== jarvi.nimi.slice(0,6)) return null;
    const k = jarvi.kartta;
    let si = 0, sj = 0, n = 0;
    for (let j = 0; j < k.H; j++) for (let i = 0; i < k.W; i++) {
      if (mask[j*k.W + i]) { si += i; sj += j; n++; }
    }
    if (!n) return null;
    const ic = si/n, jc = sj/n;
    /* Ruutu on k.ruutu metriä. Pohjoiskoordinaatti pienenee etelään päin,
       itäkoordinaatti kasvaa itään. */
    const lat = k.pohjoisLat - (jc * k.ruutu) / 111320;
    const lon = k.lansiLon + (ic * k.ruutu) / (111320 * Math.cos(lat * Math.PI/180));
    return { lat: lat, lon: lon, nimi: jarvi.nimi };
  } catch (e) { return null; }
};

window.akSuunnattuMitta = function(dir, jarvenNimi){
  try {
    if (!mask || !jarvi || !jarvi.kartta) return null;
    if (jarvenNimi && jarvi.nimi && jarvi.nimi.indexOf(jarvenNimi.split(" ")[0]) < 0) return null;
    var ke = akKentta(Math.round(dir/5)*5 % 360), pisin = 0;
    for (var q = 0; q < ke.length; q++) if (mask[q] && ke[q] > pisin) pisin = ke[q];
    return pisin > 0 ? pisin : null;
  } catch (e) { return null; }
};

/* ===== HAVAINTOKORJAUS — 15.9.2026 =====
   Malli antoi Hirvijärvelle 4 m/s samaan aikaan kun 13 km päässä Rengonharjun
   asema mittasi 5,8. Aallonkorkeus kasvaa suunnilleen tuulen neliössä, joten
   kolmanneksen virhe tuulessa on kaksinkertainen virhe aallossa — tämä on niitä
   harvoja syötteitä joissa yksi luku kaataa koko vastauksen.

   MIKSI EI KORVATA VAAN KORJATAAN: asema on maalla, eri paikassa ja eri
   rosoisuudella kuin järven pinta. Suora korvaus vaihtaisi tunnetun virheen
   tuntemattomaan. Sen sijaan otetaan ERO havainnon ja saman tunnin ennusteen
   välillä ja siirretään sillä lähitunteja.

   MIKSI VAIMENEE: poikkeama kertoo tästä hetkestä, ei huomisesta. Täysi korjaus
   nyt, puolet kolmen tunnin päästä, nolla kuuden jälkeen. Kaukaiset tunnit
   jäävät ennusteen varaan koska mitään parempaa niistä ei ole.

   Uenn säilyttää alkuperäisen ennusteen, jotta korjaus voidaan laskea uudelleen
   eikä se kasaudu itsensä päälle. */
var AK_KORJAUS_H = 6;
var akKorjaus = null;

function akHavaintokorjaus(){
  akKorjaus = null;
  if (!data.length) return;
  var h = (typeof window.akHavaittuTuuli === "function") ? window.akHavaittuTuuli() : null;
  if (!h || h.ws == null || !h.aika) return;

  /* Sama tunti ennusteesta kuin havainto. Jos havainto on yli kaksi tuntia
     vanha, sitä ei käytetä: keli on voinut vaihtua. */
  var hetki = h.aika.getTime(), paras = null, pieninEro = Infinity;
  for (var i = 0; i < data.length; i++){
    var ero = Math.abs(data[i].aika.getTime() - hetki);
    if (ero < pieninEro){ pieninEro = ero; paras = i; }
  }
  if (paras === null || pieninEro > 2*3600*1000) return;

  var erotus = h.ws - data[paras].Uenn;
  akKorjaus = { erotus: erotus, asema: h.asema, havaittu: h.ws,
                ennustettu: data[paras].Uenn, puuska: h.wg, i: paras };

  for (var j = 0; j < data.length; j++){
    var tunteja = Math.abs(data[j].aika.getTime() - hetki)/3600000;
    var paino = Math.max(0, 1 - tunteja/AK_KORJAUS_H);
    data[j].U = Math.max(0.3, data[j].Uenn + erotus*paino);
  }
  viimeSuunta = null;   // aalto lasketaan uusilla tuulilla
}

/* PUUSKAISUUS. Ehto oli aiemmin pelkkä erotus (puuska yli 5 m/s keskituulta
   kovempi). Hannun havainto 5,8 / 9,6 paljasti sen vian: erotus on 3,8 eikä
   laukea, mutta suhde on 1,66 — poikkeuksellisen purskeinen keli. Erotus toimii
   kovilla tuulilla, suhde matalilla. Molemmat tarvitaan. */
/* PUUSKASUHTEEN RAJA — korjattu 18.9.2026 lähteen perusteella.
   Raja oli 1,5. Ilmatieteen laitoksen mukaan puuska on maa-alueilla
   tyypillisesti noin 1,7-kertainen ja merialueilla noin 1,3-kertainen
   kymmenen minuutin keskituuleen verrattuna. Raja 1,5 oli siis ALLE
   normaalin maa-arvon, jolloin lähes jokainen tunti olisi merkitty
   purskeiseksi — varoitus joka palaa aina on sama kuin ei varoitusta.

   Nyt raja on 1,8: selvästi yli tavanomaisen. Järven pinta on sileämpi kuin
   maasto, joten järvellä todellinen suhde on lähempänä merialueen 1,3:a —
   mutta ennuste ja lähin asema ovat maa-alueelta, joten vertailukohdaksi
   kuuluu maa-arvo.
   Erotusehto 5 m/s pysyy: kovilla tuulilla suhde on huono mittari, koska
   1,8-kertainen 12 m/s on jo 22 m/s eikä sitä tarvitse suhteuttaa. */
function akPuuskainen(d){
  if (!d || d.puuska == null || isNaN(d.puuska) || !d.U) return false;
  return (d.puuska - d.U) >= 5 || (d.puuska / Math.max(d.U, 0.5)) >= 1.8;
}

function akKorostaJana(){
  var el = $("akJana");
  if (!el) return;
  for (var i = 0; i < el.children.length; i++){
    el.children[i].className = (i === valittu) ? "nyt" : "";
  }
}

function akPiirraMerkki(ctx, S){
  if (!akValittu || !akViime) return;
  var k = akViime.k;
  if (akValittu.i >= k.W || akValittu.j >= k.H) return;
  var w0 = akViime.win || { i0: 0, j0: 0, w: k.W, h: k.H };
  if (akValittu.i < w0.i0 || akValittu.j < w0.j0 || akValittu.i >= w0.i0 + w0.w || akValittu.j >= w0.j0 + w0.h) return;
  var x = (akValittu.i - w0.i0 + 0.5)*S, y = (akValittu.j - w0.j0 + 0.5)*S, r = Math.max(5, Math.min(S*1.6, 14));
  ctx.strokeStyle = "rgba(20,28,26,.85)"; ctx.lineWidth = Math.max(1.6, S*0.35);
  ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,.95)"; ctx.lineWidth = Math.max(1, S*0.2);
  ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.stroke();
}

function akNaytaPiste(){   // v153: kuhamerkin tieto napautetun pisteen tietojen perään
  akNaytaPisteSisalto();
  var el = $("akPiste"), lisa = akKuhaPisteTieto() + akTaimenPisteTieto() + akKlooniPisteTieto();   // v156: myös taimenmerkki; v177: kloonit
  if (el && lisa) el.innerHTML += lisa;
}
function akNaytaPisteSisalto(){
  var el = $("akPiste");
  if (!el) return;
  if (!akValittu || !akViime){
    el.textContent = akTila === 'aalto' ? "Napauta karttaa: kertoo sen kohdan aallon"
                                        : akTila === 'vajoama' ? "Napauta karttaa: kertoo sen kohdan vajoamaindeksin"
                                         : akTila === 'kumpuama' ? "Napauta karttaa: kertoo sen kohdan kumpuamaindeksin"
                                         : akTila === 'konvergenssi' ? "Napauta karttaa: kertoo kasautumisen ja virtasaumat"
                                         : akTila === 'syvyys' ? "Napauta karttaa: kertoo syvyyden"
                                         : akTila === 'murtuva' ? "Napauta karttaa: kertoo, murtuuko aalto ja miksi"
                                         : "Napauta karttaa: kertoo sen kohdan virtauksen"; return;
  }
  var k = akViime.k, q = akValittu.j*k.W + akValittu.i;
  if (!mask[q]){ el.textContent = "Maata — napauta vesialuetta"; return; }
  if (akTila === 'syva' && akViime.kv){
    var ve = akViime.kue[q], vn = akViime.kun[q], kk2 = akViime.kv[q];
    var suunta = (Math.atan2(ve, vn)*180/Math.PI + 360) % 360;
    var ta2 = (akViime.dir + 180)*Math.PI/180;
    var myota = ve*Math.sin(ta2) + vn*Math.cos(ta2) >= 0;
    var sy2 = akKiertoData ? akKiertoData.h[q] : null;
    el.innerHTML = "Syvemmässä vedessä noin <b>" + kk2.toFixed(2).replace(".", ",")
      + " km/h</b> " + akKohti(suunta) + " · <b>" + (myota ? "tuulen mukana" : "vastatuuleen") + "</b>"
      + "<br>vesipatsaan keskiarvo" + (sy2 !== null ? ", syvyys noin " + Math.round(sy2) + " m" : "")
      + " · pinta kulkee silti tuulen mukana";
    return;
  }
  if (akTila === 'murtuva' && akViime.murt){   // v167
    var M = akViime.murt, lk = M.luokka[q], hq = M.hs[q], f2 = function(x, n){ return x.toFixed(n === undefined ? 2 : n).replace(".", ","); };
    var sy7 = akSyvyys ? akSyvyys[q] : null, ga7 = akGamma(q);
    var syyt = [];
    if (M.B[q] >= 0.6) syyt.push("syvyys: tuleva aalto on " + Math.round(M.B[q]*100) + " % murtumisrajasta (Hs ≤ " + f2(ga7) + " × syvyys" + (ga7 < 0.6 ? ", tasainen pohja" : ga7 > 0.7 ? ", rinne" : "") + ")");
    if (M.S[q] >= 0.6 && (lk > 0 || M.est[q])) syyt.push(M.est[q] ? "vastavirta pysäyttää aallon" : "jyrkkyys: huippuaalto on " + Math.round(M.S[q]*100) + " % jyrkkyysrajasta");
    if (M.xi[q] >= 0.5 && lk >= 2) syyt.push("penkka nousee aallon edessä (ξ = " + f2(M.xi[q], 1) + ")" + (M.xi[q] <= 3.3 ? ": syöksyvä murtuminen, aalto nousee seinäksi" : ""));
    if (M.vasta[q] >= 0.03) syyt.push("vastavirta " + f2(M.vasta[q]) + " m/s");
    el.innerHTML = "Tässä: <b>" + AK_MURT_NIMET[lk] + "</b> · Hs " + f2(hq) + " m, huiput noin " + f2(hq*AK_HMAX) + " m"
      + (sy7 !== null ? " · syvyys noin " + f2(sy7, 1) + " m" : "")
      + (syyt.length ? "<br>" + syyt.join(" · ") : (lk === 0 && hq*AK_HMAX < M.kynnys ? "<br>aallot alle " + f2(M.kynnys) + " m, ei väriä" : ""))
      + "<br>malli, ei mittaus" + (M.kierto || M.lapi ? "" : " · vastavirta ei mukana (kiertoa ei laskettu)");
    return;
  }
  if (akTila === 'syvyys' && akViime.syvK){
    var omaQ = null; try { var ro2 = omaLuotausSolut(jarvi.kartta); omaQ = ro2 && ro2.solut ? ro2.solut[q] : null; } catch (e) {}   // v176
    el.innerHTML = "Syvyys tässä noin <b>" + akViime.syvK[q].toFixed(1).replace(".", ",") + " m</b> · "
      + (omaQ !== null && omaQ !== undefined ? "oma luotaus, ruudun (" + jarvi.kartta.ruutu + " m) mediaani, ei tasoitettu" : akSyvyysLahde() + " · pehmennetty ±75 m") + ", ei navigointiin";
    return;
  }
  if (akTila === 'konvergenssi' && akViime.kf){
    var kq = Math.round(akViime.kf[q]), lahS = akViime.saumat && akViime.saumat.lahella[q];
    el.innerHTML = (kq >= 4 ? "Vesi kasautuu ja painuu: <b>+" + kq + "</b>" : kq <= -4 ? "Vesi erkanee ja nousee: <b>" + kq + "</b>" : "Ei selvää kasautumista: <b>" + kq + "</b>")
      + (lahS ? "<br><b>Virtasauma alle 100 m päässä</b> (syvemmän veden virrat vastakkain, ≥ 2 cm/s)" : "")
      + (akViime.reuna && akViime.reuna.reuna[q] ? "<br><b>Konvergenssin syvä reuna</b> (≥ 1,5 m, vahva kasautuminen 150 m sisällä)" : "")
      + " · malli, ei mittaus";
    return;
  }
  if ((akTila === 'vajoama' || akTila === 'kumpuama') && akViime.vi){
    var v9 = akViime.vi[q], sy9 = akSyvyys ? akSyvyys[q] : null;
    el.innerHTML = (akTila === 'kumpuama' ? "Kumpuamaindeksi" : "Vajoamaindeksi") + " tässä <b>" + Math.round(v9) + " / 100</b>"
      + (v9 >= 50 ? " · vahva" : v9 >= 20 ? " · kohtalainen" : " · heikko")
      + "<br>pintavirta " + (akViime.vir[q]).toFixed(2).replace(".", ",") + " km/h " + akKohti(akVirtausSuunta(akViime.dir))
      + (sy9 !== null ? " · syvyys noin " + Math.round(sy9) + " m" : "") + " · malli, ei mittaus";
    return;
  }
  if (akTila === 'virtaus' && akViime.vir){
    var vv = akViime.vir[q], sy = akSyvyys ? akSyvyys[q] : null;
    el.innerHTML = "Tässä kohdassa pintavirtaus noin <b>" + vv.toFixed(2).replace(".", ",")
      + " km/h</b> " + akKohti(akVirtausSuunta(akViime.dir))
      + "<br>arvio tuulesta" + (sy !== null && sy < 5 ? " · matalikko nopeuttaa" : "");
    return;
  }
  var h = akViime.hs[q], F = akViime.kentta[q];
  var tila = h <= akViime.kalaRaja ? "uisteltavissa"
           : h <= akViime.turva ? "vain kuljettavissa" : "yli turvarajan";
  el.innerHTML = "Tässä kohdassa <b>" + h.toFixed(2).replace(".", ",") + " m</b> · " + tila
    + "<br>avointa vettä tuulen suuntaan "
    + (F >= 1000 ? (F/1000).toFixed(1).replace(".", ",") + " km" : Math.round(F) + " m")
    + " · huiput noin " + (h*1.86).toFixed(2).replace(".", ",") + " m"
    + (akSyvyys && akSyvyys[q] > 0 && h >= 0.98*akGamma(q)*Math.max(0.2, akSyvyys[q]) ? "<br>syvyys rajaa aallon tässä: aallot murtuvat (katso Murtuva aallokko)" : "");   // v167
}

function akSyvyysLahde(){   // v145: syvyyslähde järven mukaan (ennen DataDeck kaikille)
  if (jarvi === JARVET.hirvijarvi) return 'oma luotauskartta (omat lokit)';
  if (jarvi === JARVET.lappajarvi) return jarvi.kartta.ruutu === 50 ? '© MML, 50 m ruudut' : 'DataDeck-kartta · © MML · © Väylävirasto · © SYKE';
  if (jarvi === JARVET.toisvesi || jarvi === JARVET.saimaa_imatra) return 'karttakuvat, rantaviiva © MML';
  return '© Maanmittauslaitos, maastotietokanta';
}
function naytaTiedot(d){
  var pad = function(n){ return ("0"+n).slice(-2); };
  var pv = ["su","ma","ti","ke","to","pe","la"];

  /* OSUUS LEIMAAN — 15.9.2026. Prosentti oli vain taulukossa, jonne pitää
     vierittää. Se on kuitenkin se luku joka vastaa kysymykseen lähdenkö,
     joten se kuuluu kartan päälle. Korkein järvellä jää alle pienempänä. */
  var pros = Math.round((d.osuus || 0)*100);
  var vari = pros >= 25 ? '#1c7a42' : pros > 0 ? '#9a7b00' : '#9b1f28';
  $("akLeima").innerHTML = '<span style="color:' + vari + '">' + pros + ' %</span>'
    + '<small>uisteltavissa</small>'
    + '<span class="aika">' + pv[d.aika.getDay()] + ' klo ' + pad(d.aika.getHours()) + '</span>'
    + '<small>huippu ' + d.korkein.toFixed(2).replace('.', ',') + ' m</small>';
  /* Nopeus isolla, suunta omalle riville: "8 m/s" ja alle "lounaasta".
     Yhtenä rivinä se katkesi kapealla ruudulla kesken sanan. */
  /* 22.9.2026: korjausrivi lyhyeksi ("korj. −1,9 m/s"). Pitkä "korjattu
     havainnolla" levensi laatikon järven päälle; selitys on taulukossa. */
  $("akTuuli").innerHTML = d.U.toFixed(0) + " m/s"
    + (d.puuska != null ? '<small>puuskat ' + d.puuska.toFixed(0) + ' m/s</small>' : "")
    + "<small>" + kompassi(d.dir) + "</small>"
    + (akKorjaus && Math.abs(akKorjaus.erotus) >= 0.5
        ? '<small style="color:#7a4d00">korj. '
          + (akKorjaus.erotus > 0 ? "+" : "") + akKorjaus.erotus.toFixed(1).replace('.', ',') + " m/s</small>"
        : "");

  var pros = Math.round((d.osuus || 0)*100);
  var vari = pros >= 25 ? '#3faa62' : pros > 0 ? '#f2c200' : '#bd2430';
  $("akTaulu").innerHTML =
      '<div><span>Kalastusraja</span><b>' + akKalaRaja().toFixed(2) + ' m · '
        + akVene().nimi.split(' · ')[0] + '</b></div>'
    + (akKorjaus && Math.abs(akKorjaus.erotus) >= 0.5
        ? '<div><span>Havaintokorjaus</span><b>' + akKorjaus.havaittu.toFixed(1)
          + ' mitattu vs ' + akKorjaus.ennustettu.toFixed(1) + ' ennuste · '
          + akKorjaus.asema + '</b></div>' : '')
    + '<div><span>Korkein järvellä</span><b>' + d.korkein.toFixed(2) + ' m</b></div>'
    + '<div><span>Suurin yksittäinen</span><b>' + (1.86*d.korkein).toFixed(2) + ' m</b></div>'
    + '<div><span>Jakso</span><b>' + d.Tp.toFixed(1) + ' s</b></div>'
    + '<div><span>Tuuli</span><b>' + d.U.toFixed(1) + ' m/s, '
        + Math.round(d.dir) + '°</b></div>'
    + '<div><span>Tuullut</span><b>' + d.tunteja + ' h samasta suunnasta</b></div>';

  /* VIRTAUSTILA: leimaan virtauksen huippu ja suunta, taulukon alkuun sama.
     Aallon rivit jäävät alle, koska aalto on yhä se mikä ratkaisee lähdön. */
  if (akTila === 'syva' && typeof d.kvMax === 'number'){
    var vpros = Math.round((d.vastaOsuus || 0)*100);
    $("akLeima").innerHTML = '<span style="color:#17457d">' + vpros + ' %</span>'
      + '<small>vastatuuleen' + (d.lapiMukana ? ' (tuulikierto)' : '') + '</small>'
      + (d.lapiMukana && akLapiValimuisti ? '<small>läpivirtaus mukana · voimala ' + (akLapiValimuisti.Q.otto > 0 ? akLapiValimuisti.Q.otto.toFixed(1).replace('.', ',') + ' m³/s' : 'seis') + '</small>' : '')
      + '<span class="aika">' + pv[d.aika.getDay()] + ' klo ' + pad(d.aika.getHours()) + '</span>'
      + '<small>huippu ' + d.kvMax.toFixed(2).replace('.', ',') + ' km/h</small>';
    $("akTaulu").innerHTML =
        '<div><span>Syvempi vesi, huippu</span><b>' + d.kvMax.toFixed(2) + ' km/h</b></div>'
      + '<div><span>Järvestä vastatuuleen</span><b>' + vpros + ' % · lähinnä syvänteet</b></div>'
      + (d.lapiMukana && akLapiValimuisti ? '<div><span>Läpivirtaus (nyt)</span><b>voimala ' + (akLapiValimuisti.Q.otto || 0).toFixed(1).replace('.', ',') + ' m³/s'
          + (akLapiValimuisti.Q.kanava != null ? ' · tulo ' + ((akLapiValimuisti.Q.kanava || 0) + (akLapiValimuisti.Q.tausneva || 0) + (akLapiValimuisti.Q.varpula || 0)).toFixed(1).replace('.', ',') + ' m³/s' : ' · tuloa ei saatu') + '</b></div>' : '')
      + '<div><span>Kierron kehitys</span><b>' + Math.round((d.kehitys || 0)*100) + ' % pysyvästä · tuullut ' + d.tunteja + ' h</b></div>'
      + '<div><span>Laskenta</span><b>kiertomalli, ei mittaus · nopeus ±2–3×</b></div>'
      + '<div><span>Syvyydet</span><b>' + akSyvyysLahde() + '</b></div>'
      + $("akTaulu").innerHTML;
  }
  if (akTila === 'syvyys' && akSyvyys){
    var fS = akSileaSyvyys(), mx = 0, sm = 0, nS = 0;
    for (var qS = 0; qS < mask.length; qS++){ if (!mask[qS]) continue; nS++; sm += fS[qS]; if (fS[qS] > mx) mx = fS[qS]; }
    $("akLeima").innerHTML = '<span style="color:#0b2f55">' + Math.round(mx) + ' m</span><small>syvin (pehmennetty)</small>';
    $("akTaulu").innerHTML =
        '<div><span>Keskisyvyys</span><b>' + (nS ? (sm/nS).toFixed(1).replace('.', ',') : '–') + ' m</b></div>'
      + '<div><span>Syvin ruutu (pehmennetty ±75 m)</span><b>' + mx.toFixed(1).replace('.', ',') + ' m</b></div>'
      + '<div><span>Käyrät</span><b>pääkäyrät 3 / 10 / 20 / 30 m, zoomattuna kaikki; luvut zoomattuna</b></div>'
      + '<div><span>Syvyydet</span><b>' + akSyvyysLahde() + '</b></div>'
      + '<div><span>Käyttö</span><b>suunnitteluun ja Ozi-tausta­kartaksi, ei navigointikartta</b></div>';
    return;
  }
  if (akTila === 'konvergenssi' && typeof d.konvMax === 'number'){
    $("akLeima").innerHTML = '<span style="color:#b3302a">+' + Math.round(d.konvMax) + '</span>'
      + '<small>kasautuu · erkanee ' + Math.round(d.konvMin) + '</small>'
      + '<span class="aika">' + pv[d.aika.getDay()] + ' klo ' + pad(d.aika.getHours()) + '</span>'
      + '<small>' + (d.saumoja !== null ? d.saumoja + ' saumaruutua' : 'saumat: ei kiertoa') + '</small>';
    $("akTaulu").innerHTML =
        '<div><span>Kasautuu (konvergenssi), huippu</span><b>+' + Math.round(d.konvMax) + '</b></div>'
      + '<div><span>Erkanee (divergenssi), huippu</span><b>' + Math.round(d.konvMin) + '</b></div>'
      + '<div><span>Virtasaumat</span><b>' + (d.saumoja !== null ? d.saumoja + ' ruutua, ' + Math.round((d.saumaOsuus || 0)*100) + ' % järvestä alle 100 m päässä' : 'syvyysmalli puuttuu') + '</b></div>'
      + '<div><span>Sauman ehto</span><b>virrat vastakkain (yli 120°), molemmat ≥ 2 cm/s</b></div>'
      + '<div><span>Syvä reuna (ruskea)</span><b>' + (typeof d.reunaOsuus === 'number' ? Math.round(d.reunaOsuus*100) + ' % järvestä · ≥ 1,5 m, vahva kasautuminen 150 m sisällä' : '–') + '</b></div>'
      + '<div><span>Vaahtojuovat</span><b>liian pieniä kartalle: etsi silmällä</b></div>'
      + '<div><span>Syvyydet</span><b>' + akSyvyysLahde() + '</b></div>'
      + $("akTaulu").innerHTML;
  }
  if ((akTila === 'vajoama' || akTila === 'kumpuama') && typeof d.viMax === 'number'){
    var vs9 = akVirtausSuunta(d.dir), kum9 = akTila === 'kumpuama';
    $("akLeima").innerHTML = '<span style="color:#17457d">' + Math.round(d.viMax) + '</span>'
      + '<small>' + (kum9 ? 'kumpuama' : 'vajoama') + ' huippu</small>'
      + '<span class="aika">' + pv[d.aika.getDay()] + ' klo ' + pad(d.aika.getHours()) + '</span>'
      + '<small>pinta ' + akKohti(vs9) + '</small>';
    $("akTaulu").innerHTML =
        '<div><span>' + (kum9 ? 'Kumpuamaindeksi' : 'Vajoamaindeksi') + ', huippu</span><b>' + Math.round(d.viMax) + ' / 100</b></div>'
      + '<div><span>Järvestä vähintään 30</span><b>' + Math.round((d.viOsuus || 0)*100) + ' %</b></div>'
      + '<div><span>Peruste</span><b>' + (kum9 ? 'pintavesi pois rannalta tai syvenevän pohjan yli' : 'pintavirta kohti nousevaa pohjaa tai rantaa') + '</b></div>'
      + (kum9 ? '<div><span>Pinkki alue</span><b>vain kun kerrostuneisuus ja tuuli riittävät (Wedderburn)</b></div>' : '')
      + '<div><span>Laskenta</span><b>malli-indeksi, ei mitattu · tuullut ' + d.tunteja + ' h</b></div>'
      + '<div><span>Syvyydet</span><b>' + akSyvyysLahde() + '</b></div>'
      + $("akTaulu").innerHTML;
  }
  if (akTila === 'virtaus' && typeof d.virMax === 'number'){
    var vs = akVirtausSuunta(d.dir);
    $("akLeima").innerHTML = '<span style="color:#17457d">' + d.virMax.toFixed(2).replace('.', ',') + '</span>'
      + '<small>km/h huippu</small>'
      + '<span class="aika">' + pv[d.aika.getDay()] + ' klo ' + pad(d.aika.getHours()) + '</span>'
      + '<small>' + akKohti(vs) + '</small>';
    $("akTaulu").innerHTML =
        '<div><span>Pintavirtaus, huippu</span><b>' + d.virMax.toFixed(2) + ' km/h</b></div>'
      + '<div><span>Suunta</span><b>' + akKohti(vs) + ' (' + Math.round(vs) + '°)</b></div>'
      + '<div><span>Laskenta</span><b>arvio tuulesta, ei mittaus</b></div>'
      + '<div><span>Syvyydet</span><b>' + akSyvyysLahde() + '</b></div>'
      + $("akTaulu").innerHTML;
  }
}

$("akLiuku").addEventListener("input", function(){
  valittu = +this.value;
  akKorostaJana();
  piirra();
});

/* Jana on yleiskuva: napautus siitä siirtää myös rullan oikeaan kohtaan. */
$("akJana").addEventListener("click", function(e){
  var i = e.target && e.target.getAttribute && e.target.getAttribute("data-i");
  if (i === null || i === undefined) return;
  akValitseTunti(+i);
  akKeskitaRulla(+i, true);
});

/* Napautus. Canvasin näyttökoko ja sisäinen ruudukko ovat eri asia, joten
   muunnos tehdään getBoundingClientRectin kautta eikä pikseleistä. */
(function(){
  var c = $("akKuva");
  function osu(x, y){
    if (!akViime) return;
    var r = c.getBoundingClientRect(), k = akViime.k, w0 = akViime.win || { i0: 0, j0: 0, w: k.W, h: k.H };
    var i = Math.floor((x - r.left)/r.width*w0.w) + w0.i0;
    var j = Math.floor((y - r.top)/r.height*w0.h) + w0.j0;
    if (i < 0 || i >= k.W || j < 0 || j >= k.H) return;
    akValittu = { i:i, j:j };
    piirra();
  }
  c.addEventListener("click", function(e){ osu(e.clientX, e.clientY); });
  c.addEventListener("touchstart", function(e){
    if (!e.touches.length) return;
    e.preventDefault(); osu(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive:false });
})();

// ---- FMI ---------------------------------------------------------------
function fmiUrl(lat, lon){
  var a = new Date(); a.setUTCMinutes(0,0,0);
  var z = new Date(a.getTime() + 84*3600*1000);
  return "https://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=getFeature"
    + "&storedquery_id=fmi::forecast::edited::weather::scandinavia::point::timevaluepair"
    + "&latlon=" + lat + "," + lon
    + "&parameters=WindSpeedMS,WindDirection,WindGust&timestep=60"
    + "&starttime=" + a.toISOString().slice(0,19) + "Z"
    + "&endtime="   + z.toISOString().slice(0,19) + "Z";
}

function parsi(txt){
  var doc = new DOMParser().parseFromString(txt, "text/xml");
  if (doc.querySelector("parsererror")) throw new Error("vastausta ei voitu lukea");
  var kaikki = doc.getElementsByTagName("*"), ulos = {};
  for (var i = 0; i < kaikki.length; i++){
    if (kaikki[i].localName !== "MeasurementTimeseries") continue;
    var id = kaikki[i].getAttribute("gml:id") || kaikki[i].getAttribute("id") || "";
    var nimi = id.toLowerCase().split("-").pop(), sarja = [];
    var tvp = kaikki[i].getElementsByTagName("*");
    for (var j = 0; j < tvp.length; j++){
      if (tvp[j].localName !== "MeasurementTVP") continue;
      var aika = null, arvo = null, c = tvp[j].children;
      for (var q = 0; q < c.length; q++){
        if (c[q].localName === "time")  aika = c[q].textContent.trim();
        if (c[q].localName === "value") arvo = parseFloat(c[q].textContent);
      }
      sarja.push({aika:new Date(aika), arvo:isNaN(arvo) ? null : arvo});
    }
    ulos[nimi] = sarja;
  }
  return ulos;
}

/* SAALIIN KOHDAN MALLIARVOT — lisätty 22.9.2026. Saaliskirjaus kysyy tältä
   aallonkorkeuden, pintavirtauksen ja syvemmän veden kierron saaliin
   koordinaateissa, lähimmältä ennustetunnilta. Kaavat ovat täsmälleen samat
   kuin kartan piirrossa — erillinen laskenta olisi kaksi mallia samasta asiasta.
   Palauttaa null, jos piste ei ole ladatun järven ruudukossa tai lähin
   ennustetunti on yli 3 h päässä. */
function akRuutuPisteelle(k, lat, lon){
  var i = Math.floor((lon - k.lansiLon)*111320*Math.cos(lat*Math.PI/180)/k.ruutu);
  var j = Math.floor((k.pohjoisLat - lat)*111320/k.ruutu);
  var paras = -1, pd = 1e9;
  // lähin vesiruutu enintään 4 ruudun (400 m) päästä: GPS, rantaviiva ja
  // rantaan merkityt paikat (esim. Karvala on 225 m ruudukon reunan ulkopuolella)
  for (var dj = -4; dj <= 4; dj++) for (var di = -4; di <= 4; di++){
    var ii = i+di, jj = j+dj;
    if (ii < 0 || jj < 0 || ii >= k.W || jj >= k.H) continue;
    var q = jj*k.W + ii;
    if (!mask[q]) continue;
    if (di*di + dj*dj < pd){ pd = di*di + dj*dj; paras = q; }
  }
  return paras;
}
function akMalliLaske(lat, lon, aikaMs){
  if (!jarvi || !jarvi.kartta || !mask || !data.length || lat == null || lon == null) return null;
  var k = jarvi.kartta, q = akRuutuPisteelle(k, lat, lon);
  if (q < 0) return null;
  var idx = 0, pe = Infinity;
  for (var n = 0; n < data.length; n++){
    var e = Math.abs(data[n].aika.getTime() - aikaMs);
    if (e < pe){ pe = e; idx = n; }
  }
  if (pe > 3*3600e3) return null;
  var d = data[idx], U = Math.max(0.5, d.U);
  var ke = akKentta(Math.round(d.dir/5)*5);
  var Fq = Math.min(ke[q], kestonPyyhkaisy(d.tunteja*3600, U));
  var t = { jarvi: jarvi.nimi, raja: akKalaRaja(),
            // tuuli jolla malliarvot laskettiin (FMI:n editoitu ennuste, havaintokorjattu):
            // saalisrivin tuuliMs tulee Open-Meteosta, joten tämä tallennetaan erikseen
            tuuliMs: d.U, tuuliSuunta: d.dir,
            aaltoM: akAaltoRuutu(q, Fq, U, syvyysKatto(jarvi.syvyys, U)).hs };   // v167: paikallinen syvyysraja
  if (akSyvyys){
    var syvK = 1 + (5 - Math.min(akSyvyys[q], 5))*0.15, pyyK = 0.4 + 0.6*Math.min(1, Fq/3000);
    t.pintaKmh = U*2*syvK*pyyK*0.036;
    t.pintaSuunta = akVirtausSuunta(d.dir);
    var kd = akKierto();
    if (kd){
      var ta = (d.dir + 180)*Math.PI/180, tx = Math.sin(ta), ty = Math.cos(ta);
      var ker = AK_ILMA*AK_CD*U*U/AK_VESI*(1 - Math.exp(-d.tunteja*3600*AK_KITKA_R/kd.hKesk));
      var P = kd.pohjat;
      var ue = (tx*P.ita.ue[q] + ty*P.pohjoinen.ue[q])*ker, un = (tx*P.ita.un[q] + ty*P.pohjoinen.un[q])*ker;
      t.syvaKmh = Math.sqrt(ue*ue + un*un)*3.6;
      t.syvaSuunta = (Math.atan2(ue, un)*180/Math.PI + 360) % 360;
      t.syvaTuuleen = (ue*tx + un*ty) >= 0 ? 'mukana' : 'vastaan';
      // 29.9.2026 (v98): Hirvijärven läpivirtaus erikseen; syvaKmh pysyy pelkkänä tuulikiertona
      var lp = akLapiNyt(aikaMs);
      if (lp){
        t.lapiKmh = Math.sqrt(lp.ue[q]*lp.ue[q] + lp.un[q]*lp.un[q])*3.6;
        t.lapiSuunta = (Math.atan2(lp.ue[q], lp.un[q])*180/Math.PI + 360) % 360;
        var ye = ue + lp.ue[q], yn = un + lp.un[q];
        t.yhteisKmh = Math.sqrt(ye*ye + yn*yn)*3.6;
        t.lapiQ = lp.Q;
      }
    }
  }
  return t;
}
window.akMalliPisteessa = function(lat, lon, aikaMs){
  return Promise.resolve(akLatausLupaus).then(function(){ return akMalliLaske(lat, lon, aikaMs); });
};

/* SYNKRONISET RAJAPINNAT OTTIPAIKKOJEN PISTEYTYKSELLE — 22.9.2026.
   Pisteytys ajetaan analyysin sisällä, joka ei odota. Nämä palauttavat null,
   jos kortin data ei ole vielä latautunut; pisteytys kertoo silloin sen. */
window.akMalliSync = function(lat, lon, aikaMs){ return akMalliLaske(lat, lon, aikaMs); };
window.akValmis = function(){ return !!(akSyvyys && mask && data.length); };
window.akSyvyysPisteessa = function(lat, lon, sadeM){
  if (!akSyvyys || !mask || !jarvi || !jarvi.kartta) return null;
  var k = jarvi.kartta, r = Math.max(1, Math.round((sadeM || 300)/k.ruutu));
  var i0 = Math.floor((lon - k.lansiLon)*111320*Math.cos(lat*Math.PI/180)/k.ruutu);
  var j0 = Math.floor((k.pohjoisLat - lat)*111320/k.ruutu);
  var mn = Infinity, mx = -Infinity, n = 0;
  for (var dj = -r; dj <= r; dj++) for (var di = -r; di <= r; di++){
    if (di*di + dj*dj > r*r) continue;
    var i = i0+di, j = j0+dj;
    if (i < 0 || j < 0 || i >= k.W || j >= k.H) continue;
    var q = j*k.W + i;
    if (!mask[q]) continue;
    if (akSyvyys[q] < mn) mn = akSyvyys[q];
    if (akSyvyys[q] > mx) mx = akSyvyys[q];
    n++;
  }
  return n ? { min: mn, max: mx, n: n } : null;
};

/* 1.10.2026 (v123): syvyys NIMETYN järven kartasta riippumatta siitä, mikä järvi kortilla
   on valittuna. akSyvyysPisteessa lukee valitun järven, ja vertailu (v122) antoi Lappajärvellä
   "ei ruutua" kaikkiin pisteisiin, kun kortilla oli toinen järvi. Purku välimuistiin. */
var akJarviPurku = {};
// v124: onko piste vedessä nimetyn järven maskin mukaan (null = ei karttaa / ruudukon ulkopuolella)
window.akOnVetta = function(avain, lat, lon){
  var J = JARVET[avain]; if (!J || !J.kartta || !J.kartta.maski) return null;
  var c = akJarviPurku[avain] || (akJarviPurku[avain] = { s: puraSyvyysLuokat(J.kartta), m: puraMaski(J.kartta) });
  var k = J.kartta;
  var i = Math.floor((lon - k.lansiLon)*111320*Math.cos(lat*Math.PI/180)/k.ruutu), j = Math.floor((k.pohjoisLat - lat)*111320/k.ruutu);
  if (i < 0 || j < 0 || i >= k.W || j >= k.H) return null;
  return !!c.m[j*k.W + i];
};
// v143: onko pisteen syvyys mitattu/luettu (kartta.kattavuus). Ilman maskia: true.
var akKattavuusPurku = {};
window.akKatettu = function(avain, lat, lon){
  var J = JARVET[avain]; if (!J || !J.kartta) return null;
  var k = J.kartta; if (!k.kattavuus) return true;
  var kb = akKattavuusPurku[avain] || (akKattavuusPurku[avain] = atob(k.kattavuus));
  var i = Math.floor((lon - k.lansiLon)*111320*Math.cos(lat*Math.PI/180)/k.ruutu), j = Math.floor((k.pohjoisLat - lat)*111320/k.ruutu);
  if (i < 0 || j < 0 || i >= k.W || j >= k.H) return false;
  var q = j*k.W + i;
  return !!((kb.charCodeAt(q >> 3) >> (7 - (q & 7))) & 1);
};
window.akSyvyysJarvessa = function(avain, lat, lon, sadeM){
  var J = JARVET[avain];
  if (!J || !J.kartta || !J.kartta.maski || !J.kartta.syvyysLuokat) return null;
  var c = akJarviPurku[avain] || (akJarviPurku[avain] = { s: puraSyvyysLuokat(J.kartta), m: puraMaski(J.kartta) });
  var k = J.kartta, r = Math.max(1, Math.round((sadeM || 300)/k.ruutu));
  var i0 = Math.floor((lon - k.lansiLon)*111320*Math.cos(lat*Math.PI/180)/k.ruutu);
  var j0 = Math.floor((k.pohjoisLat - lat)*111320/k.ruutu);
  var mn = Infinity, mx = -Infinity, n = 0;
  for (var dj = -r; dj <= r; dj++) for (var di = -r; di <= r; di++){
    if (di*di + dj*dj > r*r) continue;
    var i = i0+di, j = j0+dj;
    if (i < 0 || j < 0 || i >= k.W || j >= k.H) continue;
    var q = j*k.W + i;
    if (!c.m[q]) continue;
    if (c.s[q] < mn) mn = c.s[q];
    if (c.s[q] > mx) mx = c.s[q];
    n++;
  }
  return n ? { min: mn, max: mx, n: n } : null;
};

/* ===== JÄRVEN TILASTO LÄMPÖTIEDOLLE — 5.10.2026 (v155) =====
   Pääkoodin järvikohtainen lämpötieto (ltMalli) tarvitsee keskisyvyyden, pinta-alan ja syvänteiden
   syvyyden (Kirillin & Shatwell 2016: kriittinen keskisyvyys). Saimaalla vain ruudut, joiden syvyys
   on luettu karttakuvista (kattavuus); pinta-ala on silti koko rajattu vesialue. Lisäksi rajaus
   SYKE-lämpöhistorian rakennusajolle (havaintopaikkojen haku). */
var akTilastoVali = {};
window.akJarviTilasto = function(avain){
  if (akTilastoVali[avain]) return akTilastoVali[avain];
  var J = JARVET[avain];
  if (!J || !J.kartta || !J.kartta.maski || !J.kartta.syvyysLuokat) return null;
  var k = J.kartta, c = akJarviPurku[avain] || (akJarviPurku[avain] = { s: puraSyvyysLuokat(k), m: puraMaski(k) });
  var kb = k.kattavuus ? (akKattavuusPurku[avain] || (akKattavuusPurku[avain] = atob(k.kattavuus))) : null;
  var nVesi = 0, syv = [], sum = 0;
  for (var q = 0; q < c.m.length; q++){
    if (!c.m[q]) continue;
    nVesi++;
    if (kb && !((kb.charCodeAt(q >> 3) >> (7 - (q & 7))) & 1)) continue;
    var d = c.s[q];
    if (!(d >= 0)) continue;
    syv.push(d); sum += d;
  }
  if (!syv.length) return null;
  syv.sort(function(a, b){ return a - b; });
  var R = k.ruutu, latEtela = k.pohjoisLat - k.H*R/111320;
  var t = {
    nimi: J.nimi, ruutu: R, osittain: !!kb,
    H: (typeof J.syvyys === 'number') ? J.syvyys : sum/syv.length,   // sama keskisyvyys kuin järvitaulukossa
    Hmax: syv[syv.length - 1], p90: syv[Math.floor(syv.length*0.9)],
    alaKm2: nVesi*R*R/1e6, lat: J.lat, lon: J.lon,
    bbox: { latMin: latEtela, latMax: k.pohjoisLat, lonMin: k.lansiLon,
            lonMax: k.lansiLon + k.W*R/(111320*Math.cos(k.pohjoisLat*Math.PI/180)) }
  };
  t.osuusYli = function(x){
    var lo = 0, hi = syv.length;
    while (lo < hi){ var m = (lo + hi) >> 1; if (syv[m] <= x) lo = m + 1; else hi = m; }
    return (syv.length - lo)/syv.length;
  };
  return akTilastoVali[avain] = t;
};
window.akJarviAvaimet = function(){
  return Object.keys(JARVET).filter(function(a){ var J = JARVET[a]; return J && J.kartta && J.kartta.maski && J.kartta.syvyysLuokat; });
};

/* YLEISVINKIT ILMAN NIMETTYÄ PAIKKAA — 22.9.2026. Kohdat lasketaan kartasta:
   syvänteen reuna lajin syvyydellä, kumpuamisranta ja paluuvirran reuna.
   Kukin palautetaan koordinaatteina; lähimmän nimetyn paikan etäisyys lasketaan
   pääkoodissa. Palauttaa null, jos syvyyksiä tai ennustetta ei ole. */
window.akYleisvinkit = function(o){
  if (!akSyvyys || !mask || !jarvi || !jarvi.kartta) return null;
  var k = jarvi.kartta, W = k.W, H = k.H, R = k.ruutu, vinkit = [];
  function kohta(q){
    var i = q % W, j = (q/W)|0;
    var lat = k.pohjoisLat - (j + 0.5)*R/111320;
    return { lat: lat, lon: k.lansiLon + (i + 0.5)*R/(111320*Math.cos(lat*Math.PI/180)) };
  }
  function etaisyys2(q){ var p = kohta(q), dy = (p.lat - o.lat)*111320, dx = (p.lon - o.lon)*111320*Math.cos(p.lat*Math.PI/180); return dx*dx + dy*dy; }
  function naapuri(q, r, ehto){
    var i = q % W, j = (q/W)|0;
    for (var dj = -r; dj <= r; dj++) for (var di = -r; di <= r; di++){
      var ii = i+di, jj = j+dj; if (ii < 0 || jj < 0 || ii >= W || jj >= H) { if (ehto(-1)) return true; continue; }
      if (ehto(jj*W + ii)) return true;
    }
    return false;
  }
  // a) syvänteen reuna lajin syvyydellä, lähimpänä kärkipaikkaa
  if (typeof o.kohdeSyvyys === 'number'){
    var paras = -1, pd = Infinity;
    for (var q = 0; q < mask.length; q++){
      // matalampi ruutu, jonka vieressä pohja on vähintään 2 m vetosyvyyttä syvemmällä:
      // tämän päivän vetosyvyyden käyrä kulkee niiden välissä
      if (!mask[q] || akSyvyys[q] > o.kohdeSyvyys) continue;
      if (!naapuri(q, 2, function(n){ return n >= 0 && mask[n] && akSyvyys[n] >= o.kohdeSyvyys + 2; })) continue;
      var d = etaisyys2(q); if (d < pd){ pd = d; paras = q; }
    }
    if (paras >= 0){ var p = kohta(paras), syvin = 0;
      naapuri(paras, 2, function(n){ if (n >= 0 && mask[n] && akSyvyys[n] > syvin) syvin = akSyvyys[n]; return false; });
      vinkit.push({ laji: 'reuna', taso: 'Malli', lat: p.lat, lon: p.lon,
        teksti: 'Tässä pohja laskee matalasta noin ' + Math.round(syvin) + ' metriin, ja tämän päivän ' + o.kohdeSyvyys.toFixed(1).replace('.', ',')
          + ' metrin vetosyvyys kulkee reunassa. Reunaa pitkin vetäessä syvyys pysyy kohdallaan. Syvyysluokat ovat karkeita, joten tarkista kaikulla.' }); }
  }
  // b) kumpuamisranta: tuulen puoleinen jyrkkä ranta, kun maatuuli on kestänyt
  if (o.luotettava && typeof o.tuuliSuunta === 'number'){
    var kes = { lat: jarvi.lat, lon: jarvi.lon }, pb = -1, ps = -2;
    for (var q2 = 0; q2 < mask.length; q2++){
      if (!mask[q2] || akSyvyys[q2] < 5) continue;
      if (!naapuri(q2, 2, function(n){ return n < 0 || !mask[n] || akSyvyys[n] < 2.5; })) continue;
      var c = kohta(q2), dy2 = c.lat - kes.lat, dx2 = (c.lon - kes.lon)*Math.cos(c.lat*Math.PI/180);
      var suunta = Math.atan2(dx2, dy2)*180/Math.PI, ero = Math.abs(((suunta - o.tuuliSuunta) % 360 + 540) % 360 - 180);
      var arvo = Math.cos(ero*Math.PI/180);
      if (arvo > ps){ ps = arvo; pb = q2; }
    }
    if (pb >= 0 && ps > 0.7){ var p2 = kohta(pb);
      vinkit.push({ laji: 'kumpu', taso: o.kerrostunut === true ? 'Tutkittu' : 'Konsensus', lat: p2.lat, lon: p2.lon,
        teksti: 'Tuulen puoleinen jyrkkä ranta: maatuuli on painanut pintavettä ulapalle ' + o.tunteja + ' tuntia. '
          + (o.kerrostunut === true ? 'Järvi on kerrostunut, joten tilalle nousee kylmää alusvettä — kumpuaminen on mitattu ilmiö.'
                                    : 'Kerrostuneisuutta ei ole varmistettu, joten kylmän veden noususta ei ole takeita. Tyynen rannan hyöty on silti uistelijoiden vanha tieto.') }); }
  }
  // c) paluuvirran reuna: syvempi vesi vaihtaa suuntaa, lähimpänä kärkipaikkaa
  var kd = (typeof akKierto === 'function') ? akKierto() : null;
  if (kd && data.length && typeof o.aikaMs === 'number'){
    var idx = 0, pe = Infinity;
    for (var n2 = 0; n2 < data.length; n2++){ var e = Math.abs(data[n2].aika.getTime() - o.aikaMs); if (e < pe){ pe = e; idx = n2; } }
    var dd = data[idx], U = Math.max(0.5, dd.U), ta = (dd.dir + 180)*Math.PI/180, tx = Math.sin(ta), ty = Math.cos(ta);
    var P = kd.pohjat, suu = new Int8Array(mask.length), nop = new Float32Array(mask.length), mxv = 0;
    for (var q3 = 0; q3 < mask.length; q3++){ if (!mask[q3]) continue;
      var ue = tx*P.ita.ue[q3] + ty*P.pohjoinen.ue[q3], un = tx*P.ita.un[q3] + ty*P.pohjoinen.un[q3];
      nop[q3] = Math.sqrt(ue*ue + un*un); if (nop[q3] > mxv) mxv = nop[q3];
      suu[q3] = (ue*tx + un*ty) >= 0 ? 1 : -1; }
    var pr = -1, prd = Infinity;
    for (var q4 = 0; q4 < mask.length; q4++){
      if (!mask[q4] || suu[q4] !== -1 || nop[q4] < 0.6*mxv) continue;
      if (!naapuri(q4, 1, function(n){ return n >= 0 && mask[n] && suu[n] === 1; })) continue;
      var d4 = etaisyys2(q4); if (d4 < prd){ prd = d4; pr = q4; }
    }
    if (pr >= 0 && U >= 3){ var p4 = kohta(pr);
      vinkit.push({ laji: 'virta', taso: 'Malli', lat: p4.lat, lon: p4.lon,
        teksti: 'Paluuvirran reuna: täällä syvempi vesi kääntyy vastatuuleen, kun pinta menee myötätuuleen. Uistelijoiden konsensus on, että virtausreuna kerää syöttikalaa — mallin kohta on suuntaa-antava, nopeus voi heittää 2–3-kertaisesti.' }); }
  }
  return vinkit;
};

/* ===== KUHAN EHDOKASPAIKAT SYVYYSKARTASTA — 4.10.2026 (v153) =====
   Hannu 4.10.: Lappajärvellä ei ole omia kuhapisteitä A:n ja B:n lisäksi, eikä niitä ole nyt
   antaa, joten yleisneuvonta kartasta; ehdotukset näkyvät myös kartalla merkkeinä.
   Ehdokasruutu NIMETYN järven ruudukossa (ei riipu kortin valinnasta):
     - pehmennetty syvyys (sama ±75 m kuin v152 syvyyskartassa) enintään 0,75 m kuhan mallisyvyydestä
     - kaltevuus pehmennetystä syvyydestä vähintään 2 m / 100 m. Lappajärvellä (MML 50 m) mediaani
       on 0,9 ja 90 % ruuduista on alle 2,8, joten raja poimii jyrkimmät reunat. Matalilla järvillä
       raja on järven jyrkin kymmenes (ks. akKuhaPohjaLaske). Jos ehdokkaita on alle kolme, raja on
       jyrkin neljännes ja tulos merkitään loivaksi.
     - oma luokkasyvyys ≥ 1,5 m ja rantaan vähintään 100 m (samat rajat kuin v152 raportissa)
   Testi 4.10. (Lappajärvi): mallisyvyydellä 3 m ehdokasruutuja 153, 4 m 535, 6 m 825.
   Konvergenssin syvä reuna (v152) liitetään vain, kun kortti on samalla järvellä ja tuuliennuste
   on 3 h sisällä hetkestä. Pisteet ja todisteen tasot pääkoodissa (kuhaEhdokkaat). */
var akKuhaPohja = {};
function akKuhaPohjaLaske(avain){
  if (akKuhaPohja[avain]) return akKuhaPohja[avain];
  var J = JARVET[avain];
  if (!J || !J.kartta || !J.kartta.maski || !J.kartta.syvyysLuokat) return null;
  var k = J.kartta, W = k.W, H = k.H, R = k.ruutu, n = W*H;
  var c = akJarviPurku[avain] || (akJarviPurku[avain] = { s: puraSyvyysLuokat(k), m: puraMaski(k) });
  var s = c.s, m = c.m, r = Math.max(1, Math.round(75/R)), r1 = Math.max(1, Math.round(100/R));
  var f = new Float32Array(n), g = new Float32Array(n), suunta = new Float32Array(n), ranta = new Uint8Array(n);
  var q, i, j, a, b, ii, jj, q2;
  for (q = 0; q < n; q++){
    if (!m[q]) continue;
    i = q % W; j = (q/W)|0;
    var sum = 0, cnt = 0;
    for (a = -r; a <= r; a++) for (b = -r; b <= r; b++){
      ii = i + a; jj = j + b; if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue;
      q2 = jj*W + ii; if (!m[q2]) continue; sum += s[q2]; cnt++;
    }
    f[q] = cnt ? sum/cnt : s[q];
    for (a = -r1; a <= r1 && !ranta[q]; a++) for (b = -r1; b <= r1; b++){
      if (a*a + b*b > r1*r1) continue;
      ii = i + a; jj = j + b;
      if (ii < 0 || jj < 0 || ii >= W || jj >= H || !m[jj*W + ii]){ ranta[q] = 1; break; }
    }
  }
  function fv(ii2, jj2){ return (ii2 < 0 || jj2 < 0 || ii2 >= W || jj2 >= H || !m[jj2*W + ii2]) ? null : f[jj2*W + ii2]; }
  for (q = 0; q < n; q++){
    if (!m[q]) continue;
    i = q % W; j = (q/W)|0;
    var L = fv(i-1, j), Rr = fv(i+1, j), U = fv(i, j-1), D = fv(i, j+1);
    var gx = (L !== null && Rr !== null) ? (Rr - L)/(2*R) : Rr !== null ? (Rr - f[q])/R : L !== null ? (f[q] - L)/R : 0;
    var gy = (U !== null && D !== null) ? (D - U)/(2*R) : D !== null ? (D - f[q])/R : U !== null ? (f[q] - U)/R : 0;
    g[q] = Math.sqrt(gx*gx + gy*gy)*100;                       // m / 100 m
    suunta[q] = (Math.atan2(gx, -gy)*180/Math.PI + 360) % 360;  // syvenemisen suunta (j kasvaa etelään)
  }
  /* v153: matalilla järvillä (Alajärvi, Evijärvi, Kyrkösjärvi, Hirvijärvi) jyrkinkin reuna on alle
     2 m / 100 m (testi 4.10.: kaltevuuden 90 %:n piste 0,4–0,9), joten raja on järvikohtainen:
     jyrkin kymmenes, kuitenkin enintään 2 ja vähintään 0,5; vararaja jyrkin neljännes (enintään 1,2). */
  /* v154 (5.10.2026): Saimaalla syvyys on luettu karttakuvista vain osalle järveä (kartta.kattavuus);
     muualla ruutuun on pantu mediaani 6,5 m vain mallia varten. Täytön ja luetun syvyyden rajalle
     syntyisi keinotekoinen reuna, joten ehdokasruudun on oltava katetulla alueella, ja katettuja on
     oltava myös kaikki vesiruudut, joita sen pehmennys, kaltevuus ja 100 m:n syvyysväli käyttävät
     (säde r1 + r). Kaltevuuden jakauma (raja) lasketaan vain näistä ruuduista. Ilman maskia ennallaan. */
  var kat = null;
  if (k.kattavuus){
    var kb = akKattavuusPurku[avain] || (akKattavuusPurku[avain] = atob(k.kattavuus));
    var katettu = new Uint8Array(n), rk = Math.max(r + 1, r1 + r);
    for (q = 0; q < n; q++) katettu[q] = (kb.charCodeAt(q >> 3) >> (7 - (q & 7))) & 1;
    kat = new Uint8Array(n);
    for (q = 0; q < n; q++){
      if (!m[q] || !katettu[q]) continue;
      i = q % W; j = (q/W)|0;
      var ok = 1;
      for (a = -rk; a <= rk && ok; a++) for (b = -rk; b <= rk; b++){
        ii = i + a; jj = j + b; if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue;
        q2 = jj*W + ii; if (m[q2] && !katettu[q2]){ ok = 0; break; }
      }
      kat[q] = ok;
    }
  }
  var gl = [];
  for (q = 0; q < n; q++) if (m[q] && !ranta[q] && (!kat || kat[q])) gl.push(g[q]);
  gl.sort(function(x, y){ return x - y; });
  var p90 = gl.length ? gl[Math.floor(gl.length*0.9)] : 2, p75 = gl.length ? gl[Math.floor(gl.length*0.75)] : 1.2;
  akKuhaPohja[avain] = { k: k, s: s, m: m, f: f, g: g, suunta: suunta, ranta: ranta, r1: r1, kat: kat,
                         gRaja: Math.max(0.5, Math.min(2, p90)), gVara: Math.max(0.3, Math.min(1.2, p75)) };
  return akKuhaPohja[avain];
}
window.akKuhaEhdokkaat = function(o){
  // o: { avain, syvyys (kuhan mallisyvyys, m), aikaMs }
  var P = akKuhaPohjaLaske(o.avain);
  if (!P || typeof o.syvyys !== 'number' || isNaN(o.syvyys)) return null;
  var k = P.k, W = k.W, H = k.H, R = k.ruutu, d = o.syvyys, samaKortti = (jarvi === JARVET[o.avain]);
  var vl = (samaKortti && typeof o.aikaMs === 'number') ? akVLKentat(o.aikaMs) : null;
  function kohta(q){
    var i = q % W, j = (q/W)|0, lat = k.pohjoisLat - (j + 0.5)*R/111320;
    return { lat: lat, lon: k.lansiLon + (i + 0.5)*R/(111320*Math.cos(lat*Math.PI/180)) };
  }
  function lista(gRaja){
    var out = [];
    for (var q = 0; q < P.m.length; q++){
      if (!P.m[q] || P.ranta[q] || (P.kat && !P.kat[q]) || P.s[q] < 1.5 || P.g[q] < gRaja || Math.abs(P.f[q] - d) > 0.75) continue;
      var i = q % W, j = (q/W)|0, mn = Infinity, mx = -Infinity;
      for (var a = -P.r1; a <= P.r1; a++) for (var b = -P.r1; b <= P.r1; b++){
        if (a*a + b*b > P.r1*P.r1) continue;
        var ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue;
        var q2 = jj*W + ii; if (!P.m[q2]) continue;
        if (P.f[q2] < mn) mn = P.f[q2]; if (P.f[q2] > mx) mx = P.f[q2];
      }
      var p = kohta(q);
      out.push({ lat: p.lat, lon: p.lon, f: P.f[q], g: P.g[q], syvaSuunta: P.suunta[q], fMin: mn, fMax: mx,
                 konvReuna: (vl && vl.reuna) ? !!vl.reuna.reuna[q] : null,
                 kasautuminen: (vl && vl.kf) ? Math.round(vl.kf[q]) : null });
    }
    return out;
  }
  var gRaja = P.gRaja, ruudut = lista(gRaja), loiva = false;
  if (ruudut.length < 3 && P.gVara < gRaja){ gRaja = P.gVara; ruudut = lista(gRaja); loiva = true; }
  return { ruudut: ruudut, loiva: loiva, gRaja: gRaja, jarviLoiva: P.gRaja < 2, konvergenssi: !!(vl && vl.reuna), osittain: !!P.kat,
           tuuliOdottaa: samaKortti && !data.length, samaKortti: samaKortti };
};


/* ===== TAIMENEN HOTSPOTIT HARPPAUSKERROKSESTA — 5.10.2026 (v156) =====
   Hannu 5.10.2026: otit ovat tulleet pääosin pinnasta, joten saalisdata vääristää kuvaa; tarvitaan
   uusi näkemys, ja teoreettinen malli kelpaa. Painotus (Hannun järjestys): 1 harppauksen kallistuma,
   2 seiche eli paluuheilahdus, 3 selän rintama, 4 syöttikalakerros. Järvet: Lappajärvi, Kivijärvi ja
   Toisvesi. Lappajärvellä uudet ehdokkaat ≥ 700 m nimetyistä paikoista JA nimettyjen paikkojen
   pisteytys samalla mallilla. Mallia ei soviteta saaliisiin (pintapainotteisia).
   MALLI = lineaarinen kaksikerrosmalli, ensimmäinen moodi, koko järvelle yksi kallistuva taso:
     - Tasapainokallistus u*²/(g'·h1) tuulen alapuolelle (Wu 1973, Kranenburg 1985; Stevens & Imberger
       1996, JFM 312:39, kaava 2). Kääntöpiste alusveden (pohja > h1) painopisteessä.
     - Kehitys ajassa vaimennettuna värähtelijänä, jakso Ti = 2L/ci, ci = √(g'·h1·h2/(h1+h2)), L alusveden
       ulottuvuus kallistuksen suunnassa (2–98 %). Askelvasteessa tasapaino Ti/4:ssä, kitkattomana huippu
       kaksinkertainen Ti/2:ssa (Stevens & Imberger 1996). Vaimennus e-kertainen yhdessä jaksossa (Arvio;
       seichet kestävät vain muutaman jakson, sama lähde).
     - Kun kerros saavuttaa pinnan tuulen yläpäässä, kallistus ei kasva: aaltovaste lakkaa ja vesi sekoittuu
       (Stevens & Imberger 1996). Raja: kerros juuri pinnassa puolen ulottuvuuden päässä painopisteestä.
     - Maapallon pyöriminen: Lr = ci/f, Burgerin luku S = 2·Lr/B (Antenucci & Imberger 2001; Valbuena ym.
       2022, WRR 58). B = pienempi alusveden leveydestä tuulta vastaan ja keskileveydestä (ala / pisin
       ulottuvuus), jotta kapea järvi (Toisvesi) ei näytä leveältä (Arvio). S < 1: tuulen lakattua kallistus kiertää
       vastapäivään rantaa pitkin (sisäinen Kelvin-aalto) kierrosajalla TK = alusveden piiri / ci ja keskittyy
       rantaan (exp(−d/Lr), sekoitus inertiajakson aikana). Tuulen aikana S < 1 ja kesto ≥ 6 h: kylmää vettä
       voi nousta myös tuulen suunnasta katsoen vasemmalla rannalla (Ekman; Valbuena ym. 2022, Lake Tahoe),
       vyöhyke 2·Lr (Arvio).
     - Rintama: 150 m:n sisällä kohdasta, jossa kerros puhkeaa pintaan (hq = 0); siinä pintalämpö vaihtuu.
   Rajoitukset: monialtainen järvi kallistuu tässä yhtenä tasona; kun kerros nousee pintaan, lineaarinen
   malli ei enää päde (sekoittuminen), joten syvyys rajataan nollaan. Pisteet ja tekstit pääkoodissa. */
var akTaimenGeom = {};
function akTaimenGeomLaske(avain, h1){
  var P = akKuhaPohjaLaske(avain);
  if (!P) return null;
  var gAvain = avain + '|' + (Math.round(h1*2)/2);
  if (akTaimenGeom[gAvain]) return akTaimenGeom[gAvain];
  var k = P.k, W = k.W, H = k.H, R = k.ruutu, n = W*H, q, i, j, v;
  // rantaetäisyys metreinä (kahden kierroksen chamfer-etäisyysmuunnos; ruudukon ulkopuoli = maata)
  var d = new Float32Array(n), D1 = R, D2 = R*Math.SQRT2;
  for (q = 0; q < n; q++) d[q] = P.m[q] ? 1e9 : 0;
  for (j = 0; j < H; j++) for (i = 0; i < W; i++){
    q = j*W + i; if (!P.m[q]) continue; v = d[q];
    v = Math.min(v, i > 0 ? d[q-1] + D1 : D1);
    if (j > 0){ v = Math.min(v, d[q-W] + D1, i > 0 ? d[q-W-1] + D2 : D1, i < W-1 ? d[q-W+1] + D2 : D1); } else v = Math.min(v, D1);
    d[q] = v;
  }
  for (j = H-1; j >= 0; j--) for (i = W-1; i >= 0; i--){
    q = j*W + i; if (!P.m[q]) continue; v = d[q];
    v = Math.min(v, i < W-1 ? d[q+1] + D1 : D1);
    if (j < H-1){ v = Math.min(v, d[q+W] + D1, i < W-1 ? d[q+W+1] + D2 : D1, i > 0 ? d[q+W-1] + D2 : D1); } else v = Math.min(v, D1);
    d[q] = v;
  }
  // alusvesi = vesiruudut, joissa pehmennetty syvyys > h1
  var hyp = new Uint8Array(n), nh = 0, sx = 0, sy = 0, sh2 = 0, reunat = 0;
  for (q = 0; q < n; q++) if (P.m[q] && P.f[q] > h1){ hyp[q] = 1; nh++; i = q % W; j = (q/W)|0;
    sx += (i + 0.5)*R; sy += -(j + 0.5)*R; sh2 += P.f[q] - h1; }
  if (nh < 20){ akTaimenGeom[gAvain] = { tyhja: true, P: P, d: d }; return akTaimenGeom[gAvain]; }
  var xc = sx/nh, yc = sy/nh;
  // Kelvin-aallon kierros: vain ulkoreuna (saarten ympärykset pois). Ulko = ei-alusvesi, joka yhtyy ruudukon reunaan.
  var ulko = new Uint8Array(n), jono = [];
  for (q = 0; q < n; q++){ i = q % W; j = (q/W)|0; if (!hyp[q] && (i === 0 || j === 0 || i === W-1 || j === H-1)){ ulko[q] = 1; jono.push(q); } }
  for (var jp = 0; jp < jono.length; jp++){ q = jono[jp]; i = q % W; j = (q/W)|0;
    var nn = [i > 0 ? q-1 : -1, i < W-1 ? q+1 : -1, j > 0 ? q-W : -1, j < H-1 ? q+W : -1];
    for (var t4 = 0; t4 < 4; t4++){ var q5 = nn[t4]; if (q5 >= 0 && !hyp[q5] && !ulko[q5]){ ulko[q5] = 1; jono.push(q5); } } }
  for (q = 0; q < n; q++){ if (!hyp[q]) continue; i = q % W; j = (q/W)|0;
    if (i === 0 || ulko[q-1]) reunat++; if (i === W-1 || ulko[q+1]) reunat++;
    if (j === 0 || ulko[q-W]) reunat++; if (j === H-1 || ulko[q+W]) reunat++; }
  // ulottuvuus 10° välein (2–98 %), otos enintään noin 6000 ruutua
  var askel = Math.max(1, Math.floor(nh/6000)), ox = [], oy = [], c = 0;
  for (q = 0; q < n; q++){ if (!hyp[q]) continue; if ((c++ % askel) !== 0) continue;
    ox.push((q % W + 0.5)*R - xc); oy.push(-(((q/W)|0) + 0.5)*R - yc); }
  var Ls = new Float32Array(36), pr = new Float64Array(ox.length);
  for (var s = 0; s < 36; s++){
    var th = s*10*Math.PI/180, ex = Math.sin(th), ny = Math.cos(th);
    for (c = 0; c < ox.length; c++) pr[c] = ox[c]*ex + oy[c]*ny;
    var ps = Array.prototype.slice.call(pr).sort(function(a, b){ return a - b; });
    Ls[s] = ps[Math.floor(ps.length*0.98)] - ps[Math.floor(ps.length*0.02)] + R;
  }
  var Lmax = 0; for (s = 0; s < 36; s++) if (Ls[s] > Lmax) Lmax = Ls[s];
  akTaimenGeom[gAvain] = { P: P, d: d, hyp: hyp, nh: nh, xc: xc, yc: yc, h2: sh2/nh,
                           piiri: reunat*R*Math.PI/4, Ls: Ls, alaKm2: nh*R*R/1e6,
                           leveys: nh*R*R/Lmax };   // keskileveys = ala / pisin ulottuvuus (kapea järvi ≠ leveä)
  return akTaimenGeom[gAvain];
}
function akKulmaEro(a, b){ return Math.abs(((a - b) % 360 + 540) % 360 - 180); }
window.akTaimenKentta = function(o){
  // o: { avain, h1 (m), gp (m/s²), tuuli: [{t (ms), U (m/s), dir (mistä, °)}], aikaMs, syvRaja (m) }
  if (!(o && o.h1 > 0 && o.gp > 0)) return null;
  var G = akTaimenGeomLaske(o.avain, o.h1);
  if (!G) return null;
  if (G.tyhja) return { tila: 'eiAlusvetta', h1: o.h1 };
  var P = G.P, k = P.k, W = k.W, H = k.H, R = k.ruutu, n = W*H, h1 = o.h1, gp = o.gp;
  var lat0 = k.pohjoisLat, fC = 2*7.2921e-5*Math.sin(lat0*Math.PI/180);
  var ci = Math.sqrt(gp*h1*G.h2/(h1 + G.h2)), Lr = ci/fC, TK = G.piiri/ci, Tin = 2*Math.PI/fC;
  function Lsu(deg){ return Math.max(1000, G.Ls[Math.round((((deg % 360) + 360) % 360)/10) % 36]); }
  var sarja = (o.tuuli || []).filter(function(w){ return w && isFinite(w.t) && isFinite(w.U) && isFinite(w.dir) && w.t <= o.aikaMs + 1800e3; })
                             .sort(function(a, b){ return a.t - b.t; });
  if (!sarja.length || o.aikaMs - sarja[0].t < 6*3600e3) return { tila: 'eiTuulta', h1: h1 };
  var t0 = Math.max(o.aikaMs - 120*3600e3, sarja[0].t), dt = 600;
  var ax = 0, ay = 0, vx = 0, vy = 0, idx = 0, tVapaa = 0, kesto = 0, viime = null, edDir = null, ehti = 0, rajattu = false;
  for (var t = t0; t <= o.aikaMs; t += dt*1000){
    while (idx + 1 < sarja.length && sarja[idx + 1].t <= t) idx++;
    var w = sarja[idx], U = Math.max(0, w.U), dir = w.dir;
    var us2 = (U >= 5 ? 0.0015 : 0.001)*1.225*U*U/1000, seq = us2/(gp*h1);
    var th = (dir + 180)*Math.PI/180, ex = Math.sin(th), ny = Math.cos(th);
    if (U >= 3){
      kesto = (tVapaa === 0 && edDir !== null && akKulmaEro(edDir, dir) <= 45) ? kesto + dt : dt;
      edDir = dir;
      var L = Lsu(dir + 180), Ti = 2*L/ci, om = 2*Math.PI/Ti, ga = 2/Ti;
      vx += dt*(om*om*(seq*ex - ax) - ga*vx); vy += dt*(om*om*(seq*ny - ay) - ga*vy);
      ax += dt*vx; ay += dt*vy;
      tVapaa = 0;
      viime = { dir: dir, U: U, us2: us2, L: L, Ti: Ti, kestoH: kesto/3600, loppuMs: t,
                B: Math.min(Lsu(dir + 270), G.leveys), W: gp*h1*h1/(us2*L) };
    } else {
      tVapaa += dt; edDir = null;
      var am = Math.sqrt(ax*ax + ay*ay);
      var Bv = viime ? viime.B : G.leveys;
      if (2*Lr/Bv < 1 && viime){
        // Kelvin-aalto: kallistus kiertää vastapäivään (pohjoisella pallonpuoliskolla), vaimenee
        var fi = 2*Math.PI*dt/TK, cf = Math.cos(fi), sf = Math.sin(fi), vaim = Math.exp(-dt/TK);
        var nx = (ax*cf - ay*sf)*vaim, nyy = (ax*sf + ay*cf)*vaim; ax = nx; ay = nyy; vx = 0; vy = 0;
      } else {
        var Lf = Lsu(am > 0 ? Math.atan2(ax, ay)*180/Math.PI : 0), Tf = 2*Lf/ci, omf = 2*Math.PI/Tf, gf = 2/Tf;
        vx += dt*(omf*omf*(seq*ex - ax) - gf*vx); vy += dt*(omf*omf*(seq*ny - ay) - gf*vy);
        ax += dt*vx; ay += dt*vy;
      }
    }
    // Kerros pinnassa tuulen yläpäässä: aaltovaste lakkaa ja vesi sekoittuu (Stevens & Imberger 1996,
    // johtopäätös iv), joten kallistus rajataan siihen, että kerros juuri saavuttaa pinnan (Ls/2 painopisteestä).
    var amK = Math.sqrt(ax*ax + ay*ay);
    if (amK > 0){
      var katto = h1/(0.5*Lsu(Math.atan2(ax, ay)*180/Math.PI));
      if (amK > katto){ ax *= katto/amK; ay *= katto/amK; vx = 0; vy = 0; rajattu = true; }
    }
    ehti += dt;
  }
  var S = viime ? 2*Lr/viime.B : null;
  var vaihe = !viime ? 'tyyni' : tVapaa === 0 ? 'tuuli' : (S < 1 ? 'kelvin' : 'seiche');
  var trap = vaihe === 'kelvin' ? Math.min(1, tVapaa/Tin) : 0;
  // kentät: harppauksen syvyys hq (raaka, voi olla < 0 = kerros pinnassa)
  var hq = new Float32Array(n), nousuMax = 0, pinnassa = 0, vesi = 0;
  for (var q = 0; q < n; q++){
    if (!P.m[q]) continue; vesi++;
    var x = (q % W + 0.5)*R - G.xc, y = -(((q/W)|0) + 0.5)*R - G.yc;
    var ze = (ax*x + ay*y)*((1 - trap) + trap*Math.exp(-G.d[q]/Lr));
    hq[q] = h1 + ze;
    if (P.f[q] > Math.max(0, hq[q]) + 0.5){ if (h1 - hq[q] > nousuMax) nousuMax = h1 - hq[q]; if (hq[q] <= 0) pinnassa++; }
  }
  var r2 = Math.max(1, Math.round(150/R)), syvRaja = typeof o.syvRaja === 'number' ? o.syvRaja : h1;
  var vasenOk = vaihe === 'tuuli' && S !== null && S < 1 && viime.kestoH >= 6;
  var lth = viime ? (viime.dir + 180 + 90)*Math.PI/180 : 0, lx = Math.sin(lth), lyy = Math.cos(lth), lAskeleet = Math.max(1, Math.round(2*Lr/R));
  function piirteet(q){
    var i = q % W, j = (q/W)|0, h = hq[q], f = P.f[q];
    var kylma = f > Math.max(0, h) + 0.5;   // alusvettä on tässä kohdassa
    // Rintama = kohta, jossa kerros puhkeaa pintaan (hq = 0 -käyrä): kaksikerrosmallissa pintalämpö vaihtuu
    // siinä alusveden lämmöstä päällysveden lämpöön. Merkitään ruudut 150 m:n sisällä käyrästä.
    var rintama = false;
    if (kylma && h <= 2){
      for (var a = -r2; a <= r2 && !rintama; a++) for (var b = -r2; b <= r2; b++){
        var ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue;
        var q2 = jj*W + ii; if (P.m[q2] && ((h <= 0) !== (hq[q2] <= 0))){ rintama = true; break; }
      }
    }
    var vasen = false;
    if (vasenOk){
      for (var st = 1; st <= lAskeleet; st++){
        var i3 = Math.round(i + lx*st), j3 = Math.round(j - lyy*st);
        if (i3 < 0 || j3 < 0 || i3 >= W || j3 >= H || !P.m[j3*W + i3]){ vasen = true; break; }
      }
    }
    return { q: q, hq: h, f: f, g: P.g[q], kylma: kylma, nousu: kylma ? h1 - h : 0,
             pohjassa: h > 0.5 && Math.abs(f - h) <= 1 && P.g[q] >= P.gVara, rintama: rintama, vasen: vasen,
             syvaSuunta: P.suunta[q], rannastaM: Math.round(G.d[q]) };
  }
  function kohtaQ(q){
    var i = q % W, j = (q/W)|0, la = k.pohjoisLat - (j + 0.5)*R/111320;
    return { lat: la, lon: k.lansiLon + (i + 0.5)*R/(111320*Math.cos(la*Math.PI/180)) };
  }
  var ruudut = [];
  if (vaihe !== 'tyyni' && nousuMax >= 0.5){
    for (var q4 = 0; q4 < n; q4++){
      if (!P.m[q4] || P.ranta[q4] || (P.kat && !P.kat[q4]) || P.s[q4] < 1.5) continue;
      var p4 = piirteet(q4);
      if (!(p4.rintama || p4.pohjassa || (p4.nousu >= 1 && p4.hq <= syvRaja))) continue;
      var c4 = kohtaQ(q4); p4.lat = c4.lat; p4.lon = c4.lon; ruudut.push(p4);
    }
  }
  return { tila: 'ok', vaihe: vaihe, ruudut: ruudut, h1: h1, h2: G.h2, ci: ci, Lr: Lr, S: S, TK: TK,
           Ti: viime ? viime.Ti : null, viime: viime, tunnitTuulesta: tVapaa/3600, nousuMax: nousuMax,
           pinnassaOsuus: vesi ? pinnassa/vesi : 0, kallistus: Math.sqrt(ax*ax + ay*ay), suunta: (Math.atan2(ax, ay)*180/Math.PI + 360) % 360,
           historiaH: ehti/3600, alusvesiKm2: G.alaKm2, rajattu: rajattu, leveysKm: G.leveys/1000, osittain: !!P.kat, samaKortti: (jarvi === JARVET[o.avain]),
           kohta: function(lat, lon){
             var i = Math.floor((lon - k.lansiLon)*111320*Math.cos(lat*Math.PI/180)/R), j = Math.floor((k.pohjoisLat - lat)*111320/R);
             var rr = Math.max(1, Math.round(150/R)), paras = -1, pe = Infinity;
             for (var a = -rr; a <= rr; a++) for (var b = -rr; b <= rr; b++){
               var ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= W || jj >= H || !P.m[jj*W + ii]) continue;
               var e = a*a + b*b; if (e < pe){ pe = e; paras = jj*W + ii; }
             }
             if (paras < 0) return null;
             var p = piirteet(paras), c = kohtaQ(paras); p.lat = c.lat; p.lon = c.lon; return p;
           } };
};

/* Taimenmerkit kartalle (v156): oma kytkin, eri värit kuin kuhalla, mukana myös Ozi-kuvassa. */
var akTaimenMerkit = false;
try { akTaimenMerkit = localStorage.getItem('aaltokartta_taimen') === '1'; } catch(e){}
function akTaimenKohteetKortilla(){
  var K = window.akTaimenKohteet;
  return (K && jarvi && jarvi === JARVET[K.avain]) ? K : null;
}
function akPiirraTaimenMerkit(ctx, win, S){
  if (!akTaimenMerkit) return;
  var K = akTaimenKohteetKortilla(); if (!K) return;
  var k = jarvi.kartta, kerr = akVientiKerroin > 1 ? akVientiKerroin : 1;
  K.kohteet.forEach(function(p){
    var i = (p.lon - k.lansiLon)*111320*Math.cos(p.lat*Math.PI/180)/k.ruutu, j = (k.pohjoisLat - p.lat)*111320/k.ruutu;
    if (i < win.i0 || j < win.j0 || i >= win.i0 + win.w || j >= win.j0 + win.h) return;
    var x = (i - win.i0)*S, y = (j - win.j0)*S, oma = p.tyyppi === 'oma', vt = p.tyyppi === 'vaihtoehto';   // v168: V = ennusteiden vaihtoehto
    var r = (oma ? (p.paras ? 9 : 7.5) : 9.5)*kerr;
    ctx.beginPath(); ctx.arc(x, y, r + 2.2*kerr, 0, 6.2832); ctx.fillStyle = "rgba(255,255,255,.92)"; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832);
    ctx.fillStyle = oma ? "#3d8fd6" : vt ? "#dbe9f7" : "#ffffff"; ctx.fill();
    if (vt && ctx.setLineDash) ctx.setLineDash([4*kerr, 4*kerr]);
    ctx.lineWidth = (oma ? 1.6 : 2.6)*kerr; ctx.strokeStyle = oma ? "#0b2f52" : "#1c6fb8"; ctx.stroke();
    if (vt && ctx.setLineDash) ctx.setLineDash([]);
    if (p.tunnus){
      ctx.font = "700 " + Math.round((p.tunnus.length >= 3 ? 8.5 : 10)*kerr) + "px system-ui, sans-serif";   // v158: T10–T20
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#0b2f52";
      ctx.fillText(p.tunnus, x, y + 0.5*kerr);
    }
  });
}
function akTaimenInfoPaivita(){
  var el = $("akTaimenInfo"); if (!el) return;
  if (!akTaimenMerkit){ el.style.display = 'none'; el.textContent = ''; return; }
  el.style.display = '';
  var K = window.akTaimenKohteet;
  if (!K){ el.textContent = 'Taimenpaikkoja ei ole vielä laskettu. Valitse Lappajärvi, Kivijärvi tai Toisvesi paikaksi ja paina Analysoi Suunnittelussa.'; return; }
  if (!jarvi || jarvi !== JARVET[K.avain]){
    el.textContent = 'Taimenpaikat on laskettu järvelle ' + (JARVET[K.avain] ? JARVET[K.avain].nimi : K.avain) + ', mutta kartalla on ' + (jarvi ? jarvi.nimi : '–') + '.'; return;
  }
  var t = new Date(K.hetki), pad = function(n){ return ("0"+n).slice(-2); };
  if (!K.kohteet.length){   // v159: laskettu, mutta ehdokkaita ei tullut – kerrotaan miksi
    el.textContent = 'Taimenpaikat (' + JARVET[K.avain].nimi + ', ' + t.getDate() + '.' + (t.getMonth()+1) + '. klo ' + pad(t.getHours()) + ':' + pad(t.getMinutes())
      + '): ei ehdokkaita, koska ' + (K.syy || 'malli ei löytänyt kohtia') + '. Tarkemmin Raportit-ruudun taimenpaneelissa.';
    return;
  }
  var osat = [];   // v168: selite niistä merkeistä, joita on
  if (K.kohteet.some(function(p){ return p.tyyppi === 'ehdokas'; })) osat.push('<b>valkoinen T-numero</b> on ehdokas harppauskerroksen mallista');
  if (K.kohteet.some(function(p){ return p.tyyppi === 'oma'; })) osat.push('<b>sininen pallo</b> nimetty paikka, jolle malli antaa pisteitä (isoin paras)');
  if (K.kohteet.some(function(p){ return p.tyyppi === 'vaihtoehto'; })) osat.push('<b>katkoviivainen V</b> kohta, joka toistuu yli puolessa ensemble-ennusteista');
  el.innerHTML = 'Taimenpaikat hetkelle ' + t.getDate() + '.' + (t.getMonth()+1) + '. klo ' + pad(t.getHours()) + ':' + pad(t.getMinutes())
    + ': ' + osat.join(', ')
    + '. Napauta merkkiä. Paikat lasketaan Analysoi-napista, eivät vaihdu kartan tunnin mukana.';
}
window.akAsetaTaimenMerkit = function(paalla){
  akTaimenMerkit = !!paalla;
  var el = $("akTaimenMerkit"); if (el) el.checked = akTaimenMerkit;
  try { localStorage.setItem('aaltokartta_taimen', akTaimenMerkit ? '1' : '0'); } catch(e){}
  akTaimenInfoPaivita();
  try { if (jarvi && data.length) piirra(); } catch(e){}
};
function akTaimenPisteTieto(){
  if (!akTaimenMerkit || !akValittu || !akViime) return '';
  var K = akTaimenKohteetKortilla(); if (!K) return '';
  var k = akViime.k, lat = k.pohjoisLat - (akValittu.j + 0.5)*k.ruutu/111320;
  var lon = k.lansiLon + (akValittu.i + 0.5)*k.ruutu/(111320*Math.cos(lat*Math.PI/180));
  var raja = Math.max(150, 12/akViime.S*k.ruutu), paras = null, pm = Infinity;
  K.kohteet.forEach(function(p){
    var dy = (p.lat - lat)*111320, dx = (p.lon - lon)*111320*Math.cos(lat*Math.PI/180), e = Math.sqrt(dx*dx + dy*dy);
    if (e < pm){ pm = e; paras = p; }
  });
  if (!paras || pm > raja) return '';
  return '<br>🎣 <b>' + paras.nimi + '</b>: ' + paras.teksti;
}

function akKuhaKohteetKortilla(){
  var K = window.akKuhaKohteet;
  return (K && jarvi && jarvi === JARVET[K.avain]) ? K : null;
}
function akPiirraKuhaMerkit(ctx, win, S){
  if (!akKuhaMerkit) return;
  var K = akKuhaKohteetKortilla(); if (!K) return;
  var k = jarvi.kartta, kerr = akVientiKerroin > 1 ? akVientiKerroin : 1;
  K.kohteet.forEach(function(p){
    var i = (p.lon - k.lansiLon)*111320*Math.cos(p.lat*Math.PI/180)/k.ruutu, j = (k.pohjoisLat - p.lat)*111320/k.ruutu;
    if (i < win.i0 || j < win.j0 || i >= win.i0 + win.w || j >= win.j0 + win.h) return;
    var x = (i - win.i0)*S, y = (j - win.j0)*S, oma = p.tyyppi === 'oma';
    var r = (oma ? (p.paras ? 9 : 7.5) : 8)*kerr;
    ctx.beginPath(); ctx.arc(x, y, r + 2.2*kerr, 0, 6.2832); ctx.fillStyle = "rgba(255,255,255,.92)"; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832);
    ctx.fillStyle = oma ? "#f2a024" : "#ffffff"; ctx.fill();
    ctx.lineWidth = (oma ? 1.6 : 2.6)*kerr; ctx.strokeStyle = oma ? "#3b2700" : "#c27400"; ctx.stroke();
    if (p.tunnus){
      ctx.font = "700 " + Math.round(11*kerr) + "px system-ui, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#1d1400";
      ctx.fillText(p.tunnus, x, y + 0.5*kerr);
    }
  });
}
function akKuhaInfoPaivita(){
  var el = $("akKuhaInfo"); if (!el) return;
  if (!akKuhaMerkit){ el.style.display = 'none'; el.textContent = ''; return; }
  el.style.display = '';
  var K = window.akKuhaKohteet;
  if (!K){ el.textContent = 'Kuhapaikkoja ei ole vielä laskettu. Valitse kuhajärvi paikaksi ja paina Analysoi Suunnittelussa.'; return; }
  if (!jarvi || jarvi !== JARVET[K.avain]){
    el.textContent = 'Kuhapaikat on laskettu järvelle ' + (JARVET[K.avain] ? JARVET[K.avain].nimi : K.avain) + ', mutta kartalla on ' + (jarvi ? jarvi.nimi : '–') + '.'; return;
  }
  var t = new Date(K.hetki), pad = function(n){ return ("0"+n).slice(-2); };
  var ehd = K.kohteet.some(function(p){ return p.tyyppi === 'ehdokas'; });
  el.innerHTML = 'Kuhapaikat hetkelle ' + t.getDate() + '.' + (t.getMonth()+1) + '. klo ' + pad(t.getHours()) + ':' + pad(t.getMinutes())
    + ': <b>oranssi pallo</b> on oma saalis- tai paikkamerkintä (isoin on paras)'
    + (ehd ? ', <b>valkoinen numero</b> on ehdokas syvyyskartasta (malli)' : '')
    + '. Napauta merkkiä. Kartan tunti ei vaihda kuhapaikkoja; ne lasketaan Analysoi-napista.';
}
window.akAsetaKuhaMerkit = function(paalla){
  akKuhaMerkit = !!paalla;
  var el = $("akKuhaMerkit"); if (el) el.checked = akKuhaMerkit;
  try { localStorage.setItem('aaltokartta_kuha', akKuhaMerkit ? '1' : '0'); } catch(e){}
  akKuhaInfoPaivita();
  try { if (jarvi && data.length) piirra(); } catch(e){}
};
window.akPiirraUudelleen = function(){
  akKuhaInfoPaivita();
  try { akTaimenInfoPaivita(); } catch(e){}   // v156
  try { if ((akKuhaMerkit || akTaimenMerkit) && jarvi && data.length) piirra(); } catch(e){}
};
/* ===== KLOONIPISTEET — 10.10.2026 (v177) =====
   Hannu 10.10.2026: "Visuaalinen tilannekuva ja POI-pisteiden dynaaminen kloonaus". Iskun hetkellä
   iskuruudun tilanne jäädytetään sormenjäljeksi, ja säteen sisältä etsitään ruudut, joissa sama
   yhdistelmä toistuu. Hannun valinnat 10.10.: vain lohikalat ja kuha käynnistävät (pääkoodi),
   ISKUHETKEN tuuli (pisteet eivät siirry tuulen kääntyessä), säde 1–5 km ja määrä 1–5 säädettävät.
   Kokonaisuus OODA-silmukkana: ks. pääkoodin KLOONIPISTEET-kommentti. Tämä osa laskee ja piirtää.
   SORMENJÄLKI (sama ruudukko kuin kuhaehdokkaissa, akKuhaPohjaLaske; oma luotaus on mukana s:ssä):
     pohja     ruudun syvyys s (MML-luokka tai oman luotauksen mediaani)               paino 3
     kaltevuus pehmennetyn syvyyden kaltevuus g, m / 100 m                            paino 2
     asento    syvenemissuunta tuulen kulkusuuntaan nähden, −180…180°:                paino 2 × min(1, g)
               ±180 = tuuli puskee syvältä matalalle (tuulenpuoleinen penkka),
               0 = tuuli painaa matalalta syvälle (suojan puoli). Etumerkki kertoo,
               kummalla puolella syvä on myötätuuleen katsoen (Coriolis kääntää virtaa oikealle).
     aalto     merkitsevä aallonkorkeus iskuhetken tuulella (sama kaava kuin kartalla)  paino 1,5
     muoto     ruudun syvyys miinus 150 m:n renkaan keskisyvyys: < 0 kari/matalikko,   paino 1,5
               > 0 kuoppa
     rannasta  etäisyys rantaan (suhde, log)                                            paino 1
     harppaus  taimenen harppauskerroksen malli, jos pääkoodi antaa sen (≤ 3 h)        paino 1
   Kunkin tekijän samankaltaisuus exp(−½(Δ/σ)²); σ: pohja max(0,6 m; 15 %), kaltevuus max(0,4; 35 %),
   asento 35°, aalto max(0,04 m; 30 %), muoto max(0,5 m; 40 %), rannasta 0,5 (log), harppaus 1,5 m.
   Pisteet = painotettu keskiarvo × 100. Painot ja σ:t ovat ARVIO, ei sovitettu saaliisiin (dataa ei
   vielä ole); tilasto (käynnit, osumat) kertyy pääkoodissa myöhempää sovitusta varten.
   RAJAUS: vesiruutu säteen sisällä, vähintään 400 m iskusta ja toisistaan (paras ensin), Saimaalla
   vain katetut ruudut, pohja ≥ pyyntisyvyys + 0,3 m, kun pyyntisyvyys tiedetään.
   EI MUKANA: veden lämpö, koska sovelluksessa se on yksi SYKE-arvo koko järvelle. Se kulkee
   kirjauksen mukana, mutta paikkoja sillä ei voi erotella.
   Laskenta vaatii, että kortilla on iskun järvi (aalto ja pyyhkäisy lasketaan kortin ruudukossa);
   pääkoodi vaihtaa kortin järven akValitseJarvi-funktiolla ennen laskentaa. */
var akRantaMatkaV = {};
function akRantaMatka(avain){   // etäisyys rantaan metreinä (chamfer, sama kuin taimenmallissa)
  if (akRantaMatkaV[avain]) return akRantaMatkaV[avain];
  var P = akKuhaPohjaLaske(avain); if (!P) return null;
  var k = P.k, W = k.W, H = k.H, R = k.ruutu, n = W*H, d = new Float32Array(n), D1 = R, D2 = R*Math.SQRT2, i, j, q, v;
  for (q = 0; q < n; q++) d[q] = P.m[q] ? 1e9 : 0;
  for (j = 0; j < H; j++) for (i = 0; i < W; i++){
    q = j*W + i; if (!P.m[q]) continue; v = d[q];
    v = Math.min(v, i > 0 ? d[q-1] + D1 : D1);
    if (j > 0){ v = Math.min(v, d[q-W] + D1, i > 0 ? d[q-W-1] + D2 : D1, i < W-1 ? d[q-W+1] + D2 : D1); } else v = Math.min(v, D1);
    d[q] = v;
  }
  for (j = H-1; j >= 0; j--) for (i = W-1; i >= 0; i--){
    q = j*W + i; if (!P.m[q]) continue; v = d[q];
    v = Math.min(v, i < W-1 ? d[q+1] + D1 : D1);
    if (j < H-1){ v = Math.min(v, d[q+W] + D1, i < W-1 ? d[q+W+1] + D2 : D1, i > 0 ? d[q+W-1] + D2 : D1); } else v = Math.min(v, D1);
    d[q] = v;
  }
  return akRantaMatkaV[avain] = d;
}
function akKlooniKohta(k, q){
  var i = q % k.W, j = (q/k.W)|0, la = k.pohjoisLat - (j + 0.5)*k.ruutu/111320;
  return { lat: la, lon: k.lansiLon + (i + 0.5)*k.ruutu/(111320*Math.cos(la*Math.PI/180)) };
}
function akKlooniPiirteet(P, q, c){
  var k = P.k, W = k.W, H = k.H, i = q % W, j = (q/W)|0, rr = c.rr, sum = 0, cnt = 0, a, b;
  for (a = -rr; a <= rr; a++) for (b = -rr; b <= rr; b++){
    var e = a*a + b*b; if (e <= 2 || e > rr*rr) continue;   // rengas: välittömät naapurit eivät kerro muodosta
    var ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue;
    var q2 = jj*W + ii; if (!P.m[q2]) continue;
    sum += P.s[q2]; cnt++;
  }
  return { pohja: P.s[q], f: P.f[q], g: P.g[q], syvaSuunta: P.suunta[q],
           asento: ((P.suunta[q] - c.kulku) % 360 + 540) % 360 - 180,
           aalto: akAaltoRuutu(q, Math.min(c.kentta[q], c.Fkesto), c.U, c.katto).hs,
           muoto: cnt ? P.s[q] - sum/cnt : 0, rengas: cnt ? sum/cnt : null, rannasta: c.ranta ? c.ranta[q] : null, hq: null,
           oma: !!(c.omaSolut && c.omaSolut[q] !== undefined) };   // oma = ruudun syvyys omasta luotauksesta
}
function akKlooniVertaa(A, B){
  var osat = {}, sw = 0, ss = 0;
  function G(d, s){ return Math.exp(-0.5*(d/s)*(d/s)); }
  function lisaa(nimi, w, sim){ if (!(w > 0) || !isFinite(sim)) return; osat[nimi] = Math.round(sim*100); sw += w; ss += w*sim; }
  lisaa('pohja', 3, G(B.pohja - A.pohja, Math.max(0.6, 0.15*A.pohja)));
  lisaa('kaltevuus', 2, G(B.g - A.g, Math.max(0.4, 0.35*A.g)));
  // penkan asento vain, jos iskupaikalla on penkka; tasaisella ehdokkaalla suunta on kohinaa
  if (A.g >= 0.3) lisaa('asento', 2*Math.min(1, A.g), B.g >= 0.3 ? G(akKulmaEro(A.asento, B.asento), 35) : 0.3);
  lisaa('aalto', 1.5, G(B.aalto - A.aalto, Math.max(0.04, 0.3*A.aalto)));
  lisaa('muoto', 1.5, G(B.muoto - A.muoto, Math.max(0.5, 0.4*Math.abs(A.muoto))));
  if (A.rannasta > 0 && B.rannasta > 0) lisaa('rannasta', 1, G(Math.log(B.rannasta/A.rannasta), 0.5));
  if (typeof A.hq === 'number' && typeof B.hq === 'number') lisaa('harppaus', 1, G(B.hq - A.hq, 1.5));
  return { pisteet: sw ? Math.round(100*ss/sw) : 0, osat: osat };
}
window.akKloonit = function(o){
  // o: { avain, lat, lon, U (m/s), dir (mistä, °), tunteja, sadeM, maara, kynnys (%), pyyntiSyvyys (m|null), harppaus(lat, lon) -> m|null }
  if (!o || !JARVET[o.avain]) return { tila: 'eiJarvea' };
  if (jarvi !== JARVET[o.avain] || !mask || !akSyvyys) return { tila: 'eriJarvi', jarvi: JARVET[o.avain].nimi, kortilla: jarvi ? jarvi.nimi : null };
  var P = akKuhaPohjaLaske(o.avain); if (!P) return { tila: 'eiSyvyytta', jarvi: JARVET[o.avain].nimi };
  var k = P.k, W = k.W, H = k.H, R = k.ruutu;
  var qI = akRuutuPisteelle(k, o.lat, o.lon); if (qI < 0) return { tila: 'eiRuutua', jarvi: jarvi.nimi };
  var U = Math.max(0.5, +o.U || 0), dir = ((+o.dir % 360) + 360) % 360, tunteja = Math.max(1, +o.tunteja || 6);
  var c = { kentta: akKentta(Math.round(dir/5)*5), Fkesto: kestonPyyhkaisy(tunteja*3600, U), U: U, katto: syvyysKatto(jarvi.syvyys, U),
            ranta: akRantaMatka(o.avain), kulku: (dir + 180) % 360, rr: Math.max(2, Math.round(150/R)), omaSolut: null };
  try { var ol = (typeof omaLuotausSolut === 'function') ? omaLuotausSolut(k) : null; c.omaSolut = ol && ol.soluja ? ol.solut : null; } catch(e){}
  var A = akKlooniPiirteet(P, qI, c), cI = akKlooniKohta(k, qI);
  /* Testi 10.10. (Hannun 4.10. taimen, Pihlajasaaren seutu): iskuruudussa ei ollut omaa luotausta, joten
     sormenjälki sai MML-luokan 3–6 m (4,5), vaikka naapuriruutujen luotaus näytti 2,4–2,5 m. Iskupaikan
     pohja otetaan siksi oman luotauksen mediaanista 60 m säteeltä, kun pisteitä on vähintään kolme
     (pääkoodi antaa pohjaMitattu). Muoto lasketaan silloin samasta arvosta. */
  A.pohjaLahde = A.oma ? 'oma luotaus' : 'MML-luokka';
  if (typeof o.pohjaMitattu === 'number' && o.pohjaMitattu > 0){
    A.pohjaRuutu = A.pohja; A.pohja = o.pohjaMitattu; A.pohjaLahde = 'oma luotaus 60 m';
    if (typeof A.rengas === 'number') A.muoto = A.pohja - A.rengas;
  }
  var hqF = typeof o.harppaus === 'function' ? o.harppaus : null;
  if (hqF){ try { A.hq = hqF(cI.lat, cI.lon); } catch(e){ A.hq = null; } if (typeof A.hq !== 'number') hqF = null; }
  var sade = Math.max(500, Math.min(10000, +o.sadeM || 3000)), r = Math.ceil(sade/R), i0 = qI % W, j0 = (qI/W)|0;
  var vali2 = (400/R)*(400/R), kynnys = +o.kynnys || 70, maara = Math.max(1, Math.min(9, +o.maara || 3));
  var ps = (typeof o.pyyntiSyvyys === 'number' && o.pyyntiSyvyys > 0) ? o.pyyntiSyvyys : null;
  var ehd = [], tutkittu = 0, rajattuSyvyys = 0;
  for (var dj = -r; dj <= r; dj++) for (var di = -r; di <= r; di++){
    var e2 = di*di + dj*dj; if (e2*R*R > sade*sade || e2 < vali2) continue;
    var ii = i0 + di, jj = j0 + dj; if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue;
    var q = jj*W + ii; if (!P.m[q] || (P.kat && !P.kat[q])) continue;
    tutkittu++;
    if (ps !== null && P.s[q] < ps + 0.3){ rajattuSyvyys++; continue; }
    var B = akKlooniPiirteet(P, q, c);
    if (hqF){ var cq = akKlooniKohta(k, q); try { B.hq = hqF(cq.lat, cq.lon); } catch(e){ B.hq = null; } }
    var v = akKlooniVertaa(A, B);
    if (v.pisteet < kynnys) continue;
    ehd.push({ q: q, di: di, dj: dj, pisteet: v.pisteet, osat: v.osat, sj: B });
  }
  ehd.sort(function(a, b){ return b.pisteet - a.pisteet || (a.di*a.di + a.dj*a.dj) - (b.di*b.di + b.dj*b.dj); });
  var valitut = [];
  for (var n = 0; n < ehd.length && valitut.length < maara; n++){
    var x = ehd[n], ok = true;
    for (var m = 0; m < valitut.length && ok; m++){ var a1 = x.di - valitut[m].di, b1 = x.dj - valitut[m].dj; if (a1*a1 + b1*b1 < vali2) ok = false; }
    if (ok) valitut.push(x);
  }
  var kloonit = valitut.map(function(x){
    var p = akKlooniKohta(k, x.q), dx = x.di*R, dy = -x.dj*R;
    return { lat: p.lat, lon: p.lon, pisteet: x.pisteet, osat: x.osat, sj: x.sj,
             etaisyysM: Math.round(Math.sqrt(dx*dx + dy*dy)), suunta: Math.round((Math.atan2(dx, dy)*180/Math.PI + 360) % 360) % 360 };
  });
  return { tila: 'ok', jarvi: jarvi.nimi, ruutu: R, sadeM: sade, kynnys: kynnys, maara: maara,
           isku: { lat: cI.lat, lon: cI.lon, sj: A }, kloonit: kloonit, ehdokkaita: ehd.length, tutkittu: tutkittu,
           rajattuSyvyys: rajattuSyvyys, harppaus: !!hqF, tuuli: { U: U, dir: dir, tunteja: tunteja } };
};
/* Iskuhetken tuuli kortin ennusteesta (FMI, havaintokorjattu), jos lähin tunti on ≤ 3 h päässä
   ja kortilla on sama järvi. Muuten null: pääkoodi käyttää kirjauksen tuulta. */
window.akTuuliHetkella = function(aikaMs, avain){
  if (!data.length || !jarvi || (avain && jarvi !== JARVET[avain])) return null;
  var idx = 0, pe = Infinity;
  for (var n = 0; n < data.length; n++){ var e = Math.abs(data[n].aika.getTime() - aikaMs); if (e < pe){ pe = e; idx = n; } }
  if (pe > 3*3600e3) return null;
  var d = data[idx];
  return { U: d.U, dir: d.dir, tunteja: d.tunteja, lahde: 'FMI-ennuste ' + ('0' + d.aika.getHours()).slice(-2) + ':00' };
};
window.akValitseJarvi = function(avain){   // kortti iskun järvelle (kloonit lasketaan kortin ruudukossa)
  if (!JARVET[avain] || !val || val.value === avain) return false;
  val.value = avain; lataa(avain); return true;
};

/* Kloonit kartalle (v177): oma kytkin (oletuksena päällä), violetti salmiakki = klooni, punainen
   pallo = isku, katkoviivaympyrä = hakusäde aktiivisesta iskusta, keltainen rengas = seuraavaksi.
   Kerroksen (window.akKlooniKerros) kokoaa pääkoodi; mukana myös Ozi-kuvassa. */
var akKlooniMerkit = true;
try { akKlooniMerkit = localStorage.getItem('aaltokartta_kloonit') !== '0'; } catch(e){}
function akKlooniKerrosKortilla(){
  var K = window.akKlooniKerros;
  return (K && K.iskut && K.iskut.length && jarvi && jarvi === JARVET[K.avain]) ? K : null;
}
function akPiirraKloonit(ctx, win, S){
  if (!akKlooniMerkit) return;
  var K = akKlooniKerrosKortilla(); if (!K) return;
  var k = jarvi.kartta, kerr = akVientiKerroin > 1 ? akVientiKerroin : 1, LW = win.w*S, LH = win.h*S;
  function px(lat, lon){ return { x: ((lon - k.lansiLon)*111320*Math.cos(lat*Math.PI/180)/k.ruutu - win.i0)*S,
                                  y: ((k.pohjoisLat - lat)*111320/k.ruutu - win.j0)*S }; }
  function nakyy(p){ var m = 60*kerr; return p.x > -m && p.y > -m && p.x < LW + m && p.y < LH + m; }
  function teksti(t, x, y, vari){
    ctx.font = "700 " + Math.round(11*kerr) + "px system-ui, sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.lineWidth = 3*kerr; ctx.strokeStyle = "rgba(255,255,255,.92)"; ctx.strokeText(t, x, y);
    ctx.fillStyle = vari; ctx.fillText(t, x, y);
  }
  ctx.save();
  K.iskut.forEach(function(I){
    var a = px(I.lat, I.lon);
    if (I.tunnus === K.aktiivinen && I.sadeM){
      ctx.setLineDash([6*kerr, 5*kerr]); ctx.lineWidth = 1.4*kerr; ctx.strokeStyle = "rgba(124,58,237,.55)";
      ctx.beginPath(); ctx.arc(a.x, a.y, I.sadeM/k.ruutu*S, 0, 6.2832); ctx.stroke();
    }
    ctx.setLineDash([3*kerr, 4*kerr]); ctx.lineWidth = 1.3*kerr; ctx.strokeStyle = "rgba(124,58,237,.65)";
    ctx.beginPath();
    (I.kloonit || []).forEach(function(c){ var b = px(c.lat, c.lon); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); });
    ctx.stroke();
  });
  ctx.setLineDash([]);
  K.iskut.forEach(function(I){
    (I.kloonit || []).forEach(function(c){
      var p = px(c.lat, c.lon); if (!nakyy(p)) return;
      var r = 8*kerr, r2 = r + 2.2*kerr;
      if (c.tunnus === K.seuraava){ ctx.beginPath(); ctx.arc(p.x, p.y, r + 6*kerr, 0, 6.2832); ctx.lineWidth = 2.6*kerr; ctx.strokeStyle = "#f5b700"; ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(p.x, p.y - r2); ctx.lineTo(p.x + r2, p.y); ctx.lineTo(p.x, p.y + r2); ctx.lineTo(p.x - r2, p.y); ctx.closePath();
      ctx.fillStyle = "rgba(255,255,255,.95)"; ctx.fill();
      ctx.beginPath(); ctx.moveTo(p.x, p.y - r); ctx.lineTo(p.x + r, p.y); ctx.lineTo(p.x, p.y + r); ctx.lineTo(p.x - r, p.y); ctx.closePath();
      ctx.fillStyle = c.osuma ? "#f5b700" : c.kayty ? "#c4b5fd" : "#7c3aed"; ctx.fill();
      teksti(c.tunnus + ' ' + c.pisteet + '%', p.x + r2 + 3*kerr, p.y, "#3b0a73");
    });
  });
  K.iskut.forEach(function(I){
    var p = px(I.lat, I.lon); if (!nakyy(p)) return;
    var r = 6.5*kerr;
    ctx.beginPath(); ctx.arc(p.x, p.y, r + 2.2*kerr, 0, 6.2832); ctx.fillStyle = "rgba(255,255,255,.95)"; ctx.fill();
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.2832); ctx.fillStyle = "#d7263d"; ctx.fill();
    teksti(I.tunnus + (I.lajiNimi ? ' ' + I.lajiNimi : ''), p.x + r + 5*kerr, p.y, "#7a0c1e");
  });
  ctx.restore();
}
function akKlooniInfoPaivita(){
  var el = $("akKlooniInfo"); if (!el) return;
  if (!akKlooniMerkit){ el.style.display = 'none'; el.textContent = ''; return; }
  el.style.display = '';
  var K = window.akKlooniKerros;
  if (!K || !K.iskut || !K.iskut.length){
    el.textContent = 'Kloonipisteitä ei ole vielä. Ne lasketaan, kun kirjaat taimenen, järvilohen, kirjolohen tai kuhan Kala kiinni -napilla, tai saalislistan 🎯-napista.'; return;
  }
  if (!jarvi || jarvi !== JARVET[K.avain]){
    el.textContent = 'Kloonit ovat järveltä ' + (JARVET[K.avain] ? JARVET[K.avain].nimi : K.avain) + ', mutta kartalla on ' + (jarvi ? jarvi.nimi : '–') + '.'; return;
  }
  el.innerHTML = K.info || '';
}
window.akAsetaKlooniMerkit = function(paalla){
  akKlooniMerkit = !!paalla;
  var el = $("akKlooniMerkit"); if (el) el.checked = akKlooniMerkit;
  try { localStorage.setItem('aaltokartta_kloonit', akKlooniMerkit ? '1' : '0'); } catch(e){}
  akKlooniInfoPaivita();
  try { if (jarvi && data.length) piirra(); } catch(e){}
};
window.akAsetaKlooniKerros = function(K){
  window.akKlooniKerros = K || null;
  akKlooniInfoPaivita();
  try { if (akKlooniMerkit && jarvi && data.length) piirra(); } catch(e){}
};
function akKlooniPisteTieto(){
  if (!akKlooniMerkit || !akValittu || !akViime) return '';
  var K = akKlooniKerrosKortilla(); if (!K) return '';
  var k = akViime.k, lat = k.pohjoisLat - (akValittu.j + 0.5)*k.ruutu/111320;
  var lon = k.lansiLon + (akValittu.i + 0.5)*k.ruutu/(111320*Math.cos(lat*Math.PI/180));
  var raja = Math.max(150, 12/akViime.S*k.ruutu), paras = null, pm = Infinity;
  K.iskut.forEach(function(I){
    [I].concat(I.kloonit || []).forEach(function(p){
      var dy = (p.lat - lat)*111320, dx = (p.lon - lon)*111320*Math.cos(lat*Math.PI/180), e = Math.sqrt(dx*dx + dy*dy);
      if (e < pm){ pm = e; paras = p; }
    });
  });
  if (!paras || pm > raja) return '';
  return '<br>🎯 <b>' + paras.tunnus + '</b>: ' + (paras.teksti || '');
}

/* ===== TILANNEKUVA JA OMA SIJAINTI — 10.10.2026 (v179) =====
   Hannu 10.10.: tilannetietoisuudelle oma kevyt sivu (tilanne.html), mutta mallia ei monisteta.
   Sivu lataa tämän saman tiedoston ja piirtää kartan itse (siirto, zoom, oma sijainti, merkit
   vektoreina näytön tarkkuudella). Pohjakuva lasketaan täsmälleen samalla piirra()-funktiolla kuin
   aaltokortti, joten värit, kalastusraja ja nuolet ovat samat. Lisäksi oma sijainti aaltokarttaan.
   RAJAPINTA:
     akRenderoi({ tila, tunti, kerroin }) → { kuva (canvas), k, win, S, aika, U, dir, raja, … }
         koko järvi ilman merkkejä; ilman ennustetta vain tila 'syvyys' (tuulena tyyni)
     akTunnit() → ennusteen tunnit [{ i, aika, U, dir, puuska }]
     akAvainPaikalle(nimi) → JARVET-avain sovelluksen paikan nimestä (sama sääntö kuin akSovitaPaikkaan)
     akJarviPisteessa(lat, lon) → järvi, jonka vesiruutuun piste osuu (tai null)
     akPiirraSijainti() → aaltokortin uudelleenpiirto oman sijainnin vuoksi (enintään 8 s välein,
         vain kun kortti näkyy). Sijainti luetaan window.utOmaSijainti-oliosta (sivu asettaa). */
var akKayraLeveys = null;   // { paa, muu } pikseleinä: vain akRenderoi asettaa (tilannekuvan pohjakuva zoomataan)
function akNykyAvain(){
  var ks = Object.keys(JARVET);
  for (var n = 0; n < ks.length; n++) if (JARVET[ks[n]] === jarvi) return ks[n];
  return null;
}
function akAvainNimelle(nimi){
  if (!nimi) return null;
  var osuma = Object.keys(JARVET).filter(function(k){
    var jn = JARVET[k].nimi || '';
    return nimi.slice(0,8) === jn.slice(0,8) || jn.indexOf(nimi.split(' ')[0]) === 0;
  })[0];
  return osuma || null;
}
window.akAvainPaikalle = function(nimi){ return akAvainNimelle(nimi); };
window.akJarviPisteessa = function(lat, lon){
  var ks = window.akJarviAvaimet();
  for (var n = 0; n < ks.length; n++) if (window.akOnVetta(ks[n], lat, lon) === true) return ks[n];
  return null;
};
window.akTunnit = function(){
  return data.map(function(d, i){ return { i: i, aika: d.aika, U: d.U, dir: d.dir, puuska: d.puuska }; });
};
window.akRenderoi = function(o){
  o = o || {};
  if (!jarvi || !jarvi.kartta || !mask) return { tila: 'eiJarvea' };
  var tyhja = !data.length;
  if (tyhja && o.tila && o.tila !== 'syvyys') return { tila: 'eiEnnustetta' };
  var t = { tila: akTila, valittu: valittu, zoom: akZoom, keski: akZoomKeski, sel: akValittu, kerroin: akVientiKerroin,
            kuha: akKuhaMerkit, taimen: akTaimenMerkit, klooni: akKlooniMerkit, oma: akOmaNakyy, data: data, kayra: akKayraLeveys };
  try {
    if (tyhja) data = [{ aika: new Date(), U: 0.5, Uenn: 0.5, dir: 0, puuska: null, tunteja: 1, Fpahin: 20000, korkein: 0, Tp: 0 }];
    akTila = akSyvyys ? (tyhja ? 'syvyys' : (o.tila || 'aalto')) : 'aalto';
    valittu = Math.max(0, Math.min(data.length - 1, typeof o.tunti === 'number' ? o.tunti : valittu));
    akZoom = 1; akZoomKeski = null; akValittu = null;
    akVientiKerroin = Math.max(1, o.kerroin || 3);
    akKuhaMerkit = false; akTaimenMerkit = false; akKlooniMerkit = false; akOmaNakyy = false;
    akKayraLeveys = { paa: 1.3, muu: 0.7 };
    piirra();
    var c = $("akKuva"), kopio = document.createElement('canvas');
    kopio.width = c.width; kopio.height = c.height; kopio.getContext('2d').drawImage(c, 0, 0);
    var d = data[valittu];
    return { tila: 'ok', kuva: kopio, k: akViime.k, win: akViime.win, S: akViime.S, avain: akNykyAvain(), jarvi: jarvi.nimi,
             naytto: akTila, tunti: valittu, ennuste: !tyhja, aika: tyhja ? null : d.aika, U: tyhja ? null : d.U, dir: tyhja ? null : d.dir,
             puuska: tyhja ? null : d.puuska, tunteja: tyhja ? null : d.tunteja, korkein: d.korkein, osuus: d.osuus, virMax: d.virMax,
             raja: akKalaRaja(), turva: akVene().turva, vene: akVene().nimi, syvyysLahde: akSyvyysLahde() };
  } finally {
    data = t.data; akTila = t.tila; valittu = t.valittu; akZoom = t.zoom; akZoomKeski = t.keski; akValittu = t.sel;
    akVientiKerroin = t.kerroin; akKuhaMerkit = t.kuha; akTaimenMerkit = t.taimen; akKlooniMerkit = t.klooni; akOmaNakyy = t.oma; akKayraLeveys = t.kayra;
    if (!akPiilorunko){ try { if (data.length) piirra(); } catch(e){} }   // aaltokortti näyttää taas omaa tilaansa
  }
};

/* Oma sijainti aaltokarttaan: vihreä pallo ja kulkusuunta. Vain kortin omassa piirrossa, ei Ozi-viennissä
   eikä tilannekuvan pohjakuvassa (tilannekuva piirtää sijainnin itse). Yli 2 min vanha sijainti ei näy. */
var akOmaNakyy = true, akSijaintiPiirtoT = 0;
function akPiirraOmaSijainti(ctx, win, S){
  var p = window.utOmaSijainti;
  if (!akOmaNakyy || akVientiKerroin > 1 || !p || typeof p.lat !== 'number' || !jarvi || !jarvi.kartta) return;
  if (Date.now() - (p.aika || 0) > 120e3) return;
  var k = jarvi.kartta;
  var x = ((p.lon - k.lansiLon)*111320*Math.cos(p.lat*Math.PI/180)/k.ruutu - win.i0)*S, y = ((k.pohjoisLat - p.lat)*111320/k.ruutu - win.j0)*S;
  if (x < -30 || y < -30 || x > win.w*S + 30 || y > win.h*S + 30) return;
  if (typeof p.suunta === 'number'){
    var a = p.suunta*Math.PI/180, L = 26;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.sin(a)*L, y - Math.cos(a)*L);
    ctx.lineWidth = 4.5; ctx.strokeStyle = "rgba(255,255,255,.95)"; ctx.stroke();
    ctx.lineWidth = 2.4; ctx.strokeStyle = "#1b5e20"; ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(x, y, 8.5, 0, 6.2832); ctx.fillStyle = "rgba(255,255,255,.95)"; ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, 6, 0, 6.2832); ctx.fillStyle = "#2e7d32"; ctx.fill();
}
window.akPiirraSijainti = function(){
  if (akPiilorunko || !jarvi || !data.length) return;
  var c = $("akKuva"); if (!c || c.offsetParent === null) return;   // kortti kiinni tai toinen ruutu
  var nyt = Date.now(); if (nyt - akSijaintiPiirtoT < 8000) return;
  akSijaintiPiirtoT = nyt;
  try { piirra(); } catch(e){}
};

/* Napautus: lähin kuhamerkki kerrotaan pisteen tietojen perään (myös syvyys- ja aaltotilassa). */
function akKuhaPisteTieto(){
  if (!akKuhaMerkit || !akValittu || !akViime) return '';
  var K = akKuhaKohteetKortilla(); if (!K) return '';
  var k = akViime.k, lat = k.pohjoisLat - (akValittu.j + 0.5)*k.ruutu/111320;
  var lon = k.lansiLon + (akValittu.i + 0.5)*k.ruutu/(111320*Math.cos(lat*Math.PI/180));
  var raja = Math.max(150, 12/akViime.S*k.ruutu), paras = null, pm = Infinity;
  K.kohteet.forEach(function(p){
    var dy = (p.lat - lat)*111320, dx = (p.lon - lon)*111320*Math.cos(lat*Math.PI/180), e = Math.sqrt(dx*dx + dy*dy);
    if (e < pm){ pm = e; paras = p; }
  });
  if (!paras || pm > raja) return '';
  return '<br>🐟 <b>' + paras.nimi + '</b>: ' + paras.teksti;
}

function lataa(avain){
  jarvi = JARVET[avain];
  try { akKiertoLataa(); } catch(e){}   // v150: kiertomallin kantakentät puhelimesta, jos laskettu aiemmin
  viimeSuunta = null;
  akKentat = {};          // toisen järven kentät eivät kelpaa tälle
  akValittu = null;

  if (!jarvi.kartta || !jarvi.kartta.maski){
    $("akLeima").innerHTML = '<small>karttadata puuttuu</small>';
    $("akTaulu").innerHTML = '<div class="ak-virhe">Tälle järvelle ei ole vielä '
      + 'karttamaskia. Aja pyyhkäisylaskenta ja liitä sen JSON JARVET-osioon.</div>';
    return;
  }
  mask = puraMaski(jarvi.kartta);
  akSyvyys = puraSyvyysLuokat(jarvi.kartta);
  akKiertoData = null;      // lasketaan vasta kun Syvempi vesi valitaan
  akLapiData = null; akLapiValimuisti = null;
  akPaivitaVirtausKytkin();
  $("akLeima").innerHTML = '<small>haetaan…</small>';

  akLatausLupaus = fetch(fmiUrl(jarvi.lat, jarvi.lon))
    .then(function(r){ return r.ok ? r.text() : Promise.reject(new Error("palvelin " + r.status)); })
    .then(function(txt){
      var s = parsi(txt);
      var nop = s.windspeedms, suu = s.winddirection, puu = s.windgust;
      if (!nop || !nop.length) throw new Error("tuulitietoja ei saatu");

      var sarja = nop.map(function(p, i){
        return {aika:p.aika, U:p.arvo, dir: suu && suu[i] ? suu[i].arvo : null,
                puuska: (puu && puu[i]) ? puu[i].arvo : null};
      }).filter(function(p){ return p.U != null && p.dir != null; });
      if (!sarja.length) throw new Error("ennusteessa ei ollut arvoja");

      // kuinka kauan tuuli on puhaltanut samasta suunnasta
      data = sarja.map(function(p, i){
        var t = 1;
        for (var k = i-1; k >= 0; k--){
          var ero = Math.abs(((sarja[k].dir - p.dir + 540) % 360) - 180);
          if (ero > 45 || sarja[k].U < 0.55*Math.max(p.U,0.5)) break;
          t++;
        }
        return {aika:p.aika, U:p.U, Uenn:p.U, dir:p.dir, puuska:p.puuska,
                tunteja:t, Fpahin:20000, korkein:0, Tp:0};
      });
      akHavaintokorjaus();

      valittu = 0;
      $("akLiuku").max = data.length - 1;
      $("akLiuku").value = 0;
      var pv = ["su","ma","ti","ke","to","pe","la"];
      var pad = function(n){ return ("0"+n).slice(-2); };
      $("akAlku").textContent  = pv[data[0].aika.getDay()] + " " + pad(data[0].aika.getHours()) + ":00";
      var v = data[data.length-1].aika;
      $("akLoppu").textContent = pv[v.getDay()] + " " + pad(v.getHours()) + ":00";
      piirra();
      akPiirraJana();
      akPiirraRulla();
      akKeskitaRulla(valittu, false);
    })
    .catch(function(e){
      $("akLeima").innerHTML = '<small>ei ennustetta</small>';
      $("akTaulu").innerHTML = '<div class="ak-virhe">Ennustetta ei saatu: '
        + e.message + '.</div>';
    });
}

// ---- Käynnistys --------------------------------------------------------
function piirraAsteikko(){
  if (akTila === 'syvyys'){
    $("akAsteikko").innerHTML = RAJAT_S.map(function(raja, i){
      return '<div style="background:' + VARIT_S[i] + ';color:' + (i >= 6 ? '#fff' : '#16211f') + '">' + String(raja).replace('.', ',') + '</div>';
    }).join("");
  } else if (akTila === 'murtuva'){   // v167
    $("akAsteikko").innerHTML = AK_MURT_NIMET.map(function(nimi, i){
      return '<div style="background:' + AK_MURT_VARIT[i] + ';color:' + (i >= 3 ? '#fff' : '#16211f') + ';font-size:.62rem;">' + nimi + '</div>';
    }).join("");
  } else if (akTila === 'konvergenssi'){
    $("akAsteikko").innerHTML = RAJAT_K.map(function(raja, i){
      return '<div style="background:' + VARIT_K[i] + ';color:' + (i <= 2 || i >= 9 ? '#fff' : '#16211f') + '">' + Math.round(raja/venytys) + '</div>';
    }).join("");
  } else {
  var R = (akTila === 'vajoama' || akTila === 'kumpuama') ? RAJAT_VI : (akTila === 'virtaus' || akTila === 'syva') ? RAJAT_V : RAJAT;
  $("akAsteikko").innerHTML = R.map(function(raja, i){
    var n = raja/venytys;
    return '<div style="background:' + VARIT[i] + '">'
         + ((akTila === 'vajoama' || akTila === 'kumpuama') ? Math.round(n) : n >= 1 ? n.toFixed(1) : n.toFixed(2).replace(/^0/,"")) + '</div>';
  }).join("");
  }
  var yk = $("akYksikko");
  if (yk) yk.textContent = akTila === 'virtaus' ? "pintavirtausarvio, km/h"
                         : akTila === 'syva'    ? "syvemmän veden kierto, km/h"
                         : akTila === 'vajoama' ? "vajoamaindeksi 0–100 (malli)"
                         : akTila === 'kumpuama' ? "kumpuamaindeksi 0–100 (malli)"
                         : akTila === 'konvergenssi' ? "punainen kasautuu, sininen erkanee · violetti sauma · ruskea syvä reuna"
                         : akTila === 'syvyys' ? "syvyys, m · ei navigointikartta"
                         : akTila === 'murtuva' ? "murtuva aallokko: syvyys, jyrkkyys, penkka, vastavirta · malli"
                         : "merkitsevä aallonkorkeus, m";
}
piirraAsteikko();

/* Virtausvalinnat ovat käytössä vain järvellä, jolla on syvyysluokat. */
function akPaivitaVirtausKytkin(){
  var sel = $("akNaytto");
  if (!sel) return;
  for (var i = 0; i < sel.options.length; i++){
    var o = sel.options[i];
    if (o.value === 'aalto') continue;
    o.disabled = !akSyvyys;
    o.textContent = (o.value === 'virtaus' ? "Pintavirtaus" : o.value === 'vajoama' ? "Vajoama" : o.value === 'kumpuama' ? "Kumpuama" : o.value === 'konvergenssi' ? "Konvergenssi" : o.value === 'syvyys' ? "Syvyyskartta" : o.value === 'murtuva' ? "Murtuva aallokko" : "Syvempi vesi")
                  + (akSyvyys ? "" : " (ei syvyyskarttaa)");
  }
  if (!akSyvyys){ akTila = 'aalto'; sel.value = 'aalto'; }
}
if ($("akNaytto")) $("akNaytto").addEventListener("change", function(){
  akTila = akSyvyys ? this.value : 'aalto';
  if ((akTila === 'syva' || akTila === 'murtuva') && !akKiertoData) $("akLeima").innerHTML = '<small>lasketaan kiertoa…</small>';
  // annetaan leiman piirtyä ennen raskasta laskentaa
  setTimeout(piirra, 30);
});

if ($("akKayrat")){
  $("akKayrat").checked = akKayrat;
  $("akKayrat").addEventListener("change", function(){
    akKayrat = this.checked;
    try { localStorage.setItem('aaltokartta_kayrat', akKayrat ? '1' : '0'); } catch(e){}
    piirra();
  });
}
if ($("akKuhaMerkit")){   // v153
  $("akKuhaMerkit").checked = akKuhaMerkit;
  $("akKuhaMerkit").addEventListener("change", function(){ window.akAsetaKuhaMerkit(this.checked); });
}
if ($("akTaimenMerkit")){   // v156
  $("akTaimenMerkit").checked = akTaimenMerkit;
  $("akTaimenMerkit").addEventListener("change", function(){ window.akAsetaTaimenMerkit(this.checked); });
}
if ($("akKlooniMerkit")){   // v177
  $("akKlooniMerkit").checked = akKlooniMerkit;
  $("akKlooniMerkit").addEventListener("change", function(){ window.akAsetaKlooniMerkit(this.checked); });
}
$("akKorosta").addEventListener("change", function(){
  korosta = this.checked;
  piirra();
});

/* Venevalinta ja kalastusraja. Raja tallentuu sille veneelle jonka kanssa sitä
   säädetään, ja valittu vene muistetaan. */
(function(){
  var sel = $("akVene");
  AK_VENEET.forEach(function(v){
    var o = document.createElement("option");
    o.textContent = v.nimi + " · turva " + v.turva.toFixed(2).replace(".", ",") + " m";
    sel.appendChild(o);
  });
  var i = 3;
  try { var t = localStorage.getItem(AK_LS_VENE);
        var kk = AK_VENEET.map(function(v){ return v.id; }).indexOf(t);
        if (kk >= 0) i = kk; } catch(e){}
  sel.selectedIndex = i;

  function naytaRaja(){
    var r = akKalaRaja();
    $("akRaja").max = akVene().turva;
    $("akRaja").value = r;
    $("akRajaL").textContent = r.toFixed(2).replace(".", ",") + " m";
  }
  naytaRaja();

  sel.addEventListener("change", function(){
    try { localStorage.setItem(AK_LS_VENE, akVene().id); } catch(e){}
    naytaRaja(); akPiirraJana(); piirra();
  });
  $("akRaja").addEventListener("input", function(){
    try { var r = akLueRajat(); r[akVene().id] = +this.value;
          localStorage.setItem(AK_LS_RAJAT, JSON.stringify(r)); } catch(e){}
    naytaRaja(); akPiirraJana(); piirra();
  });
})();

var val = $("akJarvi");
Object.keys(JARVET).forEach(function(k){
  var o = document.createElement("option");
  o.value = k; o.textContent = JARVET[k].nimi;
  val.appendChild(o);
});
val.addEventListener("change", function(){ lataa(this.value); });

/* KARTTA SEURAA SOVELLUKSEN PAIKKAVALINTAA — korjattu 20.9.2026.
   Kartalla oli oma järvivalinta joka ei tiennyt mitään currentLocationista.
   Siitä seurasi kaksi vikaa:
     1. Lappajärvi valittuna kartta saattoi näyttää Hirvijärveä, koska
        valinta jäi siihen mihin se viimeksi jätettiin
     2. PAHEMPI: akSuunnattuMitta ja akJarvenKeskipiste lukevat kartan
        järveä, joten kumpuamisen pyyhkäisymatka ja mittausaseman suuntima
        laskettiin VÄÄRÄSTÄ JÄRVESTÄ ilman että se näkyi missään
   Sama asia kahdessa paikassa valittavana on se virhe jota olemme purkaneet
   koko projektin. Nyt sovelluksen valinta ohjaa, ja kartan valitsin jää
   käsikäyttöön vertailua varten. */
function akSovitaPaikkaan(){
  var nimi = (typeof currentLocation === 'object' && currentLocation && currentLocation.name)
             ? currentLocation.name : '';
  /* "Hirvijärven tekoallas" ja "Hirvijärven tekojärvi" ovat sama paikka eri nimellä, joten
     akAvainNimelle vertaa alkuosaa eikä koko merkkijonoa (v179: sama sääntö tilannekuvalle). */
  return akAvainNimelle(nimi);
}
window.akPaivitaPaikka = function(){
  var k = akSovitaPaikkaan();
  if(k && val.value !== k){ val.value = k; lataa(k); }
};

var eka = (window.akAlkuJarvi && JARVET[window.akAlkuJarvi] ? window.akAlkuJarvi : null)   // v179: tilannekuva kertoo järven
  || akSovitaPaikkaan()
  || Object.keys(JARVET).filter(function(k){
       return JARVET[k].kartta && JARVET[k].kartta.maski;
     })[0] || Object.keys(JARVET)[0];
val.value = eka;
lataa(eka);
}
