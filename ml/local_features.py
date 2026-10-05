"""Local (neighbourhood) features per scheme location from the OpenStreetMap extract.
    python local_features.py -> data/scheme_features.csv, data/rail_stations.csv

Point-in-time rule for rail: a station only counts for sales on/after its opening date
(MRT Putrajaya Line phase 1 = 16 Jun 2022, phase 2 = 16 Mar 2023, OSM start_date where tagged; older lines = always).
Shops/schools/clinics are today's OSM snapshot (OSM has no reliable opening dates) - stated as a limitation.
"""
import re, numpy as np, pandas as pd
from sklearn.neighbors import BallTree

R_KM = 6371.0
URBAN = ['Kelana Jaya', 'Ampang', 'Sri Petaling', 'Kajang', 'Putrajaya', 'Sungai Buloh', 'Monorail', 'Komuter',
         'Port Klang Line', 'Seremban Line', 'KLIA Transit', 'KLIA Ekspres', 'Rapid KL']
CAPITALS = {'Johor': (1.4927, 103.7414), 'Kedah': (6.1248, 100.3678), 'Kelantan': (6.1254, 102.2381),
            'Melaka': (2.1896, 102.2501), 'Negeri Sembilan': (2.7258, 101.9424), 'Pahang': (3.8077, 103.3260),
            'Perak': (4.5975, 101.0901), 'Perlis': (6.4414, 100.1986), 'Pulau Pinang': (5.4141, 100.3288),
            'Sabah': (5.9804, 116.0735), 'Sarawak': (1.5533, 110.3592), 'Selangor': (3.0738, 101.5183),
            'Terengganu': (5.3302, 103.1408), 'W.P. Kuala Lumpur': (3.1478, 101.6953), 'W.P. Labuan': (5.2831, 115.2308),
            'W.P. Putrajaya': (2.9264, 101.6964)}
KL = (3.1478, 101.6953)


def not_foreign(lat, lon):
    sg = (lat < 1.452) & (lon > 103.59) & (lon < 104.1) | ((lat < 1.472) & (lon > 103.80) & (lon < 103.88))
    bn = (lon > 114.07) & (lon < 114.9) & (lat > 4.4) & (lat < 5.05)
    return ~(sg | bn)


def rail_stations(poi):
    r = poi[(poi.cat == 'rail') & not_foreign(poi.lat, poi.lon)].copy()
    net = r.network.fillna('') + ' ' + r.name.fillna('')
    r = r[net.apply(lambda s: any(u.lower() in s.lower() for u in URBAN))].copy()
    r = r[~r.network.fillna('').str.contains('Shah Alam', case=False)]       # LRT3: opening date not verified -> excluded
    def opened(row):
        nets = [n.strip() for n in str(row.network).split(';')]
        if row.start_date and isinstance(row.start_date, str) and re.match(r'\d{4}-\d{2}-\d{2}', row.start_date):
            return row.start_date[:10]
        if all('Putrajaya' in n or 'Serdang' in n for n in nets if n):
            m = re.match(r'PY(\d+)', str(row['name']))
            if m: return '2022-06-16' if int(m.group(1)) <= 13 else '2023-03-16'
            return '2023-03-16'
        return '2000-01-01'
    r['opened'] = r.apply(opened, axis=1)
    r['opened'] = np.where(r.opened < '2000-01-01', '2000-01-01', r.opened)
    return r[['name', 'network', 'opened', 'lat', 'lon']].drop_duplicates(['name', 'lat', 'lon'])


def tree(df):
    return BallTree(np.radians(df[['lat', 'lon']].values), metric='haversine')


def main():
    loc = pd.read_csv('data/scheme_locations.csv')
    poi = pd.read_csv('data/osm/osm_poi.csv'); poi = poi[not_foreign(poi.lat, poi.lon)]
    X = np.radians(loc[['lat', 'lon']].values); F = loc[['skey']].copy()
    F['geo_precise'] = loc.method.isin(['scheme_exact', 'scheme_base', 'road']).astype(int)
    for cat, radii in [('school', (1, 2)), ('clinic', (1, 2)), ('hospital', ()), ('shop', (1, 2)), ('park', (1,)),
                       ('tertiary', ()), ('mway_exit', ()), ('worship', (1,))]:
        p = poi[poi.cat == cat]
        if not len(p): continue
        t = tree(p)
        d, _ = t.query(X, k=1); F[f'dist_{cat}_km'] = (d[:, 0] * R_KM).round(3)
        for rad in radii:
            F[f'n_{cat}_{rad}km'] = t.query_radius(X, r=rad / R_KM, count_only=True)
    cap = loc.state.map(CAPITALS)
    def hav(a, b):
        la1, lo1, la2, lo2 = map(np.radians, (a[:, 0], a[:, 1], b[:, 0], b[:, 1]))
        h = np.sin((la2 - la1) / 2) ** 2 + np.cos(la1) * np.cos(la2) * np.sin((lo2 - lo1) / 2) ** 2
        return 2 * R_KM * np.arcsin(np.sqrt(h))
    F['dist_state_capital_km'] = hav(loc[['lat', 'lon']].values, np.array(cap.tolist())).round(2)
    F['dist_kl_km'] = hav(loc[['lat', 'lon']].values, np.tile(KL, (len(loc), 1))).round(2)
    # rail: distance to the nearest station of each opening-date group (sale-time min taken in the model)
    st = rail_stations(pd.read_csv('data/osm/osm_poi.csv')); st.to_csv('data/rail_stations.csv', index=False)
    for od, g in st.groupby('opened'):
        d, _ = tree(g).query(X, k=1); F[f'rail_{od}'] = (d[:, 0] * R_KM).round(3)
    F['lat'], F['lon'] = loc.lat.round(5), loc.lon.round(5)
    F.to_csv('data/scheme_features.csv', index=False)
    print(F.shape); print(st.opened.value_counts().sort_index().to_string())
    print(F.describe().T[['mean', '50%', 'max']].round(2).to_string())


if __name__ == '__main__':
    main()
