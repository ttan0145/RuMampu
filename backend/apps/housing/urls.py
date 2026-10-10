from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import (
    HousingCalculationView, HousingScenarioViewSet, HousingTestResultView,
    PreHousingCheckView, SavedHousingTestDetailView, SavedHousingTestListView,
    StatelessHousingTestView,
    house_costs,
    PriceExplorerAreasView, PriceExplorerHomeView, PriceExplorerTrendView,
)

router = DefaultRouter()
router.register('scenarios', HousingScenarioViewSet, basename='housing-scenario')

urlpatterns = [
    path('', include(router.urls)),
    path('calculate/', HousingCalculationView.as_view(), name='housing-calculate'),
    path('pre-check/', PreHousingCheckView.as_view(), name='housing-pre-check'),
    path('test-result/', HousingTestResultView.as_view(), name='housing-test-result'),
    path('test/', StatelessHousingTestView.as_view(), name='housing-test'),
    path('saved-tests/<int:test_id>/', SavedHousingTestDetailView.as_view(), name='housing-saved-test-detail'),
    path('saved-tests/', SavedHousingTestListView.as_view(), name='housing-saved-tests'),
    path('house-costs/', house_costs, name='house-costs'),
    path('price-explorer/areas/', PriceExplorerAreasView.as_view(), name='price-explorer-areas'),
    path('price-explorer/home/', PriceExplorerHomeView.as_view(), name='price-explorer-home'),
    path('price-explorer/trend/', PriceExplorerTrendView.as_view(), name='price-explorer-trend'),
]
