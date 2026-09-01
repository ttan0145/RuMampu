from decimal import Decimal

from django.utils import timezone
from rest_framework import serializers

from .models import (
    CommitmentItem,
    ExpenseCategory,
    ExpenseEntry,
    FinancialPeriod,
    IncomeEntry,
    IncomeImportBatch,
    IncomeImportRow,
    IncomeCoverage,
    IncomeSource,
    WorkCostItem,
)


def money_output_field() -> serializers.DecimalField:
    """Derived totals can exceed the max_digits limit of a single stored entry."""
    return serializers.DecimalField(
        max_digits=None,
        decimal_places=2,
        coerce_to_string=True,
    )


class ApiErrorBodySerializer(serializers.Serializer):
    code = serializers.CharField()
    message = serializers.CharField()
    fields = serializers.JSONField(required=False)
    context = serializers.JSONField(required=False)


class ApiErrorSerializer(serializers.Serializer):
    error = ApiErrorBodySerializer()


class IncomePatternMonthSerializer(serializers.Serializer):
    month = serializers.RegexField(r"^\d{4}-(0[1-9]|1[0-2])$")
    gross_income = money_output_field()
    work_costs = money_output_field()
    usable_income = money_output_field()
    is_lowest_recorded = serializers.BooleanField()


class IncomePatternStatisticsSerializer(serializers.Serializer):
    average = money_output_field()
    median = money_output_field()
    highest = money_output_field()
    lowest = money_output_field()
    range = money_output_field()
    standard_deviation = money_output_field()


class LowerIncomeSerializer(serializers.Serializer):
    basis = serializers.ChoiceField(choices=("recorded_minimum",))
    months = serializers.ListField(child=serializers.CharField())


class IncomePatternResponseSerializer(serializers.Serializer):
    recorded_month_count = serializers.IntegerField(min_value=0)
    history_depth = serializers.ChoiceField(
        choices=("empty", "one_month", "two_months", "three_or_more")
    )
    provenance = serializers.ChoiceField(choices=("calculated_from_user_record",))
    monthly_work_cost_total = money_output_field()
    work_cost_basis = serializers.ChoiceField(
        choices=("current_active_monthly_snapshot",)
    )
    months = IncomePatternMonthSerializer(many=True)
    statistics = IncomePatternStatisticsSerializer(allow_null=True)
    lower_income = LowerIncomeSerializer()


class IncomeCoverageObservationSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=("recorded_range",))
    recorded_month_count = serializers.IntegerField(min_value=1)
    lowest = money_output_field()
    highest = money_output_field()
    range = money_output_field()


class IncomeCoverageResponseSerializer(serializers.Serializer):
    answer = serializers.ChoiceField(choices=IncomeCoverage.Answer.choices, allow_null=True)
    slower_months = serializers.ListField(child=serializers.IntegerField(min_value=1, max_value=12))
    represented_slower_months = serializers.ListField(
        child=serializers.IntegerField(min_value=1, max_value=12)
    )
    unrepresented_slower_months = serializers.ListField(
        child=serializers.IntegerField(min_value=1, max_value=12)
    )
    recorded_calendar_months = serializers.ListField(
        child=serializers.IntegerField(min_value=1, max_value=12)
    )
    observation = IncomeCoverageObservationSerializer(allow_null=True)


class IncomeCoverageUpdateSerializer(serializers.Serializer):
    answer = serializers.ChoiceField(choices=IncomeCoverage.Answer.choices)
    slower_months = serializers.ListField(
        child=serializers.IntegerField(min_value=1, max_value=12),
        default=list,
    )

    def validate(self, attrs):
        months = attrs["slower_months"]
        if len(months) != len(set(months)):
            raise serializers.ValidationError(
                {"slower_months": "Each slower month can be selected only once."}
            )
        if attrs["answer"] == IncomeCoverage.Answer.YES and not months:
            raise serializers.ValidationError(
                {"slower_months": "Select at least one usually slower month."}
            )
        attrs["slower_months"] = sorted(months) if attrs["answer"] == "yes" else []
        return attrs


class IncomeSourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = IncomeSource
        fields = ["id", "slug", "name", "is_custom", "is_active"]


class IncomeSourceCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120, trim_whitespace=True)

    def validate_name(self, value: str) -> str:
        value = " ".join(value.split())
        if not value:
            raise serializers.ValidationError("Source name is required.")
        profile = self.context["profile"]
        if profile.income_sources.filter(name__iexact=value, is_active=True).exists():
            raise serializers.ValidationError("This income source already exists.")
        return value


class IncomeEntrySerializer(serializers.ModelSerializer):
    amount = serializers.DecimalField(
        source="gross_amount",
        max_digits=12,
        decimal_places=2,
        coerce_to_string=True,
    )
    date = serializers.DateField(source="income_date")
    source_id = serializers.IntegerField(allow_null=True)
    entry_method = serializers.CharField(read_only=True)

    class Meta:
        model = IncomeEntry
        fields = ["id", "amount", "date", "source_id", "entry_method", "created_at"]


class IncomeRecordSerializer(serializers.Serializer):
    profile_id = serializers.UUIDField()
    recorded_month_count = serializers.IntegerField(min_value=0)
    sources = IncomeSourceSerializer(many=True)
    entries = IncomeEntrySerializer(many=True)


class IncomeEntryCreateSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    date = serializers.DateField()
    source_id = serializers.IntegerField(min_value=1, required=False, allow_null=True)
    entry_method = serializers.ChoiceField(
        choices=(
            IncomeEntry.EntryMethod.MANUAL,
            IncomeEntry.EntryMethod.HISTORICAL_TOTAL,
        ),
        default=IncomeEntry.EntryMethod.MANUAL,
    )
    confirm_outlier = serializers.BooleanField(default=False)

    def validate_amount(self, value: Decimal) -> Decimal:
        # EN: AC1.1.9 rejects non-positive income at the API boundary as well as in the UI.
        # 中文：AC1.1.9 在 API 边界和界面两层都拒绝非正收入。
        if value <= 0:
            raise serializers.ValidationError("Income amount must be greater than zero.")
        return value

    def validate_source_id(self, value: int | None) -> int | None:
        if value is None:
            return value
        profile = self.context["profile"]
        if not profile.income_sources.filter(id=value, is_active=True).exists():
            raise serializers.ValidationError("Income source was not found for this profile.")
        return value

    def validate(self, attrs):
        profile = self.context["profile"]
        entry_method = attrs["entry_method"]
        period_month = attrs["date"].replace(day=1)

        if entry_method == IncomeEntry.EntryMethod.MANUAL:
            if not attrs.get("source_id"):
                raise serializers.ValidationError(
                    {"source_id": "An income source is required for a manual entry."}
                )
            if profile.financial_periods.filter(
                period_month=period_month,
                record_basis=FinancialPeriod.RecordBasis.MONTHLY_TOTAL,
            ).exists():
                raise serializers.ValidationError(
                    {"date": "This month is already represented by a historical monthly total."}
                )
            return attrs

        current_month = timezone.localdate().replace(day=1)
        if period_month >= current_month:
            raise serializers.ValidationError(
                {"date": "A historical monthly total must be for an earlier month."}
            )
        if profile.income_entries.filter(period__period_month=period_month).exists():
            raise serializers.ValidationError(
                {"date": "This month already contains income records."}
            )
        attrs["source_id"] = None
        return attrs


class WorkCostItemSerializer(serializers.ModelSerializer):
    monthly_amount = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        coerce_to_string=True,
    )

    class Meta:
        model = WorkCostItem
        fields = [
            "id",
            "slug",
            "name",
            "monthly_amount",
            "is_custom",
            "is_active",
            "updated_at",
        ]


class WorkCostItemCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120, trim_whitespace=True)
    monthly_amount = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal("0"),
        default=Decimal("0"),
    )

    def validate_name(self, value: str) -> str:
        value = " ".join(value.split())
        if not value:
            raise serializers.ValidationError("Work-cost name is required.")
        profile = self.context["profile"]
        if profile.work_cost_items.filter(name__iexact=value, is_active=True).exists():
            raise serializers.ValidationError("This work-cost item already exists.")
        return value


class WorkCostItemUpdateSerializer(serializers.Serializer):
    monthly_amount = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal("0"),
    )


class CommitmentItemSerializer(serializers.ModelSerializer):
    monthly_amount = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        coerce_to_string=True,
    )

    class Meta:
        model = CommitmentItem
        fields = [
            "id",
            "commitment_type",
            "slug",
            "name",
            "monthly_amount",
            "is_daily_variable",
            "is_active",
            "updated_at",
        ]


