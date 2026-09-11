from django.urls import path

from .views import ExpenseEntryListCreateView, ExpenseReceiptScanView


urlpatterns = [
    path("", ExpenseEntryListCreateView.as_view(), name="expense-entries"),
    path("receipt-scan/", ExpenseReceiptScanView.as_view(), name="expense-receipt-scan"),
]
