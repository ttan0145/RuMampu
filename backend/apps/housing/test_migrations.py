from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase


class HousingOwnershipMigrationTests(TransactionTestCase):
    migrate_from = [
        ("finance", "0009_income_coverage"),
        ("housing", "0001_initial"),
    ]
    migrate_to = [
        ("finance", "0009_income_coverage"),
        ("housing", "0002_housingscenario_profile"),
    ]

    def setUp(self):
        super().setUp()
        executor = MigrationExecutor(connection)
        executor.migrate(self.migrate_from)
        old_apps = executor.loader.project_state(self.migrate_from).apps
        OldHousingScenario = old_apps.get_model("housing", "HousingScenario")
        self.scenario_id = OldHousingScenario.objects.create(
            user=None,
            property_price="300000.00",
            deposit="30000.00",
            financing_rate="4.250",
            tenure_years=30,
        ).id

        executor = MigrationExecutor(connection)
        executor.migrate(self.migrate_to)
        self.apps = executor.loader.project_state(self.migrate_to).apps

    def tearDown(self):
        executor = MigrationExecutor(connection)
        executor.migrate(executor.loader.graph.leaf_nodes())
        super().tearDown()

    def test_existing_anonymous_scenario_is_preserved_under_legacy_profile(self):
        HousingScenario = self.apps.get_model("housing", "HousingScenario")
        migrated = HousingScenario.objects.get(id=self.scenario_id)

        self.assertIsNone(migrated.user_id)
        self.assertIsNotNone(migrated.profile_id)
        self.assertEqual(
            migrated.profile.session_key,
            "legacy-housing-scenarios",
        )
