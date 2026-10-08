from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("finance", "0021_repair_notification_preferences")]

    operations = [
        migrations.AddField(
            model_name="userappstate",
            name="learning_progress",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
