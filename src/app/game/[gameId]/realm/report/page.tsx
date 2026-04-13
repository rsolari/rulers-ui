'use client';

import { useParams } from 'next/navigation';
import { PlayerTurnReportPanel } from '@/components/turn-actions/player-turn-report-panel';
import { useRole } from '@/hooks/use-role';

export default function ReportPage() {
  const params = useParams();
  const gameId = params.gameId as string;
  const { realmId, gamePhase } = useRole();

  if (!realmId || gamePhase !== 'Active') {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="font-heading text-ink-300">{gamePhase !== 'Active' ? 'Turn actions are available once the game is active.' : 'Loading report...'}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 max-w-5xl mx-auto">
      <PlayerTurnReportPanel gameId={gameId} realmId={realmId} />
    </main>
  );
}
