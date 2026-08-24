from decimal import Decimal

from django.test import Client, TestCase
from django.utils import timezone

from .models import (
    CommitmentItem,
    ExpenseCategory,
    ExpenseEntry,
    FinancialPeriod,
    GuestProfile,
    IncomeEntry,
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

    def setUp(self):
        self.client = Client()

    def list_items(self, client=None):
        return (client or self.client).get(self.api_root)

    def test_lists_separate_default_work_cost_items_for_each_guest(self):
        first = self.list_items()
        second = self.list_items(Client())

        self.assertEqual(first.status_code, 200)
        self.assertEqual(
            [item["slug"] for item in first.json()],
            ["petrol", "service", "platform", "data", "roadtax"],
        )
        self.assertTrue(all(item["monthly_amount"] == "0.00" for item in first.json()))
        self.assertEqual(second.status_code, 200)
        self.assertEqual(WorkCostItem.objects.count(), 10)

    def test_updates_a_work_cost_amount(self):
        item_id = self.list_items().json()[0]["id"]

        response = self.client.patch(
            f"{self.api_root}{item_id}/",
            data={"monthly_amount": "480.50"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["monthly_amount"], "480.50")
        self.assertEqual(WorkCostItem.objects.get(id=item_id).monthly_amount, Decimal("480.50"))

    def test_creates_a_custom_work_cost_as_a_separate_item(self):
        response = self.client.post(
            self.api_root,
            data={"name": "Equipment rental", "monthly_amount": "125.00"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.json()["is_custom"])
        self.assertEqual(response.json()["name"], "Equipment rental")
        self.assertEqual(len(self.list_items().json()), 6)

    def test_rejects_negative_or_duplicate_custom_work_costs(self):
        negative = self.client.post(
            self.api_root,
            data={"name": "Equipment rental", "monthly_amount": "-1"},
            content_type="application/json",
        )
        first = self.client.post(
            self.api_root,
            data={"name": "Equipment rental", "monthly_amount": "10"},
            content_type="application/json",
        )
        duplicate = self.client.post(
            self.api_root,
            data={"name": "equipment RENTAL", "monthly_amount": "20"},
            content_type="application/json",
        )

        self.assertEqual(negative.status_code, 400)
        self.assertEqual(first.status_code, 201)
        self.assertEqual(duplicate.status_code, 400)

    def test_cannot_update_another_guests_work_cost(self):
        other = Client()
        other_item_id = self.list_items(other).json()[0]["id"]

        response = self.client.patch(
            f"{self.api_root}{other_item_id}/",
            data={"monthly_amount": "50"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 404)


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
