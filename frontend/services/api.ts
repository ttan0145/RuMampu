import { apiIdentityHeaders } from '../src/rumampu/api';

const API_ROOT = (
  process.env.EXPO_PUBLIC_E2E === '1'
    ? process.env.EXPO_PUBLIC_PLAYWRIGHT_API_URL
    : process.env.EXPO_PUBLIC_API_URL
) || 'http://localhost:8000/api/v1';

export class ApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const identityHeaders = await apiIdentityHeaders();
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;

  const response = await fetch(`${API_ROOT}${path}`, {
    ...init,
    credentials: 'omit',
    headers: {
      Accept: 'application/json',
      ...(init.body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
      ...identityHeaders,
      ...(init.headers || {}),
    },
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new ApiError(`API request failed (${response.status})`, response.status, body);
  }
  return body as T;
}

export { API_ROOT };
