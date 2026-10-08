from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from django.test import Client, TestCase, override_settings

from config.throttles import (
    LoginIdentifierThrottle,
    PasswordResetConfirmThrottle,
    PasswordResetEmailThrottle,
)


User = get_user_model()


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class AuthenticationThrottleTests(TestCase):
    def setUp(self):
        cache.clear()

    def tearDown(self):
        cache.clear()

    @patch.object(LoginIdentifierThrottle, "THROTTLE_RATES", {"auth_login_identifier": "2/min"})
    def test_login_repeated_for_one_identifier_is_throttled(self):
        User.objects.create_user(
            username="limited@example.com",
            email="limited@example.com",
            password="Passw0rd123",
        )
        client = Client()
        payload = {"username": "limited@example.com", "password": "wrongPass1"}

        first = client.post("/api/v1/auth/login/", payload, content_type="application/json")
        second = client.post("/api/v1/auth/login/", payload, content_type="application/json")
        blocked = client.post("/api/v1/auth/login/", payload, content_type="application/json")

        self.assertEqual(first.status_code, 401)
        self.assertEqual(second.status_code, 401)
        self.assertEqual(blocked.status_code, 429)
        self.assertEqual(blocked.json()["error"]["code"], "throttled")

    @patch.object(PasswordResetEmailThrottle, "THROTTLE_RATES", {"auth_password_reset_email": "2/hour"})
    def test_password_reset_limits_messages_to_one_email(self):
        User.objects.create_user(
            username="reset-limited@example.com",
            email="reset-limited@example.com",
            password="Passw0rd123",
        )
        client = Client()
        payload = {"email": "reset-limited@example.com"}

        first = client.post("/api/v1/auth/password-reset/", payload, content_type="application/json")
        second = client.post("/api/v1/auth/password-reset/", payload, content_type="application/json")
        blocked = client.post("/api/v1/auth/password-reset/", payload, content_type="application/json")

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(blocked.status_code, 429)
        self.assertEqual(len(mail.outbox), 2)

    @patch.object(PasswordResetConfirmThrottle, "THROTTLE_RATES", {"auth_password_reset_confirm": "2/hour"})
    def test_password_reset_confirmation_attempts_are_throttled(self):
        client = Client()
        payload = {"uid": "invalid", "token": "invalid", "password": "Passw0rd123"}

        first = client.post("/api/v1/auth/password-reset/confirm/", payload, content_type="application/json")
        second = client.post("/api/v1/auth/password-reset/confirm/", payload, content_type="application/json")
        blocked = client.post("/api/v1/auth/password-reset/confirm/", payload, content_type="application/json")

        self.assertEqual(first.status_code, 400)
        self.assertEqual(second.status_code, 400)
        self.assertEqual(blocked.status_code, 429)
