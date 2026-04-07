'use client';

import { useParams } from 'next/navigation';
import { PlayerTurnReportPanel } from '@/components/turn-actions/player-turn-report-panel';
import { useRole } from '@/hooks/use-role';

export default function ReportPage() {
  const params = useParams();
  const gameId = params.gameId as string;
  const { realmId } = useRole();

  if (!realmId) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="font-heading text-ink-300">Loading report...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 max-w-5xl mx-auto">
      <PlayerTurnReportPanel gameId={gameId} realmId={realmId} />
    </main>
  );
}
