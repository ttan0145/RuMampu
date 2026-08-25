import { HousingCalculationResult, HousingTestResult, PreHousingResult } from '../types/housing';

let preHousingResult: PreHousingResult | null = null;
let housingTestResult: HousingTestResult | null = null;
let housingCalculationResult: HousingCalculationResult | null = null;

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

export function clearHousingSession(): void {
  preHousingResult = null;
  housingTestResult = null;
  housingCalculationResult = null;
}
