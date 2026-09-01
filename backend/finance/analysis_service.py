from __future__ import annotations

import logging
from decimal import Decimal, ROUND_HALF_UP, localcontext

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Sum

from .models import GuestProfile, IncomeCoverage


MONEY_QUANTUM = Decimal("0.01")
logger = logging.getLogger(__name__)


def _money(value: Decimal) -> Decimal:
    return value.quantize(MONEY_QUANTUM, rounding=ROUND_HALF_UP)


def _history_depth(month_count: int) -> str:
    """EN: Preserve limited-history states instead of imposing a minimum month count.
    中文：保留有限历史状态，不强制最低记录月份数。
    """

    if month_count == 0:
        return "empty"
    if month_count == 1:
        return "one_month"
    if month_count == 2:
        return "two_months"
    return "three_or_more"


def build_income_pattern(profile: GuestProfile) -> dict:
    """EN: Authoritative US2.1-US2.3 monthly usable-income and statistics calculation.
    中文：US2.1-US2.3 的权威逐月可用收入与统计计算。

    EN: The rule is gross income minus the current active monthly work-cost snapshot.
    Lower-income months are tied recorded minima, never a fixed threshold or risk score.
    中文：规则为总收入减当前有效月度工作成本快照；低收入月取并列记录最低值，
    不使用固定阈值或风险评分。
    """

    monthly_work_cost = (
        profile.work_cost_items.filter(is_active=True).aggregate(total=Sum("monthly_amount"))[
            "total"
        ]
        or Decimal("0.00")
    )
    recorded = list(
        profile.income_entries.values("period__period_month")
        .annotate(gross_income=Sum("gross_amount"))
        .order_by("period__period_month")
    )

    rows: list[dict] = []
    usable_values: list[Decimal] = []
    for item in recorded:
        gross = item["gross_income"] or Decimal("0.00")
        usable = gross - monthly_work_cost
        usable_values.append(usable)
        rows.append(
            {
                "month": item["period__period_month"].strftime("%Y-%m"),
                "gross_income": gross,
                "work_costs": monthly_work_cost,
                "usable_income": usable,
                "is_lowest_recorded": False,
            }
        )

    count = len(usable_values)
    statistics_payload = None
    lower_months: list[str] = []
    if count:
        total = sum(usable_values, Decimal("0.00"))
        average = total / Decimal(count)
        ordered = sorted(usable_values)
        middle = count // 2
        median = (
            ordered[middle]
            if count % 2
            else (ordered[middle - 1] + ordered[middle]) / Decimal("2")
        )
        lowest = ordered[0]
        highest = ordered[-1]
        with localcontext() as context:
            context.prec = 32
            variance = sum(
                ((value - average) ** 2 for value in usable_values),
                Decimal("0.00"),
            ) / Decimal(count)
            standard_deviation = variance.sqrt()
        statistics_payload = {
            "average": _money(average),
            "median": _money(median),
            "highest": _money(highest),
            "lowest": _money(lowest),
            "range": _money(highest - lowest),
            "standard_deviation": _money(standard_deviation),
        }

        if count >= 2:
            for row in rows:
                if row["usable_income"] == lowest:
                    row["is_lowest_recorded"] = True
                    lower_months.append(row["month"])

    return {
        "recorded_month_count": count,
        "history_depth": _history_depth(count),
        "provenance": "calculated_from_user_record",
        "monthly_work_cost_total": monthly_work_cost,
        "work_cost_basis": "current_active_monthly_snapshot",
        "months": rows,
        "statistics": statistics_payload,
        "lower_income": {
            "basis": "recorded_minimum",
            "months": lower_months,
        },
    }


def build_income_coverage(profile: GuestProfile) -> dict:
    """EN: Evaluate US2.4 against recorded calendar months and the confirmed user answer.
    中文：依据已记录日历月份和用户已确认答案评估 US2.4。

    EN: Yes compares declared months; No/Not sure returns facts only and does not infer seasonality.
    中文：Yes 比较用户声明月份；No/Not sure 只返回事实，不推断季节代表性。
    """

    pattern = build_income_pattern(profile)
    coverage = IncomeCoverage.objects.filter(profile=profile).first()
    answer = None
    slower_months: list[int] = []
    if coverage is not None:
        try:
            coverage.full_clean(validate_unique=False, validate_constraints=False)
        except ValidationError:
            logger.error(
                "Invalid persisted income coverage was treated as unknown for profile %s.",
                profile.public_id,
            )
        else:
            answer = coverage.answer
            slower_months = list(coverage.slower_months)
    recorded_calendar_months = sorted(
        {int(row["month"][5:7]) for row in pattern["months"]}
    )

    represented: list[int] = []
    unrepresented: list[int] = []
    observation = None
    if answer == IncomeCoverage.Answer.YES:
        represented = [month for month in slower_months if month in recorded_calendar_months]
        unrepresented = [month for month in slower_months if month not in recorded_calendar_months]
    elif answer in (IncomeCoverage.Answer.NO, IncomeCoverage.Answer.NOT_SURE):
        statistics_payload = pattern["statistics"]
        if statistics_payload is not None:
            observation = {
                "kind": "recorded_range",
                "recorded_month_count": pattern["recorded_month_count"],
                "lowest": statistics_payload["lowest"],
                "highest": statistics_payload["highest"],
                "range": statistics_payload["range"],
            }

    return {
        "answer": answer,
        "slower_months": slower_months,
        "represented_slower_months": represented,
        "unrepresented_slower_months": unrepresented,
        "recorded_calendar_months": recorded_calendar_months,
        "observation": observation,
    }


@transaction.atomic
def save_income_coverage(
    *,
    profile: GuestProfile,
    answer: str,
    slower_months: list[int],
) -> dict:
    """EN: Atomically validate and persist the server-confirmed US2.4 answer.
    中文：以原子事务校验并保存服务端确认的 US2.4 答案。
    """

    persisted_months = sorted(slower_months) if answer == IncomeCoverage.Answer.YES else []
    candidate = IncomeCoverage(
        profile=profile,
        answer=answer,
        slower_months=persisted_months,
    )
    candidate.full_clean(validate_unique=False, validate_constraints=False)
    IncomeCoverage.objects.update_or_create(
        profile=profile,
        defaults={
            "answer": answer,
            "slower_months": persisted_months,
        },
    )
    return build_income_coverage(profile)
