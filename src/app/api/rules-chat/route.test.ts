import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/rules-chat', () => ({
  buildSystemPrompt: vi.fn(() => 'rules system prompt'),
}));

import { POST } from './route';

const encoder = new TextEncoder();

function jsonRequest(body: unknown) {
  return new Request('http://localhost/api/rules-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function streamResponse(chunks: string[]) {
  return new Response(new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  }));
}

describe('POST /api/rules-chat', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENROUTER_API_KEY = 'test-key';
    vi.stubGlobal('fetch', fetchMock);
  });

  it('streams OpenRouter deltas even when SSE JSON is split across chunks', async () => {
    fetchMock.mockResolvedValue(streamResponse([
      'data: {"choices":[{"delta":{"content":"Hel',
      'lo"}}]}\n',
      'data: {"choices":[{"delta":{"content":" world"}}]}\n',
      'data: [DONE]\n',
    ]));

    const response = await POST(jsonRequest({
      messages: [{ role: 'user', content: '  How does trade work?  ' }],
    }));

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe('Hello world');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(init.body));
    expect(payload.messages).toEqual([
      { role: 'system', content: 'rules system prompt' },
      { role: 'user', content: 'How does trade work?' },
    ]);
  });

  it('rejects non-object JSON bodies before calling the provider', async () => {
    const response = await POST(jsonRequest(null));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects overlarge messages before calling the provider', async () => {
    const response = await POST(jsonRequest({
      messages: [{ role: 'user', content: 'x'.repeat(4001) }],
    }));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not leak upstream error bodies to clients', async () => {
    fetchMock.mockResolvedValue(new Response('secret provider details', { status: 401 }));

    const response = await POST(jsonRequest({
      messages: [{ role: 'user', content: 'Question' }],
    }));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: 'Rules advisor provider returned 401',
    });
  });

  it('returns a provider-unavailable error when fetch fails', async () => {
    fetchMock.mockRejectedValue(new Error('network failed'));

    const response = await POST(jsonRequest({
      messages: [{ role: 'user', content: 'Question' }],
    }));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: 'Rules advisor provider is unavailable',
    });
  });
});
