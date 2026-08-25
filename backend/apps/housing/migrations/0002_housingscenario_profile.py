from django.db import migrations, models
import django.db.models.deletion


LEGACY_SESSION_KEY = "legacy-housing-scenarios"


def assign_legacy_scenarios(apps, schema_editor):
    GuestProfile = apps.get_model("finance", "GuestProfile")
    HousingScenario = apps.get_model("housing", "HousingScenario")
    orphaned = HousingScenario.objects.filter(user__isnull=True, profile__isnull=True)
    if not orphaned.exists():
        return
    legacy_profile, _ = GuestProfile.objects.get_or_create(
        session_key=LEGACY_SESSION_KEY,
    )
    orphaned.update(profile=legacy_profile)


def unassign_legacy_scenarios(apps, schema_editor):
    GuestProfile = apps.get_model("finance", "GuestProfile")
    HousingScenario = apps.get_model("housing", "HousingScenario")
    legacy_profile = GuestProfile.objects.filter(session_key=LEGACY_SESSION_KEY).first()
    if legacy_profile is None:
        return
    HousingScenario.objects.filter(profile=legacy_profile).update(profile=None)
    if not HousingScenario.objects.filter(profile=legacy_profile).exists():
        legacy_profile.delete()


class Migration(migrations.Migration):
    dependencies = [
        ("finance", "0009_income_coverage"),
        ("housing", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="housingscenario",
            name="profile",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="housing_scenarios",
                to="finance.guestprofile",
            ),
        ),
        migrations.RunPython(assign_legacy_scenarios, unassign_legacy_scenarios),
        migrations.AddConstraint(
            model_name="housingscenario",
            constraint=models.CheckConstraint(
                condition=(
                    models.Q(("profile__isnull", True), ("user__isnull", False))
                    | models.Q(("profile__isnull", False), ("user__isnull", True))
                ),
                name="housing_scenario_has_exactly_one_owner",
            ),
        ),
    ]
