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
    IncomeCoverage,
    IncomeEntry,
    IncomeImportBatch,
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
    """EN: Resolve the account profile first, otherwise the current guest boundary.
    中文：已登录时优先使用账号 profile，否则使用当前访客边界。
    """

    user = getattr(request, "user", None)
    if user is not None and user.is_authenticated:
        existing = GuestProfile.objects.filter(user=user).first()
        if existing is not None:
            return existing
        fallback_key = hashlib.sha256(f"user:{user.pk}".encode("utf-8")).hexdigest()[:40]
        profile, created = GuestProfile.objects.get_or_create(
            session_key=fallback_key,
            defaults={"user": user},
        )
        if profile.user_id is None:
            profile.user = user
            profile.save(update_fields=["user", "last_active_at"])
        if created:
            ensure_default_sources(profile)
            ensure_default_work_costs(profile)
            ensure_default_commitments(profile)
            ensure_default_expense_categories(profile)
        return profile

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


def guest_profile_for_request(request) -> GuestProfile | None:
    client_id = request.headers.get("X-RuMampu-Client-ID", "").strip()
    if client_id:
        profile_key = hashlib.sha256(client_id.encode("utf-8")).hexdigest()[:40]
    else:
        profile_key = request.session.session_key
    if not profile_key:
        return None
    return GuestProfile.objects.filter(session_key=profile_key, user__isnull=True).first()


def profile_has_user_record(profile: GuestProfile) -> bool:
    if profile.income_entries.exists():
        return True
    if profile.work_cost_entries.exists():
        return True
    if profile.expense_entries.exists():
        return True
    if profile.commitment_items.filter(monthly_amount__gt=0).exists():
        return True
    if profile.income_import_batches.exists():
        return True
    if IncomeCoverage.objects.filter(profile=profile).exists():
        return True
    from apps.housing.models import HousingScenario

    return HousingScenario.objects.filter(profile=profile).exists()


def guest_transfer_status(request) -> dict:
    profile = guest_profile_for_request(request)
    available = profile is not None and profile_has_user_record(profile)
    return {
        "available": available,
        "summary": {
            "income_entries": profile.income_entries.count() if profile else 0,
            "work_cost_entries": profile.work_cost_entries.count() if profile else 0,
            "expense_entries": profile.expense_entries.count() if profile else 0,
            "housing_scenarios": profile.housing_scenarios.count() if profile else 0,
        },
    }


def _matching_source(target: GuestProfile, source: IncomeSource | None) -> IncomeSource | None:
    if source is None:
        return None
    if source.slug:
        found = target.income_sources.filter(slug=source.slug).first()
        if found is not None:
            return found
    return IncomeSource.objects.create(
        profile=target,
        slug=source.slug if source.slug and not target.income_sources.filter(slug=source.slug).exists() else "",
        name=source.name,
        is_custom=source.is_custom,
        is_active=source.is_active,
    )


def _matching_work_cost(target: GuestProfile, item: WorkCostItem) -> WorkCostItem:
    if item.slug:
        found = target.work_cost_items.filter(slug=item.slug).first()
        if found is not None:
            return found
    return WorkCostItem.objects.create(
        profile=target,
        slug=item.slug if item.slug and not target.work_cost_items.filter(slug=item.slug).exists() else "",
        name=item.name,
        monthly_amount=item.monthly_amount,
        is_custom=item.is_custom,
        is_active=item.is_active,
    )


def _matching_expense_category(target: GuestProfile, category: ExpenseCategory) -> ExpenseCategory:
    if category.slug:
        found = target.expense_categories.filter(slug=category.slug).first()
        if found is not None:
            return found
    return ExpenseCategory.objects.create(
        profile=target,
        slug=category.slug if category.slug and not target.expense_categories.filter(slug=category.slug).exists() else "",
        name=category.name,
        is_custom=category.is_custom,
        is_active=category.is_active,
    )


