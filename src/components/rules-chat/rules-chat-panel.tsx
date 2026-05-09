'use client';

import { RulesChatMessageList } from './rules-chat-message-list';
import { RulesChatComposer } from './rules-chat-composer';
import type { ChatMessage, RulesChatStatus } from '@/hooks/use-rules-chat';

export type RulesHelpPlacement = 'dock' | 'drawer' | 'sheet';

interface RulesChatPanelProps {
  messages: ChatMessage[];
  status: RulesChatStatus;
  isStreaming: boolean;
  error: string | null;
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  onAbort: () => void;
  onRetry: () => void;
  onClose: () => void;
  onMinimize: () => void;
  placement: RulesHelpPlacement;
  panelId: string;
  focusComposerOnMount?: boolean;
}

export function RulesChatPanel({
  messages,
  status,
  isStreaming,
  error,
  draft,
  onDraftChange,
  onSubmit,
  onClear,
  onAbort,
  onRetry,
  onClose,
  onMinimize,
  placement,
  panelId,
  focusComposerOnMount,
}: RulesChatPanelProps) {
  const isSheet = placement === 'sheet';
  const role = isSheet ? 'dialog' : 'complementary';

  return (
    <div
      id={panelId}
      role={role}
      aria-label="Rules Advisor"
      aria-modal={isSheet ? true : undefined}
      className="flex flex-col bg-card medieval-border rounded-lg shadow-xl overflow-hidden"
      style={{ height: '100%' }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-ink-100">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="font-heading text-sm font-semibold text-ink-600">Rules Advisor</h3>
          {isStreaming && (
            <span className="text-xs text-gold-500 animate-pulse" aria-live="polite">
              Answering…
            </span>
          )}
          {status === 'error' && !isStreaming && (
            <span className="text-xs text-red-500">Error</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="text-xs text-ink-300 hover:text-ink-500 transition-colors"
            >
              Clear
            </button>
          )}
          {!isSheet && (
            <button
              type="button"
              onClick={onMinimize}
              className="text-ink-300 hover:text-ink-500 transition-colors text-sm leading-none px-1"
              aria-label="Minimize advisor"
            >
              &#x2212;
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="text-ink-300 hover:text-ink-500 transition-colors text-sm leading-none px-1"
            aria-label="Close advisor"
          >
            &#x2715;
          </button>
        </div>
      </div>

      <RulesChatMessageList messages={messages} isStreaming={isStreaming} />

      {error && (
        <div className="px-4 py-2 text-xs text-red-600 bg-red-50 border-t border-red-200 flex items-center justify-between" role="alert">
          <span>{error}</span>
          <button
            type="button"
            onClick={onRetry}
            className="text-xs font-semibold text-red-600 hover:text-red-800 underline ml-2"
          >
            Retry
          </button>
        </div>
      )}

      <RulesChatComposer
        draft={draft}
        onDraftChange={onDraftChange}
        onSubmit={onSubmit}
        onAbort={onAbort}
        isStreaming={isStreaming}
        focusOnMount={focusComposerOnMount}
      />
    </div>
  );
}
