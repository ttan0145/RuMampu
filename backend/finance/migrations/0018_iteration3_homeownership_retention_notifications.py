from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        # Keep UserAppState schema changes linear.  Branching from 0017 here
        # allowed SQLite's table rebuild for 0018/0019 to discard this
        # migration's notification_preferences column.
        ("finance", "0019_userappstate_pot_moved"),
    ]

    operations = [
        migrations.AddField(
            model_name="guestprofile",
            name="retention_warning_sent_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="userappstate",
            name="notification_preferences",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.CreateModel(
            name="HomeownershipMonth",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("month", models.DateField()),
                ("actual_home_costs", models.DecimalField(decimal_places=2, max_digits=12)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "profile",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="homeownership_months",
                        to="finance.guestprofile",
                    ),
                ),
            ],
            options={"ordering": ["month"]},
        ),
        migrations.AddConstraint(
            model_name="homeownershipmonth",
            constraint=models.UniqueConstraint(
                fields=("profile", "month"),
                name="unique_profile_homeownership_month",
            ),
        ),
        migrations.AddConstraint(
            model_name="homeownershipmonth",
            constraint=models.CheckConstraint(
                condition=models.Q(actual_home_costs__gte=0),
                name="homeownership_actual_costs_nonnegative",
            ),
        ),
    ]
