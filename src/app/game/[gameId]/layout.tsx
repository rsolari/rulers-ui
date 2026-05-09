'use client';

import { useParams, usePathname } from 'next/navigation';
import { RulesHelpProvider } from '@/components/help/rules-help-surface';
import { GameAppShell } from '@/components/app-shell/game-app-shell';

export default function GameLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const gameId = params.gameId as string;
  const suppressShell = pathname === `/game/${gameId}`;

  if (suppressShell) {
    return (
      <RulesHelpProvider surfaceId="game-rules-help">
        {children}
      </RulesHelpProvider>
    );
  }

  return (
    <RulesHelpProvider surfaceId="game-rules-help">
      <GameAppShell gameId={gameId}>{children}</GameAppShell>
    </RulesHelpProvider>
  );
}
