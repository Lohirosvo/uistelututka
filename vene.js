/* ===== UISTELUTUTKA — OMA VENE JA VANA (vene.js) =====
   v185 (10.10.2026): Hannu valitsi seuraavaksi "vene etusivun kartoille". Tilannekuvan v183 vene ja vana
   siirrettiin tänne sanasta sanaan, jotta aaltokortti, syvyyskartta ja tilannekuva piirtävät saman merkin
   samoilla säännöillä. Tilannekuvan kuva pysyy bitilleen samana (testattu).
   Alkuperäinen pyyntö (v183, Hannu 10.10.): "paikan ilmaista tälläisellä iconilla joka näyttää suunnan minne
   menossa, 50 m häntä olisi plussaa mistä tullut, pituus ei niin tarkka hahmottamiseen riittävä."

   VANA = oikea kuljettu GPS-reitti (ei piirretty arvio):
     - säilyy välilehden muistissa (sessionStorage 'ut_vana' ja viimeisimmän GPS-pisteen aika 'ut_vana_viime'),
       enintään 45 min / 2 km. Etusivu ja tilannekuva ovat
       samassa välilehdessä, joten vana jatkuu sivulta toiselle. Ei saalislokissa eikä varmuuskopiossa.
     - paikallaan (GPS:n oma nopeus alle 1 km/h) ei pisteitä; uusi piste 5–15 m siirtymästä tarkkuuden mukaan
       (ilman GPS:n nopeutta 10–20 m); yli 40 m:n tarkkuus ei piirrä; yli 3 min katko tai yli 100 km/h hyppy
       aloittaa alusta.
   VENE = Beason 630 WA ylhäältä, kiinteä 44 px (6,3 m olisi järven mittakaavassa pikseli). Keula kulkusuuntaan.
     Suunta tuore (≤ 60 s): vihreä ennusteviiva 5 min nykyisellä nopeudella. Vanha suunta: vene haaleana.
     Suuntaa ei vielä tiedetä: pyöreä merkki veneen väreissä.

   RAJAPINTA (kaikki piirto kartan omassa koordinaatistossa; yks = piirtoyksikköä CSS-pikseliä kohden)
     utVana.lisaa(lat, lon, tarkkuus, gpsMs, t)   GPS-piste vanaan (gpsMs = coords.speed tai null)
     utVana.pisteet()                            [{ lat, lon, t }], vanhin ensin
     utVana.talteen()                            välilehden muistiin (myös itsestään: 15 s välein, piiloon, pagehide)
     utPiirraVana(ctx, o)                        o = { oma, naytolle(lat, lon) → {x, y}, mPerPx, yks }
     utPiirraVeneMerkki(ctx, o)                  tarkkuusympyrä, ennusteviiva ja vene; o = { oma, p: {x, y}, mPerPx, yks, yo }
     utPiirraOma(ctx, o)                         molemmat peräkkäin (aaltokortti, syvyyskartta)
   oma = window.utOmaSijainti = { lat, lon, suunta, suuntaT, tarkkuus, kmh, aika }.
   VERSIO: sivut lataavat tiedoston nimellä vene.js?v=NNN; NNN = sw.js:n VERSIO-numero. */
