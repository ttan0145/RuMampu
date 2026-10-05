"""Rebuild the RuMampu hedonic price index straight from Neon, then run forecast.py.

    pip install psycopg[binary] numpy pandas statsmodels matplotlib
    export DATABASE_URL='postgresql://...neon.tech/neondb?sslmode=require'   # read-only role is enough
    python train_price_index.py && python forecast.py && python charts.py

Read-only: only SELECTs are run. Writes data/index_raw.txt and data/base_prices.txt.
Model (per property type):
    ln(price) = district FE + b*ln(size) + g*leasehold + theta[quarter] + eta[state, quarter] + e
    size = floor_area, else land_area (strata rows keep unit area in land_area)
    eta is ridge-shrunk (LAMBDA, in "observations") toward the national quarter effect so thin states stay stable.
Estimated exactly from per-cell sufficient statistics (district x tenure x quarter), same maths as hedonic.js.
"""
import os, numpy as np, pathlib

LAMBDA = 50.0
CLEAN = """
with base as (select distinct district_id, mukim, scheme_area, txn_date, quarter, property_type, tenure,
                     land_area, floor_area, price_rm
              from property_transaction where price_rm >= 50000),
c2 as (select *, ln(price_rm::float8) lp, ln(coalesce(nullif(floor_area,0), nullif(land_area,0))) ls
       from base where coalesce(nullif(floor_area,0), nullif(land_area,0)) between 15 and 5000),
b  as (select property_type, percentile_cont(0.005) within group (order by lp-ls) lo,
              percentile_cont(0.995) within group (order by lp-ls) hi from c2 group by 1),
cl as (select c2.* from c2 join b using (property_type) where lp-ls between lo and hi)
"""
CELLS = CLEAN + """
select property_type, district_id, left(tenure,1), quarter, count(*),
       avg(ls), avg(lp), coalesce(var_pop(ls),0)*count(*), coalesce(covar_pop(ls,lp),0)*count(*),
       coalesce(var_pop(lp),0)*count(*)
from cl group by 1,2,3,4 order by 1,2,3,4
"""
BASE = CLEAN + """
, x as (select s.name st, property_type t, price_rm p, quarter from cl join district d on d.id = cl.district_id
        join state s on s.id = d.state_id)
select st, t, count(*), round(percentile_cont(0.25) within group (order by p)),
       round(percentile_cont(0.5) within group (order by p)), round(percentile_cont(0.75) within group (order by p))
from x where quarter >= (select distinct quarter from x order by 1 desc offset 3 limit 1) group by 1, 2
"""
STATES = "select d.id, s.name from district d join state s on s.id = d.state_id"
SCODE = {'Johor':'JHR','Kedah':'KDH','Kelantan':'KTN','Melaka':'MLK','Negeri Sembilan':'NSN','Pahang':'PHG','Perak':'PRK',
         'Perlis':'PLS','Pulau Pinang':'PNG','Sabah':'SBH','Sarawak':'SWK','Selangor':'SGR','Terengganu':'TRG',
         'W.P. Kuala Lumpur':'KUL','W.P. Labuan':'LBN','W.P. Putrajaya':'PJY'}


def hedonic(cells, state_of, lam=LAMBDA):
    """cells: list of (district, tenure 'F'/'L', quarter, n, mean_ls, mean_lp, Sxx, Sxy, Syy)."""
    Q = sorted({c[2] for c in cells}); D = sorted({c[0] for c in cells}); S = sorted({state_of[c[0]] for c in cells})
    hasL = len({c[1] for c in cells}) > 1
    idx = {}; p = 0
    for d in D: idx['d', d] = p; p += 1
    if hasL: idx['L'] = p; p += 1
    idx['b'] = p; p += 1
    for q in Q[1:]: idx['t', q] = p; p += 1
    for s in S:
        for q in Q[1:]: idx['e', s, q] = p; p += 1
    A = np.zeros((p, p)); v = np.zeros(p); N = 0; yy = 0.0; ib = idx['b']
    for d, te, q, n, x, y, sxx, sxy, syy in cells:
        j = [idx['d', d]] + ([idx['L']] if hasL and te == 'L' else [])
        if q != Q[0]: j += [idx['t', q], idx['e', state_of[d], q]]
        j = np.array(j)
        A[np.ix_(j, j)] += n; A[j, ib] += n * x; A[ib, j] += n * x; v[j] += n * y
        A[ib, ib] += sxx + n * x * x; v[ib] += sxy + n * x * y; N += n; yy += syy + n * y * y
    pen = np.zeros(p); pen[[i for k, i in idx.items() if k[0] == 'e']] = lam
    inv = np.linalg.inv(A + np.diag(pen)); beta = inv @ v
    rss = yy - 2 * beta @ v + beta @ A @ beta; s2 = rss / (N - p)
    nsq = {}
    for d, te, q, n, *_ in cells:
        nsq[state_of[d], q] = nsq.get((state_of[d], q), 0) + n
        nsq['ALL', q] = nsq.get(('ALL', q), 0) + n
    out = {}
    for s in ['ALL'] + S:
        ser = []
        for q in Q:
            if q == Q[0]: ser.append((0.0, 0.0, nsq.get((s, q), 0))); continue
            a = idx['t', q]
            if s == 'ALL': val, var = beta[a], s2 * inv[a, a]
            else:
                e = idx['e', s, q]; val = beta[a] + beta[e]; var = s2 * (inv[a, a] + inv[e, e] + 2 * inv[a, e])
            ser.append((val, np.sqrt(max(var, 0)), nsq.get((s, q), 0)))
        out[s] = ser
    return dict(Q=Q, series=out, slope=beta[ib], lease=beta[idx['L']] if hasL else None, sigma=np.sqrt(s2), N=N)


def main():
    import psycopg
    with psycopg.connect(os.environ['DATABASE_URL']) as con, con.cursor() as cur:
        cur.execute("set transaction read only")
        cur.execute(STATES); state_of = {i: SCODE[n] for i, n in cur.fetchall()}
        cur.execute(CELLS); rows = cur.fetchall()
        cur.execute(BASE); base = cur.fetchall()
    pathlib.Path('data').mkdir(exist_ok=True)
    by = {}
    for t, d, te, q, n, x, y, sxx, sxy, syy in rows:
        by.setdefault(t, []).append((d, te, q, n, float(x), float(y), float(sxx), float(sxy), float(syy)))
    with open('data/index_raw.txt', 'w') as f:
        f.write(f"# type state then quarters: logidx*1e4,se*1e4,n (hedonic, lambda={LAMBDA:g})\n")
        allq = sorted({c[2] for cells in by.values() for c in cells})
        f.write('# quarters: ' + ' '.join(allq) + '\n')
        for t, cells in by.items():
            r = hedonic(cells, state_of)
            assert r['Q'] == allq, f'{t} is missing quarters'
            print(f"{t:15s} N={r['N']:6d} slope={r['slope']:.3f} sigma={r['sigma']:.3f} quarters={r['Q'][0]}..{r['Q'][-1]}")
            for s, ser in r['series'].items():
                f.write(f"{t} {s} " + ' '.join(f"{round(v*1e4)},{round(se*1e4)},{n}" for v, se, n in ser) + '\n')
    with open('data/base_prices.txt', 'w') as f:
        f.write('~'.join(';'.join(map(str, [st, t, n, int(a), int(b), int(c)])) for st, t, n, a, b, c in base) + '\n')


if __name__ == '__main__':
    main()
