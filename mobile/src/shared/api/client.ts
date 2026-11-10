// JSON client for the REST API. Every request carries the Cognito ID token; a 401 asks the session
// for a fresh token once and repeats the request (docs/app/README.md § Login con Cognito).

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

type ClientOptions = {
  baseUrl: string;
  getIdToken: () => Promise<string | null>;
  /** Called after a 401. Resolves true when a fresh token is available and the request can be repeated. */
  onUnauthorized?: () => Promise<boolean>;
  fetch?: Fetch;
};

type Method = "GET" | "POST" | "PATCH" | "DELETE";

export function createApiClient({
  baseUrl,
  getIdToken,
  onUnauthorized,
  fetch = globalThis.fetch,
}: ClientOptions) {
  async function send(method: Method, path: string, body: unknown) {
    const token = await getIdToken();
    const headers: Record<string, string> = { Accept: "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    return fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
    let response = await send(method, path, body);
    if (response.status === 401 && onUnauthorized && (await onUnauthorized())) {
      response = await send(method, path, body);
    }

    const text = await response.text();
    const data: unknown = text ? JSON.parse(text) : undefined;
    if (!response.ok) throw new ApiError(response.status, errorMessage(response.status, data));
    return data as T;
  }

  return {
    get: <T>(path: string) => request<T>("GET", path),
    post: <T>(path: string, body?: unknown) => request<T>("POST", path, body ?? {}),
    patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
    delete: (path: string) => request<void>("DELETE", path),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

// FastAPI sends {"detail": "..."} for handled errors and {"detail": [...]} for validation errors.
function errorMessage(status: number, data: unknown): string {
  const detail = (data as { detail?: unknown } | undefined)?.detail;
  if (typeof detail === "string") return detail;
  return status === 422 ? "Invalid request." : `Request failed (${status}).`;
}
