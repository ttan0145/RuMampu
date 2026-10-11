from datetime import date
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import IntegrityError, connection, transaction
from django.test import Client, TestCase, override_settings
from rest_framework.authtoken.models import Token

from finance.models import FinancialPeriod, GuestProfile, IncomeEntry, WorkCostEntry

from .models import HousingScenario, SavedHousingTest
from .services import _starting_liquidity


User = get_user_model()


class HouseCostsDataAvailabilityTests(TestCase):
    url = "/api/v1/housing/house-costs/"

    def setUp(self):
        cache.clear()

    def missing_table(self, *args):
        # Trigger a real database error so the test checks savepoint recovery.
        with connection.cursor() as cursor:
            cursor.execute("SELECT * FROM missing_housing_test_table")

    def assert_unavailable(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json(), {"detail": "no transaction data loaded"})
        # A failed data query must not break the surrounding account transaction.
        self.assertEqual(HousingScenario.objects.count(), 0)

    def test_missing_raw_transaction_table_is_unavailable_instead_of_500(self):
        with patch("apps.housing.views._window", side_effect=self.missing_table):
            self.assert_unavailable()

    def test_partial_raw_data_does_not_break_subsequent_database_queries(self):
        with patch("apps.housing.views._window", return_value=["2026Q1"]), \
             patch("apps.housing.views._income", side_effect=self.missing_table):
            self.assert_unavailable()

    def test_empty_transactions_do_not_query_income_or_places(self):
        with patch("apps.housing.views._window", return_value=[]), \
             patch("apps.housing.views._income") as income, \
             patch("apps.housing.views._places") as places:
            self.assert_unavailable()
            income.assert_not_called()
            places.assert_not_called()

    def test_loaded_data_keeps_the_real_aggregate_response(self):
        with patch("apps.housing.views._window", return_value=["2025Q4", "2026Q1"]), \
             patch("apps.housing.views._income", return_value={"Selangor": 10000}), \
             patch("apps.housing.views._places", return_value=[
                 ("Selangor", "Petaling", "terrace", 20, 450000, 4),
             ]):
            response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["window"], {"from": "2025Q4", "to": "2026Q1", "quarters": 2})
        self.assertEqual(response.json()["states"]["sgr"]["income"], 10000)
        self.assertEqual(response.json()["states"]["sgr"]["types"]["terr"]["Petaling"], [20, 450000, 4])


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

    def add_work_cost(self, profile, month, amount):
        year, month_number = (int(part) for part in month.split("-"))
        return WorkCostEntry.objects.create(
            profile=profile,
            category=profile.work_cost_items.get(slug="petrol"),
            cost_date=date(year, month_number, 1),
            amount=Decimal(amount),
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

    def test_out_of_range_scenario_is_rejected_not_a_server_error(self):
        # Integrity finding F3: Schemathesis sent this and got HTTP 500.
        response = self.client.post(
            self.scenarios_url,
            data={"tenure_years": 1351016, "financing_rate": "-493.", "property_price": "4411400001"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("financing_rate", response.json()["error"]["fields"])
        self.assertFalse(HousingScenario.objects.exists())

    def test_scenario_limits_match_the_calculator(self):
        for field, value in (
            ("financing_rate", "-0.001"),
            ("property_price", "-1.00"),
            ("deposit", "-1.00"),
            ("known_monthly_payment", "-1.00"),
        ):
            with self.subTest(field=field):
                response = self.client.post(
                    self.scenarios_url,
                    data={**self.scenario_payload, field: value},
                    content_type="application/json",
                )
                self.assertEqual(response.status_code, 400)
                self.assertIn(field, response.json()["error"]["fields"])

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


class AuthenticatedHousingApiTests(HousingApiTestMixin, TestCase):
    saved_tests_url = "/api/v1/housing/saved-tests/"

    def auth_client(self, email):
        user = User.objects.create_user(username=email, email=email, password="Passw0rd123")
        token, _ = Token.objects.get_or_create(user=user)
        return Client(HTTP_AUTHORIZATION=f"Token {token.key}"), user

    def test_authenticated_scenario_is_owned_by_the_user_not_guest_profile(self):
        client, user = self.auth_client("owner@example.com")

        response = client.post(
            self.scenarios_url,
            data=self.scenario_payload,
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        scenario = HousingScenario.objects.get(id=response.json()["id"])
        self.assertEqual(scenario.user, user)
        self.assertIsNone(scenario.profile)

    def test_saved_housing_test_persists_result_can_reopen_update_and_delete(self):
        client, user = self.auth_client("save@example.com")
        scenario = client.post(
            self.scenarios_url,
            data={
                **self.scenario_payload,
                "known_monthly_payment": "900.00",
                "additional_costs": [{"category": "Maintenance", "amount": "80.00"}],
            },
            content_type="application/json",
        ).json()
        result = {
            "scenario_id": scenario["id"],
            "tested_home_cost": 980.0,
            "income_shock_percent": 0.0,
            "tested_months": 2,
            "short_month_count": 1,
            "largest_gap": 120.0,
            "months": [],
        }

        created = client.post(
            self.saved_tests_url,
            data={
                "name": "Near MRT",
                "scenario_id": scenario["id"],
                "monthly_payment": "980.00",
                "short_month_count": 1,
                "tested_months": 2,
                "largest_gap": "120.00",
                "income_shock_percent": "0.00",
                "result": result,
            },
            content_type="application/json",
        )

        self.assertEqual(created.status_code, 201)
        saved_id = created.json()["id"]
        detail = client.get(f"{self.saved_tests_url}{saved_id}/")
        self.assertEqual(detail.status_code, 200)
        payload = detail.json()
        self.assertEqual(payload["name"], "Near MRT")
        self.assertEqual(payload["property_price"], "300000.00")
        self.assertEqual(payload["result"]["tested_home_cost"], 980.0)
        self.assertEqual(payload["scenario"]["additional_costs"][0]["category"], "Maintenance")

        patched = client.patch(
            f"{self.saved_tests_url}{saved_id}/",
            data={"name": "Edited", "monthly_payment": "1000.00"},
            content_type="application/json",
        )
        self.assertEqual(patched.status_code, 200)
        self.assertEqual(patched.json()["name"], "Edited")
        self.assertEqual(patched.json()["monthly_payment"], 1000.0)

        other_client, _ = self.auth_client("other@example.com")
        self.assertEqual(other_client.get(f"{self.saved_tests_url}{saved_id}/").status_code, 404)

        deleted = client.delete(f"{self.saved_tests_url}{saved_id}/")
        self.assertEqual(deleted.status_code, 204)
        self.assertFalse(SavedHousingTest.objects.filter(id=saved_id, user=user).exists())

    def test_saved_housing_test_rejects_malformed_and_out_of_range_values(self):
        client, user = self.auth_client("invalid-save@example.com")
        valid = {
            "name": "Valid baseline",
            "monthly_payment": "1000.00",
            "short_month_count": 0,
            "tested_months": 12,
            "largest_gap": "0.00",
            "income_shock_percent": "0.00",
            "result": {},
        }
        invalid_values = {
            "negative monthly payment": {"monthly_payment": "-1.00"},
            "non-numeric monthly payment": {"monthly_payment": "not-a-number"},
            "oversized monthly payment": {"monthly_payment": "999999999999999999999999999999"},
            "negative short month count": {"short_month_count": -1},
            "negative tested month count": {"tested_months": -1},
            "negative largest gap": {"largest_gap": "-1.00"},
            "negative income shock": {"income_shock_percent": "-1.00"},
            "income shock above supported range": {"income_shock_percent": "91.00"},
            "non-object result": {"result": []},
        }

        for label, replacement in invalid_values.items():
            with self.subTest(label=label):
                response = client.post(
                    self.saved_tests_url,
                    data={**valid, **replacement},
                    content_type="application/json",
                )
                self.assertEqual(response.status_code, 400)

        self.assertFalse(SavedHousingTest.objects.filter(user=user).exists())

    def test_saved_housing_test_patch_rejects_invalid_payment_without_changing_record(self):
        client, user = self.auth_client("invalid-patch@example.com")
        row = SavedHousingTest.objects.create(user=user, name="Safe", monthly_payment="900.00")

        response = client.patch(
            f"{self.saved_tests_url}{row.id}/",
            data={"name": "Should not apply", "monthly_payment": "not-a-number"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        row.refresh_from_db()
        self.assertEqual(row.name, "Safe")
        self.assertEqual(row.monthly_payment, Decimal("900.00"))

    def test_saved_housing_test_keeps_legacy_tested_home_cost_alias(self):
        client, _ = self.auth_client("legacy-save@example.com")

        response = client.post(
            self.saved_tests_url,
            data={"name": "Legacy", "tested_monthly_home_cost": "875.50"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["monthly_payment"], 875.5)


class PreHousingCheckApiTests(HousingApiTestMixin, TestCase):
    def setUp(self):
        self.client = Client()

    def test_pre_check_uses_the_authoritative_finance_record_not_client_values(self):
        profile = self.profile()
        profile.commitment_items.filter(slug="rent").update(
            monthly_amount=Decimal("900.00")
        )
        self.add_income(profile, "2026-01", "1000.00")
        self.add_income(profile, "2026-02", "800.00")
        self.add_work_cost(profile, "2026-01", "100.00")
        self.add_work_cost(profile, "2026-02", "100.00")

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
        self.assertEqual(payload["work_cost_basis"], "recorded_entries_by_month")
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
                "upfront_required": 30000.0,
                "cash_on_hand": 0.0,
                "upfront_gap": 30000.0,
            },
        )

    def test_calculation_returns_authoritative_upfront_gap(self):
        response = self.client.post(
            "/api/v1/housing/calculate/",
            data={
                "property_price": "300000.00",
                "deposit": "30000.00",
                "financing_rate": "0.000",
                "tenure_years": 30,
                "cash_on_hand": "25000.00",
                "upfront_costs": [
                    {"category": "Legal", "amount": "2500.00"},
                    {"category": "Moving", "amount": "500.00"},
                ],
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["upfront_required"], 33000.0)
        self.assertEqual(response.json()["cash_on_hand"], 25000.0)
        self.assertEqual(response.json()["upfront_gap"], 8000.0)


class HousingTestResultApiTests(HousingApiTestMixin, TestCase):
    test_url = "/api/v1/housing/test-result/"

    def setUp(self):
        self.client = Client()
        self.profile_instance = self.profile()
        self.profile_instance.work_cost_items.update(monthly_amount=Decimal("0.00"))
        self.profile_instance.commitment_items.update(monthly_amount=Decimal("0.00"))
        self.add_income(self.profile_instance, "2026-01", "600.00")
        self.add_income(self.profile_instance, "2026-02", "1000.00")
        created = self.client.post(
            self.scenarios_url,
            data={
                **self.scenario_payload,
                "known_monthly_payment": "500.00",
                "additional_costs": [],
            },
            content_type="application/json",
        )
        self.scenario_id = created.json()["id"]

    def test_saved_scenario_drives_test_and_starting_liquidity(self):
        response = self.client.post(
            self.test_url,
            data={"scenario_id": self.scenario_id},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["scenario_id"], self.scenario_id)
        self.assertEqual(payload["tested_home_cost"], 500.0)
        self.assertEqual(payload["short_month_count"], 0)
        self.assertEqual(payload["income_shock_percent"], 0.0)
        self.assertEqual(payload["starting_liquidity"]["required_amount"], 0.0)
        self.assertEqual(
            [row["closing_balance"] for row in payload["starting_liquidity"]["months"]],
            [100.0, 600.0],
        )

    def test_payment_comparison_override_is_calculated_without_mutating_scenario(self):
        response = self.client.post(
            self.test_url,
            data={
                "scenario_id": self.scenario_id,
                "tested_monthly_home_cost": "700.00",
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["tested_home_cost"], 700.0)
        self.assertEqual(payload["short_month_count"], 1)
        self.assertEqual(payload["largest_gap"], 100.0)
        self.assertEqual(payload["starting_liquidity"]["required_amount"], 100.0)
        self.assertEqual(
            HousingScenario.objects.get(id=self.scenario_id).known_monthly_payment,
            Decimal("500.00"),
        )

    def test_income_shock_is_calculated_from_authoritative_record(self):
        response = self.client.post(
            self.test_url,
            data={
                "scenario_id": self.scenario_id,
                "income_shock_percent": "20.00",
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["income_shock_percent"], 20.0)
        self.assertEqual(payload["short_month_count"], 1)
        self.assertEqual(payload["largest_gap"], 20.0)
        self.assertEqual(payload["starting_liquidity"]["required_amount"], 20.0)


@override_settings(ENABLE_TEST_SCENARIOS=True)
class GigDriverStartingLiquidityTests(HousingApiTestMixin, TestCase):
    """US5.3 regression: the cash buffer for the shared twelve-month fixture.

    After work costs and commitments the fixture leaves these amounts each month
    before any housing cost, August 2025 to July 2026: 1620, 2050, 1750, 2230,
    3110, 1220, 640, 2470, 1460, 2250, 1760 and 2390. A tested monthly home cost
    is taken off every month, and the buffer is the deepest fall of the running
    total from an earlier high (or from the start) to a later low, so it covers
    the record whichever month it began in. December is the best month and
    January and February the worst, so the deepest fall usually runs from
    December to February. The Epic 5 Playwright flow reads the same figures.
    """

    load_url = "/api/v1/dev/scenarios/my-gig-driver-12m/load/"
    test_url = "/api/v1/housing/test-result/"

    def setUp(self):
        self.client = Client()
        loaded = self.client.post(
            self.load_url, data={"confirm_reset": True}, content_type="application/json"
        )
        self.assertEqual(loaded.status_code, 201)

    def result_for_monthly_cost(self, monthly_cost):
        created = self.client.post(
            self.scenarios_url,
            data={
                **self.scenario_payload,
                "deposit": "0.00",
                "known_monthly_payment": monthly_cost,
                "additional_costs": [],
            },
            content_type="application/json",
        )
        self.assertEqual(created.status_code, 201)
        response = self.client.post(
            self.test_url,
            data={"scenario_id": created.json()["id"]},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        return response.json()

    def balances(self, payload):
        return [row["closing_balance"] for row in payload["starting_liquidity"]["months"]]

    def test_mixed_months_need_a_buffer_equal_to_the_deepest_fall(self):
        payload = self.result_for_monthly_cost("1900.00")
        liquidity = payload["starting_liquidity"]

        self.assertEqual(payload["short_month_count"], 6)
        self.assertEqual(payload["largest_gap"], 1260.0)
        balances = self.balances(payload)
        self.assertEqual(
            balances,
            [-280.0, -130.0, -280.0, 50.0, 1260.0, 580.0, -680.0, -110.0, -550.0, -200.0, -340.0, 150.0],
        )
        # From the December high of RM 1,260 to the February low of RM -680.
        self.assertEqual(liquidity["required_amount"], 1940.0)
        self.assertEqual(liquidity["fall_start"], {"year": 2025, "month": 12})
        self.assertEqual(liquidity["fall_end"], {"year": 2026, "month": 2})
        # Counting only from August would have said RM 680.
        self.assertEqual(-min(balances), 680.0)

    def test_a_record_that_never_goes_below_zero_can_still_need_a_buffer(self):
        payload = self.result_for_monthly_cost("1382.37")
        liquidity = payload["starting_liquidity"]

        balances = self.balances(payload)
        self.assertEqual(len(balances), 12)
        self.assertEqual(balances[0], 237.63)
        self.assertEqual(balances[-1], 6361.56)
        self.assertGreaterEqual(min(balances), 0.0)
        # Started in January, the months to February would have run RM 904.74 short.
        self.assertEqual(liquidity["required_amount"], 904.74)
        self.assertEqual(liquidity["fall_start"], {"year": 2025, "month": 12})
        self.assertEqual(liquidity["fall_end"], {"year": 2026, "month": 2})

    def test_a_cost_every_month_carries_needs_no_buffer(self):
        payload = self.result_for_monthly_cost("600.00")
        liquidity = payload["starting_liquidity"]

        self.assertEqual(payload["short_month_count"], 0)
        self.assertEqual(liquidity["required_amount"], 0.0)
        self.assertIsNone(liquidity["fall_start"])
        self.assertIsNone(liquidity["fall_end"])

    def test_a_cost_above_every_month_keeps_the_running_balance_negative(self):
        payload = self.result_for_monthly_cost("2300.00")
        liquidity = payload["starting_liquidity"]

        self.assertEqual(liquidity["required_amount"], 4740.0)
        self.assertEqual(
            self.balances(payload),
            [-680.0, -930.0, -1480.0, -1550.0, -740.0, -1820.0, -3480.0, -3310.0, -4150.0, -4200.0, -4740.0, -4650.0],
        )
        # The fall runs from the start of the record to June.
        self.assertIsNone(liquidity["fall_start"])
        self.assertEqual(liquidity["fall_end"], {"year": 2026, "month": 6})


class StartingLiquidityPathTests(TestCase):
    """Cover every start within the fixed chronological record, without wrapping."""

    FIXTURE = [
        (2025, 8, 1620), (2025, 9, 2050), (2025, 10, 1750), (2025, 11, 2230),
        (2025, 12, 3110), (2026, 1, 1220), (2026, 2, 640), (2026, 3, 2470),
        (2026, 4, 1460), (2026, 5, 2250), (2026, 6, 1760), (2026, 7, 2390),
    ]

    def months(self, rows, monthly_cost):
        return [
            {"year": year, "month": month, "post_housing_residual": Decimal(left) - Decimal(monthly_cost)}
            for year, month, left in rows
        ]

    def test_buffer_covers_every_chronological_suffix_without_rotating_months(self):
        from_august = _starting_liquidity(self.months(self.FIXTURE, "1900"))
        from_january = _starting_liquidity(self.months(self.FIXTURE[5:], "1900"))

        # Independent definition: opening cash needed for each chronological
        # suffix. The largest such need is the whole record's buffer.
        needs = []
        for start in range(len(self.FIXTURE)):
            balance = Decimal(0)
            needed = Decimal(0)
            for _, _, left in self.FIXTURE[start:]:
                balance += Decimal(left) - Decimal(1900)
                needed = max(needed, -balance)
            needs.append(needed)
        self.assertEqual(max(needs), Decimal("1940.00"))
        self.assertEqual(from_august["required_amount"], max(needs))
        # A shorter record can have a smaller buffer: arbitrary rotations are
        # not invariant and would change the chronology of the data.
        from_february = _starting_liquidity(self.months(self.FIXTURE[6:], "1900"))
        self.assertEqual(from_february["required_amount"], Decimal("1260.00"))

        self.assertEqual(from_august["required_amount"], Decimal("1940.00"))
        self.assertEqual(from_january["required_amount"], Decimal("1940.00"))
        self.assertIsNone(from_january["fall_start"])
        self.assertEqual(from_january["fall_end"], {"year": 2026, "month": 2})

    def test_an_empty_record_needs_no_buffer(self):
        result = _starting_liquidity([])

        self.assertEqual(result["required_amount"], Decimal("0.00"))
        self.assertEqual(result["months"], [])
        self.assertIsNone(result["fall_start"])
        self.assertIsNone(result["fall_end"])
