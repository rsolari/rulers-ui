import Link from 'next/link';
import { getRuleChapters } from '@/lib/rules';
import { RulesSidebar } from './sidebar';
import { RulesChat } from '@/components/rules-chat';

export default function RulesLayout({ children }: { children: React.ReactNode }) {
  const chapters = getRuleChapters();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b-2 border-ink-200 bg-parchment-100">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="font-heading text-2xl font-bold tracking-wider text-ink-600 hover:text-accent transition-colors">
            RULERS
          </Link>
          <nav className="flex items-center gap-6 font-heading text-sm tracking-wide">
            <Link href="/rules" className="text-ink-400 hover:text-ink-600 transition-colors font-semibold">
              Rulebook
            </Link>
            <Link href="/" className="text-ink-400 hover:text-ink-600 transition-colors">
              Play
            </Link>
          </nav>
        </div>
      </header>

      <div className="flex flex-1 max-w-7xl mx-auto w-full">
        <RulesSidebar chapters={chapters} />
        <main className="flex-1 min-w-0 px-8 py-8">
          {children}
        </main>
      </div>

      <RulesChat />
    </div>
  );
}
