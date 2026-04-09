'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { NobleAssignmentSelect } from '@/components/governance/NobleAssignmentSelect';
import { useRole } from '@/hooks/use-role';
import { SETTLEMENT_DATA } from '@/lib/game-logic/constants';
import type { SettlementSize } from '@/types/game';

interface GoverningNoble {
  id: string;
  name: string;
}

interface Settlement {
  id: string;
  name: string;
  size: SettlementSize;
  territoryId: string;
  governingNobleId: string | null;
  governingNoble: GoverningNoble | null;
  buildings: Array<{
    id: string;
    type: string;
    category: string;
    size: string;
    takesBuildingSlot?: boolean;
    constructionTurnsRemaining: number;
  }>;
}

interface Noble {
  id: string;
  name: string;
}

export default function SettlementsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const gameId = params.gameId as string;
  const { role, realmId: sessionRealmId, initState } = useRole();
  const gmRealmIdParam = searchParams.get('realmId');
  const isGmManaging = role === 'gm' && Boolean(gmRealmIdParam);
  const realmId = isGmManaging ? gmRealmIdParam : sessionRealmId;
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [nobles, setNobles] = useState<Noble[]>([]);

  const isSetup = initState === 'parallel_final_setup' || initState === 'ready_to_start' || isGmManaging;

  useEffect(() => {
    if (!realmId) return;

    fetch(`/api/game/${gameId}/settlements?realmId=${realmId}`)
      .then((r) => r.json())
      .then(setSettlements);

    fetch(`/api/game/${gameId}/nobles?realmId=${realmId}`)
      .then((r) => r.json())
      .then(setNobles);
  }, [gameId, realmId]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  async function renameSettlement(settlementId: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;

    setSavingName(true);
    const response = await fetch(`/api/game/${gameId}/settlements`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settlementId, name: trimmed }),
    });
    setSavingName(false);

    if (!response.ok) return;

    setEditingId(null);
    const res = await fetch(`/api/game/${gameId}/settlements?realmId=${realmId}`);
    setSettlements(await res.json());
  }

  function startEditing(settlement: Settlement) {
    setEditingId(settlement.id);
    setEditingName(settlement.name);
    setTimeout(() => {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }, 0);
  }

  async function assignGovernor(settlementId: string, nobleId: string | null): Promise<string | null> {
    const response = await fetch(`/api/game/${gameId}/settlements/${settlementId}/governor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nobleId }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return data.error ?? 'Failed to assign governor';
    }

    // Refresh settlements
    const res = await fetch(`/api/game/${gameId}/settlements?realmId=${realmId}`);
    setSettlements(await res.json());
    return null;
  }

  return (
    <main className="min-h-screen p-6 max-w-6xl mx-auto">
      <nav className="mb-4 text-sm text-ink-300">
        <Link href={`/game/${gameId}/realm${isGmManaging ? `?realmId=${realmId}` : ''}`} className="hover:text-ink-100">← Realm</Link>
      </nav>
      <h1 className="text-3xl font-bold mb-2">Settlements</h1>
      <p className="text-ink-300 mb-6">
        {isSetup
          ? 'Name your settlements and assign governors during setup.'
          : 'Settlement management is GM-controlled. This page is read-only for players.'}
      </p>

      <div className="space-y-6">
        {settlements.map((settlement) => {
          const data = SETTLEMENT_DATA[settlement.size];
          const usedSlots = settlement.buildings?.filter((building) => building.takesBuildingSlot !== false).length ?? 0;

          return (
            <Card key={settlement.id} variant="gold">
              <CardHeader>
                <div className="flex items-center justify-between">
                  {isSetup && editingId === settlement.id ? (
                    <form
                      className="flex items-center gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        renameSettlement(settlement.id, editingName);
                      }}
                    >
                      <input
                        ref={nameInputRef}
                        className="bg-transparent border-b border-gold-500 text-xl font-heading font-bold text-ink-100 outline-none px-0 py-0.5 w-48"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={() => renameSettlement(settlement.id, editingName)}
                        disabled={savingName}
                      />
                    </form>
                  ) : (
                    <CardTitle
                      className={isSetup ? 'cursor-pointer hover:text-gold-400 transition-colors' : ''}
                      onClick={isSetup ? () => startEditing(settlement) : undefined}
                    >
                      {settlement.name}
                      {isSetup && (
                        <span className="ml-2 text-sm font-normal text-ink-400">✎</span>
                      )}
                    </CardTitle>
                  )}
                  <div className="flex items-center gap-2">
                    <Badge variant="gold">{settlement.size}</Badge>
                    <Badge>{usedSlots}/{data.buildingSlots} slots</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <p className="text-sm"><strong>Food Need:</strong> {data.foodNeed}</p>
                  <p className="text-sm"><strong>Max Troops:</strong> {data.maxTroops}</p>
                  <p className="text-sm"><strong>Recruit/Season:</strong> {data.recruitPerSeason}</p>
                  <p className="text-sm">
                    <strong>Governor:</strong>{' '}
                    {settlement.governingNoble
                      ? settlement.governingNoble.name
                      : <span className="text-ink-300">None</span>}
                  </p>
                </div>

                {isSetup && (
                  <div className="mb-4">
                    <NobleAssignmentSelect
                      label="Assign Governor"
                      nobles={nobles}
                      currentNobleId={settlement.governingNobleId}
                      onAssign={(nobleId) => assignGovernor(settlement.id, nobleId)}
                    />
                  </div>
                )}

                <p className="font-heading font-semibold mb-2">Buildings</p>
                <div className="space-y-1">
                  {settlement.buildings?.map((building) => (
                    <div key={building.id} className="flex items-center justify-between p-2 medieval-border rounded">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{building.type}</span>
                        <Badge>{building.category}</Badge>
                        <Badge>{building.size}</Badge>
                      </div>
                      {building.constructionTurnsRemaining > 0 && (
                        <Badge variant="gold">{building.constructionTurnsRemaining} turns left</Badge>
                      )}
                    </div>
                  ))}
                  {(!settlement.buildings || settlement.buildings.length === 0) && (
                    <p className="text-ink-300 text-sm">No buildings yet.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </main>
  );
}
