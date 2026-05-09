'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from 'react';
import { useRulesChat } from '@/hooks/use-rules-chat';
import { RulesChatPanel } from '@/components/rules-chat/rules-chat-panel';
import { useRulesHelpCollision, type HelpPlacementMode } from './rules-help-collision';

type OpenState = 'closed' | 'open' | 'minimized';

const UI_PREF_KEY = 'rulers.rulesHelp.ui.v1';

function loadUiPref(): OpenState {
  if (typeof window === 'undefined') return 'closed';
  try {
    const raw = localStorage.getItem(UI_PREF_KEY);
    if (raw === 'minimized') return 'minimized';
  } catch { /* noop */ }
  return 'closed';
}

function persistUiPref(state: OpenState) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(UI_PREF_KEY, state === 'open' ? 'closed' : state);
  } catch { /* noop */ }
}

interface RulesHelpContextValue {
  state: OpenState;
  open: () => void;
  close: () => void;
  minimize: () => void;
  toggle: () => void;
  isStreaming: boolean;
  hasError: boolean;
  panelId: string;
  registerTrigger: (el: HTMLButtonElement | null) => void;
}

const RulesHelpContext = createContext<RulesHelpContextValue | null>(null);

export function useRulesHelp(): RulesHelpContextValue {
  const ctx = useContext(RulesHelpContext);
  if (!ctx) throw new Error('useRulesHelp must be used within RulesHelpProvider');
  return ctx;
}

interface RulesHelpProviderProps {
  children: ReactNode;
  surfaceId?: string;
}

export function RulesHelpProvider({ children, surfaceId = 'rules-help' }: RulesHelpProviderProps) {
  const panelId = `${surfaceId}-panel`;
  const chat = useRulesChat();
  const [openState, setOpenState] = useState<OpenState>(() => loadUiPref());
  const [draft, setDraft] = useState('');
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const [focusComposer, setFocusComposer] = useState(false);

  const isOpen = openState === 'open';

  const { placement, style } = useRulesHelpCollision(surfaceRef, { enabled: isOpen });

  const open = useCallback(() => {
    setOpenState('open');
    setFocusComposer(true);
    persistUiPref('open');
  }, []);

  const close = useCallback(() => {
    setOpenState('closed');
    persistUiPref('closed');
    triggerRef.current?.focus();
  }, []);

  const minimize = useCallback(() => {
    setOpenState('minimized');
    persistUiPref('minimized');
    triggerRef.current?.focus();
  }, []);

  const toggle = useCallback(() => {
    setOpenState((prev) => {
      if (prev === 'open') {
        persistUiPref('closed');
        triggerRef.current?.focus();
        return 'closed';
      }
      setFocusComposer(true);
      persistUiPref('open');
      return 'open';
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && surfaceRef.current?.contains(document.activeElement)) {
        e.stopPropagation();
        close();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, close]);

  useEffect(() => {
    return () => {
      chat.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSubmit() {
    if (!draft.trim() || chat.isStreaming) return;
    void chat.sendMessage(draft);
    setDraft('');
  }

  const registerTrigger = useCallback((el: HTMLButtonElement | null) => {
    triggerRef.current = el;
  }, []);

  const contextValue: RulesHelpContextValue = {
    state: openState,
    open,
    close,
    minimize,
    toggle,
    isStreaming: chat.isStreaming,
    hasError: chat.status === 'error',
    panelId,
    registerTrigger,
  };

  const panelPlacement = placement === 'sheet' ? 'sheet' : placement === 'drawer' ? 'drawer' : 'dock';

  return (
    <RulesHelpContext.Provider value={contextValue}>
      {children}

      {isOpen && (
        <>
          {panelPlacement === 'sheet' && (
            <div
              className="fixed inset-0 z-40 bg-ink-900/30"
              onClick={close}
              aria-hidden="true"
            />
          )}
          {panelPlacement === 'drawer' && (
            <div
              className="fixed inset-0 z-40 bg-ink-900/20"
              onClick={close}
              aria-hidden="true"
            />
          )}
          <div
            ref={surfaceRef}
            style={style as React.CSSProperties}
            className={panelPositionClasses(panelPlacement)}
          >
            <RulesChatPanel
              messages={chat.messages}
              status={chat.status}
              isStreaming={chat.isStreaming}
              error={chat.error}
              draft={draft}
              onDraftChange={setDraft}
              onSubmit={handleSubmit}
              onClear={chat.clearChat}
              onAbort={chat.abort}
              onRetry={chat.retryLast}
              onClose={close}
              onMinimize={panelPlacement === 'sheet' ? close : minimize}
              placement={panelPlacement}
              panelId={panelId}
              focusComposerOnMount={focusComposer}
            />
          </div>
        </>
      )}
    </RulesHelpContext.Provider>
  );
}

function panelPositionClasses(placement: HelpPlacementMode): string {
  switch (placement) {
    case 'sheet':
      return 'fixed inset-x-0 bottom-0 top-[var(--rules-help-top-offset,3.5rem)] z-50 pb-[env(safe-area-inset-bottom)]';
    case 'drawer':
      return 'fixed top-[var(--rules-help-top-offset,3.5rem)] right-0 bottom-[var(--rules-help-safe-bottom,1rem)] z-50 w-[var(--rules-help-panel-width,24rem)] max-w-[calc(100vw-2rem)]';
    case 'dock':
      return 'fixed top-[var(--rules-help-top-offset,3.5rem)] right-[var(--rules-help-safe-right,1rem)] bottom-[var(--rules-help-safe-bottom,1rem)] z-50 w-[var(--rules-help-panel-width,24rem)] max-w-[calc(100vw-2rem)]';
  }
}

interface RulesHelpButtonProps {
  label?: string;
  shortLabel?: string;
  className?: string;
}

export function RulesHelpButton({
  label = 'Rules Advisor',
  shortLabel = '?',
  className = '',
}: RulesHelpButtonProps) {
  const { state, toggle, isStreaming, hasError, panelId, registerTrigger } = useRulesHelp();

  return (
    <button
      ref={registerTrigger}
      type="button"
      onClick={toggle}
      aria-expanded={state === 'open'}
      aria-controls={state === 'open' ? panelId : undefined}
      className={`relative rounded px-2 py-2 text-sm font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 ${
        state === 'open'
          ? 'bg-gold-400/20 text-gold-600'
          : 'text-ink-500 hover:bg-parchment-200 hover:text-ink-700'
      } ${className}`}
      data-rules-help-trigger
    >
      <span className="hidden md:inline">{label}</span>
      <span className="md:hidden">{shortLabel}</span>
      {isStreaming && state !== 'open' && (
        <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-gold-500" />
        </span>
      )}
      {hasError && state !== 'open' && !isStreaming && (
        <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500" />
      )}
      <span className="sr-only">
        {isStreaming && state !== 'open' ? ' — Rules advisor is answering' : ''}
        {hasError && state !== 'open' ? ' — Rules advisor has an error' : ''}
      </span>
    </button>
  );
}
