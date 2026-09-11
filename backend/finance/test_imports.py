from decimal import Decimal

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase

from .models import (
    FinancialPeriod,
    GuestProfile,
    IncomeEntry,
    IncomeImportBatch,
    IncomeImportRow,
    IncomeSource,
)


class IncomeImportApiTests(TestCase):
    preview_url = "/api/v1/income-imports/preview/"

    def setUp(self):
        self.client = Client()

    def upload(self, text: str, *, name="history.csv", client=None):
        target = client or self.client
        file = SimpleUploadedFile(name, text.encode("utf-8"), content_type="text/csv")
        return target.post(self.preview_url, data={"file": file})

    def valid_csv(self):
        return (
            "amount,date,source\n"
            "1200.00,2025-05-10,E-hailing\n"
            "450.00,2025-05-20,Freelance\n"
            "900.00,2025-06-15,Weekend market\n"
        )

    def test_preview_recognises_rows_without_adding_income(self):
        response = self.upload(self.valid_csv())

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["status"], "preview")
        self.assertEqual(response.json()["ready_count"], 3)
        self.assertEqual(response.json()["error_count"], 0)
        self.assertEqual(IncomeEntry.objects.count(), 0)

    def test_preview_identifies_rows_that_cannot_be_recognised(self):
        response = self.upload(
            "amount,date,source\n"
            "bad,2025-05-10,E-hailing\n"
            "200.00,not-a-date,Freelance\n"
            "300.00,2025-06-10,\n"
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["ready_count"], 0)
        self.assertEqual(response.json()["error_count"], 3)
        self.assertEqual(
            [row["error_code"] for row in response.json()["rows"]],
            ["invalid_amount", "invalid_date", "invalid_source"],
        )
        self.assertEqual(IncomeEntry.objects.count(), 0)

    def test_preview_row_can_be_corrected_without_changing_original_csv_values(self):
        preview = self.upload(
            "amount,date,source\n"
            "oops,not-a-date,\n"
            "200.00,2025-06-10,Freelance\n"
        ).json()
        row = preview["rows"][0]

        response = self.client.patch(
            f"/api/v1/income-imports/{preview['id']}/rows/{row['id']}/",
            data={
                "amount": "125.50",
                "date": "2025-05-10",
                "source": "Weekend market",
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["ready_count"], 2)
        self.assertEqual(response.json()["error_count"], 0)
        corrected = response.json()["rows"][0]
        self.assertEqual(corrected["amount"], "125.50")
        self.assertEqual(corrected["date"], "2025-05-10")
        self.assertEqual(corrected["source_name"], "Weekend market")
        self.assertTrue(corrected["is_valid"])
        self.assertEqual(corrected["raw_amount"], "oops")
        self.assertEqual(corrected["raw_date"], "not-a-date")
        self.assertEqual(corrected["raw_source"], "")
        self.assertEqual(IncomeEntry.objects.count(), 0)

    def test_preview_row_rejects_invalid_correction_and_changes_after_confirmation(self):
        preview = self.upload(self.valid_csv()).json()
        row = preview["rows"][0]
        url = f"/api/v1/income-imports/{preview['id']}/rows/{row['id']}/"

        invalid = self.client.patch(
            url,
            data={"amount": "bad", "date": "2025-05-10", "source": "E-hailing"},
            content_type="application/json",
        )
        self.assertEqual(invalid.status_code, 400)

        self.client.post(
            f"/api/v1/income-imports/{preview['id']}/confirm/",
            content_type="application/json",
        )
        confirmed = self.client.patch(
            url,
            data={"amount": "100.00", "date": "2025-05-10", "source": "E-hailing"},
            content_type="application/json",
        )
        self.assertEqual(confirmed.status_code, 400)

    def test_confirm_adds_available_limited_history_and_custom_source(self):
        preview = self.upload(self.valid_csv()).json()

        confirmed = self.client.post(
            f"/api/v1/income-imports/{preview['id']}/confirm/",
            content_type="application/json",
        )

        self.assertEqual(confirmed.status_code, 200)
        self.assertEqual(confirmed.json()["status"], "confirmed")
        self.assertEqual(confirmed.json()["imported_count"], 3)
        self.assertEqual(IncomeEntry.objects.count(), 3)
        self.assertTrue(
            IncomeEntry.objects.filter(entry_method=IncomeEntry.EntryMethod.IMPORT).count(),
        )
        self.assertEqual(FinancialPeriod.objects.count(), 2)
        self.assertTrue(IncomeSource.objects.filter(name="Weekend market", is_custom=True).exists())

    def test_confirmed_import_can_be_edited_without_rewriting_its_audit_row(self):
        preview = self.upload(self.valid_csv()).json()
        confirmed = self.client.post(
            f"/api/v1/income-imports/{preview['id']}/confirm/",
            content_type="application/json",
        )
        self.assertEqual(confirmed.status_code, 200)

        row = IncomeImportRow.objects.get(batch_id=preview["id"], row_number=2)
        entry_id = row.imported_entry_id
        profile = GuestProfile.objects.get()
        freelance = profile.income_sources.get(slug="freelance")

        response = self.client.patch(
            f"/api/v1/income/entries/{entry_id}/",
            data={
                "amount": "1234.56",
                "date": "2025-07-04",
                "source_id": freelance.id,
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["amount"], "1234.56")
        self.assertEqual(response.json()["date"], "2025-07-04")
        self.assertEqual(response.json()["source_id"], freelance.id)
        self.assertEqual(response.json()["entry_method"], IncomeEntry.EntryMethod.IMPORT)

        row.refresh_from_db()
        self.assertEqual(row.imported_entry_id, entry_id)
        self.assertEqual(row.raw_amount, "1200.00")
        self.assertEqual(row.raw_date, "2025-05-10")
        self.assertEqual(row.raw_source, "E-hailing")
        self.assertEqual(row.amount, Decimal("1200.00"))
        self.assertEqual(row.income_date.isoformat(), "2025-05-10")
        self.assertEqual(row.source_name, "E-hailing")

    def test_confirm_is_idempotent(self):
        batch_id = self.upload(self.valid_csv()).json()["id"]
        url = f"/api/v1/income-imports/{batch_id}/confirm/"

        first = self.client.post(url, content_type="application/json")
        second = self.client.post(url, content_type="application/json")

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(IncomeEntry.objects.count(), 3)

    def test_confirm_rejects_an_unchanged_duplicate_csv_for_the_same_profile(self):
        first = self.upload(self.valid_csv(), name="same-file.csv").json()
        confirmed = self.client.post(
            f"/api/v1/income-imports/{first['id']}/confirm/",
            content_type="application/json",
        )
        self.assertEqual(confirmed.status_code, 200)

        second = self.upload(self.valid_csv(), name="same-file.csv").json()
        duplicate = self.client.post(
            f"/api/v1/income-imports/{second['id']}/confirm/",
            content_type="application/json",
        )

        self.assertEqual(duplicate.status_code, 400)
        self.assertIn("already been imported", duplicate.json()["error"]["fields"]["batch"])
        self.assertEqual(IncomeEntry.objects.count(), 3)

    def test_corrected_duplicate_csv_remains_confirmable(self):
        first = self.upload(self.valid_csv(), name="editable-file.csv").json()
        self.assertEqual(
            self.client.post(
                f"/api/v1/income-imports/{first['id']}/confirm/",
                content_type="application/json",
            ).status_code,
            200,
        )

        second = self.upload(self.valid_csv(), name="editable-file.csv").json()
        row = second["rows"][0]
        corrected = self.client.patch(
            f"/api/v1/income-imports/{second['id']}/rows/{row['id']}/",
            data={"amount": "1201.00", "date": "2025-05-10", "source": "E-hailing"},
            content_type="application/json",
        )
        self.assertEqual(corrected.status_code, 200)

        confirmed = self.client.post(
            f"/api/v1/income-imports/{second['id']}/confirm/",
            content_type="application/json",
        )
        self.assertEqual(confirmed.status_code, 200)
        self.assertEqual(IncomeEntry.objects.count(), 6)

    def test_deleting_guest_cascades_confirmed_import_record(self):
        batch_id = self.upload(self.valid_csv()).json()["id"]
        self.client.post(
            f"/api/v1/income-imports/{batch_id}/confirm/",
            content_type="application/json",
        )

        GuestProfile.objects.get().delete()

        self.assertEqual(IncomeImportBatch.objects.count(), 0)
        self.assertEqual(IncomeImportRow.objects.count(), 0)
        self.assertEqual(IncomeEntry.objects.count(), 0)
        self.assertEqual(IncomeSource.objects.count(), 0)

    def test_batch_preview_and_confirmation_are_guest_isolated(self):
        batch_id = self.upload(self.valid_csv()).json()["id"]
        other = Client()

        detail = other.get(f"/api/v1/income-imports/{batch_id}/")
        confirm = other.post(
            f"/api/v1/income-imports/{batch_id}/confirm/",
            content_type="application/json",
        )

        self.assertEqual(detail.status_code, 404)
        self.assertEqual(confirm.status_code, 404)
        self.assertEqual(IncomeEntry.objects.count(), 0)

    def test_rejects_unsupported_file_and_missing_headers(self):
        unsupported = self.upload(self.valid_csv(), name="history.txt")
        missing = self.upload("amount,date\n100.00,2025-05-01\n")

        self.assertEqual(unsupported.status_code, 400)
        self.assertEqual(missing.status_code, 400)
        self.assertEqual(IncomeImportBatch.objects.count(), 0)

    def test_marks_monthly_total_conflicts_in_preview(self):
        source_id = self.client.get("/api/v1/income/record/").json()["sources"][0]["id"]
        historical = self.client.post(
            "/api/v1/income/entries/",
            data={
                "amount": "2500.00",
                "date": "2025-05-15",
                "source_id": source_id,
                "entry_method": "historical_total",
            },
            content_type="application/json",
        )

        preview = self.upload("amount,date,source\n100.00,2025-05-20,E-hailing\n")

        self.assertEqual(historical.status_code, 201)
        self.assertEqual(preview.status_code, 201)
        self.assertEqual(preview.json()["rows"][0]["error_code"], "monthly_total_conflict")

    def test_openapi_publishes_income_import_paths(self):
        response = self.client.get(
            "/api/schema/",
            HTTP_ACCEPT="application/vnd.oai.openapi+json",
        )

        self.assertEqual(response.status_code, 200)
        paths = response.json()["paths"]
        self.assertIn("/api/v1/income-imports/preview/", paths)
        self.assertIn("/api/v1/income-imports/{batch_id}/", paths)
        self.assertIn("/api/v1/income-imports/{batch_id}/rows/{row_id}/", paths)
        self.assertIn("/api/v1/income-imports/{batch_id}/confirm/", paths)
