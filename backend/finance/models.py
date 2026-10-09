import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from .validators import validate_slower_months


class GuestProfile(models.Model):
    """EN: Anonymous ownership boundary shared by Epic 1 records and Epic 2 analysis.
    中文：Epic 1 财务记录与 Epic 2 分析共用的匿名数据所有权边界。
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="finance_profile",
        null=True,
        blank=True,
    )
    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    session_key = models.CharField(max_length=40, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_active_at = models.DateTimeField(auto_now=True)
    # Epic 8 retention safety: an account may only be removed after the
    # five-month warning has actually been sent.  A later visit clears this
    # marker because the record is active again.
    retention_warning_sent_at = models.DateTimeField(null=True, blank=True)

    def __str__(self) -> str:
        return str(self.public_id)


class IncomeSource(models.Model):
    """EN: Predefined or user-defined income source for US1.1.
    中文：US1.1 使用的预设或用户自定义收入来源。
    """

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
    """EN: One profile-owned month and its entry-vs-monthly-total recording basis (US1.1/US1.2).
    中文：归属单一 profile 的月份及其逐笔或月总额记录口径（US1.1/US1.2）。
    """

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
    """EN: Confirmed manual, historical-total, or imported income fact for US1.1/US1.2/US1.8.
    中文：US1.1/US1.2/US1.8 的已确认手工、历史月总额或导入收入事实。
    """

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
    """EN: A selectable work-cost category used by US1.3 dated records.
    中文：US1.3 带日期工作成本记录可选择的类别。

    ``monthly_amount`` is retained only to preserve legacy rows from the first
    implementation. New calculations deliberately do not read it: a legacy
    monthly value has no business date and must not be applied to every month.
    ``WorkCostEntry`` is the source of truth for work-cost amounts.
    """

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


class WorkCostEntry(models.Model):
    """EN: One confirmed, dated direct cost incurred while earning income.
    中文：为赚取收入发生的一笔已确认、带日期的直接工作成本。
    """

    profile = models.ForeignKey(
        GuestProfile,
        on_delete=models.CASCADE,
        related_name="work_cost_entries",
    )
    category = models.ForeignKey(
        WorkCostItem,
        on_delete=models.RESTRICT,
        related_name="work_cost_entries",
    )
    cost_date = models.DateField()
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    merchant = models.CharField(max_length=160, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-cost_date", "-id"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(amount__gt=0),
                name="work_cost_entry_amount_positive",
            )
        ]

    def __str__(self) -> str:
        return f"{self.cost_date}: {self.amount}"


class CommitmentItem(models.Model):
    """EN: Separate living, debt, and savings commitments for US1.4.
    中文：US1.4 分组记录的生活、债务与储蓄承诺。
    """

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
    """EN: Predefined or custom category shared by manual and receipt expenses (US1.5/US1.7).
    中文：手工与收据支出共用的预设或自定义类别（US1.5/US1.7）。
    """

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
    """EN: Confirmed dated expense fact displayed by US1.5-US1.7.
    中文：US1.5-US1.7 录入和展示的已确认带日期支出事实。
    """

    class EntryMethod(models.TextChoices):
        MANUAL = "manual", "Manual entry"
        RECEIPT = "receipt", "Receipt confirmed by user"
        MONTHLY_TOTAL = "monthly_total", "Whole-month expense total"

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
    """EN: US1.8 preview/confirmation boundary; preview rows are not income facts yet.
    中文：US1.8 的预览/确认边界；预览行尚未成为收入事实。
    """

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
    """EN: One recognised or rejected CSV row retained for US1.8 user review.
    中文：为 US1.8 用户复核保留的一条已识别或被拒绝 CSV 行。
    """

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
    """EN: Server-confirmed US2.4 answer and optional user-declared slower months.
    中文：服务端确认的 US2.4 答案及可选的用户声明慢月份。
    """

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


class UserAppState(models.Model):
    """Persistent account-level UI/domain inputs that do not belong to a monthly finance row."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="rumampu_app_state",
    )
    cash_on_hand = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    # The day the user reported cash_on_hand (AC5.2.10); null until they enter it.
    cash_on_hand_date = models.DateField(null=True, blank=True)
    upfront_costs = models.JSONField(default=list, blank=True)
    docs_checked = models.JSONField(default=list, blank=True)
    # Epic 5 reading progress belongs to the account, including on another device.
    learning_progress = models.JSONField(default=dict, blank=True)
    bought_home = models.BooleanField(default=False)
    # First calendar month that belongs to the post-purchase record.  Keeping
    # this separately from the Boolean lets Epic 7 exclude pre-purchase and
    # still-in-progress months without guessing from the data.
    homeownership_purchase_month = models.DateField(null=True, blank=True)
    expense_limits = models.JSONField(default=dict, blank=True)
    compare_payments = models.JSONField(default=list, blank=True)
    saving_plan = models.JSONField(default=dict, blank=True)
    buffer_state = models.JSONField(default=dict, blank=True)
    village_state = models.JSONField(default=dict, blank=True)
    plan_horizon = models.PositiveSmallIntegerField(null=True, blank=True)
    pot_moved_months = models.JSONField(default=list, blank=True)
    # The ringgit moved into the pot from those months. Kept beside the months so
    # a reload cannot drop the amount while the months stay marked as moved.
    pot_moved = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    kept_tests = models.JSONField(default=list, blank=True)
    onboarding_completed = models.BooleanField(default=False)
    preferred_language = models.CharField(max_length=5, blank=True, default="")
    preferred_income_source = models.ForeignKey(
        IncomeSource,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    last_record_exported_at = models.DateTimeField(null=True, blank=True)
    # Account-owned bill reminder choices live here. Device permission state and
    # notification scheduling identifiers stay in encrypted/local device storage.
    notification_preferences = models.JSONField(default=dict, blank=True)
    # One-time product guidance belongs to the account, not to a browser's
    # local storage, so logout/login and a second device do not look new again.
    experience_preferences = models.JSONField(default=dict, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"RuMampu state for {self.user_id}"


class HomeownershipMonth(models.Model):
    """One month of actual post-purchase home costs for Epic 7.

    Actual income stays sourced from the user's dated income/work-cost record;
    this model stores only the homeowner fact that is not represented elsewhere.
    """

    profile = models.ForeignKey(
        GuestProfile,
        on_delete=models.CASCADE,
        related_name="homeownership_months",
    )
    month = models.DateField()
    actual_home_costs = models.DecimalField(max_digits=12, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["month"]
        constraints = [
            models.UniqueConstraint(
                fields=["profile", "month"],
                name="unique_profile_homeownership_month",
            ),
            models.CheckConstraint(
                condition=models.Q(actual_home_costs__gte=0),
                name="homeownership_actual_costs_nonnegative",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.profile_id} · {self.month:%Y-%m}"
