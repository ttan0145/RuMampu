import json
from datetime import date
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import Client, TestCase, override_settings

from .models import (
    FinancialPeriod,
    GuestProfile,
    IncomeCoverage,
    IncomeEntry,
    WorkCostEntry,
)
from .analysis_service import save_income_coverage


class IncomeAnalysisTestMixin:
    pattern_url = "/api/v1/income-pattern/"
    coverage_url = "/api/v1/income-coverage/"

    def profile(self, client=None):
        target = client or self.client
        target.get("/api/v1/income/record/")
        session_key = target.session.session_key
        return GuestProfile.objects.get(session_key=session_key)

    def add_income(self, month, amount, *, profile=None, day=1, source_slug="ehail"):
        target_profile = profile or self.profile()
        year, month_number = (int(part) for part in month.split("-"))
        period, _ = FinancialPeriod.objects.get_or_create(
            profile=target_profile,
            period_month=date(year, month_number, 1),
        )
        source = target_profile.income_sources.get(slug=source_slug)
        return IncomeEntry.objects.create(
            profile=target_profile,
            period=period,
            source=source,
            income_date=date(year, month_number, day),
            gross_amount=Decimal(amount),
            entry_method=IncomeEntry.EntryMethod.MANUAL,
        )

    def add_work_cost(self, month, amount, *, profile=None, day=1, category_slug="petrol"):
        target_profile = profile or self.profile()
        year, month_number = (int(part) for part in month.split("-"))
        return WorkCostEntry.objects.create(
            profile=target_profile,
            category=target_profile.work_cost_items.get(slug=category_slug),
            cost_date=date(year, month_number, day),
            amount=Decimal(amount),
        )


