from __future__ import annotations

from typing import Any

from rest_framework.exceptions import ValidationError
from rest_framework.views import exception_handler


def _plain_errors(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: _plain_errors(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_plain_errors(item) for item in value]
    return str(value)


def api_exception_handler(exc, context):
    """Return one stable error shape for all errors raised by DRF endpoints."""
    response = exception_handler(exc, context)
    if response is None:
        return None

    if isinstance(exc, ValidationError):
        response.data = {
            "error": {
                "code": "validation_error",
                "message": "The request contains invalid fields.",
                "fields": _plain_errors(response.data),
            }
        }
        return response

    detail = response.data.get("detail") if isinstance(response.data, dict) else None
    code = getattr(exc, "default_code", "request_error")
    response.data = {
        "error": {
            "code": str(code),
            "message": str(detail or "The request could not be completed."),
        }
    }
    return response
