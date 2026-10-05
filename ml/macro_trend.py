"""Does macro data explain the price TREND? Panel of 16 states x 21 quarterly changes of the all-types hedonic index.
    dlog_index[s,q] = a_s + b1*OPR_change(last 4 qtrs, as known at q) + b2*CPI_yoy(lagged) + b3*unemployment_change[s]
                      + b4*income_growth[s] + e      (weights = sales; SE clustered by quarter)
Point-in-time: OPR known on decision day; CPI with a 2-month lag; unemployment only for published quarters;
income only from surveys already published.   -> out/exp/macro_trend.json, out/exp/macro_trend.png
"""
import json, numpy as np, pandas as pd, statsmodels.formula.api as smf, matplotlib
matplotlib.use('Agg'); import matplotlib.pyplot as plt
import experiment as E

SN = {'JHR': 'Johor', 'KDH': 'Kedah', 'KTN': 'Kelantan', 'MLK': 'Melaka', 'NSN': 'Negeri Sembilan', 'PHG': 'Pahang', 'PRK': 'Perak',
      'PLS': 'Perlis', 'PNG': 'Pulau Pinang', 'SBH': 'Sabah', 'SWK': 'Sarawak', 'SGR': 'Selangor', 'TRG': 'Terengganu',
      'KUL': 'W.P. Kuala Lumpur', 'LBN': 'W.P. Labuan', 'PJY': 'W.P. Putrajaya'}
ix = pd.read_csv('out/price_index_state_type.csv'); ix = ix[(ix.type == 'all_types') & (ix.state != 'ALL')].copy()
ix['state_name'] = ix.state.map(SN); ix = ix.sort_values(['state', 'quarter'])
ix['dy'] = ix.groupby('state').y.diff() * 100
ix['date'] = pd.PeriodIndex(ix.quarter, freq='Q').to_timestamp(how='end').normalize() - pd.offsets.MonthBegin(1)   # last month of quarter
m = E.add_macro(pd.DataFrame({'date': ix.date.values, 'state': ix.state_name.values}))
for c in ['opr', 'cpi_yoy', 'urate_state', 'hh_income_median']: ix[c] = m[c].values
g = ix.groupby('state')
ix['d_opr_4q'] = ix.opr - g.opr.shift(4)
ix['d_urate'] = ix.urate_state - g.urate_state.shift(4)
ix['inc_growth'] = (np.log(ix.hh_income_median) - np.log(g.hh_income_median.shift(4))) * 100
d = ix.dropna(subset=['dy', 'd_opr_4q', 'cpi_yoy', 'd_urate', 'inc_growth']).copy()
d['w'] = np.sqrt(d.n.clip(lower=1))
f = 'dy ~ d_opr_4q + cpi_yoy + d_urate + inc_growth + C(state)'
mod = smf.wls(f, d, weights=d.w).fit(cov_type='cluster', cov_kwds={'groups': pd.factorize(d.quarter)[0]})
base = smf.wls('dy ~ C(state)', d, weights=d.w).fit()
keys = ['d_opr_4q', 'cpi_yoy', 'd_urate', 'inc_growth']
res = dict(n_obs=int(mod.nobs), quarters=[d.quarter.min(), d.quarter.max()], r2_macro=round(mod.rsquared, 3), r2_state_only=round(base.rsquared, 3),
           coef={k: dict(estimate=round(mod.params[k], 3), se=round(mod.bse[k], 3), p=round(mod.pvalues[k], 3)) for k in keys},
           note='dy = quarterly % change of the state all-types index; coefficients = effect in percentage points per quarter')
# national decomposition: fitted macro contribution per quarter (sales-weighted average over states)
d['fit_macro'] = sum(mod.params[k] * d[k] for k in keys)
nat = d.groupby('quarter').apply(lambda x: pd.Series({'actual': np.average(x.dy, weights=x.n), 'macro': np.average(x.fit_macro, weights=x.n),
                                                       **{k: np.average(mod.params[k] * x[k], weights=x.n) for k in keys}}))
res['national_by_quarter'] = nat.round(3).reset_index().to_dict('records')
json.dump(res, open('out/exp/macro_trend.json', 'w'), indent=1, default=float)
print(json.dumps({k: v for k, v in res.items() if k != 'national_by_quarter'}, indent=1)); print(nat.round(2).to_string())
fig, ax = plt.subplots(figsize=(10, 4)); x = np.arange(len(nat))
cols = {'d_opr_4q': '#2a78d6', 'cpi_yoy': '#eb6834', 'd_urate': '#1baf7a', 'inc_growth': '#eda100'}
lab = {'d_opr_4q': 'OPR change (past year)', 'cpi_yoy': 'Inflation', 'd_urate': 'Unemployment change', 'inc_growth': 'Income growth'}
bp, bn = np.zeros(len(nat)), np.zeros(len(nat))
for k in keys:
    v = nat[k].values; ax.bar(x, np.where(v > 0, v, 0), bottom=bp, color=cols[k], width=.7, label=lab[k]); bp += np.where(v > 0, v, 0)
    ax.bar(x, np.where(v < 0, v, 0), bottom=bn, color=cols[k], width=.7); bn += np.where(v < 0, v, 0)
ax.plot(x, nat.actual.values, 'o-', color='#1a1a19', lw=1.5, ms=4, label='Actual index change')
ax.axhline(0, color='#888', lw=.6); ax.set_xticks(x[::2]); ax.set_xticklabels(nat.index[::2], fontsize=8)
ax.set_ylabel('% change per quarter'); ax.legend(fontsize=8, ncol=5, frameon=False, loc='upper left')
ax.set_title(f"Macro contributions to the quarterly price change (panel of 16 states; R² {res['r2_state_only']:.2f} -> {res['r2_macro']:.2f})", loc='left', fontsize=10)
for s in ('top', 'right'): ax.spines[s].set_visible(False)
fig.tight_layout(); fig.savefig('out/exp/macro_trend.png', dpi=130)
