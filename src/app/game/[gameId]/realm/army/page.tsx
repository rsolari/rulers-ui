'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Tabs } from '@/components/ui/tabs';
import { useRole } from '@/hooks/use-role';
import { SHIP_DEFS, TROOP_DEFS } from '@/lib/game-logic/constants';
import type { ShipType, TroopType } from '@/types/game';

interface ArmyGeneral {
  id: string;
  name: string;
}

interface Army {
  id: string;
  name: string;
  generalId: string | null;
  general: ArmyGeneral | null;
  locationTerritoryId: string;
  movementTurnsRemaining: number;
}

interface FleetAdmiral {
  id: string;
  name: string;
}

interface Fleet {
  id: string;
  name: string;
  admiralId: string | null;
  admiral: FleetAdmiral | null;
  locationTerritoryId: string;
  movementTurnsRemaining: number;
  waterZoneType: string;
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

interface Ship {
  id: string;
  type: string;
  class: string;
  quality: string;
  condition: string;
  fleetId: string | null;
  garrisonSettlementId: string | null;
  constructionTurnsRemaining: number;
}

interface SiegeUnit {
  id: string;
  type: string;
  armyId: string | null;
  constructionTurnsRemaining: number;
}

interface SettlementSummary {
  id: string;
  name: string;
  size: string;
  territoryId: string;
}

interface RealmNoble {
  id: string;
  name: string;
  officeAssignments: string[];
  isAlive?: boolean;
  isPrisoner: boolean;
}

interface TroopRecruitmentOption {
  type: TroopType;
  canRecruit: boolean;
  usesTradeAccess: boolean;
  requiredBuildings: string[];
}

interface ShipConstructionOption {
  type: ShipType;
  canConstruct: boolean;
  usesTradeAccess: boolean;
  requiredBuildings: string[];
}

type TroopRecruitmentOptionsBySettlement = Record<string, TroopRecruitmentOption[]>;
type ShipConstructionOptionsBySettlement = Record<string, ShipConstructionOption[]>;

async function fetchArmyData(gameId: string, realmId: string) {
  const response = await fetch(`/api/game/${gameId}/armies?realmId=${realmId}`);
  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Failed to load armies'));
  }
  const data = await response.json();

  return {
    armies: data.armies || [],
    troops: data.troops || [],
    siegeUnits: data.siegeUnits || [],
    troopRecruitmentOptions: data.troopRecruitmentOptions || [],
    troopRecruitmentOptionsBySettlement: data.troopRecruitmentOptionsBySettlement || {},
  };
}

async function fetchFleetData(gameId: string, realmId: string) {
  const response = await fetch(`/api/game/${gameId}/fleets?realmId=${realmId}`);
  const data = await response.json();

  return {
    fleets: data.fleets || [],
    ships: data.ships || [],
    shipConstructionOptions: data.shipConstructionOptions || [],
    shipConstructionOptionsBySettlement: data.shipConstructionOptionsBySettlement || {},
  };
}

async function fetchRealmSettlements(gameId: string, realmId: string) {
  const response = await fetch(`/api/game/${gameId}/settlements?realmId=${realmId}`);
  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Failed to load settlements'));
  }
  return response.json() as Promise<SettlementSummary[]>;
}

async function fetchRealmNobles(gameId: string, realmId: string) {
  const response = await fetch(`/api/game/${gameId}/nobles?realmId=${realmId}`);
  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Failed to load nobles'));
  }
  return response.json() as Promise<RealmNoble[]>;
}

async function getErrorMessage(response: Response, fallback: string) {
  const data = await response.json().catch(() => null);
  if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' && data.error) {
    return data.error;
  }

  return fallback;
}

