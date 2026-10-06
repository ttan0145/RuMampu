from django.db import migrations


def restore_notification_preferences(apps, schema_editor):
    """Repair databases migrated while the Iteration 3 migration was branched.

    On SQLite, applying two sibling migrations that both add fields to the same
    model can rebuild the table from one sibling's state and silently discard a
    field from the other.  Existing developer databases may therefore record
    the original migration as applied while the physical column is absent.
    """

    UserAppState = apps.get_model("finance", "UserAppState")
    table_name = UserAppState._meta.db_table
    with schema_editor.connection.cursor() as cursor:
        columns = {
            column.name
            for column in schema_editor.connection.introspection.get_table_description(
                cursor, table_name
            )
        }

    if "notification_preferences" not in columns:
        schema_editor.add_field(
            UserAppState,
            UserAppState._meta.get_field("notification_preferences"),
        )


class Migration(migrations.Migration):

    dependencies = [
        ("finance", "0020_iteration3_homeownership_retention_notifications"),
    ]

    operations = [
        migrations.RunPython(
            restore_notification_preferences,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
