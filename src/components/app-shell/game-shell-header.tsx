'use client';

import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { StatusPill } from '@/components/ui/status-pill';
import { GameContextSwitcher } from '@/components/app-shell/game-context-switcher';
import { GamePrimaryAction } from '@/components/app-shell/game-primary-action';
import { RulesHelpButton } from '@/components/help/rules-help-surface';
import type { GameShellDto } from '@/types/shell';

interface GameShellHeaderProps {
  shell: GameShellDto;
  homeHref: string;
  pathname: string;
  onRefresh: () => Promise<void>;
}

export function GameShellHeader({ shell, homeHref, pathname, onRefresh }: GameShellHeaderProps) {
  const { game, session, currentRealm } = shell;
  const roleLabel = session.role === 'gm' ? 'GM' : session.displayName || 'Player';
  const contextLabel = session.role === 'gm'
    ? currentRealm ? `Managing: ${currentRealm.name}` : 'GM View'
    : currentRealm?.name ?? 'No realm yet';

  return (
    <header className="sticky top-0 z-50 border-b border-ink-200 bg-parchment-100/95 shadow-warm-2 backdrop-blur">
      <div className="mx-auto flex min-h-20 max-w-[1680px] flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={homeHref}
              className="min-w-0 max-w-full truncate font-heading text-xl font-bold text-ink-700 transition-colors hover:text-ink-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
            >
              {game.name}
            </Link>
            <StatusPill tone={session.role === 'gm' ? 'info' : 'muted'}>{roleLabel}</StatusPill>
            <StatusPill tone={game.turnPhase === 'Submission' ? 'active' : 'neutral'}>{game.turnPhase}</StatusPill>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-ink-400">
            <span>{game.currentSeason} Y{game.currentYear}</span>
            <span>{game.gamePhase}</span>
            {game.initState !== 'active' && game.initState !== 'completed' && <span>{game.initState}</span>}
            <span>{contextLabel}</span>
          </div>
        </div>
        <div className="grid min-w-0 grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3 lg:justify-end">
          <GameContextSwitcher shell={shell} pathname={pathname} />
          <GamePrimaryAction shell={shell} onRefresh={onRefresh} />
          <Link
            href="/rules"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded px-2 py-2 text-sm font-bold text-ink-500 transition-colors hover:bg-parchment-200 hover:text-ink-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 sm:min-h-0"
          >
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            Rulebook
          </Link>
          <RulesHelpButton label="Rules Advisor" shortLabel="?" />
        </div>
      </div>
    </header>
  );
}
