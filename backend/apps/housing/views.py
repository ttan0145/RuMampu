from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.db import connection
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
    StatelessHousingTestRequestSerializer,
)
from .services import calculation_result, housing_test_result, pre_housing_check, stateless_housing_test_result
from finance.services import profile_for_request


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

class SavedHousingTestView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        rows = SavedHousingTest.objects.filter(user=request.user)
        return Response([{
            'id': x.id, 'scenario_id': x.scenario_id,
            'monthly_payment': float(x.monthly_payment),
            'short_month_count': x.short_month_count,
            'tested_months': x.tested_months,
            'largest_gap': float(x.largest_gap),
            'income_shock_percent': float(x.income_shock_percent),
            'created_at': x.created_at.isoformat(),
        } for x in rows])

    def post(self, request):
        scenario = None
        scenario_id = request.data.get('scenario_id')
        if scenario_id:
            scenario = HousingScenario.objects.filter(id=scenario_id, user=request.user).first()
            if scenario is None:
                from rest_framework.exceptions import NotFound
                raise NotFound('Housing scenario not found.')
        x = SavedHousingTest.objects.create(
            user=request.user,
            scenario=scenario,
            monthly_payment=request.data.get('monthly_payment', 0),
            short_month_count=request.data.get('short_month_count', 0),
            tested_months=request.data.get('tested_months', 0),
            largest_gap=request.data.get('largest_gap', 0),
            income_shock_percent=request.data.get('income_shock_percent', 0),
        )
        return Response({'id': x.id}, status=status.HTTP_201_CREATED)


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

    quarters = _window(n)
    if not quarters:
        return JsonResponse({"detail": "no transaction data loaded"}, status=503)

    income = _income()
    states = {}

    for state_name, district, ptype, sales, median, under_thr in _places(quarters):
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
