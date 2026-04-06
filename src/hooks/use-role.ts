'use client';

import { useState, useCallback } from 'react';

export type GameRole = 'gm' | 'player' | null;

export interface RoleState {
  role: GameRole;
  gameId: string | null;
  realmId: string | null;
  refresh: () => void;
}

function readRoleState(): Omit<RoleState, 'refresh'> {
  if (typeof document === 'undefined') {
    return { role: null, gameId: null, realmId: null };
  }

  const cookies = document.cookie.split(';').reduce((acc, cookie) => {
    const [key, val] = cookie.trim().split('=');
    acc[key] = val;
    return acc;
  }, {} as Record<string, string>);

  return {
    role: (cookies['rulers-role'] as GameRole) || null,
    gameId: cookies['rulers-game-id'] || null,
    realmId: cookies['rulers-realm-id'] || null,
  };
}

export function useRole(): RoleState {
  const [state, setState] = useState<Omit<RoleState, 'refresh'>>(readRoleState);

  const refresh = useCallback(() => {
    setState(readRoleState());
  }, []);

  return { ...state, refresh };
}
