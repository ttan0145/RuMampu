"""Database-backed idempotency for user-triggered create operations."""

import hashlib
import json
import re
from typing import Callable

from django.core.serializers.json import DjangoJSONEncoder
from django.db import transaction
from rest_framework import status
from rest_framework.response import Response

from .models import IdempotencyRecord


KEY_PATTERN = re.compile(r"^[A-Za-z0-9._:-]{8,128}$")


def _owner_key(request, profile=None) -> str:
    if request.user.is_authenticated:
        return f"user:{request.user.pk}"
    if profile is not None:
        return f"profile:{profile.public_id}"
    client_id = request.headers.get("X-RuMampu-Client-ID", "")
    return f"guest:{client_id}"


def _canonical_payload(data) -> str:
    return json.dumps(data, cls=DjangoJSONEncoder, sort_keys=True, separators=(",", ":"))


def idempotent_create(
    request,
    *,
    operation: str,
    create: Callable[[], Response],
    profile=None,
) -> Response:
    """Run a create once when the caller supplies an Idempotency-Key header."""

    request_key = request.headers.get("Idempotency-Key", "")
    if not request_key:
        return create()
    if not KEY_PATTERN.fullmatch(request_key):
        return Response(
            {
                "error": {
                    "code": "invalid_idempotency_key",
                    "message": "Idempotency-Key must be 8–128 letters, numbers, dots, colons, underscores, or hyphens.",
                }
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    request_hash = hashlib.sha256(_canonical_payload(request.data).encode("utf-8")).hexdigest()
    owner_key = _owner_key(request, profile)
    with transaction.atomic():
        record, created = IdempotencyRecord.objects.get_or_create(
            owner_key=owner_key,
            operation=operation,
            request_key=request_key,
            defaults={"request_hash": request_hash},
        )
        if not created:
            if record.request_hash != request_hash:
                return Response(
                    {
                        "error": {
                            "code": "idempotency_key_reused",
                            "message": "This Idempotency-Key was already used with different data.",
                        }
                    },
                    status=status.HTTP_409_CONFLICT,
                )
            return Response(record.response_data, status=record.response_status)

        response = create()
        if response.status_code >= 500:
            # Roll back both the business write and its incomplete replay record.
            transaction.set_rollback(True)
            return response
        record.response_status = response.status_code
        record.response_data = json.loads(_canonical_payload(response.data))
        record.save(update_fields=["response_status", "response_data"])
        return response