class IncomePatternApiTests(IncomeAnalysisTestMixin, TestCase):
    def setUp(self):
        self.client = Client()

    def test_empty_record_returns_explicit_empty_analysis(self):
        response = self.client.get(self.pattern_url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "recorded_month_count": 0,
                "history_depth": "empty",
                "provenance": "calculated_from_user_record",
                "work_cost_basis": "recorded_entries_by_month",
                "months": [],
                "statistics": None,
                "lower_income": {"basis": "recorded_minimum", "months": []},
            },
        )

    def test_one_month_is_a_snapshot_without_a_lower_month_conclusion(self):
        self.add_income("2026-01", "1000.00")

        payload = self.client.get(self.pattern_url).json()

        self.assertEqual(payload["history_depth"], "one_month")
        self.assertEqual(payload["statistics"]["average"], "1000.00")
        self.assertEqual(payload["statistics"]["median"], "1000.00")
        self.assertEqual(payload["statistics"]["standard_deviation"], "0.00")
        self.assertFalse(payload["months"][0]["is_lowest_recorded"])
        self.assertEqual(payload["lower_income"]["months"], [])

    def test_aggregates_sources_and_subtracts_only_that_months_work_cost_entries(self):
        profile = self.profile()
        self.add_income("2026-01", "1000.00", profile=profile, day=2)
        self.add_income("2026-01", "500.00", profile=profile, day=20, source_slug="freelance")
        self.add_work_cost("2026-01", "100.00", profile=profile, day=12)
        self.add_work_cost("2026-02", "250.00", profile=profile, day=12)

        payload = self.client.get(self.pattern_url).json()

        self.assertEqual(payload["recorded_month_count"], 1)
        self.assertEqual(payload["work_cost_basis"], "recorded_entries_by_month")
        self.assertEqual(payload["months"][0]["gross_income"], "1500.00")
        self.assertEqual(payload["months"][0]["work_costs"], "100.00")
        self.assertEqual(payload["months"][0]["usable_income"], "1400.00")

    def test_monthly_aggregate_can_exceed_a_single_entry_digit_limit(self):
        profile = self.profile()
        self.add_income("2026-01", "9999999999.99", profile=profile, day=2)
        self.add_income(
            "2026-01",
            "9999999999.99",
            profile=profile,
            day=20,
            source_slug="freelance",
        )

        response = self.client.get(self.pattern_url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()["months"][0]["gross_income"],
            "19999999999.98",
        )

    def test_historical_monthly_total_uses_the_same_analysis_contract(self):
        profile = self.profile()
        period = FinancialPeriod.objects.create(
            profile=profile,
            period_month=date(2025, 6, 1),
            record_basis=FinancialPeriod.RecordBasis.MONTHLY_TOTAL,
        )
        IncomeEntry.objects.create(
            profile=profile,
            period=period,
            source=None,
            income_date=date(2025, 6, 15),
            gross_amount=Decimal("2750.00"),
            entry_method=IncomeEntry.EntryMethod.HISTORICAL_TOTAL,
            user_confirmed=True,
        )

        payload = self.client.get(self.pattern_url).json()

        self.assertEqual(payload["recorded_month_count"], 1)
        self.assertEqual(payload["months"][0]["month"], "2025-06")
        self.assertEqual(payload["months"][0]["gross_income"], "2750.00")
        self.assertEqual(payload["months"][0]["usable_income"], "2750.00")

    def test_zero_usable_income_is_preserved(self):
        profile = self.profile()
        self.add_income("2026-01", "100.00", profile=profile)
        self.add_work_cost("2026-01", "100.00", profile=profile)

        payload = self.client.get(self.pattern_url).json()

        self.assertEqual(payload["months"][0]["usable_income"], "0.00")
        self.assertEqual(payload["statistics"]["average"], "0.00")

    def test_statistics_round_half_up_at_the_response_boundary(self):
        self.add_income("2026-01", "100.00")
        self.add_income("2026-02", "100.01")

        payload = self.client.get(self.pattern_url).json()

        self.assertEqual(payload["statistics"]["average"], "100.01")
        self.assertEqual(payload["statistics"]["median"], "100.01")
        self.assertEqual(payload["statistics"]["standard_deviation"], "0.01")

    def test_two_months_have_limited_depth_and_identify_the_recorded_minimum(self):
        self.add_income("2026-01", "1000.00")
        self.add_income("2026-02", "600.00")

        payload = self.client.get(self.pattern_url).json()

        self.assertEqual(payload["history_depth"], "two_months")
        self.assertEqual(payload["statistics"]["average"], "800.00")
        self.assertEqual(payload["statistics"]["median"], "800.00")
        self.assertEqual(payload["lower_income"]["months"], ["2026-02"])

    def test_all_tied_minimum_months_are_identified_without_a_percentage_rule(self):
        self.add_income("2026-01", "1000.00")
        self.add_income("2026-02", "500.00")
        self.add_income("2026-03", "500.00")

        payload = self.client.get(self.pattern_url).json()

        self.assertEqual(payload["history_depth"], "three_or_more")
        self.assertEqual(payload["lower_income"]["months"], ["2026-02", "2026-03"])
        self.assertEqual(
            [row["month"] for row in payload["months"] if row["is_lowest_recorded"]],
            ["2026-02", "2026-03"],
        )
        text = json.dumps(payload).lower()
        self.assertNotIn("75%", text)
        self.assertNotIn("coefficient", text)
        self.assertNotIn("risk", text)

    def test_negative_usable_income_is_returned_as_a_fact(self):
        profile = self.profile()
        self.add_income("2026-01", "100.00", profile=profile)
        self.add_work_cost("2026-01", "150.00", profile=profile)

        payload = self.client.get(self.pattern_url).json()

        self.assertEqual(payload["months"][0]["usable_income"], "-50.00")
        self.assertEqual(payload["statistics"]["lowest"], "-50.00")

    @override_settings(ENABLE_TEST_SCENARIOS=True)
    def test_twelve_month_scenario_has_fixed_epic_two_results(self):
        loaded = self.client.post(
            "/api/v1/dev/scenarios/my-gig-driver-12m/load/",
            data={"confirm_reset": True},
            content_type="application/json",
        )
        self.assertEqual(loaded.status_code, 201)

        payload = self.client.get(self.pattern_url).json()

        self.assertEqual(payload["recorded_month_count"], 12)
        self.assertEqual(payload["statistics"]["average"], "4437.50")
        self.assertEqual(payload["statistics"]["median"], "4385.00")
        self.assertEqual(payload["statistics"]["highest"], "5870.00")
        self.assertEqual(payload["statistics"]["lowest"], "3160.00")
        self.assertEqual(payload["statistics"]["range"], "2710.00")
        self.assertEqual(payload["statistics"]["standard_deviation"], "699.16")
        self.assertEqual(payload["lower_income"]["months"], ["2026-02"])

    def test_openapi_publishes_new_v1_endpoints_without_legacy_aliases(self):
        schema = self.client.get("/api/schema/?format=json").json()

        self.assertIn(self.pattern_url, schema["paths"])
        self.assertIn(self.coverage_url, schema["paths"])
        self.assertNotIn("/api/income-pattern/", schema["paths"])
        self.assertEqual(self.client.get("/api/income-pattern/").status_code, 404)


