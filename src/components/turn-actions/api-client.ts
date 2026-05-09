import { parseApiResponse } from '@/lib/api-client';

export async function parseResponse<T>(response: Response): Promise<T> {
  return parseApiResponse<T>(response, 'Request failed');
}

export async function parseOptionalResponse<T>(response: Response): Promise<T | null> {
  if (!response.ok) return null;
  return parseApiResponse<T>(response, 'Request failed');
}
