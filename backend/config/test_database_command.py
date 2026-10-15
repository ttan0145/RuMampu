import os
from pathlib import Path
import subprocess
import sys

from django.test import SimpleTestCase


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "run_with_database_url.py"


class DatabaseCommandTests(SimpleTestCase):
    def run_command(self, database_url):
        environment = {**os.environ, "DATABASE_URL": database_url}
        # GitHub does not set these; the helper must initialize Django itself.
        environment.pop("DJANGO_SETTINGS_MODULE", None)
        environment.pop("PYTHONPATH", None)
        return subprocess.run(
            [sys.executable, str(SCRIPT), "check"],
            cwd=SCRIPT.parent,
            env=environment,
            text=True,
            capture_output=True,
            check=False,
        )

    def test_initializes_project_from_script_directory_without_database_access(self):
        # `check` doesn't query the database. An unreachable dummy URL ensures
        # this regression test never needs production credentials or a server.
        result = self.run_command("postgresql://ci:ci@127.0.0.1:1/ci?sslmode=disable")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("System check identified no issues", result.stdout)

    def test_rejects_missing_database_url(self):
        result = self.run_command("")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("DATABASE_URL must be a PostgreSQL connection URL", result.stderr)
