'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogTitle, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { useRole } from '@/hooks/use-role';
import { TROOP_DEFS } from '@/lib/game-logic/constants';
import type { TroopType } from '@/types/game';

interface Army {
  id: string;
  name: string;
  generalId: string | null;
  locationTerritoryId: string;
  movementTurnsRemaining: number;
}

interface Troop {
  id: string;
  type: string;
  class: string;
  armourType: string;
  condition: string;
  armyId: string | null;
  garrisonSettlementId: string | null;
  recruitmentTurnsRemaining: number;
}

interface SiegeUnit {
  id: string;
  type: string;
  armyId: string | null;
  constructionTurnsRemaining: number;
}

async function fetchArmyData(gameId: string, realmId: string) {
  const response = await fetch(`/api/game/${gameId}/armies?realmId=${realmId}`);
  const data = await response.json();

  return {
    armies: data.armies || [],
    troops: data.troops || [],
    siegeUnits: data.siegeUnits || [],
  };
}

export default function ArmyPage() {
  const params = useParams();
  const gameId = params.gameId as string;
  const { realmId, territoryId } = useRole();
  const [armies, setArmies] = useState<Army[]>([]);
  const [allTroops, setTroops] = useState<Troop[]>([]);
  const [allSiege, setSiege] = useState<SiegeUnit[]>([]);
  const [createArmyOpen, setCreateArmyOpen] = useState(false);
  const [recruitOpen, setRecruitOpen] = useState<string | null>(null); // armyId or 'garrison'
  const [newArmyName, setNewArmyName] = useState('');
  const [selectedTroopType, setSelectedTroopType] = useState<TroopType>('Spearmen');

  useEffect(() => {
    if (!realmId) return;

    fetchArmyData(gameId, realmId).then((data) => {
      setArmies(data.armies);
      setTroops(data.troops);
      setSiege(data.siegeUnits);
    });
  }, [gameId, realmId]);

  async function createArmy() {
    if (!newArmyName.trim() || !realmId || !territoryId) return;

    await fetch(`/api/game/${gameId}/armies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ realmId, name: newArmyName, locationTerritoryId: territoryId }),
    });
    const data = await fetchArmyData(gameId, realmId);
    setNewArmyName('');
    setCreateArmyOpen(false);
    setArmies(data.armies);
    setTroops(data.troops);
    setSiege(data.siegeUnits);
  }

  async function recruitTroop() {
    if (!realmId) return;
    await fetch(`/api/game/${gameId}/troops`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        realmId,
        type: selectedTroopType,
        armyId: recruitOpen === 'garrison' ? null : recruitOpen,
      }),
    });
    const data = await fetchArmyData(gameId, realmId);
    setRecruitOpen(null);
    setArmies(data.armies);
    setTroops(data.troops);
    setSiege(data.siegeUnits);
  }

  const troopOptions = Object.entries(TROOP_DEFS).map(([key, def]) => ({
    value: key,
    label: `${key} (${def.class}, ${def.upkeep}/season)`,
  }));

  const garrisonTroops = allTroops.filter(t => !t.armyId);

  return (
    <main className="min-h-screen p-6 max-w-6xl mx-auto">
      <nav className="mb-4 text-sm text-ink-300">
        <Link href={`/game/${gameId}/realm`} className="hover:text-ink-100">← Realm</Link>
      </nav>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Armies & Troops</h1>
        <Button variant="accent" onClick={() => setCreateArmyOpen(true)}>+ New Army</Button>
      </div>

      {/* Garrison */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Garrison (Unassigned)</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setRecruitOpen('garrison')}>+ Recruit</Button>
          </div>
        </CardHeader>
        <CardContent>
          <TroopList troops={garrisonTroops} />
        </CardContent>
      </Card>

      {/* Armies */}
      <div className="space-y-4">
        {armies.map(army => {
          const armyTroops = allTroops.filter(t => t.armyId === army.id);
          const armySiege = allSiege.filter(s => s.armyId === army.id);

          return (
            <Card key={army.id} variant="gold">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{army.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    {army.movementTurnsRemaining > 0 && (
                      <Badge variant="gold">Moving ({army.movementTurnsRemaining} turns)</Badge>
                    )}
                    <Badge>{armyTroops.length} troops</Badge>
                    <Button variant="outline" size="sm" onClick={() => setRecruitOpen(army.id)}>+ Recruit</Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <TroopList troops={armyTroops} />
                {armySiege.length > 0 && (
                  <div className="mt-3">
                    <p className="font-heading font-semibold mb-1">Siege Units</p>
                    {armySiege.map(s => (
                      <div key={s.id} className="flex items-center justify-between py-1">
                        <span>{s.type}</span>
                        {s.constructionTurnsRemaining > 0 && (
                          <Badge variant="gold">{s.constructionTurnsRemaining} turns to build</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Create army dialog */}
      {createArmyOpen && (
        <Dialog open onClose={() => setCreateArmyOpen(false)}>
          <DialogTitle>Create Army</DialogTitle>
          <DialogContent>
            <Input label="Army Name" value={newArmyName} onChange={e => setNewArmyName(e.target.value)} />
          </DialogContent>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateArmyOpen(false)}>Cancel</Button>
            <Button variant="accent" onClick={createArmy}>Create</Button>
          </DialogFooter>
        </Dialog>
      )}

      {/* Recruit dialog */}
      {recruitOpen && (
        <Dialog open onClose={() => setRecruitOpen(null)}>
          <DialogTitle>Recruit Troop</DialogTitle>
          <DialogContent>
            <Select
              label="Troop Type"
              options={troopOptions}
              value={selectedTroopType}
              onChange={e => setSelectedTroopType(e.target.value as TroopType)}
            />
            {TROOP_DEFS[selectedTroopType] && (
              <div className="mt-3 p-3 medieval-border rounded text-sm space-y-1">
                <p><strong>Class:</strong> {TROOP_DEFS[selectedTroopType].class}</p>
                <p><strong>Armour:</strong> {TROOP_DEFS[selectedTroopType].armourTypes.join(', ')}</p>
                <p><strong>Upkeep:</strong> {TROOP_DEFS[selectedTroopType].upkeep.toLocaleString()}gc /season</p>
                <p><strong>Bonus:</strong> {TROOP_DEFS[selectedTroopType].bonus}</p>
                {TROOP_DEFS[selectedTroopType].requires.length > 0 && (
                  <p><strong>Requires:</strong> {TROOP_DEFS[selectedTroopType].requires.join(', ')}</p>
                )}
              </div>
            )}
          </DialogContent>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRecruitOpen(null)}>Cancel</Button>
            <Button variant="accent" onClick={recruitTroop}>Recruit</Button>
          </DialogFooter>
        </Dialog>
      )}
    </main>
  );
}

function TroopList({ troops }: { troops: Troop[] }) {
  if (troops.length === 0) {
    return <p className="text-ink-300 text-sm">No troops.</p>;
  }

  // Group by type
  const grouped = troops.reduce<Record<string, Troop[]>>((acc, t) => {
    acc[t.type] = acc[t.type] || [];
    acc[t.type].push(t);
    return acc;
  }, {});

  return (
    <div className="space-y-1">
      {Object.entries(grouped).map(([type, list]) => (
        <div key={type} className="flex items-center justify-between py-1 px-2 medieval-border rounded">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{type}</span>
            <Badge>{list[0].class}</Badge>
            <Badge>{list[0].armourType}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold">x{list.length}</span>
            {list.some(t => t.condition !== 'Healthy') && (
              <Badge variant="red">{list.filter(t => t.condition !== 'Healthy').length} wounded</Badge>
            )}
            {list.some(t => t.recruitmentTurnsRemaining > 0) && (
              <Badge variant="gold">{list.filter(t => t.recruitmentTurnsRemaining > 0).length} recruiting</Badge>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
