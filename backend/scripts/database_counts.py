#!/usr/bin/env python3
"""Snapshot and compare row counts without printing connection credentials."""

import argparse
import json
import os
from pathlib import Path

import psycopg
from psycopg import sql


def snapshot(database_url: str) -> dict[str, int]:
    with psycopg.connect(database_url) as connection, connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT tablename
            FROM pg_catalog.pg_tables
            WHERE schemaname = 'public'
            ORDER BY tablename
            """
        )
        tables = [row[0] for row in cursor.fetchall()]
        counts = {}
        for table in tables:
            cursor.execute(sql.SQL("SELECT count(*) FROM {}").format(sql.Identifier(table)))
            counts[table] = cursor.fetchone()[0]
        return counts


def compare(before: dict[str, int], after: dict[str, int], exact_tables: bool, ignored_tables: set[str]) -> None:
    problems = []
    for table, count in before.items():
        if table in ignored_tables:
            continue
        if table not in after:
            problems.append(f"{table}: table disappeared")
        elif after[table] != count:
            problems.append(f"{table}: {count} -> {after[table]}")
    for table in sorted(after.keys() - before.keys()):
        if table in ignored_tables:
            continue
        if exact_tables or after[table] != 0:
            problems.append(f"{table}: new table has {after[table]} rows")
    if problems:
        raise SystemExit("Row-count comparison failed:\n" + "\n".join(problems))


parser = argparse.ArgumentParser()
subparsers = parser.add_subparsers(dest="command", required=True)
save = subparsers.add_parser("snapshot")
save.add_argument("output", type=Path)
check = subparsers.add_parser("compare")
check.add_argument("before", type=Path)
check.add_argument("after", type=Path)
check.add_argument("--exact-tables", action="store_true")
check.add_argument("--ignore-table", action="append", default=[])
args = parser.parse_args()

if args.command == "snapshot":
    database_url = os.environ.get("DATABASE_URL", "")
    if not database_url:
        raise SystemExit("DATABASE_URL is required")
    counts = snapshot(database_url)
    args.output.write_text(json.dumps(counts, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"Recorded row counts for {len(counts)} public tables.")
else:
    compare(
        json.loads(args.before.read_text(encoding="utf-8")),
        json.loads(args.after.read_text(encoding="utf-8")),
        args.exact_tables,
        set(args.ignore_table),
    )
    print("Row counts match.")
