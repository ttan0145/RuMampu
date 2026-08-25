from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import HousingScenario
from .serializers import HousingCalculationSerializer, HousingScenarioSerializer, PreHousingCheckSerializer
from .services import calculation_result, pre_housing_check


class HousingScenarioViewSet(viewsets.ModelViewSet):
    serializer_class = HousingScenarioSerializer

    def get_queryset(self):
        if self.request.user.is_authenticated:
            return HousingScenario.objects.filter(user=self.request.user).prefetch_related('additional_costs')
        # Anonymous scenarios are only used while authentication has not yet been wired into the prototype.
        return HousingScenario.objects.filter(user__isnull=True).prefetch_related('additional_costs')


class HousingCalculationView(APIView):
    def post(self, request):
        serializer = HousingCalculationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(calculation_result(serializer.validated_data))


class PreHousingCheckView(APIView):
    def post(self, request):
        serializer = PreHousingCheckSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(pre_housing_check(serializer.validated_data))
