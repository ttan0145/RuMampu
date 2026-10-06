from django.urls import path

from .iteration3_views import HomeownershipMonthListView, RetentionStatusView


urlpatterns = [
    path("homeownership/months/", HomeownershipMonthListView.as_view(), name="homeownership-months"),
    path("retention/", RetentionStatusView.as_view(), name="retention-status"),
]
