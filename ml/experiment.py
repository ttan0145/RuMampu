"""Lecturer protocol: train / validation / test by time, add one feature group at a time, keep what earns its place,
score the test months ONCE with the chosen set.

  train      2021Q1-2024Q2      (index + model fitted here for the ablation)
  validation 2024Q3-2025Q2      (all choices made here)
  test       2025Q3-2026Q2      (touched once, at the end)

Feature groups
  base   : district, mukim, scheme, road, type, storeys, tenure, size, land, floor, unit level, month (current model)
  local  : + location (lat/lon, geocode quality), distance to rail open AT SALE DATE, state capital, KL, motorway exit,
           hospital, college; counts of schools / clinics / shops / parks / places of worship within 1-2 km
  macro  : + OPR at sale month, CPI inflation (2-month publication lag), state unemployment (published quarter only),
           state median household income (latest survey published by the sale date)
    python experiment.py            -> out/exp/ablation.csv, out/exp/test_once.json, ...
"""
import os, json, pathlib, warnings, numpy as np, pandas as pd
warnings.filterwarnings('ignore')
import lightgbm as lgb
import ml_price_range as M
from build_index import make_index

OUT = pathlib.Path('out/exp'); OUT.mkdir(parents=True, exist_ok=True)
TRAIN_END, VAL_END = '2024Q2', '2025Q2'
FAST = os.environ.get('FAST') == '1'
N_TREES = 150 if FAST else 1500
BASE_CAT, BASE_NUM = list(M.CAT), list(M.NUM)
LOCAL = ['lat', 'lon', 'geo_precise', 'dist_rail_km', 'rail_within_1km', 'dist_state_capital_km', 'dist_kl_km',
         'dist_mway_exit_km', 'dist_hospital_km', 'dist_tertiary_km', 'dist_school_km', 'n_school_1km', 'n_school_2km',
         'dist_clinic_km', 'n_clinic_1km', 'n_clinic_2km', 'dist_shop_km', 'n_shop_1km', 'n_shop_2km', 'dist_park_km',
         'n_park_1km', 'dist_worship_km', 'n_worship_1km']
MACRO = ['opr', 'cpi_yoy', 'urate_state', 'hh_income_median']
HH_PUBLISHED = {2016: '2017-10-01', 2019: '2020-07-01', 2022: '2023-07-01', 2024: '2025-07-01'}


# ---------------- features ----------------
def add_local(df):
    F = pd.read_csv('data/scheme_features.csv')
    skey = df.district + '|' + df['mukim_raw'].fillna('?').str.upper().str.strip() + '|' + df['scheme_raw'].fillna('?').str.upper().str.strip()
    d = df.assign(skey=skey.values).merge(F, on='skey', how='left')
    rail_cols = [c for c in F.columns if c.startswith('rail_')]
    sale = pd.to_datetime(d.date)
    dist = np.full(len(d), np.inf)
    for c in rail_cols:
        opened = pd.Timestamp(c.split('_', 1)[1])
        dist = np.where(sale >= opened, np.minimum(dist, d[c].values), dist)
    d['dist_rail_km'] = np.where(np.isinf(dist), np.nan, dist)
    d['rail_within_1km'] = (d.dist_rail_km <= 1).astype(int)
    return d.drop(columns=rail_cols + ['skey'])


