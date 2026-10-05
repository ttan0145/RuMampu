"""Hedonic state x type quarterly index from the cleaned NAPIC file (same model as train_price_index.py / hedonic.js).
    python build_index.py  -> data/index_raw.txt, data/base_prices.txt
    make_index(df) is reused by ml_price_range.py (train-only index for an honest out-of-time test)."""
import numpy as np, pandas as pd
from train_price_index import hedonic, SCODE


def _cells(df):
    df = df.assign(ls=np.log(df.size_m2), lp=np.log(df.price_rm.astype(float)), te=df.tenure.str[0])
    dist = {d: i + 1 for i, d in enumerate(sorted(df.district.unique()))}; df['d'] = df.district.map(dist)
    state_of = {dist[d]: SCODE[s] for d, s in df.groupby('district').state.first().items()}
    g = df.groupby(['property_type', 'd', 'te', 'quarter'])
    cells = g.agg(n=('lp', 'size'), x=('ls', 'mean'), y=('lp', 'mean')).reset_index()
    cells['sxx'] = g.ls.var(ddof=0).values * cells.n; cells['syy'] = g.lp.var(ddof=0).values * cells.n
    cells['sxy'] = (g.apply(lambda h: ((h.ls - h.ls.mean()) * (h.lp - h.lp.mean())).sum())).values
    return cells, state_of


def make_index(df, verbose=False):
    """long DataFrame: type, state(code), quarter, y (log index, first quarter = 0), se, n"""
    cells, state_of = _cells(df); Q = sorted(df.quarter.unique()); rows = []
    for t, c in cells.groupby('property_type'):
        cl = list(c[['d', 'te', 'quarter', 'n', 'x', 'y', 'sxx', 'sxy', 'syy']].itertuples(index=False, name=None))
        r = hedonic(cl, state_of)
        if verbose:
            print(f"{t:15s} N={r['N']:7d} slope={r['slope']:.3f} lease={r['lease']:.3f} sigma={r['sigma']:.3f} "
                  f"natl {Q[-1]} vs {Q[0]}: {np.expm1(r['series']['ALL'][-1][0]):+.1%}")
        for s, ser in r['series'].items():
            for q, (v, se, n) in zip(r['Q'], ser): rows.append((t, s, q, v, se, n))
    return pd.DataFrame(rows, columns=['type', 'state', 'quarter', 'y', 'se', 'n']), Q


if __name__ == '__main__':
    df = pd.read_parquet('data/napic_clean.parquet')
    ix, Q = make_index(df, verbose=True)
    with open('data/index_raw.txt', 'w') as f:
        f.write('# type state then quarters: logidx*1e4,se*1e4,n (hedonic, lambda=50, source: NAPIC open data file)\n')
        f.write('# quarters: ' + ' '.join(Q) + '\n')
        for (t, s), g in ix.groupby(['type', 'state'], sort=False):
            assert len(g) == len(Q), (t, s)
            f.write(f"{t} {s} " + ' '.join(f"{round(r.y*1e4)},{round(r.se*1e4)},{r.n}" for r in g.itertuples()) + '\n')
    last4 = Q[-4:]; x = df[df.quarter.isin(last4)]
    b = x.groupby(['state', 'property_type']).price_rm.agg(['size', lambda s: s.quantile(.25), 'median', lambda s: s.quantile(.75)])
    with open('data/base_prices.txt', 'w') as f:
        f.write('~'.join(f"{s};{t};{int(r.iloc[0])};{int(round(r.iloc[1]))};{int(round(r.iloc[2]))};{int(round(r.iloc[3]))}"
                         for (s, t), r in b.iterrows()) + '\n')
