from django.urls import path

from .analysis_views import IncomeCoverageView, IncomePatternView


urlpatterns = [
    path("income-pattern/", IncomePatternView.as_view(), name="income-pattern"),
    path("income-coverage/", IncomeCoverageView.as_view(), name="income-coverage"),
]
