import {
  HousingCalculationResult,
  HousingScenarioResponse,
  HousingTestResult,
  PreHousingResult,
} from '../types/housing';

let preHousingResult: PreHousingResult | null = null;
let housingTestResult: HousingTestResult | null = null;
let housingCalculationResult: HousingCalculationResult | null = null;
let housingScenario: HousingScenarioResponse | null = null;

export function setHousingScenario(result: HousingScenarioResponse | null): void {
  housingScenario = result;
}

export function getHousingScenario(): HousingScenarioResponse | null {
  return housingScenario;
}

export function setPreHousingResult(result: PreHousingResult | null): void {
  preHousingResult = result;
}

export function getPreHousingResult(): PreHousingResult | null {
  return preHousingResult;
}

export function setHousingTestResult(result: HousingTestResult | null): void {
  housingTestResult = result;
}

export function getHousingTestResult(): HousingTestResult | null {
  return housingTestResult;
}

export function setHousingCalculationResult(result: HousingCalculationResult | null): void {
  housingCalculationResult = result;
}

export function getHousingCalculationResult(): HousingCalculationResult | null {
  return housingCalculationResult;
}

export function clearHousingResults(): void {
  preHousingResult = null;
  housingTestResult = null;
}

export function clearHousingSession(): void {
  clearHousingResults();
  housingCalculationResult = null;
  housingScenario = null;
}
