'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Game {
  id: string;
  name: string;
  currentYear: number;
  currentSeason: string;
  turnPhase: string;
  gamePhase: string;
  gmCode?: string;
  playerCode?: string;
}

interface Realm {
  id: string;
  name: string;
  governmentType: string;
  treasury: number;
  turmoil: number;
  isNPC: boolean;
  traditions: string;
}

interface PlayerSlot {
  id: string;
  claimCode: string;
  territoryId: string;
  territoryName: string | null;
  realmId: string | null;
  displayName: string | null;
  status: 'claimed' | 'unclaimed';
}

export default function GMDashboard() {
  const params = useParams();
  const gameId = params.gameId as string;
  const [game, setGame] = useState<Game | null>(null);
  const [realms, setRealms] = useState<Realm[]>([]);
  const [playerSlots, setPlayerSlots] = useState<PlayerSlot[]>([]);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    async function loadDashboard() {
      const [gameResponse, realmsResponse, slotsResponse] = await Promise.all([
        fetch(`/api/game/${gameId}`, { cache: 'no-store' }),
        fetch(`/api/game/${gameId}/realms`, { cache: 'no-store' }),
        fetch(`/api/game/${gameId}/player-slots`, { cache: 'no-store' }),
      ]);

      setGame(await gameResponse.json());
      setRealms(await realmsResponse.json());
      setPlayerSlots(slotsResponse.ok ? await slotsResponse.json() : []);
    }

    void loadDashboard();
  }, [gameId]);

  async function startGame() {
    setStarting(true);
    const response = await fetch(`/api/game/${gameId}/start`, { method: 'POST' });

    if (response.ok) {
      const updated = await fetch(`/api/game/${gameId}`, { cache: 'no-store' });
      setGame(await updated.json());
    }

    setStarting(false);
  }

  if (!game) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="font-heading text-ink-300 text-lg">Loading GM dashboard...</p>
      </main>
    );
  }

  const npcRealms = realms.filter((realm) => realm.isNPC);
  const playerRealms = realms.filter((realm) => !realm.isNPC);

  return (
    <main className="min-h-screen p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">{game.name}</h1>
          <p className="text-ink-300">GM Dashboard</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="gold">{game.gamePhase}</Badge>
          <Badge>Year {game.currentYear}, {game.currentSeason}</Badge>
          <Badge>{game.turnPhase}</Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardContent>
            <p className="text-sm text-ink-300 pt-4">GM Code</p>
            <p className="font-mono text-2xl">{game.gmCode}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-ink-300 pt-4">Player Slots</p>
            <p className="text-3xl font-heading font-bold">{playerSlots.length}</p>
            <p className="text-sm text-ink-300">{playerSlots.filter((slot) => slot.status === 'claimed').length} claimed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-ink-300 pt-4">Realms</p>
            <p className="text-3xl font-heading font-bold">{realms.length}</p>
            <p className="text-sm text-ink-300">{npcRealms.length} NPC / {playerRealms.length} player</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-3 mb-6">
        <Link href={`/game/${gameId}/setup`}>
          <Button variant="outline">Edit Setup</Button>
        </Link>
        {game.gamePhase === 'RealmCreation' && (
          <Button variant="accent" onClick={() => void startGame()} disabled={starting}>
            {starting ? 'Starting...' : 'Start Game'}
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Player Slots</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {playerSlots.map((slot) => (
                <div key={slot.id} className="p-3 medieval-border rounded flex items-center justify-between gap-4">
                  <div>
                    <p className="font-heading font-semibold">{slot.territoryName || slot.territoryId}</p>
                    <p className="text-sm text-ink-300">{slot.displayName || 'Unlabeled player slot'}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant={slot.status === 'claimed' ? 'green' : 'gold'}>{slot.status}</Badge>
                    <p className="font-mono text-lg mt-1">{slot.claimCode}</p>
                  </div>
                </div>
              ))}
              {playerSlots.length === 0 && <p className="text-ink-300 text-sm">No player slots yet.</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>NPC Realms</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {npcRealms.map((realm) => (
                <div key={realm.id} className="p-3 medieval-border rounded">
                  <div className="flex items-center justify-between">
                    <span className="font-heading font-semibold">{realm.name}</span>
                    <Badge variant="gold">NPC</Badge>
                  </div>
                  <p className="text-sm text-ink-300">{realm.governmentType}</p>
                </div>
              ))}
              {npcRealms.length === 0 && <p className="text-ink-300 text-sm">No NPC realms configured.</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>All Realms</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {realms.map((realm) => (
              <div key={realm.id} className="flex items-center justify-between p-3 medieval-border rounded">
                <div>
                  <span className="font-heading font-semibold">{realm.name}</span>
                  <span className="text-ink-300 ml-2">{realm.governmentType}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={realm.isNPC ? 'gold' : 'default'}>{realm.isNPC ? 'NPC' : 'Player'}</Badge>
                  <span className="text-sm">Treasury {realm.treasury.toLocaleString()}</span>
                  <Badge variant={realm.turmoil > 5 ? 'red' : realm.turmoil > 2 ? 'gold' : 'green'}>
                    Turmoil {realm.turmoil}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
