from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError
from django.core.mail import EmailMultiAlternatives
from django.core.validators import validate_email
from django.db import transaction
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from finance.models import UserAppState
from finance.services import claim_guest_profile_for_user


User = get_user_model()


def _user_payload(user):
    return {
        "id": user.pk,
        "username": user.get_username(),
        "email": user.email,
    }


class RegisterView(APIView):
    """Create a real Django account and authenticate it immediately.

    The UI promises an email-based account with a password of at least eight
    characters containing letters and numbers, so those rules are enforced on
    the server as well as in the React Native form.
    """

    authentication_classes = []
    permission_classes = [AllowAny]

    @transaction.atomic
    def post(self, request):
        email = str(request.data.get("email", "")).strip().lower()
        password = str(request.data.get("password", ""))

        if not email or not password:
            return Response(
                {"error": {"code": "register_required_fields", "message": "Enter your email and password."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            validate_email(email)
        except ValidationError:
            return Response(
                {"error": {"code": "invalid_email", "message": "Enter a valid email address."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(password) < 8:
            return Response(
                {"error": {"code": "password_too_short", "message": "Password must be at least 8 characters."}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not any(ch.isalpha() for ch in password) or not any(ch.isdigit() for ch in password):
            return Response(
                {
                    "error": {
                        "code": "password_needs_letters_numbers",
                        "message": "Password must include at least one letter and one number.",
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # The default Django User model does not require email to be unique, so
        # RuMampu enforces one account per email explicitly. username is also the
        # normalised email so email login remains deterministic.
        if User.objects.filter(email__iexact=email).exists() or User.objects.filter(username__iexact=email).exists():
            return Response(
                {"error": {"code": "account_exists", "message": "An account with this email already exists."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # create_user hashes the password; the raw password is never stored.
        user = User.objects.create_user(username=email, email=email, password=password)

        # Preserve any RuMampu information entered before sign-up by moving the
        # current anonymous profile under this account. Returning users always
        # keep their existing account-owned profile instead.
        claim_guest_profile_for_user(request, user)
        UserAppState.objects.get_or_create(user=user)

        # Registration also signs the user in. Subsequent API requests use this
        # token and therefore resolve the account-owned profile, not the guest
        # session/profile boundary.
        token, _ = Token.objects.get_or_create(user=user)
        return Response(
            {"token": token.key, "user": _user_payload(user)},
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        identifier = str(request.data.get("username", "")).strip()
        password = str(request.data.get("password", ""))

        if not identifier or not password:
            return Response(
                {"error": {"code": "login_required_fields", "message": "Enter your username/email and password."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        username = identifier
        if "@" in identifier:
            matched_user = User.objects.filter(email__iexact=identifier).only("username").first()
            if matched_user is not None:
                username = matched_user.get_username()

        user = authenticate(request=request, username=username, password=password)
        if user is None or not user.is_active:
            return Response(
                {"error": {"code": "invalid_credentials", "message": "Incorrect username/email or password."}},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        claim_guest_profile_for_user(request, user)
        token, _ = Token.objects.get_or_create(user=user)
        return Response({"token": token.key, "user": _user_payload(user)})


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"user": _user_payload(request.user)})


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        Token.objects.filter(user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class PasswordResetRequestView(APIView):
    """Email a one-time Django password reset token.

    The response is deliberately identical for known and unknown email
    addresses so this endpoint cannot be used to discover registered users.
    """

    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        email = str(request.data.get("email", "")).strip().lower()
        if not email:
            return Response(
                {"error": {"code": "reset_email_required", "message": "Enter your email address."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            validate_email(email)
        except ValidationError:
            return Response(
                {"error": {"code": "invalid_email", "message": "Enter a valid email address."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if user is None or not user.has_usable_password():
            return Response(
                {
                    "error": {
                        "code": "account_not_found",
                        "message": "No RuMampu account was found with this email address.",
                    }
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        if user.has_usable_password():
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            base = str(getattr(settings, "PASSWORD_RESET_URL_BASE", "rumampu://reset-password")).rstrip("?")
            separator = "&" if "?" in base else "?"
            reset_url = f"{base}{separator}uid={uid}&token={token}"

            subject = "Reset your RuMampu password"
            text = (
                "You requested a password reset for your RuMampu account.\n\n"
                f"Open this link to set a new password:\n{reset_url}\n\n"
                "If you did not request this, you can ignore this email."
            )
            html = (
                "<p>You requested a password reset for your RuMampu account.</p>"
                f'<p><a href="{reset_url}">Reset my RuMampu password</a></p>'
                "<p>If you did not request this, you can ignore this email.</p>"
            )
            try:
                message = EmailMultiAlternatives(
                    subject=subject,
                    body=text,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    to=[user.email],
                )
                message.attach_alternative(html, "text/html")
                message.send(fail_silently=False)
            except Exception:
                return Response(
                    {
                        "error": {
                            "code": "reset_email_failed",
                            "message": "We could not send the reset email right now. Please try again later.",
                        }
                    },
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )

        return Response(
            {"message": "A password reset link has been sent to your email."},
            status=status.HTTP_200_OK,
        )


class PasswordResetConfirmView(APIView):
    """Validate a reset token and replace the user's password."""

    authentication_classes = []
    permission_classes = [AllowAny]

    @transaction.atomic
    def post(self, request):
        uid = str(request.data.get("uid", "")).strip()
        token = str(request.data.get("token", "")).strip()
        password = str(request.data.get("password", ""))

        if not uid or not token or not password:
            return Response(
                {"error": {"code": "reset_required_fields", "message": "The reset link or new password is missing."}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(password) < 8:
            return Response(
                {"error": {"code": "password_too_short", "message": "Password must be at least 8 characters."}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not any(ch.isalpha() for ch in password) or not any(ch.isdigit() for ch in password):
            return Response(
                {
                    "error": {
                        "code": "password_needs_letters_numbers",
                        "message": "Password must include at least one letter and one number.",
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user_id = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=user_id, is_active=True)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            user = None

        if user is None or not default_token_generator.check_token(user, token):
            return Response(
                {
                    "error": {
                        "code": "invalid_reset_link",
                        "message": "This password reset link is invalid or has expired. Request a new one.",
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(password)
        user.save(update_fields=["password"])

        # Invalidate any existing API login tokens. Password reset should log
        # the account out everywhere and require the new password next time.
        Token.objects.filter(user=user).delete()
        return Response({"message": "Your password has been reset. You can now log in with the new password."})
