from django.urls import path

from .views import (
    IncomeEntryListCreateView,
    IncomeRecordView,
    IncomeSourceListCreateView,
)


urlpatterns = [
    path("record/", IncomeRecordView.as_view(), name="income-record"),
    path("sources/", IncomeSourceListCreateView.as_view(), name="income-sources"),
    path("entries/", IncomeEntryListCreateView.as_view(), name="income-entries"),
]
