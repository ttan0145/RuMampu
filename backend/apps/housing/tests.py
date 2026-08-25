from datetime import date
from decimal import Decimal

from django.db import IntegrityError, transaction
from django.test import Client, TestCase

from finance.models import FinancialPeriod, GuestProfile, IncomeEntry

from .models import HousingScenario


class HousingApiTestMixin:
    scenarios_url = "/api/v1/housing/scenarios/"
    pre_check_url = "/api/v1/housing/pre-check/"

    scenario_payload = {
        "property_price": "300000.00",
        "deposit": "30000.00",
        "financing_rate": "4.250",
        "tenure_years": 30,
        "known_monthly_payment": None,
    }

    def profile(self, client=None):
        target = client or self.client
        target.get("/api/v1/income/record/")
        return GuestProfile.objects.get(session_key=target.session.session_key)

    def add_income(self, profile, month, amount):
        year, month_number = (int(part) for part in month.split("-"))
        period, _ = FinancialPeriod.objects.get_or_create(
            profile=profile,
            period_month=date(year, month_number, 1),
        )
        return IncomeEntry.objects.create(
            profile=profile,
            period=period,
            source=profile.income_sources.get(slug="ehail"),
            income_date=date(year, month_number, 1),
            gross_amount=Decimal(amount),
            entry_method=IncomeEntry.EntryMethod.MANUAL,
        )


class HousingScenarioApiTests(HousingApiTestMixin, TestCase):
    def setUp(self):
        self.client = Client()

    def test_anonymous_scenario_is_owned_by_the_finance_guest_profile(self):
        finance_profile = self.profile()

        response = self.client.post(
            self.scenarios_url,
            data=self.scenario_payload,
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        scenario = HousingScenario.objects.get(id=response.json()["id"])
        self.assertEqual(scenario.profile, finance_profile)
        self.assertIsNone(scenario.user)

    def test_anonymous_scenarios_are_isolated_between_sessions(self):
        created = self.client.post(
            self.scenarios_url,
            data=self.scenario_payload,
            content_type="application/json",
        )
        other = Client()

        other_list = other.get(self.scenarios_url)
        other_detail = other.get(f"{self.scenarios_url}{created.json()['id']}/")

        self.assertEqual(created.status_code, 201)
        self.assertEqual(other_list.status_code, 200)
        self.assertEqual(other_list.json(), [])
        self.assertEqual(other_detail.status_code, 404)

    def test_owner_constraint_rejects_unowned_scenarios(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            HousingScenario.objects.create(**self.scenario_payload)

    def test_duplicate_additional_costs_return_the_common_validation_shape(self):
        payload = {
            **self.scenario_payload,
            "additional_costs": [
                {"category": "Maintenance", "amount": "50.00"},
                {"category": " maintenance ", "amount": "25.00"},
            ],
        }

        response = self.client.post(
            self.scenarios_url,
            data=payload,
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"]["code"], "validation_error")
        self.assertEqual(HousingScenario.objects.count(), 0)

    def test_failed_cost_update_preserves_the_last_confirmed_costs(self):
        created = self.client.post(
            self.scenarios_url,
            data={
                **self.scenario_payload,
                "additional_costs": [{"category": "Maintenance", "amount": "50.00"}],
            },
            content_type="application/json",
        )
        scenario_id = created.json()["id"]

        failed = self.client.put(
            f"{self.scenarios_url}{scenario_id}/",
            data={
                **self.scenario_payload,
                "additional_costs": [
                    {"category": "Insurance", "amount": "80.00"},
                    {"category": "insurance", "amount": "90.00"},
                ],
            },
            content_type="application/json",
        )

        self.assertEqual(failed.status_code, 400)
        scenario = HousingScenario.objects.get(id=scenario_id)
        self.assertEqual(
            list(scenario.additional_costs.values_list("category", "amount")),
            [("Maintenance", Decimal("50.00"))],
        )


class PreHousingCheckApiTests(HousingApiTestMixin, TestCase):
    def setUp(self):
        self.client = Client()

    def test_pre_check_uses_the_authoritative_finance_record_not_client_values(self):
        profile = self.profile()
        profile.work_cost_items.filter(slug="petrol").update(
            monthly_amount=Decimal("100.00")
        )
        profile.commitment_items.filter(slug="rent").update(
            monthly_amount=Decimal("900.00")
        )
        self.add_income(profile, "2026-01", "1000.00")
        self.add_income(profile, "2026-02", "800.00")

        response = self.client.post(
            self.pre_check_url,
            data={
                "income": [{"d": "2026-01-01", "a": 999999}],
                "work_costs": [],
                "commitments": {},
                "expenses": [],
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["provenance"], "calculated_from_user_record")
        self.assertEqual(payload["work_cost_basis"], "current_active_monthly_snapshot")
        self.assertEqual(payload["tested_months"], 2)
        self.assertTrue(payload["has_existing_shortfall"])
        self.assertEqual(payload["largest_existing_gap"], 200.0)
        self.assertEqual(payload["worst_month"], {"year": 2026, "month": 2})
        self.assertEqual(
            [row["usable_income"] for row in payload["months"]],
            [900.0, 700.0],
        )

    def test_pre_check_is_isolated_between_guest_sessions(self):
        profile = self.profile()
        self.add_income(profile, "2026-01", "1000.00")
        other = Client()

        own = self.client.post(self.pre_check_url, data={}, content_type="application/json")
        other_response = other.post(
            self.pre_check_url,
            data={},
            content_type="application/json",
        )

        self.assertEqual(own.json()["tested_months"], 1)
        self.assertEqual(other_response.json()["tested_months"], 0)

    def test_complete_expense_month_replaces_only_daily_variable_estimates(self):
        profile = self.profile()
        profile.commitment_items.filter(slug="rent").update(
            monthly_amount=Decimal("900.00")
        )
        profile.commitment_items.filter(slug="food").update(
            monthly_amount=Decimal("500.00")
        )
        self.add_income(profile, "2026-01", "1200.00")
        category = profile.expense_categories.get(slug="meals")
        for day in range(1, 21):
            profile.expense_entries.create(
                category=category,
                expense_date=date(2026, 1, day),
                amount=Decimal("10.00"),
                entry_method="manual",
                user_confirmed=True,
            )

        payload = self.client.post(
            self.pre_check_url,
            data={},
            content_type="application/json",
        ).json()

        self.assertEqual(payload["months"][0]["existing_costs"], 1100.0)
        self.assertEqual(payload["months"][0]["surplus"], 100.0)


class HousingCalculationApiTests(TestCase):
    def test_zero_rate_calculation_keeps_decimal_inputs_exact(self):
        response = self.client.post(
            "/api/v1/housing/calculate/",
            data={
                "property_price": "300000.00",
                "deposit": "30000.00",
                "financing_rate": "0.000",
                "tenure_years": 30,
                "additional_costs": [{"category": "Maintenance", "amount": "100.10"}],
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "financing_amount": 270000.0,
                "monthly_instalment": 750.0,
                "total_monthly_cost": 850.1,
            },
        )
