'use client';

import { useState, type ReactNode } from 'react';

interface Tab {
  id: string;
  label: string;
  content: ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  className?: string;
}

function Tabs({ tabs, defaultTab, className = '' }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);
  const activeContent = tabs.find((t) => t.id === activeTab)?.content;

  return (
    <div className={className}>
      <div className="flex border-b-2 border-card-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-3 font-display text-[13px] font-semibold uppercase tracking-[0.14em] transition-colors cursor-pointer -mb-[2px] border-b-2 ${
              activeTab === tab.id
                ? 'text-gold-500 border-gold-400'
                : 'text-ink-300 hover:text-ink-500 border-transparent'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="pt-6">{activeContent}</div>
    </div>
  );
}

export { Tabs };
