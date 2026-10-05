"""Give every NAPIC scheme (development) a location, from OpenStreetMap names only (no web geocoder needed).

Order of methods, first that works wins (every accepted point must fall inside the sale's district boundary,
DOSM polygons buffered ~1.5 km):
  1 scheme_exact : OSM residential area / estate / building with the same (normalised) name
  2 scheme_base  : same name after dropping phase / block / generic words (TAMAN X FASA 2 -> X)
  3 road         : the scheme's road names matched to named OSM roads (median of all its sales' roads)
  4 mukim        : sales-weighted median of located schemes in the same mukim
  5 district     : district polygon centre
    python geocode.py  -> data/scheme_locations.csv, out/geocode_report.json
"""
import re, json, collections, numpy as np, pandas as pd
from shapely.geometry import shape, Point
from shapely.ops import unary_union
from shapely.prepared import prep

SARAWAK = {'Bahagian Kuching': ['Kuching', 'Bau', 'Lundu'], 'Bahagian Samarahan': ['Samarahan', 'Asajaya', 'Simunjan'],
           'Bahagian Serian': ['Serian', 'Tebedu'], 'Bahagian Sri Aman': ['Sri Aman', 'Lubok Antu'],
           'Bahagian Betong': ['Betong', 'Saratok', 'Kabong', 'Pusa'], 'Bahagian Sarikei': ['Sarikei', 'Maradong', 'Julau', 'Pakan'],
           'Bahagian Sibu': ['Sibu', 'Kanowit', 'Selangau'], 'Bahagian Mukah': ['Mukah', 'Dalat', 'Daro', 'Matu', 'Tanjung Manis'],
           'Bahagian Bintulu': ['Bintulu', 'Tatau', 'Sebauh'], 'Bahagian Kapit': ['Kapit', 'Song', 'Belaga', 'Bukit Mabong'],
           'Bahagian Miri': ['Miri', 'Marudi', 'Subis', 'Beluru', 'Telang Usan'], 'Bahagian Limbang': ['Limbang', 'Lawas']}
RENAME = {'Bandar Baru': ['Bandar Baharu'], 'Cameron Highland': ['Cameron Highlands'], 'Hulu Langat': ['Ulu Langat'],
          'Hulu Selangor': ['Ulu Selangor'], 'Kota Bahru': ['Kota Bharu'], 'Kuala Lumpur': ['W.P. Kuala Lumpur'],
          'Labuan': ['W.P. Labuan'], 'Putrajaya': ['W.P. Putrajaya'], 'Larut Matang': ['Larut Dan Matang'],
          'Daerah Kecil Muadzam Shah': ['Rompin'], 'Labuk Sugut': ['Beluran'], 'Gua Musang': ['Gua Musang', 'Kecil Lojing'],
          **SARAWAK}
ABBR = {'TMN': 'TAMAN', 'TMAN': 'TAMAN', 'BDR': 'BANDAR', 'BNDR': 'BANDAR', 'KG': 'KAMPUNG', 'KPG': 'KAMPUNG',
        'KAMPONG': 'KAMPUNG', 'JLN': 'JALAN', 'JL': 'JALAN', 'LRG': 'LORONG', 'PSN': 'PERSIARAN', 'PRSN': 'PERSIARAN',
        'SG': 'SUNGAI', 'SGI': 'SUNGAI', 'BT': 'BATU', 'BKT': 'BUKIT', 'APT': 'APARTMENT', 'APARTMEN': 'APARTMENT',
        'APARTMENTS': 'APARTMENT', 'PANGSAPURI': 'APARTMENT', 'KONDOMINIUM': 'CONDOMINIUM', 'KONDO': 'CONDOMINIUM',
        'CONDO': 'CONDOMINIUM', 'RESIDENSI': 'RESIDENCE', 'RESIDENCES': 'RESIDENCE', 'SRI': 'SERI', 'SEK': 'SEKSYEN',
        'SECTION': 'SEKSYEN', 'PH': 'FASA', 'PHASE': 'FASA', 'FS': 'FASA', 'PRT': 'PERUMAHAN', 'PERUM': 'PERUMAHAN',
        'TG': 'TANJUNG', 'TGK': 'TENGKU', 'DSA': 'DESA', 'HTS': 'HEIGHTS', 'GDN': 'GARDEN', 'GDNS': 'GARDEN', 'GARDENS': 'GARDEN',
        'PK': 'PARK', 'CT': 'COURT', 'PJ': 'PETALING JAYA', 'KL': 'KUALA LUMPUR', 'PDG': 'PADANG', 'PULAU': 'PULAU'}
GENERIC = {'TAMAN', 'BANDAR', 'PERUMAHAN', 'APARTMENT', 'CONDOMINIUM', 'RESIDENCE', 'FLAT', 'FLATS', 'PPR', 'PPAM',
           'BLOK', 'BLOCK', 'KOS', 'RENDAH', 'SEDERHANA', 'THE', 'DI', 'AT', 'BARU', 'KAWASAN', 'SKIM', 'RUMAH', 'TOWNSHIP'}


def norm(s):
    s = re.sub(r'[^A-Z0-9 ]', ' ', str(s).upper().replace('@', ' '))
    return ' '.join(ABBR.get(t, t) for t in s.split())


def base(n):
    t = n.split(); out = []; skip = False
    for i, w in enumerate(t):
        if skip: skip = False; continue
        if w in ('FASA', 'SEKSYEN', 'BLOK', 'BLOCK', 'PRESINT', 'ZON', 'JALAN'): skip = True; continue
        if w in GENERIC or re.fullmatch(r'\d+[A-Z]?|[IVX]+', w): continue
        out.append(w)
    return ' '.join(out)


