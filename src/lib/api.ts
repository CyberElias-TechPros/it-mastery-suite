/**
 * Typed fetch client for the Cloudflare Workers API.
 *
 * Responsibilities:
 *  - attach the in-memory access token to every call
 *  - transparently refresh an expired access token once per request
 *  - normalise the `{ data, meta }` / `{ error }` envelope into values/throws
 *
 * The access token is deliberately kept in memory only. The refresh token
 * lives in an HttpOnly cookie set by the API, so it is never readable by JS.
 */

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '');

export interface PageMeta {
  page?: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
  [key: string]: unknown;
}

export interface ApiEnvelope<T> {
  data: T;
  meta?: PageMeta;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, string | string[]>;
  readonly requestId?: string;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: Record<string, string | string[]>,
    requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }

  /** First field-level message, useful for inline form errors. */
  get firstFieldError(): string | undefined {
    if (!this.details) return undefined;
    // The API reports field errors as `{ field: string[] }`; flatten to the first message.
    for (const value of Object.values(this.details)) {
      const message = Array.isArray(value) ? value[0] : value;
      if (typeof message === 'string' && message) return message;
    }
    return undefined;
  }
}

type Listener = (token: string | null) => void;

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;
const listeners = new Set<Listener>();

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
  listeners.forEach((listener) => listener(token));
}

/** Notifies subscribers (the auth context) when the session is dropped. */
export function onAuthChange(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

async function parseResponse<T>(response: Response): Promise<ApiEnvelope<T>> {
  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const error = (payload as { error?: { code?: string; message?: string; details?: Record<string, string>; requestId?: string } })
      ?.error;
    throw new ApiError(
      response.status,
      error?.code ?? 'HTTP_ERROR',
      error?.message ?? `Request failed with status ${response.status}`,
      error?.details,
      error?.requestId ?? response.headers.get('x-request-id') ?? undefined,
    );
  }

  return (payload ?? { data: null }) as ApiEnvelope<T>;
}

/** Exchanges the refresh cookie for a new access token. Deduplicated. */
export async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        });
        if (!response.ok) {
          setAccessToken(null);
          return null;
        }
        const body = (await response.json()) as ApiEnvelope<{ accessToken: string }>;
        setAccessToken(body.data.accessToken);
        return body.data.accessToken;
      } catch {
        setAccessToken(null);
        return null;
      } finally {
        // Allow the next caller to start a fresh refresh.
        setTimeout(() => {
          refreshPromise = null;
        }, 0);
      }
    })();
  }
  return refreshPromise;
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  /** JSON body; serialised automatically. */
  json?: unknown;
  /** Raw body (FormData, Blob…) used as-is. */
  body?: BodyInit | null;
  /** Query string parameters; undefined/null/'' entries are dropped. */
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Skip the automatic refresh-and-retry (used by auth endpoints). */
  skipRefresh?: boolean;
}

function buildUrl(path: string, query?: RequestOptions['query']) {
  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<ApiEnvelope<T>> {
  const { json, query, skipRefresh, headers, ...rest } = options;
  const requestHeaders = new Headers(headers);
  let body = options.body ?? undefined;

  if (json !== undefined) {
    requestHeaders.set('content-type', 'application/json');
    body = JSON.stringify(json);
  }
  if (accessToken) requestHeaders.set('authorization', `Bearer ${accessToken}`);

  const url = buildUrl(path, query);
  const send = () => fetch(url, { ...rest, headers: requestHeaders, body, credentials: 'include' });

  let response = await send();

  if (response.status === 401 && !skipRefresh) {
    const token = await refreshAccessToken();
    if (token) {
      requestHeaders.set('authorization', `Bearer ${token}`);
      response = await send();
    }
  }

  return parseResponse<T>(response);
}

/** Convenience helpers returning just the payload. */
export const api = {
  get: async <T>(path: string, query?: RequestOptions['query'], options?: RequestOptions) =>
    (await apiFetch<T>(path, { ...options, method: 'GET', query })).data,
  getPage: <T>(path: string, query?: RequestOptions['query'], options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'GET', query }),
  post: async <T>(path: string, json?: unknown, options?: RequestOptions) =>
    (await apiFetch<T>(path, { ...options, method: 'POST', json })).data,
  put: async <T>(path: string, json?: unknown, options?: RequestOptions) =>
    (await apiFetch<T>(path, { ...options, method: 'PUT', json })).data,
  del: async <T>(path: string, query?: RequestOptions['query'], options?: RequestOptions) =>
    (await apiFetch<T>(path, { ...options, method: 'DELETE', query })).data,
  upload: async <T>(path: string, form: FormData) => (await apiFetch<T>(path, { method: 'POST', body: form })).data,
};

/** Turns any thrown value into a user-facing message. */
export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (error instanceof ApiError) return error.firstFieldError ?? error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
