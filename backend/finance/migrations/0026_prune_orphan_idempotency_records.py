"""Remove replay responses left behind by deletions before owner cleanup existed."""

from django.conf import settings
from django.db import migrations
from uuid import UUID


def prune_orphan_replays(apps, schema_editor):
    User = apps.get_model(settings.AUTH_USER_MODEL)
    GuestProfile = apps.get_model("finance", "GuestProfile")
    IdempotencyRecord = apps.get_model("finance", "IdempotencyRecord")
    db = schema_editor.connection.alias

    for owner_key in IdempotencyRecord.objects.using(db).values_list("owner_key", flat=True).distinct().iterator():
        if owner_key.startswith("user:"):
            try:
                owner_exists = User.objects.using(db).filter(pk=owner_key[5:]).exists()
            except (TypeError, ValueError):
                owner_exists = False
        elif owner_key.startswith("profile:"):
            try:
                owner_exists = GuestProfile.objects.using(db).filter(public_id=UUID(owner_key[8:])).exists()
            except (TypeError, ValueError):
                owner_exists = False
        else:
            owner_exists = False
        if not owner_exists:
            IdempotencyRecord.objects.using(db).filter(owner_key=owner_key).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("finance", "0025_idempotency_records"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [migrations.RunPython(prune_orphan_replays, migrations.RunPython.noop)]
