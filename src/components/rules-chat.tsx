'use client';

import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { useRulesChat } from '@/hooks/use-rules-chat';

export function RulesChat() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const { messages, isStreaming, error, sendMessage, clearChat } = useRulesChat();
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (open) textareaRef.current?.focus();
  }, [open]);

  function handleSubmit() {
    if (!input.trim() || isStreaming) return;
    void sendMessage(input);
    setInput('');
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-gold-500 hover:bg-gold-600 text-white shadow-lg flex items-center justify-center transition-colors text-xl"
        aria-label={open ? 'Close rules chat' : 'Open rules chat'}
      >
        {open ? '\u2715' : '\u2709'}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-20 right-6 z-50 w-[400px] max-w-[calc(100vw-2rem)] h-[500px] max-h-[calc(100vh-7rem)] flex flex-col medieval-border rounded-lg bg-card shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-ink-100">
            <h3 className="font-heading text-sm font-semibold text-ink-600">Rules Advisor</h3>
            <div className="flex items-center gap-2">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={clearChat}
                  className="text-xs text-ink-300 hover:text-ink-500 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Messages */}
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
                        {msg.content || (isStreaming ? '\u2026' : '')}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="px-4 py-2 text-xs text-red-600 bg-red-50 border-t border-red-200">
              {error}
            </div>
          )}

          {/* Input */}
          <div className="border-t border-ink-100 px-4 py-3 flex gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about the rules..."
              rows={1}
              className="flex-1 resize-none rounded border-2 border-input-border bg-input-bg px-3 py-2 text-sm text-ink-500 placeholder:text-ink-200 focus:border-accent focus:outline-none"
            />
            <Button
              variant="accent"
              size="sm"
              onClick={handleSubmit}
              disabled={!input.trim() || isStreaming}
            >
              {isStreaming ? '...' : 'Ask'}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
