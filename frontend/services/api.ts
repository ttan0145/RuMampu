import { Platform } from 'react-native';

const DEPLOYED_API_ROOT = 'https://rumampu.vercel.app/api/v1';
const LOCAL_API_ROOT = 'http://localhost:8000/api/v1';

function isPrivateOrLocalApi(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return true;
    if (hostname.startsWith('10.') || hostname.startsWith('192.168.')) return true;
    const match = hostname.match(/^172\.(\d+)\./);
    return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
  } catch {
    return false;
  }
}

function resolveApiRoot(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const hostname = window.location.hostname;

    // Local browser testing
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:8000/api/v1';
    }

    // Deployed web
    return configured && !isPrivateOrLocalApi(configured)
      ? configured
      : 'https://rumampu.vercel.app/api/v1';
  }

  // Expo Go / native testing
  return configured || 'http://localhost:8000/api/v1';
}

const API_ROOT = resolveApiRoot().replace(/\/$/, '');

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
  const response = await fetch(`${API_ROOT}${path}`, {
    ...init,
    credentials: 'include',
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

export { API_ROOT };
