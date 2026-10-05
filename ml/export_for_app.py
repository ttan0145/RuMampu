"""Export the model outputs the app needs, in clean long-format CSVs ready for the Django loader.
    python export_for_app.py  -> app_export/*.csv + app_export/model_meta.json
"""
import json, pathlib, numpy as np, pandas as pd

OUT = pathlib.Path('app_export'); OUT.mkdir(exist_ok=True)
VERSION = 'pm-2026Q2-v3'
SCODE = {'Johor': 'JHR', 'Kedah': 'KDH', 'Kelantan': 'KTN', 'Melaka': 'MLK', 'Negeri Sembilan': 'NSN', 'Pahang': 'PHG',
         'Perak': 'PRK', 'Perlis': 'PLS', 'Pulau Pinang': 'PNG', 'Sabah': 'SBH', 'Sarawak': 'SWK', 'Selangor': 'SGR',
         'Terengganu': 'TRG', 'W.P. Kuala Lumpur': 'KUL', 'W.P. Labuan': 'LBN', 'W.P. Putrajaya': 'PJY'}

# 1) home price ranges: district x type x tenure x size band (today + 1/2/3-year what-ifs)
g = pd.read_csv('out/ml/price_range_grid.csv')
g.insert(0, 'state_code', g.state.map(SCODE)); g.insert(0, 'model_version', VERSION)
g.to_csv(OUT / 'price_range_cell.csv', index=False)

# 2) market scenarios: state x type x years (Bayesian trend)
b = pd.read_csv('out/bayes_scenarios_lookup.csv')
b = b[['state', 'state_code', 'property_type', 'years', 'target_quarter', 'growth_low', 'growth_mid', 'growth_high',
       'prob_price_fall', 'annual_trend', 'annual_trend_p10', 'annual_trend_p90', 'sales_last4q', 'data_quality']]
b.insert(0, 'model_version', VERSION); b.to_csv(OUT / 'price_scenario.csv', index=False)

# 3) price index points: state (or ALL) x type x quarter, 2021Q1 = 100
ix = pd.read_csv('out/price_index_state_type.csv')
ix['index_value'] = (np.exp(ix.y) * 100).round(2)
ix = ix.rename(columns={'state': 'state_code', 'type': 'property_type', 'n': 'sales'})[['state_code', 'property_type', 'quarter', 'index_value', 'sales']]
ix.insert(0, 'model_version', VERSION); ix.to_csv(OUT / 'price_index_point.csv', index=False)

# 4) neighbourhood drivers (within-district SHAP explanation model)
e = pd.read_csv('out/exp/explain_effects.csv')
e = e[e.model.str.startswith('B')][['feature', 'description', 'band', 'reference', 'n', 'effect_pct']]
e.insert(0, 'model_version', VERSION); e.to_csv(OUT / 'price_driver.csv', index=False)

# 5) accuracy by type (test on unseen sales Jul 2025-Jun 2026)
m = pd.read_csv('out/ml/metrics_by_type.csv').rename(columns={'model': 'property_type'})
m = m[['property_type', 'n', 'median_APE', 'within_10pct', 'within_20pct', 'coverage80']]
m.insert(0, 'model_version', VERSION); m.to_csv(OUT / 'price_accuracy.csv', index=False)

meta = dict(model_version=VERSION, data_source='NAPIC Open Transaction Data', data_window=['2021Q1', '2026Q2'],
            price_level_quarter='2026Q2', test_window=['2025Q3', '2026Q2'], test_sales=32070,
            overall=dict(median_APE=0.1115, within_20pct=0.739, coverage80=0.770),
            trend_backtest=dict(rmse_log_pct=3.44, coverage80=0.94),
            notes='What-if ranges, not valuations. Recent NAPIC quarters are incomplete (about 1/3 of usual records from 2024Q4).')
json.dump(meta, open(OUT / 'model_meta.json', 'w'), indent=1)
for f in sorted(OUT.glob('*')): print(f.name, f.stat().st_size, 'bytes', (sum(1 for _ in open(f)) - 1) if f.suffix == '.csv' else '')
