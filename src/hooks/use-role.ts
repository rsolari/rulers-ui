'use client';

import { useState, useEffect } from 'react';

export type GameRole = 'gm' | 'player' | null;

export function useRole(): { role: GameRole; gameId: string | null; realmId: string | null } {
  const [role, setRole] = useState<GameRole>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [realmId, setRealmId] = useState<string | null>(null);

  useEffect(() => {
    // Read from cookies on client side
    const cookies = document.cookie.split(';').reduce((acc, c) => {
      const [key, val] = c.trim().split('=');
      acc[key] = val;
      return acc;
    }, {} as Record<string, string>);

    setRole((cookies['rulers-role'] as GameRole) || null);
    setGameId(cookies['rulers-game-id'] || null);
    setRealmId(cookies['rulers-realm-id'] || null);
  }, []);

  return { role, gameId, realmId };
}
