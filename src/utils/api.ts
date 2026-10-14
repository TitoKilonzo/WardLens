const API_URL = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:4000/api';
const TOKEN_KEY = 'wardlens.token';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 500) { super(message); this.name = 'ApiError'; this.status = status; }
}
export function getToken(): string | null { return localStorage.getItem(TOKEN_KEY); }
export function setToken(token: string | null): void { if (token) localStorage.setItem(TOKEN_KEY, token); else localStorage.removeItem(TOKEN_KEY); }
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  let response: Response;
  try { response = await fetch(`${API_URL}${path}`, { ...options, headers }); }
  catch { throw new ApiError('Could not connect to WardLens. Check that the API server is running.', 0); }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(body.error || `Request failed (${response.status}).`, response.status);
  return body as T;
}
export function jsonBody(value: unknown): string { return JSON.stringify(value); }
