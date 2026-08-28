const configuredApiUrl = (
  process.env.EXPO_PUBLIC_PLAYWRIGHT_TEST_MODE === 'true'
    ? process.env.EXPO_PUBLIC_PLAYWRIGHT_API_URL
    : process.env.EXPO_PUBLIC_API_URL
)?.trim();
const configuredAppMode = process.env.EXPO_PUBLIC_APP_MODE?.trim().toLowerCase();

export const APP_MODE: 'api' | 'prototype' = configuredAppMode === 'prototype'
  ? 'prototype'
  : 'api';
export const INCOME_API_ENABLED = APP_MODE === 'api';
const API_ROOT = (configuredApiUrl || 'http://127.0.0.1:8000/api/v1').replace(/\/$/, '');

export interface ApiIncomeSource {
  id: number;
  slug: string;
  name: string;
  is_custom: boolean;
  is_active: boolean;
}

export interface ApiIncomeEntry {
  id: number;
  amount: string;
  date: string;
  source_id: number | null;
  entry_method: 'manual' | 'historical_total' | 'import';
  created_at: string;
}

export interface ApiIncomeRecord {
  profile_id: string;
  recorded_month_count: number;
  sources: ApiIncomeSource[];
  entries: ApiIncomeEntry[];
}

export interface ApiWorkCostItem {
  id: number;
  slug: string;
  name: string;
  monthly_amount: string;
  is_custom: boolean;
  is_active: boolean;
  updated_at: string;
}

export interface ApiCommitmentItem {
  id: number;
  commitment_type: 'living' | 'debt' | 'savings';
  slug: string;
  name: string;
  monthly_amount: string;
  is_daily_variable: boolean;
  is_active: boolean;
  updated_at: string;
}

export interface ApiExpenseCategory {
  id: number;
  slug: string;
  name: string;
  is_custom: boolean;
  is_active: boolean;
}

export interface ApiExpenseEntry {
  id: number;
  amount: string;
  date: string;
  category_id: number;
  entry_method: 'manual' | 'receipt';
  merchant: string;
  user_confirmed: boolean;
  created_at: string;
}

export interface ApiIncomeImportRow {
  id: number;
  row_number: number;
  raw_amount: string;
  raw_date: string;
  raw_source: string;
  amount: string | null;
  date: string | null;
  source_name: string;
  is_valid: boolean;
  error_code: string;
  error_message: string;
  imported_entry_id: number | null;
}

export interface ApiIncomeImportBatch {
  id: number;
  file_name: string;
  status: 'preview' | 'confirmed';
  total_rows: number;
  ready_count: number;
  error_count: number;
  imported_count: number;
  created_at: string;
  confirmed_at: string | null;
  rows: ApiIncomeImportRow[];
}

export type ApiHistoryDepth = 'empty' | 'one_month' | 'two_months' | 'three_or_more';

export interface ApiIncomePatternMonth {
  month: string;
  gross_income: string;
  work_costs: string;
  usable_income: string;
  is_lowest_recorded: boolean;
}

export interface ApiIncomePatternStatistics {
  average: string;
  median: string;
  highest: string;
  lowest: string;
  range: string;
  standard_deviation: string;
}

export interface ApiIncomePattern {
  recorded_month_count: number;
  history_depth: ApiHistoryDepth;
  provenance: 'calculated_from_user_record';
  monthly_work_cost_total: string;
  work_cost_basis: 'current_active_monthly_snapshot';
  months: ApiIncomePatternMonth[];
  statistics: ApiIncomePatternStatistics | null;
  lower_income: {
    basis: 'recorded_minimum';
    months: string[];
  };
}

export type ApiCoverageAnswer = 'yes' | 'no' | 'not_sure';

export interface ApiIncomeCoverageObservation {
  kind: 'recorded_range';
  recorded_month_count: number;
  lowest: string;
  highest: string;
  range: string;
}

export interface ApiIncomeCoverage {
  answer: ApiCoverageAnswer | null;
  slower_months: number[];
  represented_slower_months: number[];
  unrepresented_slower_months: number[];
  recorded_calendar_months: number[];
  observation: ApiIncomeCoverageObservation | null;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly payload: unknown,
  ) {
    super(message);
  }
}

