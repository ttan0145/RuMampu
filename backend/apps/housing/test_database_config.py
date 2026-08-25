from pathlib import Path

from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase

from config.database import build_default_database_config


class DatabaseConfigTests(SimpleTestCase):
    base_dir = Path("/tmp/rumampu-backend")

    def test_empty_pghost_selects_local_sqlite(self):
        config = build_default_database_config({}, self.base_dir)

        self.assertEqual(config["ENGINE"], "django.db.backends.sqlite3")
        self.assertEqual(config["NAME"], self.base_dir / "db.sqlite3")

    def test_partial_postgres_configuration_fails_during_startup(self):
        with self.assertRaisesMessage(
            ImproperlyConfigured,
            "PGDATABASE, PGUSER, PGPASSWORD",
        ):
            build_default_database_config({"PGHOST": "example.neon.tech"}, self.base_dir)

    def test_neon_configuration_requires_tls_by_default(self):
        config = build_default_database_config(
            {
                "PGHOST": "example.neon.tech",
                "PGDATABASE": "rumampu",
                "PGUSER": "rumampu_owner",
                "PGPASSWORD": "secret",
            },
            self.base_dir,
        )

        self.assertEqual(config["ENGINE"], "django.db.backends.postgresql")
        self.assertEqual(config["OPTIONS"], {"sslmode": "require"})
        self.assertEqual(config["PORT"], "5432")

    def test_invalid_postgres_port_and_ssl_mode_are_rejected(self):
        base = {
            "PGHOST": "example.neon.tech",
            "PGDATABASE": "rumampu",
            "PGUSER": "rumampu_owner",
            "PGPASSWORD": "secret",
        }
        for override in ({"PGPORT": "invalid"}, {"PGSSLMODE": "unsafe"}):
            with self.subTest(override=override), self.assertRaises(ImproperlyConfigured):
                build_default_database_config({**base, **override}, self.base_dir)
