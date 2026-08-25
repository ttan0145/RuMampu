import { PreHousingResult } from '../types/housing';

let scenarioId: number | null = null;
let preHousingResult: PreHousingResult | null = null;

export function setHousingScenarioId(id: number | null): void {
  scenarioId = id;
}

export function getHousingScenarioId(): number | null {
  return scenarioId;
}

export function setPreHousingResult(result: PreHousingResult | null): void {
  preHousingResult = result;
}

export function getPreHousingResult(): PreHousingResult | null {
  return preHousingResult;
}

export function clearHousingSession(): void {
  scenarioId = null;
  preHousingResult = null;
}
