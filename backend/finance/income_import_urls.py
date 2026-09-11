from django.urls import path

from .views import (
    IncomeImportConfirmView,
    IncomeImportDetailView,
    IncomeImportPreviewView,
    IncomeImportRowUpdateView,
)


urlpatterns = [
    path("preview/", IncomeImportPreviewView.as_view(), name="income-import-preview"),
    path(
        "<int:batch_id>/rows/<int:row_id>/",
        IncomeImportRowUpdateView.as_view(),
        name="income-import-row-update",
    ),
    path("<int:batch_id>/", IncomeImportDetailView.as_view(), name="income-import-detail"),
    path(
        "<int:batch_id>/confirm/",
        IncomeImportConfirmView.as_view(),
        name="income-import-confirm",
    ),
]
