from __future__ import annotations

from datetime import date
import hashlib
from decimal import Decimal
from statistics import median

from django.db import transaction

from .models import (
    CommitmentItem,
    ExpenseCategory,
    FinancialPeriod,
    GuestProfile,
    IncomeEntry,
    IncomeSource,
    WorkCostItem,
)


DEFAULT_INCOME_SOURCES = (
    ("ehail", "E-hailing"),
    ("freelance", "Freelance"),
    ("parttime", "Part-time (fixed)"),
)

DEFAULT_WORK_COSTS = (
    ("petrol", "Petrol"),
    ("service", "Servicing"),
    ("platform", "Platform fees"),
    ("data", "Phone data"),
    ("roadtax", "Road tax & insurance"),
)

DEFAULT_COMMITMENTS = (
    (CommitmentItem.CommitmentType.LIVING, "rent", "Rent", False),
    (CommitmentItem.CommitmentType.LIVING, "food", "Food & groceries", True),
    (CommitmentItem.CommitmentType.LIVING, "util", "Utilities", False),
    (CommitmentItem.CommitmentType.LIVING, "family", "Family support", True),
    (CommitmentItem.CommitmentType.DEBT, "motor", "Motorcycle loan", False),
    (CommitmentItem.CommitmentType.DEBT, "ptptn", "PTPTN", False),
    (CommitmentItem.CommitmentType.SAVINGS, "save", "Savings", False),
)

DEFAULT_EXPENSE_CATEGORIES = (
    ("meals", "Meals"),
    ("groc", "Groceries"),
    ("transp", "Tolls & parking"),
    ("family", "Family"),
    ("other", "Other"),
)
def profile_for_request(request) -> GuestProfile:
    client_id = request.headers.get("X-RuMampu-Client-ID", "").strip()

    if client_id:
        # Web deployments may not reliably preserve Django's cross-site session
        # cookie. Hash the browser's stable anonymous ID into the existing
        # 40-character session_key field so no model/migration change is needed.
        profile_key = hashlib.sha256(client_id.encode("utf-8")).hexdigest()[:40]
    else:
        # Keep the existing Expo Go/native/local behaviour unchanged.
        if not request.session.session_key:
            request.session.create()
        profile_key = request.session.session_key

    profile, created = GuestProfile.objects.get_or_create(
        session_key=profile_key,
    )
    # Defaults are profile bootstrap data. Creating/checking them on every API
    # request adds many unnecessary database round trips, especially against a
    # remote PostgreSQL database. Existing guest profiles were already
    # initialised by the previous request flow; new profiles are initialised once.
    if created:
        ensure_default_sources(profile)
        ensure_default_work_costs(profile)
        ensure_default_commitments(profile)
        ensure_default_expense_categories(profile)
    return profile


def ensure_default_sources(profile: GuestProfile) -> None:
    for slug, name in DEFAULT_INCOME_SOURCES:
        IncomeSource.objects.get_or_create(
            profile=profile,
            slug=slug,
            defaults={"name": name, "is_custom": False},
        )


def ensure_default_work_costs(profile: GuestProfile) -> None:
    for slug, name in DEFAULT_WORK_COSTS:
        WorkCostItem.objects.get_or_create(
            profile=profile,
            slug=slug,
            defaults={"name": name, "is_custom": False},
        )


def ensure_default_commitments(profile: GuestProfile) -> None:
    for commitment_type, slug, name, is_daily_variable in DEFAULT_COMMITMENTS:
        CommitmentItem.objects.get_or_create(
            profile=profile,
            slug=slug,
            defaults={
                "commitment_type": commitment_type,
                "name": name,
                "is_daily_variable": is_daily_variable,
            },
        )


def ensure_default_expense_categories(profile: GuestProfile) -> None:
    for slug, name in DEFAULT_EXPENSE_CATEGORIES:
        ExpenseCategory.objects.get_or_create(
            profile=profile,
            slug=slug,
            defaults={"name": name, "is_custom": False},
        )


def is_unusually_high(profile: GuestProfile, amount: Decimal) -> tuple[bool, Decimal | None]:
    values = list(
        profile.income_entries.filter(
            entry_method=IncomeEntry.EntryMethod.MANUAL,
        )
        .order_by("gross_amount")
        .values_list("gross_amount", flat=True)
    )
    if len(values) < 3:
        return False, None
    baseline = Decimal(str(median(values)))
    return amount > baseline * Decimal("3"), baseline


@transaction.atomic
def create_income_entry(
    *,
    profile: GuestProfile,
    source: IncomeSource | None,
    income_date: date,
    gross_amount: Decimal,
    entry_method: str,
) -> IncomeEntry:
    period_month = income_date.replace(day=1)
    period, _ = FinancialPeriod.objects.get_or_create(
        profile=profile,
        period_month=period_month,
        defaults={"record_basis": FinancialPeriod.RecordBasis.ENTRY},
    )
    if entry_method == IncomeEntry.EntryMethod.HISTORICAL_TOTAL:
        period.record_basis = FinancialPeriod.RecordBasis.MONTHLY_TOTAL
        period.save(update_fields=["record_basis"])

    return IncomeEntry.objects.create(
        profile=profile,
        period=period,
        source=source,
        income_date=income_date,
        gross_amount=gross_amount,
        entry_method=entry_method,
        user_confirmed=True,
    )
