from __future__ import annotations

from datetime import date
from decimal import Decimal

from django.db import transaction

from .models import ExpenseEntry, FinancialPeriod, IncomeEntry, IncomeSource
from .services import (
    ensure_default_commitments,
    ensure_default_expense_categories,
    ensure_default_sources,
    ensure_default_work_costs,
)


SCENARIO_ID = "my-gig-driver-12m"
SCENARIO_NAME = "Malaysian e-hailing driver — 12 volatile months"

# This is a deterministic product-test fixture, not a population benchmark.
# It deliberately includes strong, quiet and interrupted months so downstream
# calculations have meaningful variation to process.
SCENARIO_MONTHS = (
    ("2025-08", "4780.00", "baseline", ("260", "310", "110", "300", "100")),
    ("2025-09", "5260.00", "strong_demand", ("280", "320", "120", "310", "100")),
    ("2025-10", "4930.00", "weather_variation", ("270", "320", "115", "300", "95")),
    ("2025-11", "5480.00", "demand_recovery", ("290", "330", "125", "320", "105")),
    ("2025-12", "6620.00", "holiday_peak", ("350", "390", "150", "390", "150")),
    ("2026-01", "4380.00", "post_holiday_slow", ("260", "310", "115", "300", "95")),
    ("2026-02", "3910.00", "vehicle_downtime", ("280", "330", "130", "330", "120")),
    ("2026-03", "5840.00", "festive_evening_peak", ("320", "350", "140", "350", "130")),
    ("2026-04", "4690.00", "festive_cooldown", ("280", "330", "120", "320", "100")),
    ("2026-05", "5560.00", "strong_weekends", ("300", "350", "130", "340", "110")),
    ("2026-06", "5010.00", "mixed_demand", ("290", "340", "120", "320", "100")),
    ("2026-07", "5790.00", "strong_demand", ("320", "370", "140", "360", "130")),
)

WORK_COST_AMOUNTS = {
    "petrol": Decimal("420.00"),
    "service": Decimal("110.00"),
    "platform": Decimal("100.00"),
    "data": Decimal("55.00"),
    "roadtax": Decimal("65.00"),
}

COMMITMENT_AMOUNTS = {
    "rent": Decimal("700.00"),
    "food": Decimal("650.00"),
    "util": Decimal("150.00"),
    "family": Decimal("250.00"),
    "motor": Decimal("280.00"),
    "ptptn": Decimal("80.00"),
    "save": Decimal("120.00"),
}

EXPENSE_CATEGORY_SLUGS = ("meals", "groc", "transp", "family", "other")
INCOME_DAYS = (3, 10, 17, 24, 27)
INCOME_WEIGHTS = (
    Decimal("0.20"),
    Decimal("0.21"),
    Decimal("0.22"),
    Decimal("0.24"),
    Decimal("0.13"),
)
EXPENSE_SPLIT_WEIGHTS = (
    Decimal("0.21"),
    Decimal("0.23"),
    Decimal("0.26"),
    Decimal("0.30"),
)


def available_scenarios() -> list[dict]:
    return [
        {
            "id": SCENARIO_ID,
            "name": SCENARIO_NAME,
            "months": len(SCENARIO_MONTHS),
            "supports": ["epic1", "epic2", "epic5"],
            "destructive_scope": "current_guest_finance_only",
        }
    ]


def _split_amount(total: Decimal, weights: tuple[Decimal, ...]) -> list[Decimal]:
    values: list[Decimal] = []
    used = Decimal("0.00")
    for weight in weights[:-1]:
        value = (total * weight).quantize(Decimal("0.01"))
        values.append(value)
        used += value
    values.append(total - used)
    return values


def _reset_epic1_finance(profile) -> None:
    profile.income_import_batches.all().delete()
    profile.income_entries.all().delete()
    profile.financial_periods.all().delete()
    profile.income_sources.all().delete()
    profile.expense_entries.all().delete()
    profile.expense_categories.all().delete()
    profile.work_cost_items.all().delete()
    profile.commitment_items.all().delete()


