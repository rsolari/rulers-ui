import { ApiClientError, parseApiResponse } from '@/lib/api-client';

export async function readErrorMessage(response: Response, fallback: string) {
  try {
    await parseApiResponse<unknown>(response, fallback);
  } catch (error) {
    if (error instanceof ApiClientError) {
      return error.message;
    }
  }

  return fallback;
}
