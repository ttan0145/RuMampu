"""Clean the raw NAPIC Open Transaction Data export (UTF-16 TSV from the NAPIC Tableau dashboard).
    python prep_napic.py "Open_Transaction_Data.csv"   -> data/napic_clean.parquet (+ data/napic_clean.csv.gz)
"""
import sys, numpy as np, pandas as pd

STATE = {
 'Johor': ['Batu Pahat', 'Johor Bahru', 'Kluang', 'Kota Tinggi', 'Kulai', 'Mersing', 'Muar', 'Pontian', 'Segamat', 'Tangkak'],
 'Kedah': ['Baling', 'Bandar Baru', 'Kota Setar', 'Kuala Muda', 'Kubang Pasu', 'Kulim', 'Langkawi', 'Padang Terap',
           'Pendang', 'Pokok Sena', 'Sik', 'Yan'],
 'Kelantan': ['Bachok', 'Gua Musang', 'Jeli', 'Kota Bahru', 'Kuala Krai', 'Machang', 'Pasir Mas', 'Pasir Puteh',
              'Tanah Merah', 'Tumpat'],
 'Melaka': ['Alor Gajah', 'Jasin', 'Melaka Tengah'],
 'Negeri Sembilan': ['Jelebu', 'Jempol', 'Kuala Pilah', 'Port Dickson', 'Rembau', 'Seremban', 'Tampin'],
 'Pahang': ['Bentong', 'Bera', 'Cameron Highland', 'Daerah Kecil Muadzam Shah', 'Jerantut', 'Kuantan', 'Lipis', 'Maran',
            'Pekan', 'Raub', 'Rompin', 'Temerloh'],
 'Perak': ['Bagan Datuk', 'Batang Padang', 'Hilir Perak', 'Hulu Perak', 'Kampar', 'Kerian', 'Kinta', 'Kuala Kangsar',
           'Larut Matang', 'Manjung', 'Muallim', 'Perak Tengah', 'Selama'],
 'Perlis': ['Perlis'],
 'Pulau Pinang': ['Barat Daya', 'Seberang Perai Selatan', 'Seberang Perai Tengah', 'Seberang Perai Utara', 'Timur Laut'],
 'Sabah': ['Beaufort', 'Keningau', 'Kota Belud', 'Kota Kinabalu', 'Kota Marudu', 'Kudat', 'Kunak', 'Labuk Sugut',
           'Lahad Datu', 'Papar', 'Penampang', 'Pitas', 'Putatan', 'Ranau', 'Sandakan', 'Semporna', 'Sipitang',
           'Tambunan', 'Tawau', 'Tenom', 'Tuaran'],
 'Sarawak': ['Bahagian Betong', 'Bahagian Bintulu', 'Bahagian Kapit', 'Bahagian Kuching', 'Bahagian Limbang',
             'Bahagian Miri', 'Bahagian Mukah', 'Bahagian Samarahan', 'Bahagian Sarikei', 'Bahagian Serian',
             'Bahagian Sibu', 'Bahagian Sri Aman'],
 'Selangor': ['Gombak', 'Hulu Langat', 'Hulu Selangor', 'Klang', 'Kuala Langat', 'Kuala Selangor', 'Petaling',
              'Sabak Bernam', 'Sepang'],
 'Terengganu': ['Besut', 'Dungun', 'Hulu Terengganu', 'Kemaman', 'Kuala Nerus', 'Kuala Terengganu', 'Marang', 'Setiu'],
 'W.P. Kuala Lumpur': ['Kuala Lumpur'], 'W.P. Labuan': ['Labuan'], 'W.P. Putrajaya': ['Putrajaya'],
}
FIX = {'DAERAH KECIL MUADZAM SHAH': 'Daerah Kecil Muadzam Shah', 'Bahagian Sarikie': 'Bahagian Sarikei'}
TYPE = {'2 - 2 1/2 Storey Terraced': ('terrace', 2), '1 - 1 1/2 Storey Terraced': ('terrace', 1),
        '1 - 1 1/2 Storey Semi-Detached': ('semi_detached', 1), '2 - 2 1/2 Storey Semi-Detached': ('semi_detached', 2),
        'Condominium/Apartment': ('condo', 0), 'Low-Cost House': ('low_cost_house', 0), 'Low-Cost Flat': ('low_cost_flat', 0),
        'Detached': ('detached', 0), 'Flat': ('flat', 0), 'Cluster House': ('cluster', 0), 'Town House': ('townhouse', 0)}


def load_raw(path):
    df = pd.read_csv(path, encoding='utf-16', sep='\t', dtype=str, header=0).iloc[:, :13]
    df.columns = ['ptype', 'district', 'mukim', 'scheme', 'road', 'month', 'tenure', 'land', 'land_unit', 'floor',
                  'floor_unit', 'unit_level', 'price']
    for c in df.columns: df[c] = df[c].str.strip()
    return df


def clean(df):
    log = {'raw_rows': len(df)}
    df = df.copy()
    df['district'] = df.district.replace(FIX)
    d2s = {d: s for s, ds in STATE.items() for d in ds}
    miss = sorted(set(df.district) - set(d2s)); assert not miss, f'unmapped districts: {miss}'
    df['state'] = df.district.map(d2s)
    df['property_type'] = df.ptype.map(lambda x: TYPE[x][0]); df['storeys'] = df.ptype.map(lambda x: TYPE[x][1])
    df['date'] = pd.to_datetime(df.month, format='%B %Y')
    df['quarter'] = df.date.dt.year.astype(str) + 'Q' + df.date.dt.quarter.astype(str)
    df['price_rm'] = pd.to_numeric(df.price.str.replace(r'[RM,]', '', regex=True), errors='coerce')
    df['land_area'] = pd.to_numeric(df.land.str.replace(',', ''), errors='coerce')
    df['floor_area'] = pd.to_numeric(df.floor.str.replace(',', ''), errors='coerce')
    df['unit_level'] = df.unit_level.replace('', np.nan)
    keep = ['state', 'district', 'mukim', 'scheme', 'road', 'date', 'quarter', 'property_type', 'storeys', 'ptype',
            'tenure', 'land_area', 'floor_area', 'unit_level', 'price_rm']
    df = df[keep]
    n0 = len(df); df = df.drop_duplicates(); log['exact_duplicates_removed'] = n0 - len(df)
    n0 = len(df); df = df[df.price_rm >= 50000]; log['under_50k_removed'] = n0 - len(df)
    df['size_m2'] = df.floor_area.where(df.floor_area > 0, df.land_area.where(df.land_area > 0))
    n0 = len(df); df = df[df.size_m2.between(15, 5000)]; log['bad_size_removed'] = n0 - len(df)
    lppsm = np.log(df.price_rm / df.size_m2)
    lo = lppsm.groupby(df.property_type).transform(lambda s: s.quantile(0.005))
    hi = lppsm.groupby(df.property_type).transform(lambda s: s.quantile(0.995))
    n0 = len(df); df = df[(lppsm >= lo) & (lppsm <= hi)]; log['price_per_m2_outliers_removed'] = n0 - len(df)
    log['clean_rows'] = len(df)
    return df.reset_index(drop=True), log


if __name__ == '__main__':
    raw = load_raw(sys.argv[1] if len(sys.argv) > 1 else 'data/Open_Transaction_Data.csv')
    df, log = clean(raw)
    df.to_parquet('data/napic_clean.parquet', index=False)
    print(log)
