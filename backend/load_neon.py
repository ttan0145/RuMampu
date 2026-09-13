"""
Load cleaned NAPIC + DOSM data into Neon Postgres.

    pip install psycopg2-binary pandas python-dotenv
    python load_neon.py

Idempotent: re-running upserts rather than duplicating.
"""
import os
import csv
import io
from urllib.parse import quote, urlsplit, urlunsplit, parse_qsl, urlencode

import pandas as pd
import psycopg2
from dotenv import load_dotenv
from psycopg2.extras import execute_values

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(BASE_DIR, "data")

# Load the backend's .env regardless of the directory from which this script is run.
load_dotenv(os.path.join(BASE_DIR, ".env"))


def _database_url():
    """Return DATABASE_URL, or build a Neon URL from the separate PG* settings."""
    override = os.getenv("DATABASE_URL")
    if override:
        # Keep an explicitly supplied URL as the override, but ensure Neon SSL when
        # the URL does not already specify an sslmode.
        parts = urlsplit(override)
        query = dict(parse_qsl(parts.query, keep_blank_values=True))
        query.setdefault("sslmode", "require")
        return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))

    names = ("PGDATABASE", "PGUSER", "PGPASSWORD", "PGHOST", "PGPORT")
    missing = [name for name in names if not os.getenv(name)]
    if missing:
        raise RuntimeError(
            "Missing database settings in backend/.env: " + ", ".join(missing)
        )

    # Quote each component so passwords or names containing URL punctuation remain valid.
    return (
        f"postgresql://{quote(os.environ['PGUSER'], safe='')}:{quote(os.environ['PGPASSWORD'], safe='')}"
        f"@{quote(os.environ['PGHOST'], safe='')}:{quote(os.environ['PGPORT'], safe='')}"
        f"/{quote(os.environ['PGDATABASE'], safe='')}?sslmode=require"
    )

AGG = f"{DATA}/area_price_agg.csv"
INCOME = f"{DATA}/state_income.csv"
SCHEMA = f"{DATA}/schema.sql"

# quarters still subject to revision
PRELIMINARY_FROM = "2026Q1"


def main():
    agg = pd.read_csv(AGG)
    inc = pd.read_csv(INCOME)

    conn = psycopg2.connect(_database_url())
    conn.autocommit = False
    cur = conn.cursor()

    # ---- 1. schema
    with open(SCHEMA) as f:
        cur.execute(f.read())
    print("schema applied")

    # ---- 2. states
    states = sorted(set(agg["state"]) | set(inc["state_name"]))
    execute_values(cur,
                   "INSERT INTO state (name) VALUES %s ON CONFLICT (name) DO NOTHING",
                   [(s,) for s in states])
    cur.execute("SELECT name, id FROM state")
    state_id = dict(cur.fetchall())
    print(f"states: {len(state_id)}")

    # ---- 3. districts
    pairs = agg[["district", "state"]].drop_duplicates()
    execute_values(cur,
                   "INSERT INTO district (name, state_id) VALUES %s "
                   "ON CONFLICT (name, state_id) DO NOTHING",
                   [(r.district, state_id[r.state]) for r in pairs.itertuples()])
    cur.execute("SELECT d.name, s.name, d.id FROM district d JOIN state s ON s.id=d.state_id")
    district_id = {(d, s): i for d, s, i in cur.fetchall()}
    print(f"districts: {len(district_id)}")

    # ---- 4. income
    execute_values(cur,
                   "INSERT INTO state_income "
                   "(state_id, year, income_mean, income_median, expenditure_mean, gini, poverty) "
                   "VALUES %s ON CONFLICT (state_id, year) DO UPDATE SET "
                   "income_mean=EXCLUDED.income_mean, income_median=EXCLUDED.income_median, "
                   "expenditure_mean=EXCLUDED.expenditure_mean, gini=EXCLUDED.gini, "
                   "poverty=EXCLUDED.poverty",
                   [(state_id[r.state_name], int(r.year), r.income_mean, r.income_median,
                     r.expenditure_mean, r.gini, r.poverty) for r in inc.itertuples()])
    print(f"income rows: {len(inc)}")

    # ---- 5. price aggregates
    rows = []
    for r in agg.itertuples():
        rows.append((
            district_id[(r.district, r.state)],
            r.quarter,
            r.property_type,
            int(r.sales_count),
            _num(r.total_value_rm),
            _num(r.mean_price_rm),
            _num(r.median_price_rm),
            _num(r.p25_price_rm),
            _num(r.p75_price_rm),
            _int(r.under_300k),
            _int(r.under_500k),
            r.quarter >= PRELIMINARY_FROM,
        ))

    execute_values(cur,
                   "INSERT INTO price_agg "
                   "(district_id, quarter, property_type, sales_count, total_value_rm, "
                   " mean_price_rm, median_price_rm, p25_price_rm, p75_price_rm, "
                   " under_300k, under_500k, preliminary) VALUES %s "
                   "ON CONFLICT (district_id, quarter, property_type) DO UPDATE SET "
                   "sales_count=EXCLUDED.sales_count, total_value_rm=EXCLUDED.total_value_rm, "
                   "mean_price_rm=EXCLUDED.mean_price_rm, median_price_rm=EXCLUDED.median_price_rm, "
                   "p25_price_rm=EXCLUDED.p25_price_rm, p75_price_rm=EXCLUDED.p75_price_rm, "
                   "under_300k=EXCLUDED.under_300k, under_500k=EXCLUDED.under_500k, "
                   "preliminary=EXCLUDED.preliminary, loaded_at=now()",
                   rows, page_size=1000)
    print(f"price_agg rows: {len(rows)}")

    conn.commit()

    # ---- 6. verify
    for q in ["SELECT count(*) FROM state",
              "SELECT count(*) FROM district",
              "SELECT count(*) FROM state_income",
              "SELECT count(*) FROM price_agg"]:
        cur.execute(q)
        print(q.split("FROM ")[1], "=", cur.fetchone()[0])

    cur.close()
    conn.close()
    print("done")


def _num(v):
    return None if pd.isna(v) else float(v)


def _int(v):
    return None if pd.isna(v) else int(v)


if __name__ == "__main__":
    main()
