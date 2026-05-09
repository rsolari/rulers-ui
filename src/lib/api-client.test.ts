import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError, parseApiResponse, requestJson } from './api-client';

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('api-client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses successful JSON responses', async () => {
    await expect(parseApiResponse<{ ok: true }>(jsonResponse({ ok: true }), 'Failed')).resolves.toEqual({ ok: true });
  });

  it('parses successful empty responses', async () => {
    await expect(parseApiResponse<undefined>(new Response(null, { status: 204 }), 'Failed')).resolves.toBeUndefined();
  });

  it('throws parsed error payloads', async () => {
    await expect(parseApiResponse(jsonResponse({ error: 'No access' }, { status: 403 }), 'Failed'))
      .rejects.toMatchObject({
        name: 'ApiClientError',
        message: 'No access',
        status: 403,
      });
  });

  it('preserves code and details on API errors', async () => {
    const details = { field: 'name' };

    await expect(parseApiResponse(jsonResponse({
      error: 'Invalid realm',
      code: 'invalid_realm',
      details,
    }, { status: 409 }), 'Failed')).rejects.toMatchObject({
      message: 'Invalid realm',
      code: 'invalid_realm',
      details,
    });
  });

  it('adds blocker summaries to error messages', async () => {
    await expect(parseApiResponse(jsonResponse({
      error: 'Setup is incomplete',
      blockers: [
        { id: 'ruler', displayName: 'Ruler', missingRequirements: ['create ruler'] },
      ],
    }, { status: 400 }), 'Failed')).rejects.toThrow('Setup is incomplete - Ruler: create ruler');
  });

  it('uses the fallback for non-JSON error bodies', async () => {
    await expect(parseApiResponse(new Response('<html></html>', { status: 500 }), 'Server failed'))
      .rejects.toThrow('Server failed');
  });

  it('wraps network failures with the workflow fallback', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));

    await expect(requestJson('/api/test', { method: 'POST' }, 'Could not save'))
      .rejects.toMatchObject({
        name: 'ApiClientError',
        message: 'Could not save',
        status: 0,
      } satisfies Partial<ApiClientError>);
  });
});