function apiErrorDetails(payload: unknown): { code: string; message: string } | null {
  if (!payload || typeof payload !== 'object' || !('error' in payload)) return null;
  const error = payload.error;
  if (!error || typeof error !== 'object') return null;
  const code = 'code' in error ? String(error.code) : 'request_error';
  const message = 'message' in error ? String(error.message) : 'The request could not be completed.';
  return { code, message };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData;
  const response = await fetch(`${API_ROOT}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(init?.body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const details = apiErrorDetails(payload);
    throw new ApiError(
      details?.message || `Request failed with status ${response.status}`,
      response.status,
      details?.code || 'request_error',
      payload,
    );
  }
  return payload as T;
}

export function fetchIncomeRecord(): Promise<ApiIncomeRecord> {
  return request<ApiIncomeRecord>('/income/record/');
}

export function fetchIncomePattern(): Promise<ApiIncomePattern> {
  return request<ApiIncomePattern>('/income-pattern/');
}

export function fetchIncomeCoverage(): Promise<ApiIncomeCoverage> {
  return request<ApiIncomeCoverage>('/income-coverage/');
}

export function updateIncomeCoverage(input: {
  answer: ApiCoverageAnswer;
  slowerMonths: number[];
}): Promise<ApiIncomeCoverage> {
  return request<ApiIncomeCoverage>('/income-coverage/', {
    method: 'PUT',
    body: JSON.stringify({
      answer: input.answer,
      slower_months: input.slowerMonths,
    }),
  });
}

export function createIncomeSource(name: string): Promise<ApiIncomeSource> {
  return request<ApiIncomeSource>('/income/sources/', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function createIncomeEntry(input: {
  amount: number;
  date: string;
  sourceId?: string;
  entryMethod?: 'manual' | 'historical_total';
  confirmOutlier?: boolean;
}): Promise<ApiIncomeEntry> {
  const entryMethod = input.entryMethod || 'manual';
  const sourceId = input.sourceId == null ? null : Number.parseInt(input.sourceId, 10);
  if (entryMethod === 'manual' && (sourceId === null || !Number.isFinite(sourceId))) {
    return Promise.reject(new Error('The selected income source is not available in the API record.'));
  }
  return request<ApiIncomeEntry>('/income/entries/', {
    method: 'POST',
    body: JSON.stringify({
      amount: input.amount.toFixed(2),
      date: input.date,
      source_id: sourceId,
      entry_method: entryMethod,
      confirm_outlier: Boolean(input.confirmOutlier),
    }),
  });
}

export function isOutlierConfirmation(error: unknown): boolean {
  if (!(error instanceof ApiError) || error.status !== 409) return false;
  return error.code === 'income_outlier_confirmation_required';
}

export function fetchWorkCosts(): Promise<ApiWorkCostItem[]> {
  return request<ApiWorkCostItem[]>('/work-costs/');
}

export function createWorkCost(input: {
  name: string;
  monthlyAmount: number;
}): Promise<ApiWorkCostItem> {
  return request<ApiWorkCostItem>('/work-costs/', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name,
      monthly_amount: input.monthlyAmount.toFixed(2),
    }),
  });
}

export function updateWorkCost(id: string, monthlyAmount: number): Promise<ApiWorkCostItem> {
  const itemId = Number.parseInt(id, 10);
  if (!Number.isFinite(itemId)) {
    return Promise.reject(new Error('The selected work-cost item is not available in the API record.'));
  }
  return request<ApiWorkCostItem>(`/work-costs/${itemId}/`, {
    method: 'PATCH',
    body: JSON.stringify({ monthly_amount: monthlyAmount.toFixed(2) }),
  });
}

export function fetchCommitments(): Promise<ApiCommitmentItem[]> {
  return request<ApiCommitmentItem[]>('/commitments/');
}

export function updateCommitment(id: string, monthlyAmount: number): Promise<ApiCommitmentItem> {
  const itemId = Number.parseInt(id, 10);
  if (!Number.isFinite(itemId)) {
    return Promise.reject(new Error('The selected commitment is not available in the API record.'));
  }
  return request<ApiCommitmentItem>(`/commitments/${itemId}/`, {
    method: 'PATCH',
    body: JSON.stringify({ monthly_amount: monthlyAmount.toFixed(2) }),
  });
}

export function fetchExpenseCategories(): Promise<ApiExpenseCategory[]> {
  return request<ApiExpenseCategory[]>('/expense-categories/');
}

export function createExpenseCategory(name: string): Promise<ApiExpenseCategory> {
  return request<ApiExpenseCategory>('/expense-categories/', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function fetchExpenses(): Promise<ApiExpenseEntry[]> {
  return request<ApiExpenseEntry[]>('/expenses/');
}

export function createExpense(input: {
  amount: number;
  date: string;
  categoryId: string;
  entryMethod?: 'manual' | 'receipt';
  merchant?: string;
  confirmReceipt?: boolean;
}): Promise<ApiExpenseEntry> {
  const categoryId = Number.parseInt(input.categoryId, 10);
  if (!Number.isFinite(categoryId)) {
    return Promise.reject(new Error('The selected expense category is not available in the API record.'));
  }
  return request<ApiExpenseEntry>('/expenses/', {
    method: 'POST',
    body: JSON.stringify({
      amount: input.amount.toFixed(2),
      date: input.date,
      category_id: categoryId,
      entry_method: input.entryMethod || 'manual',
      merchant: input.merchant || '',
      confirm_receipt: Boolean(input.confirmReceipt),
    }),
  });
}

export function previewIncomeImport(asset: {
  uri: string;
  name: string;
  mimeType?: string | null;
  file?: File;
}): Promise<ApiIncomeImportBatch> {
  const form = new FormData();
  if (asset.file) {
    form.append('file', asset.file, asset.name);
  } else {
    form.append('file', {
      uri: asset.uri,
      name: asset.name,
      type: asset.mimeType || 'text/csv',
    } as unknown as Blob);
  }
  return request<ApiIncomeImportBatch>('/income-imports/preview/', {
    method: 'POST',
    body: form,
  });
}

export function fetchIncomeImport(batchId: number): Promise<ApiIncomeImportBatch> {
  return request<ApiIncomeImportBatch>(`/income-imports/${batchId}/`);
}

export function confirmIncomeImport(batchId: number): Promise<ApiIncomeImportBatch> {
  return request<ApiIncomeImportBatch>(`/income-imports/${batchId}/confirm/`, {
    method: 'POST',
  });
}
