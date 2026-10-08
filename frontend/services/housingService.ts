import { commitFor, monthsAgg } from '../src/rumampu/calc';
import { AppData } from '../src/rumampu/mock';
import {
  HouseCostsResponse,
  HousingCalculationResult,
  HousingScenarioPayload,
  HousingScenarioResponse,
  HousingTestResult,
  PreHousingResult,
  PxAreasResponse,
  PxHomeResponse,
  PxSize,
  PxTrendResponse,
  PxKind,
  PxType,
  SavedHousingTestRecord,
  SaveHousingTestPayload,
} from '../types/housing';
import { apiRequest } from './api';

function roundMoney(value: number): number {
  return Number((Number(value) || 0).toFixed(2));
}

function roundRate(value: number): number {
  return Number((Number(value) || 0).toFixed(3));
}

function scenarioPayload(data: AppData): HousingScenarioPayload {
  return {
    property_price: roundMoney(data.house.price ?? 0),
    deposit: roundMoney(data.house.deposit),
    financing_rate: roundRate(data.house.rate),
    tenure_years: data.house.years,
    known_monthly_payment: data.house.knownPayment == null ? null : roundMoney(data.house.knownPayment),
    additional_costs: data.homeCosts.map(item => ({
      category: item.id,
      amount: roundMoney(Number(item.a) || 0),
    })),
  };
}

export async function createHousingScenario(data: AppData): Promise<HousingScenarioResponse> {
  return apiRequest<HousingScenarioResponse>('/housing/scenarios/', {
    method: 'POST',
    body: JSON.stringify(scenarioPayload(data)),
  });
}

export async function updateHousingScenario(id: number, data: AppData): Promise<HousingScenarioResponse> {
  return apiRequest<HousingScenarioResponse>(`/housing/scenarios/${id}/`, {
    method: 'PUT',
    body: JSON.stringify(scenarioPayload(data)),
  });
}

