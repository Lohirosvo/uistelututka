/* LÄMPÖMALLI v235 (Hannu 26.10.2026: "Virtausten aiheuttama lämpösiirtymä ja kasautuminen voisi näkyä että
   ymmärtää missä sitä lämpötilaa olisi paksummin"; tunneittain kuten muut tilannekuvan osat; mukautuva asteikko).
   Pintaveden lämpötila ruuduittain (karkeistettu noin 100 m ruutuun), tunnin askelin säähistoriasta ennusteen loppuun.
   KÄYTÖSSÄ (oletus):
     1) LÄMPÖTASE ruudun omalla lämpötilalla: auringon säteily, pitkäaaltosäteily (Brutsaert, pilvet Crawford & Duchon),
        tuntuva ja latentti lämpö (bulkkikaavat). Ruudun sekoittuva kerros = syvyys (sekoittunut vesi) tai tuulen mukainen
        pintakerros (kerrostunut kausi) + pohjasedimentin varasto 0,5 m. Matala vesi reagoi nopeammin kuin syvä.
     2) PÄIVÄN PINTAKERROS: tyynellä ja auringossa lämpö jää ohueen pintaan (0,3–2 m), sekoittuu tuulessa ja yöllä.
     3) KASAUTUMINEN (paksuus, vain viivoitukseen): pintavirran konvergenssi painaa pintavettä alas (alatuulen rannat,
        mataloituva pohja), divergenssi nostaa alempaa vettä. Painuma D (m) kertyy ja purkautuu vuorokauden aikavakiolla.
   TESTATTU 26.10.2026 (Landsat 8/9 -pintalämpö, SYKE, 53 pilvetöntä kuvaa Lappajärveltä 2014–2026, malli ajettu
   10 vrk Open-Meteon säähistorialla ennen kuvaa; luku = paikkapoikkeamien korrelaatio, 1 = täysi osuma, 0 = ei mitään):
     tämä malli: kevät 0,34 (15 kuvaa, 13 osui oikeaan suuntaan), kesä 0,16 (18, 14), syys 0,34 (20, 16),
     25.9.–31.10. 0,50 (8, 7). Sama ilman päivän pintakerrosta lähes sama (0,34 / 0,17 / 0,31).
     Virtausten siirto, tuulen suoja ja kerroksen kumpuaminen lämpötilassa mukana: kevät 0,14, kesä 0,05, syys 0,00
     → pois käytöstä (asetukset virrat, suoja, kerros jäävät kokeiluun). Kasautuminen D vs. satelliitin poikkeama
     syvyysluokan keskiarvon jälkeen: kevät +0,10 (12/15 positiivisia), kesä +0,11 (13/18), syys −0,06 (8/20),
     25.9.–31.10. −0,11 (2/8): kesällä kasautumiskohdat hieman lämpimämpiä, myöhään syksyllä hieman kylmempiä.
     Hannun luotaimen lämpöjäljet 11.–25.10.2026: syvyysluokkien ero oikeaan suuntaan 11.10. ja 23.10., liioiteltu 11.10.
   OLETUKSET (ei mitattu): kerrostuneisuus kuukauden mukaan (kesä–elo 1, touko ja syys 0,5, muuten 0,1), kesän
   pintakerros 3–12 m tuulen mukaan, painuman aikavakio 24 h, pintavirran kerros 0,5 m, kasautumisvyöhyke 500 m,
   sivusekoitus 1 + 0,5·U m²/s. Tulos on suunta (lämpimin–kylmin), ei tarkka aste. */
