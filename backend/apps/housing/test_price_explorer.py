import csv
import io
import json
import tempfile
from pathlib import Path
from unittest import mock

from django.core.cache import cache
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import IntegrityError, transaction
from django.test import TestCase
from rest_framework.test import APIClient

from .models import PriceIndexPoint, PriceModelVersion, PriceRangeCell, PriceScenario

CELL_COLS = ['model_version', 'state_code', 'state', 'district', 'property_type', 'tenure', 'storeys', 'size_band',
             'n_sales_2y', 'quarter', 'size_m2', 'p10', 'p50', 'p90', 'y1_p10', 'y1_p50', 'y1_p90',
             'y2_p10', 'y2_p50', 'y2_p90', 'y3_p10', 'y3_p50', 'y3_p90']


def _write(folder, name, cols, rows):
    with open(Path(folder) / name, 'w', encoding='utf-8', newline='') as fh:
        w = csv.writer(fh)
        w.writerow(cols)
        w.writerows(rows)


def _cell(district, tenure, band, p50, version='pm-test'):
    return [version, 'SGR', 'Selangor', district, 'terrace', tenure, '2.0', band, '120', '2026Q2', '130.0',
            p50 * 0.8, p50, p50 * 1.4, p50 * 0.82, p50 * 1.03, p50 * 1.45,
            p50 * 0.84, p50 * 1.06, p50 * 1.5, p50 * 0.85, p50 * 1.09, p50 * 1.56]


def build_export(folder, version='pm-test'):
    json.dump({'model_version': version, 'price_level_quarter': '2026Q2', 'test_window': ['2025Q3', '2026Q2'],
               'test_sales': 100, 'notes': 'What-if ranges, not valuations.',
               'expected_counts': {'price_range_cell': 2, 'price_scenario': 3, 'price_index_point': 4}},
              open(Path(folder) / 'model_meta.json', 'w', encoding='utf-8'))
    _write(folder, 'price_range_cell.csv', CELL_COLS, [
        _cell('Petaling', 'F', 'typical', 634000, version),
        _cell('Petaling', 'F', 'small', 520000, version),
    ])
    _write(folder, 'price_scenario.csv',
           ['model_version', 'state', 'state_code', 'property_type', 'years', 'target_quarter', 'growth_low',
            'growth_mid', 'growth_high', 'prob_price_fall', 'annual_trend', 'annual_trend_p10', 'annual_trend_p90',
            'sales_last4q', 'data_quality'],
           [[version, 'Selangor', 'SGR', 'terrace', y, '2027Q2', 0.01 * y, 0.03 * y, 0.05 * y, 0.2 / y,
             0.03, 0.02, 0.04, 4000, 'good'] for y in (1, 2, 3)])
    _write(folder, 'price_index_point.csv',
           ['model_version', 'state_code', 'property_type', 'quarter', 'index_value', 'sales'],
           [[version, sc, 'terrace', q, v, 100] for sc in ('SGR', 'ALL') for q, v in (('2021Q1', 100), ('2021Q2', 101))])
    _write(folder, 'price_accuracy.csv',
           ['model_version', 'property_type', 'n', 'median_APE', 'within_10pct', 'within_20pct', 'coverage80'],
           [[version, 'terrace', 50, 0.095, 0.52, 0.805, 0.765]])
    _write(folder, 'price_driver.csv',
           ['model_version', 'feature', 'description', 'band', 'reference', 'n', 'effect_pct'],
           [[version, 'dist_rail_km', 'Rail station', '<1 km', '5 km+', 10, 1.9]])


