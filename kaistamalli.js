/* ===== UISTELUTUTKA — TAIMENEN JA JÄRVILOHEN PENKKAKAISTAT (kaistamalli.js, v237) =====
   Hannu 27.10.2026: "Tee 1 % Lappajärven pinta-alasta 100 m leveät kaistat / pätkät, josta 20 % on järvilohelle hetkellä
   parhaaksi arvioitu penkka, loput taimenelle parhaat penkan pätkät. Tämä uusimpaan tilannekuvan lämpökarttaan. Käytä kaikkea
   saatavilla olevaa dataa. Eri värit ja tummemmalla kun on parasta ja haaleammalla kun arvio ei niin varma."
   Toteutus: kaistat ovat syvyyskäyrän (penkan) suuntaisia pätkiä, 100 m leveitä, yhteensä 1 % järven alasta (Lappajärvi
   145,2 km² → 14,5 km; taimen 80 % = 11,6 km, järvilohi 20 % = 2,9 km). Lasketaan tunneittain tunnin tuulella ja lämpömallin
   kentällä (Lämpö (malli) -tila), joten kaistat vaihtuvat tunnin mukana kuten väri ja jyrkimmän muutoksen viivat.

   TAIMEN, ruudun pisteet S = syvyys × (0,25 penkka + 0,35 kivikko + 0,20 tuuli + 0,10 lämpö + 0,10 saalis):
     syvyys   viileä vesi (järven keskilämpö ≤ 13 °C): huippu 3 m (Hannu: syksyn taimenet 1,2–4 m:ssä, kivikko 0–5 m);
              lämmin (≥ 17 °C): huippu 8 m (päättely: kasvu loppuu 19,5 °C:ssa, Lightfoot & Solomon 2008; syvänteen alusvesi
              vähähappinen, Sivil 2007); väliltä liukuen. Log-normaali leveys 0,45 / 0,35.
     penkka   kaltevuus 0,25 → 2 m / 100 m (sovelluksen pehmennetty syvyys, oma luotaus mukana).
     kivikko  sivukeilan kivikko 50 m sisällä: tiheä 1, kivikko 0,85, harvakseltaan 0,6; sivukeila katsonut eikä kiviä 0,3;
              ei tietoa 0,5. Lämpimällä kaudella C-MAPin kova pohja (≥ 6 m) 0,8.
     tuuli    penkka tuulen yläpuolelta katsottuna päin (tuuli puskee syvältä matalalle) × aallokko (JONSWAP, ylätuulen
              pyyhkäisymatka): 0,5 ± 0,5. Alle 2,5 m/s 0,5 (tyyni, kuten kloonien tyynen sääntö).
     lämpö    lämpömallin poikkeama: viileällä kaudella lämpimämpi parempi (taimenen optimi 13 °C), lämpimällä viileämpi.
     saalis   oma taimensaalis 300 m:n etäisyyden painolla (paikkauskollisuus), 45 vrk:n sisällä täysi, vanhempi 0,6.
   JÄRVILOHI: syvyys 16 ± 4 m (Hannun Lintuselkä 15–20 m veneen alla), S = syvyys × (0,35 penkka (kaltevuus tai Lintuselän
     patti/penkka: 150 m sisällä nousu 3–10 m:iin) + 0,25 tuuli (penkan suuntainen, tuulenpuoleinen kylki) + 0,15 lohiepäilykaiut
     + 0,10 syöttikalaparvet (kaiut ja parvet ajoon suhteutettuna, Bayes-kutistus 20 min) + 0,15 lämpö). Käyrät 13–19 m.
   VARMUUS (värin tummuus): oma luotaus 100 m sisällä, sivukeila katsonut, oma saalis lähellä, ajettu alue (taimen);
     ajettu syvä alue, kova pohja ja kaiut (järvilohi). Tummuus = puolet sijoituksesta valittujen joukossa, puolet varmuudesta
     (3 tasoa); järvilohi enintään keskitaso (testi alla).
   KAISTAT: syvyyskäyrät pehmennetystä syvyydestä (taimen 2–5 m viileällä, 5–12 m lämpimällä; lohi 13–19 m), 25 m:n
     näytteet, pätkät joissa S ≥ kynnys (käyrien näytteiden 85 %:n piste, tarvittaessa alempi), 250–2000 m, paras ensin,
     vähintään 150 m muista kaistoista, yhteensä tavoite (viimeinen lyhennetään; vajaus enintään 100 m).
   TESTI 27.10.2026 (Hannun varmuuskopio 25.10., päivä kerrallaan pois: saman päivän saaliit, kaiut, parvet ja ajo eivät ole
     todisteina; lämpömalli lokakuun Open-Meteo-arkistolla, tuuli tunneittain):
     taimen, 9 omaa ottipaikkaa 4.–24.10.: 2 kaistalla (≤ 50 m), 6 alle 150 m:n päässä. Ajojäljen päivinä (7 saalista)
     5/7 alle 150 m, kun saman päivän ajosta (±4 h) samoina tunteina 46 % oli alle 150 m (odote 3,2; p ≈ 0,15); ottipaikka
     arvioitiin paremmaksi kuin keskimäärin 67 % saman päivän ajosta (p ≈ 0,06). Osatekijöistä kivikko erotteli parhaiten
     (75 %), saalisetäisyys ei lainkaan (52 %). Kivikon paino nostettiin 0,25 → 0,35 tämän ja Hannun säännön perusteella
     (yksi säätö samalla aineistolla, joten tulos on hieman optimistinen).
     järvilohi, 66 lohiepäilykaikua (iso kaiku ≥ 10 m:n vedessä välivedessä tai parven luona) 11.–24.10.: ei erottelukykyä
     (kaiun kohta arvioitiin paremmaksi kuin 51 % syvän veden ajosta; kaistalla 1/66). Kaiut olivat siellä missä ajettiin
     (pohja 10,8–17,6 m kuten ajo), ja eri päivien kaikukohdat vaihtelivat.
   EI MUKANA: happi syvyyksittäin (ei mittausta kesältä), valo ja kellonaika, purot. Malli on arvio, ei mittaus. */
