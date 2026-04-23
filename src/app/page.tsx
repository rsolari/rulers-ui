'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Eyebrow, FleurDivider } from '@/components/ui/typography';

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

  const heroTextShadow = { textShadow: '0 1px 8px rgba(0,0,0,0.5)' };
  const heroLabelShadow = { textShadow: '0 1px 6px rgba(0,0,0,0.7), 0 0 2px rgba(0,0,0,0.5)' };

  return (
    <>
      {/* Hero background — fixed full-bleed image with dark wash + grain */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <Image
          src="/hero-kingdom-bg.webp"
          alt=""
          fill
          className="object-cover"
          priority
        />
        <div
          className="absolute inset-0"
          style={{
            background: [
              'linear-gradient(180deg, rgba(28,28,28,0.25) 0%, rgba(28,28,28,0.55) 100%)',
              'radial-gradient(ellipse at 50% 40%, transparent 35%, rgba(28,28,28,0.4) 100%)',
              'radial-gradient(ellipse at 25% 85%, rgba(218,165,32,0.18) 0%, transparent 55%)',
            ].join(', '),
          }}
        />
        <div
          className="absolute inset-0 opacity-20 mix-blend-multiply"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.47 0 0 0 0 0.35 0 0 0 0 0.22 0 0 0 0.5 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
          }}
        />
      </div>

      <main className="relative z-10 min-h-screen flex items-center justify-center p-6">
        <nav className="fixed top-0 right-0 p-6 z-20">
          <Link
            href="/rules"
            className="font-display text-[11px] uppercase tracking-[0.22em] text-[rgba(245,234,214,0.72)] hover:text-parchment-50 transition-colors"
          >
            Rulebook
          </Link>
        </nav>
        <div className="w-full max-w-[560px]">
          <div className="text-center mb-12">
            <Image
              src="/icons/crown.svg"
              alt=""
              width={44}
              height={44}
              className="inline-block [filter:brightness(0)_saturate(100%)_invert(78%)_sepia(47%)_saturate(635%)_hue-rotate(3deg)_brightness(95%)_contrast(90%)]"
            />
            <h1
              className="font-display font-bold text-[4rem] sm:text-[88px] tracking-[0.22em] leading-[1.1] mt-2 mb-1 text-parchment-50"
              style={{ textShadow: '0 3px 28px rgba(0,0,0,0.55), 0 1px 2px rgba(0,0,0,0.6)' }}
            >
              RULERS
            </h1>
            <p
              className="font-body italic text-lg text-gold-400 tracking-[0.06em] m-0"
              style={heroTextShadow}
            >
              Conquest. Politics. Civilization.
            </p>
            <p
              className="mt-3.5 font-display text-[11px] uppercase tracking-[0.28em] text-[rgba(245,234,214,0.85)]"
              style={heroLabelShadow}
            >
              Lead · Conspire · Build · Become Legend
            </p>
          </div>

          {mode === 'landing' && (
            <div className="flex flex-col gap-3.5">
              <Button size="lg" variant="accent" onClick={() => setMode('create')} className="w-full">
                Create New Game
              </Button>
              <Button size="lg" variant="outline-hero" onClick={() => setMode('join')} className="w-full">
                Join Existing Game
              </Button>
            </div>
          )}

          {mode === 'create' && !createdGame && (
            <Card variant="hero">
              <CardHeader>
                <Eyebrow>Forge a new campaign</Eyebrow>
                <CardTitle className="mt-1">Create a Game</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-5">
                  <Input
                    label="Game Name"
                    placeholder="e.g., The War of Five Crowns"
                    value={gameName}
                    onChange={(e) => setGameName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateGame()}
                  />
                  {error && <p className="text-red-500 text-sm font-body">{error}</p>}
                  <div className="flex gap-3 justify-end">
                    <Button variant="ghost" onClick={() => { setMode('landing'); setError(''); }}>
                      Back
                    </Button>
                    <Button variant="accent" onClick={handleCreateGame} disabled={loading}>
                      {loading ? 'Forging...' : 'Forge Campaign'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {mode === 'create' && createdGame && (
            <Card variant="hero-gold">
              <CardHeader>
                <Eyebrow>Your kingdom is founded</Eyebrow>
                <CardTitle className="mt-1">Narrative Overlord Code</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-5">
                  <div>
                    <p className="font-display text-[44px] font-bold text-gold-500 tracking-[0.32em] text-center py-3">
                      {createdGame.gmCode}
                    </p>
                    <p className="font-body italic text-sm text-ink-400 text-center mt-1">
                      Keep this secret — this is your GM access code.
                    </p>
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
            <Card variant="hero">
              <CardHeader>
                <Eyebrow>Enter the realm</Eyebrow>
                <CardTitle className="mt-1">Join a Game</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-5">
                  <Input
                    label="Claim or GM Code"
                    placeholder="HEXAR4"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && handleJoinGame()}
                    maxLength={6}
                    className="text-center text-[22px] tracking-[0.3em] font-display uppercase"
                  />
                  {error && <p className="text-red-500 text-sm font-body">{error}</p>}
                  <div className="flex gap-3 justify-end">
                    <Button variant="ghost" onClick={() => { setMode('landing'); setError(''); }}>
                      Back
                    </Button>
                    <Button variant="accent" onClick={handleJoinGame} disabled={loading}>
                      {loading ? 'Claiming...' : 'Claim Realm'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {mode === 'landing' && (
            <div className="mt-14">
              <FleurDivider tone="light" />
              <p
                className="text-center mt-[18px] font-body italic text-sm text-gold-400 max-w-md mx-auto leading-relaxed"
                style={heroTextShadow}
              >
                &ldquo;The Crown does not rest. From council chambers to battlefields,
                <br />
                your choices shape history.&rdquo;
              </p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
