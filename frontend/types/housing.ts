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

export type HouseCostType = 'all' | 'terr' | 'condo' | 'flat' | 'lch' | 'lcf';
export type HouseCostPlace = [sales: number, median: number, underThreshold: number];

export interface HouseCostsResponse {
  window: {
    from: string;
    to: string;
    quarters: number;
  };
  income_year: number;
  affordable_threshold: number;
  states: Record<string, {
    name: string;
    income: number | null;
    types: Record<HouseCostType, Record<string, HouseCostPlace>>;
  }>;
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
  work_cost_basis: 'recorded_entries_by_month';
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

export interface SavedHousingTestRecord {
  id: number;
  name: string;
  scenario_id: number | null;
  property_price: string | number | null;
  monthly_payment: number;
  tested_monthly_home_cost: number;
  short_month_count: number;
  tested_months: number;
  largest_gap: number;
  income_shock_percent: number;
  scenario: HousingScenarioResponse | HousingScenarioPayload | Record<string, unknown>;
  result: HousingTestResult | Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SaveHousingTestPayload {
  name?: string;
  scenario_id?: number;
  monthly_payment: number;
  short_month_count: number;
  tested_months: number;
  largest_gap: number;
  income_shock_percent?: number;
  result: HousingTestResult;
}

/* Price Explorer: the offline price model's results (see ml/ and
   backend/apps/housing/price_explorer.py). Prices are ranges, never one figure. */
export type PxType = 'terrace' | 'condo' | 'semi_detached' | 'low_cost_house' | 'flat'
  | 'townhouse' | 'detached' | 'cluster' | 'low_cost_flat';
export type PxSize = 'small' | 'typical' | 'large';
export interface PxBand { p10: number; p50: number; p90: number }

export interface PxAreasResponse {
  model_version: string; budget: number;
  window: { from: string; to: string } | null;
  areas: Array<{ district: string; sales: number; share_under: number | null; typical: number | null }>;
}
export interface PxHomeResponse {
  model_version: string; district: string; state_code: string; property_type: PxType;
  tenure: 'F' | 'L'; tenures_available: Array<'F' | 'L'>; size_band: PxSize;
  sizes: Partial<Record<PxSize, number>>; size_m2: number; storeys: number; n_sales_2y: number;
  today: PxBand;
  future: Array<PxBand & { years: 1 | 2 | 3; prob_lower: number | null }>;
  trend: { annual: number; low: number; high: number; quality: 'good' | 'fair' | 'thin' } | null;
  accuracy: { median_APE: number; within_10pct: number; within_20pct: number; coverage80: number } | null;
  drivers: Array<{ feature: string; description: string; band: string; reference: string; effect_pct: number }>;
  meta: {
    price_level_quarter: string; test_window: string[]; test_sales: number | null;
    overall: { median_APE: number; within_20pct: number; coverage80: number } | null; notes: string;
  };
}
export interface PxTrendResponse {
  model_version: string; quarters: string[]; state: Array<number | null>; national: number[]; sales: number[];
}
