"""Integrity checks for dates: record retention around month ends and the
Malaysia time zone, and which month counts as unfinished at the UTC boundary."""

from datetime import date, datetime, time, timezone as dt_timezone
from decimal import Decimal
from io import StringIO
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone

from .analysis_service import build_income_pattern
from .management.commands.process_record_retention import add_months
from .models import FinancialPeriod, GuestProfile, IncomeEntry
from .services import ensure_default_sources


User = get_user_model()


def malaysia_noon(value):
    return timezone.make_aware(datetime.combine(value, time(hour=12)))


def run_retention_on(day=None):
    """Run the retention job, optionally as if today were `day` (Malaysia date)."""
    if day is None:
        call_command("process_record_retention", stdout=StringIO())
        return
    with patch("django.utils.timezone.localdate", return_value=day):
        call_command("process_record_retention", stdout=StringIO())


class AddMonthsTests(TestCase):
    def test_month_ends_clamp_to_the_last_day_of_shorter_months(self):
        self.assertEqual(add_months(date(2026, 8, 31), 5), date(2027, 1, 31))
        self.assertEqual(add_months(date(2026, 8, 31), 6), date(2027, 2, 28))
        self.assertEqual(add_months(date(2027, 8, 31), 6), date(2028, 2, 29))  # leap year
        self.assertEqual(add_months(date(2026, 5, 31), 4), date(2026, 9, 30))
        self.assertEqual(add_months(date(2026, 11, 30), 3), date(2027, 2, 28))  # across a year end
        self.assertEqual(add_months(date(2026, 3, 31), -1), date(2026, 2, 28))  # going back


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class RetentionScheduleIntegrityTests(TestCase):
    def account(self, name, last_use, warned=False):
        user = User.objects.create_user(username=f"{name}@example.com", email=f"{name}@example.com", password="Passw0rd123")
        profile = GuestProfile.objects.create(user=user, session_key=f"account-{name}")
        GuestProfile.objects.filter(pk=profile.pk).update(
            last_active_at=last_use,
            retention_warning_sent_at=timezone.now() if warned else None,
        )
        return user, profile

    def guest(self, name, last_use):
        profile = GuestProfile.objects.create(session_key=f"guest-{name}")
        GuestProfile.objects.filter(pk=profile.pk).update(last_active_at=last_use)
        return profile

    def test_warning_and_removal_fall_on_the_clamped_month_end_days(self):
        # Last use on 31 August: warning due 31 January, removal due 28 February.
        user, profile = self.account("month-end", malaysia_noon(date(2026, 8, 31)))

        run_retention_on(date(2027, 1, 30))
        self.assertEqual(len(mail.outbox), 0)

        run_retention_on(date(2027, 1, 31))
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("28 February 2027", mail.outbox[0].body)

        run_retention_on(date(2027, 2, 27))
        self.assertTrue(User.objects.filter(pk=user.pk).exists())

        run_retention_on(date(2027, 2, 28))
        self.assertFalse(User.objects.filter(pk=user.pk).exists())
        self.assertFalse(GuestProfile.objects.filter(pk=profile.pk).exists())

    def test_guest_is_removed_on_the_removal_day_and_not_the_day_before(self):
        profile = self.guest("boundary", malaysia_noon(date(2026, 8, 31)))

        run_retention_on(date(2027, 2, 27))
        self.assertTrue(GuestProfile.objects.filter(pk=profile.pk).exists())

        run_retention_on(date(2027, 2, 28))
        self.assertFalse(GuestProfile.objects.filter(pk=profile.pk).exists())

    def test_last_use_is_the_malaysia_date_not_the_utc_date(self):
        # 20:00 UTC on 31 August is 04:00 on 1 September in Malaysia, so the
        # warning is due on 1 February, not 31 January.
        late_utc = datetime(2026, 8, 31, 20, 0, tzinfo=dt_timezone.utc)
        self.account("utc-evening", late_utc)

        run_retention_on(date(2027, 1, 31))
        self.assertEqual(len(mail.outbox), 0)

        run_retention_on(date(2027, 2, 1))
        self.assertEqual(len(mail.outbox), 1)

    def test_running_the_job_twice_changes_nothing_more(self):
        today = timezone.localdate()
        self.guest("old", malaysia_noon(add_months(today, -7)))
        self.account("five-months", malaysia_noon(add_months(today, -5)))
        self.account("warned-seven-months", malaysia_noon(add_months(today, -7)), warned=True)
        self.account("four-months", malaysia_noon(add_months(today, -4)))
        self.account("active", timezone.now())
        self.guest("active", timezone.now())

        run_retention_on()
        after_first = (
            sorted(GuestProfile.objects.values_list("session_key", "retention_warning_sent_at")),
            sorted(User.objects.values_list("username", flat=True)),
            len(mail.outbox),
        )
        run_retention_on()
        after_second = (
            sorted(GuestProfile.objects.values_list("session_key", "retention_warning_sent_at")),
            sorted(User.objects.values_list("username", flat=True)),
            len(mail.outbox),
        )

        self.assertEqual(after_first, after_second)
        self.assertEqual(after_first[2], 1)  # only the five month account was warned, once
        self.assertEqual(
            after_first[1],
            ["active@example.com", "five-months@example.com", "four-months@example.com"],
        )

    def test_active_and_recent_records_are_never_warned_or_removed(self):
        today = timezone.localdate()
        active_user, active_profile = self.account("active", timezone.now())
        recent_user, recent_profile = self.account("four-months", malaysia_noon(add_months(today, -4)))
        guest = self.guest("recent", malaysia_noon(add_months(today, -5)))

        run_retention_on()

        self.assertEqual(len(mail.outbox), 0)
        for user in (active_user, recent_user):
            self.assertTrue(User.objects.filter(pk=user.pk).exists())
        for profile in (active_profile, recent_profile, guest):
            profile.refresh_from_db()
            self.assertIsNone(profile.retention_warning_sent_at)


