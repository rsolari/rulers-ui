'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { RuleChapter } from '@/lib/rules';

export function RulesSidebar({ chapters }: { chapters: RuleChapter[] }) {
  const pathname = usePathname();

  return (
    <aside className="w-64 shrink-0 border-r-2 border-ink-200 bg-parchment-100/50 overflow-y-auto h-[calc(100vh-57px)] sticky top-[57px]">
      <nav className="py-4">
        {chapters.map((ch) => {
          const href = `/rules/${ch.slug}`;
          const isActive = pathname === href;
          return (
            <Link
              key={ch.slug}
              href={href}
              className={`block px-4 py-1.5 text-sm leading-snug transition-colors ${
                isActive
                  ? 'bg-parchment-200 text-ink-600 font-semibold'
                  : 'text-ink-400 hover:text-ink-600 hover:bg-parchment-100'
              }`}
            >
              <span className="text-ink-300 mr-1.5">{ch.number}.</span>
              {ch.title}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
