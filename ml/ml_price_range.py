"""RuMampu ML price-range model: "what do homes like this sell for?" (P10 / P50 / P90), plus 1-3 year what-ifs.

Design (two parts, so the ML never has to extrapolate time):
  price(home, quarter) = hedonic index[state, type, quarter]  x  relative price of this home
  * index part : the quality-adjusted state x type index (build_index.make_index)
  * home part  : LightGBM quantile models (P10/P50/P90) on  ln(price) - index  <- district, mukim, scheme, road,
                 type, storeys, tenure, size, land, floor, unit level, month (mukim/scheme/road with < 20 sales are
                 pooled as '__rare__'); bands made honest by split-conformal
                 calibration on the last training quarter. (CatBoost MultiQuantile was also tried: run 1, slightly
                 worse and 5x slower; numbers kept in out/ml/run1_metrics.json.)
  * future     : x Bayesian hierarchical trend draws (bayes_trend.py) for 1/2/3-year what-ifs

Honest out-of-time test: the index AND the model are built only from sales up to TRAIN_END; test quarters are
priced with the last training index + that type's recent trend, exactly as the app would price "next year".

    python ml_price_range.py            (reads data/napic_clean.parquet from prep_napic.py)
Outputs in out/ml/: metrics.json, metrics_by_{type,state,price_band}.csv, test_predictions.csv.gz,
                    feature_importance.csv, shap_summary.png, calibration.png, model/ (lgbm_p10/p50/p90.txt + lgbm_meta.json:
                    plain LightGBM files, reload with LGBQuantile.load), price_range_grid.csv
"""
import os, json, pathlib, warnings, numpy as np, pandas as pd
warnings.filterwarnings('ignore')
from catboost import CatBoostRegressor, Pool
import lightgbm as lgb
from build_index import make_index
from train_price_index import SCODE

OUT = pathlib.Path('out/ml'); OUT.mkdir(parents=True, exist_ok=True)
ALPHAS = [0.1, 0.5, 0.9]
CAT = ['state', 'district', 'mukim', 'scheme', 'road', 'property_type', 'tenure']
NUM = ['storeys', 'ln_size', 'ln_land', 'ln_floor', 'has_floor', 'level', 'month']
TRAIN_END = '2025Q2'          # test = the 4 quarters after this (2025Q3-2026Q2)
TREND_Q = 8                   # quarters of index used for the recent-trend adjustment
SEED = 7
HIGH_CARD = ['mukim', 'scheme', 'road']
MIN_CAT = 20
FAST = os.environ.get('FAST') == '1'


# ---------------- features ----------------
def features(df):
    df = df.copy()
    df['lp'] = np.log(df.price_rm.astype(float)); df['ln_size'] = np.log(df.size_m2)
    df['ln_land'] = np.log(df.land_area.where(df.land_area > 0)).fillna(-1)
    df['ln_floor'] = np.log(df.floor_area.where(df.floor_area > 0)).fillna(-1)
    df['has_floor'] = (df.floor_area > 0).astype(int)
    lv = df.unit_level.astype(str).str.upper().str.strip()
    df['level'] = pd.to_numeric(lv.replace({'G': '0', 'LG': '0', 'UG': '0', 'M': '1', 'NAN': None, 'NONE': None}),
                                errors='coerce').fillna(-1).clip(-1, 80)
    df['month'] = pd.to_datetime(df.date).dt.month
    U = lambda s: s.fillna('?').astype(str).str.upper().str.strip()
    df['mukim'] = df.district + '|' + U(df.mukim)
    df['scheme'] = df.mukim + '|' + U(df.scheme)
    df['road'] = df.mukim + '|' + U(df.road)
    df['tenure'] = df.tenure.str[0]
    df['scode'] = df.state.map(SCODE)
    for c in CAT: df[c] = df[c].astype(str)
    return df


