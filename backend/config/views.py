from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.views import APIView


class HealthSerializer(serializers.Serializer):
    status = serializers.CharField()
    service = serializers.CharField()
    api_version = serializers.CharField()


class HealthCheckView(APIView):
    authentication_classes = []
    permission_classes = []

    @extend_schema(
        operation_id="system_health",
        summary="Check API availability",
        tags=["System"],
        responses=HealthSerializer,
    )
    def get(self, _request):
        return Response(
            {
                "status": "ok",
                "service": "rumampu-backend",
                "api_version": "v1",
            }
        )
