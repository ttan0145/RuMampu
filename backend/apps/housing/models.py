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
    monthly_payment = models.DecimalField(max_digits=12, decimal_places=2)
    short_month_count = models.PositiveIntegerField(default=0)
    tested_months = models.PositiveIntegerField(default=0)
    largest_gap = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    income_shock_percent = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

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