def attach_index(df, ix, Q_known, h_trend=True):
    """adds column idx = log index for the sale's (type, state, quarter). Quarters after Q_known[-1] are
    extrapolated from the last known value + national type trend over the last TREND_Q quarters."""
    tab = ix.set_index(['type', 'state', 'quarter']).y
    nat = ix[ix.state == 'ALL'].pivot(index='quarter', columns='type', values='y').reindex(Q_known).ffill()
    slope = (nat.iloc[-1] - nat.iloc[-1 - TREND_Q]) / TREND_Q
    last = Q_known[-1]
    allq = sorted(set(Q_known) | set(df.quarter))
    pos = {q: i for i, q in enumerate(allq)}
    def get(t, s, q):     # state series, else the national series of that type (state has no sales of it)
        v = tab.get((t, s, q), np.nan)
        return tab.get((t, 'ALL', q), np.nan) if np.isnan(v) else v
    def f(r):
        if r.quarter in Q_known: return get(r.property_type, r.scode, r.quarter)
        h = pos[r.quarter] - pos[last]
        return get(r.property_type, r.scode, last) + (slope[r.property_type] * h if h_trend else 0)
    key = df[['property_type', 'scode', 'quarter']].drop_duplicates()
    key['idx'] = [f(r) for r in key.itertuples()]
    return df.merge(key, on=['property_type', 'scode', 'quarter'], how='left')


# ---------------- metrics ----------------
def pinball(y, q, a): d = y - q; return np.mean(np.maximum(a * d, (a - 1) * d))
def report(name, y, P):
    ape = np.abs(np.expm1(P[:, 1] - y))
    return dict(model=name, n=int(len(y)), median_APE=float(np.median(ape)), MAPE=float(ape.mean()),
                within_10pct=float((ape <= .10).mean()), within_20pct=float((ape <= .20).mean()),
                coverage80=float(((y >= P[:, 0]) & (y <= P[:, 2])).mean()),
                median_width80_pct=float(np.median(np.expm1(P[:, 2] - P[:, 0]))),
                bias_pct=float(np.median(np.expm1(P[:, 1] - y))),
                pinball=float(np.mean([pinball(y, P[:, i], a) for i, a in enumerate(ALPHAS)])))
fixq = lambda P: np.sort(P, axis=1)


# ---------------- models (all predict the residual r = lp - idx) ----------------
def m_hedonic(tr, te):
    """district x type FE + type-specific size slope + type x tenure; residual quantiles by type for the band"""
    import scipy.sparse as sp
    from sklearn.linear_model import Ridge
    from sklearn.preprocessing import OneHotEncoder
    enc = OneHotEncoder(handle_unknown='ignore')
    def X(d, fit=False):
        cat = np.c_[(d.district + '|' + d.property_type).values, (d.property_type + '|' + d.tenure).values]
        A = enc.fit_transform(cat) if fit else enc.transform(cat)
        S = sp.csr_matrix(pd.get_dummies(d.property_type).reindex(columns=sorted(tr.property_type.unique()), fill_value=0)
                          .mul(d.ln_size.values, axis=0).astype(float).values)
        return sp.hstack([A, S]).tocsr()
    m = Ridge(alpha=1e-2).fit(X(tr, True), tr.r)
    res = tr.r - m.predict(X(tr)); rq = res.groupby(tr.property_type).quantile(ALPHAS).unstack()
    p = m.predict(X(te))
    return np.c_[p + te.property_type.map(rq[0.1]).values, p, p + te.property_type.map(rq[0.9]).values]


def m_lgbm(tr, te):
    Xtr, Xte = tr[CAT + NUM].copy(), te[CAT + NUM].copy()
    for c in CAT:
        cats = pd.Categorical(Xtr[c]).categories
        Xtr[c] = pd.Categorical(Xtr[c], categories=cats); Xte[c] = pd.Categorical(Xte[c], categories=cats)
    P = []
    for a in ALPHAS:
        m = lgb.LGBMRegressor(objective='quantile', alpha=a, n_estimators=100 if FAST else 2000, learning_rate=0.05,
                              num_leaves=127, min_child_samples=30, cat_smooth=30, max_cat_to_onehot=8,
                              subsample=0.8, subsample_freq=1, colsample_bytree=0.8, random_state=SEED, verbose=-1)
        m.fit(Xtr, tr.r); P.append(m.predict(Xte))
    return np.column_stack(P)


