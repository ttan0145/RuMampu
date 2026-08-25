from decimal import Decimal

from django.test import Client, TestCase, override_settings

from .models import (
    CommitmentItem,
    ExpenseEntry,
    FinancialPeriod,
    GuestProfile,
    IncomeEntry,
    IncomeSource,
    WorkCostItem,
)


@override_settings(ENABLE_TEST_SCENARIOS=True)
class FinanceScenarioApiTests(TestCase):
    scenario_id = "my-gig-driver-12m"
    list_url = "/api/v1/dev/scenarios/"
    load_url = f"/api/v1/dev/scenarios/{scenario_id}/load/"

    def setUp(self):
        self.client = Client()

    def load(self, *, client=None, confirm_reset=True):
        return (client or self.client).post(
            self.load_url,
            data={"confirm_reset": confirm_reset},
            content_type="application/json",
        )

    def test_lists_reusable_scenario_contract(self):
        response = self.client.get(self.list_url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()[0]["id"], self.scenario_id)
        self.assertEqual(response.json()[0]["months"], 12)
        self.assertEqual(response.json()[0]["supports"], ["epic1", "epic2", "epic5"])

    def test_requires_explicit_reset_confirmation(self):
        response = self.load(confirm_reset=False)

        self.assertEqual(response.status_code, 400)
        self.assertIn("confirm_reset", response.json()["error"]["fields"])
        self.assertEqual(GuestProfile.objects.count(), 0)

    def test_loads_twelve_month_driver_scenario(self):
        response = self.load()

        self.assertEqual(response.status_code, 201)
        payload = response.json()
        self.assertEqual(payload["month_count"], 12)
        self.assertEqual(payload["income_entry_count"], 60)
        self.assertEqual(payload["expense_entry_count"], 240)
        self.assertEqual(payload["gross_income_total"], "62250.00")
        self.assertEqual(payload["logged_expense_total"], "14340.00")
        self.assertEqual(payload["work_cost_monthly"], "750.00")
        self.assertEqual(payload["commitment_monthly_estimate"], "2230.00")
        self.assertEqual(payload["first_month"], "2025-08")
        self.assertEqual(payload["last_month"], "2026-07")
        self.assertEqual(len(payload["monthly"]), 12)
        self.assertGreaterEqual(payload["load_duration_ms"], 0)

        self.assertEqual(FinancialPeriod.objects.count(), 12)
        self.assertEqual(IncomeEntry.objects.count(), 60)
        self.assertEqual(ExpenseEntry.objects.count(), 240)
        self.assertEqual(
            ExpenseEntry.objects.values("expense_date").distinct().count(),
            240,
        )
        self.assertTrue(
            IncomeSource.objects.filter(name="Food delivery", is_custom=True).exists()
        )
        self.assertEqual(
            sum(WorkCostItem.objects.values_list("monthly_amount", flat=True)),
            Decimal("750.00"),
        )
        self.assertEqual(
            sum(CommitmentItem.objects.values_list("monthly_amount", flat=True)),
            Decimal("2230.00"),
        )

    def test_reloading_replaces_current_guest_data_without_duplicates(self):
        first = self.load()
        second = self.load()

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 201)
        self.assertEqual(GuestProfile.objects.count(), 1)
        self.assertEqual(FinancialPeriod.objects.count(), 12)
        self.assertEqual(IncomeEntry.objects.count(), 60)
        self.assertEqual(ExpenseEntry.objects.count(), 240)

    def test_loading_one_guest_does_not_change_another_guest(self):
        other = Client()
        self.assertEqual(other.get("/api/v1/income/record/").status_code, 200)

        response = self.load()
        other_record = other.get("/api/v1/income/record/").json()

        self.assertEqual(response.status_code, 201)
        self.assertEqual(GuestProfile.objects.count(), 2)
        self.assertEqual(other_record["recorded_month_count"], 0)
        self.assertEqual(other_record["entries"], [])

    def test_scenario_routes_are_excluded_from_public_openapi(self):
        schema = self.client.get("/api/schema/?format=json").json()

        self.assertFalse(any("/dev/scenarios/" in path for path in schema["paths"]))


class DisabledFinanceScenarioApiTests(TestCase):
    @override_settings(ENABLE_TEST_SCENARIOS=False)
    def test_scenario_api_is_hidden_when_not_enabled(self):
        response = self.client.get("/api/v1/dev/scenarios/")

        self.assertEqual(response.status_code, 404)
