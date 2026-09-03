from django.urls import path

from .views import (
    WorkCostEntryDetailView,
    WorkCostEntryListCreateView,
    WorkCostItemListCreateView,
    WorkCostMonthSummaryView,
)


urlpatterns = [
    path("", WorkCostItemListCreateView.as_view(), name="work-cost-items"),
    path("entries/", WorkCostEntryListCreateView.as_view(), name="work-cost-entries"),
    path("entries/<int:entry_id>/", WorkCostEntryDetailView.as_view(), name="work-cost-entry-detail"),
    path("summary/", WorkCostMonthSummaryView.as_view(), name="work-cost-month-summary"),
]
