from datetime import date, timedelta
from decimal import Decimal
from io import BytesIO

from django.contrib.auth import get_user_model
from django.core import mail
from django.contrib.auth.tokens import default_token_generator
from django.test import Client, TestCase, override_settings
from django.utils import timezone
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from openpyxl import load_workbook
from rest_framework.authtoken.models import Token

from apps.housing.models import HousingScenario, SavedHousingTest
from finance.models import (
    ExpenseEntry,
    GuestProfile,
    IncomeCoverage,
    IncomeEntry,
    IncomeImportBatch,
    IncomeImportRow,
    UserAppState,
    WorkCostEntry,
)
from finance.services import (
    ensure_default_commitments,
    ensure_default_expense_categories,
    ensure_default_sources,
    ensure_default_work_costs,
)


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
    def test_saving_plan_allocation_survives_account_round_trip(self):
        user = User.objects.create_user(username="saving-allocation@example.com", password="Passw0rd123")
        token = Token.objects.create(user=user)
        client = Client(HTTP_AUTHORIZATION=f"Token {token.key}")
        plan = {"key": "2026-10", "target": 140, "n": 31,
                "amounts": [100, 40] + [0] * 29, "done": [True, True] + [False] * 29,
                "seed": 1, "buffered": [True, False, None] + [False] * 28}
        response = client.patch("/api/v1/auth/me/", {"saving_plan": plan}, content_type="application/json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(client.get("/api/v1/auth/me/").json()["saving_plan"], plan)
        # Older devices can still save a plan without the optional field.
        del plan["buffered"]
        response = client.patch("/api/v1/auth/me/", {"saving_plan": plan}, content_type="application/json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(client.get("/api/v1/auth/me/").json()["saving_plan"], plan)

    def test_v27b_saving_plan_start_day_and_signature_sync_to_the_account(self):
        # v27b keeps the day the split started from and what the target was worked out
        # from; an account sync that carries them must not be refused.
        user = User.objects.create_user(username="plan-v27b@example.com", password="Passw0rd123")
        token = Token.objects.create(user=user)
        client = Client(HTTP_AUTHORIZATION=f"Token {token.key}")
        plan = {"key": "2026-10", "target": 300, "n": 31,
                "amounts": [0] * 4 + [10] * 27, "done": [False] * 31, "seed": 1,
                "from": 4, "sig": "village|3600|0|0|0|1905"}
        response = client.patch("/api/v1/auth/me/", {"saving_plan": plan, "pot_moved": 2810},
                                content_type="application/json")
        self.assertEqual(response.status_code, 200)
        state = client.get("/api/v1/auth/me/").json()
        self.assertEqual(state["saving_plan"], plan)
        self.assertEqual(state["pot_moved"], 2810)
        for bad in ({"from": 31}, {"from": -1}, {"from": 1.5}, {"sig": 7}, {"sig": "x" * 501}):
            with self.subTest(bad=bad):
                response = client.patch("/api/v1/auth/me/", {"saving_plan": {**plan, **bad}},
                                        content_type="application/json")
                self.assertEqual(response.status_code, 400)

    def test_invalid_saving_allocation_is_rejected_atomically(self):
        user = User.objects.create_user(username="invalid-allocation@example.com", password="Passw0rd123")
        token = Token.objects.create(user=user)
        client = Client(HTTP_AUTHORIZATION=f"Token {token.key}")
        plan = {"key": "2026-10", "target": 100, "n": 31,
                "amounts": [100] + [0] * 30, "done": [True] + [False] * 30, "seed": 1}
        for invalid in ([True], [1] * 31, ["buffer"] * 31, "buffer"):
            with self.subTest(buffered=invalid):
                response = client.patch("/api/v1/auth/me/", {
                    "saving_plan": {**plan, "buffered": invalid}, "cash_on_hand": 999,
                }, content_type="application/json")
                self.assertEqual(response.status_code, 400)
                state = client.get("/api/v1/auth/me/").json()
                self.assertEqual(state["saving_plan"], {})
                self.assertEqual(state["cash_on_hand"], 0)

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

    def test_password_reset_resend_sends_another_generic_message(self):
        User.objects.create_user(
            username="resend@example.com",
            email="resend@example.com",
            password="Passw0rd123",
        )
        client = Client()

        first = client.post(
            "/api/v1/auth/password-reset/",
            data={"email": "resend@example.com"},
            content_type="application/json",
        )
        second = client.post(
            "/api/v1/auth/password-reset/",
            data={"email": "resend@example.com"},
            content_type="application/json",
        )

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(first.json(), second.json())
        self.assertEqual(len(mail.outbox), 2)

    def test_password_reset_confirm_changes_password_and_invalidates_tokens(self):
        user = User.objects.create_user(
            username="reset-confirm@example.com",
            email="reset-confirm@example.com",
            password="OldPassw0rd123",
        )
        token, _ = Token.objects.get_or_create(user=user)
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        reset_token = default_token_generator.make_token(user)
        client = Client(HTTP_AUTHORIZATION=f"Token {token.key}")

        response = client.post(
            "/api/v1/auth/password-reset/confirm/",
            data={"uid": uid, "token": reset_token, "password": "NewPassw0rd123"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(Token.objects.filter(user=user).exists())
        old_login = Client().post(
            "/api/v1/auth/login/",
            data={"username": "reset-confirm@example.com", "password": "OldPassw0rd123"},
            content_type="application/json",
        )
        new_login = Client().post(
            "/api/v1/auth/login/",
            data={"username": "reset-confirm@example.com", "password": "NewPassw0rd123"},
            content_type="application/json",
        )
        self.assertEqual(old_login.status_code, 401)
        self.assertEqual(new_login.status_code, 200)

    def test_password_reset_confirm_enforces_password_strength(self):
        user = User.objects.create_user(
            username="reset-strength@example.com",
            email="reset-strength@example.com",
            password="OldPassw0rd123",
        )
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        reset_token = default_token_generator.make_token(user)
        client = Client()

        too_short = client.post(
            "/api/v1/auth/password-reset/confirm/",
            data={"uid": uid, "token": reset_token, "password": "A1short"},
            content_type="application/json",
        )
        no_number = client.post(
            "/api/v1/auth/password-reset/confirm/",
            data={"uid": uid, "token": reset_token, "password": "NoNumberHere"},
            content_type="application/json",
        )

        self.assertEqual(too_short.status_code, 400)
        self.assertEqual(too_short.json()["error"]["code"], "password_too_short")
        self.assertEqual(no_number.status_code, 400)
        self.assertEqual(no_number.json()["error"]["code"], "password_needs_letters_numbers")

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

    def test_logout_keeps_authenticated_record_for_next_login(self):
        user = User.objects.create_user(
            username="logout-record@example.com",
            email="logout-record@example.com",
            password="Passw0rd123",
        )
        profile = GuestProfile.objects.create(user=user, session_key="logout-record-profile")
        ensure_default_sources(profile)
        source = profile.income_sources.get(slug="ehail")
        period = profile.financial_periods.create(period_month=date(2026, 4, 1))
        profile.income_entries.create(
            period=period,
            source=source,
            income_date=date(2026, 4, 3),
            gross_amount="1777.00",
            entry_method=IncomeEntry.EntryMethod.MANUAL,
        )
        token, _ = Token.objects.get_or_create(user=user)
        client = Client(HTTP_AUTHORIZATION=f"Token {token.key}")

        self.assertEqual(client.post("/api/v1/auth/logout/").status_code, 204)
        login = client.post(
            "/api/v1/auth/login/",
            data={"username": "logout-record@example.com", "password": "Passw0rd123"},
            content_type="application/json",
        )
        self.assertEqual(login.status_code, 200)
        client.defaults["HTTP_AUTHORIZATION"] = f"Token {login.json()['token']}"

        record = client.get("/api/v1/income/record/")

        self.assertEqual(record.status_code, 200)
        self.assertEqual(record.json()["entries"][0]["amount"], "1777.00")

    def test_account_state_persists_preferred_income_source_for_own_record_only(self):
        user = User.objects.create_user(
            username="preferred-source@example.com",
            email="preferred-source@example.com",
            password="Passw0rd123",
        )
        profile = GuestProfile.objects.create(user=user, session_key="preferred-source-profile")
        ensure_default_sources(profile)
        own_source = profile.income_sources.create(name="Bartender", is_custom=True)
        token, _ = Token.objects.get_or_create(user=user)
        client = Client(HTTP_AUTHORIZATION=f"Token {token.key}")

        response = client.patch(
            "/api/v1/auth/me/",
            data={"preferred_income_source_id": own_source.id},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["preferred_income_source_id"], own_source.id)
        self.assertEqual(
            UserAppState.objects.get(user=user).preferred_income_source_id,
            own_source.id,
        )

        login = Client().post(
            "/api/v1/auth/login/",
            data={"username": "preferred-source@example.com", "password": "Passw0rd123"},
            content_type="application/json",
        )

        self.assertEqual(login.status_code, 200)
        self.assertEqual(login.json()["preferred_income_source_id"], own_source.id)

        other = User.objects.create_user(
            username="preferred-source-other@example.com",
            email="preferred-source-other@example.com",
            password="Passw0rd123",
        )
        other_profile = GuestProfile.objects.create(user=other, session_key="preferred-source-other-profile")
        ensure_default_sources(other_profile)
        other_source = other_profile.income_sources.get(slug="ehail")

        rejected = client.patch(
            "/api/v1/auth/me/",
            data={"preferred_income_source_id": other_source.id},
            content_type="application/json",
        )

        self.assertEqual(rejected.status_code, 400)
        self.assertEqual(
            rejected.json()["error"]["code"],
            "invalid_preferred_income_source",
        )

    def test_account_state_keeps_the_cash_snapshot_date_with_the_amount(self):
        """AC5.2.9 and AC5.2.10: the cash a user reports is saved with the day they reported it."""
        user = User.objects.create_user(
            username="cash-date@example.com",
            email="cash-date@example.com",
            password="Passw0rd123",
        )
        token, _ = Token.objects.get_or_create(user=user)
        client = Client(HTTP_AUTHORIZATION=f"Token {token.key}")

        fresh = client.get("/api/v1/auth/me/").json()
        self.assertEqual(fresh["cash_on_hand"], 0.0)
        self.assertIsNone(fresh["cash_on_hand_date"])

        reported = timezone.localdate().isoformat()
        saved = client.patch(
            "/api/v1/auth/me/",
            data={"cash_on_hand": 8000, "cash_on_hand_date": reported},
            content_type="application/json",
        )
        self.assertEqual(saved.status_code, 200)
        self.assertEqual(saved.json()["cash_on_hand"], 8000.0)
        self.assertEqual(saved.json()["cash_on_hand_date"], reported)
        self.assertEqual(UserAppState.objects.get(user=user).cash_on_hand_date, date.fromisoformat(reported))

        login = Client().post(
            "/api/v1/auth/login/",
            data={"username": "cash-date@example.com", "password": "Passw0rd123"},
            content_type="application/json",
        )
        self.assertEqual(login.status_code, 200)
        self.assertEqual(login.json()["cash_on_hand"], 8000.0)
        self.assertEqual(login.json()["cash_on_hand_date"], reported)

        # Sending only a new amount leaves the recorded day alone.
        client.patch("/api/v1/auth/me/", data={"cash_on_hand": 9000}, content_type="application/json")
        self.assertEqual(client.get("/api/v1/auth/me/").json()["cash_on_hand_date"], reported)

        # An explicit null clears it.
        cleared = client.patch(
            "/api/v1/auth/me/",
            data={"cash_on_hand": 0, "cash_on_hand_date": None},
            content_type="application/json",
        )
        self.assertEqual(cleared.status_code, 200)
        self.assertEqual(cleared.json()["cash_on_hand"], 0.0)
        self.assertIsNone(cleared.json()["cash_on_hand_date"])

    def test_account_state_rejects_a_cash_snapshot_date_that_is_not_a_real_recent_day(self):
        user = User.objects.create_user(
            username="cash-bad-date@example.com",
            email="cash-bad-date@example.com",
            password="Passw0rd123",
        )
        token, _ = Token.objects.get_or_create(user=user)
        client = Client(HTTP_AUTHORIZATION=f"Token {token.key}")

        too_far_ahead = (timezone.localdate() + timedelta(days=3)).isoformat()
        for bad in ["2026-13-40", "30/09/2026", "tomorrow", "2026-9-30", 20260930, True, ["2026-09-30"], too_far_ahead]:
            with self.subTest(value=bad):
                response = client.patch(
                    "/api/v1/auth/me/",
                    data={"cash_on_hand": 100, "cash_on_hand_date": bad},
                    content_type="application/json",
                )
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.json()["error"]["code"], "invalid_cash_on_hand_date")

        state = UserAppState.objects.get(user=user)
        self.assertIsNone(state.cash_on_hand_date)
        self.assertEqual(state.cash_on_hand, 0)

    def test_account_state_keeps_the_amount_moved_into_the_pot_with_its_months(self):
        """AC10.13.1: the ringgit moved in from finished months survive a new session."""
        user = User.objects.create_user(
            username="pot-moved@example.com",
            email="pot-moved@example.com",
            password="Passw0rd123",
        )
        token, _ = Token.objects.get_or_create(user=user)
        client = Client(HTTP_AUTHORIZATION=f"Token {token.key}")

        self.assertEqual(client.get("/api/v1/auth/me/").json()["pot_moved"], 0.0)

        saved = client.patch(
            "/api/v1/auth/me/",
            data={"pot_moved_months": ["2026-08", "2026-09"], "pot_moved": 1475},
            content_type="application/json",
        )
        self.assertEqual(saved.status_code, 200)
        self.assertEqual(saved.json()["pot_moved"], 1475.0)
        self.assertEqual(saved.json()["pot_moved_months"], ["2026-08", "2026-09"])

        login = Client().post(
            "/api/v1/auth/login/",
            data={"username": "pot-moved@example.com", "password": "Passw0rd123"},
            content_type="application/json",
        )
        self.assertEqual(login.status_code, 200)
        self.assertEqual(login.json()["pot_moved"], 1475.0)
        self.assertEqual(login.json()["pot_moved_months"], ["2026-08", "2026-09"])

        for bad in [-1, "lots", 10.005, True, None, 10_000_000_000]:
            with self.subTest(value=bad):
                response = client.patch(
                    "/api/v1/auth/me/",
                    data={"pot_moved": bad},
                    content_type="application/json",
                )
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.json()["error"]["code"], "invalid_pot_moved")
        self.assertEqual(UserAppState.objects.get(user=user).pot_moved, Decimal("1475.00"))

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

    def test_login_does_not_silently_claim_guest_record_until_user_accepts(self):
        user = User.objects.create_user(
            username="claim@example.com",
            email="claim@example.com",
            password="Passw0rd123",
        )
        guest_client = Client(HTTP_X_RUMAMPU_CLIENT_ID="claim-guest-client")
        self.assertEqual(guest_client.get("/api/v1/income/record/").status_code, 200)
        guest = GuestProfile.objects.get(user__isnull=True)
        source = guest.income_sources.get(slug="ehail")
        period = guest.financial_periods.create(period_month=date(2026, 5, 1))
        guest.income_entries.create(
            period=period,
            source=source,
            income_date=date(2026, 5, 1),
            gross_amount="2444.00",
            entry_method=IncomeEntry.EntryMethod.MANUAL,
        )
        scenario = HousingScenario.objects.create(
            profile=guest,
            property_price="250000.00",
            deposit="25000.00",
            financing_rate="4.000",
            tenure_years=30,
            known_monthly_payment="900.00",
        )

        login = guest_client.post(
            "/api/v1/auth/login/",
            data={"username": "claim@example.com", "password": "Passw0rd123"},
            content_type="application/json",
        )
        self.assertEqual(login.status_code, 200)
        self.assertFalse(GuestProfile.objects.filter(user=user).exists())
        self.assertTrue(GuestProfile.objects.filter(pk=guest.pk, user__isnull=True).exists())
        guest_client.defaults["HTTP_AUTHORIZATION"] = f"Token {login.json()['token']}"

        status_response = guest_client.get("/api/v1/auth/guest-transfer/")
        self.assertEqual(status_response.status_code, 200)
        self.assertTrue(status_response.json()["available"])
        self.assertEqual(status_response.json()["summary"]["income_entries"], 1)

        account_record = guest_client.get("/api/v1/income/record/")
        self.assertEqual(account_record.status_code, 200)
        self.assertEqual(account_record.json()["entries"], [])

        transfer = guest_client.post(
            "/api/v1/auth/guest-transfer/",
            data={"action": "keep"},
            content_type="application/json",
        )
        self.assertEqual(transfer.status_code, 200)
        self.assertTrue(transfer.json()["transferred"])
        self.assertFalse(GuestProfile.objects.filter(pk=guest.pk, user__isnull=True).exists())
        scenario.refresh_from_db()
        self.assertEqual(scenario.user, user)
        self.assertIsNone(scenario.profile_id)

        claimed_record = guest_client.get("/api/v1/income/record/")
        self.assertEqual(claimed_record.status_code, 200)
        self.assertEqual(claimed_record.json()["entries"][0]["amount"], "2444.00")

    def test_register_with_explicit_guest_merge_claims_guest_record(self):
        guest_client = Client(HTTP_X_RUMAMPU_CLIENT_ID="register-merge-guest-client")
        self.assertEqual(guest_client.get("/api/v1/income/record/").status_code, 200)
        guest = GuestProfile.objects.get(user__isnull=True)
        source = guest.income_sources.get(slug="ehail")
        period = guest.financial_periods.create(period_month=date(2026, 10, 1))
        guest.income_entries.create(
            period=period,
            source=source,
            income_date=date(2026, 10, 4),
            gross_amount="2888.00",
            entry_method=IncomeEntry.EntryMethod.MANUAL,
        )
        scenario = HousingScenario.objects.create(
            profile=guest,
            property_price="275000.00",
            deposit="27500.00",
            financing_rate="4.000",
            tenure_years=30,
            known_monthly_payment="980.00",
        )

        response = guest_client.post(
            "/api/v1/auth/register/",
            data={
                "email": "register-merge@example.com",
                "password": "Passw0rd123",
                "merge_guest_data": True,
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        user = User.objects.get(email="register-merge@example.com")
        self.assertTrue(response.json()["token"])
        self.assertTrue(GuestProfile.objects.filter(user=user).exists())
        self.assertFalse(GuestProfile.objects.filter(pk=guest.pk, user__isnull=True).exists())
        scenario.refresh_from_db()
        self.assertEqual(scenario.user, user)
        self.assertIsNone(scenario.profile_id)

    def test_register_without_guest_merge_leaves_guest_record_unclaimed(self):
        guest_client = Client(HTTP_X_RUMAMPU_CLIENT_ID="register-fresh-guest-client")
        self.assertEqual(guest_client.get("/api/v1/income/record/").status_code, 200)
        guest = GuestProfile.objects.get(user__isnull=True)
        source = guest.income_sources.get(slug="ehail")
        period = guest.financial_periods.create(period_month=date(2026, 11, 1))
        guest.income_entries.create(
            period=period,
            source=source,
            income_date=date(2026, 11, 4),
            gross_amount="1888.00",
            entry_method=IncomeEntry.EntryMethod.MANUAL,
        )

        response = guest_client.post(
            "/api/v1/auth/register/",
            data={
                "email": "register-fresh@example.com",
                "password": "Passw0rd123",
                "merge_guest_data": False,
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        user = User.objects.get(email="register-fresh@example.com")
        self.assertTrue(GuestProfile.objects.filter(pk=guest.pk, user__isnull=True).exists())
        self.assertFalse(
            GuestProfile.objects
            .filter(user=user, income_entries__gross_amount="1888.00")
            .exists()
        )

    def test_declining_guest_transfer_discards_guest_record_and_keeps_account_record(self):
        user = User.objects.create_user(
            username="decline@example.com",
            email="decline@example.com",
            password="Passw0rd123",
        )
        account_profile = GuestProfile.objects.create(user=user, session_key="decline-account")
        ensure_default_sources(account_profile)
        account_source = account_profile.income_sources.get(slug="ehail")
        account_period = account_profile.financial_periods.create(period_month=date(2026, 6, 1))
        account_profile.income_entries.create(
            period=account_period,
            source=account_source,
            income_date=date(2026, 6, 2),
            gross_amount="3000.00",
            entry_method=IncomeEntry.EntryMethod.MANUAL,
        )
        guest_client = Client(HTTP_X_RUMAMPU_CLIENT_ID="decline-guest-client")
        self.assertEqual(guest_client.get("/api/v1/income/record/").status_code, 200)
        guest = GuestProfile.objects.get(user__isnull=True)
        guest_source = guest.income_sources.get(slug="ehail")
        guest_period = guest.financial_periods.create(period_month=date(2026, 6, 1))
        guest.income_entries.create(
            period=guest_period,
            source=guest_source,
            income_date=date(2026, 6, 3),
            gross_amount="9999.00",
            entry_method=IncomeEntry.EntryMethod.MANUAL,
        )
        login = guest_client.post(
            "/api/v1/auth/login/",
            data={"username": "decline@example.com", "password": "Passw0rd123"},
            content_type="application/json",
        )
        self.assertEqual(login.status_code, 200)
        guest_client.defaults["HTTP_AUTHORIZATION"] = f"Token {login.json()['token']}"

        decline = guest_client.post(
            "/api/v1/auth/guest-transfer/",
            data={"action": "decline"},
            content_type="application/json",
        )

        self.assertEqual(decline.status_code, 200)
        self.assertTrue(decline.json()["discarded"])
        self.assertFalse(GuestProfile.objects.filter(pk=guest.pk).exists())
        record = guest_client.get("/api/v1/income/record/")
        self.assertEqual(record.status_code, 200)
        self.assertEqual(len(record.json()["entries"]), 1)
        self.assertEqual(record.json()["entries"][0]["amount"], "3000.00")

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

    def test_export_marks_account_exported_and_auth_payload_persists_it(self):
        user = User.objects.create_user(
            username="export-state@example.com",
            email="export-state@example.com",
            password="Passw0rd123",
        )
        GuestProfile.objects.create(user=user, session_key="export-state-profile")
        token, _ = Token.objects.get_or_create(user=user)
        client = Client(HTTP_AUTHORIZATION=f"Token {token.key}")

        before = client.get("/api/v1/auth/me/")
        self.assertEqual(before.status_code, 200)
        self.assertIsNone(before.json()["last_record_exported_at"])

        response = client.get("/api/v1/auth/export/", HTTP_ACCEPT=XLSX_CONTENT_TYPE)

        self.assertEqual(response.status_code, 200)
        app_state = UserAppState.objects.get(user=user)
        self.assertIsNotNone(app_state.last_record_exported_at)
        after = client.get("/api/v1/auth/me/")
        self.assertEqual(after.json()["last_record_exported_at"], app_state.last_record_exported_at.isoformat())

        token.delete()
        login = Client().post(
            "/api/v1/auth/login/",
            data={"username": "export-state@example.com", "password": "Passw0rd123"},
            content_type="application/json",
        )
        self.assertEqual(login.status_code, 200)
        self.assertEqual(login.json()["last_record_exported_at"], app_state.last_record_exported_at.isoformat())

    def test_guest_export_requires_an_account(self):
        client = Client(HTTP_X_RUMAMPU_CLIENT_ID="guest-xlsx-export")
        client.get("/api/v1/income/record/")

        response = client.get("/api/v1/auth/export/", HTTP_ACCEPT=XLSX_CONTENT_TYPE)

        self.assertEqual(response.status_code, 401)
        self.assertTrue(GuestProfile.objects.filter(user__isnull=True).exists())

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
        profile = GuestProfile.objects.create(user=user, session_key="delete-profile")
        ensure_default_sources(profile)
        ensure_default_work_costs(profile)
        ensure_default_commitments(profile)
        ensure_default_expense_categories(profile)
        source = profile.income_sources.get(slug="ehail")
        period = profile.financial_periods.create(period_month=date(2026, 7, 1))
        income = profile.income_entries.create(
            period=period,
            source=source,
            income_date=date(2026, 7, 5),
            gross_amount="1666.00",
            entry_method=IncomeEntry.EntryMethod.MANUAL,
        )
        work_cost_item = profile.work_cost_items.get(slug="petrol")
        work_cost = WorkCostEntry.objects.create(
            profile=profile,
            category=work_cost_item,
            cost_date=date(2026, 7, 6),
            amount="55.00",
        )
        commitment = profile.commitment_items.get(slug="rent")
        commitment.monthly_amount = "750.00"
        commitment.save(update_fields=["monthly_amount", "updated_at"])
        expense_category = profile.expense_categories.get(slug="meals")
        expense = ExpenseEntry.objects.create(
            profile=profile,
            category=expense_category,
            expense_date=date(2026, 7, 7),
            amount="18.50",
        )
        import_batch = IncomeImportBatch.objects.create(
            profile=profile,
            file_name="delete-import.csv",
            status=IncomeImportBatch.Status.PREVIEW,
        )
        import_row = IncomeImportRow.objects.create(
            batch=import_batch,
            row_number=1,
            raw_amount="1666",
            raw_date="2026-07-05",
            raw_source="E-hailing",
            amount="1666.00",
            income_date=date(2026, 7, 5),
            source_name="E-hailing",
        )
        coverage = IncomeCoverage.objects.create(
            profile=profile,
            answer=IncomeCoverage.Answer.NO,
        )
        app_state = UserAppState.objects.create(user=user, cash_on_hand="123.00")
        scenario = HousingScenario.objects.create(
            user=user,
            property_price="250000.00",
            deposit="25000.00",
            financing_rate="4.000",
            tenure_years=30,
            known_monthly_payment="900.00",
        )
        SavedHousingTest.objects.create(
            user=user,
            scenario=scenario,
            name="Delete me",
            monthly_payment="900.00",
            short_month_count=0,
            tested_months=1,
            largest_gap="0.00",
        )
        other = User.objects.create_user(
            username="keep-delete@example.com",
            email="keep-delete@example.com",
            password="Passw0rd123",
        )
        other_scenario = HousingScenario.objects.create(
            user=other,
            property_price="260000.00",
            deposit="26000.00",
            financing_rate="4.000",
            tenure_years=30,
            known_monthly_payment="920.00",
        )
        other_saved = SavedHousingTest.objects.create(
            user=other,
            scenario=other_scenario,
            name="Keep me",
            monthly_payment="920.00",
            short_month_count=0,
            tested_months=1,
            largest_gap="0.00",
        )
        token, _ = Token.objects.get_or_create(user=user)
        client = Client(HTTP_AUTHORIZATION=f"Token {token.key}")

        response = client.delete("/api/v1/auth/record/")

        self.assertEqual(response.status_code, 204)
        self.assertFalse(User.objects.filter(email="delete@example.com").exists())
        self.assertFalse(GuestProfile.objects.filter(pk=profile.pk).exists())
        self.assertFalse(UserAppState.objects.filter(pk=app_state.pk).exists())
        self.assertFalse(IncomeEntry.objects.filter(pk=income.pk).exists())
        self.assertFalse(WorkCostEntry.objects.filter(pk=work_cost.pk).exists())
        self.assertFalse(ExpenseEntry.objects.filter(pk=expense.pk).exists())
        self.assertFalse(IncomeImportBatch.objects.filter(pk=import_batch.pk).exists())
        self.assertFalse(IncomeImportRow.objects.filter(pk=import_row.pk).exists())
        self.assertFalse(IncomeCoverage.objects.filter(pk=coverage.pk).exists())
        self.assertFalse(HousingScenario.objects.filter(pk=scenario.pk).exists())
        self.assertFalse(SavedHousingTest.objects.filter(name="Delete me").exists())
        self.assertTrue(User.objects.filter(pk=other.pk).exists())
        self.assertTrue(SavedHousingTest.objects.filter(pk=other_saved.pk).exists())
        self.assertEqual(client.get("/api/v1/auth/me/").status_code, 401)

    def test_deleted_account_credentials_fail_and_email_can_register_again(self):
        user = User.objects.create_user(
            username="recreate@example.com",
            email="recreate@example.com",
            password="Passw0rd123",
        )
        token, _ = Token.objects.get_or_create(user=user)
        client = Client(HTTP_AUTHORIZATION=f"Token {token.key}")
        self.assertEqual(client.delete("/api/v1/auth/record/").status_code, 204)

        old_login = Client().post(
            "/api/v1/auth/login/",
            data={"username": "recreate@example.com", "password": "Passw0rd123"},
            content_type="application/json",
        )
        self.assertEqual(old_login.status_code, 401)

        new_registration = Client().post(
            "/api/v1/auth/register/",
            data={"email": "recreate@example.com", "password": "NewPassw0rd123"},
            content_type="application/json",
        )
        self.assertEqual(new_registration.status_code, 201)
        self.assertTrue(new_registration.json()["token"])

    def test_delete_record_removes_guest_profile_and_housing_scenarios(self):
        client = Client(HTTP_X_RUMAMPU_CLIENT_ID="delete-guest-client")
        self.assertEqual(client.get("/api/v1/income/record/").status_code, 200)
        profile = GuestProfile.objects.get()
        source = profile.income_sources.get(slug="ehail")
        period = profile.financial_periods.create(period_month=date(2026, 8, 1))
        income = profile.income_entries.create(
            period=period,
            source=source,
            income_date=date(2026, 8, 1),
            gross_amount="988.00",
            entry_method=IncomeEntry.EntryMethod.MANUAL,
        )
        work_cost_item = profile.work_cost_items.get(slug="petrol")
        work_cost = WorkCostEntry.objects.create(
            profile=profile,
            category=work_cost_item,
            cost_date=date(2026, 8, 2),
            amount="22.00",
        )
        expense_category = profile.expense_categories.get(slug="meals")
        expense = ExpenseEntry.objects.create(
            profile=profile,
            category=expense_category,
            expense_date=date(2026, 8, 3),
            amount="12.00",
        )
        import_batch = IncomeImportBatch.objects.create(
            profile=profile,
            file_name="guest-delete.csv",
            status=IncomeImportBatch.Status.PREVIEW,
        )
        coverage = IncomeCoverage.objects.create(
            profile=profile,
            answer=IncomeCoverage.Answer.NO,
        )
        scenario = HousingScenario.objects.create(
            profile=profile,
            property_price="180000.00",
            deposit="18000.00",
            financing_rate="4.000",
            tenure_years=30,
            known_monthly_payment="700.00",
        )

        response = client.delete("/api/v1/auth/record/")

        self.assertEqual(response.status_code, 204)
        self.assertFalse(GuestProfile.objects.filter(pk=profile.pk).exists())
        self.assertFalse(IncomeEntry.objects.filter(pk=income.pk).exists())
        self.assertFalse(WorkCostEntry.objects.filter(pk=work_cost.pk).exists())
        self.assertFalse(ExpenseEntry.objects.filter(pk=expense.pk).exists())
        self.assertFalse(IncomeImportBatch.objects.filter(pk=import_batch.pk).exists())
        self.assertFalse(IncomeCoverage.objects.filter(pk=coverage.pk).exists())
        self.assertFalse(HousingScenario.objects.filter(pk=scenario.pk).exists())
