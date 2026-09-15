import { apiIdentityHeaders, API_ROOT, requestTimeoutMs } from '../src/rumampu/api';

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

/* Same guard as the main client (25s reads, 60s writes): a stalled request
   becomes a caught timeout instead of a button that spins forever, without
   aborting a slow-but-successful save. */
export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const identityHeaders = await apiIdentityHeaders();
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), requestTimeoutMs(init));
  let response: Response;
  try {
    response = await fetch(`${API_ROOT}${path}`, {
      ...init,
      credentials: 'omit',
      signal: init.signal ?? controller.signal,
      headers: {
        Accept: 'application/json',
        ...(init.body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
        ...identityHeaders,
        ...(init.headers || {}),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError('The request timed out. Check your connection and try again.', 0, null);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new ApiError(`API request failed (${response.status})`, response.status, body);
  }
  return body as T;
}

export { API_ROOT };
