'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs } from '@/components/ui/tabs';

interface Game {
  id: string;
  name: string;
  currentYear: number;
  currentSeason: string;
  turnPhase: string;
  gmCode: string;
  playerCode: string;
}

interface Realm {
  id: string;
  name: string;
  governmentType: string;
  treasury: number;
  turmoil: number;
  taxType: string;
  traditions: string;
}

export default function GMDashboard() {
  const params = useParams();
  const gameId = params.gameId as string;
  const [game, setGame] = useState<Game | null>(null);
  const [realms, setRealms] = useState<Realm[]>([]);

  useEffect(() => {
    fetch(`/api/game/${gameId}`).then(r => r.json()).then(setGame);
    fetch(`/api/game/${gameId}/realms`).then(r => r.json()).then(setRealms);
  }, [gameId]);

  if (!game) {
    return <main className="min-h-screen flex items-center justify-center">
      <p className="font-heading text-ink-300 text-lg">Loading...</p>
    </main>;
  }

  return (
    <main className="min-h-screen p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">{game.name}</h1>
          <p className="text-ink-300">GM Dashboard</p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="gold">Year {game.currentYear}, {game.currentSeason}</Badge>
          <Badge>{game.turnPhase}</Badge>
        </div>
      </div>

      <Tabs
        defaultTab="overview"
        tabs={[
          {
            id: 'overview',
            label: 'Overview',
            content: <OverviewPanel gameId={gameId} game={game} realms={realms} />,
          },
          {
            id: 'realms',
            label: 'Realms',
            content: <GMRealmsPanel realms={realms} />,
          },
          {
            id: 'turn',
            label: 'Turn',
            content: <GMTurnPanel gameId={gameId} game={game} realms={realms} />,
          },
          {
            id: 'events',
            label: 'Events',
            content: <GMEventsPanel gameId={gameId} game={game} />,
          },
        ]}
      />
    </main>
  );
}

function OverviewPanel({ gameId, game, realms }: { gameId: string; game: Game; realms: Realm[] }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent>
            <p className="text-sm text-ink-300 pt-4">Game Codes</p>
            <p className="font-mono text-lg">GM: <strong>{game.gmCode}</strong></p>
            <p className="font-mono text-lg">Player: <strong>{game.playerCode}</strong></p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-ink-300 pt-4">Current Turn</p>
            <p className="text-2xl font-bold font-heading">Year {game.currentYear}</p>
            <p className="text-lg">{game.currentSeason} - {game.turnPhase}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-ink-300 pt-4">Realms</p>
            <p className="text-2xl font-bold font-heading">{realms.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Realms Overview</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {realms.map(realm => (
              <div key={realm.id} className="flex items-center justify-between p-3 medieval-border rounded">
                <div>
                  <span className="font-heading font-bold text-lg">{realm.name}</span>
                  <span className="text-ink-300 ml-2">{realm.governmentType}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span>Treasury: <strong>{realm.treasury.toLocaleString()}</strong></span>
                  <Badge variant={realm.turmoil > 5 ? 'red' : realm.turmoil > 2 ? 'gold' : 'green'}>
                    Turmoil: {realm.turmoil}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-4">
        <Link href={`/game/${gameId}/setup`}>
          <Button variant="outline">Edit Setup</Button>
        </Link>
      </div>
    </div>
  );
}

function GMRealmsPanel({ realms }: { realms: Realm[] }) {
  return (
    <div className="space-y-4">
      {realms.map(realm => {
        const traditions = JSON.parse(realm.traditions || '[]');
        return (
          <Card key={realm.id} variant="gold">
            <CardHeader>
              <CardTitle>{realm.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p><strong>Government:</strong> {realm.governmentType}</p>
                  <p><strong>Tax Policy:</strong> {realm.taxType}</p>
                  <p><strong>Treasury:</strong> {realm.treasury.toLocaleString()} coins</p>
                  <p><strong>Turmoil:</strong> {realm.turmoil}</p>
                </div>
                <div>
                  <p className="font-semibold mb-1">Traditions:</p>
                  <div className="flex flex-wrap gap-1">
                    {traditions.map((t: string) => (
                      <Badge key={t} variant="gold">{t}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function GMTurnPanel({ gameId, game, realms }: { gameId: string; game: Game; realms: Realm[] }) {
  const [reports, setReports] = useState<Array<{ id: string; realmId: string; status: string }>>([]);
  const [advancing, setAdvancing] = useState(false);

  useEffect(() => {
    fetch(`/api/game/${gameId}/turn`).then(r => r.json()).then(data => {
      setReports(data.reports || []);
    });
  }, [gameId]);

  async function advanceSeason() {
    setAdvancing(true);
    await fetch(`/api/game/${gameId}/turn/advance`, { method: 'POST' });
    window.location.reload();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Turn Reports - Year {game.currentYear}, {game.currentSeason}</CardTitle></CardHeader>
        <CardContent>
          {realms.map(realm => {
            const report = reports.find(r => r.realmId === realm.id);
            return (
              <div key={realm.id} className="flex items-center justify-between py-2 border-b border-ink-100 last:border-0">
                <span className="font-heading">{realm.name}</span>
                <Badge variant={report?.status === 'Submitted' ? 'gold' : report?.status === 'Resolved' ? 'green' : 'default'}>
                  {report?.status || 'Not Submitted'}
                </Badge>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4">
        <Button variant="accent" onClick={advanceSeason} disabled={advancing}>
          {advancing ? 'Advancing...' : 'Advance to Next Season'}
        </Button>
      </div>
    </div>
  );
}

function GMEventsPanel({ gameId, game }: { gameId: string; game: Game }) {
  const [events, setEvents] = useState<Array<{ id: string; year: number; season: string; description: string; realmId: string | null }>>([]);
  const [newEvent, setNewEvent] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetch(`/api/game/${gameId}/events`).then(r => r.json()).then(setEvents);
  }, [gameId]);

  async function addEvent() {
    if (!newEvent.trim()) return;
    setAdding(true);
    await fetch(`/api/game/${gameId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        year: game.currentYear,
        season: game.currentSeason,
        description: newEvent,
      }),
    });
    setNewEvent('');
    const res = await fetch(`/api/game/${gameId}/events`);
    setEvents(await res.json());
    setAdding(false);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Event Log</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <input
              className="flex-1 px-3 py-2 bg-parchment-50 border border-ink-200 rounded font-body"
              value={newEvent}
              onChange={e => setNewEvent(e.target.value)}
              placeholder="Describe a new event..."
              onKeyDown={e => e.key === 'Enter' && addEvent()}
            />
            <Button variant="accent" onClick={addEvent} disabled={adding}>Add</Button>
          </div>
          <div className="space-y-2">
            {events.map(ev => (
              <div key={ev.id} className="p-2 medieval-border rounded">
                <div className="flex items-center gap-2 mb-1">
                  <Badge>Year {ev.year}, {ev.season}</Badge>
                </div>
                <p className="text-sm">{ev.description}</p>
              </div>
            ))}
            {events.length === 0 && <p className="text-ink-300 text-sm">No events yet.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