def polygons(districts_by_state):
    g = json.load(open('data/dosm_district.geojson'))
    geo = {(f['properties']['state'], f['properties']['district']): shape(f['geometry']) for f in g['features']}
    P = {}
    for state, d in districts_by_state:
        names = RENAME.get(d, [d])
        P[d] = unary_union([geo[(state, n)] for n in names])
    return P


def cluster_median(pts, radius=0.03):
    """median of the biggest cluster of points (deg); guards against two same-named estates in one district"""
    pts = np.asarray(pts)
    if len(pts) == 1: return pts[0], 1, 0.0
    best = None
    for p in pts:
        m = np.hypot(*(pts - p).T) <= radius
        if best is None or m.sum() > best.sum(): best = m
    c = np.median(pts[best], axis=0)
    spread = float(np.median(np.hypot(*(pts[best] - c).T))) * 111
    return c, int(best.sum()), spread


def main():
    sales = pd.read_parquet('data/napic_clean.parquet')
    sales['mukim_u'] = sales.mukim.fillna('?').str.upper().str.strip()
    sales['scheme_u'] = sales.scheme.fillna('?').str.upper().str.strip()
    sales['skey'] = sales.district + '|' + sales.mukim_u + '|' + sales.scheme_u
    P = polygons(sales[['state', 'district']].drop_duplicates().itertuples(index=False))
    PB = {d: prep(p.buffer(0.015)) for d, p in P.items()}
    # OSM candidates
    res = pd.read_csv('data/osm/osm_residential_names.csv')
    roads = pd.read_csv('data/osm/osm_roads.csv')
    idx_exact, idx_base, idx_road = collections.defaultdict(list), collections.defaultdict(list), collections.defaultdict(list)
    for r in res.itertuples():
        for nm in {r.name, r.name_en} - {'', np.nan}:
            if not isinstance(nm, str): continue
            n = norm(nm); idx_exact[n].append((r.lat, r.lon))
            b = base(n)
            if len(b) >= 4: idx_base[b].append((r.lat, r.lon))
    for r in roads.itertuples():
        idx_road[norm(r.name)].append((r.lat, r.lon))
    sch = sales.groupby('skey').agg(state=('state', 'first'), district=('district', 'first'), mukim=('mukim_u', 'first'),
                                    scheme=('scheme_u', 'first'), n=('price_rm', 'size')).reset_index()
    road_by_scheme = sales.groupby('skey').road.agg(lambda s: s.dropna().str.upper().str.strip().value_counts().index[:5].tolist())
    out = []
    for r in sch.itertuples():
        inside = lambda pts: [p for p in pts if PB[r.district].contains(Point(p[1], p[0]))]
        n = norm(r.scheme); got = None
        c = inside(idx_exact.get(n, []))
        if c: got = ('scheme_exact',) + cluster_median(c)
        if got is None:
            b = base(n)
            if len(b) >= 4:
                c = inside(idx_base.get(b, []))
                if c: got = ('scheme_base',) + cluster_median(c)
        if got is None:
            pts = []
            for rd in road_by_scheme.get(r.skey, []):
                cr = inside(idx_road.get(norm(rd), []))
                if cr: pts.append(cluster_median(cr, radius=0.02)[0])
            if pts: got = ('road',) + cluster_median(pts, radius=0.03)
        if got:
            (lat, lon), k, spread = got[1], got[2], got[3]
            out.append((r.skey, got[0], lat, lon, k, spread))
        else:
            out.append((r.skey, None, np.nan, np.nan, 0, np.nan))
    loc = pd.DataFrame(out, columns=['skey', 'method', 'lat', 'lon', 'n_candidates', 'spread_km'])
    sch = sch.merge(loc, on='skey')
    # mukim fallback: sales-weighted median of located schemes in that mukim
    ok = sch.lat.notna()
    mk = sch[ok].groupby(['district', 'mukim']).apply(lambda g: pd.Series({'mlat': np.average(g.lat, weights=g.n), 'mlon': np.average(g.lon, weights=g.n)}))
    sch = sch.merge(mk, left_on=['district', 'mukim'], right_index=True, how='left')
    m = sch.lat.isna() & sch.mlat.notna()
    sch.loc[m, ['lat', 'lon']] = sch.loc[m, ['mlat', 'mlon']].values; sch.loc[m, 'method'] = 'mukim'
    m = sch.lat.isna()
    cen = {d: p.representative_point() for d, p in P.items()}
    sch.loc[m, 'lat'] = sch.loc[m, 'district'].map(lambda d: cen[d].y); sch.loc[m, 'lon'] = sch.loc[m, 'district'].map(lambda d: cen[d].x)
    sch.loc[m, 'method'] = 'district'
    sch = sch.drop(columns=['mlat', 'mlon'])
    sch.to_csv('data/scheme_locations.csv', index=False, float_format='%.5f')
    # report
    rep = {}
    for nm, g in [('all schemes', sch), ('schemes with 10+ sales', sch[sch.n >= 10])]:
        rep[nm] = {'count': int(len(g)), 'by_method_share_of_schemes': (g.method.value_counts(normalize=True).round(4)).to_dict(),
                   'by_method_share_of_sales': (g.groupby('method').n.sum() / g.n.sum()).round(4).to_dict()}
    rep['by_state_share_of_sales_located_precisely'] = (sch.assign(p=sch.method.isin(['scheme_exact', 'scheme_base', 'road']) * sch.n)
                                                        .groupby('state').apply(lambda g: g.p.sum() / g.n.sum()).round(3).to_dict())
    # consistency check: schemes located by name AND having road matches -> distance between the two
    json.dump(rep, open('out/geocode_report.json', 'w'), indent=1)
    print(json.dumps(rep, indent=1))


if __name__ == '__main__':
    main()
