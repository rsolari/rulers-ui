'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useRole } from '@/hooks/use-role';

export default function GameRedirect() {
  const router = useRouter();
  const params = useParams();
  const { role, realmId, gamePhase, loading } = useRole();

  useEffect(() => {
    if (loading) {
      return;
    }

    const gameId = params.gameId as string;

    if (role === 'gm') {
      if (gamePhase === 'Setup') {
        router.replace(`/game/${gameId}/setup`);
        return;
      }

      router.replace(`/game/${gameId}/gm`);
      return;
    }

    if (role === 'player') {
      if (!realmId && gamePhase === 'RealmCreation') {
        router.replace(`/game/${gameId}/create-realm`);
        return;
      }

      if (realmId) {
        router.replace(`/game/${gameId}/realm`);
        return;
      }
    }

    router.replace('/');
  }, [role, realmId, gamePhase, loading, params.gameId, router]);

  return (
    <main className="min-h-screen flex items-center justify-center">
      <p className="font-heading text-ink-300 text-lg">Loading game...</p>
    </main>
  );
}
