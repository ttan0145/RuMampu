from django.urls import path

from .views import (
    ExpenseEntryCoverageView,
    ExpenseEntryDetailView,
    ExpenseEntryListCreateView,
    ExpenseEntryMoveView,
    ExpenseReceiptScanView,
)


urlpatterns = [
    path("", ExpenseEntryListCreateView.as_view(), name="expense-entries"),
    path("<int:entry_id>/move/", ExpenseEntryMoveView.as_view(), name="expense-entry-move"),
    path("<int:entry_id>/", ExpenseEntryDetailView.as_view(), name="expense-entry-detail"),
    path("<int:entry_id>/coverage/", ExpenseEntryCoverageView.as_view(), name="expense-entry-coverage"),
    path("receipt-scan/", ExpenseReceiptScanView.as_view(), name="expense-receipt-scan"),
]
