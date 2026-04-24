import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getRuleChapters, getRuleContent } from '@/lib/rules';
import { MarkdownContent } from './markdown-content';

export function generateStaticParams() {
  return getRuleChapters().map((ch) => ({ slug: ch.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const chapter = getRuleChapters().find((ch) => ch.slug === slug);
  return { title: chapter?.title ?? "Rules" };
}

export default async function RuleChapterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const content = getRuleContent(slug);
  if (!content) notFound();

  const chapters = getRuleChapters();
  const currentIndex = chapters.findIndex((ch) => ch.slug === slug);
  const prev = currentIndex > 0 ? chapters[currentIndex - 1] : null;
  const next = currentIndex < chapters.length - 1 ? chapters[currentIndex + 1] : null;

  return (
    <div>
      <article className="rules-content">
        <MarkdownContent content={content} />
      </article>

      <nav className="flex justify-between mt-12 pt-6 border-t-2 border-ink-200">
        {prev ? (
          <a href={`/rules/${prev.slug}`} className="text-ink-400 hover:text-ink-600 transition-colors font-heading text-sm">
            &larr; {prev.title}
          </a>
        ) : <span />}
        {next ? (
          <a href={`/rules/${next.slug}`} className="text-ink-400 hover:text-ink-600 transition-colors font-heading text-sm">
            {next.title} &rarr;
          </a>
        ) : <span />}
      </nav>
    </div>
  );
}
