from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("finance", "0013_userappstate_preferred_language"),
    ]

    operations = [
        migrations.AddField(
            model_name="userappstate",
            name="last_record_exported_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
