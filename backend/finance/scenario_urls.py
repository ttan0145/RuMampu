from django.urls import path

from .scenario_views import ScenarioListView, ScenarioLoadView


urlpatterns = [
    path("", ScenarioListView.as_view(), name="dev-scenario-list"),
    path("<slug:scenario_id>/load/", ScenarioLoadView.as_view(), name="dev-scenario-load"),
]
