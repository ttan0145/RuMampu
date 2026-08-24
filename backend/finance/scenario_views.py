from time import perf_counter

from django.conf import settings
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from .scenario_service import available_scenarios, load_scenario
from .services import profile_for_request


class ScenarioLoadSerializer(serializers.Serializer):
    confirm_reset = serializers.BooleanField()

    def validate_confirm_reset(self, value):
        if not value:
            raise serializers.ValidationError(
                "Set confirm_reset to true to replace the current test guest's finance data."
            )
        return value


def _require_test_scenarios_enabled() -> None:
    if not settings.ENABLE_TEST_SCENARIOS:
        raise NotFound("Test scenarios are not enabled.")


class ScenarioListView(APIView):
    @extend_schema(exclude=True)
    def get(self, request):
        _require_test_scenarios_enabled()
        return Response(available_scenarios())


class ScenarioLoadView(APIView):
    @extend_schema(exclude=True)
    def post(self, request, scenario_id: str):
        _require_test_scenarios_enabled()
        serializer = ScenarioLoadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        profile = profile_for_request(request)
        started = perf_counter()
        result = load_scenario(profile=profile, scenario_id=scenario_id)
        result["load_duration_ms"] = round((perf_counter() - started) * 1000, 1)
        return Response(result, status=status.HTTP_201_CREATED)