export default function ArmyPage() {
  const params = useParams();
  const gameId = params.gameId as string;
  const { role, realmId: sessionRealmId, territoryId } = useRole();
  const searchParams = useSearchParams();
  const gmRealmIdParam = searchParams.get('realmId');
  const isGmManaging = role === 'gm' && Boolean(gmRealmIdParam);
  const realmId = isGmManaging ? gmRealmIdParam : sessionRealmId;
  const realmLinkSuffix = isGmManaging ? `?realmId=${realmId}` : '';

  const [armies, setArmies] = useState<Army[]>([]);
  const [allTroops, setTroops] = useState<Troop[]>([]);
  const [allSiege, setSiege] = useState<SiegeUnit[]>([]);
  const [troopRecruitmentOptions, setTroopRecruitmentOptions] = useState<TroopRecruitmentOption[]>([]);
  const [troopRecruitmentOptionsBySettlement, setTroopRecruitmentOptionsBySettlement] = useState<TroopRecruitmentOptionsBySettlement>({});

  const [fleets, setFleets] = useState<Fleet[]>([]);
  const [allShips, setShips] = useState<Ship[]>([]);
  const [shipConstructionOptions, setShipConstructionOptions] = useState<ShipConstructionOption[]>([]);
  const [shipConstructionOptionsBySettlement, setShipConstructionOptionsBySettlement] = useState<ShipConstructionOptionsBySettlement>({});

  const [settlements, setSettlements] = useState<SettlementSummary[]>([]);
  const [nobles, setNobles] = useState<RealmNoble[]>([]);

  const [createArmyOpen, setCreateArmyOpen] = useState(false);
  const [createFleetOpen, setCreateFleetOpen] = useState(false);
  const [recruitOpen, setRecruitOpen] = useState(false);
  const [constructShipOpen, setConstructShipOpen] = useState<string | null>(null);
  const [newArmyName, setNewArmyName] = useState('');
  const [newArmyGeneralId, setNewArmyGeneralId] = useState('');
  const [newArmySource, setNewArmySource] = useState('');
  const [newArmyTroopIds, setNewArmyTroopIds] = useState<string[]>([]);
  const [createArmyError, setCreateArmyError] = useState('');
  const [isCreatingArmy, setIsCreatingArmy] = useState(false);
  const [newFleetName, setNewFleetName] = useState('');
  const [selectedTroopType, setSelectedTroopType] = useState<TroopType>('Spearmen');
  const [selectedShipType, setSelectedShipType] = useState<ShipType>('Galley');
  const [recruitmentSettlementIdOverride, setRecruitmentSettlementIdOverride] = useState('');
  const [constructionSettlementIdOverride, setConstructionSettlementIdOverride] = useState('');

  async function refreshMilitaryState(currentGameId: string, currentRealmId: string) {
    const [armyData, fleetData, settlementData, nobleData] = await Promise.all([
      fetchArmyData(currentGameId, currentRealmId),
      fetchFleetData(currentGameId, currentRealmId),
      fetchRealmSettlements(currentGameId, currentRealmId),
      fetchRealmNobles(currentGameId, currentRealmId),
    ]);

    setArmies(armyData.armies);
    setTroops(armyData.troops);
    setSiege(armyData.siegeUnits);
    setTroopRecruitmentOptions(armyData.troopRecruitmentOptions);
    setTroopRecruitmentOptionsBySettlement(armyData.troopRecruitmentOptionsBySettlement);
    setFleets(fleetData.fleets);
    setShips(fleetData.ships);
    setShipConstructionOptions(fleetData.shipConstructionOptions);
    setShipConstructionOptionsBySettlement(fleetData.shipConstructionOptionsBySettlement);
    setSettlements(settlementData);
    setNobles(nobleData);
  }

  useEffect(() => {
    if (!realmId) return;

    let cancelled = false;

    Promise.all([
      fetchArmyData(gameId, realmId),
      fetchFleetData(gameId, realmId),
      fetchRealmSettlements(gameId, realmId),
      fetchRealmNobles(gameId, realmId),
    ]).then(([armyData, fleetData, settlementData, nobleData]) => {
      if (cancelled) return;

      setArmies(armyData.armies);
      setTroops(armyData.troops);
      setSiege(armyData.siegeUnits);
      setTroopRecruitmentOptions(armyData.troopRecruitmentOptions);
      setTroopRecruitmentOptionsBySettlement(armyData.troopRecruitmentOptionsBySettlement);
      setFleets(fleetData.fleets);
      setShips(fleetData.ships);
      setShipConstructionOptions(fleetData.shipConstructionOptions);
      setShipConstructionOptionsBySettlement(fleetData.shipConstructionOptionsBySettlement);
      setSettlements(settlementData);
      setNobles(nobleData);
    });

    return () => {
      cancelled = true;
    };
  }, [gameId, realmId]);

  const selectedRecruitmentSettlementId = settlements.some(
    (settlement) => settlement.id === recruitmentSettlementIdOverride,
  )
    ? recruitmentSettlementIdOverride
    : (settlements[0]?.id ?? '');
  const defaultArmyTerritoryId = territoryId ?? settlements[0]?.territoryId ?? '';
  const selectedConstructionSettlementId = settlements.some(
    (settlement) => settlement.id === constructionSettlementIdOverride,
  )
    ? constructionSettlementIdOverride
    : (settlements[0]?.id ?? '');

  const activeTroopRecruitmentOptions = troopRecruitmentOptionsBySettlement[selectedRecruitmentSettlementId]
    ?? troopRecruitmentOptions;
  const activeShipConstructionOptions = shipConstructionOptionsBySettlement[selectedConstructionSettlementId]
    ?? shipConstructionOptions;
  const settlementById = new Map(settlements.map((settlement) => [settlement.id, settlement]));

  useEffect(() => {
    const selectedOption = activeTroopRecruitmentOptions.find((option) => option.type === selectedTroopType);
    if (selectedOption?.canRecruit || activeTroopRecruitmentOptions.length === 0) {
      return;
    }

    const firstRecruitableOption = activeTroopRecruitmentOptions.find((option) => option.canRecruit);
    if (firstRecruitableOption) {
      setSelectedTroopType(firstRecruitableOption.type);
    }
  }, [activeTroopRecruitmentOptions, selectedTroopType]);

  useEffect(() => {
    const selectedOption = activeShipConstructionOptions.find((option) => option.type === selectedShipType);
    if (selectedOption?.canConstruct || activeShipConstructionOptions.length === 0) {
      return;
    }

    const firstConstructibleOption = activeShipConstructionOptions.find((option) => option.canConstruct);
    if (firstConstructibleOption) {
      setSelectedShipType(firstConstructibleOption.type);
    }
  }, [activeShipConstructionOptions, selectedShipType]);

  function closeCreateArmyDialog() {
    setCreateArmyOpen(false);
    setNewArmyName('');
    setNewArmyGeneralId('');
    setNewArmySource('');
    setNewArmyTroopIds([]);
    setCreateArmyError('');
    setIsCreatingArmy(false);
  }

  function openCreateArmyDialog() {
    setCreateArmyError('');
    setNewArmyGeneralId('');
    setNewArmySource(availableArmySources[0]?.value ?? '');
    setNewArmyTroopIds([]);
    setCreateArmyOpen(true);
  }

  async function createArmy() {
    const trimmedName = newArmyName.trim();
    if (!trimmedName) {
      setCreateArmyError('Enter an army name.');
      return;
    }

    if (newArmyTroopIds.length === 0) {
      setCreateArmyError('Select at least one ready troop.');
      return;
    }

    if (!realmId) {
      setCreateArmyError('No realm selected.');
      return;
    }

    setCreateArmyError('');
    setIsCreatingArmy(true);

    try {
      const response = await fetch(`/api/game/${gameId}/armies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          realmId,
          name: trimmedName,
          generalId: newArmyGeneralId || undefined,
          troopIds: newArmyTroopIds,
          locationTerritoryId: selectedArmySource?.territoryId || defaultArmyTerritoryId || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(await getErrorMessage(response, 'Failed to create army'));
      }

      await refreshMilitaryState(gameId, realmId);
      closeCreateArmyDialog();
    } catch (error) {
      setCreateArmyError(error instanceof Error ? error.message : 'Failed to create army');
    } finally {
      setIsCreatingArmy(false);
    }
  }

  async function createFleet() {
    if (!newFleetName.trim() || !realmId || !territoryId) return;

    await fetch(`/api/game/${gameId}/fleets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ realmId, name: newFleetName, locationTerritoryId: territoryId }),
    });

    await refreshMilitaryState(gameId, realmId);
    setNewFleetName('');
    setCreateFleetOpen(false);
  }

  async function recruitTroop() {
    if (!realmId || !selectedRecruitmentSettlementId) return;

    await fetch(`/api/game/${gameId}/troops`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        realmId,
        type: selectedTroopType,
        garrisonSettlementId: selectedRecruitmentSettlementId,
        recruitmentSettlementId: selectedRecruitmentSettlementId,
      }),
    });

    await refreshMilitaryState(gameId, realmId);
    setRecruitOpen(false);
  }

  async function constructShip() {
    if (!realmId || !selectedConstructionSettlementId) return;

    await fetch(`/api/game/${gameId}/ships`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        realmId,
        type: selectedShipType,
        settlementId: selectedConstructionSettlementId,
        fleetId: constructShipOpen === 'harbor' ? null : constructShipOpen,
      }),
    });

    await refreshMilitaryState(gameId, realmId);
    setConstructShipOpen(null);
  }

  const troopOptions = Object.entries(TROOP_DEFS).map(([key, def]) => {
    const recruitmentOption = activeTroopRecruitmentOptions.find((option) => option.type === key);
    const requirementLabel = recruitmentOption?.canRecruit
      ? recruitmentOption.usesTradeAccess ? ' via trade' : ''
      : def.requires.length > 0
        ? ` unavailable: requires ${def.requires.join(', ')}`
        : ' unavailable';

    return {
      value: key,
      label: `${key} (${def.class}, ${def.upkeep}/season)${requirementLabel}`,
      disabled: recruitmentOption ? !recruitmentOption.canRecruit : false,
    };
  });

  const shipOptions = Object.entries(SHIP_DEFS).map(([key, def]) => {
    const constructionOption = activeShipConstructionOptions.find((option) => option.type === key);
    const requirementLabel = constructionOption?.canConstruct
      ? constructionOption.usesTradeAccess ? ' via trade' : ''
      : def.requires.length > 0
        ? ` unavailable: requires ${def.requires.join(', ')}`
        : ' unavailable';

    return {
      value: key,
      label: `${key} (${def.class}, ${def.upkeep}/season)${requirementLabel}`,
      disabled: constructionOption ? !constructionOption.canConstruct : false,
    };
  });

  const settlementOptions = settlements.map((settlement) => ({
    value: settlement.id,
    label: `${settlement.name} (${settlement.size})`,
  }));
  const eligibleGeneralOptions = nobles
    .filter((noble) => noble.officeAssignments.length === 0 && noble.isAlive !== false && !noble.isPrisoner)
    .map((noble) => ({
      value: noble.id,
      label: noble.name,
    }));

  const selectedTroopRecruitmentOption = activeTroopRecruitmentOptions.find(
    (option) => option.type === selectedTroopType,
  );
  const selectedShipConstructionOption = activeShipConstructionOptions.find(
    (option) => option.type === selectedShipType,
  );
  const hasRecruitableTroops = activeTroopRecruitmentOptions.some((option) => option.canRecruit);
  const hasConstructibleShips = activeShipConstructionOptions.some((option) => option.canConstruct);

  const garrisonTroops = allTroops.filter((troop) => !troop.armyId);
  const availableArmyTroops = garrisonTroops.filter((troop) => troop.recruitmentTurnsRemaining === 0);
  const garrisonGroupMap = new Map<string, Troop[]>();
  for (const troop of availableArmyTroops) {
    const key = troop.garrisonSettlementId ?? 'unassigned';
    const list = garrisonGroupMap.get(key) ?? [];
    list.push(troop);
    garrisonGroupMap.set(key, list);
  }
  const availableArmySources = settlements
    .map((settlement) => {
      const troops = garrisonGroupMap.get(settlement.id) ?? [];
      if (troops.length === 0) {
        return null;
      }

      return {
        value: settlement.id,
        label: `${settlement.name} garrison (${troops.length} ready)`,
        troops,
        territoryId: settlement.territoryId,
      };
    })
    .filter((group): group is {
      value: string;
      label: string;
      troops: Troop[];
      territoryId: string;
    } => Boolean(group));
  const unassignedArmyTroops = garrisonGroupMap.get('unassigned') ?? [];
  if (unassignedArmyTroops.length > 0) {
    availableArmySources.push({
      value: 'unassigned',
      label: `Unassigned pool (${unassignedArmyTroops.length} ready)`,
      troops: unassignedArmyTroops,
      territoryId: defaultArmyTerritoryId,
    });
  }
  const selectedArmySourceValue = availableArmySources.some((source) => source.value === newArmySource)
    ? newArmySource
    : (availableArmySources[0]?.value ?? '');
  const selectedArmySource = availableArmySources.find((source) => source.value === selectedArmySourceValue) ?? null;
  const selectedArmyTroops = selectedArmySource?.troops ?? [];
  const selectedArmyTroopIdsSet = new Set(newArmyTroopIds);
  const allSelectedArmyTroops = selectedArmyTroops.length > 0
    && selectedArmyTroops.every((troop) => selectedArmyTroopIdsSet.has(troop.id));
  const harborShips = allShips.filter((ship) => !ship.fleetId);

  const landContent = (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Armies & Troops</h2>
        <Button variant="accent" onClick={openCreateArmyDialog}>+ New Army</Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Settlement Garrisons & Unassigned</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setRecruitOpen(true)}>+ Recruit Troops</Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-ink-300">
            Recruitment adds new troops to a settlement garrison. Use Create Army to organize ready troops into the field.
          </p>
          <TroopList troops={garrisonTroops} />
        </CardContent>
      </Card>

      <div className="space-y-4">
        {armies.map((army) => {
          const armyTroops = allTroops.filter((troop) => troop.armyId === army.id);
          const armySiege = allSiege.filter((siege) => siege.armyId === army.id);

          return (
            <Card key={army.id} variant="gold">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{army.name}</CardTitle>
                    <p className="mt-1 text-sm text-ink-300">
                      General: {army.general ? army.general.name : <span className="italic">None</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {army.movementTurnsRemaining > 0 && (
                      <Badge variant="gold">Moving ({army.movementTurnsRemaining} turns)</Badge>
                    )}
                    <Badge>{armyTroops.length} troops</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <TroopList troops={armyTroops} />
                {armySiege.length > 0 ? (
                  <div className="mt-3">
                    <p className="mb-1 font-heading font-semibold">Siege Units</p>
                    {armySiege.map((unit) => (
                      <div key={unit.id} className="flex items-center justify-between py-1">
                        <span>{unit.type}</span>
                        {unit.constructionTurnsRemaining > 0 ? (
                          <Badge variant="gold">{unit.constructionTurnsRemaining} turns to build</Badge>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );

  const navalContent = (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Fleets & Ships</h2>
        <Button variant="accent" onClick={() => setCreateFleetOpen(true)}>+ New Fleet</Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Harbor (Unassigned)</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setConstructShipOpen('harbor')}>+ Construct Ship</Button>
          </div>
        </CardHeader>
        <CardContent>
          <ShipList ships={harborShips} />
        </CardContent>
      </Card>

      <div className="space-y-4">
        {fleets.map((fleet) => {
          const fleetShips = allShips.filter((ship) => ship.fleetId === fleet.id);

          return (
            <Card key={fleet.id} variant="gold">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{fleet.name}</CardTitle>
                    <p className="mt-1 text-sm text-ink-300">
                      Admiral: {fleet.admiral ? fleet.admiral.name : <span className="italic">None</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge>{fleet.waterZoneType}</Badge>
                    {fleet.movementTurnsRemaining > 0 ? (
                      <Badge variant="gold">Moving ({fleet.movementTurnsRemaining} turns)</Badge>
                    ) : null}
                    <Badge>{fleetShips.length} ships</Badge>
                    <Button variant="outline" size="sm" onClick={() => setConstructShipOpen(fleet.id)}>+ Construct Ship</Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ShipList ships={fleetShips} />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );

  return (
    <main className="mx-auto min-h-screen max-w-6xl p-6">
      <nav className="mb-4 text-sm text-ink-300">
        <Link href={`/game/${gameId}/realm${realmLinkSuffix}`} className="hover:text-ink-100">← Realm</Link>
      </nav>

      <div className="mb-6">
        <h1 className="text-3xl font-bold">Military Forces</h1>
        <p className="text-ink-300">Manage field armies, harbor squadrons, and open-water fleets.</p>
      </div>

      <Tabs
        defaultTab="land"
        tabs={[
          { id: 'land', label: 'Land Forces', content: landContent },
          { id: 'naval', label: 'Naval Forces', content: navalContent },
        ]}
      />

      {createArmyOpen ? (
        <Dialog open onClose={closeCreateArmyDialog}>
          <DialogTitle>Create Army</DialogTitle>
          <DialogContent className="space-y-4">
            <p className="text-sm text-ink-300">
              Creating an army reorganizes ready troops from one garrison or the unassigned pool. Recruitment stays at the settlement level.
            </p>
            <Input label="Army Name" value={newArmyName} onChange={(event) => setNewArmyName(event.target.value)} />
            <Select
              label="General"
              options={eligibleGeneralOptions}
              placeholder="No general assigned"
              value={newArmyGeneralId}
              onChange={(event) => setNewArmyGeneralId(event.target.value)}
            />
            <Select
              label="Form From"
              options={availableArmySources}
              value={selectedArmySourceValue}
              onChange={(event) => {
                setNewArmySource(event.target.value);
                setNewArmyTroopIds([]);
              }}
              disabled={availableArmySources.length === 0}
            />
            <div className="space-y-4">
              {selectedArmySource ? (
                <div className="max-h-64 space-y-2 overflow-y-auto rounded p-3 medieval-border">
                  <div className="flex items-center justify-between">
                    <p className="font-heading font-semibold">
                      Ready Troops
                    </p>
                    {selectedArmyTroops.length > 0 ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setNewArmyTroopIds(
                            allSelectedArmyTroops ? [] : selectedArmyTroops.map((troop) => troop.id),
                          );
                        }}
                      >
                        {allSelectedArmyTroops ? 'Clear All' : 'Select All'}
                      </Button>
                    ) : null}
                  </div>
                  {selectedArmyTroops.length > 0 ? (
                    selectedArmyTroops.map((troop) => {
                      const sourceLabel = troop.garrisonSettlementId
                        ? `${settlementById.get(troop.garrisonSettlementId)?.name ?? 'Unknown garrison'}`
                        : 'Unassigned pool';

                      return (
                        <label key={troop.id} className="flex items-center justify-between gap-3 rounded px-2 py-2 medieval-border">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={newArmyTroopIds.includes(troop.id)}
                              aria-label={`Select ${troop.type} ${troop.id}`}
                              onChange={(event) => {
                                if (event.target.checked) {
                                  setNewArmyTroopIds((current) => [...current, troop.id]);
                                  return;
                                }

                                setNewArmyTroopIds((current) => current.filter((id) => id !== troop.id));
                              }}
                            />
                            <div>
                              <p className="font-semibold">{troop.type}</p>
                              <p className="text-xs text-ink-300">{sourceLabel}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge>{troop.class}</Badge>
                            <Badge>{troop.armourType}</Badge>
                          </div>
                        </label>
                      );
                    })
                  ) : (
                    <p className="text-sm text-ink-300">No ready troops available in this source.</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-ink-300">
                  {garrisonTroops.length === 0
                    ? 'No troops are currently available outside armies.'
                    : 'Only ready troops can be organized into a new army.'}
                </p>
              )}
              {createArmyError ? <p className="text-sm text-red-500">{createArmyError}</p> : null}
            </div>
          </DialogContent>
          <DialogFooter>
            <Button variant="ghost" onClick={closeCreateArmyDialog}>Cancel</Button>
            <Button
              variant="accent"
              onClick={() => void createArmy()}
              disabled={!newArmyName.trim() || !realmId || newArmyTroopIds.length === 0 || isCreatingArmy}
            >
              {isCreatingArmy ? 'Creating...' : 'Create Army'}
            </Button>
          </DialogFooter>
        </Dialog>
      ) : null}

      {createFleetOpen ? (
        <Dialog open onClose={() => setCreateFleetOpen(false)}>
          <DialogTitle>Create Fleet</DialogTitle>
          <DialogContent>
            <Input label="Fleet Name" value={newFleetName} onChange={(event) => setNewFleetName(event.target.value)} />
          </DialogContent>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateFleetOpen(false)}>Cancel</Button>
            <Button variant="accent" onClick={createFleet}>Create</Button>
          </DialogFooter>
        </Dialog>
      ) : null}

      {recruitOpen ? (
        <Dialog open onClose={() => setRecruitOpen(false)}>
          <DialogTitle>Recruit Troop</DialogTitle>
          <DialogContent>
            <Select
              label="Recruit From"
              options={settlementOptions}
              value={selectedRecruitmentSettlementId}
              onChange={(event) => setRecruitmentSettlementIdOverride(event.target.value)}
            />
            <Select
              label="Troop Type"
              options={troopOptions}
              value={selectedTroopType}
              onChange={(event) => setSelectedTroopType(event.target.value as TroopType)}
            />
            {settlementOptions.length === 0 ? (
              <p className="mt-3 text-sm text-ink-300">A settlement is required to recruit troops.</p>
            ) : null}
            {settlementOptions.length > 0 && !hasRecruitableTroops ? (
              <p className="mt-3 text-sm text-ink-300">
                No troops are currently recruitable with this realm&apos;s available buildings.
              </p>
            ) : null}
            <p className="mt-3 text-sm text-ink-300">
              Recruited troops enter the selected settlement&apos;s garrison first. Use Create Army to organize ready troops afterward.
            </p>
            {TROOP_DEFS[selectedTroopType] ? (
              <div className="mt-3 space-y-1 rounded p-3 text-sm medieval-border">
                <p><strong>Class:</strong> {TROOP_DEFS[selectedTroopType].class}</p>
                <p><strong>Armour:</strong> {TROOP_DEFS[selectedTroopType].armourTypes.join(', ')}</p>
                <p><strong>Upkeep:</strong> {TROOP_DEFS[selectedTroopType].upkeep.toLocaleString()}gc /season</p>
                <p><strong>Bonus:</strong> {TROOP_DEFS[selectedTroopType].bonus}</p>
                {TROOP_DEFS[selectedTroopType].requires.length > 0 ? (
                  <p><strong>Requires:</strong> {TROOP_DEFS[selectedTroopType].requires.join(', ')}</p>
                ) : null}
                {selectedTroopRecruitmentOption && !selectedTroopRecruitmentOption.canRecruit ? (
                  <p className="text-red-700"><strong>Status:</strong> Unavailable for this realm.</p>
                ) : null}
                {selectedTroopRecruitmentOption?.usesTradeAccess ? (
                  <p><strong>Source:</strong> Available via traded building access.</p>
                ) : null}
              </div>
            ) : null}
          </DialogContent>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRecruitOpen(false)}>Cancel</Button>
            <Button
              variant="accent"
              onClick={() => void recruitTroop()}
              disabled={!selectedRecruitmentSettlementId || !selectedTroopRecruitmentOption?.canRecruit}
            >
              Recruit
            </Button>
          </DialogFooter>
        </Dialog>
      ) : null}

      {constructShipOpen ? (
        <Dialog open onClose={() => setConstructShipOpen(null)}>
          <DialogTitle>Construct Ship</DialogTitle>
          <DialogContent>
            <Select
              label="Construct At"
              options={settlementOptions}
              value={selectedConstructionSettlementId}
              onChange={(event) => setConstructionSettlementIdOverride(event.target.value)}
            />
            <Select
              label="Ship Type"
              options={shipOptions}
              value={selectedShipType}
              onChange={(event) => setSelectedShipType(event.target.value as ShipType)}
            />
            {settlementOptions.length === 0 ? (
              <p className="mt-3 text-sm text-ink-300">A settlement is required to construct ships.</p>
            ) : null}
            {settlementOptions.length > 0 && !hasConstructibleShips ? (
              <p className="mt-3 text-sm text-ink-300">
                No ships are currently constructible with this realm&apos;s available buildings.
              </p>
            ) : null}
            {SHIP_DEFS[selectedShipType] ? (
              <div className="mt-3 space-y-1 rounded p-3 text-sm medieval-border">
                <p><strong>Class:</strong> {SHIP_DEFS[selectedShipType].class}</p>
                <p><strong>Quality:</strong> {SHIP_DEFS[selectedShipType].quality}</p>
                <p><strong>Build Cost:</strong> {SHIP_DEFS[selectedShipType].buildCost.toLocaleString()}gc</p>
                <p><strong>Upkeep:</strong> {SHIP_DEFS[selectedShipType].upkeep.toLocaleString()}gc /season</p>
                <p><strong>Build Time:</strong> {SHIP_DEFS[selectedShipType].buildTime} season(s)</p>
                <p><strong>Zones:</strong> {SHIP_DEFS[selectedShipType].supportedZones.join(', ')}</p>
                <p><strong>Bonus:</strong> {SHIP_DEFS[selectedShipType].bonus}</p>
                <p><strong>Requires:</strong> {SHIP_DEFS[selectedShipType].requires.join(', ')}</p>
                {selectedShipConstructionOption && !selectedShipConstructionOption.canConstruct ? (
                  <p className="text-red-700"><strong>Status:</strong> Unavailable for this realm.</p>
                ) : null}
                {selectedShipConstructionOption?.usesTradeAccess ? (
                  <p><strong>Source:</strong> Available via traded building access.</p>
                ) : null}
              </div>
            ) : null}
          </DialogContent>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConstructShipOpen(null)}>Cancel</Button>
            <Button
              variant="accent"
              onClick={constructShip}
              disabled={!selectedConstructionSettlementId || !selectedShipConstructionOption?.canConstruct}
            >
              Construct
            </Button>
          </DialogFooter>
        </Dialog>
      ) : null}
    </main>
  );
}

function TroopList({ troops }: { troops: Troop[] }) {
  if (troops.length === 0) {
    return <p className="text-sm text-ink-300">No troops.</p>;
  }

  const grouped = troops.reduce<Record<string, Troop[]>>((accumulator, troop) => {
    accumulator[troop.type] = accumulator[troop.type] || [];
    accumulator[troop.type].push(troop);
    return accumulator;
  }, {});

  return (
    <div className="space-y-1">
      {Object.entries(grouped).map(([type, list]) => (
        <div key={type} className="flex items-center justify-between rounded px-2 py-1 medieval-border">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{type}</span>
            <Badge>{list[0].class}</Badge>
            <Badge>{list[0].armourType}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold">x{list.length}</span>
            {list.some((troop) => troop.condition !== 'Healthy') ? (
              <Badge variant="red">{list.filter((troop) => troop.condition !== 'Healthy').length} damaged</Badge>
            ) : null}
            {list.some((troop) => troop.recruitmentTurnsRemaining > 0) ? (
              <Badge variant="gold">{list.filter((troop) => troop.recruitmentTurnsRemaining > 0).length} recruiting</Badge>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function ShipList({ ships }: { ships: Ship[] }) {
  if (ships.length === 0) {
    return <p className="text-sm text-ink-300">No ships.</p>;
  }

  const grouped = ships.reduce<Record<string, Ship[]>>((accumulator, ship) => {
    accumulator[ship.type] = accumulator[ship.type] || [];
    accumulator[ship.type].push(ship);
    return accumulator;
  }, {});

  return (
    <div className="space-y-1">
      {Object.entries(grouped).map(([type, list]) => (
        <div key={type} className="flex items-center justify-between rounded px-2 py-1 medieval-border">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{type}</span>
            <Badge>{list[0].class}</Badge>
            <Badge>{list[0].quality}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold">x{list.length}</span>
            {list.some((ship) => ship.condition !== 'Ready') ? (
              <Badge variant="red">{list.filter((ship) => ship.condition !== 'Ready').length} damaged</Badge>
            ) : null}
            {list.some((ship) => ship.constructionTurnsRemaining > 0) ? (
              <Badge variant="gold">{list.filter((ship) => ship.constructionTurnsRemaining > 0).length} building</Badge>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
