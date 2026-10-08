import hmac
import logging
from io import StringIO

from django.conf import settings
from django.core.management import call_command
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


logger = logging.getLogger(__name__)


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


class RetentionCronView(APIView):
    """Run record retention only for Vercel Cron's authenticated request."""

    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = []

    @extend_schema(exclude=True)
    def get(self, request):
        secret = settings.CRON_SECRET
        if not secret:
            logger.error("retention_cron_disabled: CRON_SECRET is not configured")
            return Response(
                {
                    "error": {
                        "code": "retention_cron_disabled",
                        "message": "The retention scheduler is not configured.",
                    }
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        supplied = request.headers.get("Authorization", "")
        if not hmac.compare_digest(supplied, f"Bearer {secret}"):
            return Response(
                {
                    "error": {
                        "code": "retention_cron_unauthorized",
                        "message": "The retention scheduler request is not authorized.",
                    }
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        output = StringIO()
        try:
            call_command("process_record_retention", stdout=output)
        except Exception:
            logger.exception("retention_cron_failed")
            return Response(
                {
                    "error": {
                        "code": "retention_cron_failed",
                        "message": "The retention process failed.",
                    }
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        result = output.getvalue().strip()
        logger.info("retention_cron_completed: %s", result)
        return Response({"status": "ok", "result": result})
