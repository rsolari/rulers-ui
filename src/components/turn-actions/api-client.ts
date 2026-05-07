interface ApiErrorPayload {
  error?: unknown;
}

function getErrorMessage(data: unknown) {
  if (typeof data === 'object' && data !== null && 'error' in data) {
    const { error } = data as ApiErrorPayload;
    if (typeof error === 'string' && error.trim()) {
      return error;
    }
  }

  return 'Request failed';
}

export async function parseResponse<T>(response: Response): Promise<T> {
  const data = await response.json() as unknown;
  if (!response.ok) {
    throw new Error(getErrorMessage(data));
  }

  return data as T;
}

export async function parseOptionalResponse<T>(response: Response): Promise<T | null> {
  if (!response.ok) return null;
  return response.json() as Promise<T>;
}
