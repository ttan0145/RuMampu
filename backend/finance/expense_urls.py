from django.urls import path

from .views import ExpenseEntryListCreateView


urlpatterns = [
    path("", ExpenseEntryListCreateView.as_view(), name="expense-entries"),
]
