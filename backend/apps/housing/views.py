from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
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
