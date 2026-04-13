'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { Select } from '@/components/ui/select';
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
  officeAssignments: string[];
}

interface BuildingOption {
  type: string;
  category: string;
  size: string;
  canBuild: boolean;
  cost: number;
  usesTradeAccess: boolean;
  constructionTurns: number;
  prerequisites: string[];
  description: string;
  takesBuildingSlot: boolean;
  reason?: string;
  reasonMessage?: string;
}

const FORTIFICATION_MATERIAL_TYPES = new Set(['Gatehouse', 'Walls', 'Watchtower']);

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

  const [buildSettlementId, setBuildSettlementId] = useState<string | null>(null);
  const [buildingOptions, setBuildingOptions] = useState<BuildingOption[]>([]);
  const [selectedBuildingType, setSelectedBuildingType] = useState<string>('');
  const [selectedMaterial, setSelectedMaterial] = useState<string>('Timber');
  const [buildingLoading, setBuildingLoading] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);

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

  async function openBuildDialog(settlementId: string) {
    setBuildSettlementId(settlementId);
    setBuildError(null);
    setBuildingLoading(true);

    try {
      const res = await fetch(`/api/game/${gameId}/settlements/${settlementId}/buildings`);
      const options: BuildingOption[] = await res.json();
      setBuildingOptions(options);
      const firstBuildable = options.find((o) => o.canBuild);
      setSelectedBuildingType(firstBuildable?.type ?? options[0]?.type ?? '');
    } finally {
      setBuildingLoading(false);
    }
  }

  async function constructBuilding() {
    if (!buildSettlementId || !selectedBuildingType) return;
    setBuildError(null);
    setBuildingLoading(true);

    try {
      const body: Record<string, string> = { type: selectedBuildingType };
      if (FORTIFICATION_MATERIAL_TYPES.has(selectedBuildingType)) {
        body.material = selectedMaterial;
      }

      const res = await fetch(`/api/game/${gameId}/settlements/${buildSettlementId}/buildings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setBuildError(data.error ?? 'Construction failed');
        setBuildingLoading(false);
        return;
      }

      setBuildSettlementId(null);
      const refreshRes = await fetch(`/api/game/${gameId}/settlements?realmId=${realmId}`);
      setSettlements(await refreshRes.json());
    } finally {
      setBuildingLoading(false);
    }
  }

  const selectedOption = buildingOptions.find((o) => o.type === selectedBuildingType);
  const hasBuildableOptions = buildingOptions.some((o) => o.canBuild);

  const buildingSelectOptions = buildingOptions.map((option) => {
    const statusLabel = option.canBuild
      ? option.usesTradeAccess ? ' (via trade)' : ''
      : ` - ${option.reasonMessage ?? 'unavailable'}`;

    return {
      value: option.type,
      label: `${option.type} [${option.category}]${statusLabel}`,
      disabled: !option.canBuild,
    };
  });

  function getOfficeEligibleNobles(currentNobleId: string | null) {
    return nobles.filter((noble) => noble.id === currentNobleId || noble.officeAssignments.length === 0);
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
          : 'Manage your settlements and construct new buildings.'}
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
                <div className="flex items-center gap-3 mb-4 p-3 rounded medieval-border bg-parchment-800/30">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-gold-400 text-lg shrink-0">👑</span>
                    <span className="font-heading font-semibold text-sm shrink-0">Governor:</span>
                    {isSetup ? (
                      <div className="flex-1 min-w-[200px]">
                        <NobleAssignmentSelect
                          label=""
                          nobles={getOfficeEligibleNobles(settlement.governingNobleId)}
                          currentNobleId={settlement.governingNobleId}
                          onAssign={(nobleId) => assignGovernor(settlement.id, nobleId)}
                        />
                      </div>
                    ) : (
                      <span className={settlement.governingNoble ? 'font-semibold text-ink-100' : 'text-ink-400 italic'}>
                        {settlement.governingNoble ? settlement.governingNoble.name : 'Unassigned'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-4">
                  <p className="text-sm"><strong>Food Need:</strong> {data.foodNeed}</p>
                  <p className="text-sm"><strong>Max Troops:</strong> {data.maxTroops}</p>
                  <p className="text-sm"><strong>Recruit/Season:</strong> {data.recruitPerSeason}</p>
                </div>

                <div className="flex items-center justify-between mb-2">
                  <p className="font-heading font-semibold">Buildings</p>
                  <Button variant="outline" size="sm" onClick={() => openBuildDialog(settlement.id)}>+ Build</Button>
                </div>
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

      {buildSettlementId ? (
        <Dialog open onClose={() => setBuildSettlementId(null)}>
          <DialogTitle>Construct Building</DialogTitle>
          <DialogContent>
            {buildingLoading && buildingOptions.length === 0 ? (
              <p className="text-ink-300 text-sm">Loading building options...</p>
            ) : (
              <>
                <Select
                  label="Building Type"
                  options={buildingSelectOptions}
                  value={selectedBuildingType}
                  onChange={(e) => setSelectedBuildingType(e.target.value)}
                />
                {FORTIFICATION_MATERIAL_TYPES.has(selectedBuildingType) && (
                  <Select
                    label="Material"
                    options={[
                      { value: 'Timber', label: 'Timber' },
                      { value: 'Stone', label: 'Stone' },
                    ]}
                    value={selectedMaterial}
                    onChange={(e) => setSelectedMaterial(e.target.value)}
                  />
                )}
                {!hasBuildableOptions && (
                  <p className="mt-3 text-sm text-ink-300">
                    No buildings are currently available for construction in this settlement.
                  </p>
                )}
                {selectedOption && (
                  <div className="mt-3 space-y-1 rounded p-3 text-sm medieval-border">
                    <p><strong>Category:</strong> {selectedOption.category}</p>
                    <p><strong>Size:</strong> {selectedOption.size}</p>
                    <p><strong>Cost:</strong> {selectedOption.cost.toLocaleString()}gc</p>
                    <p><strong>Build Time:</strong> {selectedOption.constructionTurns} turn(s)</p>
                    <p><strong>Uses Slot:</strong> {selectedOption.takesBuildingSlot ? 'Yes' : 'No'}</p>
                    {selectedOption.prerequisites.length > 0 && (
                      <p><strong>Requires:</strong> {selectedOption.prerequisites.join(', ')}</p>
                    )}
                    <p className="text-ink-300 italic">{selectedOption.description}</p>
                    {selectedOption.usesTradeAccess && (
                      <p><strong>Source:</strong> Available via traded access.</p>
                    )}
                    {!selectedOption.canBuild && (
                      <p className="text-red-700"><strong>Status:</strong> {selectedOption.reasonMessage ?? 'Unavailable'}</p>
                    )}
                  </div>
                )}
                {buildError && (
                  <p className="mt-2 text-sm text-red-700">{buildError}</p>
                )}
              </>
            )}
          </DialogContent>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBuildSettlementId(null)}>Cancel</Button>
            <Button
              variant="accent"
              onClick={constructBuilding}
              disabled={!selectedOption?.canBuild || buildingLoading}
            >
              Build
            </Button>
          </DialogFooter>
        </Dialog>
      ) : null}
    </main>
  );
}
