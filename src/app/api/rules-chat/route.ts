import { buildSystemPrompt } from '@/lib/rules-chat';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'google/gemini-2.5-flash';
const MAX_TURNS = 40;
const MAX_MESSAGE_CHARS = 4000;
const MAX_TOTAL_CHARS = 24000;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function normalizeMessages(value: unknown): ChatMessage[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const messages: ChatMessage[] = [];
  let totalChars = 0;

  for (const item of value.slice(-MAX_TURNS)) {
    if (typeof item !== 'object' || item === null) {
      return null;
    }

    const { role, content } = item as Partial<ChatMessage>;
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') {
      return null;
    }

    const trimmed = content.trim();
    if (!trimmed) {
      continue;
    }

    if (trimmed.length > MAX_MESSAGE_CHARS) {
      return null;
    }

    totalChars += trimmed.length;
    if (totalChars > MAX_TOTAL_CHARS) {
      return null;
    }

    messages.push({ role, content: trimmed });
  }

  return messages.length > 0 ? messages : null;
}

function enqueueOpenRouterLine(
  line: string,
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
) {
  if (!line.startsWith('data: ')) return false;
  const data = line.slice(6).trim();
  if (data === '[DONE]') return true;
  if (!data) return false;

  try {
    const parsed = JSON.parse(data);
    const text = parsed.choices?.[0]?.delta?.content;
    if (typeof text === 'string' && text) {
      controller.enqueue(encoder.encode(text));
    }
  } catch {
    // Keep the stream alive if OpenRouter sends a malformed event.
  }

  return false;
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'OPENROUTER_API_KEY is not configured' }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const messagesInput = typeof body === 'object' && body !== null
    ? (body as { messages?: unknown }).messages
    : undefined;
  const messages = normalizeMessages(messagesInput);
  if (!messages) {
    return Response.json({ error: 'messages array is required' }, { status: 400 });
  }

  const systemPrompt = buildSystemPrompt();

  let openRouterResponse: Response;
  try {
    openRouterResponse = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        stream: true,
        max_tokens: 1024,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
      }),
    });
  } catch {
    return Response.json({ error: 'Rules advisor provider is unavailable' }, { status: 502 });
  }

  if (!openRouterResponse.ok) {
    return Response.json(
      { error: `Rules advisor provider returned ${openRouterResponse.status}` },
      { status: 502 },
    );
  }

  if (!openRouterResponse.body) {
    return Response.json({ error: 'No response body from OpenRouter' }, { status: 502 });
  }

  const reader = openRouterResponse.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffered = '';
  let closed = false;

  const readable = new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        const finalText = decoder.decode();
        if (finalText) buffered += finalText;
        if (buffered && !closed) {
          closed = enqueueOpenRouterLine(buffered, controller, encoder);
        }
        controller.close();
        return;
      }

      buffered += decoder.decode(value, { stream: true });
      const lines = buffered.split(/\r?\n/);
      buffered = lines.pop() ?? '';

      for (const line of lines) {
        if (enqueueOpenRouterLine(line, controller, encoder)) {
          closed = true;
          void reader.cancel();
          controller.close();
          return;
        }
      }
    },
    cancel() {
      void reader.cancel();
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}
