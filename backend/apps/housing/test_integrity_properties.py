"""Generated-data checks for the money invariants that must never drift."""

from decimal import Decimal

from django.test import SimpleTestCase
from hypothesis import given, settings, strategies as st

from .services import _starting_liquidity, calculation_result


money_cents = st.integers(min_value=0, max_value=999_999_999)


def as_money(cents: int) -> Decimal:
    return Decimal(cents) / Decimal("100")


class MoneyIntegrityProperties(SimpleTestCase):
    @settings(max_examples=1_000, deadline=None)
    @given(st.lists(st.integers(min_value=-10_000_000, max_value=10_000_000), max_size=60))
    def test_generated_buffer_is_the_deepest_fall(self, values):
        months = [
            {
                "year": 2020 + index // 12,
                "month": index % 12 + 1,
                "post_housing_residual": as_money(value),
            }
            for index, value in enumerate(values)
        ]

        result = _starting_liquidity(months)
        balance = Decimal("0")
        high = Decimal("0")
        deepest = Decimal("0")
        expected_balances = []
        for value in values:
            balance += as_money(value)
            deepest = max(deepest, high - balance)
            high = max(high, balance)
            expected_balances.append(balance.quantize(Decimal("0.01")))

        self.assertEqual(result["required_amount"], deepest.quantize(Decimal("0.01")))
        self.assertGreaterEqual(result["required_amount"], 0)
        self.assertEqual([row["closing_balance"] for row in result["months"]], expected_balances)

    @settings(max_examples=1_000, deadline=None)
    @given(
        property_price=money_cents,
        deposit=money_cents,
        cash=money_cents,
        costs=st.lists(money_cents, max_size=20),
    )
    def test_generated_upfront_totals_are_exact_and_never_negative(
        self, property_price, deposit, cash, costs
    ):
        deposit_amount = as_money(deposit)
        cash_amount = as_money(cash)
        cost_amounts = [as_money(value) for value in costs]
        result = calculation_result(
            {
                "property_price": as_money(property_price),
                "deposit": deposit_amount,
                "financing_rate": Decimal("0"),
                "tenure_years": 1,
                "known_monthly_payment": Decimal("0"),
                "upfront_costs": [{"amount": value} for value in cost_amounts],
                "cash_on_hand": cash_amount,
            }
        )

        expected_required = deposit_amount + sum(cost_amounts, Decimal("0"))
        expected_gap = max(Decimal("0"), expected_required - cash_amount)
        self.assertGreaterEqual(result["financing_amount"], 0)
        self.assertEqual(result["upfront_required"], expected_required)
        self.assertEqual(result["upfront_gap"], expected_gap)
        self.assertGreaterEqual(result["upfront_gap"], 0)
