from io import StringIO
from unittest.mock import patch

from django.test import Client, TestCase, override_settings


class RetentionCronTests(TestCase):
    url = "/api/v1/internal/retention/run/"

    @override_settings(CRON_SECRET="")
    @patch("config.views.call_command")
    def test_runner_fails_closed_without_a_configured_secret(self, command):
        response = Client().get(self.url)

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["error"]["code"], "retention_cron_disabled")
        command.assert_not_called()

    @override_settings(CRON_SECRET="test-cron-secret")
    @patch("config.views.call_command")
    def test_runner_rejects_a_missing_or_incorrect_secret(self, command):
        missing = Client().get(self.url)
        incorrect = Client(HTTP_AUTHORIZATION="Bearer incorrect").get(self.url)

        self.assertEqual(missing.status_code, 401)
        self.assertEqual(incorrect.status_code, 401)
        command.assert_not_called()

    @override_settings(CRON_SECRET="test-cron-secret")
    @patch("config.views.call_command")
    def test_authorized_runner_executes_retention_and_returns_counts(self, command):
        def write_result(name, *, stdout: StringIO):
            self.assertEqual(name, "process_record_retention")
            stdout.write(
                "warned=2 deleted_accounts=1 deleted_guests=3 dry_run=False"
            )

        command.side_effect = write_result
        response = Client(HTTP_AUTHORIZATION="Bearer test-cron-secret").get(self.url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            "status": "ok",
            "result": "warned=2 deleted_accounts=1 deleted_guests=3 dry_run=False",
        })
        command.assert_called_once()

    @override_settings(CRON_SECRET="test-cron-secret")
    @patch("config.views.call_command", side_effect=RuntimeError("database unavailable"))
    def test_runner_returns_500_when_retention_fails(self, _command):
        response = Client(HTTP_AUTHORIZATION="Bearer test-cron-secret").get(self.url)

        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.json()["error"]["code"], "retention_cron_failed")
