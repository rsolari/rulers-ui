'use client';

import { Card, CardContent } from '@/components/ui/card';
import { StatGrid } from '@/components/ui/stat-row';
import { StatusPill } from '@/components/ui/status-pill';
import type { EconomyOverviewRealmDto } from '@/lib/economy-dto';
import type { GameDto, GameSettlementDto, GameTerritoryDto, PlayerSlotDto, RealmDto } from '@/types/api';

interface GmStatusSummaryProps {
  game: GameDto;
  isActive: boolean;
  canStartGame: boolean;
  allPlayersReady: boolean;
  gmSetupReady: boolean;
  readyPlayerCount: number;
  claimedPlayerCount: number;
  unclaimedSlotCount: number;
  playerSlots: PlayerSlotDto[];
  realms: RealmDto[];
  territories: GameTerritoryDto[];
  settlements: GameSettlementDto[];
  economyOverview: Record<string, EconomyOverviewRealmDto>;
  gosTreasuryTotal: number;
}

function GmStatusSummary({
  game,
  isActive,
  canStartGame,
  allPlayersReady,
  gmSetupReady,
  readyPlayerCount,
  claimedPlayerCount,
  unclaimedSlotCount,
  playerSlots,
  realms,
  territories,
  settlements,
  economyOverview,
  gosTreasuryTotal,
}: GmStatusSummaryProps) {
  if (!isActive) {
    const waitingOn = [
      !gmSetupReady ? 'GM setup' : null,
      playerSlots.length === 0
        ? 'player slots'
        : !allPlayersReady
          ? `${playerSlots.length - readyPlayerCount} player${playerSlots.length - readyPlayerCount === 1 ? '' : 's'}`
          : null,
    ].filter(Boolean);

    return (
      <section aria-label="Setup status summary" className="mb-6">
        <StatGrid className="lg:grid-cols-3">
        <Card variant="stat">
          <CardContent>
            <p className="pt-4 text-sm text-ink-300">GM Code</p>
            <p className="font-mono text-2xl">{game.gmCode || '-'}</p>
            <p className="text-sm text-ink-300">Share with co-GMs</p>
          </CardContent>
        </Card>
        <Card variant="stat">
          <CardContent>
            <p className="pt-4 text-sm text-ink-300">Player Readiness</p>
            <p className="font-heading text-3xl font-bold">
              {readyPlayerCount}<span className="text-ink-300">/{playerSlots.length}</span>
            </p>
            <p className="text-sm text-ink-300">
              {playerSlots.length === 0
                ? 'No player slots yet'
                : `${claimedPlayerCount} claimed / ${unclaimedSlotCount} unclaimed`}
            </p>
          </CardContent>
        </Card>
        <Card variant={canStartGame ? 'emphasis' : 'stat'}>
          <CardContent>
            <p className="pt-4 text-sm text-ink-300">Next Step</p>
            {canStartGame ? (
              <>
                <p className="font-heading text-xl font-bold text-green-700">Ready to start</p>
                <p className="text-sm text-ink-300">Use Start Game in the command header.</p>
              </>
            ) : (
              <>
                <p className="font-heading text-xl font-bold">Waiting on</p>
                <p className="text-sm text-ink-300">{waitingOn.join(' / ') || '-'}</p>
              </>
            )}
          </CardContent>
        </Card>
        </StatGrid>
      </section>
    );
  }

  const highTurmoilCount = realms.filter((realm) => {
    const projectedTurmoil = realm.projectedTurmoil ?? economyOverview[realm.id]?.projectedTurmoil ?? 0;
    return projectedTurmoil > 5;
  }).length;
  const warningCount = Object.values(economyOverview).reduce((sum, realm) => sum + (realm.warningCount ?? 0), 0);
  const openReviewCount = realms.filter((realm) => realm.openTurmoilEventId).length;

  return (
    <section aria-label="Game status summary" className="mb-6">
      <StatGrid>
      <Card variant="stat">
        <CardContent>
          <p className="pt-4 text-sm text-ink-300">Turn State</p>
          <p className="font-heading text-xl font-bold">{game.currentSeason} {game.currentYear}</p>
          <p className="text-sm text-ink-300">{game.gamePhase} / {game.turnPhase}</p>
        </CardContent>
      </Card>
      <Card variant="stat">
        <CardContent>
          <p className="pt-4 text-sm text-ink-300">Realm Risk</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusPill tone={highTurmoilCount > 0 ? 'danger' : 'success'}>{highTurmoilCount} high turmoil</StatusPill>
            <StatusPill tone={openReviewCount > 0 ? 'warning' : 'success'}>{openReviewCount} unrest reviews</StatusPill>
          </div>
          <p className="mt-2 text-sm text-ink-300">{warningCount} economy warnings</p>
        </CardContent>
      </Card>
      <Card variant="stat">
        <CardContent>
          <p className="pt-4 text-sm text-ink-300">G.O.S. Treasury</p>
          <p className="font-heading text-2xl font-bold">{gosTreasuryTotal.toLocaleString()}gc</p>
          <p className="text-sm text-ink-300">Combined directory funds</p>
        </CardContent>
      </Card>
      <Card variant="stat">
        <CardContent>
          <p className="pt-4 text-sm text-ink-300">World Assets</p>
          <p className="font-heading text-2xl font-bold">{territories.length} territories</p>
          <p className="text-sm text-ink-300">{settlements.length} settlements / {realms.length} realms</p>
        </CardContent>
      </Card>
      </StatGrid>
    </section>
  );
}

export { GmStatusSummary };
