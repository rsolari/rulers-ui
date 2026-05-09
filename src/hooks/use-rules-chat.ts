'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { readErrorMessage } from '@/lib/http';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export type RulesChatStatus = 'idle' | 'streaming' | 'error';

const MESSAGES_KEY = 'rulers.rulesChat.messages.v1';
const MAX_TURNS = 40;

function loadPersistedMessages(): ChatMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(MESSAGES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      sessionStorage.removeItem(MESSAGES_KEY);
      return [];
    }
    return parsed.slice(-MAX_TURNS);
  } catch {
    sessionStorage.removeItem(MESSAGES_KEY);
    return [];
  }
}

function persistMessages(messages: ChatMessage[]) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(MESSAGES_KEY, JSON.stringify(messages.slice(-MAX_TURNS)));
  } catch {
    // storage full or unavailable
  }
}

export function useRulesChat() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadPersistedMessages());
  const [status, setStatus] = useState<RulesChatStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  useEffect(() => {
    if (status !== 'streaming') {
      persistMessages(messagesRef.current);
    }
  }, [messages, status]);

  const sendMessage = useCallback(async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || status === 'streaming') return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
    };
    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
    };

    const updatedMessages = [...messagesRef.current, userMessage];
    setMessages([...updatedMessages, assistantMessage]);
    setStatus('streaming');
    setError(null);

    try {
      const response = await fetch('/api/rules-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, `HTTP ${response.status}`));
      }

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          const finalText = decoder.decode();
          if (finalText) {
            assistantMessage.content += finalText;
            setMessages((prev) => {
              const next = [...prev];
              next[next.length - 1] = { ...assistantMessage };
              return next;
            });
          }
          break;
        }

        const text = decoder.decode(value, { stream: true });
        assistantMessage.content += text;
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { ...assistantMessage };
          return next;
        });
      }

      setStatus('idle');
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        if (assistantMessage.content) {
          setStatus('idle');
        } else {
          setMessages((prev) => (prev[prev.length - 1]?.content === '' ? prev.slice(0, -1) : prev));
          setStatus('idle');
        }
        return;
      }
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setMessages((prev) => {
        if (prev[prev.length - 1]?.content === '') {
          return prev.slice(0, -1);
        }
        return prev;
      });
      setStatus('error');
    }
  }, [status]);

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const retryLast = useCallback(() => {
    const msgs = messagesRef.current;
    const lastUserIdx = msgs.findLastIndex((m) => m.role === 'user');
    if (lastUserIdx === -1) return;

    const lastUserContent = msgs[lastUserIdx].content;
    setMessages(msgs.slice(0, lastUserIdx));
    setError(null);
    setStatus('idle');

    setTimeout(() => {
      void sendMessage(lastUserContent);
    }, 0);
  }, [sendMessage]);

  const clearChat = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
    setStatus('idle');
    sessionStorage.removeItem(MESSAGES_KEY);
  }, []);

  const isStreaming = status === 'streaming';

  return { messages, status, isStreaming, error, sendMessage, clearChat, abort, retryLast };
}
