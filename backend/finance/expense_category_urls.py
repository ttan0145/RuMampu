from django.urls import path

from .views import ExpenseCategoryListCreateView


urlpatterns = [
    path("", ExpenseCategoryListCreateView.as_view(), name="expense-categories"),
]
