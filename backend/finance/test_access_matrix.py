"""Contract-backed cross-account access checks for every ID endpoint."""

from datetime import date
from pathlib import Path

import yaml
from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from rest_framework.authtoken.models import Token

from apps.housing.models import HousingScenario, SavedHousingTest

from .models import (
    ExpenseEntry, FinancialPeriod, GuestProfile, IncomeEntry,
    IncomeImportBatch, IncomeImportRow, WorkCostEntry,
)
from .services import (
    ensure_default_commitments, ensure_default_expense_categories,
    ensure_default_sources, ensure_default_work_costs,
)


User = get_user_model()


class ContractAccessIsolationTests(TestCase):
    def make_profile(self, user, key):
        profile = GuestProfile.objects.create(user=user, session_key=key)
        ensure_default_sources(profile)
        ensure_default_work_costs(profile)
        ensure_default_commitments(profile)
        ensure_default_expense_categories(profile)
        return profile

    def setUp(self):
        attacker = User.objects.create_user(username="account-a")
        victim = User.objects.create_user(username="account-b")
        self.a = self.make_profile(attacker, "access-matrix-a")
        self.b = self.make_profile(victim, "access-matrix-b")
        token = Token.objects.create(user=attacker)
        self.client = Client(HTTP_AUTHORIZATION=f"Token {token.key}")

        period = FinancialPeriod.objects.create(profile=self.b, period_month=date(2026, 9, 1))
        self.income = IncomeEntry.objects.create(
            profile=self.b, period=period, source=self.b.income_sources.get(slug="ehail"),
            income_date=date(2026, 9, 10), gross_amount="100.00",
        )
        self.work = WorkCostEntry.objects.create(
            profile=self.b, category=self.b.work_cost_items.get(slug="petrol"),
            cost_date=date(2026, 9, 10), amount="10.00",
        )
        self.expense = ExpenseEntry.objects.create(
            profile=self.b, category=self.b.expense_categories.get(slug="meals"),
            expense_date=date(2026, 9, 10), amount="20.00",
        )
        self.commitment = self.b.commitment_items.first()
        self.scenario = HousingScenario.objects.create(
            user=victim, property_price="300000.00", deposit="30000.00",
            financing_rate="4.000", tenure_years=30,
        )
        self.saved = SavedHousingTest.objects.create(
            user=victim, scenario=self.scenario, monthly_payment="1500.00",
        )
        self.batch = IncomeImportBatch.objects.create(profile=self.b, file_name="victim.csv")
        self.row = IncomeImportRow.objects.create(
            batch=self.batch, row_number=1, raw_amount="100",
            raw_date="2026-09-10", raw_source="Work",
        )

    def test_every_id_endpoint_refuses_another_accounts_record(self):
        expense_category = self.a.expense_categories.get(slug="meals").pk
        work_category = self.a.work_cost_items.get(slug="petrol").pk
        source = self.a.income_sources.get(slug="ehail").pk
        cases = [
            ("patch", f"/api/v1/commitments/{self.commitment.pk}/", {"monthly_amount": "1.00"}),
            ("patch", f"/api/v1/expenses/{self.expense.pk}/", {"amount": "1.00"}),
            ("patch", f"/api/v1/expenses/{self.expense.pk}/coverage/", {"entry_method": "manual"}),
            ("patch", f"/api/v1/expenses/{self.expense.pk}/move/", {"category_id": work_category}),
            ("get", f"/api/v1/housing/saved-tests/{self.saved.pk}/", None),
            ("patch", f"/api/v1/housing/saved-tests/{self.saved.pk}/", {"name": "stolen"}),
            ("delete", f"/api/v1/housing/saved-tests/{self.saved.pk}/", None),
            ("get", f"/api/v1/housing/scenarios/{self.scenario.pk}/", None),
            ("put", f"/api/v1/housing/scenarios/{self.scenario.pk}/", {
                "property_price": "1.00", "deposit": "0.00",
                "financing_rate": "0.000", "tenure_years": 1,
            }),
            ("patch", f"/api/v1/housing/scenarios/{self.scenario.pk}/", {"property_price": "1.00"}),
            ("delete", f"/api/v1/housing/scenarios/{self.scenario.pk}/", None),
            ("get", f"/api/v1/income-imports/{self.batch.pk}/", None),
            ("post", f"/api/v1/income-imports/{self.batch.pk}/confirm/", {}),
            ("patch", f"/api/v1/income-imports/{self.batch.pk}/rows/{self.row.pk}/", {
                "amount": "1", "date": "2026-09-10", "source": "Work",
            }),
            ("patch", f"/api/v1/income/entries/{self.income.pk}/", {
                "amount": "1.00", "date": "2026-09-10", "source_id": source,
            }),
            ("delete", f"/api/v1/income/entries/{self.income.pk}/", None),
            ("patch", f"/api/v1/work-costs/entries/{self.work.pk}/", {"amount": "1.00"}),
            ("patch", f"/api/v1/work-costs/entries/{self.work.pk}/move/", {"category_id": expense_category}),
        ]

        covered = set()
        for method, path, payload in cases:
            with self.subTest(method=method, path=path):
                response = getattr(self.client, method)(path, data=payload, content_type="application/json")
                self.assertEqual(response.status_code, 404, response.content)
                covered.add((method.upper(), self.route_template(path)))

        schema_path = Path(__file__).resolve().parents[2] / "docs" / "openapi.yaml"
        schema = yaml.safe_load(schema_path.read_text(encoding="utf-8"))
        expected = {
            (method.upper(), path)
            for path, operations in schema["paths"].items() if "{" in path
            for method in operations if method in {"get", "post", "put", "patch", "delete"}
        }
        self.assertEqual(covered, expected)

    def route_template(self, path):
        if "/commitments/" in path:
            return "/api/v1/commitments/{item_id}/"
        if "/housing/saved-tests/" in path:
            return "/api/v1/housing/saved-tests/{test_id}/"
        if "/housing/scenarios/" in path:
            return "/api/v1/housing/scenarios/{id}/"
        if "/income-imports/" in path:
            base = "/api/v1/income-imports/{batch_id}/"
            if "/rows/" in path:
                return base + "rows/{row_id}/"
            return base + ("confirm/" if path.endswith("/confirm/") else "")
        if "/income/entries/" in path:
            return "/api/v1/income/entries/{entry_id}/"
        if "/work-costs/entries/" in path:
            base = "/api/v1/work-costs/entries/{entry_id}/"
            return base + ("move/" if path.endswith("/move/") else "")
        if "/expenses/" in path:
            base = "/api/v1/expenses/{entry_id}/"
            if path.endswith("/coverage/"):
                return base + "coverage/"
            return base + ("move/" if path.endswith("/move/") else "")
        raise AssertionError(f"Unmapped ID route: {path}")
