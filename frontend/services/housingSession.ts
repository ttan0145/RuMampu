import { AppData } from '../src/rumampu/mock';
import {
  carryRange, commitFor, extrasTotal, monthsAgg, priceForInstalment, totalHomeCost,
} from '../src/rumampu/calc';
import { HousingTestResult, PreHousingResult } from '../types/housing';

let preHousingResult: PreHousingResult | null = null;
let housingTestResult: HousingTestResult | null = null;

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

/**
 * Epic 3 session-only calculation.
 * Reads the finance values already loaded into AppData, but does not persist any
 * housing scenario or result to Django/Neon.
 */
export function calculateHousingSession(data: AppData): {
  preHousing: PreHousingResult;
  housingTest: HousingTestResult;
} {
  const baseMonths = monthsAgg(data);
  const homeCost = totalHomeCost(data);

  const preMonths = baseMonths.map(row => {
    const existingCosts = commitFor(data, row.y * 12 + row.m);
    const shortfall = Math.max(0, -row.surplus);
    return {
      year: row.y,
      month: row.m + 1,
      gross_income: row.gross,
      usable_income: row.net,
      existing_costs: existingCosts,
      surplus: row.surplus,
      shortfall,
    };
  });

  const existingRows = preMonths.filter(row => row.shortfall > 0);
  const worst = existingRows.reduce<(typeof preMonths)[number] | null>(
    (current, row) => (!current || row.shortfall > current.shortfall ? row : current),
    null,
  );

  const preHousing: PreHousingResult = {
    provenance: 'calculated_from_user_record',
    work_cost_basis: 'current_active_monthly_snapshot',
    has_existing_shortfall: existingRows.length > 0,
    tested_months: preMonths.length,
    largest_existing_gap: worst?.shortfall ?? 0,
    worst_month: worst ? { year: worst.year, month: worst.month } : null,
    months: preMonths,
  };

  const months = preMonths.map(row => {
    const available = row.surplus;
    const postHousingResidual = available - homeCost;
    const totalShortfall = Math.max(0, -postHousingResidual);
    const existingShortfall = Math.max(0, -available);
    const housingCreatedShortfall = available >= 0 ? totalShortfall : 0;
    const housingAddedGap = Math.max(0, totalShortfall - existingShortfall);
    const shortfallType = totalShortfall <= 0
      ? 'none' as const
      : existingShortfall > 0
        ? 'existing_and_worsened_by_housing' as const
        : 'housing_created' as const;

    return {
      ...row,
      available_for_home: available,
      tested_home_cost: homeCost,
      post_housing_residual: postHousingResidual,
      is_short: totalShortfall > 0,
      existing_shortfall: existingShortfall,
      housing_created_shortfall: housingCreatedShortfall,
      housing_added_gap: housingAddedGap,
      total_shortfall: totalShortfall,
      shortfall_type: shortfallType,
      housing_shortfall: housingCreatedShortfall,
    };
  });

  const shortRows = months.filter(row => row.is_short);
  const existingShortRows = months.filter(row => row.existing_shortfall > 0);
  const housingCreatedRows = months.filter(row => row.shortfall_type === 'housing_created');

  const range = carryRange(data);
  let carryingRange: HousingTestResult['carrying_range'] = null;
  if (range) {
    const extras = extrasTotal(data);
    const lowerMortgagePayment = Math.max(0, range.lo - extras);
    const upperMortgagePayment = Math.max(0, range.hi - extras);
    carryingRange = {
      lower_monthly_amount: range.lo,
      upper_monthly_amount: range.hi,
      tested_monthly_home_cost: homeCost,
      lower_meaning: 'Every recorded month covered this amount.',
      upper_meaning: 'Half of the recorded months covered this amount.',
      indicative_property_price_lower: Math.max(0, priceForInstalment(data, lowerMortgagePayment) + data.house.deposit),
      indicative_property_price_upper: Math.max(0, priceForInstalment(data, upperMortgagePayment) + data.house.deposit),
      property_price_limitation: 'Indicative only. Not a valuation, not an offer.',
    };
  }

  const housingTest: HousingTestResult = {
    scenario_id: 0,
    tested_home_cost: homeCost,
    tested_months: months.length,
    short_month_count: shortRows.length,
    existing_short_month_count: existingShortRows.length,
    housing_created_short_month_count: housingCreatedRows.length,
    largest_gap: Math.max(0, ...months.map(row => row.total_shortfall)),
    largest_existing_gap: Math.max(0, ...months.map(row => row.existing_shortfall)),
    largest_housing_created_gap: Math.max(0, ...months.map(row => row.housing_created_shortfall)),
    months,
    carrying_range: carryingRange,
  };

  preHousingResult = preHousing;
  housingTestResult = housingTest;
  return { preHousing, housingTest };
}

/** Convert a compared total monthly home cost into an indicative property value. */
export function indicativePriceForComparedPayment(data: AppData, totalMonthlyHomeCost: number): number {
  const mortgagePayment = Math.max(0, totalMonthlyHomeCost - extrasTotal(data));
  return Math.max(0, priceForInstalment(data, mortgagePayment) + data.house.deposit);
}

export function clearHousingSession(): void {
  preHousingResult = null;
  housingTestResult = null;
}
