"""RuMampu price index -> backtest -> 1/2/3-year scenario bands.
Input : data/index_raw.txt  (hedonic state x type log index, 2024Q1..2026Q2, from hedonic.js / train_price_index.py)
        data/base_prices.txt (P25/P50/P75 sale price, last 4 quarters 2025Q3..2026Q2)
Output: out/*.csv, out/*.png
"""
from backtest_config import origins as _orig, HMAX
import numpy as np, pandas as pd, warnings, json, pathlib
from statsmodels.tsa.holtwinters import SimpleExpSmoothing
warnings.filterwarnings('ignore')
OUT = pathlib.Path('out'); OUT.mkdir(exist_ok=True)
Q = [f"{y}Q{k}" for y in (2024, 2025, 2026) for k in (1, 2, 3, 4)][:10]
for _l in open('data/index_raw.txt'):
    if _l.startswith('# quarters:'): Q = _l.split(':', 1)[1].split()
T = len(Q)
ORIGINS = _orig(Q)
SNAME = {'JHR':'Johor','KDH':'Kedah','KTN':'Kelantan','MLK':'Melaka','NSN':'Negeri Sembilan','PHG':'Pahang','PRK':'Perak',
         'PLS':'Perlis','PNG':'Pulau Pinang','SBH':'Sabah','SWK':'Sarawak','SGR':'Selangor','TRG':'Terengganu',
         'KUL':'W.P. Kuala Lumpur','LBN':'W.P. Labuan','PJY':'W.P. Putrajaya','ALL':'Malaysia'}

# ---------- 1. load index ----------
rows = []
for line in open('data/index_raw.txt'):
    if line.startswith('#') or not line.strip(): continue
    t, s, *cells = line.split()
    for qi, c in enumerate(cells):
        v, se, n = map(int, c.split(','))
        rows.append((t, s, qi, v / 1e4, se / 1e4, n))
df = pd.DataFrame(rows, columns=['type', 'state', 'qi', 'y', 'se', 'n'])
df['quarter'] = df.qi.map(dict(enumerate(Q)))

# all-type composites (fixed Laspeyres-style weights = each type's share of sales in that state over the window)
def composite(g):
    w = g.groupby('type').n.sum(); w = w / w.sum()
    piv = g.pivot(index='qi', columns='type', values='y')
    sep = g.pivot(index='qi', columns='type', values='se')
    y = (piv * w).sum(1); se = np.sqrt(((sep * w) ** 2).sum(1))
    n = g.groupby('qi').n.sum()
    return pd.DataFrame({'y': y, 'se': se, 'n': n}).reset_index()
comp = []
for s, g in df.groupby('state'):
    c = composite(g); c['type'] = 'all_types'; c['state'] = s; comp.append(c)
df = pd.concat([df, pd.concat(comp)], ignore_index=True)
df['quarter'] = df.qi.map(dict(enumerate(Q)))
df.to_csv(OUT / 'price_index_state_type.csv', index=False,
          columns=['type', 'state', 'quarter', 'y', 'se', 'n'], float_format='%.5f')

S = {k: g.sort_values('qi') for k, g in df.groupby(['type', 'state'])}

# ---------- 2. forecasting methods (all on log index, data up to index T0 inclusive) ----------
def ols_line(y, w=None):
    t = np.arange(len(y)); w = np.ones_like(y) if w is None else w
    X = np.c_[np.ones_like(t), t]; W = np.diag(w)
    b = np.linalg.solve(X.T @ W @ X, X.T @ W @ y)
    r = y - X @ b; s2 = (w * r ** 2).sum() / max(len(y) - 2, 1)
    cov = s2 * np.linalg.inv(X.T @ W @ X)
    return b, cov

def natslope(typ, T0):
    y = S[(typ, 'ALL')].y.values[:T0 + 1]
    b, cov = ols_line(y); return b[1], cov[1, 1]

def f_naive(y, se, typ, T0, H): return np.repeat(y[T0], H)
def f_drift(y, se, typ, T0, H):
    b, _ = ols_line(y[:T0 + 1]); return b[0] + b[1] * (T0 + np.arange(1, H + 1))
