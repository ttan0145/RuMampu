from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.db import DatabaseError, connection, transaction
from django.http import JsonResponse
from django.views.decorators.cache import cache_page
from django.views.decorators.http import require_GET
from .models import SavedHousingTest

from .models import HousingScenario
from .serializers import (
    HousingCalculationResultSerializer,
    HousingCalculationSerializer,
    HousingScenarioSerializer,
    PreHousingCheckResultSerializer,
    PreHousingCheckSerializer,
    HousingTestRequestSerializer,
    HousingTestResultSerializer,
    SavedHousingTestCreateSerializer,
    SavedHousingTestResponseSerializer,
    SavedHousingTestUpdateSerializer,
    StatelessHousingTestRequestSerializer,
)
from .services import calculation_result, housing_test_result, pre_housing_check, stateless_housing_test_result
from finance.services import profile_for_request


def _scenario_snapshot(scenario):
    if scenario is None:
        return {}
    return dict(HousingScenarioSerializer(scenario).data)


def _saved_test_payload(row):
    scenario = _scenario_snapshot(row.scenario) if row.scenario_id else row.scenario_snapshot
    result = row.result_snapshot or {}
    property_price = scenario.get('property_price') if isinstance(scenario, dict) else None
    return {
        'id': row.id,
        'name': row.name,
        'scenario_id': row.scenario_id,
        'property_price': property_price,
        'monthly_payment': float(row.monthly_payment),
        'tested_monthly_home_cost': float(row.monthly_payment),
        'short_month_count': row.short_month_count,
        'tested_months': row.tested_months,
        'largest_gap': float(row.largest_gap),
        'income_shock_percent': float(row.income_shock_percent),
        'scenario': scenario,
        'result': result,
        'created_at': row.created_at.isoformat(),
        'updated_at': row.updated_at.isoformat(),
    }


class HousingScenarioViewSet(viewsets.ModelViewSet):
    queryset = HousingScenario.objects.none()
    serializer_class = HousingScenarioSerializer

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return self.queryset
        if self.request.user.is_authenticated:
            return HousingScenario.objects.filter(user=self.request.user).prefetch_related('additional_costs')
        profile = profile_for_request(self.request)
        return HousingScenario.objects.filter(profile=profile).prefetch_related('additional_costs')


class HousingCalculationView(APIView):
    @extend_schema(
        request=HousingCalculationSerializer,
        responses=HousingCalculationResultSerializer,
    )
    def post(self, request):
        serializer = HousingCalculationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(calculation_result(serializer.validated_data))


class PreHousingCheckView(APIView):
    @extend_schema(
        request=PreHousingCheckSerializer,
        responses=PreHousingCheckResultSerializer,
    )
    def post(self, request):
        serializer = PreHousingCheckSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        profile = profile_for_request(request)
        return Response(pre_housing_check(profile))

class HousingTestResultView(APIView):
    @extend_schema(
        request=HousingTestRequestSerializer,
        responses=HousingTestResultSerializer,
    )
    def post(self, request):
        serializer = HousingTestRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        profile = profile_for_request(request)

        scenario_id = serializer.validated_data['scenario_id']
        if request.user.is_authenticated:
            scenario = HousingScenario.objects.filter(
                id=scenario_id, user=request.user
            ).prefetch_related('additional_costs').first()
        else:
            scenario = HousingScenario.objects.filter(
                id=scenario_id, profile=profile
            ).prefetch_related('additional_costs').first()

        if scenario is None:
            from rest_framework.exceptions import NotFound
            raise NotFound('Housing scenario not found.')

        return Response(housing_test_result(
            profile,
            scenario,
            tested_monthly_home_cost=serializer.validated_data.get(
                'tested_monthly_home_cost'
            ),
            income_shock_percent=serializer.validated_data['income_shock_percent'],
        ))



class StatelessHousingTestView(APIView):
    @extend_schema(
        request=StatelessHousingTestRequestSerializer,
        responses=HousingTestResultSerializer,
    )
    def post(self, request):
        serializer = StatelessHousingTestRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        profile = profile_for_request(request)
        return Response(stateless_housing_test_result(profile, serializer.validated_data))

class SavedHousingTestMixin:
    permission_classes = [IsAuthenticated]
    serializer_class = SavedHousingTestResponseSerializer

    def get_object(self, request, test_id):
        from rest_framework.exceptions import NotFound
        row = SavedHousingTest.objects.filter(
            id=test_id,
            user=request.user,
        ).select_related('scenario').prefetch_related('scenario__additional_costs').first()
        if row is None:
            raise NotFound('Saved housing test not found.')
        return row


