"""
Load transactions_clean.csv into property_transaction.

Run after load_neon.py (it needs the district table to resolve IDs).

    python load_transactions.py

Uses COPY FROM STDIN, which is what psql's \\copy uses underneath and is far
faster than row-by-row inserts for 138k rows.
"""
import io
import os
import csv
import pandas as pd
import psycopg2
from dotenv import load_dotenv

HERE = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(HERE, ".env"))

DATABASE_URL = os.getenv("DATABASE_URL") or (
    f"postgresql://{os.environ['PGUSER']}:{os.environ['PGPASSWORD']}"
    f"@{os.environ['PGHOST']}:{os.environ.get('PGPORT', '5432')}"
    f"/{os.environ['PGDATABASE']}?sslmode=require"
)

CSV_PATH = os.path.join(HERE, "data", "transactions_clean.csv")
SCHEMA_PATH = os.path.join(HERE, "data", "schema_transactions.sql")


def main():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    with open(SCHEMA_PATH) as f:
        cur.execute(f.read())
    print("transaction schema applied")

    cur.execute("SELECT d.name, s.name, d.id FROM district d "
                "JOIN state s ON s.id = d.state_id")
    district_id = {(d, s): i for d, s, i in cur.fetchall()}
    print(f"districts known: {len(district_id)}")

    df = pd.read_csv(CSV_PATH, low_memory=False)
    df = df[~df["price_outlier"]]
    print(f"rows to load: {len(df)}")

    cur.execute("SELECT count(*) FROM property_transaction")
    if cur.fetchone()[0]:
        cur.execute("TRUNCATE property_transaction")
        print("existing rows cleared")

    buf = io.StringIO()
    w = csv.writer(buf)
    missing = 0
    for r in df.itertuples():
        key = (r.district, r.state)
        if key not in district_id:
            missing += 1
            continue
        w.writerow([
            district_id[key],
            r.mukim if pd.notna(r.mukim) else "",
            r.scheme_area if pd.notna(r.scheme_area) else "",
            r.txn_date,
            r.quarter,
            r.property_type,
            r.tenure if pd.notna(r.tenure) else "",
            "" if pd.isna(r.land_area) else r.land_area,
            "" if pd.isna(r.floor_area) else r.floor_area,
            r.price_rm,
        ])
    if missing:
        print(f"WARNING {missing} rows had no matching district and were skipped")

    buf.seek(0)
    cur.copy_expert(
        "COPY property_transaction "
        "(district_id, mukim, scheme_area, txn_date, quarter, property_type, "
        " tenure, land_area, floor_area, price_rm) "
        "FROM STDIN WITH (FORMAT csv, NULL '')",
        buf)
    conn.commit()

    cur.execute("SELECT count(*), min(txn_date), max(txn_date) "
                "FROM property_transaction")
    n, lo, hi = cur.fetchone()
    print(f"loaded {n} rows, {lo} to {hi}")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
