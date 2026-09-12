from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import UserAppState

class AccountStateView(APIView):
    permission_classes = [IsAuthenticated]

    def _state(self, user):
        return UserAppState.objects.get_or_create(user=user)[0]

    def get(self, request):
        s = self._state(request.user)
        return Response({
            'cash_on_hand': str(s.cash_on_hand),
            'upfront_costs': s.upfront_costs,
            'docs_checked': s.docs_checked,
            'bought_home': s.bought_home,
            'expense_limits': s.expense_limits,
            'compare_payments': s.compare_payments,
        })

    def put(self, request):
        s = self._state(request.user)
        if 'cash_on_hand' in request.data: s.cash_on_hand = request.data['cash_on_hand'] or 0
        if 'upfront_costs' in request.data: s.upfront_costs = request.data['upfront_costs'] or []
        if 'docs_checked' in request.data: s.docs_checked = request.data['docs_checked'] or []
        if 'bought_home' in request.data: s.bought_home = bool(request.data['bought_home'])
        if 'expense_limits' in request.data: s.expense_limits = request.data['expense_limits'] or {}
        if 'compare_payments' in request.data: s.compare_payments = request.data['compare_payments'] or []
        s.save()
        return self.get(request)