class UnfinishedMonthTimeZoneTests(TestCase):
    """The unfinished month follows the Malaysia calendar, not UTC."""

    def setUp(self):
        self.profile = GuestProfile.objects.create(session_key="time-zone-boundary")
        ensure_default_sources(self.profile)
        source = self.profile.income_sources.get(slug="ehail")
        for month, amount in ((9, "3200.00"), (10, "2800.00")):
            period = FinancialPeriod.objects.create(profile=self.profile, period_month=date(2026, month, 1))
            IncomeEntry.objects.create(
                profile=self.profile, period=period, source=source,
                income_date=date(2026, month, 15), gross_amount=Decimal(amount),
            )

    def pattern_at(self, utc_moment):
        with patch("django.utils.timezone.now", return_value=utc_moment):
            return build_income_pattern(self.profile)

    def test_october_is_still_unfinished_at_2330_on_31_october_in_malaysia(self):
        # 15:30 UTC is 23:30 in Malaysia, still 31 October.
        pattern = self.pattern_at(datetime(2026, 10, 31, 15, 30, tzinfo=dt_timezone.utc))
        self.assertEqual(pattern["current_month_so_far"]["month"], "2026-10")
        self.assertEqual(pattern["recorded_month_count"], 1)

    def test_october_counts_as_finished_once_it_is_1_november_in_malaysia(self):
        # 16:30 UTC on 31 October is 00:30 on 1 November in Malaysia.
        pattern = self.pattern_at(datetime(2026, 10, 31, 16, 30, tzinfo=dt_timezone.utc))
        self.assertIsNone(pattern["current_month_so_far"])
        self.assertEqual([row["month"] for row in pattern["completed_months"]], ["2026-09", "2026-10"])
        self.assertEqual(pattern["recorded_month_count"], 2)