class IncomeCoverageApiTests(IncomeAnalysisTestMixin, TestCase):
    def setUp(self):
        self.client = Client()

    def put(self, answer, slower_months, *, client=None):
        return (client or self.client).put(
            self.coverage_url,
            data={"answer": answer, "slower_months": slower_months},
            content_type="application/json",
        )

    def test_get_starts_unknown_without_mutating_coverage(self):
        response = self.client.get(self.coverage_url)

        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json()["answer"])
        self.assertEqual(response.json()["slower_months"], [])
        self.assertEqual(IncomeCoverage.objects.count(), 0)

    def test_yes_requires_unique_valid_months(self):
        missing = self.put("yes", [])
        duplicate = self.put("yes", [1, 1])
        out_of_range = self.put("yes", [13])

        self.assertEqual(missing.status_code, 400)
        self.assertEqual(duplicate.status_code, 400)
        self.assertEqual(out_of_range.status_code, 400)
        self.assertEqual(IncomeCoverage.objects.count(), 0)

    def test_yes_sorts_and_persists_represented_and_unrepresented_months(self):
        profile = self.profile()
        self.add_income("2025-01", "1000", profile=profile)
        self.add_income("2026-08", "1200", profile=profile)

        response = self.put("yes", [8, 3, 1])
        refreshed = self.client.get(self.coverage_url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["slower_months"], [1, 3, 8])
        self.assertEqual(response.json()["represented_slower_months"], [1, 8])
        self.assertEqual(response.json()["unrepresented_slower_months"], [3])
        self.assertEqual(refreshed.json(), response.json())

    def test_no_or_not_sure_clears_months_and_returns_only_recorded_range(self):
        self.add_income("2026-01", "1000")
        self.add_income("2026-02", "600")
        self.assertEqual(self.put("yes", [1]).status_code, 200)

        no_response = self.put("no", [1])
        not_sure_response = self.put("not_sure", [])

        self.assertEqual(no_response.json()["slower_months"], [])
        self.assertEqual(no_response.json()["observation"]["kind"], "recorded_range")
        self.assertEqual(no_response.json()["observation"]["lowest"], "600.00")
        self.assertEqual(no_response.json()["observation"]["highest"], "1000.00")
        self.assertEqual(no_response.json()["observation"]["range"], "400.00")
        self.assertEqual(not_sure_response.json()["slower_months"], [])
        self.assertNotIn("stable", json.dumps(not_sure_response.json()).lower())

    def test_coverage_is_isolated_between_guest_sessions(self):
        other = Client()
        self.assertEqual(self.put("yes", [2]).status_code, 200)

        other_payload = other.get(self.coverage_url).json()

        self.assertIsNone(other_payload["answer"])
        self.assertEqual(other_payload["slower_months"], [])
        self.assertEqual(IncomeCoverage.objects.count(), 1)

    def test_database_rejects_an_invalid_answer(self):
        profile = self.profile()

        with self.assertRaises(IntegrityError), transaction.atomic():
            IncomeCoverage.objects.create(
                profile=profile,
                answer="maybe",
                slower_months=[],
            )

    def test_model_validation_rejects_noncanonical_coverage_states(self):
        profile = self.profile()
        invalid_states = (
            ("yes", []),
            ("yes", [1, 1]),
            ("yes", [13]),
            ("yes", [2, 1]),
            ("yes", [True]),
            ("no", [1]),
            ("not_sure", [1]),
        )

        for answer, months in invalid_states:
            with self.subTest(answer=answer, months=months):
                coverage = IncomeCoverage(
                    profile=profile,
                    answer=answer,
                    slower_months=months,
                )
                with self.assertRaises(ValidationError):
                    coverage.full_clean(
                        validate_unique=False,
                        validate_constraints=False,
                    )

    def test_application_service_enforces_coverage_invariants(self):
        profile = self.profile()

        with self.assertRaises(ValidationError):
            save_income_coverage(
                profile=profile,
                answer="yes",
                slower_months=[1, 1],
            )

        self.assertEqual(IncomeCoverage.objects.count(), 0)

    def test_invalid_persisted_coverage_fails_safe_as_unknown(self):
        profile = self.profile()
        IncomeCoverage.objects.create(
            profile=profile,
            answer="yes",
            slower_months=[13, 13],
        )

        with self.assertLogs("finance.analysis_service", level="ERROR"):
            payload = self.client.get(self.coverage_url).json()

        self.assertIsNone(payload["answer"])
        self.assertEqual(payload["slower_months"], [])
        self.assertEqual(payload["represented_slower_months"], [])
        self.assertEqual(payload["unrepresented_slower_months"], [])

    @override_settings(ENABLE_TEST_SCENARIOS=True)
    def test_scenario_reload_clears_previous_coverage_answer(self):
        self.assertEqual(self.put("yes", [2]).status_code, 200)

        loaded = self.client.post(
            "/api/v1/dev/scenarios/my-gig-driver-12m/load/",
            data={"confirm_reset": True},
            content_type="application/json",
        )

        self.assertEqual(loaded.status_code, 201)
        self.assertIsNone(self.client.get(self.coverage_url).json()["answer"])
        self.assertEqual(IncomeCoverage.objects.count(), 0)
