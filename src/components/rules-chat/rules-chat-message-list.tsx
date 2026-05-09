'use client';

import { useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatMessage } from '@/hooks/use-rules-chat';

interface RulesChatMessageListProps {
  messages: ChatMessage[];
  isStreaming: boolean;
}

export function RulesChatMessageList({ messages, isStreaming }: RulesChatMessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useRef(false);

  useEffect(() => {
    prefersReducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: prefersReducedMotion.current ? 'instant' : 'smooth',
    });
  }, [messages]);

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
      {messages.length === 0 && (
        <p className="text-sm text-ink-300 text-center mt-8">
          Ask a question about the rules of Rulers.
        </p>
      )}

      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[85%] rounded px-3 py-2 text-sm ${
              msg.role === 'user'
                ? 'bg-parchment-200 text-ink-600'
                : 'bg-parchment-100/60 text-ink-500'
            }`}
          >
            {msg.role === 'assistant' ? (
              <div className="rules-content rules-chat-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {msg.content || (isStreaming ? '…' : '')}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="whitespace-pre-wrap">{msg.content}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
