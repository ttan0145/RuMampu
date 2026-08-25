const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1').replace(/\/$/, '');

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
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
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

export { API_BASE_URL };
