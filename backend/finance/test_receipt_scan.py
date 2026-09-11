import datetime
from decimal import Decimal
from unittest.mock import patch

from django.test import Client, TestCase

from .receipt_service import ReceiptScanError, normalise_result


class ReceiptScanApiTests(TestCase):
    url = "/api/v1/expenses/receipt-scan/"

    def setUp(self):
        self.client = Client()

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
