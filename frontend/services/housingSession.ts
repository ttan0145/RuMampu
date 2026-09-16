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
let onHousingSessionChange: (() => void) | null = null;

function notifyHousingSessionChange(): void {
  onHousingSessionChange?.();
}

export function subscribeHousingSession(listener: () => void): () => void {
  onHousingSessionChange = listener;
  return () => {
    if (onHousingSessionChange === listener) onHousingSessionChange = null;
  };
}

function validObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function validHousingTest(value: unknown): value is HousingTestResult {
  if (!validObject(value) || !Array.isArray(value.months) || !validObject(value.starting_liquidity)) return false;
  return typeof value.scenario_id === 'number'
    && typeof value.tested_home_cost === 'number'
    && typeof value.starting_liquidity.required_amount === 'number'
    && value.months.every(validObject)
    && Array.isArray(value.starting_liquidity.months)
    && value.starting_liquidity.months.every(validObject);
}

function validHousingScenario(value: unknown): value is HousingScenarioResponse {
  return validObject(value) && typeof value.id === 'number';
}

export function setHousingScenario(result: HousingScenarioResponse | null): void {
  housingScenario = result;
  notifyHousingSessionChange();
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
  notifyHousingSessionChange();
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
  notifyHousingSessionChange();
}

/** Restore only persisted test/scenario results. Derived pre-housing and
 * calculation results are deliberately recomputed from the current record.
 * A restored result may be stale if the record changed since it was computed;
 * staleness detection is intentionally deferred rather than silently guessed. */
export function hydrateHousingSession(result: unknown, scenario: unknown): void {
  const validPair = validHousingTest(result) && validHousingScenario(scenario);
  housingTestResult = validPair ? result : null;
  housingScenario = validPair ? scenario : null;
  notifyHousingSessionChange();
}

// Short alias for startup callers that treat this module as a session store.
export const hydrate = hydrateHousingSession;