class SavedHousingTestListView(SavedHousingTestMixin, APIView):
    @extend_schema(responses=SavedHousingTestResponseSerializer(many=True))
    def get(self, request):
        rows = SavedHousingTest.objects.filter(
            user=request.user,
        ).select_related('scenario').prefetch_related('scenario__additional_costs')
        return Response([_saved_test_payload(row) for row in rows])

    @extend_schema(
        request=SavedHousingTestCreateSerializer,
        responses={status.HTTP_201_CREATED: SavedHousingTestResponseSerializer},
    )
    def post(self, request):
        serializer = SavedHousingTestCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = dict(serializer.validated_data)
        scenario = None
        scenario_id = values.pop('scenario_id', None)
        if scenario_id:
            scenario = HousingScenario.objects.filter(
                id=scenario_id, user=request.user
            ).prefetch_related('additional_costs').first()
            if scenario is None:
                from rest_framework.exceptions import NotFound
                raise NotFound('Housing scenario not found.')
        result_snapshot = values.pop('result', {})
        x = SavedHousingTest.objects.create(
            user=request.user,
            scenario=scenario,
            scenario_snapshot=_scenario_snapshot(scenario),
            result_snapshot=result_snapshot,
            **values,
        )
        return Response(_saved_test_payload(x), status=status.HTTP_201_CREATED)


class SavedHousingTestDetailView(SavedHousingTestMixin, APIView):
    @extend_schema(responses=SavedHousingTestResponseSerializer)
    def get(self, request, test_id):
        return Response(_saved_test_payload(self.get_object(request, test_id)))

    @extend_schema(
        request=SavedHousingTestUpdateSerializer,
        responses=SavedHousingTestResponseSerializer,
    )
    def patch(self, request, test_id):
        row = self.get_object(request, test_id)
        serializer = SavedHousingTestUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        update_fields = list(serializer.validated_data)
        for field, value in serializer.validated_data.items():
            setattr(row, field, value)
        if update_fields:
            update_fields.append('updated_at')
            row.save(update_fields=update_fields)
        return Response(_saved_test_payload(row))

    def delete(self, request, test_id):
        row = self.get_object(request, test_id)
        row.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# Short key per state, matching the housing-cost screen.
STATE_KEY = {
    "Johor": "jhr", "Kedah": "kdh", "Kelantan": "ktn", "Melaka": "mlk",
    "Negeri Sembilan": "nsn", "Pahang": "phg", "Perak": "prk", "Perlis": "pls",
    "Pulau Pinang": "png", "Sabah": "sbh", "Sarawak": "swk", "Selangor": "sgr",
    "Terengganu": "trg", "W.P. Kuala Lumpur": "kul", "W.P. Labuan": "lbn",
    "W.P. Putrajaya": "pjy",
}

# Cleaned property_type -> the screen's type key.
TYPE_KEY = {
    "terrace": "terr",
    "condo": "condo",
    "flat": "flat",
    "low_cost_house": "lch",
    "low_cost_flat": "lcf",
}

AFFORDABLE_THRESHOLD = 300_000
DEFAULT_WINDOW = 4
INCOME_YEAR = 2024


def _window(n):
    """The n most recent quarters present in the data."""
    with connection.cursor() as cur:
        cur.execute("SELECT DISTINCT quarter FROM property_transaction "
                    "ORDER BY quarter DESC LIMIT %s", [n])
        qs = [r[0] for r in cur.fetchall()]
    return sorted(qs)


def _places(quarters):
    """[(state, district, type_key_or_all, sales, median, under_threshold)]"""
    sql = """
    WITH win AS (
        SELECT t.*, s.name AS state_name, d.name AS district_name
        FROM property_transaction t
        JOIN district d ON d.id = t.district_id
        JOIN state    s ON s.id = d.state_id
        WHERE t.quarter = ANY(%(quarters)s)
    )
    SELECT state_name, district_name, property_type,
           count(*)                                              AS sales,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY price_rm)  AS median,
           count(*) FILTER (WHERE price_rm <= %(thr)s)            AS under_thr
    FROM win
    GROUP BY state_name, district_name, property_type

    UNION ALL

    SELECT state_name, district_name, 'all',
           count(*),
           percentile_cont(0.5) WITHIN GROUP (ORDER BY price_rm),
           count(*) FILTER (WHERE price_rm <= %(thr)s)
    FROM win
    GROUP BY state_name, district_name
    """
    with connection.cursor() as cur:
        cur.execute(sql, {"quarters": quarters, "thr": AFFORDABLE_THRESHOLD})
        return cur.fetchall()


def _income():
    with connection.cursor() as cur:
        cur.execute("SELECT s.name, i.income_median FROM state_income i "
                    "JOIN state s ON s.id = i.state_id WHERE i.year = %s",
                    [INCOME_YEAR])
        return {n: int(v) for n, v in cur.fetchall() if v is not None}


