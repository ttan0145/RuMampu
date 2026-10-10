from django.conf import settings
from django.db import models


class HousingScenario(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='housing_scenarios',
        null=True,
        blank=True,
    )
    profile = models.ForeignKey(
        'finance.GuestProfile',
        on_delete=models.CASCADE,
        related_name='housing_scenarios',
        null=True,
        blank=True,
    )
    property_price = models.DecimalField(max_digits=12, decimal_places=2)
    deposit = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    financing_rate = models.DecimalField(max_digits=6, decimal_places=3)
    tenure_years = models.PositiveIntegerField()
    known_monthly_payment = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(user__isnull=False, profile__isnull=True)
                    | models.Q(user__isnull=True, profile__isnull=False)
                ),
                name='housing_scenario_has_exactly_one_owner',
            )
        ]


class HousingCost(models.Model):
    scenario = models.ForeignKey(HousingScenario, on_delete=models.CASCADE, related_name='additional_costs')
    category = models.CharField(max_length=100)
    amount = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['scenario', 'category'], name='unique_scenario_housing_cost_category')
        ]

class SavedHousingTest(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='saved_housing_tests')
    scenario = models.ForeignKey(HousingScenario, on_delete=models.SET_NULL, null=True, blank=True, related_name='saved_tests')
    name = models.CharField(max_length=120, blank=True)
    monthly_payment = models.DecimalField(max_digits=12, decimal_places=2)
    short_month_count = models.PositiveIntegerField(default=0)
    tested_months = models.PositiveIntegerField(default=0)
    largest_gap = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    income_shock_percent = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    scenario_snapshot = models.JSONField(default=dict, blank=True)
    result_snapshot = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at', '-id']


# These models map to tables created by backend/data/schema.sql and
# backend/data/schema_transactions.sql. The SQL loaders own those tables;
# Django must not generate or apply migrations for them.
class State(models.Model):
    name = models.TextField(unique=True)

    class Meta:
        managed = False
        db_table = "state"

    def __str__(self):
        return self.name


class District(models.Model):
    name = models.TextField()
    state = models.ForeignKey(State, models.PROTECT, db_column="state_id")
    osm_relation_id = models.BigIntegerField(null=True, blank=True)
    centroid_lat = models.FloatField(null=True, blank=True)
    centroid_lng = models.FloatField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = "district"
        unique_together = (("name", "state"),)

    def __str__(self):
        return f"{self.name}, {self.state.name}"


class StateIncome(models.Model):
    state = models.OneToOneField(State, models.PROTECT, db_column="state_id",
                                 primary_key=True)
    year = models.IntegerField()
    income_mean = models.DecimalField(max_digits=12, decimal_places=2, null=True)
    income_median = models.DecimalField(max_digits=12, decimal_places=2, null=True)
    expenditure_mean = models.DecimalField(max_digits=12, decimal_places=2, null=True)
    gini = models.DecimalField(max_digits=5, decimal_places=3, null=True)
    poverty = models.DecimalField(max_digits=5, decimal_places=2, null=True)
    source = models.TextField(default="DOSM HIES")

    class Meta:
        managed = False
        db_table = "state_income"
        unique_together = (("state", "year"),)


class PriceAgg(models.Model):
    """Per district x type x quarter; medians are not additive."""
    district = models.ForeignKey(District, models.PROTECT, db_column="district_id")
    quarter = models.TextField()
    property_type = models.TextField()
    sales_count = models.IntegerField()
    total_value_rm = models.DecimalField(max_digits=16, decimal_places=2, null=True)
    mean_price_rm = models.DecimalField(max_digits=14, decimal_places=2, null=True)
    median_price_rm = models.DecimalField(max_digits=14, decimal_places=2, null=True)
    p25_price_rm = models.DecimalField(max_digits=14, decimal_places=2, null=True)
    p75_price_rm = models.DecimalField(max_digits=14, decimal_places=2, null=True)
    under_300k = models.IntegerField(null=True)
    under_500k = models.IntegerField(null=True)
    preliminary = models.BooleanField(default=False)
    source = models.TextField(default="NAPIC Open Transaction Data")
    loaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = "price_agg"
        unique_together = (("district", "quarter", "property_type"),)


class PropertyTransaction(models.Model):
    """One sale, used for percentile calculations over rolling windows."""
    district = models.ForeignKey(District, models.PROTECT, db_column="district_id")
    mukim = models.TextField(blank=True)
    scheme_area = models.TextField(blank=True)
    txn_date = models.DateField()
    quarter = models.TextField()
    property_type = models.TextField()
    tenure = models.TextField(blank=True)
    land_area = models.FloatField(null=True)
    floor_area = models.FloatField(null=True)
    price_rm = models.DecimalField(max_digits=14, decimal_places=2)

    class Meta:
        managed = False
        db_table = "property_transaction"
        indexes = [
            models.Index(fields=["district", "property_type", "quarter"]),
        ]


