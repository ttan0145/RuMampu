from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True
    dependencies = [migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
    operations = [
        migrations.CreateModel(
            name='HousingScenario',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('property_price', models.DecimalField(decimal_places=2, max_digits=12)),
                ('deposit', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('financing_rate', models.DecimalField(decimal_places=3, max_digits=6)),
                ('tenure_years', models.PositiveIntegerField()),
                ('known_monthly_payment', models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='housing_scenarios', to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name='HousingCost',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('category', models.CharField(max_length=100)),
                ('amount', models.DecimalField(decimal_places=2, max_digits=12)),
                ('scenario', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='additional_costs', to='housing.housingscenario')),
            ],
        ),
        migrations.AddConstraint(
            model_name='housingcost',
            constraint=models.UniqueConstraint(fields=('scenario', 'category'), name='unique_scenario_housing_cost_category'),
        ),
    ]
