from collections import defaultdict
from decimal import Decimal, ROUND_HALF_UP, localcontext

from django.db.models import Sum

from finance.analysis_service import build_income_pattern
from finance.models import GuestProfile

EXP_FULL_DAYS = 20
MONEY_QUANTUM = Decimal('0.01')


def _decimal(value):
    if value in (None, ''):
        return Decimal('0')
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def _money(value):
    return _decimal(value).quantize(MONEY_QUANTUM, rounding=ROUND_HALF_UP)


def financing_amount(property_price, deposit):
    return max(Decimal('0'), _decimal(property_price) - _decimal(deposit))


def calculate_monthly_instalment(principal, annual_rate, years):
    principal = _decimal(principal)
    annual_rate = _decimal(annual_rate)
    years = int(years or 0)
    if principal <= 0 or years <= 0:
        return Decimal('0')
    monthly_rate = annual_rate / Decimal('100') / Decimal('12')
    months = years * 12
    if monthly_rate == 0:
        return principal / Decimal(months)
    with localcontext() as context:
        context.prec = 32
        return principal * monthly_rate / (
            Decimal('1') - (Decimal('1') + monthly_rate) ** (-months)
        )


def calculate_total_home_cost(monthly_instalment, additional_costs):
    extras = sum(
        (_decimal(item.get('amount', item.get('a', 0))) for item in additional_costs or []),
        Decimal('0'),
    )
    return _decimal(monthly_instalment) + extras


def calculation_result(data):
    principal = financing_amount(data['property_price'], data['deposit'])
    known = data.get('known_monthly_payment')
    monthly = _decimal(known) if known is not None else calculate_monthly_instalment(
        principal, data['financing_rate'], data['tenure_years']
    )
    total = calculate_total_home_cost(monthly, data.get('additional_costs', []))
    return {
        'financing_amount': _money(principal),
        'monthly_instalment': _money(monthly),
        'total_monthly_cost': _money(total),
    }


def scenario_instalment(scenario):
    if scenario.known_monthly_payment is not None:
        return scenario.known_monthly_payment
    return calculate_monthly_instalment(
        financing_amount(scenario.property_price, scenario.deposit),
        scenario.financing_rate,
        scenario.tenure_years,
    )


def scenario_total_monthly_cost(scenario):
    costs = [{'amount': c.amount} for c in scenario.additional_costs.all()]
    return calculate_total_home_cost(scenario_instalment(scenario), costs)


def _profile_expense_months(profile: GuestProfile):
    result = defaultdict(lambda: {'total': Decimal('0'), 'days': set()})
    entries = profile.expense_entries.filter(user_confirmed=True).values(
        'expense_date',
        'amount',
    )
    for entry in entries:
        expense_date = entry['expense_date']
        key = (expense_date.year, expense_date.month)
        result[key]['total'] += entry['amount']
        result[key]['days'].add(expense_date)
    return result


def pre_housing_check(profile: GuestProfile):
    """Calculate the pre-housing position from the same record as Epic 2."""

    pattern = build_income_pattern(profile)
    expense_months = _profile_expense_months(profile)
    commitments = profile.commitment_items.filter(is_active=True)
    commitment_total = commitments.aggregate(total=Sum('monthly_amount'))['total'] or Decimal('0')
    variable_estimates = (
        commitments.filter(is_daily_variable=True).aggregate(total=Sum('monthly_amount'))['total']
        or Decimal('0')
    )

    rows = []
    for pattern_month in pattern['months']:
        year, month = (int(part) for part in pattern_month['month'].split('-'))
        gross = pattern_month['gross_income']
        usable_income = pattern_month['usable_income']
        expense_month = expense_months.get((year, month))
        existing_costs = commitment_total
        if expense_month and len(expense_month['days']) >= EXP_FULL_DAYS:
            existing_costs = commitment_total - variable_estimates + expense_month['total']
        surplus = usable_income - existing_costs
        rows.append({
            'year': year,
            'month': month,
            'gross_income': _money(gross),
            'usable_income': _money(usable_income),
            'existing_costs': _money(existing_costs),
            'surplus': _money(surplus),
            'shortfall': _money(max(Decimal('0'), -surplus)),
        })

    short_rows = [row for row in rows if row['shortfall'] > 0]
    worst = max(short_rows, key=lambda row: row['shortfall']) if short_rows else None
    return {
        'provenance': 'calculated_from_user_record',
        'work_cost_basis': 'current_active_monthly_snapshot',
        'has_existing_shortfall': bool(short_rows),
        'tested_months': len(rows),
        'largest_existing_gap': worst['shortfall'] if worst else Decimal('0.00'),
        'worst_month': ({'year': worst['year'], 'month': worst['month']} if worst else None),
        'months': rows,
    }

def _median(values):
    values = sorted(values)
    count = len(values)
    if count == 0:
        return Decimal('0')
    middle = count // 2
    if count % 2:
        return values[middle]
    return (values[middle - 1] + values[middle]) / Decimal('2')


