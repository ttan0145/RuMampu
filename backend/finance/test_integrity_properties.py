"""Property checks around completed versus still-in-progress history."""

from datetime import date
from decimal import Decimal
from unittest.mock import patch
import uuid

from hypothesis import given, settings, strategies as st
from hypothesis.extra.django import TestCase

from .analysis_service import build_income_pattern
from .models import FinancialPeriod, GuestProfile, IncomeEntry
from .services import ensure_default_sources


class IncomeHistoryIntegrityProperties(TestCase):
    @settings(max_examples=200, deadline=None)
    @given(
        completed=st.lists(
            st.integers(min_value=0, max_value=999_999_999),
            min_size=1,
            max_size=9,
        ),
        unfinished=st.integers(min_value=0, max_value=999_999_999),
    )
    def test_unfinished_month_never_changes_history_statistics(self, completed, unfinished):
        profile = GuestProfile.objects.create(session_key=uuid.uuid4().hex)
        ensure_default_sources(profile)
        source = profile.income_sources.get(slug="ehail")

        for index, cents in enumerate(completed, start=1):
            period = FinancialPeriod.objects.create(
                profile=profile,
                period_month=date(2026, index, 1),
            )
            IncomeEntry.objects.create(
                profile=profile,
                period=period,
                source=source,
                income_date=date(2026, index, 1),
                gross_amount=Decimal(cents) / Decimal("100"),
            )

        current_period = FinancialPeriod.objects.create(
            profile=profile,
            period_month=date(2026, 10, 1),
        )
        IncomeEntry.objects.create(
            profile=profile,
            period=current_period,
            source=source,
            income_date=date(2026, 10, 10),
            gross_amount=Decimal(unfinished) / Decimal("100"),
        )

        with patch("finance.analysis_service.timezone.localdate", return_value=date(2026, 10, 10)):
            with_current = build_income_pattern(profile)
        current_period.delete()
        with patch("finance.analysis_service.timezone.localdate", return_value=date(2026, 10, 10)):
            without_current = build_income_pattern(profile)

        assert with_current["statistics"] == without_current["statistics"]
        assert with_current["completed_months"] == without_current["completed_months"]
        assert with_current["recorded_month_count"] == len(completed)
        assert with_current["current_month_so_far"] is not None
