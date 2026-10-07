"""Uistelututka v172 - vaihtoehto 2: Lowrancen .sl2 -> oma luotaus .json (tuodaan sovelluksen
Oma luotaus -kortista samalla napilla kuin .sl2).

Sama jäsennys, harvennus ja alkuhetki (v173) kuin sovelluksessa (olLueSl2): piste vähintään 1 s ja 5 m edellisestä,
syvyys anturista senttimetreinä, anturin syvyys erikseen. Käyttö:

    python3 sl2_json.py Sonar0012.sl2 [lisää.sl2 ...] --anturi 0.25 --ulos luotaus.json
"""
import argparse, json, math, os, struct, time

R = 6356752.3142


def lue(polku):
    with open(polku, 'rb') as f:
        d = f.read()
    fmt = struct.unpack_from('<H', d, 0)[0]
    if fmt != 2:
        raise SystemExit('%s: ei sl2-tallenne (muoto %d)' % (polku, fmt))
    pos, kehyksia = 8, 0
    lat, lon, syv = [], [], []
    tmin = tmax = lmin = lmax = None
    viime_t, v_lat, v_lon, alku = -1e9, None, None, None
    while pos + 144 <= len(d):
        koko = struct.unpack_from('<H', d, pos + 28)[0]
        if koko < 144 or pos + koko > len(d):
            break
        kehyksia += 1
        ft = struct.unpack_from('<f', d, pos + 64)[0]
        kn = struct.unpack_from('<f', d, pos + 100)[0]
        lt = struct.unpack_from('<f', d, pos + 104)[0]
        e, n = struct.unpack_from('<ii', d, pos + 108)
        t = struct.unpack_from('<I', d, pos + 140)[0]
        if alku is None:   # v173: alkukehyksissä +60 = alkuhetki unix-sekunteina
            us = struct.unpack_from('<I', d, pos + 60)[0]
            if 1.5e9 < us < 2.2e9:
                alku = us * 1000 - t
        pos += koko
        la = (2 * math.atan(math.exp(n / R)) - math.pi / 2) * 180 / math.pi
        lo = e / R * 180 / math.pi
        if not (1 < ft < 500 and 40 < la < 80 and -30 < lo < 60 and 0 <= kn < 32):
            continue
        if t - viime_t < 1000:
            continue
        if v_lat is not None:
            dy = (la - v_lat) * 111320
            dx = (lo - v_lon) * 111320 * math.cos(math.radians(la))
            if dx * dx + dy * dy < 25:
                continue
        lat.append(round(la * 1e6)); lon.append(round(lo * 1e6)); syv.append(round(ft * 0.3048 * 100))
        viime_t, v_lat, v_lon = t, la, lo
        tmin = t if tmin is None else min(tmin, t); tmax = t if tmax is None else max(tmax, t)
        if -2 < lt < 35:
            lmin = lt if lmin is None else min(lmin, lt); lmax = lt if lmax is None else max(lmax, lt)
    return {'lat': lat, 'lon': lon, 'syv': syv, 'kehyksia': kehyksia, 'kestoS': round(((tmax or 0) - (tmin or 0)) / 1000),
            'alku': None if alku is None else alku + (tmin or 0),
            'lampoMin': None if lmin is None else round(lmin, 2), 'lampoMax': None if lmax is None else round(lmax, 2)}


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('tiedostot', nargs='+')
    ap.add_argument('--anturi', type=float, default=0.25)
    ap.add_argument('--ulos', default='luotaus.json')
    a = ap.parse_args()
    tuonnit = []
    for p in a.tiedostot:
        r = lue(p)
        nimi = os.path.basename(p)
        r.update({'id': 'claude-' + nimi + '-' + str(len(r['lat'])) + '-' + str(r['lat'][0] if r['lat'] else 0),
                  'tunniste': nimi + '|' + str(os.path.getsize(p)) + '|' + str(r['lat'][0] if r['lat'] else 0) + '|' + str(r['lon'][0] if r['lon'] else 0),
                  'nimi': nimi + ' (Claude)', 'tuotu': int(time.time() * 1000), 'jarvi': None, 'jarviNimi': None, 'anturiM': a.anturi})
        tuonnit.append(r)
        alku = time.strftime('%d.%m.%Y %H.%M UTC', time.gmtime(r['alku'] / 1000)) if r['alku'] else 'ei alkuhetkeä'
        print('%s: %d kehystä, %d pistettä, syvyys %.2f–%.2f m anturista, alku %s' % (nimi, r['kehyksia'], len(r['lat']), min(r['syv']) / 100, max(r['syv']) / 100, alku))
    with open(a.ulos, 'w', encoding='utf-8') as f:
        json.dump({'uistelututka_omaluotaus': 1, 'tuonnit': tuonnit}, f, ensure_ascii=False)
    print('kirjoitettu', a.ulos)
