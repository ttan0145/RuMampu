"""Regression tests for the boundary between guest and account records."""

from datetime import date
import hashlib

from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from rest_framework.authtoken.models import Token

from .models import FinancialPeriod, GuestProfile, IncomeEntry
from .services import ensure_default_sources


User = get_user_model()


class GuestProfileIsolationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="profile-owner")
        token = Token.objects.create(user=self.user)
        self.account_client = Client(HTTP_AUTHORIZATION=f"Token {token.key}")
        self.predictable_client_id = f"user:{self.user.pk}"
        self.predictable_key = hashlib.sha256(
            self.predictable_client_id.encode("utf-8")
        ).hexdigest()[:40]

    def _add_income(self, profile, amount="123.00"):
        period = FinancialPeriod.objects.create(profile=profile, period_month=date(2026, 9, 1))
        return IncomeEntry.objects.create(
            profile=profile,
            period=period,
            source=profile.income_sources.get(slug="ehail"),
            income_date=date(2026, 9, 10),
            gross_amount=amount,
        )

    def test_guest_cannot_preclaim_a_new_account_profile(self):
        guest_client = Client(HTTP_X_RUMAMPU_CLIENT_ID=self.predictable_client_id)
        self.assertEqual(guest_client.get("/api/v1/income/record/").status_code, 200)
        guest = GuestProfile.objects.get(session_key=self.predictable_key)
        guest_income = self._add_income(guest)

        account_record = self.account_client.get("/api/v1/income/record/")

        self.assertEqual(account_record.status_code, 200)
        self.assertEqual(account_record.json()["entries"], [])
        account = GuestProfile.objects.get(user=self.user)
        self.assertNotEqual(account.pk, guest.pk)
        self.assertNotEqual(account.session_key, self.predictable_key)
        guest.refresh_from_db()
        self.assertIsNone(guest.user_id)
        self.assertEqual(guest_income.profile_id, guest.pk)

    def test_guest_cannot_read_write_or_delete_a_legacy_account_profile(self):
        account = GuestProfile.objects.create(user=self.user, session_key=self.predictable_key)
        ensure_default_sources(account)
        self.assertEqual(self.account_client.get("/api/v1/income/record/").status_code, 200)
        entry = self._add_income(account)
        guest_client = Client(HTTP_X_RUMAMPU_CLIENT_ID=self.predictable_client_id)

        self.assertEqual(guest_client.get("/api/v1/income/record/").status_code, 403)
        write = guest_client.post(
            "/api/v1/income/entries/",
            data={"amount": "500.00", "date": "2026-09-11"},
            content_type="application/json",
        )
        self.assertEqual(write.status_code, 403)
        self.assertEqual(guest_client.delete("/api/v1/auth/record/").status_code, 403)
        self.assertTrue(GuestProfile.objects.filter(pk=account.pk, user=self.user).exists())
        self.assertTrue(IncomeEntry.objects.filter(pk=entry.pk, profile=account).exists())
        self.assertEqual(len(self.account_client.get("/api/v1/income/record/").json()["entries"]), 1)

    def test_transferred_guest_id_cannot_delete_linked_account_profile(self):
        guest_client = Client(HTTP_X_RUMAMPU_CLIENT_ID="linked-guest-id")
        self.assertEqual(guest_client.get("/api/v1/income/record/").status_code, 200)
        guest = GuestProfile.objects.get(user__isnull=True)
        guest.user = self.user
        guest.save(update_fields=["user"])

        self.assertEqual(guest_client.delete("/api/v1/auth/record/").status_code, 403)
        self.assertTrue(GuestProfile.objects.filter(pk=guest.pk, user=self.user).exists())
