from datetime import date
from io import BytesIO

from django.contrib.auth import get_user_model
from django.core import mail
from django.test import Client, TestCase, override_settings
from openpyxl import load_workbook
from rest_framework.authtoken.models import Token

from apps.housing.models import HousingScenario, SavedHousingTest
from finance.models import IncomeEntry
from finance.models import GuestProfile
from finance.services import ensure_default_sources


User = get_user_model()
XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def workbook_from_response(response):
    return load_workbook(BytesIO(response.content), data_only=True)


def workbook_values(workbook):
    values = []
    for sheet in workbook.worksheets:
        values.append(sheet.title)
        for row in sheet.iter_rows(values_only=True):
            values.extend("" if value is None else str(value) for value in row)
    return "\n".join(values)


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class AuthApiRegressionTests(TestCase):
    def test_password_reset_response_does_not_reveal_registered_emails(self):
        User.objects.create_user(
            username="known@example.com",
            email="known@example.com",
            password="Passw0rd123",
        )
        client = Client()

        known = client.post(
            "/api/v1/auth/password-reset/",
            data={"email": "known@example.com"},
            content_type="application/json",
        )
        unknown = client.post(
            "/api/v1/auth/password-reset/",
            data={"email": "unknown@example.com"},
            content_type="application/json",
        )

        self.assertEqual(known.status_code, 200)
        self.assertEqual(unknown.status_code, 200)
        self.assertEqual(known.json(), unknown.json())
        self.assertEqual(len(mail.outbox), 1)

    def test_logout_invalidates_the_api_token(self):
        user = User.objects.create_user(
            username="logout@example.com",
            email="logout@example.com",
            password="Passw0rd123",
        )
        token, _ = Token.objects.get_or_create(user=user)
        client = Client(HTTP_AUTHORIZATION=f"Token {token.key}")

        self.assertEqual(client.get("/api/v1/auth/me/").status_code, 200)
        self.assertEqual(client.post("/api/v1/auth/logout/").status_code, 204)
        self.assertEqual(client.get("/api/v1/auth/me/").status_code, 401)

    def test_login_invalid_credentials_are_generic_for_email_or_password(self):
        User.objects.create_user(
            username="login@example.com",
            email="login@example.com",
            password="Passw0rd123",
        )
        client = Client()

        wrong_password = client.post(
            "/api/v1/auth/login/",
            data={"username": "login@example.com", "password": "wrongPass1"},
            content_type="application/json",
        )
        unknown_email = client.post(
            "/api/v1/auth/login/",
            data={"username": "missing@example.com", "password": "wrongPass1"},
            content_type="application/json",
        )

        self.assertEqual(wrong_password.status_code, 401)
        self.assertEqual(unknown_email.status_code, 401)
        self.assertEqual(wrong_password.json(), unknown_email.json())

    def test_authenticated_export_returns_readable_xlsx_with_user_data_and_saved_tests(self):
        user = User.objects.create_user(
            username="export@example.com",
            email="export@example.com",
            password="Passw0rd123",
        )
        token, _ = Token.objects.get_or_create(user=user)
        client = Client(HTTP_AUTHORIZATION=f"Token {token.key}")
        profile = GuestProfile.objects.create(user=user, session_key="export-profile")
        ensure_default_sources(profile)
        source = profile.income_sources.get(slug="ehail")
        period = profile.financial_periods.create(period_month=date(2026, 1, 1))
        profile.income_entries.create(
            period=period,
            source=source,
            income_date=date(2026, 1, 1),
            gross_amount="1234.00",
            entry_method=IncomeEntry.EntryMethod.MANUAL,
        )
        scenario = HousingScenario.objects.create(
            user=user,
            property_price="300000.00",
            deposit="30000.00",
            financing_rate="4.250",
            tenure_years=30,
            known_monthly_payment="980.00",
        )
        SavedHousingTest.objects.create(
            user=user,
            scenario=scenario,
            name="Apartment near MRT",
            monthly_payment="980.00",
            short_month_count=1,
            tested_months=2,
            largest_gap="120.00",
            income_shock_percent="0.00",
            scenario_snapshot={
                "property_price": "300000.00",
                "deposit": "30000.00",
                "financing_rate": "4.250",
                "tenure_years": 30,
            },
            result_snapshot={
                "months": [{
                    "year": 2026,
                    "month": 1,
                    "gross_income": 1234.0,
                    "usable_income": 1100.0,
                    "existing_costs": 134.0,
                    "available_for_home": 900.0,
                    "tested_home_cost": 980.0,
                    "post_housing_residual": -80.0,
                    "total_shortfall": 80.0,
                    "is_short": True,
                }]
            },
        )

        response = client.get("/api/v1/auth/export/", HTTP_ACCEPT=XLSX_CONTENT_TYPE)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], XLSX_CONTENT_TYPE)
        self.assertIn("RuMampu_Record_", response["Content-Disposition"])
        self.assertIn(".xlsx", response["Content-Disposition"])
        workbook = workbook_from_response(response)
        self.assertEqual(
            workbook.sheetnames,
            ["My Record", "Saved House Tests", "Calculated Results", "About This Export"],
        )
        text = workbook_values(workbook)
        self.assertIn("E-hailing", text)
        self.assertIn("1234", text)
        self.assertIn("Your Data", text)
        self.assertIn("Apartment near MRT", text)
        self.assertIn("300000", text)
        self.assertIn("Calculated", text)
        self.assertIn("2026-01", text)
        self.assertIn("Short", text)

    def test_guest_export_returns_readable_xlsx_without_account_identity(self):
        client = Client(HTTP_X_RUMAMPU_CLIENT_ID="guest-xlsx-export")
        client.get("/api/v1/income/record/")
        profile = GuestProfile.objects.get()
        source = profile.income_sources.get(slug="ehail")
        period = profile.financial_periods.create(period_month=date(2026, 2, 1))
        profile.income_entries.create(
            period=period,
            source=source,
            income_date=date(2026, 2, 1),
            gross_amount="888.00",
            entry_method=IncomeEntry.EntryMethod.MANUAL,
        )

        response = client.get("/api/v1/auth/export/", HTTP_ACCEPT=XLSX_CONTENT_TYPE)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], XLSX_CONTENT_TYPE)
        workbook = workbook_from_response(response)
        self.assertEqual(
            workbook.sheetnames,
            ["My Record", "Saved House Tests", "Calculated Results", "About This Export"],
        )
        text = workbook_values(workbook)
        self.assertIn("888", text)
        self.assertIn("Your Data", text)
        self.assertNotIn("export@example.com", text)

    def test_export_is_account_isolated_and_omits_internal_sensitive_fields(self):
        user_a = User.objects.create_user(
            username="a-export@example.com",
            email="a-export@example.com",
            password="Passw0rd123",
        )
        user_b = User.objects.create_user(
            username="b-export@example.com",
            email="b-export@example.com",
            password="Passw0rd123",
        )
        profile_a = GuestProfile.objects.create(user=user_a, session_key="profile-a")
        profile_b = GuestProfile.objects.create(user=user_b, session_key="profile-b")
        ensure_default_sources(profile_a)
        ensure_default_sources(profile_b)
        source_a = profile_a.income_sources.get(slug="ehail")
        source_b = profile_b.income_sources.get(slug="ehail")
        period_a = profile_a.financial_periods.create(period_month=date(2026, 3, 1))
        period_b = profile_b.financial_periods.create(period_month=date(2026, 3, 1))
        profile_a.income_entries.create(
            period=period_a,
            source=source_a,
            income_date=date(2026, 3, 1),
            gross_amount="1111.00",
            entry_method=IncomeEntry.EntryMethod.MANUAL,
        )
        profile_b.income_entries.create(
            period=period_b,
            source=source_b,
            income_date=date(2026, 3, 1),
            gross_amount="9999.00",
            entry_method=IncomeEntry.EntryMethod.MANUAL,
        )
        token, _ = Token.objects.get_or_create(user=user_a)
        client = Client(HTTP_AUTHORIZATION=f"Token {token.key}")

        response = client.get("/api/v1/auth/export/")

        self.assertEqual(response.status_code, 200)
        text = workbook_values(workbook_from_response(response))
        self.assertIn("1111", text)
        self.assertIn("a-export@example.com", text)
        self.assertNotIn("9999", text)
        self.assertNotIn("b-export@example.com", text)
        for internal_label in ("profile_id", "source_id", "category_id", "scenario_id", "slug", "public_id"):
            self.assertNotIn(internal_label, text)
        self.assertNotIn(token.key, text)

    def test_delete_record_removes_authenticated_account_and_token(self):
        user = User.objects.create_user(
            username="delete@example.com",
            email="delete@example.com",
            password="Passw0rd123",
        )
        token, _ = Token.objects.get_or_create(user=user)
        client = Client(HTTP_AUTHORIZATION=f"Token {token.key}")

        response = client.delete("/api/v1/auth/record/")

        self.assertEqual(response.status_code, 204)
        self.assertFalse(User.objects.filter(email="delete@example.com").exists())
        self.assertEqual(client.get("/api/v1/auth/me/").status_code, 401)
