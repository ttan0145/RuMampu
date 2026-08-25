from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import HousingCalculationView, HousingScenarioViewSet, HousingTestResultView, PreHousingCheckView, StatelessHousingTestView

router = DefaultRouter()
router.register('scenarios', HousingScenarioViewSet, basename='housing-scenario')

urlpatterns = [
    path('', include(router.urls)),
    path('calculate/', HousingCalculationView.as_view(), name='housing-calculate'),
    path('pre-check/', PreHousingCheckView.as_view(), name='housing-pre-check'),
    path('test-result/', HousingTestResultView.as_view(), name='housing-test-result'),
    path('test/', StatelessHousingTestView.as_view(), name='housing-test'),
]
