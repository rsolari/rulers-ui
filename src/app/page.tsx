'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function LandingPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'landing' | 'create' | 'join'>('landing');
  const [gameName, setGameName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [createdGame, setCreatedGame] = useState<{
    id: string; gmCode: string; playerCode: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCreateGame() {
    if (!gameName.trim()) { setError('Please enter a game name'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: gameName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCreatedGame(data);
      // Auto-join as GM
      await fetch(`/api/game/${data.id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: data.gmCode }),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create game');
    } finally {
      setLoading(false);
    }
  }

  async function handleJoinGame() {
    if (!joinCode.trim()) { setError('Please enter a game code'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/game/join-by-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: joinCode.toUpperCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(`/game/${data.gameId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to join game');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-10">
          <h1 className="text-5xl font-bold mb-3 tracking-wider">RULERS</h1>
          <p className="text-ink-300 text-lg">Conquest. Politics. Civilization.</p>
        </div>

        {mode === 'landing' && (
          <div className="flex flex-col gap-4">
            <Button size="lg" variant="accent" onClick={() => setMode('create')} className="w-full">
              Create New Game
            </Button>
            <Button size="lg" variant="outline" onClick={() => setMode('join')} className="w-full">
              Join Existing Game
            </Button>
          </div>
        )}

        {mode === 'create' && !createdGame && (
          <Card>
            <CardHeader>
              <CardTitle>Create a New Game</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                <Input
                  label="Game Name"
                  placeholder="e.g., The War of Five Crowns"
                  value={gameName}
                  onChange={(e) => setGameName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateGame()}
                />
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <div className="flex gap-3">
                  <Button variant="ghost" onClick={() => { setMode('landing'); setError(''); }}>
                    Back
                  </Button>
                  <Button variant="accent" onClick={handleCreateGame} disabled={loading} className="flex-1">
                    {loading ? 'Creating...' : 'Create Game'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {mode === 'create' && createdGame && (
          <Card variant="gold">
            <CardHeader>
              <CardTitle>Game Created!</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-sm text-ink-300 font-heading">Narrative Overlord Code</p>
                  <p className="text-2xl font-heading font-bold text-accent tracking-widest">{createdGame.gmCode}</p>
                  <p className="text-xs text-ink-300">Keep this secret! This is your GM access code.</p>
                </div>
                <div>
                  <p className="text-sm text-ink-300 font-heading">Player Code</p>
                  <p className="text-2xl font-heading font-bold text-ink-500 tracking-widest">{createdGame.playerCode}</p>
                  <p className="text-xs text-ink-300">Share this with your players to join.</p>
                </div>
                <Button
                  variant="accent"
                  onClick={() => router.push(`/game/${createdGame.id}/setup`)}
                  className="w-full"
                >
                  Begin Game Setup
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {mode === 'join' && (
          <Card>
            <CardHeader>
              <CardTitle>Join a Game</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                <Input
                  label="Game Code"
                  placeholder="Enter your 6-character code"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoinGame()}
                  maxLength={6}
                  className="text-center text-2xl tracking-[0.3em] font-heading"
                />
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <div className="flex gap-3">
                  <Button variant="ghost" onClick={() => { setMode('landing'); setError(''); }}>
                    Back
                  </Button>
                  <Button variant="default" onClick={handleJoinGame} disabled={loading} className="flex-1">
                    {loading ? 'Joining...' : 'Join Game'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
