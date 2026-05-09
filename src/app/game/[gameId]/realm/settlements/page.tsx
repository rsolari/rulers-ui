'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { InlineMutationMessage } from '@/components/ui/mutation-feedback';
import { Select } from '@/components/ui/select';
import { NobleAssignmentSelect } from '@/components/governance/NobleAssignmentSelect';
import { useRole } from '@/hooks/use-role';
import { getApiErrorMessage, requestJson } from '@/lib/api-client';
import { BUILDING_DEFS, getEligibleBuildingUpgradeTargets, SETTLEMENT_DATA } from '@/lib/game-logic/constants';
import type { BuildingSize, BuildingType, SettlementKind, SettlementSize } from '@/types/game';

interface GoverningNoble {
  id: string;
  name: string;
}

interface Settlement {
  id: string;
  name: string;
  kind: SettlementKind;
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
    ownerGosId?: string | null;
  }>;
}

interface Noble {
  id: string;
  name: string;
  officeAssignments: string[];
}

interface GOSOption {
  id: string;
  name: string;
  type: string;
}

const GOS_UNLOCKED_BUILDINGS: Record<string, string[]> = (() => {
  const map: Record<string, string[]> = { Guild: [], Order: [], Society: [] };
  for (const [type, def] of Object.entries(BUILDING_DEFS)) {
    for (const prereq of def.prerequisites) {
      if (prereq === 'Guild' || prereq === 'Order' || prereq === 'Society') {
        map[prereq].push(type);
      }
    }
  }
  return map;
})();

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

interface BuildingUpgradeOption {
  targetType: string;
  category: string;
  targetSize: string;
  canUpgrade: boolean;
  cost: number;
  usesTradeAccess: boolean;
  constructionTurns: number;
  prerequisites: string[];
  description: string;
  reason?: string;
  reasonMessage?: string;
}

const FORTIFICATION_MATERIAL_TYPES = new Set(['Gatehouse', 'Walls', 'Watchtower']);
const BUILDING_SIZES = new Set<BuildingSize>(['Tiny', 'Small', 'Medium', 'Large', 'Colossal']);
const GOS_PREREQUISITES = new Set(['Guild', 'Order', 'Society']);

function omitRecordKey<T>(record: Record<string, T>, key: string) {
  const next = { ...record };
  delete next[key];
  return next;
}

function getRequiredAllotmentType(prerequisites: string[] | undefined) {
  return prerequisites?.find((prerequisite) => GOS_PREREQUISITES.has(prerequisite)) ?? null;
}

