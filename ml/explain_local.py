"""Explanation models for the "what drives prices" story (separate from the prediction model).

The prediction model knows the district, mukim, scheme and road by name, so SHAP credits location to those names and
the distance features look ~0. To say "near a rail station = +X%", we fit LightGBM P50 models where location enters
ONLY through the measured local features:
  A  across Malaysia     : home features + local features + state
  B  within a district   : home features + local features + district   (compares homes in the same district)
Target: log price relative to the state x type index (time removed). Sales 2021Q1-2025Q2.
Results are associations in the data, not proof of cause.
    python explain_local.py -> out/exp/explain_effects.csv, out/exp/explain_effects.png
"""
import numpy as np, pandas as pd, matplotlib, lightgbm as lgb
matplotlib.use('Agg'); import matplotlib.pyplot as plt
import ml_price_range as M, experiment as E
from build_index import make_index

HOME = ['property_type', 'tenure']; HOME_NUM = ['storeys', 'ln_size', 'ln_land', 'ln_floor', 'has_floor', 'level']
LOCAL = ['dist_rail_km', 'dist_state_capital_km', 'dist_kl_km', 'dist_mway_exit_km', 'dist_hospital_km', 'dist_tertiary_km',
         'n_school_2km', 'n_clinic_2km', 'n_shop_2km', 'n_park_1km', 'n_worship_1km']
BANDS = E_BANDS = {
    'dist_rail_km': ([0, 1, 2, 5, 1e9], ['<1 km', '1-2 km', '2-5 km', '5 km+'], 'Rail station (open at sale date)'),
    'dist_kl_km': ([0, 10, 25, 50, 1e9], ['<10 km', '10-25 km', '25-50 km', '50 km+'], 'Distance to KL centre'),
    'dist_state_capital_km': ([0, 10, 25, 50, 1e9], ['<10 km', '10-25 km', '25-50 km', '50 km+'], 'Distance to state capital'),
    'dist_mway_exit_km': ([0, 2, 5, 15, 1e9], ['<2 km', '2-5 km', '5-15 km', '15 km+'], 'Motorway exit'),
    'n_shop_2km': ([-1, 2, 10, 30, 1e9], ['0-2', '3-10', '11-30', '31+'], 'Shops / malls within 2 km'),
    'n_school_2km': ([-1, 2, 6, 12, 1e9], ['0-2', '3-6', '7-12', '13+'], 'Schools within 2 km'),
    'n_park_1km': ([-1, 0, 2, 1e9], ['none', '1-2', '3+'], 'Parks within 1 km'),
    'dist_hospital_km': ([0, 2, 5, 10, 1e9], ['<2 km', '2-5 km', '5-10 km', '10 km+'], 'Hospital'),
}


def fit_shap(d, cat, num, n=1200, sample=15000):
    X = d[cat + num].copy()
    for c in cat: X[c] = X[c].astype('category')
    m = lgb.LGBMRegressor(objective='quantile', alpha=0.5, n_estimators=n, learning_rate=0.05, num_leaves=63,
                          min_child_samples=50, subsample=0.8, subsample_freq=1, colsample_bytree=0.8, random_state=M.SEED, verbose=-1)
    m.fit(X, d.r)
    s = d.sample(min(sample, len(d)), random_state=M.SEED); Xs = X.loc[s.index]
    sv = np.vstack([m.predict(Xs.iloc[i:i + 2000], pred_contrib=True)[:, :-1] for i in range(0, len(Xs), 2000)])
    return pd.DataFrame(sv, columns=cat + num, index=s.index), s


def effects(SV, S, label):
    rows = []
    for f, (bins, labels, desc) in BANDS.items():
        b = pd.cut(S[f], bins, labels=labels); eff = SV[f].groupby(b).mean(); n = b.value_counts().reindex(labels)
        ref = labels[-1] if f.startswith('dist') else labels[0]
        for lab in labels:
            rows.append(dict(model=label, feature=f, description=desc, band=lab, reference=ref, n=int(n[lab]),
                             effect_pct=round(float((np.exp(eff[lab] - eff[ref]) - 1) * 100), 1)))
    return rows


def main():
    raw, df = E.build(); Q = sorted(df.quarter.unique()); Qk = Q[:Q.index('2025Q2') + 1]
    ix, _ = make_index(raw[raw.quarter.isin(Qk)])
    d = M.attach_index(df[df.quarter.isin(Qk)], ix, Qk); d['r'] = d.lp - d.idx
    d = d[d.geo_precise == 1]                       # only sales located by scheme name / road (not mukim centre guesses)
    rows = []
    for label, cat in [('A: across Malaysia (state known)', HOME + ['state']), ('B: within the same district', HOME + ['district'])]:
        SV, S = fit_shap(d, cat, HOME_NUM + LOCAL); rows += effects(SV, S, label); print(label, 'done', flush=True)
    R = pd.DataFrame(rows); R.to_csv('out/exp/explain_effects.csv', index=False)
    fig, axs = plt.subplots(2, 4, figsize=(15, 6.6), sharey=False)
    for ax, (f, (bins, labels, desc)) in zip(axs.flat, BANDS.items()):
        x = np.arange(len(labels))
        for k, (lab, col) in enumerate([('A: across Malaysia (state known)', '#b8b7ae'), ('B: within the same district', '#2a78d6')]):
            v = R[(R.model == lab) & (R.feature == f)].set_index('band').reindex(labels).effect_pct.values
            ax.bar(x + (k - .5) * .38, v, .36, color=col, label=['across Malaysia', 'within same district'][k])
            for i, vv in enumerate(v): ax.text(x[i] + (k - .5) * .38, vv, f'{vv:+.0f}', ha='center', va='bottom' if vv >= 0 else 'top', fontsize=7)
        ax.axhline(0, color='#888', lw=.6); ax.set_xticks(x); ax.set_xticklabels(labels, fontsize=8); ax.set_title(desc, loc='left', fontsize=9)
        for s in ('top', 'right'): ax.spines[s].set_visible(False)
    axs[0, 0].legend(fontsize=7, frameon=False); axs[0, 0].set_ylabel('% price vs reference band'); axs[1, 0].set_ylabel('% price vs reference band')
    fig.suptitle('Neighbourhood features and price, other home features held equal (SHAP, sales 2021-2025Q2, precisely located homes) - associations, not causes',
                 x=0.01, ha='left', fontsize=10.5)
    fig.tight_layout(rect=[0, 0, 1, .94]); fig.savefig('out/exp/explain_effects.png', dpi=130)
    print(R[R.feature.isin(['dist_rail_km', 'dist_kl_km', 'n_shop_2km', 'dist_mway_exit_km'])].to_string(index=False))


if __name__ == '__main__':
    main()
