'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { GameShellDto } from '@/types/shell';

interface GamePrimaryActionProps {
  shell: GameShellDto;
  onRefresh: () => Promise<void>;
}

export function GamePrimaryAction({ shell, onRefresh }: GamePrimaryActionProps) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const { game, session, activeRealmId, setup } = shell;

  async function startGame() {
    setStarting(true);
    setError('');

    try {
      const response = await fetch(`/api/game/${game.id}/start`, { method: 'POST' });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error ?? 'Failed to start the game');
        return;
      }

      await onRefresh();
      router.push(`/game/${game.id}/gm`);
      router.refresh();
    } finally {
      setStarting(false);
    }
  }

  if (session.role === 'gm' && activeRealmId) {
    return <LinkButton href={`/game/${game.id}/gm`} label="Return to GM View" />;
  }

  if (session.role === 'gm') {
    if (game.initState === 'gm_world_setup') {
      return <LinkButton href={`/game/${game.id}/setup`} label="Continue World Setup" />;
    }

    if (setup?.canStartGame && game.initState !== 'active' && game.initState !== 'completed') {
      return (
        <div className="flex min-w-0 flex-col gap-1 sm:items-end">
          <Button className="w-full sm:w-auto" variant="accent" onClick={() => void startGame()} disabled={starting}>
            {starting ? 'Starting...' : 'Start Game'}
          </Button>
          {error && <p className="max-w-56 text-right text-xs font-semibold text-red-500">{error}</p>}
        </div>
      );
    }

    if (game.initState !== 'active' && game.initState !== 'completed') {
      return <LinkButton href={`/game/${game.id}/gm/realm-slots`} label="Manage Realm Slots" />;
    }

    return <LinkButton href={`/game/${game.id}/gm#turn-review`} label="Review Turns" />;
  }

  if (session.role === 'player') {
    if (!activeRealmId) {
      return <LinkButton href={`/game/${game.id}/create-realm`} label="Create Realm" />;
    }

    if (game.gamePhase === 'Active') {
      return <LinkButton href={`/game/${game.id}/realm/report`} label="Turn Report" />;
    }

    if (game.initState === 'completed') {
      return <LinkButton href={`/game/${game.id}/realm`} label="View Realm" />;
    }

    return <LinkButton href={`/game/${game.id}/realm`} label="Continue Setup" />;
  }

  return null;
}

function LinkButton({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="w-full sm:w-auto">
      <Button className="w-full sm:w-auto" variant="accent">{label}</Button>
    </Link>
  );
}
