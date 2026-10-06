from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("finance", "0018_iteration3_homeownership_retention_notifications"),
    ]

    operations = [
        migrations.AddField(
            model_name="userappstate",
            name="homeownership_purchase_month",
            field=models.DateField(blank=True, null=True),
        ),
    ]
