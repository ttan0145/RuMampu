from decimal import Decimal
from datetime import date
from unittest.mock import patch

from django.test import Client, TestCase
from django.utils import timezone

from .models import (
    CommitmentItem,
    ExpenseCategory,
    ExpenseEntry,
    FinancialPeriod,
    GuestProfile,
    IncomeEntry,
    WorkCostEntry,
    WorkCostItem,
)


class IncomeApiTests(TestCase):
    api_root = "/api/v1/income"

    def setUp(self):
        self.client = Client()

    def record(self, client=None):
        return (client or self.client).get(f"{self.api_root}/record/")

    def source_id(self, slug="ehail", client=None):
        payload = self.record(client).json()
        return next(source["id"] for source in payload["sources"] if source["slug"] == slug)

    def create_entry(self, amount, *, source_id=None, date="2026-08-21", confirm=False, client=None):
        target = client or self.client
        return target.post(
            f"{self.api_root}/entries/",
            data={
                "amount": amount,
                "date": date,
                "source_id": source_id or self.source_id(client=target),
                "confirm_outlier": confirm,
            },
            content_type="application/json",
        )

    def test_record_creates_isolated_guest_profile_and_default_sources(self):
        response = self.record()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["sources"]), 3)
        self.assertEqual(GuestProfile.objects.count(), 1)

        second = Client()
        second_payload = self.record(second).json()
        self.assertNotEqual(response.json()["profile_id"], second_payload["profile_id"])
        self.assertEqual(GuestProfile.objects.count(), 2)

    def test_create_and_list_income_entry(self):
        response = self.create_entry("880.50")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["amount"], "880.50")
        self.assertEqual(len(self.record().json()["entries"]), 1)
        self.assertEqual(IncomeEntry.objects.get().gross_amount, Decimal("880.50"))

    def test_entries_preserve_their_dates_and_distinct_sources(self):
        ehail = self.source_id("ehail")
        freelance = self.source_id("freelance")

        first = self.create_entry("500.00", source_id=ehail, date="2026-08-20")
        second = self.create_entry("650.00", source_id=freelance, date="2026-08-21")
        entries = self.record().json()["entries"]

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 201)
        self.assertEqual(
            [(entry["date"], entry["source_id"], entry["amount"]) for entry in entries],
            [
                ("2026-08-20", ehail, "500.00"),
                ("2026-08-21", freelance, "650.00"),
            ],
        )

    def test_custom_source_can_be_used_for_an_income_entry(self):
        source_response = self.client.post(
            f"{self.api_root}/sources/",
            data={"name": "Weekend market"},
            content_type="application/json",
        )
        source = source_response.json()

        entry = self.create_entry("240.00", source_id=source["id"])

        self.assertEqual(source_response.status_code, 201)
        self.assertTrue(source["is_custom"])
        self.assertEqual(entry.status_code, 201)
        self.assertEqual(entry.json()["source_id"], source["id"])

    def test_rejects_non_positive_income(self):
        response = self.create_entry("-1")

        self.assertEqual(response.status_code, 400)
        payload = response.json()
        self.assertEqual(payload["error"]["code"], "validation_error")
        self.assertIn("amount", payload["error"]["fields"])

    def test_rejects_invalid_calendar_date(self):
        response = self.create_entry("500", date="2026-02-31")

        self.assertEqual(response.status_code, 400)
        self.assertIn("date", response.json()["error"]["fields"])

    def test_cannot_use_another_profiles_source(self):
        other = Client()
        other_source = self.source_id(client=other)

        response = self.create_entry("500", source_id=other_source)

        self.assertEqual(response.status_code, 400)
        self.assertIn("source_id", response.json()["error"]["fields"])

    def test_outlier_requires_confirmation_after_three_entries(self):
        for value in ("100", "120", "140"):
            self.assertEqual(self.create_entry(value).status_code, 201)

        warning = self.create_entry("1000")
        confirmed = self.create_entry("1000", confirm=True)

        self.assertEqual(warning.status_code, 409)
        self.assertEqual(
            warning.json()["error"]["code"],
            "income_outlier_confirmation_required",
        )
        self.assertEqual(warning.json()["error"]["context"]["median_amount"], "120.00")
        self.assertEqual(confirmed.status_code, 201)

    def test_historical_total_marks_financial_period(self):
        response = self.client.post(
            f"{self.api_root}/entries/",
            data={
                "amount": "3200",
                "date": "2026-03-15",
                "entry_method": "historical_total",
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            FinancialPeriod.objects.get().record_basis,
            FinancialPeriod.RecordBasis.MONTHLY_TOTAL,
        )
        self.assertIsNone(response.json()["source_id"])
        self.assertEqual(self.record().json()["recorded_month_count"], 1)

    def test_historical_month_total_is_not_compared_with_transaction_outliers(self):
        for value in ("100", "120", "140"):
            self.assertEqual(self.create_entry(value).status_code, 201)
        response = self.client.post(
            f"{self.api_root}/entries/",
            data={
                "amount": "3200",
                "date": "2026-03-15",
                "entry_method": "historical_total",
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)

    def test_historical_total_does_not_build_the_manual_outlier_baseline(self):
        historical = self.client.post(
            f"{self.api_root}/entries/",
            data={
                "amount": "3200",
                "date": "2026-03-15",
                "entry_method": "historical_total",
            },
            content_type="application/json",
        )
        self.assertEqual(historical.status_code, 201)
        self.assertEqual(self.create_entry("100").status_code, 201)
        self.assertEqual(self.create_entry("120").status_code, 201)

        response = self.create_entry("1000")

        self.assertEqual(response.status_code, 201)

    def test_accepts_any_available_amount_of_past_history(self):
        response = self.client.post(
            f"{self.api_root}/entries/",
            data={
                "amount": "2750",
                "date": "2019-01-15",
                "entry_method": "historical_total",
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        record = self.record().json()
        self.assertEqual(record["recorded_month_count"], 1)
        self.assertEqual(len(record["entries"]), 1)

    def test_rejects_current_or_future_month_as_historical(self):
        current_month = timezone.localdate().replace(day=15).isoformat()
        response = self.client.post(
            f"{self.api_root}/entries/",
            data={
                "amount": "2750",
                "date": current_month,
                "entry_method": "historical_total",
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("date", response.json()["error"]["fields"])

    def test_does_not_mix_monthly_total_with_individual_entries(self):
        historical = self.client.post(
            f"{self.api_root}/entries/",
            data={
                "amount": "2750",
                "date": "2026-03-15",
                "entry_method": "historical_total",
            },
            content_type="application/json",
        )
        manual_after_total = self.create_entry("100", date="2026-03-20")
        manual_first = self.create_entry("100", date="2026-04-20")
        total_after_manual = self.client.post(
            f"{self.api_root}/entries/",
            data={
                "amount": "2750",
                "date": "2026-04-15",
                "entry_method": "historical_total",
            },
            content_type="application/json",
        )

        self.assertEqual(historical.status_code, 201)
        self.assertEqual(manual_after_total.status_code, 400)
        self.assertEqual(manual_first.status_code, 201)
        self.assertEqual(total_after_manual.status_code, 400)

    def test_rejects_a_second_monthly_total_for_the_same_period(self):
        payload = {
            "amount": "2750",
            "date": "2026-03-15",
            "entry_method": "historical_total",
        }

        first = self.client.post(
            f"{self.api_root}/entries/", data=payload, content_type="application/json"
        )
        duplicate = self.client.post(
            f"{self.api_root}/entries/", data=payload, content_type="application/json"
        )

        self.assertEqual(first.status_code, 201)
        self.assertEqual(duplicate.status_code, 400)

    def test_delete_income_is_isolated_cleans_empty_period_and_preserves_work_cost(self):
        income = self.create_entry("1000.00", date="2026-09-01")
        self.assertEqual(income.status_code, 201)
        entry_id = income.json()["id"]
        period_id = IncomeEntry.objects.get(id=entry_id).period_id
        category_id = self.client.get("/api/v1/work-costs/").json()[0]["id"]
        work_cost = self.client.post(
            "/api/v1/work-costs/entries/",
            data={"category_id": category_id, "amount": "50.00", "date": "2026-09-01"},
            content_type="application/json",
        )
        self.assertEqual(work_cost.status_code, 201)

        other = Client()
        self.assertEqual(other.delete(f"{self.api_root}/entries/{entry_id}/").status_code, 404)
        self.assertTrue(IncomeEntry.objects.filter(id=entry_id).exists())

        deleted = self.client.delete(f"{self.api_root}/entries/{entry_id}/")
        self.assertEqual(deleted.status_code, 204)
        self.assertFalse(IncomeEntry.objects.filter(id=entry_id).exists())
        self.assertFalse(FinancialPeriod.objects.filter(id=period_id).exists())
        self.assertEqual(WorkCostEntry.objects.count(), 1)

        summary = self.client.get("/api/v1/work-costs/summary/?month=2026-09").json()
        self.assertFalse(summary["income_recorded"])
        self.assertEqual(summary["work_cost_total"], "50.00")
        self.assertIsNone(summary["income_after_work_costs"])
        self.assertEqual(self.client.delete(f"{self.api_root}/entries/{entry_id}/").status_code, 404)

    def test_delete_one_income_keeps_its_month_when_sibling_entries_remain(self):
        first = self.create_entry("100.00", date="2026-09-01")
        second = self.create_entry("200.00", date="2026-09-02")
        period_id = IncomeEntry.objects.get(id=first.json()["id"]).period_id

        deleted = self.client.delete(f"{self.api_root}/entries/{first.json()['id']}/")

        self.assertEqual(deleted.status_code, 204)
        self.assertTrue(FinancialPeriod.objects.filter(id=period_id).exists())
        self.assertEqual(
            [(entry["id"], entry["amount"]) for entry in self.record().json()["entries"]],
            [(second.json()["id"], "200.00")],
        )

    def test_custom_source_rejects_case_insensitive_duplicate(self):
        first = self.client.post(
            f"{self.api_root}/sources/",
            data={"name": "Odd jobs"},
            content_type="application/json",
        )
        duplicate = self.client.post(
            f"{self.api_root}/sources/",
            data={"name": "odd JOBS"},
            content_type="application/json",
        )

        self.assertEqual(first.status_code, 201)
        self.assertEqual(duplicate.status_code, 400)

    def test_v1_health_check_identifies_api_version(self):
        response = self.client.get("/api/v1/health/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["api_version"], "v1")

    def test_legacy_income_alias_remains_available_during_migration(self):
        response = self.client.get("/api/income/record/")

        self.assertEqual(response.status_code, 200)
        self.assertIn("profile_id", response.json())

    def test_openapi_publishes_v1_only(self):
        response = self.client.get(
            "/api/schema/",
            HTTP_ACCEPT="application/vnd.oai.openapi+json",
        )

        self.assertEqual(response.status_code, 200)
        paths = response.json()["paths"]
        self.assertIn("/api/v1/income/entries/", paths)
        self.assertIn("/api/v1/income/entries/{entry_id}/", paths)
        self.assertIn("delete", paths["/api/v1/income/entries/{entry_id}/"])
        self.assertIn("/api/v1/work-costs/", paths)
        self.assertIn("/api/v1/commitments/", paths)
        self.assertIn("/api/v1/expense-categories/", paths)
        self.assertIn("/api/v1/expenses/", paths)
        self.assertIn("/api/v1/health/", paths)
        self.assertNotIn("/api/income/entries/", paths)

    def test_api_documentation_page_is_available(self):
        response = self.client.get("/api/docs/")

        self.assertEqual(response.status_code, 200)


class WorkCostApiTests(TestCase):
    api_root = "/api/v1/work-costs/"
    entries_url = "/api/v1/work-costs/entries/"
    summary_url = "/api/v1/work-costs/summary/"

    def setUp(self):
        self.client = Client()

    def list_items(self, client=None):
        return (client or self.client).get(self.api_root)

    def test_lists_separate_default_work_cost_categories_for_each_guest(self):
        first = self.list_items()
        second = self.list_items(Client())

        self.assertEqual(first.status_code, 200)
        self.assertEqual(
            [item["slug"] for item in first.json()],
            ["petrol", "service", "platform", "data", "roadtax"],
        )
        self.assertTrue(all("monthly_amount" not in item for item in first.json()))
        self.assertEqual(second.status_code, 200)
        self.assertEqual(WorkCostItem.objects.count(), 10)

    def test_creates_a_custom_work_cost_category(self):
        response = self.client.post(
            self.api_root,
            data={"name": "Equipment rental"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.json()["is_custom"])
        self.assertEqual(response.json()["name"], "Equipment rental")
        self.assertEqual(len(self.list_items().json()), 6)

    def test_rejects_duplicate_custom_work_cost_categories(self):
        first = self.client.post(
            self.api_root,
            data={"name": "Equipment rental"},
            content_type="application/json",
        )
        duplicate = self.client.post(
            self.api_root,
            data={"name": "equipment RENTAL"},
            content_type="application/json",
        )

        self.assertEqual(first.status_code, 201)
        self.assertEqual(duplicate.status_code, 400)

    def test_records_multiple_dated_costs_and_calculates_only_the_selected_month(self):
        petrol_id = self.list_items().json()[0]["id"]
        august = self.client.post(
            self.entries_url,
            data={"category_id": petrol_id, "amount": "120.00", "date": "2026-08-22"},
            content_type="application/json",
        )
        second_august = self.client.post(
            self.entries_url,
            data={"category_id": petrol_id, "amount": "30.00", "date": "2026-08-23"},
            content_type="application/json",
        )
        september = self.client.post(
            self.entries_url,
            data={"category_id": petrol_id, "amount": "70.00", "date": "2026-09-01"},
            content_type="application/json",
        )

        self.assertEqual(august.status_code, 201)
        self.assertEqual(second_august.status_code, 201)
        self.assertEqual(september.status_code, 201)
        self.assertEqual(self.client.get(self.entries_url).json()[0]["amount"], "70.00")
        august_summary = self.client.get(f"{self.summary_url}?month=2026-08").json()
        september_summary = self.client.get(f"{self.summary_url}?month=2026-09").json()
        self.assertFalse(august_summary["income_recorded"])
        self.assertEqual(august_summary["work_cost_total"], "150.00")
        self.assertIsNone(august_summary["income_after_work_costs"])
        self.assertEqual(september_summary["work_cost_total"], "70.00")
        self.assertEqual(WorkCostEntry.objects.count(), 3)

    def test_edits_only_the_selected_dated_entry_and_rejects_other_guests_entry(self):
        other = Client()
        other_category_id = self.list_items(other).json()[0]["id"]
        other_entry = other.post(
            self.entries_url,
            data={"category_id": other_category_id, "amount": "50.00", "date": "2026-08-21"},
            content_type="application/json",
        ).json()

        response = self.client.patch(
            f"{self.entries_url}{other_entry['id']}/",
            data={"amount": "50"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 404)

        petrol_id = self.list_items().json()[0]["id"]
        entry = self.client.post(
            self.entries_url,
            data={"category_id": petrol_id, "amount": "50.00", "date": "2026-08-21"},
            content_type="application/json",
        ).json()
        updated = self.client.patch(
            f"{self.entries_url}{entry['id']}/",
            data={"amount": "80.50", "date": "2026-09-01"},
            content_type="application/json",
        )

        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.json()["amount"], "80.50")
        self.assertEqual(updated.json()["date"], "2026-09-01")

    def test_rejects_invalid_entry_amount_category_date_and_month_filter(self):
        petrol_id = self.list_items().json()[0]["id"]
        for payload in (
            {"category_id": petrol_id, "amount": "0", "date": "2026-08-21"},
            {"category_id": petrol_id, "amount": "-1", "date": "2026-08-21"},
            {"category_id": 999999, "amount": "10", "date": "2026-08-21"},
        ):
            with self.subTest(payload=payload):
                self.assertEqual(
                    self.client.post(self.entries_url, data=payload, content_type="application/json").status_code,
                    400,
                )
        self.assertEqual(self.client.get(f"{self.summary_url}?month=August").status_code, 400)

    def post_cost(self, category_id, amount, cost_date="2025-12-31", client=None):
        return (client or self.client).post(self.entries_url, data={
            "category_id": category_id, "amount": amount, "date": cost_date,
        }, content_type="application/json")

    def summary(self, month):
        response = self.client.get(self.summary_url, {"month": month})
        self.assertEqual(response.status_code, 200)
        return response.json()

    def test_month_query_requires_a_real_year_and_exact_ascii_format(self):
        for month in ("", "0000-01", "2026-1", "2026-00", "2026-13", " 2026-01", "2026-01\n", "２０２６-01", "2026-01-01"):
            with self.subTest(month=month):
                response = self.client.get(self.summary_url, {"month": month})
                self.assertEqual(response.status_code, 400)
                self.assertIn("month", response.json()["error"]["fields"])

    @patch("finance.views.timezone.localdate", return_value=date(2027, 1, 1))
    def test_default_month_uses_current_local_month_even_without_income(self, _today):
        payload = self.client.get(self.summary_url).json()
        self.assertEqual(payload["month"], "2027-01")
        self.assertEqual(payload["available_months"], ["2027-01"])
        self.assertIsNone(payload["income_after_work_costs"])

    def test_edit_across_years_moves_only_one_entry_and_keeps_siblings(self):
        category_id = self.list_items().json()[0]["id"]
        first = self.post_cost(category_id, "10.10").json()
        sibling = self.post_cost(category_id, "20.20").json()
        self.post_cost(category_id, "30.30", "2026-01-01")
        self.assertEqual(self.summary("2025-12")["work_cost_total"], "30.30")
        response = self.client.patch(f"{self.entries_url}{first['id']}/", data={
            "amount": "40.40", "date": "2026-01-01",
        }, content_type="application/json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.summary("2025-12")["work_cost_total"], "20.20")
        self.assertEqual(self.summary("2026-01")["work_cost_total"], "70.70")
        self.assertEqual(WorkCostEntry.objects.get(id=sibling["id"]).amount, Decimal("20.20"))
        self.assertEqual(WorkCostEntry.objects.count(), 3)

    def test_summary_distinguishes_no_income_no_cost_zero_and_negative_net(self):
        category_id = self.list_items().json()[0]["id"]
        self.post_cost(category_id, "100.00")
        self.assertIsNone(self.summary("2025-12")["income_after_work_costs"])
        record = self.client.get("/api/v1/income/record/").json()
        income = self.client.post("/api/v1/income/entries/", data={
            "source_id": record["sources"][0]["id"], "amount": "100.00", "date": "2025-12-31",
        }, content_type="application/json")
        self.assertEqual(income.status_code, 201)
        self.assertEqual(self.summary("2025-12")["income_after_work_costs"], "0.00")
        self.post_cost(category_id, "0.01")
        self.assertEqual(self.summary("2025-12")["income_after_work_costs"], "-0.01")
        updated = self.client.patch(f"/api/v1/income/entries/{income.json()['id']}/", data={
            "amount": "120.00", "date": "2026-01-01", "source_id": record["sources"][0]["id"],
        }, content_type="application/json")
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(self.summary("2026-01")["income_after_work_costs"], "120.00")
        self.assertIsNone(self.summary("2025-12")["income_after_work_costs"])

    def test_rejects_foreign_category_on_create_and_edit_without_mutation(self):
        category_id = self.list_items().json()[0]["id"]
        other = Client()
        foreign = self.list_items(other).json()[0]["id"]
        self.assertEqual(self.post_cost(foreign, "10").status_code, 400)
        entry = self.post_cost(category_id, "10").json()
        response = self.client.patch(f"{self.entries_url}{entry['id']}/", data={
            "category_id": foreign, "amount": "500",
        }, content_type="application/json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.summary("2025-12")["work_cost_total"], "10.00")
        self.assertEqual(other.get(self.entries_url).json(), [])
        self.assertNotIn("2025-12", other.get(self.summary_url).json()["available_months"])

    def test_legacy_estimates_are_preserved_and_visible_but_not_deducted(self):
        category_id = self.list_items().json()[0]["id"]
        WorkCostItem.objects.filter(id=category_id).update(monthly_amount=Decimal("999.99"))
        self.assertEqual(self.list_items().json()[0]["legacy_monthly_amount"], "999.99")
        self.assertEqual(self.summary("2025-12")["work_cost_total"], "0.00")
        self.post_cost(category_id, "10.00")
        self.assertEqual(self.summary("2025-12")["work_cost_total"], "10.00")
        self.assertEqual(WorkCostItem.objects.get(id=category_id).monthly_amount, Decimal("999.99"))

    def test_rejects_precision_missing_fields_future_dates_and_empty_patch(self):
        category_id = self.list_items().json()[0]["id"]
        for amount in ("NaN", "Infinity", "0.001", "10000000000.00"):
            with self.subTest(amount=amount):
                self.assertEqual(self.post_cost(category_id, amount).status_code, 400)
        self.assertEqual(self.post_cost(category_id, "10", "9999-12-31").status_code, 400)
        self.assertEqual(self.post_cost(category_id, "10", "2025-02-29").status_code, 400)
        self.assertEqual(self.client.post(self.entries_url, data={}, content_type="application/json").status_code, 400)
        entry = self.post_cost(category_id, "10").json()
        self.assertEqual(self.client.patch(f"{self.entries_url}{entry['id']}/", data={}, content_type="application/json").status_code, 400)
        self.assertEqual(WorkCostEntry.objects.count(), 1)


class CommitmentApiTests(TestCase):
    api_root = "/api/v1/commitments/"

    def setUp(self):
        self.client = Client()

    def list_items(self, client=None):
        return (client or self.client).get(self.api_root)

    def test_lists_living_debt_and_savings_items_separately(self):
        response = self.list_items()

        self.assertEqual(response.status_code, 200)
        grouped = {
            commitment_type: [
                item["slug"]
                for item in response.json()
                if item["commitment_type"] == commitment_type
            ]
            for commitment_type in ("living", "debt", "savings")
        }
        self.assertEqual(grouped["living"], ["rent", "food", "util", "family"])
        self.assertEqual(grouped["debt"], ["motor", "ptptn"])
        self.assertEqual(grouped["savings"], ["save"])

    def test_updates_each_commitment_type_and_preserves_separate_amounts(self):
        items = self.list_items().json()
        values = {"rent": "700.00", "motor": "420.00", "save": "100.00"}

        for slug, amount in values.items():
            item_id = next(item["id"] for item in items if item["slug"] == slug)
            response = self.client.patch(
                f"{self.api_root}{item_id}/",
                data={"monthly_amount": amount},
                content_type="application/json",
            )
            self.assertEqual(response.status_code, 200)

        stored = {
            item.slug: item.monthly_amount
            for item in CommitmentItem.objects.filter(slug__in=values)
        }
        self.assertEqual(
            stored,
            {"rent": Decimal("700"), "motor": Decimal("420"), "save": Decimal("100")},
        )

    def test_rejects_a_negative_commitment_amount(self):
        item_id = self.list_items().json()[0]["id"]

        response = self.client.patch(
            f"{self.api_root}{item_id}/",
            data={"monthly_amount": "-1"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("monthly_amount", response.json()["error"]["fields"])

    def test_cannot_update_another_guests_commitment(self):
        other = Client()
        other_item_id = self.list_items(other).json()[0]["id"]

        response = self.client.patch(
            f"{self.api_root}{other_item_id}/",
            data={"monthly_amount": "50"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 404)


class ExpenseApiTests(TestCase):
    category_root = "/api/v1/expense-categories/"
    expense_root = "/api/v1/expenses/"

    def setUp(self):
        self.client = Client()

    def categories(self, client=None):
        return (client or self.client).get(self.category_root)

    def category_id(self, slug="meals", client=None):
        payload = self.categories(client).json()
        return next(category["id"] for category in payload if category["slug"] == slug)

    def create_expense(self, amount="25.50", date="2026-08-23", category_id=None, client=None):
        target = client or self.client
        return target.post(
            self.expense_root,
            data={
                "amount": amount,
                "date": date,
                "category_id": category_id or self.category_id(client=target),
            },
            content_type="application/json",
        )

    def test_lists_predefined_categories_for_each_guest(self):
        first = self.categories()
        second = self.categories(Client())

        self.assertEqual(first.status_code, 200)
        self.assertEqual(
            [(item["slug"], item["name"]) for item in first.json()],
            [
                ("meals", "Meals"),
                ("groc", "Groceries"),
                ("transp", "Tolls & parking"),
                ("family", "Family"),
                ("other", "Other"),
            ],
        )
        self.assertEqual(second.status_code, 200)
        self.assertEqual(ExpenseCategory.objects.count(), 10)

    def test_records_and_lists_a_manual_expense(self):
        response = self.create_expense()
        listed = self.client.get(self.expense_root)

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["amount"], "25.50")
        self.assertEqual(response.json()["date"], "2026-08-23")
        self.assertEqual(response.json()["entry_method"], "manual")
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(len(listed.json()), 1)
        self.assertEqual(ExpenseEntry.objects.get().amount, Decimal("25.50"))

    def test_records_different_expense_categories_separately(self):
        meals = self.category_id("meals")
        groceries = self.category_id("groc")

        first = self.create_expense("12.00", category_id=meals)
        second = self.create_expense("48.00", category_id=groceries)

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 201)
        self.assertEqual(
            [item["category_id"] for item in self.client.get(self.expense_root).json()],
            [meals, groceries],
        )

    def test_lists_expenses_in_calendar_order(self):
        self.assertEqual(self.create_expense("20.00", date="2026-08-25").status_code, 201)
        self.assertEqual(self.create_expense("10.00", date="2026-07-31").status_code, 201)

        listed = self.client.get(self.expense_root).json()

        self.assertEqual([item["date"] for item in listed], ["2026-07-31", "2026-08-25"])

    def test_each_guest_only_lists_their_own_expenses(self):
        other = Client()
        self.assertEqual(self.create_expense("12.00").status_code, 201)
        self.assertEqual(self.create_expense("99.00", client=other).status_code, 201)

        self.assertEqual(
            [item["amount"] for item in self.client.get(self.expense_root).json()],
            ["12.00"],
        )
        self.assertEqual(
            [item["amount"] for item in other.get(self.expense_root).json()],
            ["99.00"],
        )

    def test_creates_and_uses_a_custom_expense_category(self):
        category = self.client.post(
            self.category_root,
            data={"name": "Pet supplies"},
            content_type="application/json",
        )
        expense = self.create_expense("36.00", category_id=category.json()["id"])

        self.assertEqual(category.status_code, 201)
        self.assertTrue(category.json()["is_custom"])
        self.assertEqual(expense.status_code, 201)
        self.assertEqual(expense.json()["category_id"], category.json()["id"])

    def test_rejects_non_positive_expense_amount(self):
        zero = self.create_expense("0")
        negative = self.create_expense("-1")

        self.assertEqual(zero.status_code, 400)
        self.assertEqual(negative.status_code, 400)
        self.assertIn("amount", negative.json()["error"]["fields"])

    def test_rejects_invalid_expense_date(self):
        response = self.create_expense(date="2026-02-31")

        self.assertEqual(response.status_code, 400)
        self.assertIn("date", response.json()["error"]["fields"])

    def test_saves_user_confirmed_receipt_values_with_provenance(self):
        response = self.client.post(
            self.expense_root,
            data={
                "amount": "35.20",
                "date": "2026-08-25",
                "category_id": self.category_id("groc"),
                "entry_method": "receipt",
                "merchant": "Kedai Runcit Maju",
                "confirm_receipt": True,
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["entry_method"], "receipt")
        self.assertEqual(response.json()["merchant"], "Kedai Runcit Maju")
        self.assertTrue(response.json()["user_confirmed"])

    def test_does_not_save_unconfirmed_receipt_values(self):
        response = self.client.post(
            self.expense_root,
            data={
                "amount": "35.20",
                "date": "2026-08-25",
                "category_id": self.category_id("groc"),
                "entry_method": "receipt",
                "merchant": "Kedai Runcit Maju",
                "confirm_receipt": False,
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("confirm_receipt", response.json()["error"]["fields"])
        self.assertEqual(ExpenseEntry.objects.count(), 0)

    def test_cannot_use_another_guests_expense_category(self):
        other = Client()
        other_category = self.category_id(client=other)

        response = self.create_expense(category_id=other_category)

        self.assertEqual(response.status_code, 400)
        self.assertIn("category_id", response.json()["error"]["fields"])

    def test_rejects_duplicate_custom_category_name(self):
        first = self.client.post(
            self.category_root,
            data={"name": "Pet supplies"},
            content_type="application/json",
        )
        duplicate = self.client.post(
            self.category_root,
            data={"name": "pet SUPPLIES"},
            content_type="application/json",
        )

        self.assertEqual(first.status_code, 201)
        self.assertEqual(duplicate.status_code, 400)

    def test_deleting_a_guest_record_cascades_categories_and_expenses(self):
        self.assertEqual(self.create_expense().status_code, 201)
        profile = GuestProfile.objects.get()

        profile.delete()

        self.assertEqual(ExpenseCategory.objects.count(), 0)
        self.assertEqual(ExpenseEntry.objects.count(), 0)
