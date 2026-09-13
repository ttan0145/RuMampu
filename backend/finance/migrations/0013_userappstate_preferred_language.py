from django.db import migrations, models


def backfill_existing_language(apps, schema_editor):
    UserAppState = apps.get_model("finance", "UserAppState")
    # Existing accounts predate account-language onboarding. Preserve their
    # current English default so they are not forced back through setup.
    UserAppState.objects.filter(preferred_language="").update(preferred_language="en")


def reverse_backfill(apps, schema_editor):
    UserAppState = apps.get_model("finance", "UserAppState")
    UserAppState.objects.update(preferred_language="")


class Migration(migrations.Migration):
    dependencies = [
        ("finance", "0012_userappstate_onboarding_completed"),
    ]

    operations = [
        migrations.AddField(
            model_name="userappstate",
            name="preferred_language",
            field=models.CharField(blank=True, default="", max_length=5),
        ),
        migrations.RunPython(backfill_existing_language, reverse_backfill),
    ]