@transaction.atomic
def load_scenario(*, profile, scenario_id: str) -> dict:
    if scenario_id != SCENARIO_ID:
        from rest_framework.exceptions import NotFound

        raise NotFound("Test scenario was not found.")

    _reset_epic1_finance(profile)
    ensure_default_sources(profile)
    ensure_default_work_costs(profile)
    ensure_default_commitments(profile)
    ensure_default_expense_categories(profile)

    for slug, amount in WORK_COST_AMOUNTS.items():
        profile.work_cost_items.filter(slug=slug).update(monthly_amount=amount)
    for slug, amount in COMMITMENT_AMOUNTS.items():
        profile.commitment_items.filter(slug=slug).update(monthly_amount=amount)

    ehail = profile.income_sources.get(slug="ehail")
    delivery = IncomeSource.objects.create(
        profile=profile,
        name="Food delivery",
        is_custom=True,
    )
    categories = {
        category.slug: category
        for category in profile.expense_categories.filter(slug__in=EXPENSE_CATEGORY_SLUGS)
    }

    income_entries: list[IncomeEntry] = []
    expense_entries: list[ExpenseEntry] = []
    monthly_summary: list[dict] = []
    income_total = Decimal("0.00")
    expense_total = Decimal("0.00")

    for month_text, gross_text, condition, expense_values in SCENARIO_MONTHS:
        year, month = (int(part) for part in month_text.split("-"))
        period = FinancialPeriod.objects.create(
            profile=profile,
            period_month=date(year, month, 1),
            record_basis=FinancialPeriod.RecordBasis.ENTRY,
        )
        gross = Decimal(gross_text)
        income_parts = _split_amount(gross, INCOME_WEIGHTS)
        for index, (day, amount) in enumerate(zip(INCOME_DAYS, income_parts)):
            income_entries.append(
                IncomeEntry(
                    profile=profile,
                    period=period,
                    source=delivery if index == len(INCOME_DAYS) - 1 else ehail,
                    income_date=date(year, month, day),
                    gross_amount=amount,
                    entry_method=IncomeEntry.EntryMethod.MANUAL,
                    user_confirmed=True,
                )
            )

        month_expense_total = Decimal("0.00")
        for category_index, (slug, category_total_text) in enumerate(
            zip(EXPENSE_CATEGORY_SLUGS, expense_values)
        ):
            category_total = Decimal(category_total_text)
            month_expense_total += category_total
            for week_index, amount in enumerate(
                _split_amount(category_total, EXPENSE_SPLIT_WEIGHTS)
            ):
                expense_entries.append(
                    ExpenseEntry(
                        profile=profile,
                        category=categories[slug],
                        expense_date=date(year, month, 2 + category_index + week_index * 7),
                        amount=amount,
                        entry_method=ExpenseEntry.EntryMethod.MANUAL,
                        user_confirmed=True,
                    )
                )

        income_total += gross
        expense_total += month_expense_total
        monthly_summary.append(
            {
                "month": month_text,
                "condition": condition,
                "gross_income": f"{gross:.2f}",
                "logged_expenses": f"{month_expense_total:.2f}",
                "recorded_expense_days": 20,
            }
        )

    IncomeEntry.objects.bulk_create(income_entries)
    ExpenseEntry.objects.bulk_create(expense_entries)

    return {
        "scenario_id": SCENARIO_ID,
        "scenario_name": SCENARIO_NAME,
        "profile_id": str(profile.public_id),
        "month_count": len(SCENARIO_MONTHS),
        "income_entry_count": len(income_entries),
        "expense_entry_count": len(expense_entries),
        "gross_income_total": f"{income_total:.2f}",
        "logged_expense_total": f"{expense_total:.2f}",
        "work_cost_monthly": f"{sum(WORK_COST_AMOUNTS.values()):.2f}",
        "commitment_monthly_estimate": f"{sum(COMMITMENT_AMOUNTS.values()):.2f}",
        "first_month": SCENARIO_MONTHS[0][0],
        "last_month": SCENARIO_MONTHS[-1][0],
        "monthly": monthly_summary,
    }