(function (root) {
  'use strict';
  var SIGMA = 5.67e-8, RHO_W = 1000, CP_W = 4186, RHO_A = 1.25, CP_A = 1005, LV = 2.45e6, CH = 1.3e-3, CE = 1.3e-3;
  var KITKA_R = 1e-3, CD = 1.3e-3;

  function kausi(kk) {   // kerrostuneisuuden paino s (oletus, ks. yllä)
    return (kk >= 6 && kk <= 8) ? 1 : (kk === 5 || kk === 9) ? 0.5 : 0.1;
  }

  /* Karkeistus: f×f hienoa ruutua yhdeksi (noin 100 m). Vesiruutu, jos yksikin hieno ruutu on vettä. */
  function ruudukko(k, mask, syv, kohde) {
    var f = Math.max(1, Math.round((kohde || 100) / k.ruutu)), W = k.W, H = k.H;
    var Wc = Math.ceil(W / f), Hc = Math.ceil(H / f), Nc = Wc * Hc;
    var n = new Float32Array(Nc), s = new Float32Array(Nc), map = new Int32Array(W * H).fill(-1);
    for (var j = 0; j < H; j++) for (var i = 0; i < W; i++) {
      var q = j * W + i; if (!mask[q]) continue;
      var c = ((j / f) | 0) * Wc + ((i / f) | 0); map[q] = c; n[c]++; s[c] += syv[q] > 0 ? syv[q] : 0.5;
    }
    var m = new Uint8Array(Nc), h = new Float32Array(Nc), vesi = [];
    for (var c2 = 0; c2 < Nc; c2++) if (n[c2] > 0) { m[c2] = 1; h[c2] = Math.max(0.5, s[c2] / n[c2]); vesi.push(c2); }
    var hk = 0; for (var v = 0; v < vesi.length; v++) hk += h[vesi[v]];
    return { f: f, W: Wc, H: Hc, dx: k.ruutu * f, mask: m, h: h, vesi: Int32Array.from(vesi), map: map, Wf: W, Hf: H,
             hKesk: vesi.length ? hk / vesi.length : 7, suoja: {}, pohjat: null };
  }

  /* Pyyhkäisymatka ylätuuleen (m), 10° välein välimuistissa. */
  function ylatuuli(cg, tuuliDir) {
    var a = (Math.round(tuuliDir / 10) * 10 + 360) % 360;
    if (cg.suoja[a]) return cg.suoja[a];
    var rad = a * Math.PI / 180, sx = Math.sin(rad), sy = -Math.cos(rad);   // kohti tuulen tulosuuntaa (j kasvaa etelään)
    var W = cg.W, H = cg.H, out = new Float32Array(W * H), maxA = Math.ceil(5000 / cg.dx);
    for (var p = 0; p < cg.vesi.length; p++) {
      var q = cg.vesi[p], i = q % W, j = (q / W) | 0, st = 1;
      for (; st <= maxA; st++) {
        var ii = Math.round(i + sx * st), jj = Math.round(j + sy * st);
        if (ii < 0 || jj < 0 || ii >= W || jj >= H || !cg.mask[jj * W + ii]) break;
      }
      out[q] = (st - 0.5) * cg.dx;
    }
    cg.suoja[a] = out; return out;
  }

  /* Syvyyskeskiarvoinen tuulikierto (sama yhtälö kuin aaltomalli.js akKiertoPohjat), karkeassa ruudukossa. */
  function kiertoPohjat(cg) {
    if (cg.pohjat) return cg.pohjat;
    var W = cg.W, H = cg.H, mask = cg.mask, dx = cg.dx, r = KITKA_R, h = new Float64Array(W * H);
    for (var j0 = 0; j0 < H; j0++) for (var i0 = 0; i0 < W; i0++) {
      var q0 = j0 * W + i0; if (!mask[q0]) continue; var su = 0, cn = 0;
      for (var dj = -1; dj <= 1; dj++) for (var di = -1; di <= 1; di++) {
        var ii0 = i0 + di, jj0 = j0 + dj, qq0 = jj0 * W + ii0;
        if (ii0 >= 0 && ii0 < W && jj0 >= 0 && jj0 < H && mask[qq0]) { su += cg.h[qq0]; cn++; }
      }
      h[q0] = Math.max(1, su / cn);
    }
    var vesi = cg.vesi, N = vesi.length, idx = new Int32Array(W * H).fill(-1);
    for (var p0 = 0; p0 < N; p0++) idx[vesi[p0]] = p0;
    var nb = new Int32Array(N * 4).fill(-1), af = new Float64Array(N * 4), sum = new Float64Array(N);
    var A = function (q) { return r / (h[q] * h[q]); };
    for (var p = 0; p < N; p++) {
      var q = vesi[p], i = q % W, j = (q / W) | 0, nn = [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]];
      for (var k = 0; k < 4; k++) {
        var ii = nn[k][0], jj = nn[k][1], qq = jj * W + ii;
        if (ii < 0 || ii >= W || jj < 0 || jj >= H || !mask[qq]) af[p * 4 + k] = A(q);
        else { nb[p * 4 + k] = idx[qq]; af[p * 4 + k] = 0.5 * (A(q) + A(qq)); }
        sum[p] += af[p * 4 + k];
      }
    }
    var gx = new Float64Array(N), gy = new Float64Array(N);
    for (var p2 = 0; p2 < N; p2++) {
      var c = 1 / h[vesi[p2]], arv = [];
      for (var k2 = 0; k2 < 4; k2++) { var n2 = nb[p2 * 4 + k2]; arv.push(n2 >= 0 ? 1 / h[vesi[n2]] : null); }
      var e = arv[0], w = arv[1], s = arv[2], n = arv[3];
      gx[p2] = (e !== null && w !== null) ? (e - w) / (2 * dx) : e !== null ? (e - c) / dx : w !== null ? (c - w) / dx : 0;
      gy[p2] = (n !== null && s !== null) ? (n - s) / (2 * dx) : n !== null ? (n - c) / dx : s !== null ? (c - s) / dx : 0;
    }
    function ratkaise(tx, ty) {
      var psi = new Float64Array(N), rhs = new Float64Array(N);
      for (var p = 0; p < N; p++) rhs[p] = (ty * gx[p] - tx * gy[p]) * dx * dx;
      var omega = Math.min(1.97, Math.max(1.9, 2 / (1 + Math.PI / Math.sqrt(N))));
      for (var it = 0; it < 12000; it++) {
        var muutos = 0, suurin = 1e-30;
        for (var p3 = 0; p3 < N; p3++) {
          var o = p3 * 4, s2 = 0;
          for (var k3 = 0; k3 < 4; k3++) { var n3 = nb[o + k3]; if (n3 >= 0) s2 += af[o + k3] * psi[n3]; }
          var d = (s2 - rhs[p3]) / sum[p3] - psi[p3];
          psi[p3] += omega * d;
          var ad = d < 0 ? -d : d; if (ad > muutos) muutos = ad;
          var ap = psi[p3] < 0 ? -psi[p3] : psi[p3]; if (ap > suurin) suurin = ap;
        }
        if (muutos < 1e-6 * suurin) break;
      }
      var ue = new Float32Array(W * H), un = new Float32Array(W * H);
      for (var p4 = 0; p4 < N; p4++) {
        var P = function (k4) { var n4 = nb[p4 * 4 + k4]; return n4 >= 0 ? psi[n4] : 0; };
        var q4 = vesi[p4], dPx = (P(0) - P(1)) / (2 * dx), dPy = (P(3) - P(2)) / (2 * dx);
        ue[q4] = -dPy / h[q4]; un[q4] = dPx / h[q4];
      }
      return { ue: ue, un: un };
    }
    cg.pohjat = { ita: ratkaise(1, 0), pohjoinen: ratkaise(0, 1) };
    return cg.pohjat;
  }

  function hoyry(T) { return 6.112 * Math.exp(17.62 * T / (243.12 + T)); }   // hPa

  /* Ajo. saa: [{ t (ms), ta, td, cc (%), sw (W/m²), ws (m/s), wd (°, mistä) }] tasatunneittain.
     o: { T0 (°C), tallenna: [ms...] (hetket, joista kentät talteen; puuttuu = kaikki), kuukausi(ms) → 1..12,
          pintakerros (true), virrat / suoja / kerros (false, ks. testi), Kh (null = 1 + 0,5·U), int16 (kentät ×100) }
     → { hetket, T: [Float32Array tai Int16Array ×100], D: [...], keski: [°C] }
     aloita() palauttaa vaiheittain ajettavan tilan (puhelimessa käyttöliittymä ei jäädy): Z.jatka(tunteja) → valmis? */
  function aloita(cg, saa, o) {
    o = o || {};
    var W = cg.W, H = cg.H, N = W * H, vesi = cg.vesi, nv = vesi.length, dx = cg.dx, dt = 3600, mask = cg.mask, h = cg.h;
    var adv = !!o.virrat, pin = !!o.virrat, suo = !!o.suoja, ker = !!o.kerros;   // v235: oletuksena pois (testi yllä)
    var B = adv ? kiertoPohjat(cg) : null;
    var T = new Float64Array(N), T2 = new Float64Array(N), D = new Float64Array(N), C = new Float64Array(N), C2 = new Float64Array(N);
    var rC = Math.max(1, Math.round(250 / dx)), hS = (o.hs != null ? o.hs : 0.5);
    var ue = new Float64Array(N), un = new Float64Array(N), se = new Float64Array(N), sn = new Float64Array(N);
    var dT = new Float64Array(N), dTv = new Float64Array(N), pinta = o.pintakerros !== false;
    for (var p = 0; p < nv; p++) T[vesi[p]] = o.T0;
    var ae = 0, an = 0, U24 = [], tallenna = {}, tulos = { hetket: [], T: [], D: [], keski: [], W: W, H: H };
    (o.tallenna || []).forEach(function (ms) { tallenna[Math.round(ms / 3600e3)] = true; });
    var kaikki = !o.tallenna;
    var relaks = 1 - Math.exp(-dt * KITKA_R / cg.hKesk), i16 = !!o.int16;
    function askel(n) {
      var S = saa[n], U = Math.max(0, S.ws || 0), kk = o.kuukausi ? o.kuukausi(S.t) : new Date(S.t).getMonth() + 1;
      var s = o.s != null ? o.s : kausi(kk);
      U24.push(U); if (U24.length > 24) U24.shift();
      var Um = 0; for (var u = 0; u < U24.length; u++) Um += U24[u]; Um /= U24.length;
      var Hstrat = Math.max(3, Math.min(12, 2 + 0.6 * Um));
      // 1) tuulikierron kehittyminen (aikavakio keskisyvyys / r)
      var to = (S.wd + 180) * Math.PI / 180, tau = RHO_A / RHO_W * CD * U * U;
      ae += (tau * Math.sin(to) - ae) * relaks; an += (tau * Math.cos(to) - an) * relaks;
      // pintavirta (sama kaava kuin aaltomalli.js akPintavirtaKentta), suunta tuulen alapuolelle +15°
      var vs = (S.wd + 180 + 15) * Math.PI / 180, vx = Math.sin(vs), vy = Math.cos(vs);
      var F = ylatuuli(cg, S.wd);
      for (var p1 = 0; p1 < nv; p1++) {
        var q1 = vesi[p1], hq = h[q1];
        var syvK = 1.0 + (5.0 - Math.min(hq, 5.0)) * 0.15, pyyK = 0.4 + 0.6 * Math.min(1, F[q1] / 3000);
        var sv = U * 0.02 * syvK * pyyK;
        se[q1] = sv * vx; sn[q1] = sv * vy;
        ue[q1] = 0; un[q1] = 0;
        if (B) { ue[q1] = ae * B.ita.ue[q1] + an * B.pohjoinen.ue[q1]; un[q1] = ae * B.ita.un[q1] + an * B.pohjoinen.un[q1]; }
        if (pin) { ue[q1] += 0.25 * s * se[q1]; un[q1] += 0.25 * s * sn[q1]; }
      }
      // 2) pintavirran konvergenssi → painuma D (kasautuminen); rannalla ei virtausta läpi
      for (var p2 = 0; p2 < nv; p2++) {
        var q2 = vesi[p2], i2 = q2 % W, j2 = (q2 / W) | 0, ulos = 0;
        // itä (i+1), länsi (i-1), etelä (j+1: pohjoiskomponentti negatiivinen), pohjoinen (j-1)
        if (i2 + 1 < W && mask[q2 + 1]) ulos += 0.5 * (se[q2] + se[q2 + 1]);
        if (i2 - 1 >= 0 && mask[q2 - 1]) ulos -= 0.5 * (se[q2] + se[q2 - 1]);
        if (j2 + 1 < H && mask[q2 + W]) ulos -= 0.5 * (sn[q2] + sn[q2 + W]);
        if (j2 - 1 >= 0 && mask[q2 - W]) ulos += 0.5 * (sn[q2] + sn[q2 - W]);
        C[q2] = -ulos / dx;   // 1/s, + = kasautuu
      }
      /* Rannan kasautuminen ja kumpuaminen jakautuvat noin 500 m levyiselle vyöhykkeelle (ei yhteen ruutuun):
         liukuva keskiarvo vesiruuduista. */
      for (var p2b = 0; p2b < nv; p2b++) {
        var q2b = vesi[p2b], i2b = q2b % W, j2b = (q2b / W) | 0, smC = 0, nC = 0;
        for (var b2 = -rC; b2 <= rC; b2++) for (var a2 = -rC; a2 <= rC; a2++) {
          var ii2 = i2b + a2, jj2 = j2b + b2; if (ii2 < 0 || jj2 < 0 || ii2 >= W || jj2 >= H) continue;
          var qq2 = jj2 * W + ii2; if (!mask[qq2]) continue; smC += C[qq2]; nC++;
        }
        C2[q2b] = nC ? smC / nC : 0;
      }
      var hajo = Math.exp(-dt / (24 * 3600)), summa = 0, sumN = 0;
      for (var p3 = 0; p3 < nv; p3++) summa += T[vesi[p3]];
      var Tk = summa / nv, Talus = Math.max(4, o.T0 - 8 * s);   // alusvesi: lähtölämmöstä, ei muutu ajossa (oletus)
      // 3) lämpötase
      var TaK = S.ta + 273.15, ea = hoyry(S.td), cc = Math.max(0, Math.min(1, (S.cc || 0) / 100));
      var epsA = cc + (1 - cc) * Math.min(1, 1.24 * Math.pow(ea / TaK, 1 / 7));   // Brutsaert, pilvet: Crawford & Duchon
      var LWin = 0.97 * epsA * SIGMA * Math.pow(TaK, 4), SWn = 0.93 * Math.max(0, S.sw || 0);
      for (var p4 = 0; p4 < nv; p4++) {
        var q4 = vesi[p4], hq4 = h[q4], w = C2[q4] * Math.min(hq4, hS);
        D[q4] = Math.max(-hq4, Math.min(hq4, D[q4] * hajo + w * dt));
        var Tw = T[q4], Uloc = suo ? U * (0.55 + 0.45 * Math.min(1, F[q4] / 3000)) : U, Ue = Math.max(1, Uloc);
        var Q = SWn + LWin - 0.97 * SIGMA * Math.pow(Tw + 273.15, 4) + RHO_A * CP_A * CH * Ue * (S.ta - Tw)
              + RHO_A * LV * CE * Ue * 0.622 / 1000 * (ea - hoyry(Tw));
        var Hmix = hq4 - s * (hq4 - Math.min(hq4, Hstrat));
        if (ker && D[q4] > 0) Hmix = Math.min(hq4, Hmix + D[q4]);
        if (Tw < 4 && Q < 0) Hmix = Math.min(Hmix, 1 + 0.5 * Uloc);   // käänteinen kerrostuminen syksyllä
        Hmix = Math.max(0.3, Hmix) + (o.hSed != null ? o.hSed : 0.5);   // pohjasedimentin lämpövarasto vesimetreinä (oletus)
        var Tn = Tw + Q * dt / (RHO_W * CP_W * Hmix);
        /* PÄIVÄN PINTAKERROS: tyynellä ja auringossa lämpö jää ohueen pintaan (0,3–2 m tuulen mukaan), joka sekoittuu
           tuulessa ja yöllä. Pinnan lisälämpö dT (pinta = kerroksen lämpö + dT); energia on jo kerroksessa (oletus). */
        if (pinta) {
          var hd = Math.min(Hmix, 0.3 + 0.35 * Uloc), dd0 = dT[q4];
          if (Q > 0 && hd < Hmix) dd0 += Q * dt / (RHO_W * CP_W) * (1 / hd - 1 / Hmix);
          dd0 *= Math.exp(-dt * (1 / (6 * 3600) + 1.1e-5 * Uloc * Uloc + (Q < 0 ? 1 / (2 * 3600) : 0)));
          dTv[q4] = dd0;
        }
        if (ker && s > 0.2 && w < 0) Tn += (Talus - Tn) * Math.min(1, -w * dt * s / Hmix);
        T2[q4] = Math.max(0, Tn);
      }
      if (pinta) for (var p4b = 0; p4b < nv; p4b++) dT[vesi[p4b]] = dTv[vesi[p4b]];
      // 4) siirto (puolilagrangelainen, bilineaarinen vesiruuduista)
      if (adv || pin) {
        for (var p5 = 0; p5 < nv; p5++) {
          var q5 = vesi[p5], x = (q5 % W) - ue[q5] * dt / dx, y = ((q5 / W) | 0) + un[q5] * dt / dx;
          var x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, sm = 0, pw = 0;
          for (var b = 0; b < 2; b++) for (var a = 0; a < 2; a++) {
            var xi = x0 + a, yi = y0 + b; if (xi < 0 || yi < 0 || xi >= W || yi >= H) continue;
            var qq = yi * W + xi; if (!mask[qq]) continue;
            var pp = (a ? fx : 1 - fx) * (b ? fy : 1 - fy); sm += pp * T2[qq]; pw += pp;
          }
          T[q5] = pw > 1e-6 ? sm / pw : T2[q5];
        }
      } else { for (var p6 = 0; p6 < nv; p6++) T[vesi[p6]] = T2[vesi[p6]]; }
      // 5) sivusekoitus (eksplisiittinen, osa-askelin)
      var Kh = (o.Kh != null) ? o.Kh : 1 + 0.5 * U, lam = Kh * dt / (dx * dx), nsub = Math.max(1, Math.ceil(lam / 0.2)), l1 = lam / nsub;
      for (var sb = 0; sb < nsub; sb++) {
        for (var p7 = 0; p7 < nv; p7++) {
          var q7 = vesi[p7], i7 = q7 % W, j7 = (q7 / W) | 0, Tq = T[q7], dd = 0;
          if (i7 + 1 < W && mask[q7 + 1]) dd += T[q7 + 1] - Tq;
          if (i7 - 1 >= 0 && mask[q7 - 1]) dd += T[q7 - 1] - Tq;
          if (j7 + 1 < H && mask[q7 + W]) dd += T[q7 + W] - Tq;
          if (j7 - 1 >= 0 && mask[q7 - W]) dd += T[q7 - W] - Tq;
          T2[q7] = Tq + l1 * dd;
        }
        for (var p8 = 0; p8 < nv; p8++) T[vesi[p8]] = T2[vesi[p8]];
      }
      var tunti = Math.round(S.t / 3600e3);
      if (kaikki || tallenna[tunti]) {
        var Tf = i16 ? new Int16Array(N) : new Float32Array(N), Df = i16 ? new Int16Array(N) : new Float32Array(N), ks = 0;
        for (var p9 = 0; p9 < nv; p9++) {
          var q9 = vesi[p9], tv = T[q9] + dT[q9]; ks += tv;
          if (i16) { Tf[q9] = Math.round(tv * 100); Df[q9] = Math.round(D[q9] * 100); } else { Tf[q9] = tv; Df[q9] = D[q9]; }
        }
        tulos.hetket.push(S.t); tulos.T.push(Tf); tulos.D.push(Df); tulos.keski.push(ks / nv);
      }
    }
    var Z = { n: 0, tulos: tulos, valmis: saa.length === 0 };
    Z.jatka = function (max) {
      var loppu = Math.min(saa.length, Z.n + (max || saa.length));
      for (; Z.n < loppu; Z.n++) askel(Z.n);
      Z.valmis = Z.n >= saa.length; return Z.valmis;
    };
    return Z;
  }
  function aja(cg, saa, o) { var Z = aloita(cg, saa, o); Z.jatka(); return Z.tulos; }
  /* Taustalla: tunteja kerrallaan setTimeoutilla. peru() lopettaa (järvi tai ennuste vaihtui). */
  function ajaVaiheittain(cg, saa, o, valmis, virhe, kerralla) {
    var Z = aloita(cg, saa, o), perutt = false;
    function tick() {
      if (perutt) return;
      try { if (Z.jatka(kerralla || 12)) valmis(Z.tulos); else setTimeout(tick, 0); }
      catch (e) { if (virhe) virhe(e); }
    }
    setTimeout(tick, 0);
    return { peru: function () { perutt = true; }, tila: Z };
  }

  /* Karkea kenttä hienoon ruudukkoon (bilineaarinen vesiruuduista; piirtoa ja napautusta varten). */
  function hienoksi(cg, kentta, qFine) {
    var Wf = cg.Wf, i = qFine % Wf, j = (qFine / Wf) | 0, f = cg.f;
    var x = (i + 0.5) / f - 0.5, y = (j + 0.5) / f - 0.5, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    var sm = 0, pw = 0;
    for (var b = 0; b < 2; b++) for (var a = 0; a < 2; a++) {
      var xi = x0 + a, yi = y0 + b; if (xi < 0 || yi < 0 || xi >= cg.W || yi >= cg.H) continue;
      var q = yi * cg.W + xi; if (!cg.mask[q]) continue;
      var p = (a ? fx : 1 - fx) * (b ? fy : 1 - fy); sm += p * kentta[q]; pw += p;
    }
    if (pw > 1e-6) return sm / pw;
    var c = cg.map[qFine]; return c >= 0 ? kentta[c] : NaN;
  }

  var LM = { ruudukko: ruudukko, kiertoPohjat: kiertoPohjat, aloita: aloita, aja: aja, ajaVaiheittain: ajaVaiheittain, hienoksi: hienoksi, kausi: kausi, ylatuuli: ylatuuli };
  if (typeof module !== 'undefined' && module.exports) module.exports = LM;
  root.LampoMalli = LM;
})(typeof window !== 'undefined' ? window : globalThis);