def add_macro(df):
    m = pd.to_datetime(df.date).dt.to_period('M').dt.to_timestamp()
    opr = pd.read_csv('data/macro/opr_changes.csv', parse_dates=['effective_date']).sort_values('effective_date')
    mid = m + pd.Timedelta(days=14)
    df['opr'] = pd.merge_asof(pd.DataFrame({'t': mid.values}).reset_index().sort_values('t'), opr, left_on='t',
                              right_on='effective_date').sort_values('index').opr.values
    cpi = pd.Series({pd.Timestamp(k + '-01'): float(v) for k, v in (x.split(':') for x in open('data/macro/cpi_raw.txt').read().split())})
    yoy = (cpi / cpi.shift(12) - 1) * 100
    df['cpi_yoy'] = (m - pd.DateOffset(months=2)).map(yoy).values                    # published ~3-4 weeks after month end
    lines = open('data/macro/lfs_urate_raw.txt').read().strip().split('\n')
    qd = [pd.Timestamp(x + '-01') for x in lines[0].split(' ', 1)[1].split(',')]
    U = {l.split(':')[0]: pd.Series([float(v) for v in l.split(': ')[1].split(',')], index=qd) for l in lines[1:]}
    def urate(state, t):
        s = U[state]; avail = s[[q + pd.DateOffset(months=5) <= t for q in s.index]]   # quarter published ~2 months after it ends
        return avail.iloc[-1] if len(avail) else np.nan
    key = pd.DataFrame({'state': df.state.values, 't': m.values}).drop_duplicates()
    key['u'] = [urate(s, t) for s, t in zip(key.state, key.t)]
    df['urate_state'] = pd.DataFrame({'state': df.state.values, 't': m.values}).merge(key, on=['state', 't'], how='left').u.values
    hh = {}
    for chunk in open('data/macro/hh_income_raw.txt').read().replace('\n', ';').split(';'):
        if chunk: y, s, mean, med = chunk.split('|'); hh[(int(y), s)] = float(med)
    def inc(state, t):
        ys = [y for y, p in HH_PUBLISHED.items() if pd.Timestamp(p) <= t and (y, state) in hh]
        return hh[(max(ys), state)] if ys else np.nan
    key['h'] = [inc(s, t) for s, t in zip(key.state, key.t)]
    df['hh_income_median'] = pd.DataFrame({'state': df.state.values, 't': m.values}).merge(key, on=['state', 't'], how='left').h.values
    return df


def build():
    raw = pd.read_parquet('data/napic_clean.parquet')
    df = M.features(raw.assign(mukim_raw=raw.mukim, scheme_raw=raw.scheme))
    df = add_macro(add_local(df))
    return raw, df


# ---------------- model ----------------
class LGBQ(M.LGBQuantile):
    def __init__(self, cat, num, alphas=(0.5,), n=None):
        super().__init__(n or N_TREES); self.cat, self.num, self.alphas = cat, num, list(alphas)
    def _X(self, d, fit=False):
        X = d[self.cat + self.num].copy()
        for c in self.cat:
            if c in M.HIGH_CARD:
                if fit:
                    vc = X[c].value_counts(); keep = vc.index[vc >= M.MIN_CAT]
                    self.cats[c] = pd.Index(sorted(keep)).append(pd.Index(['__rare__']))
                X[c] = X[c].where(X[c].isin(self.cats[c]), '__rare__')
            elif fit: self.cats[c] = pd.Categorical(X[c]).categories
            X[c] = pd.Categorical(X[c], categories=self.cats[c])
        return X
    def fit(self, d):
        X = self._X(d, True); self.models = []
        for a in self.alphas:
            m = lgb.LGBMRegressor(objective='quantile', alpha=a, n_estimators=self.n, learning_rate=0.05, num_leaves=127,
                                  min_child_samples=30, cat_smooth=30, max_cat_to_onehot=8, subsample=0.8, subsample_freq=1,
                                  colsample_bytree=0.8, random_state=M.SEED, verbose=-1)
            m.fit(X, d.r); self.models.append(m)
        return self
    def predict_raw(self, d):
        X = self._X(d); P = np.column_stack([m.predict(X) for m in self.models])
        return M.fixq(P) if P.shape[1] > 1 else P


def score(name, d, p50, extra=None):
    y = d.lp.values; ape = np.abs(np.expm1(p50 - y))
    landed = d.property_type.isin(['terrace', 'semi_detached', 'detached', 'cluster', 'townhouse', 'low_cost_house']).values
    r = dict(feature_set=name, n=len(y), median_APE=np.median(ape), within_10pct=(ape <= .1).mean(), within_20pct=(ape <= .2).mean(),
             pinball50=np.mean(np.abs(p50 - y)) / 2, median_APE_landed=np.median(ape[landed]), median_APE_strata=np.median(ape[~landed]))
    if extra is not None: r['median_APE_new_schemes'] = np.median(ape[extra]); r['n_new_schemes'] = int(extra.sum())
    return r


