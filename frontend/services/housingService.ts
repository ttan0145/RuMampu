import { AppData } from '../src/rumampu/mock';
import { HousingScenarioPayload, HousingScenarioResponse, PreHousingResult } from '../types/housing';
import { apiRequest } from './api';

function scenarioPayload(data: AppData, includeCosts: boolean): HousingScenarioPayload {
  return {
    property_price: data.house.price,
    deposit: data.house.deposit,
    financing_rate: data.house.rate,
    tenure_years: data.house.years,
    known_monthly_payment: data.house.knownPayment,
    ...(includeCosts ? {
      additional_costs: data.homeCosts.map(item => ({
        category: item.id,
        amount: Number(item.a) || 0,
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

export async function runPreHousingCheck(data: AppData): Promise<PreHousingResult> {
  return apiRequest<PreHousingResult>('/housing/pre-check/', {
    method: 'POST',
    body: JSON.stringify({
      income: data.income,
      work_costs: data.workCosts,
      commitments: data.commitments,
      expenses: data.expenses,
    }),
  });
}
