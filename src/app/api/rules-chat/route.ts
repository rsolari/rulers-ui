import { buildSystemPrompt } from '@/lib/rules-chat';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'google/gemini-2.5-flash';
const MAX_TURNS = 40;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'OPENROUTER_API_KEY is not configured' }, { status: 500 });
  }

  let body: { messages?: ChatMessage[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { messages } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: 'messages array is required' }, { status: 400 });
  }

  const trimmed = messages.slice(-MAX_TURNS);
  const systemPrompt = buildSystemPrompt();

  const openRouterResponse = await fetch(OPENROUTER_URL, {
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
        ...trimmed,
      ],
    }),
  });

  if (!openRouterResponse.ok) {
    const text = await openRouterResponse.text();
    return Response.json(
      { error: `OpenRouter error: ${openRouterResponse.status}`, details: text },
      { status: 502 },
    );
  }

  if (!openRouterResponse.body) {
    return Response.json({ error: 'No response body from OpenRouter' }, { status: 502 });
  }

  const reader = openRouterResponse.body.getReader();
  const decoder = new TextDecoder();

  const readable = new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const text = parsed.choices?.[0]?.delta?.content;
          if (text) {
            controller.enqueue(new TextEncoder().encode(text));
          }
        } catch {
          // skip malformed SSE chunks
        }
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}
