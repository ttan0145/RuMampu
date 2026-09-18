from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("finance", "0016_userappstate_preferred_income_source")]

    operations = [
        migrations.AlterField(
            model_name="expenseentry",
            name="entry_method",
            field=models.CharField(
                choices=[
                    ("manual", "Manual entry"),
                    ("receipt", "Receipt confirmed by user"),
                    ("monthly_total", "Whole-month expense total"),
                ],
                default="manual",
                max_length=24,
            ),
        ),
    ]
