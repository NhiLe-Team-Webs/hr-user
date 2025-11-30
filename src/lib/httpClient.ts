const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  skipJson?: boolean;
  skipAuthRedirect?: boolean;
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
    throw new Error('API base URL is not configured. Please set VITE_API_URL in the environment.');
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
  const headers: HeadersInit = {};

  // Add Content-Type for JSON bodies
  if (!(body instanceof FormData || body instanceof URLSearchParams || body === undefined || body === null)) {
    headers['Content-Type'] = 'application/json';
  }

  // Add Authorization header if token exists
  const accessToken = localStorage.getItem('access_token');
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  return headers;
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
    // Handle 401 Unauthorized - token expired or invalid
    if (response.status === 401) {
      console.error('[httpClient] 401 Unauthorized for URL:', url);

      if (options.skipAuthRedirect) {
        throw new ApiError(response.status, payload, response.statusText);
      }

      // Try to refresh the token
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const refreshUrl = `${API_BASE_URL}/hr/auth/refresh`;
          const refreshResponse = await fetch(refreshUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refresh_token: refreshToken }),
          });

          if (refreshResponse.ok) {
            const refreshData = await refreshResponse.json();
            if (refreshData.success && refreshData.data?.session) {
              // Store new tokens
              localStorage.setItem('access_token', refreshData.data.session.access_token);
              localStorage.setItem('refresh_token', refreshData.data.session.refresh_token);

              // Retry the original request with new token
              const retryHeaders = {
                ...resolveHeaders(body),
                'Authorization': `Bearer ${refreshData.data.session.access_token}`,
                ...headers,
              };

              const retryResponse = await fetch(url, {
                ...rest,
                headers: retryHeaders,
                body: normaliseBody(body),
              });

              if (retryResponse.ok) {
                const retryContentType = retryResponse.headers.get('content-type') ?? '';
                const retryIsJson = !skipJson && retryContentType.includes('application/json');
                const retryPayload = retryIsJson ? await retryResponse.json().catch(() => null) : await retryResponse.text().catch(() => null);
                return retryPayload as T;
              }
            }
          }
        } catch (refreshError) {
          console.error('[httpClient] Token refresh failed:', refreshError);
        }
      }

      // Clear tokens and redirect to login
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');

      // Trigger a page reload to clear state and redirect to login
      console.warn('[httpClient] 401 Unauthorized - tokens cleared, redirecting to login');
      window.location.href = '/login';
    }

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