def cb_model(iters, early=True):
    es = dict(od_type='Iter', od_wait=150, verbose=500) if early else dict(verbose=0)
    return CatBoostRegressor(loss_function='MultiQuantile:alpha=' + ','.join(map(str, ALPHAS)), iterations=iters,
                             depth=8, learning_rate=0.08, l2_leaf_reg=3, random_seed=SEED, thread_count=-1,
                             one_hot_max_size=12, **es)


class LGBQuantile:
    """three LightGBM quantile models (P10/P50/P90) on the residual target + split-conformal widening per type"""
    def __init__(self, n_estimators=None):
        self.n = n_estimators or (100 if FAST else 2000); self.models = []; self.cats = {}; self.offset = {}
    def _X(self, d, fit=False):
        X = d[CAT + NUM].copy()
        for c in CAT:
            if c in HIGH_CARD:   # rare mukim / scheme / road (< MIN_CAT sales) share one '__rare__' level: smaller, steadier model
                if fit:
                    vc = X[c].value_counts(); keep = vc.index[vc >= MIN_CAT]
                    self.cats[c] = pd.Index(sorted(keep)).append(pd.Index(['__rare__']))
                X[c] = X[c].where(X[c].isin(self.cats[c]), '__rare__')
            elif fit: self.cats[c] = pd.Categorical(X[c]).categories
            X[c] = pd.Categorical(X[c], categories=self.cats[c])
        return X
    def fit(self, d):
        X = self._X(d, True); self.models = []
        for a in ALPHAS:
            m = lgb.LGBMRegressor(objective='quantile', alpha=a, n_estimators=self.n, learning_rate=0.05, num_leaves=127,
                                  min_child_samples=30, cat_smooth=30, max_cat_to_onehot=8, subsample=0.8, subsample_freq=1,
                                  colsample_bytree=0.8, random_state=SEED, verbose=-1)
            m.fit(X, d.r); self.models.append(m)
        return self
    def predict_raw(self, d):
        X = self._X(d); return fixq(np.column_stack([m.predict(X) for m in self.models]))
    def save(self, folder):
        """plain LightGBM text models + JSON (categories, conformal offsets); no pickle needed to reload"""
        folder = pathlib.Path(folder); folder.mkdir(parents=True, exist_ok=True)
        for a, m in zip(ALPHAS, self.models):
            b = m.booster_ if hasattr(m, 'booster_') else m
            b.save_model(str(folder / f'lgbm_p{int(a*100)}.txt'))
        json.dump(dict(alphas=ALPHAS, cat=CAT, num=NUM, offsets=self.offset,
                       categories={c: list(map(str, v)) for c, v in self.cats.items()}), open(folder / 'lgbm_meta.json', 'w'))
    @classmethod
    def load(cls, folder):
        folder = pathlib.Path(folder); meta = json.load(open(folder / 'lgbm_meta.json')); o = cls()
        o.cats = {c: pd.Index(v) for c, v in meta['categories'].items()}; o.offset = meta['offsets']
        o.models = [lgb.Booster(model_file=str(folder / f'lgbm_p{int(a*100)}.txt')) for a in meta['alphas']]
        return o
    def calibrate(self, d, target=0.8):
        """split-conformal (CQR): widen/narrow the P10-P90 band per property type so it holds `target` of held-out sales"""
        P = self.predict_raw(d); s = np.maximum(P[:, 0] - d.r.values, d.r.values - P[:, 2])
        g = pd.Series(s).groupby(d.property_type.values)
        allq = np.quantile(s, min(1, target * (1 + 1 / len(s))))
        self.offset = {t: (np.quantile(v, min(1, target * (1 + 1 / len(v)))) if len(v) >= 200 else allq) for t, v in g}
        self.offset['_all'] = allq; return self
    def predict(self, d):
        P = self.predict_raw(d); off = d.property_type.map(lambda t: self.offset.get(t, self.offset.get('_all', 0))).values
        return np.c_[P[:, 0] - off, P[:, 1], P[:, 2] + off]