class CommitmentItemUpdateSerializer(serializers.Serializer):
    monthly_amount = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal("0"),
    )


class ExpenseCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseCategory
        fields = ["id", "slug", "name", "is_custom", "is_active"]


class ExpenseCategoryCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120, trim_whitespace=True)

    def validate_name(self, value: str) -> str:
        value = " ".join(value.split())
        if not value:
            raise serializers.ValidationError("Category name is required.")
        profile = self.context["profile"]
        if profile.expense_categories.filter(name__iexact=value, is_active=True).exists():
            raise serializers.ValidationError("This expense category already exists.")
        return value


class ExpenseEntrySerializer(serializers.ModelSerializer):
    date = serializers.DateField(source="expense_date")
    category_id = serializers.IntegerField()
    entry_method = serializers.CharField(read_only=True)
    amount = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        coerce_to_string=True,
    )

    class Meta:
        model = ExpenseEntry
        fields = [
            "id",
            "amount",
            "date",
            "category_id",
            "entry_method",
            "merchant",
            "user_confirmed",
            "created_at",
        ]


class ExpenseEntryCreateSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    date = serializers.DateField()
    category_id = serializers.IntegerField(min_value=1)
    entry_method = serializers.ChoiceField(
        choices=ExpenseEntry.EntryMethod.choices,
        default=ExpenseEntry.EntryMethod.MANUAL,
    )
    merchant = serializers.CharField(
        max_length=160,
        trim_whitespace=True,
        allow_blank=True,
        default="",
    )
    confirm_receipt = serializers.BooleanField(default=False, write_only=True)

    def validate_amount(self, value: Decimal) -> Decimal:
        if value <= 0:
            raise serializers.ValidationError("Expense amount must be greater than zero.")
        return value

    def validate_category_id(self, value: int) -> int:
        profile = self.context["profile"]
        if not profile.expense_categories.filter(id=value, is_active=True).exists():
            raise serializers.ValidationError(
                "Expense category was not found for this profile."
            )
        return value

    def validate(self, attrs):
        if (
            attrs["entry_method"] == ExpenseEntry.EntryMethod.RECEIPT
            and not attrs["confirm_receipt"]
        ):
            raise serializers.ValidationError(
                {"confirm_receipt": "Review and confirm receipt values before saving."}
            )
        if attrs["entry_method"] == ExpenseEntry.EntryMethod.MANUAL:
            attrs["merchant"] = ""
        return attrs


class IncomeImportUploadSerializer(serializers.Serializer):
    file = serializers.FileField()


class IncomeImportRowSerializer(serializers.ModelSerializer):
    # Explicit bounds prevent drf-spectacular from changing this schema
    # between SQLite (int64 inference) and PostgreSQL (int32 inference).
    row_number = serializers.IntegerField(min_value=0, max_value=2147483647)
    date = serializers.DateField(source="income_date", allow_null=True)
    is_valid = serializers.BooleanField(read_only=True)
    imported_entry_id = serializers.IntegerField(allow_null=True, read_only=True)
    amount = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        coerce_to_string=True,
        allow_null=True,
    )

    class Meta:
        model = IncomeImportRow
        fields = [
            "id",
            "row_number",
            "raw_amount",
            "raw_date",
            "raw_source",
            "amount",
            "date",
            "source_name",
            "is_valid",
            "error_code",
            "error_message",
            "imported_entry_id",
        ]


class IncomeImportBatchSerializer(serializers.ModelSerializer):
    rows = IncomeImportRowSerializer(many=True, read_only=True)
    total_rows = serializers.SerializerMethodField()
    ready_count = serializers.SerializerMethodField()
    error_count = serializers.SerializerMethodField()
    imported_count = serializers.SerializerMethodField()

    class Meta:
        model = IncomeImportBatch
        fields = [
            "id",
            "file_name",
            "status",
            "total_rows",
            "ready_count",
            "error_count",
            "imported_count",
            "created_at",
            "confirmed_at",
            "rows",
        ]

    def get_total_rows(self, obj) -> int:
        return obj.rows.count()

    def get_ready_count(self, obj) -> int:
        return obj.rows.filter(error_code="").count()

    def get_error_count(self, obj) -> int:
        return obj.rows.exclude(error_code="").count()

    def get_imported_count(self, obj) -> int:
        return obj.rows.filter(imported_entry__isnull=False).count()
