'use client';

import { useRef, useEffect, type KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';

interface RulesChatComposerProps {
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
  onAbort?: () => void;
  isStreaming: boolean;
  focusOnMount?: boolean;
}

export function RulesChatComposer({
  draft,
  onDraftChange,
  onSubmit,
  onAbort,
  isStreaming,
  focusOnMount,
}: RulesChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (focusOnMount) textareaRef.current?.focus();
  }, [focusOnMount]);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  }

  return (
    <div className="border-t border-ink-100 px-4 py-3 flex gap-2">
      <textarea
        ref={textareaRef}
        value={draft}
        onChange={(e) => onDraftChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask about the rules..."
        rows={1}
        disabled={isStreaming}
        className="flex-1 resize-none rounded border-2 border-input-border bg-input-bg px-3 py-2 text-sm text-ink-500 placeholder:text-ink-200 focus:border-accent focus:outline-none disabled:opacity-50"
        aria-label="Ask about the rules"
      />
      {isStreaming ? (
        <Button
          variant="outline"
          size="sm"
          onClick={onAbort}
          className="min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0"
        >
          Stop
        </Button>
      ) : (
        <Button
          variant="accent"
          size="sm"
          onClick={onSubmit}
          disabled={!draft.trim()}
          className="min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0"
        >
          Ask
        </Button>
      )}
    </div>
  );
}
