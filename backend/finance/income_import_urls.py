from django.urls import path

from .views import IncomeImportConfirmView, IncomeImportDetailView, IncomeImportPreviewView


urlpatterns = [
    path("preview/", IncomeImportPreviewView.as_view(), name="income-import-preview"),
    path("<int:batch_id>/", IncomeImportDetailView.as_view(), name="income-import-detail"),
    path(
        "<int:batch_id>/confirm/",
        IncomeImportConfirmView.as_view(),
        name="income-import-confirm",
    ),
]
