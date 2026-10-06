"""Price Explorer: read the active price model's precomputed tables.

The models never run here (see ml/). Share-under-budget comes from the raw
NAPIC sales in `property_transaction` (last 4 quarters); everything else is
the loaded model output.
"""
from django.db import DatabaseError, connection, transaction

from .models import PriceIndexPoint, PriceModelVersion, PriceRangeCell, PriceScenario

STATE_CODE = {"Johor": "JHR", "Kedah": "KDH", "Kelantan": "KTN", "Melaka": "MLK", "Negeri Sembilan": "NSN",
              "Pahang": "PHG", "Perak": "PRK", "Perlis": "PLS", "Pulau Pinang": "PNG", "Sabah": "SBH",
              "Sarawak": "SWK", "Selangor": "SGR", "Terengganu": "TRG", "W.P. Kuala Lumpur": "KUL",
              "W.P. Labuan": "LBN", "W.P. Putrajaya": "PJY"}
STATE_NAME = {v: k for k, v in STATE_CODE.items()}
TYPES = {"terrace", "condo", "semi_detached", "low_cost_house", "flat", "townhouse", "detached", "cluster", "low_cost_flat"}
MIN_SALES_FOR_SHARE = 8


def active_version():
    return PriceModelVersion.objects.filter(is_active=True).first()


def recent_quarters(n=4):
    with connection.cursor() as cur:
        cur.execute("SELECT DISTINCT quarter FROM property_transaction ORDER BY quarter DESC LIMIT %s", [n])
        return sorted(r[0] for r in cur.fetchall())


def raw_stats(state_code, property_type, budget, quarters, district=None):
    """district -> (sales, p10, p50, p90, sales at or under budget) from the raw NAPIC table.
    property_type 'all' covers every home type."""
    sql = """
        SELECT d.name, count(*),
               percentile_cont(0.1) WITHIN GROUP (ORDER BY t.price_rm),
               percentile_cont(0.5) WITHIN GROUP (ORDER BY t.price_rm),
               percentile_cont(0.9) WITHIN GROUP (ORDER BY t.price_rm),
               count(*) FILTER (WHERE t.price_rm <= %(b)s)
        FROM property_transaction t JOIN district d ON d.id = t.district_id JOIN state s ON s.id = d.state_id
        WHERE s.name = %(s)s AND t.quarter = ANY(%(q)s)
          AND (%(t)s = 'all' OR t.property_type = %(t)s) AND (%(d)s = '' OR d.name = %(d)s)
        GROUP BY d.name"""
    with connection.cursor() as cur:
        cur.execute(sql, {"b": budget or 0, "s": STATE_NAME[state_code], "t": property_type, "q": quarters, "d": district or ''})
        return {name: (int(n), _k(p10), _k(p50), _k(p90), int(u)) for name, n, p10, p50, p90, u in cur.fetchall()}


def _k(v):
    """a price to the nearest RM 1,000"""
    return int(round(float(v) / 1000.0)) * 1000


def _raw(state_code, property_type, budget, district=None):
    """(quarters, raw_stats) or nothing where the raw table is not loaded (SQLite dev/CI)."""
    try:
        with transaction.atomic():           # a savepoint, so a missing table cannot poison an outer transaction
            quarters = recent_quarters()
            return quarters, (raw_stats(state_code, property_type, budget, quarters, district) if quarters else {})
    except DatabaseError:
        return [], {}


def state_income(state_code):
    """Median household income a month for the state (DOSM), or None where it is not loaded."""
    try:
        with transaction.atomic(), connection.cursor() as cur:
            cur.execute("SELECT i.income_median FROM state_income i JOIN state s ON s.id = i.state_id "
                        "WHERE s.name = %s ORDER BY i.year DESC LIMIT 1", [STATE_NAME[state_code]])
            row = cur.fetchone()
            return int(row[0]) if row and row[0] is not None else None
    except DatabaseError:
        return None


