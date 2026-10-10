from datetime import datetime, time
from io import StringIO

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.management import call_command
from django.test import Client, TestCase, override_settings
from django.utils import timezone

from .management.commands.process_record_retention import add_months
from .models import FinancialPeriod, GuestProfile, HomeownershipMonth, IdempotencyRecord, IncomeEntry


User = get_user_model()


def months_ago(value, months):
    return add_months(value, -months)


class Iteration3HomeownershipTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.client.get("/api/v1/income/record/")
        self.profile = GuestProfile.objects.get()
        source = self.profile.income_sources.get(slug="ehail")
        period = FinancialPeriod.objects.create(profile=self.profile, period_month="2026-09-01")
        IncomeEntry.objects.create(
            profile=self.profile,
            period=period,
            source=source,
            income_date="2026-09-04",
            gross_amount="3500.00",
        )
        category = self.profile.work_cost_items.get(slug="petrol")
        self.profile.work_cost_entries.create(category=category, cost_date="2026-09-05", amount="500.00")

    def test_month_is_saved_and_actual_income_comes_from_the_user_record(self):
        saved = self.client.put(
            "/api/v1/homeownership/months/",
            data={"month": "2026-09", "actual_home_costs": "2800.00"},
            content_type="application/json",
        )
        listed = self.client.get("/api/v1/homeownership/months/")

        self.assertEqual(saved.status_code, 200)
        self.assertEqual(saved.json()["recorded_income"], "3500.00")
        self.assertEqual(saved.json()["work_costs"], "500.00")
        self.assertEqual(saved.json()["income_after_work_costs"], "3000.00")
        self.assertEqual(saved.json()["actual_income"], "3000.00")
        self.assertEqual(saved.json()["cash_position"], "200.00")
        self.assertFalse(saved.json()["short"])
        self.assertTrue(saved.json()["is_complete"])
        self.assertEqual(listed.json()["months"], [saved.json()])
        self.assertEqual(HomeownershipMonth.objects.get().profile, self.profile)

        short = self.client.put(
            "/api/v1/homeownership/months/",
            data={"month": "2026-09", "actual_home_costs": "3200.00"},
            content_type="application/json",
        )
        self.assertEqual(short.status_code, 200)
        self.assertEqual(short.json()["cash_position"], "-200.00")
        self.assertTrue(short.json()["short"])

    def test_current_month_is_saved_but_not_marked_complete(self):
        current = timezone.localdate().replace(day=1)
        source = self.profile.income_sources.get(slug="ehail")
        period = FinancialPeriod.objects.create(profile=self.profile, period_month=current)
        IncomeEntry.objects.create(
            profile=self.profile,
            period=period,
            source=source,
            income_date=timezone.localdate(),
            gross_amount="1000.00",
        )

        saved = self.client.put(
            "/api/v1/homeownership/months/",
            data={"month": current.strftime("%Y-%m"), "actual_home_costs": "800.00"},
            content_type="application/json",
        )

        self.assertEqual(saved.status_code, 200)
        self.assertFalse(saved.json()["is_complete"])

    def test_negative_costs_and_invalid_month_are_rejected(self):
        bad_month = self.client.put(
            "/api/v1/homeownership/months/",
            data={"month": "October", "actual_home_costs": "1.00"},
            content_type="application/json",
        )
        bad_cost = self.client.put(
            "/api/v1/homeownership/months/",
            data={"month": "2026-09", "actual_home_costs": "-1"},
            content_type="application/json",
        )
        self.assertEqual(bad_month.status_code, 400)
        self.assertEqual(bad_cost.status_code, 400)


class Iteration3RetentionTests(TestCase):
    def aware_on(self, value):
        return timezone.make_aware(datetime.combine(value, time(hour=12)))

    def test_guest_sees_four_month_warning_before_visit_refreshes_activity(self):
        client = Client()
        client.get("/api/v1/income/record/")
        profile = GuestProfile.objects.get()
        old = months_ago(timezone.localdate(), 4)
        GuestProfile.objects.filter(pk=profile.pk).update(last_active_at=self.aware_on(old))

        response = client.get("/api/v1/retention/")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["warning_due"])
        self.assertEqual(response.json()["removal_date"], add_months(old, 6).isoformat())
        profile.refresh_from_db()
        self.assertEqual(timezone.localdate(profile.last_active_at), timezone.localdate())

    @override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
    def test_account_is_warned_at_five_months_and_only_then_removed_at_six(self):
        user = User.objects.create_user(
            username="retention@example.com",
            email="retention@example.com",
            password="Passw0rd123",
        )
        profile = GuestProfile.objects.create(user=user, session_key="retention-account")
        owner_key = f"user:{user.pk}"
        IdempotencyRecord.objects.create(
            owner_key=owner_key,
            operation="income-entry",
            request_key="retention-account-replay-0001",
            request_hash="a" * 64,
            response_status=201,
            response_data={"amount": "120.50"},
        )
        five_months = months_ago(timezone.localdate(), 5)
        GuestProfile.objects.filter(pk=profile.pk).update(last_active_at=self.aware_on(five_months))

        call_command("process_record_retention", stdout=StringIO())
        profile.refresh_from_db()
        self.assertIsNotNone(profile.retention_warning_sent_at)
        self.assertEqual(len(mail.outbox), 1)
        self.assertTrue(User.objects.filter(pk=user.pk).exists())
        self.assertTrue(IdempotencyRecord.objects.filter(owner_key=owner_key).exists())

        seven_months = months_ago(timezone.localdate(), 7)
        GuestProfile.objects.filter(pk=profile.pk).update(last_active_at=self.aware_on(seven_months))
        call_command("process_record_retention", stdout=StringIO())
        self.assertFalse(User.objects.filter(pk=user.pk).exists())
        self.assertFalse(IdempotencyRecord.objects.filter(owner_key=owner_key).exists())

    def test_inactive_guest_retention_removes_replay_response(self):
        profile = GuestProfile.objects.create(session_key="retention-guest")
        owner_key = f"profile:{profile.public_id}"
        IdempotencyRecord.objects.create(
            owner_key=owner_key,
            operation="expense-entry",
            request_key="retention-guest-replay-0001",
            request_hash="b" * 64,
            response_status=201,
            response_data={"amount": "30.00"},
        )
        old = months_ago(timezone.localdate(), 7)
        GuestProfile.objects.filter(pk=profile.pk).update(last_active_at=self.aware_on(old))

        call_command("process_record_retention", stdout=StringIO())

        self.assertFalse(GuestProfile.objects.filter(pk=profile.pk).exists())
        self.assertFalse(IdempotencyRecord.objects.filter(owner_key=owner_key).exists())

    @override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
    def test_unwarned_account_is_not_removed(self):
        user = User.objects.create_user(
            username="no-email",
            email="",
            password="Passw0rd123",
        )
        profile = GuestProfile.objects.create(user=user, session_key="unwarned-account")
        old = months_ago(timezone.localdate(), 7)
        GuestProfile.objects.filter(pk=profile.pk).update(last_active_at=self.aware_on(old))

        call_command("process_record_retention", stdout=StringIO())

        self.assertTrue(User.objects.filter(pk=user.pk).exists())