@transaction.atomic
def transfer_guest_record_to_user(request, user) -> dict:
    guest = guest_profile_for_request(request)
    if guest is None or not profile_has_user_record(guest):
        return {"transferred": False, **guest_transfer_status(request)}

    target = profile_for_request(request)
    if target.pk == guest.pk:
        return {"transferred": False, **guest_transfer_status(request)}

    if not profile_has_user_record(target):
        from apps.housing.models import HousingScenario

        HousingScenario.objects.filter(profile=guest, user__isnull=True).update(profile=None, user=user)
        target.delete()
        guest.user = user
        guest.save(update_fields=["user", "last_active_at"])
        return {"transferred": True, "available": False, "summary": {}}

    period_map = {}
    for period in guest.financial_periods.all():
        target_period, _ = FinancialPeriod.objects.get_or_create(
            profile=target,
            period_month=period.period_month,
            defaults={"record_basis": period.record_basis},
        )
        period_map[period.pk] = target_period

    source_map = {source.pk: _matching_source(target, source) for source in guest.income_sources.all()}
    for entry in guest.income_entries.select_related("period", "source").all():
        if entry.entry_method == IncomeEntry.EntryMethod.HISTORICAL_TOTAL and target.income_entries.filter(
            period=period_map[entry.period_id],
            entry_method=IncomeEntry.EntryMethod.HISTORICAL_TOTAL,
        ).exists():
            continue
        entry.profile = target
        entry.period = period_map[entry.period_id]
        entry.source = source_map.get(entry.source_id)
        entry.save(update_fields=["profile", "period", "source"])

    cost_map = {item.pk: _matching_work_cost(target, item) for item in guest.work_cost_items.all()}
    for entry in guest.work_cost_entries.select_related("category").all():
        entry.profile = target
        entry.category = cost_map[entry.category_id]
        entry.save(update_fields=["profile", "category"])

    category_map = {category.pk: _matching_expense_category(target, category) for category in guest.expense_categories.all()}
    for entry in guest.expense_entries.select_related("category").all():
        entry.profile = target
        entry.category = category_map[entry.category_id]
        entry.save(update_fields=["profile", "category"])

    for item in guest.commitment_items.all():
        target_item = target.commitment_items.filter(slug=item.slug).first() if item.slug else None
        if target_item is None:
            item.profile = target
            item.save(update_fields=["profile"])
        elif target_item.monthly_amount == 0 and item.monthly_amount != 0:
            target_item.monthly_amount = item.monthly_amount
            target_item.is_active = item.is_active
            target_item.save(update_fields=["monthly_amount", "is_active", "updated_at"])

    IncomeImportBatch.objects.filter(profile=guest).update(profile=target)
    try:
        coverage = guest.income_coverage
    except IncomeCoverage.DoesNotExist:
        coverage = None
    if coverage is not None and not IncomeCoverage.objects.filter(profile=target).exists():
        coverage.profile = target
        coverage.save(update_fields=["profile"])

    from apps.housing.models import HousingScenario

    HousingScenario.objects.filter(profile=guest, user__isnull=True).update(profile=None, user=user)
    guest.delete()
    return {"transferred": True, "available": False, "summary": {}}


@transaction.atomic
def discard_guest_record_for_request(request) -> dict:
    guest = guest_profile_for_request(request)
    if guest is None:
        return {"discarded": False, "available": False, "summary": {}}
    guest.delete()
    return {"discarded": True, "available": False, "summary": {}}


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



@transaction.atomic
def claim_guest_profile_for_user(request, user) -> GuestProfile:
    """Attach the current anonymous profile to a user when the account has no profile yet.

    If the user already owns a RuMampu profile, keep that profile authoritative.
    This makes login safe for returning users while allowing a new account to keep
    the financial data entered before authentication.
    """
    existing = GuestProfile.objects.select_for_update().filter(user=user).first()
    if existing is not None:
        return existing

    profile = guest_profile_for_request(request)
    if profile is None:
        return profile_for_request(request)
    if profile.user_id is None:
        profile.user = user
        profile.save(update_fields=["user", "last_active_at"])
        return profile

    if profile.user_id == user.pk:
        return profile

    # The current anonymous identifier is already owned by another account.
    # Create a clean account profile rather than stealing another user's data.
    fallback_key = hashlib.sha256(f"user:{user.pk}".encode("utf-8")).hexdigest()[:40]
    profile, created = GuestProfile.objects.get_or_create(
        session_key=fallback_key,
        defaults={"user": user},
    )
    if profile.user_id is None:
        profile.user = user
        profile.save(update_fields=["user", "last_active_at"])
    if created:
        ensure_default_sources(profile)
        ensure_default_work_costs(profile)
        ensure_default_commitments(profile)
        ensure_default_expense_categories(profile)
    return profile

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
def update_income_entry(
    *,
    entry: IncomeEntry,
    income_date: date,
    gross_amount: Decimal,
    source: IncomeSource | None = None,
) -> IncomeEntry:
    """Update an itemised or historical-total income and keep its period consistent."""
    if entry.entry_method not in (
        IncomeEntry.EntryMethod.MANUAL,
        IncomeEntry.EntryMethod.HISTORICAL_TOTAL,
        IncomeEntry.EntryMethod.IMPORT,
    ):
        raise ValueError("This income entry type cannot be edited through this operation.")

    old_period = entry.period
    target_month = income_date.replace(day=1)
    target_basis = (
        FinancialPeriod.RecordBasis.MONTHLY_TOTAL
        if entry.entry_method == IncomeEntry.EntryMethod.HISTORICAL_TOTAL
        else FinancialPeriod.RecordBasis.ENTRY
    )

    if old_period.period_month != target_month:
        target_period, _ = FinancialPeriod.objects.get_or_create(
            profile=entry.profile,
            period_month=target_month,
            defaults={"record_basis": target_basis},
        )
        if target_period.record_basis != target_basis:
            target_period.record_basis = target_basis
            target_period.save(update_fields=["record_basis"])
        entry.period = target_period

    entry.income_date = income_date
    entry.gross_amount = gross_amount
    entry.source = None if entry.entry_method == IncomeEntry.EntryMethod.HISTORICAL_TOTAL else source
    entry.user_confirmed = True
    entry.save(update_fields=["period", "income_date", "gross_amount", "source", "user_confirmed"])

    if old_period.id != entry.period_id and not old_period.income_entries.exists():
        old_period.delete()

    return entry


def update_historical_income_entry(
    *,
    entry: IncomeEntry,
    income_date: date,
    gross_amount: Decimal,
) -> IncomeEntry:
    """Compatibility wrapper for older callers."""
    if entry.entry_method != IncomeEntry.EntryMethod.HISTORICAL_TOTAL:
        raise ValueError("Only historical monthly totals can be edited through this operation.")
    return update_income_entry(
        entry=entry,
        income_date=income_date,
        gross_amount=gross_amount,
        source=None,
    )