def areas(version, state_code, property_type, budget):
    quarters, raw = _raw(state_code, property_type, budget)
    if property_type == 'all':
        model = {}
    else:
        # L first, so freehold (F) wins when both exist
        model = {c.district: c for c in PriceRangeCell.objects.filter(
            version=version, state_code=state_code, property_type=property_type, size_band='typical').order_by('-tenure')}
    names = sorted(set(raw) | set(model))
    out = []
    for d in names:
        n, r10, r50, r90, u = raw.get(d, (0, None, None, None, 0))
        c = model.get(d)
        enough = n >= MIN_SALES_FOR_SHARE
        if property_type == 'all':
            low, typ, high = (r10, r50, r90) if enough else (None, None, None)
        else:
            low, typ, high = (c.p10, c.p50, c.p90) if c else (None, None, None)
        out.append({"district": d, "sales": n, "share_under": round(u / n, 3) if enough else None,
                    "typical": typ, "low": low, "high": high})
    return {"window": {"from": quarters[0], "to": quarters[-1]} if quarters else None,
            "income": state_income(state_code), "areas": out}


def _history(version, state_code, property_type, typical):
    """The state's price index as typical prices: a rolling 4-quarter mean, scaled so the
    latest point is this home's typical price. Returns (points, the value a year ago)."""
    idx_type = 'all_types' if property_type == 'all' else property_type
    pts = list(PriceIndexPoint.objects.filter(version=version, state_code=state_code, property_type=idx_type))
    if not pts:
        pts = list(PriceIndexPoint.objects.filter(version=version, state_code='ALL', property_type=idx_type))
    vals = [p.index_value for p in pts]
    roll = []
    for i in range(3, len(vals)):
        w = [v for v in vals[i - 3:i + 1] if v is not None]
        roll.append((pts[i].quarter, sum(w) / len(w) if len(w) >= 3 else None))
    roll = [(q, v) for q, v in roll if v]
    if not roll or not typical:
        return [], None
    last = roll[-1][1]
    out = [{"quarter": q, "value": _k(typical * v / last)} for q, v in roll]
    return out, (out[-5]["value"] if len(out) >= 5 else None)


def _bands(sc, mids):
    """The trend's likely range around each future typical price, from the state scenario."""
    out = []
    for y, mid in zip((1, 2, 3), mids):
        s = sc.get(y)
        if s is None or mid is None:
            out.append(None)
            continue
        out.append({"low": _k(mid * (1 + s.growth_low) / (1 + s.growth_mid)),
                    "high": _k(mid * (1 + s.growth_high) / (1 + s.growth_mid))})
    return out


def home(version, district, property_type, tenure, size_band):
    if property_type == 'all':
        return _home_all(version, district)
    cells = list(PriceRangeCell.objects.filter(version=version, district=district, property_type=property_type))
    if not cells:
        return None
    tenures = sorted({c.tenure for c in cells})
    tenure = tenure if tenure in tenures else tenures[0]

    def pick(band):
        return next((c for c in cells if c.tenure == tenure and c.size_band == band), None)

    c = pick(size_band) or pick('typical') or cells[0]
    sc = {s.years: s for s in PriceScenario.objects.filter(version=version, state_code=c.state_code, property_type=property_type)}

    def band(a, b, d):
        return {"p10": a, "p50": b, "p90": d}

    future = [dict(band(getattr(c, f"y{y}_p10"), getattr(c, f"y{y}_p50"), getattr(c, f"y{y}_p90")),
                   years=y, prob_lower=round(sc[y].prob_price_fall, 3) if y in sc else None) for y in (1, 2, 3)]
    s1 = sc.get(1)
    history, last_year = _history(version, c.state_code, property_type, c.p50)
    return {
        "history": history, "last_year": last_year,
        "trend_band": _bands(sc, [f["p50"] for f in future]), "income": state_income(c.state_code),
        "district": c.district, "state_code": c.state_code, "property_type": property_type,
        "tenure": c.tenure, "tenures_available": tenures, "size_band": c.size_band,
        "sizes": {b: x.size_m2 for b in ('small', 'typical', 'large') if (x := pick(b))},
        "size_m2": c.size_m2, "storeys": c.storeys, "n_sales_2y": c.n_sales_2y,
        "today": band(c.p10, c.p50, c.p90), "future": future,
        "trend": {"annual": s1.annual_trend, "low": s1.annual_trend_p10, "high": s1.annual_trend_p90,
                  "quality": s1.data_quality} if s1 else None,
        "accuracy": version.meta.get("accuracy", {}).get(property_type),
        "drivers": version.meta.get("drivers", []),
    }


