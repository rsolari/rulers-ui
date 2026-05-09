'use client';

import { useRef, type KeyboardEvent } from 'react';

export interface GmTabItem {
  id: string;
  label: string;
  description?: string;
}

interface GmTabsProps {
  tabs: GmTabItem[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  idBase?: string;
  labelledBy?: string;
}

function GmTabs({ tabs, activeTab, onTabChange, idBase = 'gm-workflows', labelledBy }: GmTabsProps) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function focusTab(index: number) {
    const nextTab = tabs[index];
    if (!nextTab) return;
    onTabChange(nextTab.id);
    window.requestAnimationFrame(() => tabRefs.current[index]?.focus());
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusTab((index + 1) % tabs.length);
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusTab((index - 1 + tabs.length) % tabs.length);
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      focusTab(0);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      focusTab(tabs.length - 1);
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onTabChange(tabs[index].id);
    }
  }

  return (
    <div
      role="tablist"
      aria-labelledby={labelledBy}
      className="-mx-4 flex snap-x gap-2 overflow-x-auto border-b-2 border-card-border px-4 pb-0 [scrollbar-width:thin] sm:mx-0 sm:px-0"
    >
      {tabs.map((tab, index) => {
        const selected = tab.id === activeTab;
        const { tabId, panelId } = getGmTabPanelIds(tab.id, idBase);

        return (
          <button
            key={tab.id}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            id={tabId}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            title={tab.description}
            onClick={() => onTabChange(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`-mb-[2px] min-h-11 min-w-[9rem] snap-start whitespace-normal border-b-2 px-4 py-3 text-left font-display text-[13px] font-semibold uppercase leading-tight transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 sm:min-h-0 sm:min-w-0 sm:whitespace-nowrap ${
              selected
                ? 'border-gold-400 text-gold-600'
                : 'border-transparent text-ink-300 hover:text-ink-600'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function getGmTabPanelIds(tabId: string, idBase: string) {
  return {
    tabId: `gm-tab-${idBase}-${tabId}`,
    panelId: `gm-panel-${idBase}-${tabId}`,
  };
}

export { GmTabs, getGmTabPanelIds };
