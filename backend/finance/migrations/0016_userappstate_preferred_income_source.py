from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("finance", "0015_userappstate_buffer_state_userappstate_kept_tests_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="userappstate",
            name="preferred_income_source",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="+",
                to="finance.incomesource",
            ),
        ),
    ]
