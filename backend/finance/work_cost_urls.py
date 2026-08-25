from django.urls import path

from .views import WorkCostItemDetailView, WorkCostItemListCreateView


urlpatterns = [
    path("", WorkCostItemListCreateView.as_view(), name="work-cost-items"),
    path("<int:item_id>/", WorkCostItemDetailView.as_view(), name="work-cost-item-detail"),
]
