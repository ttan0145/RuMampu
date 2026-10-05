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


def share_under(state_code, property_type, budget, quarters):
    """district -> (sales, sales at or under budget) from the raw NAPIC table (last 4 quarters)."""
    sql = """
        SELECT d.name, count(*), count(*) FILTER (WHERE t.price_rm <= %(b)s)
        FROM property_transaction t JOIN district d ON d.id = t.district_id JOIN state s ON s.id = d.state_id
        WHERE s.name = %(s)s AND t.property_type = %(t)s AND t.quarter = ANY(%(q)s)
        GROUP BY d.name"""
    with connection.cursor() as cur:
        cur.execute(sql, {"b": budget, "s": STATE_NAME[state_code], "t": property_type, "q": quarters})
        return {name: (int(n), int(u)) for name, n, u in cur.fetchall()}


def _sales_counts(state_code, property_type, budget):
    """Recent sales per district, or nothing where the raw table is not loaded (SQLite dev/CI)."""
    try:
        with transaction.atomic():           # a savepoint, so a missing table cannot poison an outer transaction
            quarters = recent_quarters()
            return quarters, (share_under(state_code, property_type, budget, quarters) if quarters else {})
    except DatabaseError:
        return [], {}


def areas(version, state_code, property_type, budget):
    quarters, counts = _sales_counts(state_code, property_type, budget)
    typical = {c.district: c.p50 for c in PriceRangeCell.objects.filter(
        version=version, state_code=state_code, property_type=property_type, size_band='typical').order_by('-tenure')}  # L first, so freehold (F) wins when both exist
    names = sorted(set(counts) | set(typical))
    out = []
    for d in names:
        n, u = counts.get(d, (0, 0))
        out.append({"district": d, "sales": n, "share_under": round(u / n, 3) if n >= MIN_SALES_FOR_SHARE else None,
                    "typical": typical.get(d)})
    return {"window": {"from": quarters[0], "to": quarters[-1]} if quarters else None, "areas": out}


def home(version, district, property_type, tenure, size_band):
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
    return {
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
