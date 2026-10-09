from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("finance", "0023_workcostentry_merchant")]

    operations = [
        migrations.AddField(
            model_name="userappstate",
            name="experience_preferences",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
