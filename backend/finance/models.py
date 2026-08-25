import uuid

from django.core.exceptions import ValidationError
from django.db import models

from .validators import validate_slower_months


class GuestProfile(models.Model):
    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    session_key = models.CharField(max_length=40, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_active_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return str(self.public_id)


class IncomeSource(models.Model):
    profile = models.ForeignKey(
        GuestProfile,
        on_delete=models.CASCADE,
        related_name="income_sources",
    )
    slug = models.SlugField(max_length=40, blank=True)
    name = models.CharField(max_length=120)
    is_custom = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]
        constraints = [
            models.UniqueConstraint(
                fields=["profile", "slug"],
                condition=~models.Q(slug=""),
                name="unique_profile_income_source_slug",
            )
        ]

    def __str__(self) -> str:
        return self.name


class FinancialPeriod(models.Model):
    class RecordBasis(models.TextChoices):
        ENTRY = "entry", "Individual entries"
        MONTHLY_TOTAL = "monthly_total", "Monthly total"

    profile = models.ForeignKey(
        GuestProfile,
        on_delete=models.CASCADE,
        related_name="financial_periods",
    )
    period_month = models.DateField()
    record_basis = models.CharField(
        max_length=20,
        choices=RecordBasis.choices,
        default=RecordBasis.ENTRY,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["period_month"]
        constraints = [
            models.UniqueConstraint(
                fields=["profile", "period_month"],
                name="unique_profile_financial_period",
            )
        ]

    def __str__(self) -> str:
        return self.period_month.strftime("%Y-%m")


class IncomeEntry(models.Model):
    class EntryMethod(models.TextChoices):
        MANUAL = "manual", "Manual entry"
        HISTORICAL_TOTAL = "historical_total", "Historical monthly total"
        IMPORT = "import", "Confirmed historical import"

    profile = models.ForeignKey(
        GuestProfile,
        on_delete=models.CASCADE,
        related_name="income_entries",
    )
    period = models.ForeignKey(
        FinancialPeriod,
        on_delete=models.CASCADE,
        related_name="income_entries",
    )
    source = models.ForeignKey(
        IncomeSource,
        on_delete=models.RESTRICT,
        related_name="income_entries",
        null=True,
        blank=True,
    )
    income_date = models.DateField()
    gross_amount = models.DecimalField(max_digits=12, decimal_places=2)
    entry_method = models.CharField(
        max_length=24,
        choices=EntryMethod.choices,
        default=EntryMethod.MANUAL,
    )
    user_confirmed = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["income_date", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["profile", "period"],
                condition=models.Q(entry_method="historical_total"),
                name="unique_historical_total_per_period",
            )
        ]

    def __str__(self) -> str:
        return f"{self.income_date}: {self.gross_amount}"


class WorkCostItem(models.Model):
    profile = models.ForeignKey(
        GuestProfile,
        on_delete=models.CASCADE,
        related_name="work_cost_items",
    )
    slug = models.SlugField(max_length=40, blank=True)
    name = models.CharField(max_length=120)
    monthly_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    is_custom = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["id"]
        constraints = [
            models.UniqueConstraint(
                fields=["profile", "slug"],
                condition=~models.Q(slug=""),
                name="unique_profile_work_cost_slug",
            )
        ]

    def __str__(self) -> str:
        return self.name


class CommitmentItem(models.Model):
    class CommitmentType(models.TextChoices):
        LIVING = "living", "Living cost"
        DEBT = "debt", "Debt payment"
        SAVINGS = "savings", "Savings"

    profile = models.ForeignKey(
        GuestProfile,
        on_delete=models.CASCADE,
        related_name="commitment_items",
    )
    commitment_type = models.CharField(max_length=12, choices=CommitmentType.choices)
    slug = models.SlugField(max_length=40)
    name = models.CharField(max_length=120)
    monthly_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    is_daily_variable = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["commitment_type", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["profile", "slug"],
                name="unique_profile_commitment_slug",
            )
        ]

    def __str__(self) -> str:
        return self.name


