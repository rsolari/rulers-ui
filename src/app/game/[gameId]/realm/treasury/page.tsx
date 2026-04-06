'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { useRole } from '@/hooks/use-role';
import { TAX_RATES, ESTATE_COSTS, BUILDING_SIZE_DATA, BUILDING_DEFS, TROOP_DEFS, SIEGE_UNIT_DEFS, RESOURCE_BASE_WEALTH, RESOURCE_RARITY } from '@/lib/game-logic/constants';
import type { BuildingType, TroopType, SiegeUnitType, ResourceType, EstateLevel } from '@/types/game';

interface Realm {
  id: string;
  name: string;
  treasury: number;
  taxType: string;
  turmoil: number;
}

export default function TreasuryPage() {
  const params = useParams();
  const gameId = params.gameId as string;
  const { realmId } = useRole();
  const [realm, setRealm] = useState<Realm | null>(null);
  const [settlements, setSettlements] = useState<Array<{ id: string; name: string; size: string; buildings: Array<{ type: string; size: string; constructionTurnsRemaining: number }> }>>([]);
  const [militaryData, setMilitaryData] = useState<{ troops: Array<{ type: string }>; siegeUnits: Array<{ type: string }> }>({ troops: [], siegeUnits: [] });
  const [nobles, setNobles] = useState<Array<{ estateLevel: string; isPrisoner: boolean }>>([]);
  const [resources, setResources] = useState<Array<{ resourceType: string; rarity: string }>>([]);

  useEffect(() => {
    if (!realmId) return;
    fetch(`/api/game/${gameId}/realms`).then(r => r.json()).then((list: Realm[]) => {
      setRealm(list.find(r => r.id === realmId) || null);
    });
    fetch(`/api/game/${gameId}/settlements?realmId=${realmId}`).then(r => r.json()).then(setSettlements);
    fetch(`/api/game/${gameId}/armies?realmId=${realmId}`).then(r => r.json()).then(setMilitaryData);
    fetch(`/api/game/${gameId}/nobles?realmId=${realmId}`).then(r => r.json()).then(setNobles);
    fetch(`/api/game/${gameId}/resources`).then(r => r.json()).then(setResources);
  }, [gameId, realmId]);

  if (!realm) {
    return <main className="min-h-screen flex items-center justify-center">
      <p className="font-heading text-ink-300">Loading...</p>
    </main>;
  }

  // Calculate income
  const resourceWealth = resources.reduce((sum, r) => {
    return sum + (RESOURCE_BASE_WEALTH[RESOURCE_RARITY[r.resourceType as ResourceType]] || 0);
  }, 0);

  const taxRate = TAX_RATES[realm.taxType as keyof typeof TAX_RATES] || 0.15;
  const taxIncome = Math.floor(resourceWealth * taxRate);

  // Calculate expenses
  const buildingMaintenance = settlements.reduce((sum, s) => {
    return sum + (s.buildings || []).reduce((bsum, b) => {
      if (b.constructionTurnsRemaining > 0) return bsum;
      const def = BUILDING_DEFS[b.type as BuildingType];
      return bsum + (def ? BUILDING_SIZE_DATA[def.size].maintenance : 0);
    }, 0);
  }, 0);

  const troopUpkeep = (militaryData.troops || []).reduce((sum, t) => {
    const def = TROOP_DEFS[t.type as TroopType];
    return sum + (def ? def.upkeep : 0);
  }, 0);

  const siegeUpkeep = (militaryData.siegeUnits || []).reduce((sum, s) => {
    const def = SIEGE_UNIT_DEFS[s.type as SiegeUnitType];
    return sum + (def ? def.upkeep : 0);
  }, 0);

  const nobleUpkeep = nobles.reduce((sum, n) => {
    return sum + (ESTATE_COSTS[n.estateLevel as EstateLevel] || 0);
  }, 0);

  const totalExpenses = buildingMaintenance + troopUpkeep + siegeUpkeep + nobleUpkeep;
  const netIncome = taxIncome - totalExpenses;

  return (
    <main className="min-h-screen p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Treasury</h1>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card variant="gold">
          <CardContent>
            <p className="text-sm text-ink-300 pt-4">Current Treasury</p>
            <p className="text-3xl font-bold font-heading">{realm.treasury.toLocaleString()}</p>
            <p className="text-sm text-ink-300">coins</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-ink-300 pt-4">Net Income / Season</p>
            <p className={`text-3xl font-bold font-heading ${netIncome >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {netIncome >= 0 ? '+' : ''}{netIncome.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-ink-300 pt-4">Tax Policy</p>
            <p className="text-2xl font-bold font-heading">{realm.taxType}</p>
            <p className="text-sm text-ink-300">{(taxRate * 100).toFixed(0)}% rate</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Income</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow><TableHead>Source</TableHead><TableHead className="text-right">Amount</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Resource Wealth (before tax)</TableCell>
                  <TableCell className="text-right">{resourceWealth.toLocaleString()}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Tax Revenue ({realm.taxType} @ {(taxRate * 100).toFixed(0)}%)</TableCell>
                  <TableCell className="text-right font-bold">{taxIncome.toLocaleString()}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Expenses</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow><TableHead>Category</TableHead><TableHead className="text-right">Amount</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Building Maintenance</TableCell>
                  <TableCell className="text-right">{buildingMaintenance.toLocaleString()}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Troop Upkeep ({(militaryData.troops || []).length} troops)</TableCell>
                  <TableCell className="text-right">{troopUpkeep.toLocaleString()}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Siege Unit Upkeep ({(militaryData.siegeUnits || []).length} units)</TableCell>
                  <TableCell className="text-right">{siegeUpkeep.toLocaleString()}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Noble Estates ({nobles.length} nobles)</TableCell>
                  <TableCell className="text-right">{nobleUpkeep.toLocaleString()}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-bold">Total Expenses</TableCell>
                  <TableCell className="text-right font-bold text-red-700">{totalExpenses.toLocaleString()}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
