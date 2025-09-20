const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  skipJson?: boolean;
}

export interface ApiErrorPayload {
  message?: string;
  errors?: Record<string, unknown>;
  [key: string]: unknown;
}

export class ApiError extends Error {
  readonly status: number;
  readonly payload?: ApiErrorPayload | string | null;

  constructor(status: number, payload?: ApiErrorPayload | string | null, message?: string) {
    super(message ?? (typeof payload === 'string' ? payload : payload?.message) ?? 'API request failed');
    this.status = status;
    this.payload = payload;
  }
}

const ensureBaseUrl = () => {
  if (!API_BASE_URL) {
    throw new Error('API base URL is not configured. Please set VITE_API_BASE_URL in the environment.');
  }

  return API_BASE_URL;
};

const buildUrl = (path: string, query?: RequestOptions['query']) => {
  const base = ensureBaseUrl();
  const url = new URL(path.startsWith('http') ? path : `${base}/${path.replace(/^\//, '')}`);

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });
  }

  return url.toString();
};

const normaliseBody = (body: RequestOptions['body']) => {
  if (body === undefined || body === null) {
    return undefined;
  }

  if (body instanceof FormData || body instanceof URLSearchParams) {
    return body;
  }

  return JSON.stringify(body);
};

const resolveHeaders = (body: RequestOptions['body']): HeadersInit => {
  if (body instanceof FormData || body instanceof URLSearchParams || body === undefined || body === null) {
    return {};
  }

  return { 'Content-Type': 'application/json' };
};

export async function request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { query, body, headers, skipJson, ...rest } = options;
  const url = buildUrl(path, query);

  const response = await fetch(url, {
    ...rest,
    headers: {
      ...resolveHeaders(body),
      ...headers,
    },
    body: normaliseBody(body),
  });

  if (options.method === 'HEAD') {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type') ?? '';
  const isJson = !skipJson && contentType.includes('application/json');
  const payload = isJson ? await response.json().catch(() => null) : await response.text().catch(() => null);

  if (!response.ok) {
    throw new ApiError(response.status, payload, response.statusText);
  }

  return payload as T;
}

export const apiClient = {
  get: <T = unknown>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'GET' }),
  post: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) => request<T>(path, { ...options, method: 'POST', body }),
  put: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) => request<T>(path, { ...options, method: 'PUT', body }),
  patch: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) => request<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T = unknown>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'DELETE' }),
};

export type PaginatedResponse<T> = {
  data: T[];
  count?: number;
  totalCount?: number;
  pagination?: {
    limit?: number;
    offset?: number;
    hasMore?: boolean;
  };
  [key: string]: unknown;
};
