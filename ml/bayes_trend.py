"""Bayesian hierarchical local-linear-trend model for the hedonic state x type price index.

For type k, state s, quarter t (log index, 2024Q1 = 0):
    mu[k,s,t] = mu[k,s,t-1] + d[k,t] + u[k,s] + c[k,t] + w[k,s,t]
      d[k,t]  = d[k,t-1] + z[k,t]          type drift, itself a slow random walk (trend can shift)
      d[k,1]  = d0 + tau_type * a_k         types partially pooled to a national drift d0
      u[k,s]  = tau_state * b_ks            state deviation from its type's drift (partially pooled to 0)
      c[k,t]  ~ N(0, sig_c[k])              common quarterly shock shared by all states of a type
      w       ~ N(0, sig_w[k])              state-specific quarterly shock
    y[k,s,t] ~ N(mu[k,s,t], sqrt(se^2 + sig_e^2))     observation = hedonic estimate with its std error
Observation errors are Student-t (nu=4) so one-off spikes are down-weighted.
Observations with fewer than MIN_N sales are treated as missing (the ridge filled them from the national trend).
Model note: sig_w is shared across types (per-type version did not mix well).
Usage: python bayes_trend.py            -> full fit + forecast + backtest
"""
from backtest_config import origins as _orig, HMAX
import numpy as np, pandas as pd, pymc as pm, arviz as az, pathlib, json, warnings, sys
warnings.filterwarnings('ignore')
OUT = pathlib.Path('out'); OUT.mkdir(exist_ok=True)
MIN_N = 5
OBS = 'studentt'   # observation model: 'studentt' (default) or 'normal'
NU = 4
SEED = 7
SNAME = {'JHR':'Johor','KDH':'Kedah','KTN':'Kelantan','MLK':'Melaka','NSN':'Negeri Sembilan','PHG':'Pahang','PRK':'Perak',
         'PLS':'Perlis','PNG':'Pulau Pinang','SBH':'Sabah','SWK':'Sarawak','SGR':'Selangor','TRG':'Terengganu',
         'KUL':'W.P. Kuala Lumpur','LBN':'W.P. Labuan','PJY':'W.P. Putrajaya','ALL':'Malaysia'}


def load():
    Q, rows = None, []
    for line in open('data/index_raw.txt'):
        if line.startswith('# quarters:'): Q = line.split(':', 1)[1].split(); continue
        if line.startswith('#') or not line.strip(): continue
        t, s, *cells = line.split()
        if s == 'ALL': continue
        for qi, c in enumerate(cells):
            v, se, n = map(int, c.split(','))
            rows.append((t, s, qi, v / 1e4, se / 1e4, n))
    return Q, pd.DataFrame(rows, columns=['type', 'state', 'qi', 'y', 'se', 'n'])


def fit(df, T_obs, draws=1500, tune=2000, chains=4):
    """Fit on quarters 0..T_obs-1. Returns idata plus index maps."""
    types = sorted(df.type.unique()); series = sorted({(r.type, r.state) for r in df.itertuples()})
    K, S = len(types), len(series); ktype = np.array([types.index(t) for t, _ in series])
    Y = np.full((S, T_obs), np.nan); SE = np.zeros((S, T_obs))
    for r in df[df.qi < T_obs].itertuples():
        i = series.index((r.type, r.state)); Y[i, r.qi] = r.y; SE[i, r.qi] = r.se
        if r.n < MIN_N and r.qi > 0: Y[i, r.qi] = np.nan
    obs = ~np.isnan(Y); obs[:, 0] = False            # t=0 is the fixed base (0)
    si, ti = np.where(obs)
    with pm.Model() as m:
        d0 = pm.Normal('d0', 0.005, 0.01)
        tau_type = pm.HalfNormal('tau_type', 0.01)
        tau_state = pm.HalfNormal('tau_state', 0.005)
        sig_z = pm.HalfNormal('sig_z', 0.002)                 # how fast a type's trend can change
        sig_c = pm.HalfNormal('sig_c', 0.02, shape=K)
        sig_w = pm.HalfNormal('sig_w', 0.02)
        sig_e = pm.HalfNormal('sig_e', 0.02)
        a = pm.Normal('a', 0, 1, shape=K)
        zr = pm.Normal('zr', 0, 1, shape=(K, T_obs - 2)) if T_obs > 2 else None
        d1 = d0 + tau_type * a
        steps = [d1[:, None]] + ([sig_z * zr] if zr is not None else [])
        d = pm.Deterministic('d', pm.math.cumsum(pm.math.concatenate(steps, axis=1), axis=1))   # K x (T_obs-1)
        b = pm.Normal('b', 0, 1, shape=S)
        u = pm.Deterministic('u', tau_state * b)
        cr = pm.Normal('cr', 0, 1, shape=(K, T_obs - 1)); c = sig_c[:, None] * cr
        wr = pm.Normal('wr', 0, 1, shape=(S, T_obs - 1)); w = sig_w * wr
        inc = d[ktype] + u[:, None] + c[ktype] + w                                       # S x (T_obs-1)
        mu = pm.Deterministic('mu', pm.math.concatenate([np.zeros((S, 1)), pm.math.cumsum(inc, axis=1)], axis=1))
        sd_obs = pm.math.sqrt(SE[si, ti] ** 2 + sig_e ** 2)
        if OBS == 'studentt':    # heavy tails: one-off spikes (e.g. a single luxury project) don't move the level
            pm.StudentT('y', nu=NU, mu=mu[si, ti], sigma=sd_obs, observed=Y[si, ti])
        else:
            pm.Normal('y', mu[si, ti], sd_obs, observed=Y[si, ti])
        idata = pm.sample(draws=draws, tune=tune, chains=chains, target_accept=0.99, random_seed=SEED, cores=2,
                          progressbar=False, compute_convergence_checks=True)
    return idata, types, series, ktype


