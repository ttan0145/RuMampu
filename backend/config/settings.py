from pathlib import Path
import os

from dotenv import load_dotenv
from corsheaders.defaults import default_headers

from .database import build_default_database_config


BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.getenv(
    "SECRET_KEY",
    "rumampu-local-development-only",
)

DEBUG = os.getenv(
    "DEBUG",
    "False",
).lower() in {"1", "true", "yes"}

ENABLE_TEST_SCENARIOS = DEBUG and os.getenv(
    "ENABLE_TEST_SCENARIOS",
    "False",
).lower() in {"1", "true", "yes"}

ALLOWED_HOSTS = ["*"]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "rest_framework.authtoken",
    "drf_spectacular",
    "finance",
    "apps.housing",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"


TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

DATABASES = {"default": build_default_database_config(os.environ, BASE_DIR)}

AUTH_PASSWORD_VALIDATORS = []

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Kuala_Lumpur"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.TokenAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "EXCEPTION_HANDLER": "config.exceptions.api_exception_handler",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "RuMampu API",
    "DESCRIPTION": (
        "Versioned API for RuMampu's irregular-income housing readiness tool. "
        "RuMampu is not a lender, credit score or loan approval predictor."
    ),
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
    "ENUM_NAME_OVERRIDES": {
        "IncomeEntryMethodEnum": [
            ("manual", "Manual entry"),
            ("historical_total", "Historical monthly total"),
        ],
        "ExpenseEntryMethodEnum": [
            ("manual", "Manual entry"),
            ("receipt", "Receipt confirmed by user"),
        ],
    },
    "PREPROCESSING_HOOKS": ["config.schema.only_public_v1_endpoints"],
    "SWAGGER_UI_SETTINGS": {"persistAuthorization": True},
}

CORS_ALLOW_ALL_ORIGINS = False

CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ALLOWED_ORIGINS",
        (
            "http://localhost:8081,"
            "http://127.0.0.1:8081,"
            "http://localhost:19006,"
            "http://127.0.0.1:19006,"
            "https://rumampu-frontend.vercel.app"
        ),
    ).split(",")
    if origin.strip()
]

CORS_ALLOW_CREDENTIALS = True

if DEBUG:
    # A phone (or browser) on the same Wi-Fi loads the dev bundle from the
    # Mac's LAN IP, so its origin is that IP — which changes per network.
    # Allow any IPv4 origin on the two Expo dev ports, in DEBUG only.
    CORS_ALLOWED_ORIGIN_REGEXES = [
        r"^http://(?:\d{1,3}\.){3}\d{1,3}:(?:8081|19006)$",
    ]
CORS_ALLOW_HEADERS = (
    *default_headers,
    "x-rumampu-client-id",
)
CORS_EXPOSE_HEADERS = ("Content-Disposition",)

# SameSite=None is required for the deployed cross-site frontend, but browsers
# only accept it on Secure (HTTPS) cookies. On plain-HTTP DEBUG runs (local dev,
# CI browser tests) the cookie would be silently dropped, so fall back to Lax.
SESSION_COOKIE_SAMESITE = "Lax" if DEBUG else "None"
SESSION_COOKIE_SECURE = not DEBUG
SESSION_COOKIE_HTTPONLY = True

CSRF_COOKIE_SAMESITE = "Lax" if DEBUG else "None"
CSRF_COOKIE_SECURE = not DEBUG
CSRF_TRUSTED_ORIGINS = [
    "https://rumampu-frontend.vercel.app",
]


# Account email / password reset
# Configure these values in Railway (or your deployment environment).
EMAIL_BACKEND = os.getenv(
    "EMAIL_BACKEND",
    "django.core.mail.backends.smtp.EmailBackend",
)
EMAIL_HOST = os.getenv("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
EMAIL_USE_TLS = os.getenv("EMAIL_USE_TLS", "True").lower() in {"1", "true", "yes", "on"}
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", EMAIL_HOST_USER or "RuMampu <no-reply@rumampu.app>")

# Native production builds can use `rumampu://reset-password`. For web /
# Vercel testing, set this to e.g. https://rumampu.vercel.app/reset-password.
PASSWORD_RESET_URL_BASE = os.getenv("PASSWORD_RESET_URL_BASE", "rumampu://reset-password")
# Django's default token timeout is one day. Keep it explicit for this app.
PASSWORD_RESET_TIMEOUT = int(os.getenv("PASSWORD_RESET_TIMEOUT", "86400"))
