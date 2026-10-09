from pathlib import Path
from typing import Mapping

from django.core.exceptions import ImproperlyConfigured


POSTGRES_REQUIRED_SETTINGS = ("PGDATABASE", "PGUSER", "PGPASSWORD")
POSTGRES_SSL_MODES = {
    "disable",
    "allow",
    "prefer",
    "require",
    "verify-ca",
    "verify-full",
}


def build_default_database_config(
    environ: Mapping[str, str],
    base_dir: Path,
) -> dict:
    """Build one explicit SQLite or PostgreSQL configuration.

    PGHOST is the opt-in switch. Once it is set, a partial Neon/PostgreSQL
    configuration fails during Django startup instead of connecting with
    ambiguous defaults.
    """

    postgres_host = environ.get("PGHOST", "").strip()
    if not postgres_host:
        # SQLITE_PATH lets a local test run keep its own file (parallel Playwright
        # runs on different ports would otherwise lock one shared database).
        sqlite_path = environ.get("SQLITE_PATH", "").strip()
        return {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": Path(sqlite_path) if sqlite_path else base_dir / "db.sqlite3",
            "OPTIONS": {"timeout": 20},
        }

    missing = [name for name in POSTGRES_REQUIRED_SETTINGS if not environ.get(name, "").strip()]
    if missing:
        raise ImproperlyConfigured(
            "PGHOST enables PostgreSQL, but these settings are missing: "
            + ", ".join(missing)
        )

    sslmode = environ.get("PGSSLMODE", "require").strip().lower() or "require"
    if sslmode not in POSTGRES_SSL_MODES:
        raise ImproperlyConfigured(
            f"PGSSLMODE must be one of: {', '.join(sorted(POSTGRES_SSL_MODES))}."
        )

    port = environ.get("PGPORT", "5432").strip() or "5432"
    if not port.isdigit() or not 1 <= int(port) <= 65535:
        raise ImproperlyConfigured("PGPORT must be an integer between 1 and 65535.")

    return {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": environ["PGDATABASE"].strip(),
        "USER": environ["PGUSER"].strip(),
        "PASSWORD": environ["PGPASSWORD"],
        "HOST": postgres_host,
        "PORT": port,
        "OPTIONS": {"sslmode": sslmode},
    }
