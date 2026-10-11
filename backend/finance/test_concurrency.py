"""PostgreSQL race tests; SQLite cannot exercise row-level locking."""

from concurrent.futures import ThreadPoolExecutor
from threading import Barrier, local
from unittest import skipUnless
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db import connection, connections
from django.test import Client, TransactionTestCase
from rest_framework.authtoken.models import Token

from config import auth_views

from .models import ExpenseEntry, GuestProfile, UserAppState, WorkCostEntry
from .services import ensure_default_expense_categories, ensure_default_sources, ensure_default_work_costs


User = get_user_model()
postgres_only = skipUnless(connection.vendor == "postgresql", "PostgreSQL concurrency test")


@postgres_only
class PostgreSQLConcurrencyTests(TransactionTestCase):
    reset_sequences = True

    def setUp(self):
        self.user = User.objects.create_user(username="race@example.com")
        self.token = Token.objects.create(user=self.user)
        self.profile = GuestProfile.objects.create(user=self.user, session_key="postgres-race-profile")
        ensure_default_sources(self.profile)
        ensure_default_expense_categories(self.profile)
        ensure_default_work_costs(self.profile)

    def account_client(self):
        return Client(HTTP_AUTHORIZATION=f"Token {self.token.key}")

    def run_together(self, first, second):
        start = Barrier(2)

        def run(action):
            connections.close_all()
            start.wait(timeout=10)
            try:
                return action()
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(run, action) for action in (first, second)]
            return [future.result(timeout=20) for future in futures]

    def test_two_devices_update_distinct_account_fields_without_lost_updates(self):
        UserAppState.objects.get_or_create(user=self.user)
        loaded = Barrier(2)
        thread_state = local()
        original = auth_views._app_state

        def synchronized_load(user):
            state = original(user)
            if not getattr(thread_state, "loaded", False):
                thread_state.loaded = True
                loaded.wait(timeout=10)
            return state

        reminders = {
            "bill_reminders": True,
            "reminders": {"income": {"enabled": True, "day": 31, "time": "09:00"}},
        }
        with patch("config.auth_views._app_state", side_effect=synchronized_load):
            responses = self.run_together(
                lambda: self.account_client().patch(
                    "/api/v1/auth/me/",
                    {"learning_progress": {"sjkp": 3}},
                    content_type="application/json",
                ),
                lambda: self.account_client().patch(
                    "/api/v1/auth/me/",
                    {"notification_preferences": reminders},
                    content_type="application/json",
                ),
            )

        self.assertEqual([response.status_code for response in responses], [200, 200])
        state = UserAppState.objects.get(user=self.user)
        self.assertEqual(state.learning_progress, {"sjkp": 3})
        self.assertEqual(state.notification_preferences, reminders)

    def test_edit_and_move_are_serialized_to_one_complete_outcome(self):
        expense_category = self.profile.expense_categories.get(slug="meals")
        work_category = self.profile.work_cost_items.get(slug="petrol")
        source = ExpenseEntry.objects.create(
            profile=self.profile,
            category=expense_category,
            expense_date="2026-09-10",
            amount="20.00",
        )

        edit, move = self.run_together(
            lambda: self.account_client().patch(
                f"/api/v1/expenses/{source.pk}/",
                {"amount": "25.00"},
                content_type="application/json",
            ),
            lambda: self.account_client().patch(
                f"/api/v1/expenses/{source.pk}/move/",
                {"category_id": work_category.pk},
                content_type="application/json",
            ),
        )

        self.assertIn(edit.status_code, (200, 404))
        self.assertEqual(move.status_code, 200)
        self.assertFalse(ExpenseEntry.objects.filter(pk=source.pk).exists())
        self.assertEqual(WorkCostEntry.objects.filter(profile=self.profile).count(), 1)
        moved = WorkCostEntry.objects.get(profile=self.profile)
        self.assertIn(str(moved.amount), ("20.00", "25.00"))

    def test_simultaneous_same_idempotency_key_creates_one_income(self):
        source = self.profile.income_sources.get(slug="ehail")
        payload = {
            "amount": "100.00",
            "date": "2026-09-10",
            "source_id": source.pk,
            "entry_method": "manual",
        }

        responses = self.run_together(
            *(
                lambda: self.account_client().post(
                    "/api/v1/income/entries/",
                    payload,
                    content_type="application/json",
                    HTTP_IDEMPOTENCY_KEY="simultaneous-income-save-0001",
                )
                for _ in range(2)
            )
        )
        self.assertEqual([response.status_code for response in responses], [201, 201])
        self.assertEqual(responses[0].json(), responses[1].json())
        self.assertEqual(self.profile.income_entries.count(), 1)