class ExpenseCategory(models.Model):
    profile = models.ForeignKey(
        GuestProfile,
        on_delete=models.CASCADE,
        related_name="expense_categories",
    )
    slug = models.SlugField(max_length=40, blank=True)
    name = models.CharField(max_length=120)
    is_custom = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]
        constraints = [
            models.UniqueConstraint(
                fields=["profile", "slug"],
                condition=~models.Q(slug=""),
                name="unique_profile_expense_category_slug",
            )
        ]

    def __str__(self) -> str:
        return self.name


class ExpenseEntry(models.Model):
    class EntryMethod(models.TextChoices):
        MANUAL = "manual", "Manual entry"
        RECEIPT = "receipt", "Receipt confirmed by user"

    profile = models.ForeignKey(
        GuestProfile,
        on_delete=models.CASCADE,
        related_name="expense_entries",
    )
    category = models.ForeignKey(
        ExpenseCategory,
        on_delete=models.RESTRICT,
        related_name="expense_entries",
    )
    expense_date = models.DateField()
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    merchant = models.CharField(max_length=160, blank=True)
    entry_method = models.CharField(
        max_length=24,
        choices=EntryMethod.choices,
        default=EntryMethod.MANUAL,
    )
    user_confirmed = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["expense_date", "id"]

    def __str__(self) -> str:
        return f"{self.expense_date}: {self.amount}"


class IncomeImportBatch(models.Model):
    class Status(models.TextChoices):
        PREVIEW = "preview", "Awaiting confirmation"
        CONFIRMED = "confirmed", "Confirmed"

    profile = models.ForeignKey(
        GuestProfile,
        on_delete=models.CASCADE,
        related_name="income_import_batches",
    )
    file_name = models.CharField(max_length=255)
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.PREVIEW,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self) -> str:
        return self.file_name


class IncomeImportRow(models.Model):
    batch = models.ForeignKey(
        IncomeImportBatch,
        on_delete=models.CASCADE,
        related_name="rows",
    )
    row_number = models.PositiveIntegerField()
    raw_amount = models.CharField(max_length=64, blank=True)
    raw_date = models.CharField(max_length=32, blank=True)
    raw_source = models.CharField(max_length=160, blank=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    income_date = models.DateField(null=True, blank=True)
    source_name = models.CharField(max_length=120, blank=True)
    error_code = models.CharField(max_length=160, blank=True)
    error_message = models.CharField(max_length=500, blank=True)
    imported_entry = models.ForeignKey(
        IncomeEntry,
        on_delete=models.SET_NULL,
        related_name="import_rows",
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["row_number", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["batch", "row_number"],
                name="unique_income_import_batch_row",
            )
        ]

    @property
    def is_valid(self) -> bool:
        return not self.error_code

    def __str__(self) -> str:
        return f"{self.batch.file_name}:{self.row_number}"


class IncomeCoverage(models.Model):
    class Answer(models.TextChoices):
        YES = "yes", "Yes"
        NO = "no", "No"
        NOT_SURE = "not_sure", "Not sure"

    profile = models.OneToOneField(
        GuestProfile,
        on_delete=models.CASCADE,
        related_name="income_coverage",
    )
    answer = models.CharField(
        max_length=12,
        choices=Answer.choices,
    )
    slower_months = models.JSONField(
        default=list,
        blank=True,
        validators=[validate_slower_months],
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(answer__in=("yes", "no", "not_sure")),
                name="valid_income_coverage_answer",
            )
        ]

    def clean(self) -> None:
        super().clean()
        if self.answer == self.Answer.YES and not self.slower_months:
            raise ValidationError(
                {"slower_months": "Select at least one usually slower month."}
            )
        if self.answer in (self.Answer.NO, self.Answer.NOT_SURE) and self.slower_months:
            raise ValidationError(
                {"slower_months": "No and Not sure answers cannot store slower months."}
            )

    def __str__(self) -> str:
        return f"{self.profile.public_id}: {self.answer}"
