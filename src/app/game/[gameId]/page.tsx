'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useRole } from '@/hooks/use-role';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface RealmOption {
  id: string;
  name: string;
}

export default function GameRedirect() {
  const router = useRouter();
  const params = useParams();
  const gameId = params.gameId as string;
  const { role, realmId, initState, loading, refresh } = useRole();

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);
  const [realmChoices, setRealmChoices] = useState<RealmOption[] | null>(null);

  // Redirect if already authenticated
  useEffect(() => {
    if (loading) {
      return;
    }

    if (role === 'gm') {
      if (initState === 'gm_world_setup') {
        router.replace(`/game/${gameId}/setup`);
        return;
      }

      router.replace(`/game/${gameId}/gm`);
      return;
    }

    if (role === 'player') {
      if (!realmId && initState && initState !== 'gm_world_setup' && initState !== 'active' && initState !== 'completed') {
        router.replace(`/game/${gameId}/create-realm`);
        return;
      }

      if (realmId) {
        router.replace(`/game/${gameId}/realm`);
        return;
      }
    }
  }, [role, realmId, initState, loading, gameId, router]);

  async function handleJoin() {
    if (!code.trim()) { setError('Please enter a game code'); return; }
    setJoining(true);
    setError('');
    try {
      const res = await fetch(`/api/game/${gameId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.toUpperCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (data.needsRealmSelection) {
        setRealmChoices(data.realms);
      } else {
        refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to join game');
    } finally {
      setJoining(false);
    }
  }

  async function handleSelectRealm(selectedRealmId: string) {
    setJoining(true);
    setError('');
    try {
      const res = await fetch(`/api/game/${gameId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.toUpperCase(), realmId: selectedRealmId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to select realm');
    } finally {
      setJoining(false);
    }
  }

  // Already authenticated — show loading while redirect fires
  if (role === 'gm' || (role === 'player' && realmId)) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="font-heading text-ink-300 text-lg">Loading game...</p>
      </main>
    );
  }

  // Realm selection step
  if (realmChoices) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Choose Your Realm</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              {realmChoices.map((realm) => (
                <Button
                  key={realm.id}
                  variant="outline"
                  onClick={() => handleSelectRealm(realm.id)}
                  disabled={joining}
                  className="w-full"
                >
                  {realm.name}
                </Button>
              ))}
              {error && <p className="text-red-500 text-sm">{error}</p>}
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  // Join form
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Join Game</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <Input
              label="Game Code"
              placeholder="Enter your 6-character code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              maxLength={6}
              className="text-center text-2xl tracking-[0.3em] font-heading"
            />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <Button variant="accent" onClick={handleJoin} disabled={joining} className="w-full">
              {joining ? 'Joining...' : 'Join Game'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
