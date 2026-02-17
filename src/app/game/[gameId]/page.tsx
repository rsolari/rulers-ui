'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useRole } from '@/hooks/use-role';

export default function GameRedirect() {
  const router = useRouter();
  const params = useParams();
  const { role, realmId } = useRole();

  useEffect(() => {
    const gameId = params.gameId as string;
    if (role === 'gm') {
      router.replace(`/game/${gameId}/gm`);
    } else if (role === 'player' && realmId) {
      router.replace(`/game/${gameId}/realm`);
    }
  }, [role, realmId, params.gameId, router]);

  return (
    <main className="min-h-screen flex items-center justify-center">
      <p className="font-heading text-ink-300 text-lg">Loading game...</p>
    </main>
  );
}