# ---- Price Explorer: the offline price model's precomputed results ----------
# The models (Bayesian trend + LightGBM ranges) run offline in ml/; only their
# outputs are loaded here by `manage.py load_price_model`, and the API serves
# them with plain queries. One version is active at a time.
class PriceModelVersion(models.Model):
    """One loaded run of the offline price model. Only one is active at a time."""
    version = models.CharField(max_length=40, unique=True)          # e.g. "pm-2026Q2-v3"
    is_active = models.BooleanField(default=False)
    meta = models.JSONField(default=dict, blank=True)               # window, accuracy, drivers, notes
    loaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['is_active'],
                condition=models.Q(is_active=True),
                name='unique_active_price_model',
            ),
        ]

    def __str__(self):
        return self.version


class PriceRangeCell(models.Model):
    """Price range per district x type x tenure x size band, today and 1-3 years on."""
    version = models.ForeignKey(PriceModelVersion, on_delete=models.CASCADE, related_name='cells')
    state_code = models.CharField(max_length=3)                     # 'SGR', 'KUL' …
    state = models.CharField(max_length=40)                         # 'Selangor', 'W.P. Kuala Lumpur'
    district = models.CharField(max_length=60)                      # NAPIC district name
    property_type = models.CharField(max_length=20)                 # terrace, condo, semi_detached …
    tenure = models.CharField(max_length=1)                         # F / L
    storeys = models.PositiveSmallIntegerField(default=0)
    size_band = models.CharField(max_length=8)                      # small / typical / large
    n_sales_2y = models.PositiveIntegerField()
    size_m2 = models.PositiveIntegerField()
    p10 = models.PositiveIntegerField()
    p50 = models.PositiveIntegerField()
    p90 = models.PositiveIntegerField()
    y1_p10 = models.PositiveIntegerField()
    y1_p50 = models.PositiveIntegerField()
    y1_p90 = models.PositiveIntegerField()
    y2_p10 = models.PositiveIntegerField()
    y2_p50 = models.PositiveIntegerField()
    y2_p90 = models.PositiveIntegerField()
    y3_p10 = models.PositiveIntegerField()
    y3_p50 = models.PositiveIntegerField()
    y3_p90 = models.PositiveIntegerField()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['version', 'district', 'property_type', 'tenure', 'size_band'],
                name='unique_price_cell',
            ),
            models.CheckConstraint(
                condition=models.Q(p10__gt=0, p10__lte=models.F('p50'), p50__lte=models.F('p90')),
                name='price_cell_today_ordered_positive',
            ),
            models.CheckConstraint(
                condition=models.Q(y1_p10__gt=0, y1_p10__lte=models.F('y1_p50'), y1_p50__lte=models.F('y1_p90')),
                name='price_cell_y1_ordered_positive',
            ),
            models.CheckConstraint(
                condition=models.Q(y2_p10__gt=0, y2_p10__lte=models.F('y2_p50'), y2_p50__lte=models.F('y2_p90')),
                name='price_cell_y2_ordered_positive',
            ),
            models.CheckConstraint(
                condition=models.Q(y3_p10__gt=0, y3_p10__lte=models.F('y3_p50'), y3_p50__lte=models.F('y3_p90')),
                name='price_cell_y3_ordered_positive',
            ),
        ]
        indexes = [models.Index(fields=['version', 'state_code', 'property_type'])]


class PriceScenario(models.Model):
    """State x type x years: what-if growth, chance of a fall, recent trend."""
    version = models.ForeignKey(PriceModelVersion, on_delete=models.CASCADE, related_name='scenarios')
    state_code = models.CharField(max_length=3)
    property_type = models.CharField(max_length=20)
    years = models.PositiveSmallIntegerField()                       # 1, 2, 3
    growth_low = models.FloatField()
    growth_mid = models.FloatField()
    growth_high = models.FloatField()
    prob_price_fall = models.FloatField()
    annual_trend = models.FloatField()
    annual_trend_p10 = models.FloatField()
    annual_trend_p90 = models.FloatField()
    sales_last4q = models.PositiveIntegerField()
    data_quality = models.CharField(max_length=5)                    # good / fair / thin

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['version', 'state_code', 'property_type', 'years'],
                name='unique_price_scenario',
            ),
            models.CheckConstraint(
                condition=models.Q(growth_low__lte=models.F('growth_mid'), growth_mid__lte=models.F('growth_high')),
                name='price_scenario_growth_ordered',
            ),
            models.CheckConstraint(
                condition=models.Q(
                    annual_trend_p10__lte=models.F('annual_trend'),
                    annual_trend__lte=models.F('annual_trend_p90'),
                ),
                name='price_scenario_trend_ordered',
            ),
            models.CheckConstraint(
                condition=models.Q(prob_price_fall__gte=0, prob_price_fall__lte=1),
                name='price_scenario_probability_valid',
            ),
        ]


class PriceIndexPoint(models.Model):
    """Price index per state (or 'ALL' = Malaysia) x type x quarter, 2021Q1 = 100."""
    version = models.ForeignKey(PriceModelVersion, on_delete=models.CASCADE, related_name='index_points')
    state_code = models.CharField(max_length=3)                     # 'ALL' = Malaysia
    property_type = models.CharField(max_length=20)                 # incl. 'all_types'
    quarter = models.CharField(max_length=6)                        # '2021Q1'
    index_value = models.FloatField()
    sales = models.PositiveIntegerField()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['version', 'state_code', 'property_type', 'quarter'],
                name='unique_price_index_point',
            ),
            models.CheckConstraint(condition=models.Q(index_value__gt=0), name='price_index_value_positive'),
        ]
        ordering = ['quarter']
