import json, numpy as np, pandas as pd, matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
BLUE, BLUE_L, BLUE_D, GREY, INK, MUTED = '#2a78d6', '#cde2fb', '#1c5cab', '#b8b7ae', '#1a1a19', '#6b6a63'
plt.rcParams.update({'axes.edgecolor': GREY, 'axes.labelcolor': INK, 'xtick.color': MUTED, 'ytick.color': MUTED,
                     'axes.spines.top': False, 'axes.spines.right': False, 'font.size': 9})
meta = json.load(open('out/bayes_meta.json')); Q = meta['quarters']; T = len(Q); series = meta['series']
qp = np.load('out/bayes_paths_12q.npy')          # 3 x S x 12 (P10, P50, P90 of the true log index)
lines = {}
for l in open('data/index_raw.txt'):
    if l.startswith('#'): continue
    t, s, *c = l.split(); lines[(t, s)] = np.array([list(map(int, x.split(','))) for x in c]) / [1e4, 1e4, 1]
def fan(state, title, fname):
    types = ['terrace', 'condo', 'semi_detached', 'low_cost_house', 'detached', 'low_cost_flat', 'flat', 'cluster', 'townhouse']
    fig, axs = plt.subplots(3, 3, figsize=(12, 9), sharey=True)
    for ax, t in zip(axs.flat, types):
        i = series.index(f'{t}|{state}'); d = lines[(t, state)]; x = np.arange(T)
        ok = d[:, 2] >= 5
        ax.errorbar(x[ok], 100 * np.exp(d[ok, 0]), yerr=100 * 1.2816 * d[ok, 1], fmt='o', color=BLUE, ms=4, lw=1.2, capsize=0)
        xf = np.arange(T, T + 12)
        ax.fill_between(xf, 100 * np.exp(qp[0, i]), 100 * np.exp(qp[2, i]), color=BLUE_L, lw=0)
        ax.plot(xf, 100 * np.exp(qp[1, i]), color=BLUE_D, lw=2, ls='--')
        ax.axhline(100, color=GREY, lw=.8); ax.axvline(T - .5, color=GREY, lw=.8, ls=':')
        ax.set_title(f"{t.replace('_', ' ')}  (sales last yr: {int(d[-4:, 2].sum())})", fontsize=10, color=INK, loc='left')
        tk = [i for i, q in enumerate(Q) if q.endswith('Q1')][::2] + [T - 1 + 4 * k for k in (1, 2, 3)]
        ax.set_xticks(tk); ax.set_xticklabels([Q[i][2:] if i < T else f"{(int(Q[-1][:4]) + (i - T + 1) // 4) % 100}{Q[-1][4:]}" for i in tk])
        ax.grid(axis='y', color='#ecebe4', lw=.8)
    for a in axs[:, 0]: a.set_ylabel(f'Index, {Q[0]} = 100')
    fig.suptitle(title, fontsize=12, color=INK, x=0.01, ha='left')
    fig.text(0.01, 0.94, 'Dots: hedonic index with 80% error bar (quarters with 5+ sales).  Dashed: Bayesian median path.  '
             'Shaded: model 80% range (held 94% of real outcomes in testing).  What-if only, not a valuation.', fontsize=9, color=MUTED)
    fig.tight_layout(rect=[0, 0, 1, .93]); fig.savefig(fname, dpi=130); plt.close(fig)
fan('SGR', 'Selangor: price index by type and Bayesian 1-3 year scenario range', 'out/bayes_fan_selangor.png')
fan('JHR', 'Johor: price index by type and Bayesian 1-3 year scenario range', 'out/bayes_fan_johor.png')
c = pd.read_csv('out/backtest_comparison_state_series.csv').sort_values('rmse_all', ascending=False); N_BT = int(c.n.iloc[0])
fig, ax = plt.subplots(figsize=(8, 3.6))
cols = [BLUE if m.startswith('bayes_hier_llt_studentt') else GREY for m in c.method]
ax.barh(range(len(c)), 100 * c.rmse_all, color=cols, height=.6)
for k, v in enumerate(100 * c.rmse_all): ax.text(v + .03, k, f'{v:.2f}%', va='center', fontsize=9, color=INK)
lab = {'bayes_hier_llt_studentt': 'Bayesian hierarchical (robust)', 'bayes_hier_llt_normal': 'Bayesian hierarchical (normal errors)',
       'national_trend': 'National trend (v1)', 'shrunk_trend': 'Shrunk state trend', 'ses': 'Exponential smoothing',
       'naive': 'No change (naive)', 'own_trend': 'Own state trend'}
ax.set_yticks(range(len(c))); ax.set_yticklabels([lab[m] for m in c.method]); ax.set_xlabel('Forecast error, weighted RMSE of log index (%)')
ax.set_title(f'Backtest: {N_BT} forecasts, 1-8 quarters ahead (lower = better)', fontsize=10, color=INK, loc='left')
ax.set_xlim(0, 100 * c.rmse_all.max() * 1.15); fig.tight_layout(); fig.savefig('out/bayes_backtest.png', dpi=130)
