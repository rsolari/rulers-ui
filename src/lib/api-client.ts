export interface ApiClientErrorPayload {
  error: string;
  code?: string;
  details?: unknown;
  blockers?: Array<{
    id: string;
    displayName?: string | null;
    missingRequirements?: string[];
  }>;
}

interface ApiClientErrorOptions {
  status: number;
  code?: string;
  details?: unknown;
  blockers?: ApiClientErrorPayload['blockers'];
  payload?: unknown;
}

export class ApiClientError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  blockers?: ApiClientErrorPayload['blockers'];
  payload?: unknown;

  constructor(message: string, options: ApiClientErrorOptions) {
    super(message);
    this.name = 'ApiClientError';
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
    this.blockers = options.blockers;
    this.payload = options.payload;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function formatBlockers(blockers: ApiClientErrorPayload['blockers']) {
  if (!Array.isArray(blockers) || blockers.length === 0) {
    return '';
  }

  return blockers
    .map((blocker) => {
      const label = blocker.displayName?.trim() || blocker.id;
      const missing = Array.isArray(blocker.missingRequirements)
        ? blocker.missingRequirements.join(', ')
        : '';
      return missing ? `${label}: ${missing}` : label;
    })
    .join(' · ');
}

function parsePayload(data: unknown): Partial<ApiClientErrorPayload> {
  if (!isRecord(data)) {
    return {};
  }

  return {
    error: typeof data.error === 'string' ? data.error : undefined,
    code: typeof data.code === 'string' ? data.code : undefined,
    details: data.details,
    blockers: Array.isArray(data.blockers)
      ? data.blockers.filter((blocker): blocker is NonNullable<ApiClientErrorPayload['blockers']>[number] => (
        isRecord(blocker) && typeof blocker.id === 'string'
      )).map((blocker) => ({
        id: blocker.id,
        displayName: typeof blocker.displayName === 'string' || blocker.displayName === null
          ? blocker.displayName
          : undefined,
        missingRequirements: Array.isArray(blocker.missingRequirements)
          ? blocker.missingRequirements.filter((item): item is string => typeof item === 'string')
          : undefined,
      }))
      : undefined,
  };
}

async function readResponseBody(response: Response): Promise<unknown> {
  if (typeof response.text === 'function') {
    const text = await response.text();
    if (!text.trim()) {
      return undefined;
    }
    return JSON.parse(text);
  }

  if (typeof response.json === 'function') {
    return response.json();
  }

  return undefined;
}

export async function parseApiResponse<T>(response: Response, fallback: string): Promise<T> {
  let data: unknown;

  try {
    data = response.status === 204 ? undefined : await readResponseBody(response);
  } catch {
    if (!response.ok) {
      throw new ApiClientError(fallback, { status: response.status });
    }
    throw new ApiClientError(fallback, { status: response.status });
  }

  if (!response.ok) {
    const payload = parsePayload(data);
    const error = payload.error?.trim();
    const blockerSummary = formatBlockers(payload.blockers);
    const message = error
      ? blockerSummary ? `${error} - ${blockerSummary}` : error
      : fallback;

    throw new ApiClientError(message, {
      status: response.status,
      code: payload.code,
      details: payload.details,
      blockers: payload.blockers,
      payload: data,
    });
  }

  return data as T;
}

export async function requestJson<T>(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  fallback: string,
): Promise<T> {
  try {
    return await parseApiResponse<T>(await fetch(input, init), fallback);
  } catch (error) {
    if (error instanceof ApiClientError) {
      throw error;
    }

    throw new ApiClientError(fallback, { status: 0 });
  }
}

export function getApiErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}
