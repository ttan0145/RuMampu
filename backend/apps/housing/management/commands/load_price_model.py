import csv
import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.housing.models import PriceIndexPoint, PriceModelVersion, PriceRangeCell, PriceScenario


def _int(v):
    return int(round(float(v)))


class Command(BaseCommand):
    help = "Load the offline price model export (ml/app_export) into the database."

    def add_arguments(self, parser):
        parser.add_argument('folder', help='path to app_export/')
        parser.add_argument('--activate', action='store_true', help='make this version the one the API serves')

    @transaction.atomic
    def handle(self, folder, activate, **options):
        d = Path(folder)
        if not (d / 'model_meta.json').is_file():
            raise CommandError(f"{d} has no model_meta.json; point this at the app_export/ folder")

        def rows(name):
            with open(d / name, encoding='utf-8', newline='') as fh:
                return list(csv.DictReader(fh))

        with open(d / 'model_meta.json', encoding='utf-8') as fh:
            meta = json.load(fh)
        meta['accuracy'] = {r['property_type']: {k: float(r[k]) for k in
                            ('median_APE', 'within_10pct', 'within_20pct', 'coverage80')} for r in rows('price_accuracy.csv')}
        meta['drivers'] = [{'feature': r['feature'], 'description': r['description'], 'band': r['band'],
                            'reference': r['reference'], 'effect_pct': float(r['effect_pct'])} for r in rows('price_driver.csv')]

        version, _ = PriceModelVersion.objects.update_or_create(version=meta['model_version'], defaults={'meta': meta})
        version.cells.all().delete()
        version.scenarios.all().delete()
        version.index_points.all().delete()

        p = ('p10', 'p50', 'p90', 'y1_p10', 'y1_p50', 'y1_p90', 'y2_p10', 'y2_p50', 'y2_p90', 'y3_p10', 'y3_p50', 'y3_p90')
        PriceRangeCell.objects.bulk_create([PriceRangeCell(
            version=version, state_code=r['state_code'], state=r['state'], district=r['district'],
            property_type=r['property_type'], tenure=r['tenure'], storeys=_int(r['storeys']), size_band=r['size_band'],
            n_sales_2y=_int(r['n_sales_2y']), size_m2=_int(r['size_m2']), **{k: _int(r[k]) for k in p},
        ) for r in rows('price_range_cell.csv')], batch_size=1000)

        f = ('growth_low', 'growth_mid', 'growth_high', 'prob_price_fall', 'annual_trend', 'annual_trend_p10', 'annual_trend_p90')
        PriceScenario.objects.bulk_create([PriceScenario(
            version=version, state_code=r['state_code'], property_type=r['property_type'], years=_int(r['years']),
            sales_last4q=_int(r['sales_last4q']), data_quality=r['data_quality'], **{k: float(r[k]) for k in f},
        ) for r in rows('price_scenario.csv')], batch_size=1000)

        PriceIndexPoint.objects.bulk_create([PriceIndexPoint(
            version=version, state_code=r['state_code'], property_type=r['property_type'], quarter=r['quarter'],
            index_value=float(r['index_value']), sales=_int(r['sales']),
        ) for r in rows('price_index_point.csv')], batch_size=2000)

        if activate:
            PriceModelVersion.objects.exclude(pk=version.pk).update(is_active=False)
            version.is_active = True
            version.save(update_fields=['is_active'])
        self.stdout.write(self.style.SUCCESS(
            f"{version.version}: {version.cells.count()} cells, {version.scenarios.count()} scenarios, "
            f"{version.index_points.count()} index points{' (active)' if version.is_active else ''}"))
