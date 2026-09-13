import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const configuredAppMode = process.env.EXPO_PUBLIC_API_URL;

export const APP_MODE: 'api' | 'prototype' = configuredAppMode === 'prototype'
  ? 'prototype'
  : 'api';
export const INCOME_API_ENABLED = APP_MODE === 'api';

const API_ROOT = (
  process.env.EXPO_PUBLIC_E2E === '1'
    ? process.env.EXPO_PUBLIC_PLAYWRIGHT_API_URL
    : process.env.EXPO_PUBLIC_API_URL
) || 'http://localhost:8000/api/v1';

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

export interface ApiWorkCostCategory {
  id: number;
  slug: string;
  name: string;
  is_custom: boolean;
  is_active: boolean;
  legacy_monthly_amount: string;
}

export interface ApiWorkCostEntry {
  id: number;
  category_id: number;
  category_name: string;
  amount: string;
  date: string;
  created_at: string;
  updated_at: string;
}

export interface ApiWorkCostMonthSummary {
  month: string;
  income_recorded: boolean;
  gross_income: string;
  work_cost_total: string;
  income_after_work_costs: string | null;
  available_months: string[];
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
  work_cost_basis: 'recorded_entries_by_month';
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

export interface ApiUser {
  id: number;
  username: string;
  email: string;
}

export interface ApiAuthState {
  user: ApiUser;
  onboarding_completed: boolean;
  preferred_language: 'en' | 'ms' | 'zh' | '';
}

export interface ApiAuthResponse extends ApiAuthState {
  token: string;
}

let nativeAuthToken: string | null = null;
let nativeAuthStorageLoaded = Platform.OS === 'web';
const AUTH_TOKEN_KEY = 'rumampu_auth_token';
const CLIENT_ID_KEY = 'rumampu_client_id';

export async function initializeAuthStorage(): Promise<void> {
  if (Platform.OS === 'web' || nativeAuthStorageLoaded) return;
  nativeAuthToken = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
  nativeAuthStorageLoaded = true;
}

async function storedAuthToken(): Promise<string | null> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.localStorage.getItem(AUTH_TOKEN_KEY);
  }
  await initializeAuthStorage();
  return nativeAuthToken;
}

async function storeAuthToken(token: string | null): Promise<void> {
  nativeAuthToken = token;
  nativeAuthStorageLoaded = true;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (token) window.localStorage.setItem(AUTH_TOKEN_KEY, token);
    else window.localStorage.removeItem(AUTH_TOKEN_KEY);
    return;
  }
  if (token) await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
  else await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
}

function newClientId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

async function storedClientId(): Promise<string | null> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.localStorage.getItem(CLIENT_ID_KEY);
  }
  return SecureStore.getItemAsync(CLIENT_ID_KEY);
}

async function storeClientId(clientId: string): Promise<void> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.localStorage.setItem(CLIENT_ID_KEY, clientId);
    return;
  }
  await SecureStore.setItemAsync(CLIENT_ID_KEY, clientId);
}

export async function rotateGuestClientId(): Promise<string> {
  const clientId = newClientId();
  await storeClientId(clientId);
  return clientId;
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
  if (!payload || typeof payload !== 'object') return null;

  // RuMampu's wrapped API errors.
  if ('error' in payload) {
    const error = payload.error;
    if (error && typeof error === 'object') {
      const code = 'code' in error ? String(error.code) : 'request_error';
      const message = 'message' in error
        ? String(error.message)
        : 'The request could not be completed.';
      return { code, message };
    }
  }

  // Django REST Framework serializer errors are returned as a field map, e.g.
  // { source_id: ["..."] } or { date: ["..."] }. Preserve the first
  // useful message instead of hiding it behind "Request failed with 400".
  for (const [field, value] of Object.entries(payload as Record<string, unknown>)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (typeof first === 'string' && first.trim()) {
      return { code: `validation_${field}`, message: first };
    }
    if (first && typeof first === 'object') {
      for (const nested of Object.values(first as Record<string, unknown>)) {
        const nestedFirst = Array.isArray(nested) ? nested[0] : nested;
        if (typeof nestedFirst === 'string' && nestedFirst.trim()) {
          return { code: `validation_${field}`, message: nestedFirst };
        }
      }
    }
  }

  return null;
}

