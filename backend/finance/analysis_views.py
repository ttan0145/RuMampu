from drf_spectacular.utils import extend_schema
from rest_framework.response import Response
from rest_framework.views import APIView

from .analysis_service import (
    build_income_coverage,
    build_income_pattern,
    save_income_coverage,
)
from .serializers import (
    ApiErrorSerializer,
    IncomeCoverageResponseSerializer,
    IncomeCoverageUpdateSerializer,
    IncomePatternResponseSerializer,
)
from .services import profile_for_request


class IncomePatternView(APIView):
    @extend_schema(
        operation_id="income_pattern_retrieve",
        summary="Calculate the current guest's recorded income pattern",
        tags=["Income pattern"],
        responses={200: IncomePatternResponseSerializer},
    )
    def get(self, request):
        profile = profile_for_request(request)
        payload = build_income_pattern(profile)
        return Response(IncomePatternResponseSerializer(payload).data)


class IncomeCoverageView(APIView):
    @extend_schema(
        operation_id="income_coverage_retrieve",
        summary="Get the current guest's slower-period coverage check",
        tags=["Income pattern"],
        responses={200: IncomeCoverageResponseSerializer},
    )
    def get(self, request):
        profile = profile_for_request(request)
        payload = build_income_coverage(profile)
        return Response(IncomeCoverageResponseSerializer(payload).data)

    @extend_schema(
        operation_id="income_coverage_update",
        summary="Confirm the current guest's slower-period coverage check",
        tags=["Income pattern"],
        request=IncomeCoverageUpdateSerializer,
        responses={
            200: IncomeCoverageResponseSerializer,
            400: ApiErrorSerializer,
        },
    )
    def put(self, request):
        profile = profile_for_request(request)
        serializer = IncomeCoverageUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = save_income_coverage(profile=profile, **serializer.validated_data)
        return Response(IncomeCoverageResponseSerializer(payload).data)
