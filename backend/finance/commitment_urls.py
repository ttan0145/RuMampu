from django.urls import path

from .views import CommitmentItemDetailView, CommitmentItemListView


urlpatterns = [
    path("", CommitmentItemListView.as_view(), name="commitment-items"),
    path("<int:item_id>/", CommitmentItemDetailView.as_view(), name="commitment-item-detail"),
]