function hasUpgradeTargets(type: string, size: string) {
  if (!(type in BUILDING_DEFS) || !BUILDING_SIZES.has(size as BuildingSize)) return false;
  return getEligibleBuildingUpgradeTargets(type as BuildingType, size as BuildingSize).length > 0;
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
  const [gosOptions, setGosOptions] = useState<GOSOption[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const isSetup = initState === 'parallel_final_setup' || initState === 'ready_to_start' || isGmManaging;

  useEffect(() => {
    if (!realmId) return;

    async function loadSettlementsPage() {
      setLoadError(null);
      try {
        const [settlementList, nobleList, gosList] = await Promise.all([
          requestJson<Settlement[]>(`/api/game/${gameId}/settlements?realmId=${realmId}`, { cache: 'no-store' }, 'Failed to load settlements'),
          requestJson<Noble[]>(`/api/game/${gameId}/nobles?realmId=${realmId}`, { cache: 'no-store' }, 'Failed to load nobles'),
          requestJson<GOSOption[]>(`/api/game/${gameId}/gos?realmId=${realmId}`, { cache: 'no-store' }, 'Failed to load GOS'),
        ]);
        setSettlements(settlementList);
        setNobles(nobleList);
        setGosOptions(gosList);
      } catch (error) {
        setLoadError(getApiErrorMessage(error, 'Failed to load settlements'));
      }
    }

    void loadSettlementsPage();
  }, [gameId, realmId]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [savingNameId, setSavingNameId] = useState<string | null>(null);
  const [nameErrorById, setNameErrorById] = useState<Record<string, string>>({});
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [buildSettlementId, setBuildSettlementId] = useState<string | null>(null);
  const [buildingOptions, setBuildingOptions] = useState<BuildingOption[]>([]);
  const [selectedBuildingType, setSelectedBuildingType] = useState<string>('');
  const [selectedMaterial, setSelectedMaterial] = useState<string>('Timber');
  const [selectedAllottedGosId, setSelectedAllottedGosId] = useState<string>('');
  const [showCreateGosForm, setShowCreateGosForm] = useState(false);
  const [newGosName, setNewGosName] = useState('');
  const [creatingGos, setCreatingGos] = useState(false);
  const [createGosError, setCreateGosError] = useState<string | null>(null);
  const [buildingLoading, setBuildingLoading] = useState(false);
  const [cancellingBuildingId, setCancellingBuildingId] = useState<string | null>(null);
  const [buildingOwnerSavingId, setBuildingOwnerSavingId] = useState<string | null>(null);
  const [buildingOwnerErrorById, setBuildingOwnerErrorById] = useState<Record<string, string>>({});
  const [buildingOwnerRetryById, setBuildingOwnerRetryById] = useState<Record<string, string | null>>({});
  const [buildingOwnerSuccessId, setBuildingOwnerSuccessId] = useState<string | null>(null);
  const [cancelErrorById, setCancelErrorById] = useState<Record<string, string>>({});
  const [buildError, setBuildError] = useState<string | null>(null);
  const [upgradeSettlementId, setUpgradeSettlementId] = useState<string | null>(null);
  const [upgradeBuildingId, setUpgradeBuildingId] = useState<string | null>(null);
  const [upgradeBuildingLabel, setUpgradeBuildingLabel] = useState('');
  const [upgradeOptions, setUpgradeOptions] = useState<BuildingUpgradeOption[]>([]);
  const [selectedUpgradeType, setSelectedUpgradeType] = useState('');
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const [strongholdActionId, setStrongholdActionId] = useState<string | null>(null);
  const [strongholdActionError, setStrongholdActionError] = useState<string | null>(null);

  async function refreshSettlements() {
    if (!realmId) return;
    setSettlements(await requestJson<Settlement[]>(
      `/api/game/${gameId}/settlements?realmId=${realmId}`,
      { cache: 'no-store' },
      'Failed to refresh settlements',
    ));
  }

  async function renameSettlement(settlement: Settlement, name: string) {
    if (savingNameId === settlement.id) return;

    const trimmed = name.trim();
    if (!trimmed) {
      setNameErrorById((current) => ({ ...current, [settlement.id]: 'Settlement name is required' }));
      return;
    }

    if (trimmed === settlement.name.trim()) {
      setEditingId(null);
      setNameErrorById((current) => omitRecordKey(current, settlement.id));
      return;
    }

    setSavingNameId(settlement.id);
    setNameErrorById((current) => omitRecordKey(current, settlement.id));

    try {
      await requestJson<{ updated: true }>(
        `/api/game/${gameId}/settlements`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ settlementId: settlement.id, name: trimmed }),
        },
        'Failed to rename settlement',
      );
      await refreshSettlements();
      setEditingId(null);
    } catch (error) {
      setNameErrorById((current) => ({
        ...current,
        [settlement.id]: getApiErrorMessage(error, 'Failed to rename settlement'),
      }));
    } finally {
      setSavingNameId(null);
    }
  }

  function startEditing(settlement: Settlement) {
    setEditingId(settlement.id);
    setEditingName(settlement.name);
    setNameErrorById((current) => omitRecordKey(current, settlement.id));
    setTimeout(() => {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }, 0);
  }

  async function assignGovernor(settlementId: string, nobleId: string | null): Promise<string | null> {
    try {
      await requestJson<{ updated: true }>(
        `/api/game/${gameId}/settlements/${settlementId}/governor`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nobleId }),
        },
        'Failed to assign governor',
      );
      await refreshSettlements();
      return null;
    } catch (error) {
      return getApiErrorMessage(error, 'Failed to assign governor');
    }
  }

  async function assignBuildingOwner(buildingId: string, ownerGosId: string | null) {
    if (buildingOwnerSavingId === buildingId) return;

    setBuildingOwnerSavingId(buildingId);
    setBuildingOwnerSuccessId(null);
    setBuildingOwnerRetryById((current) => ({ ...current, [buildingId]: ownerGosId }));
    setBuildingOwnerErrorById((current) => omitRecordKey(current, buildingId));

    try {
      await requestJson<{ updated: true }>(
        `/api/game/${gameId}/buildings`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ buildingId, ownerGosId }),
        },
        'Failed to assign building owner',
      );
      await refreshSettlements();
      setBuildingOwnerSuccessId(buildingId);
    } catch (error) {
      setBuildingOwnerErrorById((current) => ({
        ...current,
        [buildingId]: getApiErrorMessage(error, 'Failed to assign building owner'),
      }));
    } finally {
      setBuildingOwnerSavingId(null);
    }
  }

  async function openBuildDialog(settlementId: string) {
    setBuildSettlementId(settlementId);
    setBuildError(null);
    setBuildingLoading(true);

    try {
      const options = await requestJson<BuildingOption[]>(
        `/api/game/${gameId}/settlements/${settlementId}/buildings`,
        { cache: 'no-store' },
        'Failed to load building options',
      );
      setBuildingOptions(options);
      const firstBuildable = options.find((o) => o.canBuild);
      const initialType = firstBuildable?.type ?? options[0]?.type ?? '';
      setSelectedBuildingType(initialType);
      setSelectedAllottedGosId(getDefaultAllottedGosId(initialType, options));
    } catch (error) {
      setBuildError(getApiErrorMessage(error, 'Failed to load building options'));
    } finally {
      setBuildingLoading(false);
    }
  }

  function getDefaultAllottedGosId(buildingType: string, options = buildingOptions) {
    const option = options.find((candidate) => candidate.type === buildingType);
    const requiredType = getRequiredAllotmentType(option?.prerequisites);
    if (!requiredType) return '';
    return gosOptions.find((gos) => gos.type === requiredType)?.id ?? '';
  }

  function selectBuildingType(buildingType: string) {
    setSelectedBuildingType(buildingType);
    setSelectedAllottedGosId(getDefaultAllottedGosId(buildingType));
    setShowCreateGosForm(false);
    setNewGosName('');
    setCreateGosError(null);
  }

  async function createGosInline(requiredType: string) {
    const trimmedName = newGosName.trim();
    if (!trimmedName || !realmId) return;

    setCreatingGos(true);
    setCreateGosError(null);
    try {
      const created = await requestJson<{ id: string }>(
        `/api/game/${gameId}/gos`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: trimmedName,
            type: requiredType,
            realmId,
            realmIds: [realmId],
          }),
        },
        'Failed to create GOS',
      );
      const newOption: GOSOption = {
        id: created.id,
        name: trimmedName,
        type: requiredType,
      };
      setGosOptions((prev) => [...prev, newOption]);
      setSelectedAllottedGosId(created.id);
      if (buildSettlementId) {
        try {
          setBuildingOptions(await requestJson<BuildingOption[]>(
            `/api/game/${gameId}/settlements/${buildSettlementId}/buildings`,
            { cache: 'no-store' },
            'GOS created, but failed to refresh building options',
          ));
        } catch (error) {
          setBuildError(getApiErrorMessage(error, 'GOS created, but failed to refresh building options'));
        }
      }
      setShowCreateGosForm(false);
      setNewGosName('');
    } catch (error) {
      setCreateGosError(getApiErrorMessage(error, 'Failed to create GOS'));
    } finally {
      setCreatingGos(false);
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
      if (selectedAllottedGosId) {
        body.allottedGosId = selectedAllottedGosId;
      }

      await requestJson<{ id: string }>(
        `/api/game/${gameId}/settlements/${buildSettlementId}/buildings`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
        'Construction failed',
      );
      await refreshSettlements();
      setBuildSettlementId(null);
    } catch (error) {
      setBuildError(getApiErrorMessage(error, 'Construction failed'));
    } finally {
      setBuildingLoading(false);
    }
  }

  async function cancelConstruction(settlementId: string, buildingId: string) {
    setCancellingBuildingId(buildingId);
    setCancelErrorById((current) => omitRecordKey(current, buildingId));

    try {
      await requestJson<{ deleted: true }>(
        `/api/game/${gameId}/settlements/${settlementId}/buildings`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ buildingId }),
        },
        'Failed to cancel construction',
      );
      await refreshSettlements();
    } catch (error) {
      setCancelErrorById((current) => ({
        ...current,
        [buildingId]: getApiErrorMessage(error, 'Failed to cancel construction'),
      }));
    } finally {
      setCancellingBuildingId(null);
    }
  }

  async function openUpgradeDialog(settlementId: string, buildingId: string, buildingType: string) {
    setUpgradeSettlementId(settlementId);
    setUpgradeBuildingId(buildingId);
    setUpgradeBuildingLabel(buildingType);
    setUpgradeOptions([]);
    setSelectedUpgradeType('');
    setUpgradeError(null);
    setUpgradeLoading(true);

    try {
      const data = await requestJson<{ options?: BuildingUpgradeOption[] }>(
        `/api/game/${gameId}/settlements/${settlementId}/buildings/${buildingId}/upgrade`,
        { cache: 'no-store' },
        'Failed to load upgrade options',
      );

      const options = (data.options ?? []) as BuildingUpgradeOption[];
      setUpgradeOptions(options);
      const firstUpgradeable = options.find((option) => option.canUpgrade);
      setSelectedUpgradeType(firstUpgradeable?.targetType ?? options[0]?.targetType ?? '');
    } catch (error) {
      setUpgradeError(getApiErrorMessage(error, 'Failed to load upgrade options'));
    } finally {
      setUpgradeLoading(false);
    }
  }

  async function applyUpgrade() {
    if (!upgradeSettlementId || !upgradeBuildingId || !selectedUpgradeType) return;
    setUpgradeError(null);
    setUpgradeLoading(true);

    try {
      await requestJson<{ updated: true }>(
        `/api/game/${gameId}/settlements/${upgradeSettlementId}/buildings/${upgradeBuildingId}/upgrade`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetType: selectedUpgradeType }),
        },
        'Upgrade failed',
      );
      await refreshSettlements();
      setUpgradeSettlementId(null);
      setUpgradeBuildingId(null);
      setUpgradeBuildingLabel('');
    } catch (error) {
      setUpgradeError(getApiErrorMessage(error, 'Upgrade failed'));
    } finally {
      setUpgradeLoading(false);
    }
  }

  async function updateStronghold(settlementId: string, body: Record<string, unknown>) {
    setStrongholdActionId(settlementId);
    setStrongholdActionError(null);

    try {
      await requestJson<{ updated: true }>(
        `/api/game/${gameId}/settlements`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ settlementId, ...body }),
        },
        'Stronghold update failed',
      );
      await refreshSettlements();
    } catch (error) {
      setStrongholdActionError(getApiErrorMessage(error, 'Stronghold update failed'));
    } finally {
      setStrongholdActionId(null);
    }
  }

  const selectedOption = buildingOptions.find((o) => o.type === selectedBuildingType);
  const hasBuildableOptions = buildingOptions.some((o) => o.canBuild);
  const requiredAllotmentType = getRequiredAllotmentType(selectedOption?.prerequisites);
  const allotmentOptions = requiredAllotmentType
    ? gosOptions.filter((gos) => gos.type === requiredAllotmentType)
    : [];
  const selectedUpgradeOption = upgradeOptions.find((option) => option.targetType === selectedUpgradeType);
  const hasUpgradeableOptions = upgradeOptions.some((option) => option.canUpgrade);

  const buildingSelectOptions = buildingOptions.map((option) => {
    const statusLabel = option.canBuild
      ? option.usesTradeAccess ? ' (via trade)' : ''
      : ` - ${option.reasonMessage ?? 'unavailable'}`;

    return {
      value: option.type,
      label: `${option.type} [${option.category}]${statusLabel}`,
      disabled: !option.canBuild && option.reason !== 'allotted_gos_required',
    };
  });

  const upgradeSelectOptions = upgradeOptions.map((option) => {
    const statusLabel = option.canUpgrade
      ? option.usesTradeAccess ? ' (via trade)' : ''
      : ` - ${option.reasonMessage ?? 'unavailable'}`;

    return {
      value: option.targetType,
      label: `${option.targetType} [${option.category}]${statusLabel}`,
      disabled: !option.canUpgrade,
    };
  });

  function getOfficeEligibleNobles(currentNobleId: string | null) {
    return nobles.filter((noble) => noble.id === currentNobleId || noble.officeAssignments.length === 0);
  }

  return (
    <main className="min-h-screen p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Settlements</h1>
      <p className="text-ink-300 mb-6">
        {isSetup
          ? 'Name your settlements and assign governors during setup.'
          : 'Manage your settlements and construct new buildings.'}
      </p>

      {loadError ? (
        <div className="mb-6 rounded border border-red-700/40 bg-red-50/70 p-3">
          <InlineMutationMessage status="error" message={loadError} />
        </div>
      ) : null}

      {gosOptions.length > 0 && (
        <div className="mb-6 p-4 medieval-border rounded bg-parchment-800/30">
          <p className="font-heading font-semibold text-sm mb-2">GOS Presence &amp; Building Unlocks</p>
          <div className="space-y-2">
            {(['Guild', 'Order', 'Society'] as const).map((gosType) => {
              const present = gosOptions.filter((g) => g.type === gosType);
              const unlocked = GOS_UNLOCKED_BUILDINGS[gosType];
              if (unlocked.length === 0) return null;
              return (
                <div key={gosType} className="flex flex-wrap items-start gap-x-3 gap-y-1 text-sm">
                  <span className="font-semibold min-w-[60px]">{gosType}:</span>
                  {present.length > 0 ? (
                    <>
                      <span className="text-green-700">{present.map((g) => g.name).join(', ')}</span>
                      <span className="text-ink-300">— unlocks {unlocked.join(', ')}</span>
                    </>
                  ) : (
                    <span className="text-ink-400 italic">None present — would unlock {unlocked.join(', ')}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-6">
        {settlements.map((settlement) => {
          const isStronghold = settlement.kind !== 'settlement';
          const hasGovernor = settlement.kind !== 'watchtower';
          const data = isStronghold ? null : SETTLEMENT_DATA[settlement.size];
          const usedSlots = settlement.buildings?.filter((building) => building.takesBuildingSlot !== false).length ?? 0;
          const titleLabel = settlement.kind === 'watchtower'
            ? 'Watchtower'
            : settlement.kind === 'fort'
              ? 'Fort'
              : settlement.kind === 'castle'
                ? 'Castle'
                : settlement.size;

          return (
            <Card key={settlement.id} variant="gold">
              <CardHeader>
                <div className="flex items-center justify-between">
                  {isSetup && editingId === settlement.id ? (
                    <form
                      className="flex flex-col gap-1"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void renameSettlement(settlement, editingName);
                      }}
                      aria-busy={savingNameId === settlement.id}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          ref={nameInputRef}
                          className="bg-transparent border-b border-gold-500 text-xl font-heading font-bold text-ink-100 outline-none px-0 py-0.5 w-48"
                          value={editingName}
                          onChange={(e) => {
                            setEditingName(e.target.value);
                            setNameErrorById((current) => omitRecordKey(current, settlement.id));
                          }}
                          onBlur={() => void renameSettlement(settlement, editingName)}
                          disabled={savingNameId === settlement.id}
                          aria-describedby={nameErrorById[settlement.id] ? `settlement-name-error-${settlement.id}` : undefined}
                        />
                        {savingNameId === settlement.id ? (
                          <span className="text-xs text-ink-300">Saving...</span>
                        ) : null}
                      </div>
                      {nameErrorById[settlement.id] ? (
                        <InlineMutationMessage
                          id={`settlement-name-error-${settlement.id}`}
                          status="error"
                          message={nameErrorById[settlement.id]}
                          onRetry={() => void renameSettlement(settlement, editingName)}
                        />
                      ) : null}
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
                    <Badge variant="gold">{titleLabel}</Badge>
                    {data ? <Badge>{usedSlots}/{data.buildingSlots} slots</Badge> : null}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {hasGovernor ? (
                  <div className="flex items-center gap-3 mb-4 p-3 rounded medieval-border bg-parchment-800/30">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-gold-400 text-lg shrink-0">{isStronghold ? '⚑' : '👑'}</span>
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
                ) : null}

                {data ? (
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <p className="text-sm"><strong>Food Need:</strong> {data.foodNeed}</p>
                    <p className="text-sm"><strong>Max Troops:</strong> {data.maxTroops}</p>
                    <p className="text-sm"><strong>Recruit/Season:</strong> {data.recruitPerSeason}</p>
                  </div>
                ) : (
                  <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
                    <Badge>No building slots</Badge>
                    <Badge>No recruitment</Badge>
                    <Badge>No food production</Badge>
                    {settlement.kind === 'watchtower' ? <Badge>No garrison</Badge> : null}
                    {role === 'gm' && settlement.kind === 'fort' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={strongholdActionId === settlement.id}
                        onClick={() => updateStronghold(settlement.id, { kind: 'castle' })}
                      >
                        Upgrade to Castle
                      </Button>
                    ) : null}
                    {role === 'gm' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={strongholdActionId === settlement.id}
                        onClick={() => updateStronghold(settlement.id, { kind: 'settlement', size: 'Village' })}
                      >
                        Establish Village
                      </Button>
                    ) : null}
                    {strongholdActionError && strongholdActionId === null ? (
                      <InlineMutationMessage status="error" message={strongholdActionError} />
                    ) : null}
                  </div>
                )}

                {!isStronghold ? (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-heading font-semibold">Buildings</p>
                      <Button variant="outline" size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => openBuildDialog(settlement.id)}>Build</Button>
                    </div>
                    <div className="space-y-1">
                      {settlement.buildings?.map((building) => {
                        const ownerGos = gosOptions.find((g) => g.id === building.ownerGosId);
                        const ownerError = buildingOwnerErrorById[building.id];
                        const cancelError = cancelErrorById[building.id];

                        return (
                          <div key={building.id} className="grid grid-cols-1 items-center gap-2 p-2 medieval-border rounded md:grid-cols-[1fr_auto_auto]">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold">{building.type}</span>
                              <Badge>{building.category}</Badge>
                              <Badge>{building.size}</Badge>
                              {ownerGos && !isSetup && (
                                <span className="text-xs text-ink-300">({ownerGos.name})</span>
                              )}
                            </div>
                            <div className="flex items-center justify-start md:justify-center">
                              {building.constructionTurnsRemaining > 0 && (
                                <Badge variant="gold">{building.constructionTurnsRemaining} turns left</Badge>
                              )}
                            </div>
                            <div className="flex flex-col items-start gap-1 md:items-end">
                              <div className="flex flex-wrap items-center gap-2">
                                {isSetup && gosOptions.length > 0 && (
                                  <select
                                    className="text-xs bg-input-bg border border-input-border rounded px-1.5 py-1 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                                    value={building.ownerGosId ?? ''}
                                    onChange={(e) => void assignBuildingOwner(building.id, e.target.value || null)}
                                    disabled={buildingOwnerSavingId === building.id}
                                    aria-describedby={ownerError ? `building-owner-error-${building.id}` : undefined}
                                  >
                                    <option value="">No GOS owner</option>
                                    {gosOptions.map((g) => (
                                      <option key={g.id} value={g.id}>{g.name} ({g.type})</option>
                                    ))}
                                  </select>
                                )}
                                {buildingOwnerSavingId === building.id ? (
                                  <span className="text-xs text-ink-300" role="status" aria-live="polite">Saving...</span>
                                ) : buildingOwnerSuccessId === building.id ? (
                                  <span className="text-xs text-green-700" role="status" aria-live="polite">Saved</span>
                                ) : null}
                                {building.constructionTurnsRemaining > 0 ? (
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => void cancelConstruction(settlement.id, building.id)}
                                    disabled={cancellingBuildingId === building.id}
                                  >
                                    {cancellingBuildingId === building.id ? 'Cancelling...' : 'Cancel'}
                                  </Button>
                                ) : hasUpgradeTargets(building.type, building.size) ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openUpgradeDialog(settlement.id, building.id, building.type)}
                                  >
                                    Upgrade
                                  </Button>
                                ) : null}
                              </div>
                              {ownerError ? (
                                <InlineMutationMessage
                                  id={`building-owner-error-${building.id}`}
                                  status="error"
                                  message={ownerError}
                                  onRetry={() => void assignBuildingOwner(building.id, buildingOwnerRetryById[building.id] ?? null)}
                                />
                              ) : null}
                              {cancelError ? (
                                <InlineMutationMessage
                                  status="error"
                                  message={cancelError}
                                  onRetry={() => void cancelConstruction(settlement.id, building.id)}
                                />
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                      {(!settlement.buildings || settlement.buildings.length === 0) && (
                        <p className="text-ink-300 text-sm">No buildings yet.</p>
                      )}
                    </div>
                  </>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {buildSettlementId ? (
        <Dialog open onClose={() => {
          setBuildSettlementId(null);
          setShowCreateGosForm(false);
          setNewGosName('');
          setCreateGosError(null);
        }} size="lg">
          <DialogTitle>Construct Building</DialogTitle>
          <DialogDescription>
            Select a build option, resolve any allotment requirements, and confirm the construction order.
          </DialogDescription>
          <DialogContent aria-busy={buildingLoading || creatingGos}>
            {buildingLoading && buildingOptions.length === 0 ? (
              <p className="text-ink-300 text-sm">Loading building options...</p>
            ) : (
              <>
                <Select
                  label="Building Type"
                  options={buildingSelectOptions}
                  value={selectedBuildingType}
                  onChange={(e) => selectBuildingType(e.target.value)}
                />
                {requiredAllotmentType && (
                  <div className="space-y-2">
                    {allotmentOptions.length > 0 && !showCreateGosForm && (
                      <Select
                        label={`Allotted ${requiredAllotmentType}`}
                        options={allotmentOptions.map((gos) => ({ value: gos.id, label: gos.name }))}
                        value={selectedAllottedGosId}
                        onChange={(e) => setSelectedAllottedGosId(e.target.value)}
                      />
                    )}
                    {!showCreateGosForm && (
                      <Button
                        variant="ghost"
                        leftIcon={<Plus className="h-4 w-4" />}
                        onClick={() => {
                          setShowCreateGosForm(true);
                          setNewGosName('');
                          setCreateGosError(null);
                        }}
                      >
                        {allotmentOptions.length > 0
                          ? `Create new ${requiredAllotmentType}`
                          : `Create ${requiredAllotmentType} for this building`}
                      </Button>
                    )}
                    {showCreateGosForm && (
                      <div className="space-y-2 rounded p-3 medieval-border">
                        <Input
                          label={`New ${requiredAllotmentType} name`}
                          value={newGosName}
                          onChange={(e) => setNewGosName(e.target.value)}
                          placeholder={`e.g. ${requiredAllotmentType === 'Order' ? 'Order of Saint Cuthbert' : requiredAllotmentType === 'Society' ? 'Society of Natural Philosophy' : 'Mercers Guild'}`}
                        />
                        {createGosError ? (
                          <InlineMutationMessage
                            status="error"
                            message={createGosError}
                            onRetry={() => createGosInline(requiredAllotmentType)}
                          />
                        ) : null}
                        <div className="flex gap-2">
                          <Button
                            variant="accent"
                            onClick={() => createGosInline(requiredAllotmentType)}
                            disabled={!newGosName.trim() || creatingGos}
                          >
                            {creatingGos ? 'Creating…' : 'Create'}
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setShowCreateGosForm(false);
                              setNewGosName('');
                              setCreateGosError(null);
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
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
                      <div>
                        <strong>Requires:</strong>{' '}
                        {selectedOption.prerequisites.map((prereq, i) => {
                          const isGosPrereq = prereq === 'Guild' || prereq === 'Order' || prereq === 'Society';
                          const gosPresent = isGosPrereq && gosOptions.some((g) => g.type === prereq);
                          return (
                            <span key={prereq}>
                              {i > 0 && ', '}
                              <span className={isGosPrereq ? (gosPresent ? 'text-green-700' : 'text-red-700') : ''}>
                                {prereq}{isGosPrereq ? (gosPresent ? ' ✓' : ' ✗') : ''}
                              </span>
                            </span>
                          );
                        })}
                      </div>
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
                {buildError ? (
                  <div className="mt-2">
                    <InlineMutationMessage
                      status="error"
                      message={buildError}
                      onRetry={selectedOption?.canBuild ? () => void constructBuilding() : undefined}
                    />
                  </div>
                ) : null}
              </>
            )}
          </DialogContent>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBuildSettlementId(null)} disabled={buildingLoading}>Cancel</Button>
            <Button
              variant="accent"
              onClick={constructBuilding}
              disabled={!selectedOption?.canBuild || Boolean(requiredAllotmentType && !selectedAllottedGosId) || showCreateGosForm || buildingLoading}
            >
              {buildingLoading && buildingOptions.length > 0 ? 'Building...' : 'Build'}
            </Button>
          </DialogFooter>
        </Dialog>
      ) : null}

      {upgradeSettlementId && upgradeBuildingId ? (
        <Dialog
          open
          onClose={() => {
            setUpgradeSettlementId(null);
            setUpgradeBuildingId(null);
            setUpgradeBuildingLabel('');
          }}
          size="lg"
        >
          <DialogTitle>Upgrade {upgradeBuildingLabel}</DialogTitle>
          <DialogDescription>
            Choose an available upgrade path and review its cost, timing, and requirements.
          </DialogDescription>
          <DialogContent aria-busy={upgradeLoading}>
            {upgradeLoading && upgradeOptions.length === 0 ? (
              <p className="text-ink-300 text-sm">Loading upgrade options...</p>
            ) : (
              <>
                <Select
                  label="Upgrade Target"
                  options={upgradeSelectOptions}
                  value={selectedUpgradeType}
                  onChange={(e) => setSelectedUpgradeType(e.target.value)}
                />
                {upgradeOptions.length === 0 && (
                  <p className="mt-3 text-sm text-ink-300">
                    No larger upgrade paths are available for this building.
                  </p>
                )}
                {!hasUpgradeableOptions && upgradeOptions.length > 0 && (
                  <p className="mt-3 text-sm text-ink-300">
                    No upgrades are currently available for this building.
                  </p>
                )}
                {selectedUpgradeOption && (
                  <div className="mt-3 space-y-1 rounded p-3 text-sm medieval-border">
                    <p><strong>Category:</strong> {selectedUpgradeOption.category}</p>
                    <p><strong>Target Size:</strong> {selectedUpgradeOption.targetSize}</p>
                    <p><strong>Upgrade Cost:</strong> {selectedUpgradeOption.cost.toLocaleString()}gc</p>
                    <p><strong>Upgrade Time:</strong> {selectedUpgradeOption.constructionTurns} turn(s)</p>
                    {selectedUpgradeOption.prerequisites.length > 0 && (
                      <p><strong>Requires:</strong> {selectedUpgradeOption.prerequisites.join(', ')}</p>
                    )}
                    <p className="text-ink-300 italic">{selectedUpgradeOption.description}</p>
                    {selectedUpgradeOption.usesTradeAccess && (
                      <p><strong>Source:</strong> Available via traded access.</p>
                    )}
                    {!selectedUpgradeOption.canUpgrade && (
                      <p className="text-red-700"><strong>Status:</strong> {selectedUpgradeOption.reasonMessage ?? 'Unavailable'}</p>
                    )}
                  </div>
                )}
                {upgradeError ? (
                  <div className="mt-2">
                    <InlineMutationMessage
                      status="error"
                      message={upgradeError}
                      onRetry={selectedUpgradeOption?.canUpgrade ? () => void applyUpgrade() : undefined}
                    />
                  </div>
                ) : null}
              </>
            )}
          </DialogContent>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setUpgradeSettlementId(null);
                setUpgradeBuildingId(null);
                setUpgradeBuildingLabel('');
              }}
              disabled={upgradeLoading}
            >
              Cancel
            </Button>
            <Button
              variant="accent"
              onClick={applyUpgrade}
              disabled={!selectedUpgradeOption?.canUpgrade || upgradeLoading}
            >
              {upgradeLoading && upgradeOptions.length > 0 ? 'Upgrading...' : 'Upgrade'}
            </Button>
          </DialogFooter>
        </Dialog>
      ) : null}
    </main>
  );
}