def trend(version, state_code, property_type):
    def pts(sc):
        return list(PriceIndexPoint.objects.filter(version=version, state_code=sc, property_type=property_type))

    st, nat = pts(state_code), pts('ALL')
    by_q = {p.quarter: p for p in st}
    # Line the state up with the national quarters, so both series share one x axis.
    return {"quarters": [p.quarter for p in nat],
            "state": [by_q[p.quarter].index_value if p.quarter in by_q else None for p in nat],
            "national": [p.index_value for p in nat],
            "sales": [by_q[p.quarter].sales if p.quarter in by_q else 0 for p in nat]}


def _home_all(version, district):
    """Every home type together: today's range from raw sales; the years ahead grow the typical
    price by each type's model growth, weighted by how many of that type sold here."""
    cell = PriceRangeCell.objects.filter(version=version, district=district).first()
    if cell is None:
        return None
    state_code = cell.state_code
    _, raw = _raw(state_code, 'all', None, district)
    n, p10, p50, p90, _u = raw.get(district, (0, None, None, None, 0))
    if n < MIN_SALES_FOR_SHARE:
        return None
    # weights: recent sales of each type here; growth: the type's typical cell, else the state scenario
    _, by_type = _raw_types(state_code, district)
    cells = {c.property_type: c for c in PriceRangeCell.objects.filter(
        version=version, district=district, size_band='typical').order_by('-tenure')}
    scen = {(s.property_type, s.years): s for s in PriceScenario.objects.filter(version=version, state_code=state_code)}
    growth, lo, hi, fall, w_all = [0.0] * 3, [0.0] * 3, [0.0] * 3, [0.0] * 3, 0.0
    for t, w in by_type.items():
        c = cells.get(t)
        ss = [scen.get((t, y)) for y in (1, 2, 3)]
        if not w or (c is None and not all(ss)):
            continue
        w_all += w
        for i, y in enumerate((1, 2, 3)):
            g = (getattr(c, f"y{y}_p50") / c.p50 - 1) if c else ss[i].growth_mid
            growth[i] += w * g
            if ss[i]:
                lo[i] += w * (ss[i].growth_low - ss[i].growth_mid)
                hi[i] += w * (ss[i].growth_high - ss[i].growth_mid)
                fall[i] += w * ss[i].prob_price_fall
    future, bands = [], []
    for i, y in enumerate((1, 2, 3)):
        mid = _k(p50 * (1 + growth[i] / w_all)) if w_all else None
        future.append({"p10": None, "p50": mid, "p90": None, "years": y,
                       "prob_lower": round(fall[i] / w_all, 3) if w_all else None})
        bands.append({"low": _k(mid * (1 + lo[i] / w_all)), "high": _k(mid * (1 + hi[i] / w_all))} if mid else None)
    history, last_year = _history(version, state_code, 'all', p50)
    s1 = PriceScenario.objects.filter(version=version, state_code=state_code, property_type='terrace', years=1).first()
    return {
        "history": history, "last_year": last_year, "trend_band": bands, "income": state_income(state_code),
        "district": district, "state_code": state_code, "property_type": 'all',
        "tenure": 'F', "tenures_available": [], "size_band": 'typical', "sizes": {},
        "size_m2": 0, "storeys": 0, "n_sales_2y": n,
        "today": {"p10": p10, "p50": p50, "p90": p90}, "future": future,
        "trend": {"annual": s1.annual_trend, "low": s1.annual_trend_p10, "high": s1.annual_trend_p90,
                  "quality": s1.data_quality} if s1 else None,
        "accuracy": version.meta.get("accuracy", {}).get('terrace'),
        "drivers": version.meta.get("drivers", []),
    }


def _raw_types(state_code, district):
    """(quarters, {home type: recent sales}) for one district from the raw NAPIC table."""
    try:
        with transaction.atomic():
            quarters = recent_quarters()
            if not quarters:
                return [], {}
            with connection.cursor() as cur:
                cur.execute("""
                    SELECT t.property_type, count(*)
                    FROM property_transaction t JOIN district d ON d.id = t.district_id JOIN state s ON s.id = d.state_id
                    WHERE s.name = %s AND d.name = %s AND t.quarter = ANY(%s)
                    GROUP BY t.property_type""", [STATE_NAME[state_code], district, quarters])
                return quarters, {t: int(n) for t, n in cur.fetchall()}
    except DatabaseError:
        return [], {}
