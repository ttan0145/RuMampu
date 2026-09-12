from django.urls import path
from .account_views import AccountStateView
urlpatterns = [path('state/', AccountStateView.as_view(), name='account-state')]
