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
    """EN: Resolve the guest boundary used by all Epic 1 writes and Epic 2 reads.
    中文：解析所有 Epic 1 写入与 Epic 2 读取共用的访客边界。
    """

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


# EN: Epic 1 default choices are created once per profile; custom choices remain profile-owned.
# 中文：Epic 1 预设选项每个 profile 只初始化一次；自定义选项仍归该 profile 所有。
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
    """EN: AC1.1.10 requires confirmation above 3x median after 3 manual entries.
    中文：AC1.1.10 在至少 3 条手工记录后，对超过中位数 3 倍的金额要求确认。
    """
    # EN: Historical totals and imports do not participate in this manual-entry baseline.
    # 中文：历史月总额和导入记录不参与这条手工录入基线。
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
    """EN: Persist AC1.1.6/US1.2/US1.8 income in its authoritative FinancialPeriod.
    中文：把 AC1.1.6/US1.2/US1.8 收入持久化到权威 FinancialPeriod。
    """
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

@transaction.atomic
def update_historical_income_entry(
    *,
    entry: IncomeEntry,
    income_date: date,
    gross_amount: Decimal,
) -> IncomeEntry:
    """Update one historical monthly total without creating a duplicate record."""
    if entry.entry_method != IncomeEntry.EntryMethod.HISTORICAL_TOTAL:
        raise ValueError("Only historical monthly totals can be edited through this operation.")

    old_period = entry.period
    target_month = income_date.replace(day=1)
    if old_period.period_month != target_month:
        target_period, _ = FinancialPeriod.objects.get_or_create(
            profile=entry.profile,
            period_month=target_month,
            defaults={"record_basis": FinancialPeriod.RecordBasis.MONTHLY_TOTAL},
        )
        if target_period.record_basis != FinancialPeriod.RecordBasis.MONTHLY_TOTAL:
            target_period.record_basis = FinancialPeriod.RecordBasis.MONTHLY_TOTAL
            target_period.save(update_fields=["record_basis"])
        entry.period = target_period

    entry.income_date = income_date
    entry.gross_amount = gross_amount
    entry.source = None
    entry.user_confirmed = True
    entry.save(update_fields=["period", "income_date", "gross_amount", "source", "user_confirmed"])

    if old_period.id != entry.period_id and not old_period.income_entries.exists():
        old_period.delete()

    return entry