def property_price_from_monthly_payment(monthly_payment, annual_rate, years, deposit=0):
    """Convert a monthly mortgage instalment to an indicative property price.

    This is a financing-math conversion only, not a valuation, eligibility
    decision or financing offer.
    """
    payment = max(Decimal('0'), _decimal(monthly_payment))
    annual_rate = _decimal(annual_rate)
    years = int(years or 0)
    deposit = max(Decimal('0'), _decimal(deposit))
    if payment <= 0 or years <= 0:
        return deposit

    monthly_rate = annual_rate / Decimal('100') / Decimal('12')
    months = years * 12
    if monthly_rate == 0:
        principal = payment * Decimal(months)
    else:
        with localcontext() as context:
            context.prec = 32
            principal = payment * (
                Decimal('1') - (Decimal('1') + monthly_rate) ** (-months)
            ) / monthly_rate
    return principal + deposit


def housing_test_result(profile: GuestProfile, scenario):
    """Calculate US3.4 and US3.5 from the user's recorded financial months.

    Existing shortfalls are measured before the tested home cost. A
    housing-created shortfall is a month that was non-negative before housing
    and becomes negative only after the tested home cost is applied.
    """
    pre = pre_housing_check(profile)
    tested_cost = _money(scenario_total_monthly_cost(scenario))

    monthly = []
    for row in pre['months']:
        available = _decimal(row['surplus'])
        existing_shortfall = max(Decimal('0'), _decimal(row['shortfall']))
        post_housing_residual = available - tested_cost
        total_shortfall = max(Decimal('0'), -post_housing_residual)
        housing_created_shortfall = (
            total_shortfall if existing_shortfall == 0 else Decimal('0')
        )
        housing_added_gap = max(Decimal('0'), total_shortfall - existing_shortfall)

        if total_shortfall == 0:
            shortfall_type = 'none'
        elif existing_shortfall > 0:
            shortfall_type = 'existing_and_worsened_by_housing'
        else:
            shortfall_type = 'housing_created'

        monthly.append({
            **row,
            'available_for_home': _money(available),
            'tested_home_cost': tested_cost,
            'post_housing_residual': _money(post_housing_residual),
            'is_short': total_shortfall > 0,
            'existing_shortfall': _money(existing_shortfall),
            'housing_created_shortfall': _money(housing_created_shortfall),
            'housing_added_gap': _money(housing_added_gap),
            'total_shortfall': _money(total_shortfall),
            'shortfall_type': shortfall_type,
            # Compatibility with the existing Result chart data shape.
            'housing_shortfall': _money(total_shortfall),
        })

    short_rows = [row for row in monthly if row['is_short']]
    existing_short_rows = [row for row in monthly if row['existing_shortfall'] > 0]
    housing_created_rows = [
        row for row in monthly if row['shortfall_type'] == 'housing_created'
    ]
    capacities = [_decimal(row['available_for_home']) for row in monthly]

    carrying = None
    if capacities:
        lower = min(capacities)
        upper = _median(capacities)
        extras = sum(
            (_decimal(cost.amount) for cost in scenario.additional_costs.all()),
            Decimal('0'),
        )
        lower_mortgage_payment = max(Decimal('0'), lower - extras)
        upper_mortgage_payment = max(Decimal('0'), upper - extras)
        carrying = {
            'lower_monthly_amount': _money(lower),
            'upper_monthly_amount': _money(upper),
            'tested_monthly_home_cost': tested_cost,
            'lower_meaning': 'Every recorded month covered this amount.',
            'upper_meaning': 'Half of the recorded months covered this amount.',
            'indicative_property_price_lower': _money(property_price_from_monthly_payment(
                lower_mortgage_payment, scenario.financing_rate,
                scenario.tenure_years, scenario.deposit,
            )),
            'indicative_property_price_upper': _money(property_price_from_monthly_payment(
                upper_mortgage_payment, scenario.financing_rate,
                scenario.tenure_years, scenario.deposit,
            )),
            'property_price_limitation': 'Indicative only. Not a valuation, not an offer.',
        }

    return {
        'scenario_id': scenario.id,
        'tested_home_cost': tested_cost,
        'tested_months': len(monthly),
        'short_month_count': len(short_rows),
        'existing_short_month_count': len(existing_short_rows),
        'housing_created_short_month_count': len(housing_created_rows),
        'largest_gap': _money(max(
            (_decimal(row['total_shortfall']) for row in short_rows),
            default=Decimal('0'),
        )),
        'largest_existing_gap': _money(max(
            (_decimal(row['existing_shortfall']) for row in existing_short_rows),
            default=Decimal('0'),
        )),
        'largest_housing_created_gap': _money(max(
            (_decimal(row['housing_created_shortfall']) for row in housing_created_rows),
            default=Decimal('0'),
        )),
        'months': monthly,
        'carrying_range': carrying,
    }

