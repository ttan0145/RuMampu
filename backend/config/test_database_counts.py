import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

from django.test import SimpleTestCase


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "database_counts.py"


class DatabaseCountComparisonTests(SimpleTestCase):
    def compare(self, before, after, *extra):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            first = root / "before.json"
            second = root / "after.json"
            first.write_text(json.dumps(before), encoding="utf-8")
            second.write_text(json.dumps(after), encoding="utf-8")
            return subprocess.run(
                [sys.executable, SCRIPT, "compare", first, second, *extra],
                text=True,
                capture_output=True,
                env={**os.environ, "PGHOST": ""},
                check=False,
            )

    def test_matching_counts_pass(self):
        self.assertEqual(self.compare({"a": 2}, {"a": 2}).returncode, 0)

    def test_changed_or_removed_rows_fail(self):
        result = self.compare({"a": 2, "b": 1}, {"a": 1})
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("a: 2 -> 1", result.stderr)
        self.assertIn("b: table disappeared", result.stderr)

    def test_empty_migration_table_is_allowed_but_restore_requires_exact_tables(self):
        self.assertEqual(self.compare({"a": 2}, {"a": 2, "new": 0}).returncode, 0)
        self.assertNotEqual(
            self.compare({"a": 2}, {"a": 2, "new": 0}, "--exact-tables").returncode,
            0,
        )

    def test_can_ignore_django_migration_ledger_growth(self):
        self.assertEqual(
            self.compare(
                {"accounts": 2, "django_migrations": 25},
                {"accounts": 2, "django_migrations": 27},
                "--ignore-table", "django_migrations",
            ).returncode,
            0,
        )
