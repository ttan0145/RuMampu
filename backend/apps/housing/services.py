from collections import defaultdict
from decimal import Decimal

EXP_FULL_DAYS = 20


def _num(value):
    if value in (None, ''):
        return 0.0
    return float(value)


def financing_amount(property_price, deposit):
    return max(0.0, _num(property_price) - _num(deposit))


def calculate_monthly_instalment(principal, annual_rate, years):
    principal = _num(principal)
    annual_rate = _num(annual_rate)
    years = int(years or 0)
    if principal <= 0 or years <= 0:
        return 0.0
    monthly_rate = annual_rate / 100 / 12
    months = years * 12
    if monthly_rate == 0:
        return principal / months
    return principal * monthly_rate / (1 - (1 + monthly_rate) ** (-months))


def calculate_total_home_cost(monthly_instalment, additional_costs):
    extras = sum(_num(item.get('amount', item.get('a', 0))) for item in additional_costs or [])
    return _num(monthly_instalment) + extras


def calculation_result(data):
    principal = financing_amount(data['property_price'], data['deposit'])
    known = data.get('known_monthly_payment')
    monthly = _num(known) if known is not None else calculate_monthly_instalment(
        principal, data['financing_rate'], data['tenure_years']
    )
    total = calculate_total_home_cost(monthly, data.get('additional_costs', []))
    return {
        'financing_amount': round(principal, 2),
        'monthly_instalment': round(monthly, 2),
        'total_monthly_cost': round(total, 2),
    }


def scenario_instalment(scenario):
    if scenario.known_monthly_payment is not None:
        return float(scenario.known_monthly_payment)
    return calculate_monthly_instalment(
        financing_amount(scenario.property_price, scenario.deposit),
        scenario.financing_rate,
        scenario.tenure_years,
    )


def scenario_total_monthly_cost(scenario):
    costs = [{'amount': c.amount} for c in scenario.additional_costs.all()]
    return calculate_total_home_cost(scenario_instalment(scenario), costs)


def _month_key(date_string):
    # Input from the existing React Native prototype is YYYY-MM-DD.
    year = int(date_string[0:4])
    month = int(date_string[5:7])
    return year, month


def _expense_months(expenses):
    result = defaultdict(lambda: {'total': 0.0, 'days': set()})
    for entry in expenses or []:
        key = _month_key(entry['d'])
        result[key]['total'] += _num(entry.get('a'))
        result[key]['days'].add(entry['d'])
    return result


def _flatten_commitments(commitments):
    return (
        commitments.get('living', []) +
        commitments.get('debts', []) +
        commitments.get('savings', [])
    )


def _monthly_commitment(commitments, expense_month):
    all_items = _flatten_commitments(commitments)
    base = sum(_num(item.get('a')) for item in all_items)
    if expense_month and len(expense_month['days']) >= EXP_FULL_DAYS:
        variable_estimates = sum(_num(item.get('a')) for item in all_items if item.get('dv'))
        return base - variable_estimates + expense_month['total']
    return base


def pre_housing_check(data):
    income_by_month = defaultdict(float)
    for entry in data.get('income', []):
        income_by_month[_month_key(entry['d'])] += _num(entry.get('a'))

    work_cost = sum(_num(item.get('a')) for item in data.get('work_costs', []))
    expense_months = _expense_months(data.get('expenses', []))
    commitments = data.get('commitments', {})

    rows = []
    for year, month in sorted(income_by_month):
        gross = income_by_month[(year, month)]
        usable_income = gross - work_cost
        existing_costs = _monthly_commitment(commitments, expense_months.get((year, month)))
        surplus = usable_income - existing_costs
        rows.append({
            'year': year,
            'month': month,
            'gross_income': round(gross, 2),
            'usable_income': round(usable_income, 2),
            'existing_costs': round(existing_costs, 2),
            'surplus': round(surplus, 2),
            'shortfall': round(max(0.0, -surplus), 2),
        })

    short_rows = [row for row in rows if row['shortfall'] > 0]
    worst = max(short_rows, key=lambda row: row['shortfall']) if short_rows else None
    return {
        'has_existing_shortfall': bool(short_rows),
        'tested_months': len(rows),
        'largest_existing_gap': worst['shortfall'] if worst else 0,
        'worst_month': ({'year': worst['year'], 'month': worst['month']} if worst else None),
        'months': rows,
    }
