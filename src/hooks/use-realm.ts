'use client';

import { useState, useEffect, useCallback } from 'react';

export function useRealm(gameId: string, realmId: string) {
  const [realm, setRealm] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRealm = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/game/${gameId}/realm/${realmId}`);
      if (!res.ok) throw new Error('Failed to fetch realm');
      const data = await res.json();
      setRealm(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [gameId, realmId]);

  useEffect(() => { fetchRealm(); }, [fetchRealm]);

  return { realm, loading, refetch: fetchRealm };
}