class LoadPriceModelTests(TestCase):
    def test_load_counts_activate_and_rerun_does_not_duplicate(self):
        with tempfile.TemporaryDirectory() as tmp:
            build_export(tmp)
            call_command('load_price_model', tmp, '--activate', stdout=io.StringIO())
            call_command('load_price_model', tmp, '--activate', stdout=io.StringIO())
        v = PriceModelVersion.objects.get(version='pm-test')
        self.assertTrue(v.is_active)
        self.assertEqual(PriceRangeCell.objects.count(), 2)
        self.assertEqual(PriceScenario.objects.count(), 3)
        self.assertEqual(PriceIndexPoint.objects.count(), 4)
        self.assertEqual(v.meta['accuracy']['terrace']['within_20pct'], 0.805)

    def test_activating_a_new_version_retires_the_old_one(self):
        with tempfile.TemporaryDirectory() as a, tempfile.TemporaryDirectory() as b:
            build_export(a, 'pm-old')
            build_export(b, 'pm-new')
            call_command('load_price_model', a, '--activate', stdout=io.StringIO())
            call_command('load_price_model', b, '--activate', stdout=io.StringIO())
        self.assertEqual(list(PriceModelVersion.objects.filter(is_active=True).values_list('version', flat=True)),
                         ['pm-new'])

    def test_wrong_count_is_rejected_before_existing_data_changes(self):
        with tempfile.TemporaryDirectory() as tmp:
            build_export(tmp)
            call_command('load_price_model', tmp, '--activate', stdout=io.StringIO())
            meta_path = Path(tmp) / 'model_meta.json'
            meta = json.loads(meta_path.read_text(encoding='utf-8'))
            meta['expected_counts']['price_range_cell'] = 2004
            meta_path.write_text(json.dumps(meta), encoding='utf-8')
            with self.assertRaises(CommandError):
                call_command('load_price_model', tmp, '--activate', stdout=io.StringIO())
        self.assertEqual(PriceRangeCell.objects.count(), 2)
        self.assertEqual(PriceModelVersion.objects.get().version, 'pm-test')

    def test_invalid_range_is_rejected_before_database_changes(self):
        with tempfile.TemporaryDirectory() as tmp:
            build_export(tmp)
            path = Path(tmp) / 'price_range_cell.csv'
            rows = list(csv.reader(path.open(encoding='utf-8')))
            rows[1][rows[0].index('p10')] = rows[1][rows[0].index('p90')]
            _write(tmp, 'price_range_cell.csv', rows[0], rows[1:])
            with self.assertRaises(CommandError):
                call_command('load_price_model', tmp, '--activate', stdout=io.StringIO())
        self.assertFalse(PriceModelVersion.objects.exists())

    def test_database_prevents_two_active_versions(self):
        PriceModelVersion.objects.create(version='one', is_active=True)
        with self.assertRaises(IntegrityError), transaction.atomic():
            PriceModelVersion.objects.create(version='two', is_active=True)


class PriceExplorerApiTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        with tempfile.TemporaryDirectory() as tmp:
            build_export(tmp)
            call_command('load_price_model', tmp, '--activate', stdout=io.StringIO())

    def test_home_returns_range_future_and_falls_back_to_freehold(self):
        r = self.client.get('/api/v1/housing/price-explorer/home/',
                            {'district': 'Petaling', 'property_type': 'terrace', 'tenure': 'L'})
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertEqual(body['today']['p50'], 634000)
        self.assertEqual(len(body['future']), 3)
        self.assertEqual(body['tenure'], 'F')
        self.assertEqual(body['tenures_available'], ['F'])
        self.assertEqual(body['sizes'], {'small': 130, 'typical': 130})
        self.assertLessEqual(body['today']['p10'], body['today']['p50'])
        self.assertLessEqual(body['today']['p50'], body['today']['p90'])
        self.assertEqual(body['future'][0]['prob_lower'], 0.2)

    def test_home_endpoint_figures_match_loaded_table(self):
        cell = PriceRangeCell.objects.get(size_band='typical')
        response = self.client.get('/api/v1/housing/price-explorer/home/', {
            'district': cell.district,
            'property_type': cell.property_type,
            'tenure': cell.tenure,
            'size': cell.size_band,
        })
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body['today'], {'p10': cell.p10, 'p50': cell.p50, 'p90': cell.p90})
        for year in (1, 2, 3):
            self.assertEqual(body['future'][year - 1]['p10'], getattr(cell, f'y{year}_p10'))
            self.assertEqual(body['future'][year - 1]['p50'], getattr(cell, f'y{year}_p50'))
            self.assertEqual(body['future'][year - 1]['p90'], getattr(cell, f'y{year}_p90'))

    def test_home_unknown_district_is_404(self):
        r = self.client.get('/api/v1/housing/price-explorer/home/', {'district': 'Nowhere', 'property_type': 'terrace'})
        self.assertEqual(r.status_code, 404)

    def test_no_active_version_is_503(self):
        PriceModelVersion.objects.update(is_active=False)
        r = self.client.get('/api/v1/housing/price-explorer/trend/', {'state': 'SGR', 'property_type': 'terrace'})
        self.assertEqual(r.status_code, 503)

    def test_bad_query_is_400(self):
        r = self.client.get('/api/v1/housing/price-explorer/areas/',
                            {'state': 'XXX', 'property_type': 'terrace', 'budget': 450000})
        self.assertEqual(r.status_code, 400)

    def test_trend_lines_up_state_with_national(self):
        r = self.client.get('/api/v1/housing/price-explorer/trend/', {'state': 'SGR', 'property_type': 'terrace'})
        self.assertEqual(r.json()['quarters'], ['2021Q1', '2021Q2'])
        self.assertEqual(r.json()['state'], [100.0, 101.0])

    @mock.patch('apps.housing.price_explorer.recent_quarters', return_value=['2025Q3', '2025Q4', '2026Q1', '2026Q2'])
    @mock.patch('apps.housing.price_explorer.raw_stats',
                return_value={'Petaling': (40, 500000, 700000, 900000, 10), 'Klang': (5, 400000, 450000, 500000, 5)})
    def test_areas_share_hidden_below_eight_sales(self, _share, _quarters):
        r = self.client.get('/api/v1/housing/price-explorer/areas/',
                            {'state': 'SGR', 'property_type': 'terrace', 'budget': 453000})
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertEqual(body['budget'], 450000)
        by = {a['district']: a for a in body['areas']}
        self.assertEqual(by['Petaling']['share_under'], 0.25)
        self.assertEqual(by['Petaling']['typical'], 634000)
        self.assertIsNone(by['Klang']['share_under'])
        self.assertEqual(body['window'], {'from': '2025Q3', 'to': '2026Q2'})

    def test_areas_without_the_raw_sales_table_still_lists_typical_prices(self):
        r = self.client.get('/api/v1/housing/price-explorer/areas/',
                            {'state': 'SGR', 'property_type': 'terrace', 'budget': 450000})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()['areas'], [{'district': 'Petaling', 'sales': 0, 'share_under': None, 'typical': 634000,
                                              'low': 507200, 'high': 887600}])
        self.assertIsNone(r.json()['income'])


