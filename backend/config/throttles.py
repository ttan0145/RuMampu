"""Endpoint-specific abuse controls for public and model-backed APIs.

These throttles intentionally use Django REST Framework's configured cache so
they add no new service dependency. Production deployments with more than one
worker should configure a shared cache to make the limits process-independent.
"""

from __future__ import annotations

import hashlib

from rest_framework.throttling import AnonRateThrottle, SimpleRateThrottle, UserRateThrottle


class _RequestFieldRateThrottle(SimpleRateThrottle):
    """Throttle a normalized request field without storing its value in cache keys."""

    field_name = ""

    def get_cache_key(self, request, view):
        value = str(request.data.get(self.field_name, "")).strip().casefold()
        if value:
            ident = hashlib.sha256(value.encode("utf-8")).hexdigest()
        else:
            # Invalid requests still consume a bucket, without putting all
            # clients that omitted the field into the same global bucket.
            ident = f"missing-{self.get_ident(request)}"
        return self.cache_format % {"scope": self.scope, "ident": ident}


class LoginIPThrottle(AnonRateThrottle):
    scope = "auth_login_ip"


class LoginIdentifierThrottle(_RequestFieldRateThrottle):
    scope = "auth_login_identifier"
    field_name = "username"


class PasswordResetIPThrottle(AnonRateThrottle):
    scope = "auth_password_reset_ip"


class PasswordResetEmailThrottle(_RequestFieldRateThrottle):
    scope = "auth_password_reset_email"
    field_name = "email"


class PasswordResetConfirmThrottle(AnonRateThrottle):
    scope = "auth_password_reset_confirm"


class ReceiptScanThrottle(UserRateThrottle):
    scope = "receipt_scan"


class AssistantActionPreviewThrottle(UserRateThrottle):
    scope = "assistant_action_preview"