async function getClientId(): Promise<string> {
  let clientId = await storedClientId();
  if (!clientId) {
    clientId = newClientId();
    await storeClientId(clientId);
  }
  return clientId;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData;
  const [clientId, authToken] = await Promise.all([getClientId(), storedAuthToken()]);
  const response = await fetch(`${API_ROOT}${path}`, {
    ...init,
    credentials: 'omit',
    headers: {
      Accept: 'application/json',
      ...(authToken ? { Authorization: `Token ${authToken}` } : {}),
      ...(init?.body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
      ...(clientId ? { 'X-RuMampu-Client-ID': clientId } : {}),
      ...init?.headers,
    },
  });
  const payload = response.status === 204 ? null : await response.json().catch(() => null);
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

export async function login(identifier: string, password: string): Promise<ApiAuthResponse> {
  const result = await request<ApiAuthResponse>('/auth/login/', {
    method: 'POST',
    body: JSON.stringify({ username: identifier, password }),
  });
  await storeAuthToken(result.token);
  return result;
}

export async function register(email: string, password: string): Promise<ApiAuthResponse> {
  const result = await request<ApiAuthResponse>('/auth/register/', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  await storeAuthToken(result.token);
  return result;
}


export function requestPasswordReset(email: string): Promise<{ message: string }> {
  return request<{ message: string }>('/auth/password-reset/', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function confirmPasswordReset(
  uid: string,
  token: string,
  password: string,
): Promise<{ message: string }> {
  return request<{ message: string }>('/auth/password-reset/confirm/', {
    method: 'POST',
    body: JSON.stringify({ uid, token, password }),
  });
}

export function fetchCurrentUser(): Promise<ApiAuthState> {
  return request<ApiAuthState>('/auth/me/');
}

export function savePreferredLanguage(preferred_language: 'en' | 'ms' | 'zh'): Promise<ApiAuthState> {
  return request<ApiAuthState>('/auth/me/', {
    method: 'PATCH',
    body: JSON.stringify({ preferred_language }),
  });
}

export function completeAccountOnboarding(): Promise<ApiAuthState> {
  return request<ApiAuthState>('/auth/me/', {
    method: 'PATCH',
    body: JSON.stringify({ onboarding_completed: true }),
  });
}

export async function logout(): Promise<void> {
  try {
    await request<null>('/auth/logout/', { method: 'POST' });
  } finally {
    await storeAuthToken(null);
  }
}

export async function hasStoredLogin(): Promise<boolean> {
  return Boolean(await storedAuthToken());
}

export async function clearStoredLogin(): Promise<void> {
  await storeAuthToken(null);
}


export function fetchIncomeRecord(): Promise<ApiIncomeRecord> {
  return request<ApiIncomeRecord>('/income/record/');
}

// EN: Epic 2 receives Django-calculated pattern and coverage results through this API boundary.
// 中文：Epic 2 通过此 API 边界接收 Django 计算的收入形态与覆盖结果。
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

/**
 * EN: US1.1/US1.2 posts income facts; AC1.1.10 requires confirm_outlier for an accepted warning.
 * 中文：US1.1/US1.2 提交收入事实；AC1.1.10 的警告只有在 confirm_outlier 后才接受。
 */
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

export function updateIncomeEntry(
  id: string,
  input: { amount: number; date: string; sourceId?: string },
): Promise<ApiIncomeEntry> {
  const entryId = Number.parseInt(id, 10);
  if (!Number.isFinite(entryId)) {
    return Promise.reject(new Error('The selected income entry is not available in the API record.'));
  }
  const sourceId = input.sourceId == null ? null : Number.parseInt(input.sourceId, 10);
  return request<ApiIncomeEntry>(`/income/entries/${entryId}/`, {
    method: 'PATCH',
    body: JSON.stringify({
      amount: input.amount.toFixed(2),
      date: input.date,
      ...(sourceId === null || !Number.isFinite(sourceId) ? {} : { source_id: sourceId }),
    }),
  });
}

export function updateHistoricalIncomeEntry(
  id: string,
  input: { amount: number; date: string },
): Promise<ApiIncomeEntry> {
  return updateIncomeEntry(id, input);
}

export function deleteIncomeEntry(id: string): Promise<void> {
  const entryId = Number.parseInt(id, 10);
  if (!Number.isFinite(entryId)) {
    return Promise.reject(new Error('The selected income entry is not available in the API record.'));
  }
  return request<void>(`/income/entries/${entryId}/`, { method: 'DELETE' });
}

export function isOutlierConfirmation(error: unknown): boolean {
  if (!(error instanceof ApiError) || error.status !== 409) return false;
  return error.code === 'income_outlier_confirmation_required';
}

export function fetchWorkCostCategories(): Promise<ApiWorkCostCategory[]> {
  return request<ApiWorkCostCategory[]>('/work-costs/');
}

export function createWorkCostCategory(name: string): Promise<ApiWorkCostCategory> {
  return request<ApiWorkCostCategory>('/work-costs/', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function fetchWorkCostEntries(): Promise<ApiWorkCostEntry[]> {
  return request<ApiWorkCostEntry[]>('/work-costs/entries/');
}

export function fetchWorkCostMonthSummary(month?: string): Promise<ApiWorkCostMonthSummary> {
  const query = month ? `?month=${encodeURIComponent(month)}` : '';
  return request<ApiWorkCostMonthSummary>(`/work-costs/summary/${query}`);
}

export function createWorkCostEntry(input: {
  categoryId: string;
  amount: number;
  date: string;
}): Promise<ApiWorkCostEntry> {
  const categoryId = Number.parseInt(input.categoryId, 10);
  if (!Number.isFinite(categoryId)) {
    return Promise.reject(new Error('The selected work-cost category is not available in the API record.'));
  }
  return request<ApiWorkCostEntry>('/work-costs/entries/', {
    method: 'POST',
    body: JSON.stringify({ category_id: categoryId, amount: input.amount.toFixed(2), date: input.date }),
  });
}

export function updateWorkCostEntry(
  id: string,
  input: { categoryId?: string; amount?: number; date?: string },
): Promise<ApiWorkCostEntry> {
  const entryId = Number.parseInt(id, 10);
  if (!Number.isFinite(entryId)) {
    return Promise.reject(new Error('The selected work-cost entry is not available in the API record.'));
  }
  const categoryId = input.categoryId == null ? undefined : Number.parseInt(input.categoryId, 10);
  return request<ApiWorkCostEntry>(`/work-costs/entries/${entryId}/`, {
    method: 'PATCH',
    body: JSON.stringify({
      ...(Number.isFinite(categoryId) ? { category_id: categoryId } : {}),
      ...(input.amount == null ? {} : { amount: input.amount.toFixed(2) }),
      ...(input.date == null ? {} : { date: input.date }),
    }),
  });
}

export function fetchCommitments(): Promise<ApiCommitmentItem[]> {
  return request<ApiCommitmentItem[]>('/commitments/');
}

// EN: US1.4 edits one server-owned commitment while Django retains grouping and validation.
// 中文：US1.4 每次编辑一项服务端承诺，由 Django 保持分组与校验规则。
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

// EN: US1.5/US1.7 share the same persisted category and expense endpoints.
// 中文：US1.5/US1.7 共用同一组持久化类别与支出端点。
export function createExpenseCategory(name: string): Promise<ApiExpenseCategory> {
  return request<ApiExpenseCategory>('/expense-categories/', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function fetchExpenses(): Promise<ApiExpenseEntry[]> {
  return request<ApiExpenseEntry[]>('/expenses/');
}

export interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function assistantChat(
  messages: AssistantMessage[],
  language: string,
): Promise<{ reply: string }> {
  return request<{ reply: string }>('/assistant/chat/', {
    method: 'POST',
    body: JSON.stringify({ messages, language }),
  });
}

export interface ApiReceiptScanResult {
  is_receipt: boolean;
  merchant: string | null;
  date: string | null;
  total: string | null;
  category_slug: string | null;
}

export function scanReceipt(imageBase64: string, mediaType: string): Promise<ApiReceiptScanResult> {
  return request<ApiReceiptScanResult>('/expenses/receipt-scan/', {
    method: 'POST',
    body: JSON.stringify({ image_base64: imageBase64, media_type: mediaType }),
  });
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
  // EN: US1.8 uploads a preview only; confirmation is a separate explicit request below.
  // 中文：US1.8 此处只上传并生成预览；确认是下面独立的显式请求。
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

export function updateIncomeImportRow(
  batchId: number,
  rowId: number,
  input: { amount: string; date: string; source: string },
): Promise<ApiIncomeImportBatch> {
  return request<ApiIncomeImportBatch>(`/income-imports/${batchId}/rows/${rowId}/`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function confirmIncomeImport(batchId: number): Promise<ApiIncomeImportBatch> {
  return request<ApiIncomeImportBatch>(`/income-imports/${batchId}/confirm/`, {
    method: 'POST',
  });
}
