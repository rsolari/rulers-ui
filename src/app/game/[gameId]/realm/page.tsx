'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRole } from '@/hooks/use-role';

interface Game {
  id: string;
  name: string;
  currentYear: number;
  currentSeason: string;
  turnPhase: string;
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

interface Settlement {
  id: string;
  name: string;
  size: string;
  buildings: Array<{ id: string; type: string; constructionTurnsRemaining: number }>;
}

export default function RealmDashboard() {
  const params = useParams();
  const gameId = params.gameId as string;
  const { realmId } = useRole();
  const [game, setGame] = useState<Game | null>(null);
  const [realm, setRealm] = useState<Realm | null>(null);
  const [settlements, setSettlements] = useState<Settlement[]>([]);

  useEffect(() => {
    fetch(`/api/game/${gameId}`).then(r => r.json()).then(setGame);
  }, [gameId]);

  useEffect(() => {
    if (!realmId) return;
    fetch(`/api/game/${gameId}/realms`).then(r => r.json()).then((list: Realm[]) => {
      setRealm(list.find(r => r.id === realmId) || null);
    });
    fetch(`/api/game/${gameId}/settlements?realmId=${realmId}`).then(r => r.json()).then(setSettlements);
  }, [gameId, realmId]);

  if (!game || !realm) {
    return <main className="min-h-screen flex items-center justify-center">
      <p className="font-heading text-ink-300 text-lg">Loading realm...</p>
    </main>;
  }

  const traditions: string[] = JSON.parse(realm.traditions || '[]');

  return (
    <main className="min-h-screen p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">{realm.name}</h1>
          <p className="text-ink-300">{realm.governmentType} - {game.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="gold">Year {game.currentYear}, {game.currentSeason}</Badge>
          <Badge>{game.turnPhase}</Badge>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent>
            <p className="text-sm text-ink-300 pt-4">Treasury</p>
            <p className="text-2xl font-bold font-heading">{realm.treasury.toLocaleString()}</p>
            <p className="text-xs text-ink-300">coins</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-ink-300 pt-4">Turmoil</p>
            <p className="text-2xl font-bold font-heading">{realm.turmoil}</p>
            <Badge variant={realm.turmoil > 5 ? 'red' : realm.turmoil > 2 ? 'gold' : 'green'} className="mt-1">
              {realm.turmoil > 5 ? 'Critical' : realm.turmoil > 2 ? 'Elevated' : 'Stable'}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-ink-300 pt-4">Settlements</p>
            <p className="text-2xl font-bold font-heading">{settlements.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-ink-300 pt-4">Tax Policy</p>
            <p className="text-2xl font-bold font-heading">{realm.taxType}</p>
            <p className="text-xs text-ink-300">{realm.taxType === 'Levy' ? '30%' : '15%'} rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Traditions */}
      <Card className="mb-6">
        <CardContent>
          <p className="text-sm text-ink-300 pt-4 mb-2">Traditions</p>
          <div className="flex gap-2">
            {traditions.map(t => <Badge key={t} variant="gold">{t}</Badge>)}
            {traditions.length === 0 && <span className="text-ink-300">None selected</span>}
          </div>
        </CardContent>
      </Card>

      {/* Settlements overview */}
      <Card className="mb-6">
        <CardHeader><CardTitle>Settlements</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {settlements.map(s => (
              <div key={s.id} className="flex items-center justify-between p-2 medieval-border rounded">
                <div className="flex items-center gap-3">
                  <span className="font-heading font-bold">{s.name}</span>
                  <Badge variant={s.size === 'City' ? 'gold' : s.size === 'Town' ? 'gold' : 'default'}>{s.size}</Badge>
                </div>
                <span className="text-sm text-ink-300">
                  {s.buildings?.length || 0} buildings
                </span>
              </div>
            ))}
            {settlements.length === 0 && <p className="text-ink-300 text-sm">No settlements yet.</p>}
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="grid grid-cols-3 gap-4">
        <Link href={`/game/${gameId}/realm/settlements`}>
          <Card className="hover:border-gold-500 transition-colors cursor-pointer">
            <CardContent><p className="font-heading font-bold pt-4">Settlements & Buildings</p></CardContent>
          </Card>
        </Link>
        <Link href={`/game/${gameId}/realm/nobles`}>
          <Card className="hover:border-gold-500 transition-colors cursor-pointer">
            <CardContent><p className="font-heading font-bold pt-4">Noble Families</p></CardContent>
          </Card>
        </Link>
        <Link href={`/game/${gameId}/realm/army`}>
          <Card className="hover:border-gold-500 transition-colors cursor-pointer">
            <CardContent><p className="font-heading font-bold pt-4">Armies & Troops</p></CardContent>
          </Card>
        </Link>
        <Link href={`/game/${gameId}/realm/treasury`}>
          <Card className="hover:border-gold-500 transition-colors cursor-pointer">
            <CardContent><p className="font-heading font-bold pt-4">Treasury & Trade</p></CardContent>
          </Card>
        </Link>
        <Link href={`/game/${gameId}/realm/trade`}>
          <Card className="hover:border-gold-500 transition-colors cursor-pointer">
            <CardContent><p className="font-heading font-bold pt-4">Trade Routes</p></CardContent>
          </Card>
        </Link>
        <Link href={`/game/${gameId}/realm/report`}>
          <Card className="hover:border-gold-500 transition-colors cursor-pointer">
            <CardContent><p className="font-heading font-bold pt-4">Turn Report</p></CardContent>
          </Card>
        </Link>
      </div>
    </main>
  );
}
