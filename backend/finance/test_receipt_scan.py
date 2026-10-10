import datetime
import json
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import Mock, patch

from django.core.cache import cache
from django.test import Client, TestCase

from config.throttles import ReceiptScanThrottle

from . import receipt_service
from .models import IncomeEntry
from .receipt_service import ReceiptScanError, normalise_result


class ReceiptScanApiTests(TestCase):
    url = "/api/v1/expenses/receipt-scan/"

    def setUp(self):
        self.client = Client()
        cache.clear()

    def tearDown(self):
        cache.clear()

    def scan(self, **overrides):
        payload = {"image_base64": "aGVsbG8=", "media_type": "image/jpeg"}
        payload.update(overrides)
        return self.client.post(self.url, data=payload, content_type="application/json")

    def test_successful_scan_returns_draft(self):
        result = {
            "is_receipt": True,
            "merchant": "Kedai Runcit Maju",
            "date": datetime.date(2026, 8, 20),
            "total": Decimal("34.70"),
            "category_slug": "groc",
        }
        with patch("finance.views.receipt_service.scan_receipt", return_value=result) as mock_scan:
            response = self.scan()
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["is_receipt"])
        self.assertEqual(body["merchant"], "Kedai Runcit Maju")
        self.assertEqual(body["date"], "2026-08-20")
        self.assertEqual(body["total"], "34.70")
        self.assertEqual(body["category_slug"], "groc")
        mock_scan.assert_called_once_with("aGVsbG8=", "image/jpeg")

    def test_non_receipt_image_is_reported_not_errored(self):
        result = {
            "is_receipt": False,
            "merchant": None,
            "date": None,
            "total": None,
            "category_slug": None,
        }
        with patch("finance.views.receipt_service.scan_receipt", return_value=result):
            response = self.scan()
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertFalse(body["is_receipt"])
        self.assertIsNone(body["total"])

    def test_missing_api_key_maps_to_503(self):
        error = ReceiptScanError("receipt_scan_unconfigured", "Not configured.", 503)
        with patch("finance.views.receipt_service.scan_receipt", side_effect=error):
            response = self.scan()
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["error"]["code"], "receipt_scan_unconfigured")

    def test_model_failure_maps_to_502(self):
        error = ReceiptScanError("receipt_scan_failed", "Unavailable.", 502)
        with patch("finance.views.receipt_service.scan_receipt", side_effect=error):
            response = self.scan()
        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.json()["error"]["code"], "receipt_scan_failed")

    def test_missing_image_is_a_validation_error(self):
        response = self.client.post(self.url, data={}, content_type="application/json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"]["code"], "validation_error")

    def test_unsupported_media_type_is_rejected(self):
        response = self.scan(media_type="image/gif")
        self.assertEqual(response.status_code, 400)

    @patch.object(ReceiptScanThrottle, "THROTTLE_RATES", {"receipt_scan": "1/hour"})
    def test_repeated_receipt_scans_are_throttled_before_another_model_call(self):
        result = {
            "is_receipt": False,
            "merchant": None,
            "date": None,
            "total": None,
            "category_slug": None,
        }
        with patch("finance.views.receipt_service.scan_receipt", return_value=result) as scan:
            first = self.scan()
            blocked = self.scan()

        self.assertEqual(first.status_code, 200)
        self.assertEqual(blocked.status_code, 429)
        scan.assert_called_once()


class NormaliseResultTests(TestCase):
    def base(self, **overrides):
        data = {
            "is_receipt": True,
            "merchant": " Restoran Selera ",
            "date": "2026-08-20",
            "total": 12.5,
            "category_slug": "meals",
        }
        data.update(overrides)
        return data

    def test_valid_values_pass_through(self):
        result = normalise_result(self.base())
        self.assertEqual(result["merchant"], "Restoran Selera")
        self.assertEqual(result["date"], datetime.date(2026, 8, 20))
        self.assertEqual(result["total"], Decimal("12.50"))
        self.assertEqual(result["category_slug"], "meals")

    def test_unknown_category_falls_back_to_other(self):
        result = normalise_result(self.base(category_slug="petrol"))
        self.assertEqual(result["category_slug"], "other")

    def test_unparseable_date_becomes_null(self):
        result = normalise_result(self.base(date="20/08/2026"))
        self.assertIsNone(result["date"])

    def test_non_positive_total_becomes_null(self):
        self.assertIsNone(normalise_result(self.base(total=0))["total"])
        self.assertIsNone(normalise_result(self.base(total=-3))["total"])

    def test_numeric_string_total_is_accepted(self):
        result = normalise_result(self.base(total="34.70"))
        self.assertEqual(result["total"], Decimal("34.70"))

    def test_non_receipt_clears_every_field(self):
        result = normalise_result(self.base(is_receipt=False))
        self.assertEqual(
            result,
            {
                "is_receipt": False,
                "merchant": None,
                "date": None,
                "total": None,
                "category_slug": None,
            },
        )


