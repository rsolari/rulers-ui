'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Dialog, DialogTitle, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { useRole } from '@/hooks/use-role';
import { BUILDING_DEFS, BUILDING_SIZE_DATA, SETTLEMENT_DATA } from '@/lib/game-logic/constants';
import type { BuildingType, SettlementSize } from '@/types/game';

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
  const [buildDialog, setBuildDialog] = useState<{ settlementId: string } | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingType>('Chapel');

  useEffect(() => {
    if (!realmId) return;
    fetch(`/api/game/${gameId}/settlements?realmId=${realmId}`)
      .then(r => r.json())
      .then(setSettlements);
  }, [gameId, realmId]);

  async function buildBuilding() {
    if (!buildDialog) return;
    await fetch(`/api/game/${gameId}/buildings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        settlementId: buildDialog.settlementId,
        type: selectedBuilding,
      }),
    });
    setBuildDialog(null);
    // Refresh
    const res = await fetch(`/api/game/${gameId}/settlements?realmId=${realmId}`);
    setSettlements(await res.json());
  }

  const buildingOptions = Object.entries(BUILDING_DEFS).map(([key, def]) => ({
    value: key,
    label: `${key} (${def.category}, ${def.size})`,
  }));

  return (
    <main className="min-h-screen p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Settlements & Buildings</h1>

      <div className="space-y-6">
        {settlements.map(s => {
          const data = SETTLEMENT_DATA[s.size];
          const usedSlots = s.buildings?.length || 0;

          return (
            <Card key={s.id} variant="gold">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{s.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="gold">{s.size}</Badge>
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
                <div className="space-y-1 mb-4">
                  {s.buildings?.map(b => (
                    <div key={b.id} className="flex items-center justify-between p-2 medieval-border rounded">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{b.type}</span>
                        <Badge>{b.category}</Badge>
                        <Badge>{b.size}</Badge>
                      </div>
                      {b.constructionTurnsRemaining > 0 && (
                        <Badge variant="gold">{b.constructionTurnsRemaining} turns left</Badge>
                      )}
                    </div>
                  ))}
                  {(!s.buildings || s.buildings.length === 0) && (
                    <p className="text-ink-300 text-sm">No buildings yet.</p>
                  )}
                </div>

                {usedSlots < data.buildingSlots && (
                  <Button variant="outline" size="sm" onClick={() => setBuildDialog({ settlementId: s.id })}>
                    + Build
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}

        {settlements.length === 0 && (
          <p className="text-ink-300 text-center py-8">No settlements in your realm yet.</p>
        )}
      </div>

      {buildDialog && (
        <Dialog open onClose={() => setBuildDialog(null)}>
          <DialogTitle>Construct Building</DialogTitle>
          <DialogContent>
            <Select
              label="Building Type"
              options={buildingOptions}
              value={selectedBuilding}
              onChange={e => setSelectedBuilding(e.target.value as BuildingType)}
            />
            {BUILDING_DEFS[selectedBuilding] && (
              <div className="mt-4 p-3 medieval-border rounded">
                <p className="text-sm"><strong>Category:</strong> {BUILDING_DEFS[selectedBuilding].category}</p>
                <p className="text-sm"><strong>Size:</strong> {BUILDING_DEFS[selectedBuilding].size}</p>
                <p className="text-sm"><strong>Build Time:</strong> {BUILDING_SIZE_DATA[BUILDING_DEFS[selectedBuilding].size].buildTime} turns</p>
                <p className="text-sm"><strong>Cost:</strong> {BUILDING_SIZE_DATA[BUILDING_DEFS[selectedBuilding].size].buildCost.toLocaleString()} coins</p>
                <p className="text-sm"><strong>Maintenance:</strong> {BUILDING_SIZE_DATA[BUILDING_DEFS[selectedBuilding].size].maintenance.toLocaleString()} /season</p>
                <p className="text-sm mt-2">{BUILDING_DEFS[selectedBuilding].description}</p>
              </div>
            )}
          </DialogContent>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBuildDialog(null)}>Cancel</Button>
            <Button variant="accent" onClick={buildBuilding}>Build</Button>
          </DialogFooter>
        </Dialog>
      )}
    </main>
  );
}
