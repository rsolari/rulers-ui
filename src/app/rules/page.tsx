import Link from 'next/link';
import { getRuleChapters } from '@/lib/rules';

export default function RulesIndexPage() {
  const chapters = getRuleChapters();

  return (
    <div>
      <h1 className="text-4xl font-bold mb-2">Rulers: Core Rulebook</h1>
      <p className="text-ink-300 mb-8 text-lg">Conquest. Politics. Civilization.</p>

      <div className="grid gap-2">
        {chapters.map((ch) => (
          <Link
            key={ch.slug}
            href={`/rules/${ch.slug}`}
            className="flex items-baseline gap-3 px-4 py-2 rounded-lg hover:bg-parchment-200 transition-colors group"
          >
            <span className="text-ink-300 font-heading text-sm w-8 shrink-0">{ch.number}</span>
            <span className="text-ink-500 group-hover:text-ink-700 font-heading transition-colors">
              {ch.title}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
