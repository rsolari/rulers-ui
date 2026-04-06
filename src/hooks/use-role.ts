'use client';

import { useEffect, useState, useCallback } from 'react';
import type { GamePhase } from '@/types/game';

export type GameRole = 'gm' | 'player' | null;

export interface RoleState {
  role: GameRole;
  gameId: string | null;
  realmId: string | null;
  gamePhase: GamePhase | null;
  displayName: string | null;
  territoryId: string | null;
  loading: boolean;
  refresh: () => void;
}

type SessionState = Omit<RoleState, 'refresh'>;

const initialState: SessionState = {
  role: null,
  gameId: null,
  realmId: null,
  gamePhase: null,
  displayName: null,
  territoryId: null,
  loading: true,
};

export function useRole(): RoleState {
  const [state, setState] = useState<SessionState>(initialState);
  const [refreshCounter, setRefreshCounter] = useState(0);

  const refresh = useCallback(() => {
    setRefreshCounter((count) => count + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadSession() {
      try {
        const response = await fetch('/api/auth/session', {
          signal: controller.signal,
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error('Failed to fetch session');
        }

        const session = await response.json();
        setState({
          role: session.role ?? null,
          gameId: session.gameId ?? null,
          realmId: session.realmId ?? null,
          gamePhase: session.gamePhase ?? null,
          displayName: session.displayName ?? null,
          territoryId: session.territoryId ?? null,
          loading: false,
        });
      } catch {
        if (!controller.signal.aborted) {
          setState({ ...initialState, loading: false });
        }
      }
    }

    loadSession();

    return () => controller.abort();
  }, [refreshCounter]);

  return { ...state, refresh };
}
