from django.urls import path

from .views import ExpenseEntryCoverageView, ExpenseEntryListCreateView, ExpenseReceiptScanView


urlpatterns = [
    path("", ExpenseEntryListCreateView.as_view(), name="expense-entries"),
    path("<int:entry_id>/coverage/", ExpenseEntryCoverageView.as_view(), name="expense-entry-coverage"),
    path("receipt-scan/", ExpenseReceiptScanView.as_view(), name="expense-receipt-scan"),
]
