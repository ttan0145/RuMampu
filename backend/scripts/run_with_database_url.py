#!/usr/bin/env python3
"""Run a Django management command against DATABASE_URL explicitly."""

import os
import sys
from urllib.parse import parse_qs, unquote, urlsplit


database_url = os.environ.get("DATABASE_URL", "")
parts = urlsplit(database_url)
if parts.scheme not in {"postgres", "postgresql"} or not parts.hostname:
    raise SystemExit("DATABASE_URL must be a PostgreSQL connection URL")

query = parse_qs(parts.query)
os.environ.update(
    PGHOST=parts.hostname,
    PGDATABASE=unquote(parts.path.lstrip("/")),
    PGUSER=unquote(parts.username or ""),
    PGPASSWORD=unquote(parts.password or ""),
    PGPORT=str(parts.port or 5432),
    PGSSLMODE=query.get("sslmode", ["require"])[0],
)

from django.core.management import execute_from_command_line

execute_from_command_line(["manage.py", *sys.argv[1:]])
