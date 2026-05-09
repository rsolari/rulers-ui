'use client';

import Link from 'next/link';
import type { ShellNavSection } from '@/lib/game-navigation';

interface GameShellNavProps {
  sections: ShellNavSection[];
  compact?: boolean;
}

export function GameShellNav({ sections, compact = false }: GameShellNavProps) {
  return (
    <nav
      aria-label={sections.some((section) => section.id === 'realm-management') ? 'Realm management navigation' : 'Game navigation'}
      className={compact ? 'space-y-4' : 'sticky top-24 space-y-6'}
    >
      {sections.map((section) => (
        <div key={section.id}>
          <p className="mb-2 px-3 font-display text-[10px] font-bold uppercase tracking-[0.16em] text-ink-300">
            {section.label}
          </p>
          <div className="space-y-1">
            {section.items.map((item) => {
              const className = [
                'block rounded px-3 py-2 text-sm font-semibold leading-snug transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400',
                item.active
                  ? 'border-l-4 border-gold-400 bg-parchment-200 text-ink-700 shadow-warm-1'
                  : 'border-l-4 border-transparent text-ink-500 hover:bg-parchment-100 hover:text-ink-700',
                item.disabled ? 'pointer-events-none opacity-45' : '',
              ].join(' ');

              if (item.disabled) {
                return (
                  <span key={item.id} className={className} title={item.description} aria-disabled="true">
                    {item.label}
                  </span>
                );
              }

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={className}
                  aria-current={item.active ? 'page' : undefined}
                  title={item.description}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
