import csv
import json
import math
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.housing.models import PriceIndexPoint, PriceModelVersion, PriceRangeCell, PriceScenario


def _int(v):
    number = float(v)
    if not math.isfinite(number):
        raise ValueError(f"{v!r} is not finite")
    # Model calculations are floating point and can emit values such as
    # 519879.99999999994 for an integer-valued price.
    return int(round(number))


def _float(row, field, filename):
    try:
        value = float(row[field])
    except (KeyError, TypeError, ValueError) as exc:
        raise CommandError(f"{filename}: invalid {field!r} value") from exc
    if not math.isfinite(value):
        raise CommandError(f"{filename}: {field} must be finite")
    return value


def _validate_version(rows, filename, version):
    mismatches = [i for i, row in enumerate(rows, start=2) if row.get('model_version') != version]
    if mismatches:
        raise CommandError(f"{filename}: model_version differs from {version!r} on row {mismatches[0]}")


def _validate_export(meta, datasets):
    version = meta.get('model_version')
    if not isinstance(version, str) or not version.strip():
        raise CommandError("model_meta.json: model_version is required")

    expected = meta.get('expected_counts')
    count_files = {
        'price_range_cell': 'price_range_cell.csv',
        'price_scenario': 'price_scenario.csv',
        'price_index_point': 'price_index_point.csv',
    }
    if not isinstance(expected, dict):
        raise CommandError("model_meta.json: expected_counts is required")
    for key, filename in count_files.items():
        try:
            raw_wanted = float(expected[key])
            if not math.isfinite(raw_wanted) or not raw_wanted.is_integer():
                raise ValueError
            wanted = int(raw_wanted)
        except (KeyError, TypeError, ValueError) as exc:
            raise CommandError(f"model_meta.json: expected_counts.{key} must be an integer") from exc
        actual = len(datasets[filename])
        if actual != wanted:
            raise CommandError(f"{filename}: expected {wanted} rows, found {actual}")

    for filename, rows in datasets.items():
        _validate_version(rows, filename, version)

    ranges = (('p10', 'p50', 'p90'), ('y1_p10', 'y1_p50', 'y1_p90'),
              ('y2_p10', 'y2_p50', 'y2_p90'), ('y3_p10', 'y3_p50', 'y3_p90'))
    for line, row in enumerate(datasets['price_range_cell.csv'], start=2):
        for low, middle, high in ranges:
            values = [_float(row, field, 'price_range_cell.csv') for field in (low, middle, high)]
            if values[0] <= 0 or not values[0] <= values[1] <= values[2]:
                raise CommandError(
                    f"price_range_cell.csv row {line}: {low} <= {middle} <= {high} must be positive and ordered"
                )

    for line, row in enumerate(datasets['price_scenario.csv'], start=2):
        growth = [_float(row, field, 'price_scenario.csv')
                  for field in ('growth_low', 'growth_mid', 'growth_high')]
        trend = [_float(row, field, 'price_scenario.csv')
                 for field in ('annual_trend_p10', 'annual_trend', 'annual_trend_p90')]
        probability = _float(row, 'prob_price_fall', 'price_scenario.csv')
        if not growth[0] <= growth[1] <= growth[2]:
            raise CommandError(f"price_scenario.csv row {line}: growth range is not ordered")
        if not trend[0] <= trend[1] <= trend[2]:
            raise CommandError(f"price_scenario.csv row {line}: trend range is not ordered")
        if not 0 <= probability <= 1:
            raise CommandError(f"price_scenario.csv row {line}: prob_price_fall must be between 0 and 1")

    for line, row in enumerate(datasets['price_index_point.csv'], start=2):
        if _float(row, 'index_value', 'price_index_point.csv') <= 0:
            raise CommandError(f"price_index_point.csv row {line}: index_value must be positive")


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

        filenames = ('price_range_cell.csv', 'price_scenario.csv', 'price_index_point.csv',
                     'price_accuracy.csv', 'price_driver.csv')
        datasets = {}
        try:
            with open(d / 'model_meta.json', encoding='utf-8') as fh:
                meta = json.load(fh)
            for name in filenames:
                with open(d / name, encoding='utf-8', newline='') as fh:
                    datasets[name] = list(csv.DictReader(fh))
        except (OSError, json.JSONDecodeError) as exc:
            raise CommandError(f"Cannot read price model export: {exc}") from exc

        _validate_export(meta, datasets)
        rows = datasets.__getitem__
        meta['accuracy'] = {r['property_type']: {k: float(r[k]) for k in
                            ('median_APE', 'within_10pct', 'within_20pct', 'coverage80')} for r in rows('price_accuracy.csv')}
        meta['drivers'] = [{'feature': r['feature'], 'description': r['description'], 'band': r['band'],
                            'reference': r['reference'], 'effect_pct': float(r['effect_pct'])} for r in rows('price_driver.csv')]

        # Serialize activation against existing versions; the database constraint
        # remains the final guard if two loaders race while creating new versions.
        list(PriceModelVersion.objects.select_for_update().values_list('pk', flat=True))
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
            if PriceModelVersion.objects.filter(is_active=True).count() != 1:
                raise CommandError("Activation failed: exactly one price model must be active")
        elif PriceModelVersion.objects.filter(is_active=True).count() > 1:
            raise CommandError("More than one active price model exists")
        self.stdout.write(self.style.SUCCESS(
            f"{version.version}: {version.cells.count()} cells, {version.scenarios.count()} scenarios, "
            f"{version.index_points.count()} index points{' (active)' if version.is_active else ''}"))
