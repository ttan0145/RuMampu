import { AppData } from '../src/rumampu/mock';
import { monthsAgg } from '../src/rumampu/calc';
import { HousingCalculationResult, HousingScenarioPayload, HousingScenarioResponse, HousingTestResult, PreHousingResult } from '../types/housing';
import { apiRequest } from './api';

function roundMoney(value: number): number {
  return Number((Number(value) || 0).toFixed(2));
}

function roundRate(value: number): number {
  return Number((Number(value) || 0).toFixed(3));
}

function scenarioPayload(data: AppData, includeCosts: boolean): HousingScenarioPayload {
  return {
    property_price: roundMoney(data.house.price),
    deposit: roundMoney(data.house.deposit),
    financing_rate: roundRate(data.house.rate),
    tenure_years: data.house.years,
    known_monthly_payment: data.house.knownPayment == null ? null : roundMoney(data.house.knownPayment),
    ...(includeCosts ? {
      additional_costs: data.homeCosts.map(item => ({
        category: item.id,
        amount: roundMoney(Number(item.a) || 0),
      })),
    } : {}),
  };
}

export async function createHousingScenario(data: AppData): Promise<HousingScenarioResponse> {
  return apiRequest<HousingScenarioResponse>('/housing/scenarios/', {
    method: 'POST',
    body: JSON.stringify(scenarioPayload(data, false)),
  });
}

export async function updateHousingScenario(id: number, data: AppData): Promise<HousingScenarioResponse> {
  return apiRequest<HousingScenarioResponse>(`/housing/scenarios/${id}/`, {
    method: 'PUT',
    body: JSON.stringify(scenarioPayload(data, true)),
  });
}

export async function runPreHousingCheck(): Promise<PreHousingResult> {
  return apiRequest<PreHousingResult>('/housing/pre-check/', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function runHousingTest(scenarioId: number): Promise<HousingTestResult> {
  return apiRequest<HousingTestResult>('/housing/test-result/', {
    method: 'POST',
    body: JSON.stringify({ scenario_id: scenarioId }),
  });
}


export async function calculateHousing(data: AppData): Promise<HousingCalculationResult> {
  return apiRequest<HousingCalculationResult>('/housing/calculate/', {
    method: 'POST',
    body: JSON.stringify(scenarioPayload(data, true)),
  });
}

export async function runStatelessHousingTest(
  data: AppData,
  testedMonthlyHomeCost?: number,
  incomeShockPercent = 0,
): Promise<HousingTestResult> {
  return apiRequest<HousingTestResult>('/housing/test/', {
    method: 'POST',
    body: JSON.stringify({
      ...scenarioPayload(data, true),
      financial_months: monthsAgg(data).map(row => ({
        year: row.y,
        month: row.m + 1,
        gross_income: roundMoney(row.gross),
        usable_income: roundMoney(row.net),
        existing_costs: roundMoney(Math.max(0, row.net - row.surplus)),
      })),
      ...(testedMonthlyHomeCost == null ? {} : { tested_monthly_home_cost: roundMoney(testedMonthlyHomeCost) }),
      income_shock_percent: roundMoney(incomeShockPercent),
    }),
  });
}
