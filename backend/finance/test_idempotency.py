from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from rest_framework.authtoken.models import Token

from .models import ExpenseEntry, GuestProfile, IdempotencyRecord, IncomeEntry, WorkCostEntry


class CreateIdempotencyTests(TestCase):
    def setUp(self):
        self.client = Client(HTTP_X_RUMAMPU_CLIENT_ID="idempotency-test-client")
        record = self.client.get("/api/v1/income/record/").json()
        self.source_id = record["sources"][0]["id"]

    def post_twice(self, path, payload, *, key):
        first = self.client.post(
            path,
            payload,
            content_type="application/json",
            HTTP_IDEMPOTENCY_KEY=key,
        )
        second = self.client.post(
            path,
            payload,
            content_type="application/json",
            HTTP_IDEMPOTENCY_KEY=key,
        )
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 201)
        self.assertEqual(second.json(), first.json())
        return first.json()

    def test_income_double_save_creates_one_row(self):
        self.post_twice(
            "/api/v1/income/entries/",
            {
                "amount": "120.50",
                "date": "2026-09-10",
                "source_id": self.source_id,
                "entry_method": "manual",
            },
            key="income-double-tap-0001",
        )
        self.assertEqual(IncomeEntry.objects.count(), 1)

    def test_work_cost_and_expense_double_saves_create_one_row_each(self):
        work_category = self.client.get("/api/v1/work-costs/").json()[0]["id"]
        expense_category = self.client.get("/api/v1/expense-categories/").json()[0]["id"]
        self.post_twice(
            "/api/v1/work-costs/entries/",
            {"amount": "20.00", "date": "2026-09-10", "category_id": work_category},
            key="work-cost-double-tap-0001",
        )
        self.post_twice(
            "/api/v1/expenses/",
            {"amount": "30.00", "date": "2026-09-10", "category_id": expense_category},
            key="expense-double-tap-0001",
        )
        self.assertEqual(WorkCostEntry.objects.count(), 1)
        self.assertEqual(ExpenseEntry.objects.count(), 1)

    def test_reusing_a_key_with_different_data_is_rejected(self):
        base = {
            "amount": "120.50",
            "date": "2026-09-10",
            "source_id": self.source_id,
            "entry_method": "manual",
        }
        first = self.client.post(
            "/api/v1/income/entries/",
            base,
            content_type="application/json",
            HTTP_IDEMPOTENCY_KEY="income-reused-key-0001",
        )
        second = self.client.post(
            "/api/v1/income/entries/",
            {**base, "amount": "999.00"},
            content_type="application/json",
            HTTP_IDEMPOTENCY_KEY="income-reused-key-0001",
        )
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 409)
        self.assertEqual(second.json()["error"]["code"], "idempotency_key_reused")
        self.assertEqual(IncomeEntry.objects.count(), 1)

    def test_guest_record_deletion_removes_replay_response(self):
        self.post_twice(
            "/api/v1/income/entries/",
            {"amount": "120.50", "date": "2026-09-10", "source_id": self.source_id, "entry_method": "manual"},
            key="guest-delete-replay-0001",
        )
        profile = GuestProfile.objects.get(income_entries__isnull=False)
        owner_key = f"profile:{profile.public_id}"
        self.assertEqual(IdempotencyRecord.objects.filter(owner_key=owner_key).count(), 1)

        self.assertEqual(self.client.delete("/api/v1/auth/record/").status_code, 204)
        self.assertFalse(IdempotencyRecord.objects.filter(owner_key=owner_key).exists())

    def test_account_record_deletion_removes_replay_response(self):
        user = get_user_model().objects.create_user(username="replay-delete@example.invalid")
        token = Token.objects.create(user=user)
        client = Client(HTTP_AUTHORIZATION=f"Token {token.key}")
        source_id = client.get("/api/v1/income/record/").json()["sources"][0]["id"]
        response = client.post(
            "/api/v1/income/entries/",
            {"amount": "120.50", "date": "2026-09-10", "source_id": source_id, "entry_method": "manual"},
            content_type="application/json",
            HTTP_IDEMPOTENCY_KEY="account-delete-replay-0001",
        )
        owner_key = f"user:{user.pk}"
        self.assertEqual(response.status_code, 201)
        self.assertEqual(IdempotencyRecord.objects.filter(owner_key=owner_key).count(), 1)

        self.assertEqual(client.delete("/api/v1/auth/record/").status_code, 204)
        self.assertFalse(IdempotencyRecord.objects.filter(owner_key=owner_key).exists())
