from __future__ import annotations

import calendar
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .analysis_service import build_work_cost_month_summary
from .models import GuestProfile, HomeownershipMonth
from .services import profile_for_request, touch_profile


class HomeownershipMonthSerializer(serializers.Serializer):
    month = serializers.RegexField(r"^\d{4}-(0[1-9]|1[0-2])$")
    recorded_income = serializers.DecimalField(max_digits=12, decimal_places=2)
    work_costs = serializers.DecimalField(max_digits=12, decimal_places=2)
    income_after_work_costs = serializers.DecimalField(max_digits=12, decimal_places=2, allow_null=True)
    actual_income = serializers.DecimalField(max_digits=12, decimal_places=2)
    actual_home_costs = serializers.DecimalField(max_digits=12, decimal_places=2)
    cash_position = serializers.DecimalField(max_digits=12, decimal_places=2, allow_null=True)
    short = serializers.BooleanField()
    is_complete = serializers.BooleanField()
    provenance = serializers.CharField()
    updated_at = serializers.DateTimeField()


class HomeownershipMonthListSerializer(serializers.Serializer):
    months = HomeownershipMonthSerializer(many=True)


class HomeownershipMonthWriteSerializer(serializers.Serializer):
    month = serializers.RegexField(r"^\d{4}-(0[1-9]|1[0-2])$")
    actual_home_costs = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0)


class RetentionStatusSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=("guest", "account"))
    last_use = serializers.DateField()
    warning_due = serializers.BooleanField()
    removal_date = serializers.DateField(allow_null=True)
    email_warning_sent = serializers.BooleanField()


def _month_start(raw: object) -> date | None:
    try:
        parsed = datetime.strptime(str(raw), "%Y-%m").date()
    except (TypeError, ValueError):
        return None
    return parsed.replace(day=1)


def _money(raw: object) -> Decimal | None:
    try:
        value = Decimal(str(raw))
    except (InvalidOperation, TypeError, ValueError):
        return None
    if not value.is_finite() or value < 0 or value.as_tuple().exponent < -2:
        return None
    return value


def _row(profile: GuestProfile, record: HomeownershipMonth) -> dict:
    summary = build_work_cost_month_summary(
        profile, year=record.month.year, month=record.month.month
    )
    gross = summary["gross_income"]
    work_costs = summary["work_cost_total"]
    income = summary["income_after_work_costs"]
    # No recorded income is materially different from RM0 income.  Position is
    # shown only from a factual income record; the serializer accepts null for
    # the breakdown, while the compatibility actual_income value remains zero.
    actual_income = income if income is not None else Decimal("0.00")
    position = income - record.actual_home_costs if income is not None else None
    today = timezone.localdate()
    current_month = today.replace(day=1)
    return {
        "month": record.month.strftime("%Y-%m"),
        "recorded_income": f"{gross:.2f}",
        "work_costs": f"{work_costs:.2f}",
        "income_after_work_costs": f"{income:.2f}" if income is not None else None,
        "actual_income": f"{actual_income:.2f}",
        "actual_home_costs": f"{record.actual_home_costs:.2f}",
        "cash_position": f"{position:.2f}" if position is not None else None,
        "short": position < 0 if position is not None else False,
        "is_complete": record.month < current_month,
        "provenance": "user_record",
        "updated_at": record.updated_at.isoformat(),
    }


class HomeownershipMonthListView(APIView):
    """Real post-purchase months, owned by the same guest/account boundary."""

    @extend_schema(
        operation_id="homeownership_months_list",
        tags=["Homeownership monitoring"],
        responses={200: HomeownershipMonthListSerializer},
    )
    def get(self, request):
        profile = profile_for_request(request)
        records = profile.homeownership_months.all()
        return Response({"months": [_row(profile, record) for record in records]})

    @extend_schema(
        operation_id="homeownership_month_upsert",
        tags=["Homeownership monitoring"],
        request=HomeownershipMonthWriteSerializer,
        responses={200: HomeownershipMonthSerializer},
    )
    def put(self, request):
        profile = profile_for_request(request)
        month = _month_start(request.data.get("month"))
        amount = _money(request.data.get("actual_home_costs"))
        if month is None:
            return Response(
                {"error": {"code": "invalid_month", "message": "Use a month in YYYY-MM format."}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if amount is None:
            return Response(
                {"error": {"code": "invalid_home_costs", "message": "Enter a non-negative amount with at most two decimal places."}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        record, _ = HomeownershipMonth.objects.update_or_create(
            profile=profile,
            month=month,
            defaults={"actual_home_costs": amount},
        )
        return Response(_row(profile, record))


def _add_months(value: date, months: int) -> date:
    index = value.year * 12 + value.month - 1 + months
    year, month0 = divmod(index, 12)
    day = min(value.day, calendar.monthrange(year, month0 + 1)[1])
    return date(year, month0 + 1, day)


class RetentionStatusView(APIView):
    """Return any due guest warning before this visit refreshes activity."""

    @extend_schema(
        operation_id="record_retention_status",
        tags=["Privacy and retention"],
        responses={200: RetentionStatusSerializer},
    )
    def get(self, request):
        profile = profile_for_request(request, touch=False)
        prior_last_use = timezone.localtime(profile.last_active_at).date()
        today = timezone.localdate()
        guest_warning_due = profile.user_id is None and today >= _add_months(prior_last_use, 4)
        removal_date = _add_months(prior_last_use, 6)
        warned = profile.retention_warning_sent_at is not None
        touch_profile(profile, force=True)
        return Response({
            "kind": "guest" if profile.user_id is None else "account",
            "last_use": prior_last_use.isoformat(),
            "warning_due": guest_warning_due,
            "removal_date": removal_date.isoformat() if guest_warning_due else None,
            "email_warning_sent": warned,
        })