def main():
    import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
    raw = pd.read_parquet('data/napic_clean.parquet')
    df = features(raw); Q = sorted(df.quarter.unique()); iend = Q.index(TRAIN_END)
    if os.environ.get('PROD_ONLY') == '1':          # skip the test; train + save the production model, SHAP, grid
        ix_all, _ = make_index(raw); return production(df, ix_all, Q, plt)
    if os.environ.get('GRID_ONLY') == '1':          # rebuild only the app grid (e.g. after refitting bayes_trend.py)
        ix_all, _ = make_index(raw); dA = attach_index(df, ix_all, Q)
        return make_grid(dA, ix_all, Q, LGBQuantile.load(OUT / 'model'))
    Qtr, Qte = Q[:iend + 1], Q[iend + 1:]
    print('rows', len(df), '| train', Qtr[0], '-', Qtr[-1], '| test', Qte[0], '-', Qte[-1])
    # ---- index from TRAINING sales only, extrapolated into the test quarters ----
    ix_tr, _ = make_index(raw[raw.quarter.isin(Qtr)])
    d = attach_index(df, ix_tr, Qtr); d['r'] = d.lp - d.idx
    tr, te = d[d.quarter.isin(Qtr)].reset_index(drop=True), d[d.quarter.isin(Qte)].reset_index(drop=True)
    fit_tr, cal = tr[tr.quarter != Qtr[-1]], tr[tr.quarter == Qtr[-1]]          # last training quarter = calibration set
    y = te.lp.values; base = te.idx.values[:, None]; res = []
    # reference 1: median sale of the same type in the same district during the last training year
    last4 = tr[tr.quarter.isin(Qtr[-4:])]
    med = last4.groupby(['district', 'property_type']).lp.quantile(ALPHAS).unstack()
    Pn = te[['district', 'property_type']].merge(med, left_on=['district', 'property_type'], right_index=True, how='left')[ALPHAS].values
    ok = ~np.isnan(Pn).any(1)
    res.append(dict(report('district x type median, last year', y[ok], Pn[ok]), note=f'{ok.mean():.1%} of test rows matched'))
    # reference 2: hedonic linear (same index)
    res.append(report('hedonic linear', y, fixq(m_hedonic(tr, te) + base))); print(res[-1]['model'], round(res[-1]['median_APE'], 4))
    # main: LightGBM quantile + conformal calibration
    lq = LGBQuantile().fit(fit_tr)
    res.append(report('LightGBM quantile (raw bands)', y, lq.predict_raw(te) + base))
    lq.calibrate(cal); P = lq.predict(te) + base
    res.append(report('LightGBM quantile + conformal bands', y, P)); print(res[-1])
    new = ~te.scheme.isin(set(tr.scheme)).values
    res.append(report('  ...schemes never seen in training', y[new], P[new]))
    ix_all, _ = make_index(raw)
    te_true = attach_index(te.drop(columns='idx'), ix_all, Q)
    res.append(report('  ...with actual index (time error removed)', y, P - base + te_true.idx.values[:, None]))
    run1 = OUT / 'run1_metrics.json'
    if run1.exists():
        for r in json.load(open(run1))['models']:
            if r['model'].startswith('catboost'): res.append(dict(r, model='CatBoost MultiQuantile (run 1, raw bands)'))
    met = pd.DataFrame(res); print(met.round(4).to_string())
    by = lambda col: pd.DataFrame([report(v, y[m], P[m]) for v in sorted(te[col].unique()) for m in [(te[col] == v).values]])
    by('property_type').to_csv(OUT / 'metrics_by_type.csv', index=False, float_format='%.4f')
    by('state').to_csv(OUT / 'metrics_by_state.csv', index=False, float_format='%.4f')
    te['pband'] = pd.cut(np.exp(P[:, 1]), [0, 200e3, 300e3, 500e3, 800e3, 1.5e6, 1e12],
                         labels=['<200k', '200-300k', '300-500k', '500-800k', '0.8-1.5m', '>1.5m'])
    by('pband').to_csv(OUT / 'metrics_by_price_band.csv', index=False, float_format='%.4f')
    out = te[['state', 'district', 'mukim', 'scheme', 'quarter', 'property_type', 'storeys', 'tenure', 'size_m2', 'price_rm']].copy()
    out[['p10', 'p50', 'p90']] = np.exp(P).round(-3); out.to_csv(OUT / 'test_predictions.csv.gz', index=False)
    # calibration by decile of predicted price
    tc = pd.DataFrame({'p50': np.exp(P[:, 1]), 'y': np.exp(y)}); tc['bin'] = pd.qcut(tc.p50, 10, labels=False)
    cb_ = tc.groupby('bin').agg(pred=('p50', 'median'), actual=('y', 'median'))
    fig, ax = plt.subplots(figsize=(5, 5)); ax.plot(cb_.pred / 1e3, cb_.actual / 1e3, 'o-', color='#2a78d6', lw=2, ms=7)
    lim = [0, cb_.max().max() / 1e3 * 1.05]; ax.plot(lim, lim, color='#b8b7ae', lw=1, ls='--')
    ax.set_xlabel('Predicted typical price (RM k), median per decile'); ax.set_ylabel('Actual sale price (RM k), median per decile')
    ax.set_title(f'Unseen sales {Qte[0]}-{Qte[-1]}: predicted vs actual', loc='left', fontsize=10)
    for s in ('top', 'right'): ax.spines[s].set_visible(False)
    fig.tight_layout(); fig.savefig(OUT / 'calibration.png', dpi=130); plt.close(fig)

    json.dump(dict(train=[Qtr[0], Qtr[-1]], calibration_quarter=Qtr[-1], test=[Qte[0], Qte[-1]], train_rows=int(len(tr)),
                   test_rows=int(len(te)), conformal_offsets_test=lq.offset, models=res),
              open(OUT / 'metrics.json', 'w'), indent=1, default=float)
    production(df, ix_all, Q, plt)


