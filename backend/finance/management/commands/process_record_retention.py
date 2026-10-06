import calendar
from datetime import date

from django.conf import settings
from django.core.mail import send_mail
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from finance.models import GuestProfile


def add_months(value: date, months: int) -> date:
    index = value.year * 12 + value.month - 1 + months
    year, month0 = divmod(index, 12)
    day = min(value.day, calendar.monthrange(year, month0 + 1)[1])
    return date(year, month0 + 1, day)


class Command(BaseCommand):
    help = "Warn inactive accounts at five months and remove eligible records at six months."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")

    @transaction.atomic
    def handle(self, *args, **options):
        today = timezone.localdate()
        dry_run = options["dry_run"]
        warned = deleted_accounts = deleted_guests = 0

        for profile in GuestProfile.objects.select_related("user").all():
            last_use = timezone.localtime(profile.last_active_at).date()
            warning_date = add_months(last_use, 5)
            removal_date = add_months(last_use, 6)

            if profile.user_id is None:
                if today >= removal_date:
                    deleted_guests += 1
                    if not dry_run:
                        profile.delete()
                continue

            if today >= removal_date:
                # AC8.25.4: no account removal unless the five-month warning
                # was actually sent and recorded.
                if profile.retention_warning_sent_at is not None:
                    deleted_accounts += 1
                    if not dry_run:
                        profile.user.delete()
                continue

            if today < warning_date or profile.retention_warning_sent_at is not None:
                continue
            email = (profile.user.email or "").strip()
            if not email:
                continue
            warned += 1
            if dry_run:
                continue
            send_mail(
                "Keep your RuMampu record",
                (
                    f"Your RuMampu record is scheduled to be removed on {removal_date.day} {removal_date:%B %Y} "
                    "after six months without use. Sign in before then to keep it."
                ),
                settings.DEFAULT_FROM_EMAIL,
                [email],
                fail_silently=False,
            )
            profile.retention_warning_sent_at = timezone.now()
            profile.save(update_fields=["retention_warning_sent_at"])

        self.stdout.write(
            self.style.SUCCESS(
                f"warned={warned} deleted_accounts={deleted_accounts} deleted_guests={deleted_guests} dry_run={dry_run}"
            )
        )
