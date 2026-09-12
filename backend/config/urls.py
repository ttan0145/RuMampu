from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView

from .auth_views import (
    LoginView, LogoutView, MeView, PasswordResetConfirmView,
    PasswordResetRequestView, RegisterView,
)
from .views import HealthCheckView


urlpatterns = [
    path("admin/", admin.site.urls),

    path("api/schema/", SpectacularAPIView.as_view(), name="api-schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="api-schema"), name="api-docs"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="api-schema"), name="api-redoc"),

    path("api/v1/health/", HealthCheckView.as_view(), name="health-check-v1"),
    path("api/v1/auth/register/", RegisterView.as_view(), name="auth-register"),
    path("api/v1/auth/login/", LoginView.as_view(), name="auth-login"),
    path("api/v1/auth/me/", MeView.as_view(), name="auth-me"),
    path("api/v1/auth/logout/", LogoutView.as_view(), name="auth-logout"),
    path("api/v1/auth/password-reset/", PasswordResetRequestView.as_view(), name="auth-password-reset"),
    path("api/v1/auth/password-reset/confirm/", PasswordResetConfirmView.as_view(), name="auth-password-reset-confirm"),
    path("api/v1/", include("finance.analysis_urls")),
    path("api/v1/income/", include("finance.urls")),
    path("api/v1/income-imports/", include("finance.income_import_urls")),
    path("api/v1/work-costs/", include("finance.work_cost_urls")),
    path("api/v1/commitments/", include("finance.commitment_urls")),
    path("api/v1/expense-categories/", include("finance.expense_category_urls")),
    path("api/v1/expenses/", include("finance.expense_urls")),
    path("api/v1/assistant/", include("finance.assistant_urls")),

    path("api/v1/housing/", include("apps.housing.urls")),

    path("api/v1/dev/scenarios/", include("finance.scenario_urls")),


    path("api/health/", HealthCheckView.as_view(), name="health-check-legacy"),
    path("api/income/", include("finance.urls")),
]
