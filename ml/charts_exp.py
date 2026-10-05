import json, pandas as pd, numpy as np, matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
ab = pd.read_csv('out/exp/ablation_validation.csv'); t = json.load(open('out/exp/test_once.json'))['test']
fig, axs = plt.subplots(1, 2, figsize=(11, 3.8))
ax = axs[0]; o = ab.set_index('feature_set').loc[['base', 'base + macro', 'base + local', 'base + local + macro']]
cols = ['#b8b7ae', '#b8b7ae', '#2a78d6', '#b8b7ae']
ax.barh(range(4)[::-1], o.median_APE * 100, color=cols, height=.6)
for i, v in enumerate(o.median_APE * 100): ax.text(v + .05, 3 - i, f'{v:.2f}%', va='center', fontsize=9)
ax.set_yticks(range(4)[::-1]); ax.set_yticklabels(o.index); ax.set_xlim(0, 11.5); ax.set_xlabel('Median error, validation sales 2024Q3-2025Q2')
ax.set_title('Step 5: add one group at a time (validation)', loc='left', fontsize=10)
ax = axs[1]; groups = [('All', 'median_APE'), ('Landed', 'median_APE_landed'), ('Strata', 'median_APE_strata'), ('New schemes', 'median_APE_new_schemes')]
x = np.arange(len(groups))
for k, (nm, col) in enumerate([('base', '#b8b7ae'), ('base + local', '#2a78d6')]):
    v = [t[nm][g] * 100 for _, g in groups]; ax.bar(x + (k - .5) * .38, v, .36, color=col, label=nm)
    for i, vv in enumerate(v): ax.text(x[i] + (k - .5) * .38, vv + .1, f'{vv:.1f}', ha='center', fontsize=8)
ax.set_xticks(x); ax.set_xticklabels([g for g, _ in groups]); ax.set_ylabel('Median error (%)'); ax.legend(frameon=False, fontsize=8)
ax.set_title('Scored once on test sales 2025Q3-2026Q2', loc='left', fontsize=10)
for a in axs:
    for s in ('top', 'right'): a.spines[s].set_visible(False)
fig.tight_layout(); fig.savefig('out/exp/ablation_and_test.png', dpi=130)
