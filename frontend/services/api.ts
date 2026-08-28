import { Platform } from 'react-native';

const API_ROOT = (
  process.env.EXPO_PUBLIC_API_URL ||
  'http://localhost:8000/api/v1'
).replace(/\/$/, '');

function getClientId(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return null;
  }

  const storageKey = 'rumampu_client_id';
  let clientId = window.localStorage.getItem(storageKey);

  if (!clientId) {
    clientId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(storageKey, clientId);
  }

  return clientId;
}

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
  const clientId = getClientId();

  const response = await fetch(`${API_ROOT}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(clientId ? { 'X-RuMampu-Client-ID': clientId } : {}),
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
