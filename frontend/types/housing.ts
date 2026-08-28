export interface HousingCostInput {
  category: string;
  amount: number;
}

export interface HousingScenarioPayload {
  property_price: number;
  deposit: number;
  financing_rate: number;
  tenure_years: number;
  known_monthly_payment: number | null;
  additional_costs?: HousingCostInput[];
}

export interface HousingCalculationResult {
  financing_amount: number;
  monthly_instalment: number;
  total_monthly_cost: number;
  upfront_required: number;
  cash_on_hand: number;
  upfront_gap: number;
}

export interface HousingScenarioResponse extends HousingScenarioPayload {
  id: number;
  financing_amount: number;
  monthly_instalment: number;
  total_monthly_cost: number;
  created_at: string;
  updated_at: string;
}

export interface PreHousingMonthResult {
  year: number;
  month: number; // 1-12 from Django
  gross_income: number;
  usable_income: number;
  existing_costs: number;
  surplus: number;
  shortfall: number;
}

export interface PreHousingResult {
  provenance: 'calculated_from_user_record';
  work_cost_basis: 'current_active_monthly_snapshot';
  has_existing_shortfall: boolean;
  tested_months: number;
  largest_existing_gap: number;
  worst_month: { year: number; month: number } | null;
  months: PreHousingMonthResult[];
}

export interface HousingTestMonthResult extends PreHousingMonthResult {
  available_for_home: number;
  tested_home_cost: number;
  post_housing_residual: number;
  is_short: boolean;
  existing_shortfall: number;
  housing_created_shortfall: number;
  housing_added_gap: number;
  total_shortfall: number;
  shortfall_type: 'none' | 'housing_created' | 'existing_and_worsened_by_housing';
  housing_shortfall: number;
}

export interface CarryingRangeResult {
  lower_monthly_amount: number;
  upper_monthly_amount: number;
  tested_monthly_home_cost: number;
  lower_meaning: string;
  upper_meaning: string;
  indicative_property_price_lower: number;
  indicative_property_price_upper: number;
  property_price_limitation: string;
}

export interface StartingLiquidityResult {
  required_amount: number;
  months: Array<{
    year: number;
    month: number;
    closing_balance: number;
  }>;
}

export interface HousingTestResult {
  scenario_id: number;
  tested_home_cost: number;
  indicative_tested_property_price?: number;
  income_shock_percent: number;
  tested_months: number;
  short_month_count: number;
  existing_short_month_count: number;
  housing_created_short_month_count: number;
  largest_gap: number;
  largest_existing_gap: number;
  largest_housing_created_gap: number;
  months: HousingTestMonthResult[];
  carrying_range: CarryingRangeResult | null;
  starting_liquidity: StartingLiquidityResult;
}