(function () {
  'use strict';
  const VENE_PX = 44, VENE_M = 6.3;            // kuvan pituus näytöllä; todellinen pituus, jos zoomattu niin lähelle, että se on isompi
  const VANA_SS = 'ut_vana', VANA_SS_V183 = 'tilanne_vana', VANA_SS_VIIME = 'ut_vana_viime';
  const VANA_M = 50, VANA_PX = 80, VANA_MAX_M = 2000, VANA_MAX_MS = 45 * 60e3, VANA_KATKO_MS = 180e3;

  function matka(la1, lo1, la2, lo2) {   // sama kaava ja säde kuin klooniMatka ja haversineDistMeters
    const R = 6371e3, dLat = (la2 - la1) * Math.PI / 180, dLon = (lo2 - lo1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(la1 * Math.PI / 180) * Math.cos(la2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /* ---------- vana ---------- */
  let vana = [];                                 // GPS-pisteet { lat, lon, t }, vanhin ensin; tämän välilehden muistissa
  let vanaViimeT = 0, vanaTallT = 0;
  try {
    let raaka = sessionStorage.getItem(VANA_SS);
    if (raaka === null) raaka = sessionStorage.getItem(VANA_SS_V183);   // v183:n tilannekuvan vana jatkuu
    const v = JSON.parse(raaka || '[]');
    if (Array.isArray(v)) vana = v.filter(q => q && typeof q.lat === 'number' && typeof q.lon === 'number' && typeof q.t === 'number' && Date.now() - q.t < VANA_MAX_MS);
    if (vana.length) vanaViimeT = vana[vana.length - 1].t;
    // viimeisin GPS-piste (myös paikallaan, jolloin vanaan ei tule pistettä): sivun vaihto ei katkaise vanaa,
    // jos GPS on ollut koko ajan päällä
    const vt = +sessionStorage.getItem(VANA_SS_VIIME);
    if (vt > vanaViimeT && vt <= Date.now() + 60e3) vanaViimeT = vt;
  } catch (e) { vana = []; }
  function talteen() {
    vanaTallT = Date.now();
    try { sessionStorage.setItem(VANA_SS, JSON.stringify(vana)); sessionStorage.setItem(VANA_SS_VIIME, String(vanaViimeT)); sessionStorage.removeItem(VANA_SS_V183); } catch (e) {}
  }
  function lisaa(lat, lon, tarkkuus, gpsMs, t) {
    if (typeof lat !== 'number' || typeof lon !== 'number' || !isFinite(lat) || !isFinite(lon)) return;
    t = typeof t === 'number' ? t : Date.now();
    lisaaPiste(lat, lon, tarkkuus, gpsMs, t);
    if (t - vanaTallT > 15e3) talteen();   // myös paikallaan (viimeisimmän GPS-pisteen aika)
  }
  function lisaaPiste(lat, lon, tarkkuus, gpsMs, t) {
    // katko (näyttö kiinni tai GPS poissa yli 3 min): vana alkaa alusta, ei suoraa viivaa tuntemattoman matkan yli
    if (vanaViimeT && t - vanaViimeT > VANA_KATKO_MS) vana = [];
    vanaViimeT = t;
    if (typeof tarkkuus === 'number' && tarkkuus > 40) return;     // epätarkka paikka ei piirrä vanaa
    // paikallaan: GPS:n oma nopeus alle 1 km/h → ei pistettä (kohina ei piirrä kiemuraa eikä venettä pyöritä)
    if (typeof gpsMs === 'number' && gpsMs < 0.28) return;
    const v = vana[vana.length - 1];
    if (v) {
      const d = matka(v.lat, v.lon, lat, lon);
      // uusi piste 5–15 m siirtymästä tarkkuuden mukaan; ilman GPS-nopeutta varovaisemmin 10–20 m
      if (d < (typeof gpsMs === 'number' ? Math.max(5, Math.min(15, (tarkkuus || 0) / 2)) : Math.max(10, Math.min(20, tarkkuus || 0)))) return;
      if (d > 50 && d / Math.max(1, (t - v.t) / 1000) > 28) vana = [];   // hyppy (yli 100 km/h): GPS-virhe, ei piikkiä
    }
    vana.push({ lat, lon, t });
    while (vana.length > 1 && t - vana[0].t > VANA_MAX_MS) vana.shift();
    let s = 0;
    for (let i = vana.length - 1; i > 0; i--) {
      s += matka(vana[i].lat, vana[i].lon, vana[i - 1].lat, vana[i - 1].lon);
      if (s > VANA_MAX_M) { vana = vana.slice(i - 1); break; }
    }
  }
  // talteen, kun sivu jää taustalle, suljetaan tai vaihtuu toiseen (etusivu ↔ tilannekuva samassa välilehdessä)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') talteen(); });
  window.addEventListener('pagehide', talteen);
  window.utVana = { lisaa, pisteet: () => vana, talteen };

  /* ---------- piirto ---------- */
  function pyorea(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  const pituus = (mPerPx, yks) => Math.max(VENE_PX * yks, VENE_M / mPerPx);

  // vana: kuljettu GPS-reitti veneestä taaksepäin, vähintään 50 m ja aina vähintään 80 px, jotta se erottuu veneen
  // kuvan takaa myös koko järven näkymässä (siellä 50 m on alle 10 px). Häipyy hännän päätä kohti.
  function piirraVana(ctx, o) {
    const oma = o.oma, yks = o.yks || 1;
    if (!vana.length || !oma) return;
    const p = o.naytolle(oma.lat, oma.lon);
    const pit = Math.max(VANA_M, VANA_PX * yks * o.mPerPx), P = [{ x: p.x, y: p.y, s: 0 }];
    let la = oma.lat, lo = oma.lon, s = 0;
    for (let i = vana.length - 1; i >= 0 && s < pit; i--) {
      const q = vana[i], d = matka(la, lo, q.lat, q.lon); if (d < 0.5) continue;
      let b = o.naytolle(q.lat, q.lon);
      if (s + d > pit) { const a = P[P.length - 1], f = (pit - s) / d; b = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }; s = pit; }
      else s += d;
      P.push({ x: b.x, y: b.y, s }); la = q.lat; lo = q.lon;
    }
    if (P.length < 2) return;
    const pala = (s0, s1) => {   // reitin osa matkavälillä s0…s1 (m)
      const Q = [];
      for (let j = 1; j < P.length; j++) {
        const a = P[j - 1], b = P[j]; if (b.s <= s0 || a.s >= s1) continue;
        const ip = u => { const f = (u - a.s) / ((b.s - a.s) || 1); return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }; };
        if (!Q.length) Q.push(a.s >= s0 ? a : ip(s0));
        Q.push(b.s <= s1 ? b : ip(s1));
      }
      return Q;
    };
    const N = 12;
    ctx.save(); ctx.lineCap = 'butt'; ctx.lineJoin = 'round';
    for (const [lw, vari] of [[7.5, a => 'rgba(4,10,18,' + (0.15 + 0.6 * a).toFixed(3) + ')'], [3.6, a => 'rgba(94,231,255,' + (0.25 + 0.73 * a).toFixed(3) + ')']]) {
      for (let k = 0; k < N; k++) {
        const Q = pala(k * pit / N, (k + 1) * pit / N); if (Q.length < 2) continue;
        ctx.beginPath(); ctx.moveTo(Q[0].x, Q[0].y); for (let j = 1; j < Q.length; j++) ctx.lineTo(Q[j].x, Q[j].y);
        ctx.lineWidth = lw * yks; ctx.strokeStyle = vari(1 - (k + 0.5) / N); ctx.stroke();
      }
    }
    ctx.restore();
  }

  // vene ylhäältä (Hannun Beason 630 WA -kuvan mukaan): valkoinen runko, tumma ohjaamo, perämoottori ja syaani hehku.
  function veneenRunko(ctx, h, b) {
    ctx.beginPath(); ctx.moveTo(0, -h);
    ctx.bezierCurveTo(b * 0.62, -h * 0.8, b, -h * 0.36, b, h * 0.08);
    ctx.lineTo(b * 0.95, h * 0.9); ctx.quadraticCurveTo(b * 0.93, h, b * 0.76, h);
    ctx.lineTo(-b * 0.76, h); ctx.quadraticCurveTo(-b * 0.93, h, -b * 0.95, h * 0.9);
    ctx.lineTo(-b, h * 0.08); ctx.bezierCurveTo(-b, -h * 0.36, -b * 0.62, -h * 0.8, 0, -h); ctx.closePath();
  }
  function piirraVene(ctx, x, y, suunta, haalea, L, yks, yo) {
    const h = L / 2, b = L * 0.19, r = Math.min(3 * yks, b * 0.3);
    ctx.save(); ctx.translate(x, y); ctx.rotate(suunta * Math.PI / 180);
    if (haalea) ctx.globalAlpha = 0.6;
    // perämoottori peräpeilin takana
    pyorea(ctx, -b * 0.36, h - 1.5 * yks, b * 0.72, L * 0.16, r); ctx.fillStyle = '#1d2733'; ctx.fill(); ctx.lineWidth = 1.2 * yks; ctx.strokeStyle = '#04121f'; ctx.stroke();
    // hehku, runko ja tumma reunaviiva (erottuu sekä tummalla että vaalealla kartalla)
    veneenRunko(ctx, h, b); ctx.shadowColor = 'rgba(80,232,255,1)'; ctx.shadowBlur = (yo ? 7 : 15) * yks;
    ctx.lineWidth = 4 * yks; ctx.strokeStyle = '#5EE7FF'; ctx.stroke(); ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#F4F8FC'; ctx.fill(); ctx.lineWidth = 1.3 * yks; ctx.strokeStyle = '#04121f'; ctx.stroke();
    // kannen reuna
    ctx.save(); ctx.scale(0.74, 0.84); veneenRunko(ctx, h, b); ctx.restore(); ctx.lineWidth = 0.9 * yks; ctx.strokeStyle = 'rgba(110,130,152,.85)'; ctx.stroke();
    // ohjaamo ja tuulilasi
    pyorea(ctx, -b * 0.56, -h * 0.16, b * 1.12, h * 0.6, r); ctx.fillStyle = '#1f3147'; ctx.fill(); ctx.lineWidth = 1 * yks; ctx.strokeStyle = '#04121f'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-b * 0.5, -h * 0.1); ctx.quadraticCurveTo(0, -h * 0.25, b * 0.5, -h * 0.1); ctx.lineWidth = 1.6 * yks; ctx.strokeStyle = '#8FDCFF'; ctx.stroke();
    ctx.restore();
  }

  // tarkkuusympyrä, ennusteviiva ja vene kulkusuuntaan (tai pyöreä merkki, jos suuntaa ei vielä tiedetä)
  function piirraVeneMerkki(ctx, o) {
    const oma = o.oma, p = o.p, yks = o.yks || 1, mpp = o.mPerPx;
    if (!oma || !p) return;
    if (typeof oma.tarkkuus === 'number' && oma.tarkkuus > 0) {
      const r = oma.tarkkuus / mpp;
      if (r > 10 * yks && r < 2000 * yks) { ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.2832); ctx.fillStyle = 'rgba(126,217,87,.12)'; ctx.fill(); ctx.lineWidth = 1 * yks; ctx.strokeStyle = 'rgba(126,217,87,.5)'; ctx.stroke(); }
    }
    if (typeof oma.suunta === 'number') {
      // suunta tuore (mitattu viimeisen minuutin aikana): ennusteviiva 5 min nykyisellä nopeudella, vähintään 30 px keulan edessä.
      // Vanha suunta (vene seissyt): vene näkyy haaleana viimeisimpään kulkusuuntaan, ei ennusteviivaa.
      const tuore = typeof oma.suuntaT === 'number' && oma.aika - oma.suuntaT <= 60e3, L = pituus(mpp, yks);
      if (tuore) {
        const a = oma.suunta * Math.PI / 180, E = Math.max(L / 2 + 30 * yks, (oma.kmh || 0) / 3.6 * 300 / mpp);
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.sin(a) * E, p.y - Math.cos(a) * E);
        ctx.lineWidth = 5 * yks; ctx.strokeStyle = 'rgba(4,10,18,.8)'; ctx.stroke();
        ctx.lineWidth = 2.5 * yks; ctx.strokeStyle = '#7ED957'; ctx.stroke();
      }
      piirraVene(ctx, p.x, p.y, oma.suunta, !tuore, L, yks, o.yo);
    } else {
      // suuntaa ei vielä tiedetä (ei liikettä sivun avaamisen jälkeen): pyöreä merkki veneen väreissä
      ctx.save(); ctx.beginPath(); ctx.arc(p.x, p.y, 9 * yks, 0, 6.2832); ctx.shadowColor = 'rgba(80,232,255,1)'; ctx.shadowBlur = (o.yo ? 7 : 15) * yks;
      ctx.lineWidth = 4 * yks; ctx.strokeStyle = '#5EE7FF'; ctx.stroke(); ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
      ctx.fillStyle = '#F4F8FC'; ctx.fill(); ctx.lineWidth = 1.3 * yks; ctx.strokeStyle = '#04121f'; ctx.stroke(); ctx.restore();
    }
  }
  function piirraOma(ctx, o) {
    if (!o || !o.oma) return;
    piirraVana(ctx, o);
    piirraVeneMerkki(ctx, Object.assign({}, o, { p: o.naytolle(o.oma.lat, o.oma.lon) }));
  }
  window.utPiirraVana = piirraVana;
  window.utPiirraVeneMerkki = piirraVeneMerkki;
  window.utPiirraOma = piirraOma;
})();
