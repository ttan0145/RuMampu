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
  has_existing_shortfall: boolean;
  tested_months: number;
  largest_existing_gap: number;
  worst_month: { year: number; month: number } | null;
  months: PreHousingMonthResult[];
}