def main():
    raw, df = build()
    Q = sorted(df.quarter.unique()); it, iv = Q.index(TRAIN_END), Q.index(VAL_END)
    Qtr, Qva, Qte = Q[:it + 1], Q[it + 1:iv + 1], Q[iv + 1:]
    print('train', Qtr[0], Qtr[-1], '| val', Qva[0], Qva[-1], '| test', Qte[0], Qte[-1], '| rows', len(df))
    geo = pd.read_json('out/geocode_report.json') if pathlib.Path('out/geocode_report.json').exists() else None
    # ---- ablation on validation (index from training sales only, extrapolated) ----
    ix_tr, _ = make_index(raw[raw.quarter.isin(Qtr)])
    d = M.attach_index(df.assign(scode=df.state.map(M.SCODE)) if 'scode' not in df else df, ix_tr, Qtr); d['r'] = d.lp - d.idx
    tr, va = d[d.quarter.isin(Qtr)], d[d.quarter.isin(Qva)]
    new_va = ~va.scheme.isin(set(tr.scheme)).values
    sets = [('base', BASE_CAT, BASE_NUM), ('base + local', BASE_CAT, BASE_NUM + LOCAL),
            ('base + local + macro', BASE_CAT, BASE_NUM + LOCAL + MACRO), ('base + macro', BASE_CAT, BASE_NUM + MACRO)]
    rows, models = [], {}
    for name, cat, num in sets:
        m = LGBQ(cat, num).fit(tr); p = m.predict_raw(va)[:, 0] + va.idx.values
        rows.append(score(name, va, p, new_va)); models[name] = m; print(rows[-1], flush=True)
    ab = pd.DataFrame(rows); ab.to_csv(OUT / 'ablation_validation.csv', index=False, float_format='%.4f')
    # choose: smallest validation pinball; a group must cut median APE by >= 0.1 point to be kept
    best = ab.iloc[0]
    for _, r in ab.iloc[1:].iterrows():
        if r.pinball50 < best.pinball50 and r.median_APE <= best.median_APE - 0.001: best = r
    chosen = best.feature_set; cat, num = next((c, n) for nm, c, n in sets if nm == chosen)
    print('CHOSEN on validation:', chosen, flush=True)
    # SHAP for the local+macro model on validation (associations)
    m_all = models['base + local + macro']; samp = va.sample(min(6000, len(va)), random_state=M.SEED)
    sv = np.vstack([m_all.models[0].predict(m_all._X(samp.iloc[i:i + 1000]), pred_contrib=True)[:, :-1] for i in range(0, len(samp), 1000)])
    feats = m_all.cat + m_all.num
    imp = pd.DataFrame({'feature': feats, 'mean_abs_shap': np.abs(sv).mean(0)}).sort_values('mean_abs_shap', ascending=False)
    imp['share'] = imp.mean_abs_shap / imp.mean_abs_shap.sum(); imp.to_csv(OUT / 'shap_all_features_validation.csv', index=False)
    np.save(OUT / 'shap_values_validation.npy', sv.astype('float32')); samp[feats + ['property_type', 'lp', 'idx']].to_csv(OUT / 'shap_sample_validation.csv.gz', index=False)

    # ---- test ONCE: chosen set; index + model from train+validation; conformal bands calibrated on the last val quarter ----
    trv = Qtr + Qva
    ix_tv, _ = make_index(raw[raw.quarter.isin(trv)])
    d2 = M.attach_index(df.assign(scode=df.state.map(M.SCODE)) if 'scode' not in df else df, ix_tv, trv); d2['r'] = d2.lp - d2.idx
    fit_, cal, te = d2[d2.quarter.isin(trv[:-1])], d2[d2.quarter == trv[-1]], d2[d2.quarter.isin(Qte)]
    new_te = ~te.scheme.isin(set(d2[d2.quarter.isin(trv)].scheme)).values
    res = {}
    for name in dict.fromkeys(['base', chosen]):
        c_, n_ = next((c, n) for nm, c, n in sets if nm == name)
        q = LGBQ(c_, n_, alphas=M.ALPHAS, n=None if FAST else 2000).fit(fit_).calibrate(cal)
        P = q.predict(te) + te.idx.values[:, None]
        r = M.report(name, te.lp.values, P); r.update({k: v for k, v in score(name, te, P[:, 1], new_te).items() if k not in r})
        res[name] = r; print('TEST', r, flush=True)
    json.dump(dict(periods=dict(train=[Qtr[0], Qtr[-1]], validation=[Qva[0], Qva[-1]], test=[Qte[0], Qte[-1]]),
                   chosen_on_validation=chosen, test=res), open(OUT / 'test_once.json', 'w'), indent=1, default=float)


if __name__ == '__main__':
    main()
