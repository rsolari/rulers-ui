'use client';

import Link from 'next/link';
import type { Ref } from 'react';
import { Download, Map, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CountPill, StatusPill } from '@/components/ui/status-pill';
import type { GameDto } from '@/types/api';

interface GmCommandHeaderProps {
  game: GameDto;
  gameId: string;
  isActive: boolean;
  canStartGame: boolean;
  gmSetupReady: boolean;
  starting: boolean;
  markingReady: boolean;
  refreshingDashboard: boolean;
  refreshStatusText: string;
  activeDraftCount: number;
  onMarkReady: () => void;
  onStartGame: () => void;
  onRefresh: () => void;
  refreshButtonRef?: Ref<HTMLButtonElement>;
}

function GmCommandHeader({
  game,
  gameId,
  isActive,
  canStartGame,
  gmSetupReady,
  starting,
  markingReady,
  refreshingDashboard,
  refreshStatusText,
  activeDraftCount,
  onMarkReady,
  onStartGame,
  onRefresh,
  refreshButtonRef,
}: GmCommandHeaderProps) {
  return (
    <header className="mb-6 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="t-app-title break-words">{game.name}</h1>
          <p className="t-app-meta">GM Command Center</p>
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-start gap-2 md:justify-end">
          {!isActive && <StatusPill tone="muted">Init: {game.initState}</StatusPill>}
          {!isActive && (
            <StatusPill tone={gmSetupReady ? 'success' : 'warning'}>GM Setup: {game.gmSetupState}</StatusPill>
          )}
          <StatusPill tone="active">Phase: {game.gamePhase}</StatusPill>
          <StatusPill tone="neutral">Year {game.currentYear}, {game.currentSeason}</StatusPill>
          <StatusPill tone="info">Turn: {game.turnPhase}</StatusPill>
        </div>
      </div>

      <div className="grid gap-3 md:flex md:flex-wrap md:items-center md:justify-between">
        <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
          {!isActive && !gmSetupReady && (
            <Button className="w-full sm:w-auto" variant="outline" onClick={onMarkReady} disabled={markingReady}>
              {markingReady ? 'Saving...' : 'Mark GM Setup Ready'}
            </Button>
          )}
          {canStartGame && !isActive && (
            <Button className="w-full sm:w-auto" variant="accent" onClick={onStartGame} disabled={starting}>
              {starting ? 'Starting...' : 'Start Game'}
            </Button>
          )}
        </div>
        <div className="grid min-w-0 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
          <span aria-live="polite" className="text-sm text-ink-300">
            {refreshStatusText}
          </span>
          {activeDraftCount > 0 && (
            <CountPill>{activeDraftCount} draft{activeDraftCount === 1 ? '' : 's'}</CountPill>
          )}
          <Button
            ref={refreshButtonRef}
            className="w-full sm:w-auto"
            variant="ghost"
            leftIcon={<RefreshCw className="h-4 w-4" />}
            loading={refreshingDashboard}
            onClick={onRefresh}
          >
            {refreshingDashboard ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Link href={`/game/${gameId}/map`} className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto" variant="outline" leftIcon={<Map className="h-4 w-4" />}>Map</Button>
          </Link>
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            leftIcon={<Download className="h-4 w-4" />}
            onClick={() => {
              const anchor = document.createElement('a');
              anchor.href = `/api/game/${gameId}/export`;
              anchor.download = '';
              anchor.click();
            }}
          >
            Export Database
          </Button>
        </div>
      </div>
    </header>
  );
}

export { GmCommandHeader };