class PriceExplorerAllTypesTests(TestCase):
    """'all' home types come from the raw sales, which only exist on Neon: stub them."""

    def setUp(self):
        cache.clear()
        self.client = APIClient()
        with tempfile.TemporaryDirectory() as tmp:
            build_export(tmp)
            call_command('load_price_model', tmp, '--activate', stdout=io.StringIO())

    @mock.patch('apps.housing.price_explorer.recent_quarters', return_value=['2025Q3', '2025Q4', '2026Q1', '2026Q2'])
    @mock.patch('apps.housing.price_explorer.raw_stats',
                return_value={'Petaling': (40, 300000, 600000, 1000000, 12), 'Klang': (6, 1, 2, 3, 1)})
    def test_areas_all_types_use_raw_ranges_and_hide_thin_districts(self, _raw, _q):
        r = self.client.get('/api/v1/housing/price-explorer/areas/', {'state': 'SGR', 'property_type': 'all', 'budget': 450000})
        self.assertEqual(r.status_code, 200)
        by = {a['district']: a for a in r.json()['areas']}
        self.assertEqual(by['Petaling'], {'district': 'Petaling', 'sales': 40, 'share_under': 0.3,
                                          'typical': 600000, 'low': 300000, 'high': 1000000})
        self.assertIsNone(by['Klang']['typical'])

    @mock.patch('apps.housing.price_explorer._raw_types', return_value=(['2026Q2'], {'terrace': 30, 'condo': 10}))
    @mock.patch('apps.housing.price_explorer._raw', return_value=(['2026Q2'], {'Petaling': (40, 300000, 600000, 1000000, 0)}))
    def test_home_all_types_grows_the_raw_typical_price(self, _raw, _types):
        r = self.client.get('/api/v1/housing/price-explorer/home/', {'district': 'Petaling', 'property_type': 'all'})
        self.assertEqual(r.status_code, 200)
        b = r.json()
        self.assertEqual(b['today'], {'p10': 300000, 'p50': 600000, 'p90': 1000000})
        # terrace grows by its cell (y1 = 1.03 x today); condo has no cell or scenario here, so is left out
        self.assertEqual(b['future'][0]['p50'], 618000)
        self.assertLessEqual(b['trend_band'][0]['low'], b['future'][0]['p50'])
        self.assertGreaterEqual(b['trend_band'][0]['high'], b['future'][0]['p50'])
        self.assertEqual([h['quarter'] for h in b['history']], [])   # the test index has too few quarters to roll

    def test_home_all_types_without_raw_sales_is_404(self):
        r = self.client.get('/api/v1/housing/price-explorer/home/', {'district': 'Petaling', 'property_type': 'all'})
        self.assertEqual(r.status_code, 404)

    def test_home_type_has_history_fields(self):
        r = self.client.get('/api/v1/housing/price-explorer/home/', {'district': 'Petaling', 'property_type': 'terrace'})
        b = r.json()
        self.assertIn('history', b)
        self.assertIn('last_year', b)
        self.assertEqual(len(b['trend_band']), 3)