@require_GET
@cache_page(60 * 60 * 6)   # the underlying data changes quarterly at most
def house_costs(request):
    try:
        n = max(1, min(12, int(request.GET.get("quarters", DEFAULT_WINDOW))))
    except (TypeError, ValueError):
        n = DEFAULT_WINDOW

    try:
        # Raw sales tables are optional in SQLite development/CI. A savepoint
        # also keeps a missing PostgreSQL table from poisoning the transaction.
        with transaction.atomic():
            quarters = _window(n)
            if quarters:
                income = _income()
                places = _places(quarters)
    except DatabaseError:
        return JsonResponse({"detail": "no transaction data loaded"}, status=503)

    if not quarters:
        return JsonResponse({"detail": "no transaction data loaded"}, status=503)

    states = {}

    for state_name, district, ptype, sales, median, under_thr in places:
        skey = STATE_KEY.get(state_name)
        if skey is None:
            continue                      # a state we have no short key for
        tkey = "all" if ptype == "all" else TYPE_KEY.get(ptype)
        if tkey is None:
            continue                      # detached, cluster, townhouse: not shown

        st = states.setdefault(skey, {
            "name": state_name,
            "income": income.get(state_name),
            "types": {k: {} for k in ["all", "terr", "condo", "flat", "lch", "lcf"]},
        })
        st["types"][tkey][district] = [int(sales), int(round(float(median))),
                                       int(under_thr)]

    return JsonResponse({
        "window": {"from": quarters[0], "to": quarters[-1], "quarters": len(quarters)},
        "income_year": INCOME_YEAR,
        "affordable_threshold": AFFORDABLE_THRESHOLD,
        "states": states,
    })


# ---- Price Explorer (the offline price model's results) ----------------------
from django.utils.decorators import method_decorator
from drf_spectacular.utils import OpenApiParameter
from rest_framework import serializers

from . import price_explorer as px


class _PxBase(serializers.Serializer):
    property_type = serializers.ChoiceField(choices=sorted(px.TYPES))


class _PxBaseAll(serializers.Serializer):
    # 'all' = every home type together, from the raw sales
    property_type = serializers.ChoiceField(choices=sorted(px.TYPES | {'all'}))


class PxAreasQuery(_PxBaseAll):
    state = serializers.ChoiceField(choices=sorted(px.STATE_NAME))
    budget = serializers.IntegerField(min_value=50_000, max_value=10_000_000)


class PxHomeQuery(_PxBaseAll):
    district = serializers.CharField(max_length=60)
    tenure = serializers.ChoiceField(choices=['F', 'L'], default='F')
    size = serializers.ChoiceField(choices=['small', 'typical', 'large'], default='typical')


class PxTrendQuery(_PxBase):
    state = serializers.ChoiceField(choices=sorted(px.STATE_NAME))


def _version_or_503():
    v = px.active_version()
    return v, (None if v else Response({"detail": "price model not loaded"}, status=503))


class PriceExplorerAreasView(APIView):
    @extend_schema(parameters=[PxAreasQuery], responses={200: dict, 503: dict})
    def get(self, request):
        q = PxAreasQuery(data=request.query_params)
        q.is_valid(raise_exception=True)
        v, err = _version_or_503()
        if err:
            return err
        budget = int(round(q.validated_data['budget'], -4))            # 10k steps keep caching effective
        data = px.areas(v, q.validated_data['state'], q.validated_data['property_type'], budget)
        return Response({"model_version": v.version, "budget": budget, **data})


@method_decorator(cache_page(60 * 60 * 6), name='get')            # model data changes quarterly
class PriceExplorerHomeView(APIView):
    @extend_schema(parameters=[PxHomeQuery], responses={200: dict, 404: dict, 503: dict})
    def get(self, request):
        q = PxHomeQuery(data=request.query_params)
        q.is_valid(raise_exception=True)
        v, err = _version_or_503()
        if err:
            return err
        d = q.validated_data
        data = px.home(v, d['district'], d['property_type'], d['tenure'], d['size'])
        if data is None:
            return Response({"detail": "not enough sales for this district and type"}, status=404)
        meta = {k: v.meta.get(k) for k in ('price_level_quarter', 'test_window', 'test_sales', 'overall', 'notes')}
        return Response({"model_version": v.version, "meta": meta, **data})


@method_decorator(cache_page(60 * 60 * 6), name='get')
class PriceExplorerTrendView(APIView):
    @extend_schema(parameters=[PxTrendQuery], responses={200: dict, 503: dict})
    def get(self, request):
        q = PxTrendQuery(data=request.query_params)
        q.is_valid(raise_exception=True)
        v, err = _version_or_503()
        if err:
            return err
        return Response({"model_version": v.version, **px.trend(v, q.validated_data['state'], q.validated_data['property_type'])})