(function(root){
  'use strict';
  var KM = { versio: 1 };
  var LOHI_SYV = 16, LOHI_LEV = 4, LOHI_TASOT = [13, 15, 17, 19];
  KM.PAINOT = { penkka: 0.25, kivi: 0.35, tuuli: 0.20, lampo: 0.10, saalis: 0.10 };
  KM.PAINOT_L = { penkka: 0.35, tuuli: 0.25, kaiku: 0.15, parvi: 0.10, lampo: 0.15 };
  function sm(x, a, b){ if (x <= a) return 0; if (x >= b) return 1; var t = (x - a)/(b - a); return t*t*(3 - 2*t); }
  function cl(x, a, b){ return x < a ? a : x > b ? b : x; }

  /* ---------- 1) Järven pohja (staattinen) ---------- */
  KM.pohja = function(o){
    var k = o.k, W = k.W, H = k.H, R = k.ruutu, n = W*H, mask = o.mask, s = o.s, sl = o.sl || o.s;
    var vesi = []; for (var q = 0; q < n; q++) if (mask[q]) vesi.push(q);
    // järvilohen maasto (sama sääntö kuin aaltomalli akLohiMaasto)
    var lohi = new Float32Array(n), lohiLaki = new Float32Array(n), lohiPatti = new Uint8Array(n), lgx = new Float32Array(n), lgy = new Float32Array(n);
    var rP = Math.max(1, Math.round(150/R)), rS = Math.max(1, Math.round(300/R)), rM = Math.max(1, Math.round(250/R));
    function onPatti(i, j, laki){
      for (var a = -rS; a <= rS; a++) for (var b = -rS; b <= rS; b++){
        var d2 = a*a + b*b; if (d2 > rS*rS) continue;
        var ii = i + a, jj = j + b;
        if (ii < 0 || jj < 0 || ii >= W || jj >= H || !mask[jj*W + ii]){ if (d2 <= rM*rM) return false; continue; }
        if (s[jj*W + ii] < laki - 1.5) return false;
      }
      return true;
    }
    for (var v = 0; v < vesi.length; v++){
      var q1 = vesi[v]; if (!(s[q1] >= 14 && s[q1] <= 21)) continue;
      var i = q1 % W, j = (q1/W)|0, laki = 99, lq = -1, syva = 0;
      for (var a = -rS; a <= rS; a++) for (var b = -rS; b <= rS; b++){
        var d2 = a*a + b*b; if (d2 > rS*rS) continue;
        var ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue;
        var q2 = jj*W + ii; if (!mask[q2]) continue;
        if (s[q2] > syva) syva = s[q2];
        if (d2 <= rP*rP && s[q2] >= 3 && s[q2] <= 10 && s[q2] < laki){ laki = s[q2]; lq = q2; }
      }
      if (lq < 0) continue;
      var e = (i+1 < W && mask[q1+1]) ? sl[q1+1] : sl[q1], w = (i > 0 && mask[q1-1]) ? sl[q1-1] : sl[q1];
      var sN = (j+1 < H && mask[q1+W]) ? sl[q1+W] : sl[q1], nN = (j > 0 && mask[q1-W]) ? sl[q1-W] : sl[q1];
      var gx = e - w, gy = nN - sN, gl = Math.sqrt(gx*gx + gy*gy);
      if (gl < 1e-6){ gx = i - lq % W; gy = ((lq/W)|0) - j; gl = Math.sqrt(gx*gx + gy*gy) || 1; }
      var patti = onPatti(lq % W, (lq/W)|0, s[lq]), lakiEtM = Math.sqrt(Math.pow(i - lq % W, 2) + Math.pow(j - ((lq/W)|0), 2))*R;
      lohi[q1] = 0.5 + (patti ? 0.15 : 0) + 0.15*cl((syva - 20)/10, 0, 1) + 0.1*cl(1 - (lakiEtM - 50)/150, 0, 1) + 0.1*Math.max(0, 1 - Math.abs(s[lq] - 6)/6);
      lohiLaki[q1] = s[lq]; lohiPatti[q1] = patti ? 1 : 0; lgx[q1] = gx/gl; lgy[q1] = gy/gl;
    }
    // laajennus: lohen ehdokas myös 100 m:n päässä maastoruudusta (kaistan käyrä kulkee ruutujen välistä)
    return { k: k, W: W, H: H, R: R, n: n, mask: mask, s: s, sl: sl, g: o.g, suunta: o.suunta, ranta: o.ranta,
             vesi: Int32Array.from(vesi), alaM2: vesi.length*R*R, lohi: lohi, lohiLaki: lohiLaki, lohiPatti: lohiPatti, lgx: lgx, lgy: lgy, fetch: {} };
  };

  KM.ruutu = function(B, lat, lon){
    var k = B.k, i = Math.floor((lon - k.lansiLon)*111320*Math.cos(lat*Math.PI/180)/B.R), j = Math.floor((k.pohjoisLat - lat)*111320/B.R);
    return (i < 0 || j < 0 || i >= B.W || j >= B.H) ? -1 : j*B.W + i;
  };
  KM.kohta = function(B, x, y){   // ruudukon koordinaatit (ruudun keskipiste = kokonaisluku) → [lat, lon]
    var k = B.k, la = k.pohjoisLat - (y + 0.5)*B.R/111320;
    return [la, k.lansiLon + (x + 0.5)*B.R/(111320*Math.cos(la*Math.PI/180))];
  };
  function levita(B, arr, q, r, f){   // f(q2, d2) ruuduille r:n säteellä
    var W = B.W, H = B.H, i = q % W, j = (q/W)|0;
    for (var a = -r; a <= r; a++) for (var b = -r; b <= r; b++){
      var d2 = a*a + b*b; if (d2 > r*r) continue;
      var ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue;
      var q2 = jj*W + ii; if (B.mask[q2]) f(q2, d2);
    }
  }

  /* ---------- 2) Oma aineisto (muuttuu tallenteiden ja saaliiden mukana) ---------- */
  // d: { kivikko [{lat, lon, taso}], kiviKatettu [[lat, lon]], ajo [[lat, lon]] (minuutin näytteet), kaiut [{lat, lon, luokka, pohja, lahella}],
  //      parvet [{lat, lon, pohja}], saaliit [{lat, lon, t, laji}], oma (ruudut, joissa oma luotaus) [q], kova Uint8Array|null, nyt ms }
  KM.todisteet = function(B, d){
    var n = B.n, R = B.R, kivi = new Int8Array(n).fill(-1), kat = new Uint8Array(n), eff = new Float32Array(n), omaL = new Uint8Array(n);
    var r50 = Math.max(1, Math.round(50/R)), r100 = Math.max(1, Math.round(100/R));
    (d.kiviKatettu || []).forEach(function(p){ var q = KM.ruutu(B, p[0], p[1]); if (q >= 0) levita(B, kat, q, r50, function(q2){ kat[q2] = 1; }); });
    (d.kivikko || []).forEach(function(x){ var q = KM.ruutu(B, x.lat, x.lon); if (q < 0) return; levita(B, kivi, q, r50, function(q2){ if (x.taso > kivi[q2]) kivi[q2] = x.taso; kat[q2] = 1; }); });
    (d.ajo || []).forEach(function(p){ var q = KM.ruutu(B, p[0], p[1]); if (q >= 0 && B.mask[q]) eff[q] += 1; });
    (d.oma || []).forEach(function(q){ if (q >= 0 && q < n) levita(B, omaL, q, r100, function(q2){ omaL[q2] = 1; }); });
    // ajo 150 m säteellä (minuuttia) ja syvän veden (≥ 10 m) kaiut ja parvet 300 m säteellä
    function summa(arr, r){
      var out = new Float32Array(n);
      for (var v = 0; v < B.vesi.length; v++){ var q = B.vesi[v]; if (arr[q]) levita(B, out, q, r, function(q2){ out[q2] += arr[q]; }); }
      return out;
    }
    var effL = summa(eff, Math.max(1, Math.round(150/R))), effS = summa(eff, Math.max(1, Math.round(300/R)));
    var kaiku = new Float32Array(n), parvi = new Float32Array(n), syvaEff = new Float32Array(n);
    for (var v = 0; v < B.vesi.length; v++){ var q0 = B.vesi[v]; if (B.s[q0] >= 10) syvaEff[q0] = eff[q0]; }
    (d.kaiut || []).forEach(function(e){
      if (e.luokka !== 'iso' || !(e.pohja >= 10) || (e.lahella !== 'vali' && e.lahella !== 'parvi')) return;
      var q = KM.ruutu(B, e.lat, e.lon); if (q >= 0 && B.mask[q]) kaiku[q] += 1;
    });
    (d.parvet || []).forEach(function(p){ if (!(p.pohja >= 10)) return; var q = KM.ruutu(B, p.lat, p.lon); if (q >= 0 && B.mask[q]) parvi[q] += 1; });
    var rS = Math.max(1, Math.round(300/R)), kaikuS = summa(kaiku, rS), parviS = summa(parvi, rS), syvaS = summa(syvaEff, rS);
    var sE = 0, sK = 0, sP = 0; for (var v2 = 0; v2 < B.vesi.length; v2++){ var q3 = B.vesi[v2]; sE += syvaEff[q3]; sK += kaiku[q3]; sP += parvi[q3]; }
    var nyt = d.nyt || Date.now(), saaliit = [];
    (d.saaliit || []).forEach(function(x){
      if (typeof x.lat !== 'number' || typeof x.lon !== 'number') return;
      var q = KM.ruutu(B, x.lat, x.lon); if (q < 0) return;
      var ika = (nyt - x.t)/86400e3; if (!(ika >= -1) || ika > 400) return;
      saaliit.push({ q: q, x: q % B.W, y: (q/B.W)|0, laji: x.laji, t: x.t, paino: ika <= 45 ? 1 : 0.6 });
    });
    return { kivi: kivi, kat: kat, eff: eff, effL: effL, oma: omaL, kaikuS: kaikuS, parviS: parviS, syvaS: syvaS,
             r0Kaiku: sE > 0 ? sK/sE : 0, r0Parvi: sE > 0 ? sP/sE : 0, syvaMin: sE, kaikuja: sK, parvia: sP,
             saaliit: saaliit, kova: d.kova || null, nyt: nyt };
  };

  /* ---------- 3) Ylätuulen pyyhkäisymatka (m), 10°:n lohkoittain välimuistiin ---------- */
  function pyyhkaisy(B, dir){
    var lohko = (Math.round(dir/10)*10) % 360; if (B.fetch[lohko]) return B.fetch[lohko];
    var W = B.W, H = B.H, a = lohko*Math.PI/180, dx = Math.sin(a), dy = -Math.cos(a), max = Math.round(12000/B.R), out = new Float32Array(B.n);
    for (var v = 0; v < B.vesi.length; v++){
      var q = B.vesi[v], x = q % W + 0.5, y = ((q/W)|0) + 0.5, d = 0;
      for (var st = 1; st <= max; st++){
        var i = Math.floor(x + dx*st), j = Math.floor(y + dy*st);
        if (i < 0 || j < 0 || i >= W || j >= H || !B.mask[j*W + i]) break; d = st;
      }
      out[q] = (d + 0.5)*B.R;
    }
    return B.fetch[lohko] = out;
  }

  /* ---------- 4) Tunnin pistekentät ---------- */
  // h: { U, dir (mistä), Tk (järven keskilämpö °C), kk (kuukausi 1–12), an (Float32Array poikkeama °C, keskiarvo 0) | null }
  KM.kentat = function(B, E, h){
    var n = B.n, W = B.W, R = B.R, ST = new Float32Array(n), VT = new Float32Array(n), SL = new Float32Array(n), VL = new Float32Array(n), P = h.painot || KM.PAINOT, PL = h.painotL || KM.PAINOT_L;
    var w = typeof h.Tk === 'number' ? sm(h.Tk, 13, 17) : (h.kk >= 6 && h.kk <= 8 ? 1 : (h.kk === 5 || h.kk === 9) ? 0.5 : 0);
    var lnC = Math.log(3)*(1 - w) + Math.log(8)*w, sig = 0.45*(1 - w) + 0.35*w;
    var U = typeof h.U === 'number' ? h.U : 0, dir = typeof h.dir === 'number' ? h.dir : 0, tuuliOn = U >= 2.5;
    var F = tuuliOn ? pyyhkaisy(B, dir) : null, kulku = (dir + 180) % 360;
    var wx = Math.sin(dir*Math.PI/180), wy = Math.cos(dir*Math.PI/180);
    var an = h.an || null, tSuunta = 1 - 2*w;
    var sT = E.saaliit.filter(function(c){ return c.laji === 'taimen'; }), r300 = 300/R;
    var osat = { syv: new Float32Array(n), penkka: new Float32Array(n), kivi: new Float32Array(n), tuuli: new Float32Array(n), lampo: new Float32Array(n), saalis: new Float32Array(n),
                 lMaasto: new Float32Array(n), lTuuli: new Float32Array(n), lKaiku: new Float32Array(n), lParvi: new Float32Array(n), an: new Float32Array(n) };
    for (var v = 0; v < B.vesi.length; v++){
      var q = B.vesi[v], s = B.s[q], g = B.g[q];
      // --- taimen ---
      var z = (Math.log(Math.max(0.3, s)) - lnC)/sig, Dd = Math.exp(-0.5*z*z)*sm(s, 0.6, 1.2);
      var Bk = sm(g, 0.25, 2.0);
      var kv = E.kivi[q], Kt = kv >= 3 ? 1 : kv === 2 ? 0.85 : kv === 1 ? 0.6 : E.kat[q] ? 0.3 : 0.5;
      if (w > 0.5 && E.kova && E.kova[q] && s >= 6) Kt = Math.max(Kt, 0.8);
      var Wt = 0.5;
      if (tuuliOn && g >= 0.3){
        var as = ((B.suunta[q] - kulku) % 360 + 540) % 360 - 180, on = -Math.cos(as*Math.PI/180);
        var hs = 0.0016*U*Math.sqrt(F[q]/9.81);
        Wt = 0.5 + 0.5*on*sm(hs, 0.02, 0.15);
      }
      var Tt = an ? 0.5 + 0.5*Math.tanh(an[q]/0.3)*tSuunta : 0.5;
      var Ct = 0, i = q % W, j = (q/W)|0;
      for (var c = 0; c < sT.length; c++){ var dx = i - sT[c].x, dy = j - sT[c].y, e = sT[c].paino*Math.exp(-0.5*(dx*dx + dy*dy)/(r300*r300)); if (e > Ct) Ct = e; }
      ST[q] = Dd*(P.penkka*Bk + P.kivi*Kt + P.tuuli*Wt + P.lampo*Tt + P.saalis*(0.4 + 0.6*Ct));
      VT[q] = 0.15 + 0.25*E.oma[q] + 0.25*(E.kat[q] ? 1 : 0) + 0.2*Ct + 0.15*(E.effL[q] >= 3 ? 1 : 0);
      osat.syv[q] = Dd; osat.penkka[q] = Bk; osat.kivi[q] = Kt; osat.tuuli[q] = Wt; osat.lampo[q] = Tt; osat.saalis[q] = Ct; osat.an[q] = an ? an[q] : 0;
      // --- järvilohi ---
      var Dl = sm(s, 8, 10)*Math.exp(-0.5*Math.pow((s - LOHI_SYV)/LOHI_LEV, 2));
      if (Dl > 0.05){
        var Wl = 0.5, gxl = Math.sin(B.suunta[q]*Math.PI/180), gyl = Math.cos(B.suunta[q]*Math.PI/180);   // syvenemissuunta (itä, pohjoinen)
        if (B.lohi[q] > 0){ gxl = B.lgx[q]; gyl = B.lgy[q]; }
        if (tuuliOn && (g >= 0.3 || B.lohi[q] > 0)){
          var kayra = (Math.atan2(gxl, gyl)*180/Math.PI + 450) % 180, ero = Math.abs(((dir % 180) - kayra + 180) % 180); if (ero > 90) ero = 180 - ero;
          var par = Math.cos(ero*Math.PI/180), kylki = Math.max(0, gxl*wx + gyl*wy);
          Wl = 0.4 + 0.35*par + 0.25*kylki;
        }
        var a0 = 20;   // Bayes-kutistus: 20 min ajoa järven keskimääräisellä tasolla
        var Ek = E.r0Kaiku > 0 ? (E.kaikuS[q] + a0*E.r0Kaiku)/(E.syvaS[q] + a0)/E.r0Kaiku : 1;
        var Pk = E.r0Parvi > 0 ? (E.parviS[q] + a0*E.r0Parvi)/(E.syvaS[q] + a0)/E.r0Parvi : 1;
        var Ekt = cl(0.5 + 0.25*Math.log(Ek)/Math.LN2, 0.2, 1), Pkt = cl(0.5 + 0.25*Math.log(Pk)/Math.LN2, 0.2, 1);
        var Bl = Math.max(sm(g, 0.3, 1.5), B.lohi[q]);
        SL[q] = Dl*(PL.penkka*Bl + PL.tuuli*Wl + PL.kaiku*Ekt + PL.parvi*Pkt + PL.lampo*Tt);
        VL[q] = 0.1 + 0.3*cl(E.syvaS[q]/30, 0, 1) + 0.15*(E.kova && E.kova[q] ? 1 : 0) + 0.15*E.oma[q] + 0.15*(Ekt >= 0.6 ? 1 : 0);
        osat.lMaasto[q] = Bl; osat.lTuuli[q] = Wl; osat.lKaiku[q] = Ekt; osat.lParvi[q] = Pkt;
      }
    }
    return { ST: ST, VT: VT, SL: SL, VL: VL, w: w, keskusM: Math.exp(lnC), osat: osat, tuuliOn: tuuliOn };
  };

  /* ---------- 5) Syvyyskäyrät (marching squares, ruutujen keskipisteet; maa = 0 m) polylinjoiksi ---------- */
  KM.kayrat = function(B, f, taso){
    var W = B.W, H = B.H, m = B.mask, seg = [];
    function val(i, j){ var q = j*W + i; return m[q] ? f[q] : 0; }
    for (var j = 0; j < H - 1; j++) for (var i = 0; i < W - 1; i++){
      var a = val(i, j), b = val(i+1, j), c = val(i+1, j+1), d = val(i, j+1);
      var t = (a >= taso ? 8 : 0) | (b >= taso ? 4 : 0) | (c >= taso ? 2 : 0) | (d >= taso ? 1 : 0);
      if (t === 0 || t === 15) continue;
      var ip = function(p, r){ return (taso - p)/((r - p) || 1e-9); };
      // reunat: y = ylä (a-b), o = oikea (b-c), a = ala (d-c), v = vasen (a-d); avain reunan mukaan, jotta palat liittyvät
      var Y = ['h' + (j*W + i), i + ip(a, b), j], O = ['v' + (j*W + i + 1), i + 1, j + ip(b, c)], A = ['h' + ((j + 1)*W + i), i + ip(d, c), j + 1], V = ['v' + (j*W + i), i, j + ip(a, d)];
      var keski = (a + b + c + d)/4 >= taso;
      switch (t){
        case 1: case 14: seg.push([V, A]); break;
        case 2: case 13: seg.push([A, O]); break;
        case 3: case 12: seg.push([V, O]); break;
        case 4: case 11: seg.push([Y, O]); break;
        case 6: case 9: seg.push([Y, A]); break;
        case 7: case 8: seg.push([V, Y]); break;
        case 5: if (keski){ seg.push([V, Y]); seg.push([A, O]); } else { seg.push([V, A]); seg.push([Y, O]); } break;
        case 10: if (keski){ seg.push([Y, O]); seg.push([V, A]); } else { seg.push([V, Y]); seg.push([A, O]); } break;
      }
    }
    // liitä palat reunapisteiden kautta
    var kart = {}; seg.forEach(function(s2, n){ [0, 1].forEach(function(e){ var key = s2[e][0]; (kart[key] || (kart[key] = [])).push(n); }); });
    var kaytetty = new Uint8Array(seg.length), out = [];
    function seuraava(key, ei){ var L = kart[key] || []; for (var z = 0; z < L.length; z++) if (L[z] !== ei && !kaytetty[L[z]]) return L[z]; return -1; }
    for (var s0 = 0; s0 < seg.length; s0++){
      if (kaytetty[s0]) continue; kaytetty[s0] = 1;
      var p = [[seg[s0][0][1], seg[s0][0][2]], [seg[s0][1][1], seg[s0][1][2]]], paa = seg[s0][1][0], hanta = seg[s0][0][0], ed = s0, nx;
      while ((nx = seuraava(paa, ed)) >= 0){ kaytetty[nx] = 1; var S2 = seg[nx], toinen = S2[0][0] === paa ? S2[1] : S2[0]; p.push([toinen[1], toinen[2]]); paa = toinen[0]; ed = nx; }
      ed = s0;
      while ((nx = seuraava(hanta, ed)) >= 0){ kaytetty[nx] = 1; var S3 = seg[nx], toinen2 = S3[0][0] === hanta ? S3[1] : S3[0]; p.unshift([toinen2[1], toinen2[2]]); hanta = toinen2[0]; ed = nx; }
      out.push(p);
    }
    return out;
  };
  function naytteet(p, ds){   // tasavälinen uudelleennäytteistys (ruutuina)
    var out = [p[0].slice()], jaljella = ds;
    for (var u = 1; u < p.length; u++){
      var A = p[u-1], Bp = p[u], d = Math.hypot(Bp[0] - A[0], Bp[1] - A[1]), t = 0;
      while (d - t >= jaljella){ t += jaljella; out.push([A[0] + (Bp[0] - A[0])*t/d, A[1] + (Bp[1] - A[1])*t/d]); jaljella = ds; }
      jaljella -= (d - t);
    }
    return out;
  }

  function kayraNaytteet(B, taso, ds){   // käyrät ja 25 m:n näytteet ruutuineen (staattinen: syvyys ei muutu tunnista toiseen)
    var VM = B.kayraVM || (B.kayraVM = {}), key = taso + '|' + ds; if (VM[key]) return VM[key];
    var W = B.W, out = [];
    KM.kayrat(B, B.sl, taso).forEach(function(p){
      var N = naytteet(p, ds); if (N.length < 3) return;
      var Q = new Int32Array(N.length);
      for (var u = 0; u < N.length; u++){ var q = Math.round(N[u][1])*W + Math.round(N[u][0]); Q[u] = (q >= 0 && q < B.n && B.mask[q]) ? q : -1; }
      out.push({ N: N, Q: Q });
    });
    return VM[key] = out;
  }

  /* ---------- 6) Kaistojen valinta ---------- */
  function valitse(B, Sk, Vk, tasot, tavoiteM, varattu, o){
    var W = B.W, R = B.R, ds = 25/R, Lmin = (o.minM || 250)/R, Lmax = (o.maxM || 2000)/R, vali = (o.valiM || 150)/R;
    var ehd = [], arvot = [];
    tasot.forEach(function(taso){
      kayraNaytteet(B, taso, ds).forEach(function(c){
        var Q = c.Q, S = new Array(Q.length), V = new Array(Q.length);
        for (var u = 0; u < Q.length; u++){ var q = Q[u]; S[u] = q >= 0 ? Sk[q] : -1; V[u] = q >= 0 ? Vk[q] : 0; if (S[u] > 0) arvot.push(S[u]); }
        ehd.push({ taso: taso, N: c.N, Q: c.Q, S: S, V: V });
      });
    });
    if (!arvot.length) return [];
    arvot.sort(function(a, b){ return a - b; });
    var kv = function(p){ return arvot[Math.min(arvot.length - 1, Math.floor(p*(arvot.length - 1)))]; };
    var valitut = [], yht = 0, kynnykset = [0.85, 0.75, 0.65, 0.5, 0.35, 0.2, 0];
    function vapaa(pt){ var i = Math.round(pt[0]), j = Math.round(pt[1]), r = Math.ceil(vali);
      for (var a = -r; a <= r; a++) for (var b = -r; b <= r; b++){ if (a*a + b*b > vali*vali) continue; var key = (j + b)*W + (i + a); if (varattu[key]) return false; } return true; }
    function varaa(N){ N.forEach(function(pt){ varattu[Math.round(pt[1])*W + Math.round(pt[0])] = 1; }); }
    for (var kk = 0; kk < kynnykset.length && yht < tavoiteM/R - 1e-6; kk++){
      var thr = kv(kynnykset[kk]), pal = [];
      ehd.forEach(function(c){
        var alku = -1;
        for (var u = 0; u <= c.S.length; u++){
          var ok = u < c.S.length && c.S[u] >= thr;
          if (ok && alku < 0) alku = u;
          if (!ok && alku >= 0){
            // pitkä pätkä jaetaan peräkkäisiin enintään Lmax:n ikkunoihin
            var a0 = alku, b0 = u - 1, nW = Math.round(Lmax/ds) + 1;
            for (var st = a0; st <= b0; st += nW){
              var e0 = Math.min(b0, st + nW - 1); if ((e0 - st)*ds < Lmin) continue;
              var sum = 0; for (var z = st; z <= e0; z++) sum += c.S[z];
              pal.push({ c: c, a: st, b: e0, ka: sum/(e0 - st + 1) });
            }
            alku = -1;
          }
        }
      });
      pal.sort(function(x, y){ return y.ka - x.ka; });
      for (var n = 0; n < pal.length && yht < tavoiteM/R - 1e-6; n++){
        var P = pal[n], c2 = P.c, parasA = -1, parasB = -1, a1 = -1;
        // pisin vapaa osa
        for (var u2 = P.a; u2 <= P.b + 1; u2++){
          var ok2 = u2 <= P.b && vapaa(c2.N[u2]);
          if (ok2 && a1 < 0) a1 = u2;
          if (!ok2 && a1 >= 0){ if (u2 - 1 - a1 > parasB - parasA) { parasA = a1; parasB = u2 - 1; } a1 = -1; }
        }
        if (parasA < 0 || (parasB - parasA)*ds < Lmin) continue;
        var jal = tavoiteM/R - yht, pit = (parasB - parasA)*ds;
        if (pit > jal){
          if (jal < Lmin*0.6) { if (jal < 100/R) break; }
          var nW2 = Math.max(2, Math.round(jal/ds) + 1), ps2 = -1, pa2 = parasA, sum2 = 0;
          for (var z2 = parasA; z2 < parasA + nW2; z2++) sum2 += c2.S[z2];
          for (var st2 = parasA; st2 + nW2 - 1 <= parasB; st2++){ if (st2 > parasA) sum2 += c2.S[st2 + nW2 - 1] - c2.S[st2 - 1]; if (sum2 > ps2){ ps2 = sum2; pa2 = st2; } }
          parasA = pa2; parasB = pa2 + nW2 - 1; pit = (parasB - parasA)*ds;
        }
        var N2 = c2.N.slice(parasA, parasB + 1), S2 = c2.S.slice(parasA, parasB + 1), V2 = c2.V.slice(parasA, parasB + 1);
        varaa(N2); yht += pit;
        valitut.push({ p: N2, q: Array.prototype.slice.call(c2.Q, parasA, parasB + 1), taso: c2.taso, pituusM: Math.round(pit*R), S: S2.reduce(function(a, b){ return a + b; }, 0)/S2.length, V: V2.reduce(function(a, b){ return a + b; }, 0)/V2.length, kynnys: thr });
      }
    }
    return valitut;
  }

  KM.kaistat = function(B, E, h, o){
    o = o || {};
    var leveys = o.leveysM || 100, osuus = typeof o.osuus === 'number' ? o.osuus : 0.01, lohiOsuus = typeof o.lohiOsuus === 'number' ? o.lohiOsuus : 0.2;
    var tavoite = B.alaM2*osuus/leveys, tL = tavoite*lohiOsuus, tT = tavoite - tL;
    var K = KM.kentat(B, E, h), varattu = new Uint8Array(B.n);
    var w = K.w, tasotT = [];
    [1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 10, 12].forEach(function(t){ var z = (Math.log(t) - Math.log(K.keskusM))/(0.45*(1 - w) + 0.35*w); if (Math.exp(-0.5*z*z) >= 0.35) tasotT.push(t); });
    var lohi = valitse(B, K.SL, K.VL, LOHI_TASOT, tL, varattu, o);
    var lohiM = lohi.reduce(function(a, x){ return a + x.pituusM; }, 0);
    var taimen = valitse(B, K.ST, K.VT, tasotT, tT + Math.max(0, tL - lohiM), varattu, o);   // jos lohelle ei löydy tarpeeksi, loput taimenelle
    function tummuus(L){
      var jarj = L.slice().sort(function(a, b){ return b.S - a.S; });
      L.forEach(function(x){ var r = L.length > 1 ? 1 - jarj.indexOf(x)/(L.length - 1) : 1, z = 0.5*r + 0.5*x.V; x.tummuus = z >= 0.62 ? 3 : z >= 0.4 ? 2 : 1; x.pisteet = Math.round(100*x.S); x.varmuus = Math.round(100*x.V); });
    }
    tummuus(taimen); tummuus(lohi);
    lohi.forEach(function(x){ if (x.tummuus > 2) x.tummuus = 2; });   // järvilohen malli ei osunut omiin lohiepäilykaikuihin (testi v237): enintään keskitaso
    // perustelut: osatekijöiden keskiarvot kaistan ruuduissa (napautusteksti)
    function osat(L, nimet){ L.forEach(function(x){ var o2 = {}, nq = 0; nimet.forEach(function(nm){ o2[nm] = 0; });
      var smin = Infinity, smax = -Infinity, gk = 0;
      x.q.forEach(function(q){ if (q < 0) return; nq++; nimet.forEach(function(nm){ o2[nm] += K.osat[nm][q]; }); if (B.s[q] < smin) smin = B.s[q]; if (B.s[q] > smax) smax = B.s[q]; gk += B.g[q]; });
      nimet.forEach(function(nm){ o2[nm] = nq ? o2[nm]/nq : null; }); o2.syvMin = smin; o2.syvMax = smax; o2.kalt = nq ? gk/nq : null; x.osat = o2; }); }
    osat(taimen, ['syv', 'penkka', 'kivi', 'tuuli', 'lampo', 'saalis', 'an']); osat(lohi, ['lMaasto', 'lTuuli', 'lKaiku', 'lParvi', 'lampo', 'an']);
    taimen.forEach(function(x, n){ x.tunnus = 'T' + (n + 1); x.laji = 'taimen'; }); lohi.forEach(function(x, n){ x.tunnus = 'L' + (n + 1); x.laji = 'lohi'; });
    return { taimen: taimen, lohi: lohi, tavoiteM: Math.round(tavoite), tavoiteT: Math.round(tT), tavoiteL: Math.round(tL), kentat: K,
             pituusT: taimen.reduce(function(a, x){ return a + x.pituusM; }, 0), pituusL: lohiM, kausi: w, tasotT: tasotT };
  };

  /* Lähin kaista pisteelle (ruudukon koordinaatit) → { kaista, laji, etaisyysM } */
  KM.lahin = function(B, tulos, x, y){
    var paras = null, pe = Infinity;
    [['taimen', tulos.taimen], ['lohi', tulos.lohi]].forEach(function(L){
      L[1].forEach(function(kaista){ for (var u = 1; u < kaista.p.length; u++){
        var A = kaista.p[u-1], Bp = kaista.p[u], vx = Bp[0] - A[0], vy = Bp[1] - A[1], l2 = vx*vx + vy*vy, t = l2 ? Math.max(0, Math.min(1, ((x - A[0])*vx + (y - A[1])*vy)/l2)) : 0;
        var d = Math.hypot(x - A[0] - t*vx, y - A[1] - t*vy); if (d < pe){ pe = d; paras = { kaista: kaista, laji: L[0] }; } } });
    });
    return paras ? { kaista: paras.kaista, laji: paras.laji, etaisyysM: pe*B.R } : null;
  };

  if (typeof module === 'object' && module.exports) module.exports = KM;
  if (root) root.KaistaMalli = KM;
})(typeof window !== 'undefined' ? window : this);