def f_pooled(y, se, typ, T0, H):
    g, _ = natslope(typ, T0); t = np.arange(T0 + 1)
    w = 1 / (se[:T0 + 1] ** 2 + 0.02 ** 2); a = np.sum(w * (y[:T0 + 1] - g * t)) / w.sum()
    return a + g * (T0 + np.arange(1, H + 1))
def f_shrunk(y, se, typ, T0, H):
    g, vg = natslope(typ, T0); b, cov = ols_line(y[:T0 + 1])
    tau2 = 0.004 ** 2                                   # between-state spread of true quarterly drifts
    k = tau2 / (tau2 + cov[1, 1]); slope = k * b[1] + (1 - k) * g
    t = np.arange(T0 + 1); w = 1 / (se[:T0 + 1] ** 2 + 0.02 ** 2)
    a = np.sum(w * (y[:T0 + 1] - slope * t)) / w.sum()
    return a + slope * (T0 + np.arange(1, H + 1))
def f_ses(y, se, typ, T0, H):
    m = SimpleExpSmoothing(y[:T0 + 1], initialization_method='estimated').fit()
    return m.forecast(H)
METHODS = {'naive': f_naive, 'own_trend': f_drift, 'national_trend': f_pooled, 'shrunk_trend': f_shrunk, 'ses': f_ses}

# ---------- 3. rolling-origin backtest ----------
bt = []
for (typ, st), g in S.items():
    y, se, n = g.y.values, g.se.values, g.n.values
    if n.sum() < 150 or (n == 0).sum() > 2: continue          # skip series that are mostly ridge-filled
    for T0 in ORIGINS:                                       # see backtest_config.py
        H = min(HMAX, T - 1 - T0)
        for name, f in METHODS.items():
            fc = f(y, se, typ, T0, H)
            for h in range(1, H + 1):
                bt.append((typ, st, name, T0, h, y[T0 + h] - fc[h - 1], n[T0 + h], se[T0 + h]))
bt = pd.DataFrame(bt, columns=['type', 'state', 'method', 'origin', 'h', 'err', 'n', 'se'])
bt['origin'] = bt.origin.map(dict(enumerate(Q)))
bt.to_csv(OUT / 'backtest_errors.csv', index=False, float_format='%.5f')

def wrmse(g): return np.sqrt(np.average(g.err ** 2, weights=g.n + 1))
summ = bt.groupby(['method', 'h']).apply(wrmse).unstack('h')
summ['all_h'] = bt.groupby('method').apply(wrmse)
summ['mae_all'] = bt.groupby('method').apply(lambda g: np.average(g.err.abs(), weights=g.n + 1))
# how much of the error is just index measurement noise in the target quarter
noise = np.sqrt(np.average(bt[bt.method == 'naive'].se ** 2, weights=bt[bt.method == 'naive'].n + 1))
summ = summ.sort_values('all_h')
summ.to_csv(OUT / 'backtest_summary.csv', float_format='%.4f')
print(summ.round(4)); print('avg target-noise SE', round(noise, 4))
BEST = summ.index[0]
print('best', BEST)

# ---------- 4. scenario bands (80%) ----------
# forecast error variance for horizon h (quarters):  v(h) = v_level + h*q + (h*sd_slope)^2
#   q      : quarterly innovation variance of the true index, from the national composites' q/q changes minus index noise
#   v_level: uncertainty of the current level
#   slope  : shrunk slope se
Z = 1.2816
SLOPE_FLOOR = 0.004   # ASSUMPTION: +-0.4%/quarter (~1.6%/yr) sd on the trend; recalibrate on MHPI 2010+ history
def series_fit(typ, st):
    g = S[(typ, st)]; y, se = g.y.values, g.se.values; T0 = T - 1
    fc = METHODS[BEST](y, se, typ, T0, 12)
    gnat, vg = natslope(typ, T0); b, cov = ols_line(y); tau2 = 0.004 ** 2
    k = tau2 / (tau2 + cov[1, 1]); vslope = k * cov[1, 1] + (1 - k) * vg if BEST in ('shrunk_trend',) else \
        (vg if BEST == 'national_trend' else cov[1, 1])
    vslope = max(vslope, SLOPE_FLOOR ** 2)                 # trend itself can shift; 10 quarters can't show that
    w = 1 / (se ** 2 + 0.02 ** 2); vlev = 1 / w.sum() + 0.02 ** 2 / 4
    slope = (fc[-1] - fc[0]) / 11
    level_now = fc[0] - slope                               # model's smoothed level at 2026Q2
    return y, se, fc, slope, vslope, vlev, level_now