def production(df, ix_all, Q, plt):
    """production model: all data + full index; conformal offsets re-estimated on the last quarter"""
    dA = attach_index(df, ix_all, Q); dA['r'] = dA.lp - dA.idx
    final = LGBQuantile().fit(dA[dA.quarter != Q[-1]]).calibrate(dA[dA.quarter == Q[-1]])
    offsets = final.offset; final = LGBQuantile().fit(dA); final.offset = offsets
    final.save(OUT / 'model')
    # SHAP (TreeSHAP built into LightGBM) for the P50 model on a sample
    samp = dA.sample(min(len(dA), 8000), random_state=SEED)
    sv = np.vstack([final.models[1].predict(final._X(samp.iloc[i:i + 1000]), pred_contrib=True)[:, :-1]
                    for i in range(0, len(samp), 1000)])
    imp = pd.DataFrame({'feature': CAT + NUM, 'mean_abs_shap': np.abs(sv).mean(0)}).sort_values('mean_abs_shap', ascending=False)
    imp['share'] = imp.mean_abs_shap / imp.mean_abs_shap.sum(); imp.to_csv(OUT / 'feature_importance.csv', index=False)
    nice = {'district': 'District', 'mukim': 'Mukim', 'scheme': 'Scheme / taman', 'road': 'Road', 'state': 'State',
            'property_type': 'Property type', 'tenure': 'Tenure', 'storeys': 'Storeys', 'ln_size': 'Size',
            'ln_land': 'Land area', 'ln_floor': 'Floor area', 'has_floor': 'Has floor area', 'level': 'Unit level',
            'month': 'Month'}
    fig, ax = plt.subplots(figsize=(7, 4.4)); ax.barh([nice[f] for f in imp.feature[::-1]], 100 * imp.share[::-1], color='#2a78d6', height=.6)
    ax.set_xlabel('Share of the price difference explained, beyond the state x type index (mean |SHAP|, %)', fontsize=8)
    ax.set_title('What makes one home dearer than another', loc='left', fontsize=10)
    for s in ('top', 'right'): ax.spines[s].set_visible(False)
    fig.tight_layout(); fig.savefig(OUT / 'shap_summary.png', dpi=130); plt.close(fig)
    json.dump(offsets, open(OUT / 'conformal_offsets_production.json', 'w'), indent=1, default=float)
    print(imp.round(3).to_string())
    make_grid(dA, ix_all, Q, final)


