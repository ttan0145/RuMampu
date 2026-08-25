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
    property_price = models.DecimalField(max_digits=12, decimal_places=2)
    deposit = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    financing_rate = models.DecimalField(max_digits=6, decimal_places=3)
    tenure_years = models.PositiveIntegerField()
    known_monthly_payment = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class HousingCost(models.Model):
    scenario = models.ForeignKey(HousingScenario, on_delete=models.CASCADE, related_name='additional_costs')
    category = models.CharField(max_length=100)
    amount = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['scenario', 'category'], name='unique_scenario_housing_cost_category')
        ]