class IncomeScanNormaliseTests(TestCase):
    def test_rows_are_clamped_and_totals_dropped(self):
        data = {
            "is_earnings": True,
            "rows": [
                {"date": "2026-09-13", "amount": "112.00", "confident": True},
                {"date": "not-a-date", "amount": 64, "confident": False},
                {"date": None, "amount": "-5", "confident": True},
                {"date": "2026-09-08", "amount": None},
            ],
        }
        out = receipt_service.normalise_income_result(data)
        self.assertTrue(out["is_earnings"])
        self.assertEqual(len(out["rows"]), 2)
        self.assertEqual(str(out["rows"][0]["amount"]), "112.00")
        self.assertFalse(out["rows"][0]["low_confidence"])
        self.assertIsNone(out["rows"][1]["date"])
        self.assertTrue(out["rows"][1]["low_confidence"])

    def test_missing_or_incomplete_dates_stay_blank_and_need_review(self):
        out = receipt_service.normalise_income_result({
            "is_earnings": True,
            "rows": [
                {"date": None, "amount": "82.00", "confident": True},
                {"date": "2026-10", "amount": "74.00", "confident": True},
            ],
        })
        self.assertEqual([row["date"] for row in out["rows"]], [None, None])
        self.assertTrue(all(row["low_confidence"] for row in out["rows"]))

    def test_scan_returns_the_twenty_newest_valid_rows_in_order(self):
        rows = [
            {"date": f"2026-09-{day:02d}", "amount": str(day), "confident": True}
            for day in range(1, 26)
        ]
        out = receipt_service.normalise_income_result({"is_earnings": True, "rows": rows})
        self.assertEqual(len(out["rows"]), 20)
        self.assertEqual(out["rows"][0]["date"], datetime.date(2026, 9, 25))
        self.assertEqual(out["rows"][-1]["date"], datetime.date(2026, 9, 6))

    def test_controlled_groq_call_uses_income_only_prompt_and_rejects_extra_fields(self):
        body = {
            "is_earnings": True,
            "rows": [{"date": "2026-10-01", "amount": "800.00", "confident": True}],
        }
        completion = SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps(body)))])
        create = Mock(return_value=completion)
        client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
        with patch.object(receipt_service, "_client", return_value=client), \
             patch.object(receipt_service.timezone, "localdate", return_value=datetime.date(2026, 11, 1)):
            result = receipt_service.scan_income("c3ludGhldGljLWltYWdl", "image/jpeg")
        prompt = create.call_args.kwargs["messages"][0]["content"][0]["text"]
        self.assertIn("Today is 2026-11-01", prompt)
        self.assertIn("at most 20 rows", prompt)
        self.assertIn("Never guess a date", prompt)
        self.assertEqual(set(result["rows"][0]), {"date", "amount", "low_confidence"})

        body["rows"][0]["eligibility_score"] = 91
        completion.choices[0].message.content = json.dumps(body)
        with patch.object(receipt_service, "_client", return_value=client):
            with self.assertRaises(ReceiptScanError) as raised:
                receipt_service.scan_income("c3ludGhldGljLWltYWdl", "image/jpeg")
        self.assertEqual(raised.exception.code, "income_scan_unreadable")


class IncomeScanApiTests(TestCase):
    url = "/api/v1/income/scan/"
    client_id = "synthetic-income-scan-client"

    def setUp(self):
        self.client = Client()
        self.headers = {"HTTP_X_RUMAMPU_CLIENT_ID": self.client_id}

    def test_scan_response_is_transaction_whitelist_and_does_not_save(self):
        result = {
            "is_earnings": True,
            "rows": [{
                "date": datetime.date(2026, 10, 1),
                "amount": Decimal("800.00"),
                "low_confidence": False,
                "affordability": "high",
                "credibility_score": 98,
                "eligibility": True,
            }],
            "lender_assessment": {"eligible": True},
        }
        with patch("finance.views.receipt_service.scan_income", return_value=result) as scan:
            response = self.client.post(
                self.url,
                data={"image_base64": "c3ludGhldGljLWltYWdl", "media_type": "image/jpeg"},
                content_type="application/json",
                **self.headers,
            )
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(set(body), {"is_earnings", "rows"})
        self.assertEqual(set(body["rows"][0]), {"date", "amount", "low_confidence"})
        self.assertNotIn("affordability", json.dumps(body).lower())
        self.assertNotIn("eligibility", json.dumps(body).lower())
        scan.assert_called_once_with("c3ludGhldGljLWltYWdl", "image/jpeg")
        record = self.client.get("/api/v1/income/record/", **self.headers).json()
        self.assertEqual(record["entries"], [])
        self.assertEqual(IncomeEntry.objects.count(), 0)

    def test_reader_error_is_returned_without_creating_income(self):
        error = ReceiptScanError("income_scan_failed", "Unavailable.", 502)
        with patch("finance.views.receipt_service.scan_income", side_effect=error):
            response = self.client.post(
                self.url,
                data={"image_base64": "c3ludGhldGljLWltYWdl", "media_type": "image/jpeg"},
                content_type="application/json",
                **self.headers,
            )
        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.json()["error"]["code"], "income_scan_failed")
        self.assertEqual(IncomeEntry.objects.count(), 0)

    def test_not_earnings_is_empty(self):
        out = receipt_service.normalise_income_result({"is_earnings": False, "rows": []})
        self.assertEqual(out, {"is_earnings": False, "rows": []})

    def test_no_valid_rows_means_not_earnings(self):
        out = receipt_service.normalise_income_result(
            {"is_earnings": True, "rows": [{"date": None, "amount": "abc"}]}
        )
        self.assertFalse(out["is_earnings"])
