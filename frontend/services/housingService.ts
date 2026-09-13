import { AppData } from '../src/rumampu/mock';
import {
  HouseCostsResponse,
  HousingCalculationResult,
  HousingScenarioPayload,
  HousingScenarioResponse,
  HousingTestResult,
  PreHousingResult,
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

export async function runHousingTest(
  scenarioId: number,
  testedMonthlyHomeCost?: number,
  incomeShockPercent = 0,
): Promise<HousingTestResult> {
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
