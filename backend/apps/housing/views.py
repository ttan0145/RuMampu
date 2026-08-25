from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema

from .models import HousingScenario
from .serializers import (
    HousingCalculationResultSerializer,
    HousingCalculationSerializer,
    HousingScenarioSerializer,
    PreHousingCheckResultSerializer,
    PreHousingCheckSerializer,
)
from .services import calculation_result, pre_housing_check
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