def simulate(idata, types, series, ktype, H, rng):
    """Posterior predictive paths of the TRUE log index for H quarters beyond the fit window. S x draws x H"""
    p = idata.posterior.stack(sample=('chain', 'draw'))
    mu_last = p['mu'].values[:, -1, :]                    # S x N
    d_last = p['d'].values[:, -1, :]                      # K x N
    u = p['u'].values                                      # S x N
    sig_z, sig_c, sig_w = p['sig_z'].values, p['sig_c'].values, p['sig_w'].values
    N = mu_last.shape[1]; K = len(types); S = len(series)
    d = d_last.copy(); mu = mu_last.copy(); out = np.zeros((S, N, H))
    for h in range(H):
        d = d + sig_z * rng.standard_normal((K, N))
        c = sig_c * rng.standard_normal((K, N))
        w = sig_w * rng.standard_normal((S, N))
        mu = mu + d[ktype] + u + c[ktype] + w
        out[:, :, h] = mu
    return out, mu_last


def main(backtest=True):
    Q, df = load(); T = len(Q); ORIGINS = _orig(Q); rng = np.random.default_rng(SEED)
    # ---------- full fit ----------
    idata, types, series, ktype = fit(df, T)
    summ = az.summary(idata, var_names=['d0', 'tau_type', 'tau_state', 'sig_z', 'sig_e', 'sig_c', 'sig_w'])
    summ.to_csv(OUT / 'bayes_hyperparameters.csv')
    diag = dict(max_rhat=float(max(az.rhat(idata)[v].max() for v in idata.posterior.data_vars)),
                divergences=int(idata.sample_stats.diverging.sum()),
                min_ess_bulk=float(min(az.ess(idata)[v].min() for v in idata.posterior.data_vars)))
    print(summ[['mean', 'sd', 'hdi_3%', 'hdi_97%', 'r_hat']].round(4)); print(diag)
    paths, mu_last = simulate(idata, types, series, ktype, 12, rng)
    base = {}
    for chunk in open('data/base_prices.txt').read().replace('\n', '~').split('~'):
        if chunk: st, t, n, a, b, c = chunk.split(';'); base[(st, t)] = tuple(map(int, (n, a, b, c)))
    ncount = df.groupby(['type', 'state']).apply(lambda g: g[g.qi >= T - 4].n.sum())
    p = idata.posterior.stack(sample=('chain', 'draw'))
    drift_ks = p['d'].values[ktype, -1, :] + p['u'].values        # current quarterly trend per series
    rows = []
    for i, (t, s) in enumerate(series):
        nw = int(ncount[(t, s)]); q = 'good' if nw >= 200 else 'fair' if nw >= 40 else 'thin'
        bp = base.get((SNAME[s], t))
        for yrs in (1, 2, 3):
            g = paths[i, :, 4 * yrs - 1] - mu_last[i]                    # growth from current true level
            gb = paths[i, :, 4 * yrs - 1] - (mu_last[i] - 1.5 * drift_ks[i])   # base medians centred 1.5q earlier
            lo, mid, hi = np.quantile(g, [0.1, 0.5, 0.9]); plo, pmid, phi = np.quantile(gb, [0.1, 0.5, 0.9])
            r = dict(state=SNAME[s], state_code=s, property_type=t, years=yrs,
                     target_quarter=f"{int(Q[-1][:4]) + yrs}{Q[-1][4:]}",
                     growth_low=np.expm1(lo), growth_mid=np.expm1(mid), growth_high=np.expm1(hi),
                     prob_price_fall=float((g < 0).mean()),
                     annual_trend=float(np.expm1(4 * np.median(drift_ks[i]))),
                     annual_trend_p10=float(np.expm1(4 * np.quantile(drift_ks[i], 0.1))),
                     annual_trend_p90=float(np.expm1(4 * np.quantile(drift_ks[i], 0.9))),
                     sales_last4q=nw, data_quality=q, method='bayes_hier_llt')
            if bp and bp[0] >= 10:
                r.update(base_n=bp[0], base_p25=bp[1], base_median=bp[2], base_p75=bp[3],
                         median_low=round(bp[2] * np.exp(plo), -3), median_mid=round(bp[2] * np.exp(pmid), -3),
                         median_high=round(bp[2] * np.exp(phi), -3))
            rows.append(r)
    lk = pd.DataFrame(rows); lk.to_csv(OUT / 'bayes_scenarios_lookup.csv', index=False, float_format='%.4f')
    # national type-level trend (posterior of d at the last quarter)
    nat = pd.DataFrame({'type': types, 'annual_trend_mid': np.expm1(4 * np.median(p['d'].values[:, -1, :], 1)),
                        'p10': np.expm1(4 * np.quantile(p['d'].values[:, -1, :], 0.1, 1)),
                        'p90': np.expm1(4 * np.quantile(p['d'].values[:, -1, :], 0.9, 1))})
    nat.to_csv(OUT / 'bayes_type_trends.csv', index=False, float_format='%.4f'); print(nat.round(4))
    np.save(OUT / 'bayes_paths_12q.npy', np.quantile(paths, [0.1, 0.5, 0.9], axis=1).astype('float32'))
    json.dump(dict(series=[f'{t}|{s}' for t, s in series], diag=diag, quarters=Q), open(OUT / 'bayes_meta.json', 'w'), indent=1)
    if not backtest: return
    # ---------- rolling-origin backtest (same origins/series/weights as forecast.py) ----------
    bt = []
    for T0 in ORIGINS:
        idb, ty, se_, kt = fit(df, T0 + 1, draws=500, tune=1000)
        H = min(HMAX, T - 1 - T0); pth, _ = simulate(idb, ty, se_, kt, H, rng)
        for i, (t, s) in enumerate(se_):
            g = df[(df.type == t) & (df.state == s)].sort_values('qi')
            if g.n.sum() < 150 or (g.n.values == 0).sum() > 2: continue
            for h in range(1, H + 1):
                yt, n, se = g.y.values[T0 + h], g.n.values[T0 + h], g.se.values[T0 + h]
                draws = pth[i, :, h - 1]
                sd_obs = np.sqrt(se ** 2 + float(idb.posterior['sig_e'].mean()) ** 2)
                noise = rng.standard_t(NU, draws.size) if OBS == 'studentt' else rng.standard_normal(draws.size)
                pred = draws + noise * sd_obs          # predictive for the observed index
                lo, hi = np.quantile(pred, [0.1, 0.9])
                bt.append((t, s, 'bayes_hier_llt', Q[T0], h, yt - np.median(draws), n, se, lo <= yt <= hi))
        print('backtest origin', Q[T0], 'done')
    bt = pd.DataFrame(bt, columns=['type', 'state', 'method', 'origin', 'h', 'err', 'n', 'se', 'in80'])
    bt.to_csv(OUT / 'bayes_backtest_errors.csv', index=False, float_format='%.5f')
    w = lambda g: np.sqrt(np.average(g.err ** 2, weights=g.n + 1))
    res = bt.groupby('h').apply(w).to_dict(); res['all_h'] = w(bt)
    res['mae_all'] = float(np.average(bt.err.abs(), weights=bt.n + 1)); res['coverage80'] = float(bt.in80.mean())
    json.dump(res, open(OUT / 'bayes_backtest_summary.json', 'w'), indent=1); print(res)


if __name__ == '__main__':
    main(backtest='--no-backtest' not in sys.argv)
