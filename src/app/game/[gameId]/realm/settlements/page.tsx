'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRole } from '@/hooks/use-role';
import { SETTLEMENT_DATA } from '@/lib/game-logic/constants';
import type { SettlementSize } from '@/types/game';

interface Settlement {
  id: string;
  name: string;
  size: SettlementSize;
  territoryId: string;
  buildings: Array<{
    id: string;
    type: string;
    category: string;
    size: string;
    constructionTurnsRemaining: number;
  }>;
}

export default function SettlementsPage() {
  const params = useParams();
  const gameId = params.gameId as string;
  const { realmId } = useRole();
  const [settlements, setSettlements] = useState<Settlement[]>([]);

  useEffect(() => {
    if (!realmId) {
      return;
    }

    fetch(`/api/game/${gameId}/settlements?realmId=${realmId}`)
      .then((response) => response.json())
      .then(setSettlements);
  }, [gameId, realmId]);

  return (
    <main className="min-h-screen p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Settlements</h1>
      <p className="text-ink-300 mb-6">Settlement management is GM-controlled. This page is read-only for players.</p>

      <div className="space-y-6">
        {settlements.map((settlement) => {
          const data = SETTLEMENT_DATA[settlement.size];
          const usedSlots = settlement.buildings?.length || 0;

          return (
            <Card key={settlement.id} variant="gold">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{settlement.name}</CardTitle>
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
                </div>

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