export async function runPreHousingCheck(): Promise<PreHousingResult> {
  return apiRequest<PreHousingResult>('/housing/pre-check/', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

/* AC8.26.4: while sample months show, a house test runs on its own throwaway
   scenario. Nothing is created on the server; the stateless endpoint is given
   the sample months and the home, and the result is never kept. The throwaway
   scenario has a negative id so every screen that re-runs "the same scenario"
   (try a payment, an income drop, compare payments) stays on this path. */
export const SAMPLE_SCENARIO_ID = -1;
let sampleData: AppData | null = null;

export function setSampleHousingData(data: AppData | null): void {
  sampleData = data;
}

/* The same months as the backend's pre-housing check: completed months only,
   income less dated work costs, less commitments (or the recorded expenses
   when that month's expenses are complete). */
function sampleFinancialMonths(data: AppData) {
  const now = new Date();
  const current = now.getFullYear() * 12 + now.getMonth();
  return monthsAgg(data)
    .filter(r => r.y * 12 + r.m !== current)
    .map(r => ({
      year: r.y,
      month: r.m + 1,
      gross_income: roundMoney(r.gross),
      usable_income: roundMoney(r.net),
      existing_costs: roundMoney(Math.max(0, commitFor(data, r.y * 12 + r.m))),
    }));
}

export function samplePreHousingCheck(data: AppData): PreHousingResult {
  const months = sampleFinancialMonths(data).map(r => {
    const surplus = roundMoney(r.usable_income - r.existing_costs);
    return { ...r, surplus, shortfall: Math.max(0, -surplus) };
  });
  const short = months.filter(r => r.shortfall > 0);
  const worst = short.reduce<(typeof months)[number] | null>((w, r) => (!w || r.shortfall > w.shortfall ? r : w), null);
  return {
    provenance: 'calculated_from_user_record',
    work_cost_basis: 'recorded_entries_by_month',
    has_existing_shortfall: short.length > 0,
    tested_months: months.length,
    largest_existing_gap: worst ? worst.shortfall : 0,
    worst_month: worst ? { year: worst.year, month: worst.month } : null,
    months,
  };
}

export function sampleHousingScenario(data: AppData): HousingScenarioResponse {
  const now = new Date().toISOString();
  return {
    ...scenarioPayload(data),
    id: SAMPLE_SCENARIO_ID,
    financing_amount: 0,
    monthly_instalment: 0,
    total_monthly_cost: 0,
    created_at: now,
    updated_at: now,
  };
}

async function runSampleHousingTest(
  data: AppData,
  testedMonthlyHomeCost?: number,
  incomeShockPercent = 0,
): Promise<HousingTestResult> {
  const result = await apiRequest<HousingTestResult>('/housing/test/', {
    method: 'POST',
    body: JSON.stringify({
      ...scenarioPayload(data),
      financial_months: sampleFinancialMonths(data),
      ...(testedMonthlyHomeCost == null ? {} : {
        tested_monthly_home_cost: roundMoney(testedMonthlyHomeCost),
      }),
      income_shock_percent: roundMoney(incomeShockPercent),
    }),
  });
  return { ...result, scenario_id: SAMPLE_SCENARIO_ID };
}

export async function runHousingTest(
  scenarioId: number,
  testedMonthlyHomeCost?: number,
  incomeShockPercent = 0,
): Promise<HousingTestResult> {
  if (scenarioId < 0) {
    if (!sampleData) throw new Error('Sample months are no longer showing.');
    return runSampleHousingTest(sampleData, testedMonthlyHomeCost, incomeShockPercent);
  }
  return apiRequest<HousingTestResult>('/housing/test-result/', {
    method: 'POST',
    body: JSON.stringify({
      scenario_id: scenarioId,
      ...(testedMonthlyHomeCost == null ? {} : {
        tested_monthly_home_cost: roundMoney(testedMonthlyHomeCost),
      }),
      income_shock_percent: roundMoney(incomeShockPercent),
    }),
  });
}


export async function calculateHousing(data: AppData): Promise<HousingCalculationResult> {
  return apiRequest<HousingCalculationResult>('/housing/calculate/', {
    method: 'POST',
    body: JSON.stringify({
      ...scenarioPayload(data),
      cash_on_hand: roundMoney(data.cashOnHand),
      upfront_costs: data.upfront.map(item => ({
        category: item.id,
        amount: roundMoney(Number(item.a) || 0),
      })),
    }),
  });
}

export async function fetchHouseCosts(quarters?: number): Promise<HouseCostsResponse> {
  const q = quarters ? `?quarters=${quarters}` : '';
  return apiRequest<HouseCostsResponse>(`/housing/house-costs/${q}`);
}

export async function fetchSavedHousingTests(): Promise<SavedHousingTestRecord[]> {
  return apiRequest<SavedHousingTestRecord[]>('/housing/saved-tests/');
}

export async function fetchSavedHousingTest(id: number): Promise<SavedHousingTestRecord> {
  return apiRequest<SavedHousingTestRecord>(`/housing/saved-tests/${id}/`);
}

export async function createSavedHousingTest(payload: SaveHousingTestPayload): Promise<SavedHousingTestRecord> {
  return apiRequest<SavedHousingTestRecord>('/housing/saved-tests/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateSavedHousingTest(
  id: number,
  payload: { name?: string; monthly_payment?: number; tested_monthly_home_cost?: number },
): Promise<SavedHousingTestRecord> {
  return apiRequest<SavedHousingTestRecord>(`/housing/saved-tests/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteSavedHousingTest(id: number): Promise<void> {
  await apiRequest<void>(`/housing/saved-tests/${id}/`, {
    method: 'DELETE',
  });
}

/* Price Explorer (read-only, no login, the same as house-costs) */
const qs = (o: Record<string, string | number>) =>
  '?' + Object.entries(o).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');

export const fetchPxAreas = (state: string, type: PxKind, budget: number) =>
  apiRequest<PxAreasResponse>(`/housing/price-explorer/areas/${qs({ state, property_type: type, budget })}`);
export const fetchPxHome = (district: string, type: PxKind, tenure: 'F' | 'L', size: PxSize) =>
  apiRequest<PxHomeResponse>(`/housing/price-explorer/home/${qs({ district, property_type: type, tenure, size })}`);
export const fetchPxTrend = (state: string, type: PxType) =>
  apiRequest<PxTrendResponse>(`/housing/price-explorer/trend/${qs({ state, property_type: type })}`);