# innovation variance from national all-type & big national type series
dq = []
for typ in ['all_types', 'terrace', 'condo', 'semi_detached', 'low_cost_house']:
    g = S[(typ, 'ALL')]; d = np.diff(g.y.values); dse = g.se.values
    noise_d = dse[1:] ** 2 + dse[:-1] ** 2
    dq.append(max(np.var(d, ddof=1) - noise_d.mean(), 0))
Qvar = float(np.mean(dq)); print('quarterly innovation sd', round(np.sqrt(Qvar), 4))

# empirical calibration factor: backtest |err| of BEST vs model sd at same h (target noise removed)
b = bt[bt.method == BEST].copy()
b['sd_model'] = np.sqrt(b.h * Qvar + 0.02 ** 2 / 4 + b.se ** 2)
cover = (b.err.abs() <= Z * b.sd_model).mean()
calib = np.quantile(np.abs(b.err) / b.sd_model, 0.8) / Z
calib = max(calib, 1.0)
print('80% coverage before calibration', round(cover, 3), 'calibration multiplier', round(calib, 3))

base = {}
for chunk in open('data/base_prices.txt').read().replace('\n', '~').split('~'):
    if not chunk: continue
    st, typ, n, p25, p50, p75 = chunk.split(';'); base[(st, typ)] = (int(n), int(p25), int(p50), int(p75))

rows = []
inv = {v: k for k, v in SNAME.items()}
for (typ, st), g in S.items():
    y, se, fc, slope, vslope, vlev, lvl = series_fit(typ, st)
    nwin = g.n.values[-4:].sum(); ntot = g.n.sum(); zeros = (g.n.values == 0).sum()
    quality = 'good' if nwin >= 200 else 'fair' if nwin >= 40 else 'thin'
    if zeros >= 3: quality = 'thin'
    bp = base.get((SNAME[st], typ))
    for yrs in (1, 2, 3):
        h = 4 * yrs
        mid = fc[h - 1] - lvl                                # log growth from 2026Q2 level
        sd = calib * np.sqrt(vlev + h * Qvar + (h ** 2) * vslope)
        lo, hi = mid - Z * sd, mid + Z * sd
        r = dict(state=SNAME[st], state_code=st, property_type=typ, years=yrs, target_quarter=f"{int(Q[-1][:4]) + yrs}{Q[-1][4:]}",
                 growth_low=np.expm1(lo), growth_mid=np.expm1(mid), growth_high=np.expm1(hi),
                 annual_trend=np.expm1(4 * slope), level_index_now=100 * np.exp(lvl), sales_last4q=int(nwin), data_quality=quality, method=BEST)
        if bp and st != 'ALL' and bp[0] >= 10:
            # base medians cover the last 4 quarters (centre ~1.5 quarters before the last one), so add that much trend
            lo_b, mid_b, hi_b = lo + 1.5 * slope, mid + 1.5 * slope, hi + 1.5 * slope
            r.update(base_n=bp[0], base_p25=bp[1], base_median=bp[2], base_p75=bp[3],
                     median_low=round(bp[2] * np.exp(lo_b), -3), median_mid=round(bp[2] * np.exp(mid_b), -3),
                     median_high=round(bp[2] * np.exp(hi_b), -3))
        rows.append(r)
lk = pd.DataFrame(rows)
lk.to_csv(OUT / 'price_scenarios_lookup.csv', index=False, float_format='%.4f')
json.dump(dict(slope_floor_per_quarter=SLOPE_FLOOR, best_method=BEST, quarterly_innovation_sd=np.sqrt(Qvar), calibration=calib, coverage_raw=cover,
               z80=Z, window=[Q[0], Q[-1]]), open(OUT / 'model_meta.json', 'w'), indent=1, default=float)
print(lk[(lk.state_code == 'ALL')][['property_type', 'years', 'growth_low', 'growth_mid', 'growth_high', 'annual_trend']].round(3))
