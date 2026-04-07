'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { Badge } from '@/components/ui/badge';

interface GameInfo {
  id: string;
  name: string;
  currentYear: number;
  currentSeason: string;
  turnPhase: string;
}

export default function GameLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const gameId = params.gameId as string;
  const [game, setGame] = useState<GameInfo | null>(null);

  useEffect(() => {
    fetch(`/api/game/${gameId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setGame)
      .catch(() => {});
  }, [gameId]);

  // Don't show nav on the join/auth page itself
  const isJoinPage = pathname === `/game/${gameId}`;

  return (
    <>
      {!isJoinPage && game && (
        <nav className="border-b border-ink-200/20 bg-parchment-100/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-6 h-12 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`/game/${gameId}/realm`}
                className="font-heading font-bold text-ink-500 hover:text-ink-300 transition-colors"
              >
                {game.name}
              </Link>
              <span className="text-ink-200">|</span>
              <span className="text-sm text-ink-300">
                {game.currentSeason} Y{game.currentYear}
              </span>
              <Badge variant={game.turnPhase === 'Submission' ? 'gold' : 'default'}>
                {game.turnPhase}
              </Badge>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/rules"
                className="text-sm text-ink-300 hover:text-ink-100 transition-colors"
              >
                Rulebook
              </Link>
            </div>
          </div>
        </nav>
      )}
      {children}
    </>
  );
}