def make_grid(dA, ix_all, Q, final):
    """app grid: district x type x tenure x size band, priced at the latest quarter, + Bayesian what-ifs"""
    bayes = {}
    bp = pathlib.Path('out/bayes_scenarios_lookup.csv')
    if bp.exists():
        for r in pd.read_csv(bp).itertuples():
            bayes[(r.property_type, r.state_code, r.years)] = (np.log1p(r.growth_low), np.log1p(r.growth_mid), np.log1p(r.growth_high))
    recent = dA[dA.quarter.isin(Q[-8:])]
    combos = recent.groupby(['state', 'scode', 'district', 'property_type', 'tenure']).agg(
        n=('lp', 'size'), s25=('ln_size', lambda s: s.quantile(.25)), s50=('ln_size', 'median'),
        s75=('ln_size', lambda s: s.quantile(.75)), land=('ln_land', 'median'), floor=('ln_floor', 'median'),
        hasf=('has_floor', 'median'), storeys=('storeys', 'median'), level=('level', 'median')).reset_index()
    combos = combos[combos.n >= 10]
    G = []
    for r in combos.itertuples():
        for band, ls in (('small', r.s25), ('typical', r.s50), ('large', r.s75)):
            G.append(dict(state=r.state, scode=r.scode, district=r.district, mukim=r.district + '|?',
                          scheme=r.district + '|?|?', road=r.district + '|?|?', property_type=r.property_type,
                          tenure=r.tenure, storeys=round(r.storeys), ln_size=ls, ln_land=r.land if r.hasf else ls,
                          ln_floor=r.floor if r.hasf else -1, has_floor=int(round(r.hasf)), level=r.level, month=6,
                          size_band=band, n_sales_2y=r.n, quarter=Q[-1]))
    G = attach_index(pd.DataFrame(G), ix_all, Q)
    PG = final.predict(G) + G.idx.values[:, None]; rng = np.random.default_rng(SEED)
    G['size_m2'] = np.exp(G.ln_size).round(0); G[['p10', 'p50', 'p90']] = np.exp(PG).round(-3)
    NDRAW = 20000
    z, gz = rng.standard_normal(NDRAW), rng.standard_normal(NDRAW)     # common random numbers -> smooth across years
    W = {1: [], 2: [], 3: []}
    for i in range(len(G)):
        q10, q50, q90 = PG[i]
        x0 = q50 + np.where(z < 0, (q50 - q10), (q90 - q50)) / 1.2816 * z
        for yrs in (1, 2, 3):
            g = bayes.get((G.property_type[i], G.scode[i], yrs)) or bayes.get((G.property_type[i], 'ALL', yrs))
            x = x0
            if g is not None:
                gl, gm, gh = g; x = x0 + gm + np.where(gz < 0, gm - gl, gh - gm) / 1.2816 * gz
            W[yrs].append(np.exp(np.quantile(x, [.1, .5, .9])))
    for yrs in (1, 2, 3): G[[f'y{yrs}_p10', f'y{yrs}_p50', f'y{yrs}_p90']] = np.array(W[yrs]).round(-3)
    G.drop(columns=['scode', 'mukim', 'scheme', 'road', 'ln_size', 'ln_land', 'ln_floor', 'has_floor', 'level', 'month', 'idx']) \
     .to_csv(OUT / 'price_range_grid.csv', index=False)
    print('grid rows', len(G), '| bayes growth used:', bool(bayes))


if __name__ == '__main__':
    main()
