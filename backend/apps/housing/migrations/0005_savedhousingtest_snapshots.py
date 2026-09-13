from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("housing", "0004_district_priceagg_propertytransaction_state_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="savedhousingtest",
            name="name",
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AddField(
            model_name="savedhousingtest",
            name="scenario_snapshot",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="savedhousingtest",
            name="result_snapshot",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="savedhousingtest",
            name="updated_at",
            field=models.DateTimeField(auto_now=True),
        ),
    ]
