'use client';

import { useState, useEffect, useCallback } from 'react';
import type { GameInitState, GamePhase, GMSetupState, Season, TurnPhase } from '@/types/game';

interface GameData {
  id: string;
  name: string;
  gmCode?: string;
  playerCode?: string;
  gamePhase: GamePhase;
  initState: GameInitState;
  gmSetupState: GMSetupState;
  currentYear: number;
  currentSeason: Season;
  turnPhase: TurnPhase;
}

interface RealmData {
  id: string;
  gameId: string;
  name: string;
  governmentType: string;
  traditions: string;
  treasury: number;
  taxType: string;
  turmoil: number;
  turmoilSources: string;
}

export function useGame(gameId: string) {
  const [game, setGame] = useState<GameData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGame = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/game/${gameId}`);
      if (!res.ok) throw new Error('Failed to fetch game');
      const data = await res.json();
      setGame(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => { fetchGame(); }, [fetchGame]);

  return { game, loading, error, refetch: fetchGame };
}

export function useRealms(gameId: string) {
  const [realms, setRealms] = useState<RealmData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRealms = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/game/${gameId}/realms`);
      if (!res.ok) throw new Error('Failed to fetch realms');
      const data = await res.json();
      setRealms(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => { fetchRealms(); }, [fetchRealms]);

  return { realms, loading, refetch: fetchRealms };
}
