'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CheckCircle2, ChevronRight, Dice5, Plus, RotateCcw } from 'lucide-react';
import { TerritoryHexMap, type TerritoryMapPlacement } from '@/components/map/TerritoryHexMap';
import { AppPage, AppPageHeader } from '@/components/layout/app-page';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ListRow } from '@/components/ui/list-row';
import { Select } from '@/components/ui/select';
import { StatusPill } from '@/components/ui/status-pill';
import {
  getPreferredTerritoryHexIds,
  type TerritoryMapData,
} from '@/lib/maps/territory-map';
import { getApiErrorMessage, requestJson } from '@/lib/api-client';
import { RESOURCE_RARITY } from '@/lib/game-logic/constants';
import {
  generateMap,
  generateTerritoryResources,
  type GeneratedResource,
  type TerritoryType,
} from '@/lib/game-logic/map-generation';
import { generatePlaceName } from '@/lib/game-logic/place-names';
import type { GovernmentType, ResourceType, SettlementSize, Tradition } from '@/types/game';
import {
  SETUP_STEPS,
  canNavigateToStep,
  combineValidation,
  getFirstInvalidStep,
  getStepIndex,
  getStepProgress,
  validateAssignments,
  validateMapPlacements,
  validateTerritories,
  type OwnerKind,
  type SetupStep,
  type StepProgress,
  type StepValidation,
} from './setup-validation';

const TERRITORY_TYPE_OPTIONS = [
  { value: 'Realm', label: 'Realm Territory' },
  { value: 'Neutral', label: 'Neutral Territory' },
];

const OWNER_KIND_OPTIONS = [
  { value: 'player', label: 'Player Slot' },
  { value: 'npc', label: 'NPC Realm' },
  { value: 'neutral', label: 'Neutral' },
];

const RESOURCE_OPTIONS = [
  { value: 'Timber', label: 'Timber (Common)' },
  { value: 'Clay', label: 'Clay (Common)' },
  { value: 'Ore', label: 'Ore (Common)' },
  { value: 'Stone', label: 'Stone (Common)' },
  { value: 'Gold', label: 'Gold (Luxury)' },
  { value: 'Lacquer', label: 'Lacquer (Luxury)' },
  { value: 'Porcelain', label: 'Porcelain (Luxury)' },
  { value: 'Jewels', label: 'Jewels (Luxury)' },
  { value: 'Marble', label: 'Marble (Luxury)' },
  { value: 'Silk', label: 'Silk (Luxury)' },
  { value: 'Spices', label: 'Spices (Luxury)' },
  { value: 'Tea', label: 'Tea (Luxury)' },
  { value: 'Coffee', label: 'Coffee (Luxury)' },
  { value: 'Tobacco', label: 'Tobacco (Luxury)' },
  { value: 'Opium', label: 'Opium (Luxury)' },
  { value: 'Salt', label: 'Salt (Luxury)' },
  { value: 'Sugar', label: 'Sugar (Luxury)' },
];

const SETTLEMENT_SIZE_OPTIONS = [
  { value: 'Village', label: 'Village' },
  { value: 'Town', label: 'Town' },
  { value: 'City', label: 'City' },
];

type Step = SetupStep;

interface TerritoryDraft {
  name: string;
  description: string;
  type: TerritoryType;
}

interface AssignmentDraft {
  kind: OwnerKind;
  displayName: string;
  realmName: string;
  governmentType: GovernmentType;
  traditions: Tradition[];
}

interface GeneratedSetupResource extends GeneratedResource {
  id: string;
  hexKey: string | null;
}

interface GeneratedTerritoryEntry {
  territoryIndex: number;
  resources: GeneratedSetupResource[];
}

interface SetupMapDefinition {
  key: string;
  name: string;
  territories: Array<{
    key: string;
    name: string;
    description?: string;
  }>;
  territoryMaps: TerritoryMapData[];
}

function createAssignments(nextTerritories: TerritoryDraft[]) {
  return nextTerritories.map((territory): AssignmentDraft => ({
    kind: territory.type === 'Neutral' ? 'neutral' : 'player',
    displayName: '',
    realmName: '',
    governmentType: 'Monarch',
    traditions: [],
  }));
}

function buildTerritoriesFromMap(mapDefinition: SetupMapDefinition) {
  return mapDefinition.territories.map((territory) => ({
    name: territory.name,
    description: territory.description || '',
    type: 'Realm' as TerritoryType,
  }));
}

function createResourceId(territoryIndex: number, resourceIndex: number) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${territoryIndex}-${resourceIndex}-${crypto.randomUUID()}`;
  }

  return `${territoryIndex}-${resourceIndex}-${Math.random().toString(36).slice(2, 9)}`;
}

function applyDefaultPlacements(
  territoryIndex: number,
  resources: GeneratedResource[],
  territoryMap: TerritoryMapData | undefined
): GeneratedSetupResource[] {
  const preferredHexIds = territoryMap ? getPreferredTerritoryHexIds(territoryMap) : [];

  return resources.map((resource, resourceIndex) => ({
    ...resource,
    id: createResourceId(territoryIndex, resourceIndex),
    hexKey: preferredHexIds[resourceIndex] ?? null,
  }));
}

function createGeneratedEntries(
  territories: TerritoryDraft[],
  mapDefinition: SetupMapDefinition | null
): GeneratedTerritoryEntry[] {
  return generateMap(territories).map((entry) => ({
    territoryIndex: entry.territoryIndex,
    resources: applyDefaultPlacements(
      entry.territoryIndex,
      entry.resources,
      mapDefinition?.territoryMaps[entry.territoryIndex]
    ),
  }));
}

function getOwnerLabel(territory: TerritoryDraft, assignment: AssignmentDraft | undefined) {
  if (territory.type === 'Neutral') {
    return 'Neutral';
  }

  if (assignment?.kind === 'npc') {
    return `NPC: ${assignment.realmName || territory.name}`;
  }

  return `Player Slot${assignment?.displayName ? `: ${assignment.displayName}` : ''}`;
}

function getPlacementSummary(resource: GeneratedSetupResource) {
  return resource.hexKey ? `Hex ${resource.hexKey}` : 'Unplaced';
}

const VALIDATION_SUMMARY_IDS: Record<Step, string> = {
  territories: 'territories-validation-summary',
  map: 'map-validation-summary',
  assignments: 'assignments-validation-summary',
  review: 'review-validation-summary',
};

const STEP_HEADING_IDS: Record<Step, string> = {
  territories: 'territories-step-heading',
  map: 'map-step-heading',
  assignments: 'assignments-step-heading',
  review: 'review-step-heading',
};

function ValidationSummary({
  id,
  validation,
  title = 'Before continuing',
}: {
  id: string;
  validation: StepValidation;
  title?: string;
}) {
  if (validation.isValid && validation.warnings.length === 0) {
    return (
      <Alert
        id={id}
        tabIndex={-1}
        tone="success"
        className="focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
      >
        Validation passed.
      </Alert>
    );
  }

  return (
    <Alert
      id={id}
      tabIndex={-1}
      aria-live="polite"
      tone={validation.isValid ? 'warning' : 'danger'}
      className="focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
    >
      <p className="font-semibold">{title}</p>
      {validation.blockers.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {validation.blockers.map((blocker) => (
            <li key={blocker}>{blocker}</li>
          ))}
        </ul>
      ) : null}
      {validation.warnings.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-500">
          {validation.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </Alert>
  );
}

function SetupWizardFooter({
  step,
  stepIndex,
  stepCount,
  validation,
  progress,
  saving,
  primaryLabel,
  secondaryLabel,
  onBack,
  onPrimary,
  onSecondary,
  onFocusSummary,
}: {
  step: Step;
  stepIndex: number;
  stepCount: number;
  validation: StepValidation;
  progress: StepProgress;
  saving: boolean;
  primaryLabel: string;
  secondaryLabel?: string;
  onBack: () => void;
  onPrimary: () => void;
  onSecondary?: () => void;
  onFocusSummary: () => void;
}) {
  const blocker = validation.blockers[0] ?? Object.values(validation.fieldErrors)[0] ?? '';
  const isFirstStep = stepIndex === 0;
  const primaryDisabled = saving || !validation.isValid;

  return (
    <div className="sticky bottom-0 z-20 -mx-4 mt-8 border-t border-ink-200/70 bg-parchment-50/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(28,28,28,0.08)] backdrop-blur sm:-mx-6 sm:px-6 sm:py-4 sm:pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-ink-600">
            Step {stepIndex + 1} of {stepCount} - {progress.label}
          </p>
          {blocker ? (
            <button
              type="button"
              className="text-left text-sm text-red-600 underline-offset-2 hover:underline"
              onClick={onFocusSummary}
            >
              Blocked: {blocker}
            </button>
          ) : (
            <p className="text-sm text-green-700">Ready to continue.</p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
          {!isFirstStep ? (
            <Button variant="ghost" className="w-full sm:w-auto" onClick={onBack} disabled={saving}>
              Back
            </Button>
          ) : null}
          {secondaryLabel && onSecondary ? (
            <Button variant="outline" className="w-full sm:w-auto" onClick={onSecondary} disabled={saving}>
              {secondaryLabel}
            </Button>
          ) : null}
          <Button
            variant="accent"
            size={step === 'review' ? 'lg' : 'md'}
            className="w-full sm:w-auto"
            onClick={onPrimary}
            disabled={primaryDisabled}
            aria-describedby={blocker ? VALIDATION_SUMMARY_IDS[step] : undefined}
            title={blocker || undefined}
          >
            {saving && step === 'review' ? 'Saving...' : primaryLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function SetupWizard() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.gameId as string;

  const [step, setStep] = useState<Step>('territories');
  const [availableMaps, setAvailableMaps] = useState<SetupMapDefinition[]>([]);
  const [selectedMapKey, setSelectedMapKey] = useState('');
  const [territories, setTerritories] = useState<TerritoryDraft[]>([]);
  const [generatedMap, setGeneratedMap] = useState<GeneratedTerritoryEntry[]>([]);
  const [assignments, setAssignments] = useState<AssignmentDraft[]>([]);
  const [activePlacementIds, setActivePlacementIds] = useState<Record<number, string | null>>({});
  const [loadingMaps, setLoadingMaps] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const pendingFocusStepRef = useRef<Step | null>(null);

  const selectedMap = useMemo(
    () => availableMaps.find((entry) => entry.key === selectedMapKey) ?? null,
    [availableMaps, selectedMapKey]
  );

  const territoryValidation = useMemo(() => validateTerritories({
    selectedMapKey,
    loadingMaps,
    territories,
    availableMaps,
  }), [availableMaps, loadingMaps, selectedMapKey, territories]);

  const mapValidation = useMemo(() => validateMapPlacements({
    territories,
    generatedMap,
    selectedMap,
  }), [generatedMap, selectedMap, territories]);

  const assignmentValidation = useMemo(() => validateAssignments({
    territories,
    assignments,
  }), [assignments, territories]);

  const reviewValidation = useMemo(() => combineValidation([
    territoryValidation,
    mapValidation,
    assignmentValidation,
  ]), [assignmentValidation, mapValidation, territoryValidation]);

  const validationByStep = useMemo<Record<Step, StepValidation>>(() => ({
    territories: territoryValidation,
    map: mapValidation,
    assignments: assignmentValidation,
    review: reviewValidation,
  }), [assignmentValidation, mapValidation, reviewValidation, territoryValidation]);

  const progressByStep = useMemo<Record<Step, StepProgress>>(() => ({
    territories: getStepProgress('territories', { territories, generatedMap, assignments }),
    map: getStepProgress('map', { territories, generatedMap, assignments }),
    assignments: getStepProgress('assignments', { territories, generatedMap, assignments }),
    review: getStepProgress('review', { territories, generatedMap, assignments }),
  }), [assignments, generatedMap, territories]);

  useEffect(() => {
    let cancelled = false;

    async function loadMapDefinitions() {
      setLoadingMaps(true);

      try {
        const response = await fetch(`/api/game/${gameId}/setup/maps`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Unable to load curated maps');
        }

        if (cancelled) {
          return;
        }

        const nextMaps = Array.isArray(data) ? data as SetupMapDefinition[] : [];
        setAvailableMaps(nextMaps);

        const initialMap = nextMaps[0];
        if (!initialMap) {
          setTerritories([]);
          setAssignments([]);
          setGeneratedMap([]);
          setActivePlacementIds({});
          setSelectedMapKey('');
          return;
        }

        const nextTerritories = buildTerritoriesFromMap(initialMap);
        const nextGeneratedMap = createGeneratedEntries(nextTerritories, initialMap);
        setSelectedMapKey(initialMap.key);
        setTerritories(nextTerritories);
        setAssignments(createAssignments(nextTerritories));
        setGeneratedMap(nextGeneratedMap);
        setActivePlacementIds(Object.fromEntries(
          nextGeneratedMap.map((entry) => [entry.territoryIndex, entry.resources[0]?.id ?? null])
        ));
      } catch (caughtError) {
        if (!cancelled) {
          setError(caughtError instanceof Error ? caughtError.message : 'Unable to load curated maps');
        }
      } finally {
        if (!cancelled) {
          setLoadingMaps(false);
        }
      }
    }

    void loadMapDefinitions();

    return () => {
      cancelled = true;
    };
  }, [gameId]);

  useEffect(() => {
    if (pendingFocusStepRef.current !== step) {
      return;
    }

    pendingFocusStepRef.current = null;
    document.getElementById(STEP_HEADING_IDS[step])?.focus();
  }, [step]);

  function focusValidationSummary(targetStep: Step) {
    window.requestAnimationFrame(() => {
      document.getElementById(VALIDATION_SUMMARY_IDS[targetStep])?.focus();
    });
  }

  function moveToStep(targetStep: Step) {
    pendingFocusStepRef.current = targetStep;
    setStep(targetStep);
  }

  function syncAssignments(nextTerritories: TerritoryDraft[]) {
    setAssignments((current) => nextTerritories.map((territory, index) => {
      const existing = current[index];

      if (existing) {
        return territory.type === 'Neutral'
          ? { ...existing, kind: 'neutral' }
          : existing.kind === 'neutral'
            ? { ...existing, kind: 'player' }
            : existing;
      }

      return {
        kind: territory.type === 'Neutral' ? 'neutral' : 'player',
        displayName: '',
        realmName: '',
        governmentType: 'Monarch' as GovernmentType,
        traditions: [],
      } satisfies AssignmentDraft;
    }));
  }

  function rebuildGeneratedMap(nextTerritories: TerritoryDraft[], mapDefinition = selectedMap) {
    const nextGeneratedMap = createGeneratedEntries(nextTerritories, mapDefinition);
    setGeneratedMap(nextGeneratedMap);
    setActivePlacementIds(Object.fromEntries(
      nextGeneratedMap.map((entry) => [entry.territoryIndex, entry.resources[0]?.id ?? null])
    ));
  }

  function selectMap(mapKey: string) {
    setSelectedMapKey(mapKey);
    const nextMap = availableMaps.find((entry) => entry.key === mapKey);
    if (!nextMap) {
      return;
    }

    const nextTerritories = buildTerritoriesFromMap(nextMap);
    setTerritories(nextTerritories);
    setAssignments(createAssignments(nextTerritories));
    rebuildGeneratedMap(nextTerritories, nextMap);
  }

  function updateTerritory(index: number, field: keyof TerritoryDraft, value: string) {
    const nextTerritories = territories.map((territory, territoryIndex) => territoryIndex === index
      ? { ...territory, [field]: value }
      : territory);

    setTerritories(nextTerritories);
    syncAssignments(nextTerritories);

    if (field === 'type') {
      rebuildGeneratedMap(nextTerritories);
    }
  }

  function updateAssignment(index: number, update: Partial<AssignmentDraft>) {
    setAssignments((current) => current.map((assignment, assignmentIndex) => assignmentIndex === index
      ? { ...assignment, ...update }
      : assignment));
  }

  function doGenerateMap() {
    rebuildGeneratedMap(territories);
  }

  function confirmRegeneration(message: string) {
    if (generatedMap.length === 0) {
      return true;
    }

    return window.confirm(message);
  }

  function rerollAllTerritories() {
    if (!confirmRegeneration('Re-roll all generated resources and placements? Current map placements will be replaced.')) {
      return;
    }

    doGenerateMap();
  }

  function attemptStepChange(targetStep: Step) {
    const navigation = canNavigateToStep(targetStep, step, validationByStep);
    if (!navigation.allowed) {
      setError(navigation.reason ?? 'Complete the current step before continuing.');
      focusValidationSummary(step);
      return;
    }

    setError('');

    if (targetStep === 'map' && generatedMap.length === 0) {
      doGenerateMap();
    }

    moveToStep(targetStep);
  }

  function goNext() {
    if (step === 'territories') {
      attemptStepChange('map');
      return;
    }

    if (step === 'map') {
      attemptStepChange('assignments');
      return;
    }

    if (step === 'assignments') {
      attemptStepChange('review');
      return;
    }

    void handleFinish();
  }

  function goBack() {
    const previousStep = SETUP_STEPS[getStepIndex(step) - 1]?.key;
    if (previousStep) {
      setError('');
      moveToStep(previousStep);
    }
  }

  function rerollTerritory(territoryIndex: number) {
    const territory = territories[territoryIndex];
    const territoryMap = selectedMap?.territoryMaps[territoryIndex];

    if (!territory) {
      return;
    }

    if (!window.confirm(`Re-roll generated resources and placements for ${territory.name || `Territory ${territoryIndex + 1}`}?`)) {
      return;
    }

    const nextResources = applyDefaultPlacements(
      territoryIndex,
      generateTerritoryResources(territory.type),
      territoryMap
    );

    setGeneratedMap((current) => current.map((entry) => entry.territoryIndex === territoryIndex
      ? {
        ...entry,
        resources: nextResources,
      }
      : entry));
    setActivePlacementIds((current) => ({
      ...current,
      [territoryIndex]: nextResources[0]?.id ?? null,
    }));
  }

  function updateMapResource(
    territoryIndex: number,
    resourceId: string,
    field: 'resourceType' | 'settlementName' | 'settlementSize',
    value: string,
  ) {
    setGeneratedMap((current) => current.map((entry) => {
      if (entry.territoryIndex !== territoryIndex) {
        return entry;
      }

      return {
        ...entry,
        resources: entry.resources.map((resource) => {
          if (resource.id !== resourceId) {
            return resource;
          }

          if (field === 'resourceType') {
            const resourceType = value as ResourceType;
            return { ...resource, resourceType, rarity: RESOURCE_RARITY[resourceType] };
          }

          if (field === 'settlementName') {
            return { ...resource, settlement: { ...resource.settlement, name: value } };
          }

          return { ...resource, settlement: { ...resource.settlement, size: value as SettlementSize } };
        }),
      };
    }));
  }

  function addResourceToTerritory(territoryIndex: number) {
    const territoryMap = selectedMap?.territoryMaps[territoryIndex];
    let nextResourceId: string | null = null;

    setGeneratedMap((current) => current.map((entry) => {
      if (entry.territoryIndex !== territoryIndex) {
        return entry;
      }

      const usedHexIds = new Set(entry.resources.map((resource) => resource.hexKey).filter(Boolean));
      const nextHexKey = territoryMap
        ? getPreferredTerritoryHexIds(territoryMap).find((hexId) => !usedHexIds.has(hexId)) ?? null
        : null;
      const nextResource: GeneratedSetupResource = {
        id: createResourceId(territoryIndex, entry.resources.length),
        resourceType: 'Timber' as ResourceType,
        rarity: 'Common',
        settlement: {
          name: `Settlement ${entry.resources.length + 1}`,
          size: 'Village' as SettlementSize,
          type: 'Realm Settlement',
        },
        hexKey: nextHexKey,
      };
      nextResourceId = nextResource.id;

      return {
        ...entry,
        resources: [...entry.resources, nextResource],
      };
    }));
    setActivePlacementIds((current) => ({
      ...current,
      [territoryIndex]: nextResourceId ?? current[territoryIndex],
    }));
  }

  function removeResourceFromTerritory(territoryIndex: number, resourceId: string) {
    let nextActiveResourceId: string | null = null;

    setGeneratedMap((current) => current.map((entry) => {
      if (entry.territoryIndex !== territoryIndex) {
        return entry;
      }

      const remainingResources = entry.resources.filter((resource) => resource.id !== resourceId);
      nextActiveResourceId = remainingResources.find((resource) => !resource.hexKey)?.id ?? remainingResources[0]?.id ?? null;

      return {
        ...entry,
        resources: remainingResources,
      };
    }));
    setActivePlacementIds((current) => ({
      ...current,
      [territoryIndex]: current[territoryIndex] === resourceId ? nextActiveResourceId : current[territoryIndex],
    }));
  }

  function setActivePlacement(territoryIndex: number, resourceId: string) {
    setActivePlacementIds((current) => ({
      ...current,
      [territoryIndex]: resourceId,
    }));
  }

  function assignPlacementHex(territoryIndex: number, hexKey: string) {
    const territoryEntry = generatedMap.find((entry) => entry.territoryIndex === territoryIndex);
    const activeResourceId = activePlacementIds[territoryIndex] ?? territoryEntry?.resources[0]?.id ?? null;

    if (!territoryEntry || !activeResourceId) {
      return;
    }

    const activeResourceIndex = territoryEntry.resources.findIndex((resource) => resource.id === activeResourceId);
    const activeResource = territoryEntry.resources[activeResourceIndex];
    if (!activeResource) {
      return;
    }

    setGeneratedMap((current) => current.map((entry) => {
      if (entry.territoryIndex !== territoryIndex) {
        return entry;
      }

      return {
        ...entry,
        resources: entry.resources.map((resource) => {
          if (resource.id === activeResourceId) {
            return { ...resource, hexKey };
          }

          if (resource.hexKey === hexKey) {
            return { ...resource, hexKey: null };
          }

          return resource;
        }),
      };
    }));

    const nextResource = territoryEntry.resources[activeResourceIndex + 1] ?? null;
    setActivePlacementIds((current) => ({
      ...current,
      [territoryIndex]: nextResource?.id ?? activeResourceId,
    }));
  }

  async function handleFinish() {
    if (!reviewValidation.isValid) {
      const firstInvalidStep = getFirstInvalidStep(validationByStep);
      setError(reviewValidation.blockers[0] ?? 'Complete all setup steps before finishing.');
      moveToStep(firstInvalidStep);
      window.requestAnimationFrame(() => focusValidationSummary(firstInvalidStep));
      return;
    }

    setSaving(true);
    setError('');

    try {
      const payload = {
        mapKey: selectedMapKey,
        territories: territories.map((territory, index) => ({
          name: territory.name,
          description: territory.description,
          type: territory.type,
          resources: (generatedMap.find((entry) => entry.territoryIndex === index)?.resources || []).map((resource) => ({
            resourceType: resource.resourceType,
            rarity: resource.rarity,
            settlement: {
              name: resource.settlement.name,
              size: resource.settlement.size,
              hexKey: resource.hexKey,
            },
          })),
          owner: territory.type === 'Neutral'
            ? { kind: 'neutral' }
            : {
              kind: assignments[index]?.kind || 'player',
              displayName: assignments[index]?.displayName || undefined,
              realmName: assignments[index]?.realmName || undefined,
              governmentType: assignments[index]?.governmentType || undefined,
              traditions: assignments[index]?.traditions || [],
            },
        })),
      };

      await requestJson<unknown>(
        `/api/game/${gameId}/setup`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
        'Setup failed',
      );

      router.push(`/game/${gameId}/gm`);
    } catch (caughtError) {
      const message = getApiErrorMessage(caughtError, 'Setup failed');
      setError(message);
      if (/hex|placement|settlement|territory land|duplicate/i.test(message)) {
        moveToStep('map');
        window.requestAnimationFrame(() => focusValidationSummary('map'));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppPage className="pb-32 sm:pb-32">
      <AppPageHeader
        title="Game Setup"
        subtitle="Choose a curated world map, place starting settlements, assign owners, and open realm creation for players."
        status={
          <>
            <StatusPill tone="active">Step {getStepIndex(step) + 1} of {SETUP_STEPS.length}</StatusPill>
            <StatusPill tone={validationByStep[step].isValid ? 'success' : 'warning'}>
              {progressByStep[step].label}
            </StatusPill>
          </>
        }
      />

      <nav aria-label="Setup steps" className="-mx-4 mb-3 overflow-x-auto px-4 [scrollbar-width:thin]">
        <ol className="flex min-w-max snap-x items-center gap-1 pb-2 sm:min-w-0 sm:flex-wrap sm:gap-y-2 sm:pb-0">
          {SETUP_STEPS.map((stepDefinition, index, arr) => {
            const currentStep = stepDefinition.key;
            const stepIndex = getStepIndex(step);
            const isActive = step === currentStep;
            const validation = validationByStep[currentStep];
            const navigation = canNavigateToStep(currentStep, step, validationByStep);
            const isComplete = validation.isValid && index < stepIndex;
            const isDisabled = !navigation.allowed || saving;

            return (
              <li key={currentStep} className="flex snap-start items-center">
                <button
                  type="button"
                  disabled={isDisabled}
                  aria-current={isActive ? 'step' : undefined}
                  aria-describedby={isDisabled ? VALIDATION_SUMMARY_IDS[step] : undefined}
                  title={!navigation.allowed ? navigation.reason : undefined}
                  className={`flex min-h-11 min-w-[9.5rem] items-center gap-2 rounded-full border px-3 py-2 text-left text-xs font-heading font-semibold leading-tight transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 sm:min-h-0 sm:min-w-0 sm:py-1.5 ${
                    isActive
                      ? 'border-gold-500 bg-[var(--status-warning-bg)] text-ink-700'
                      : isComplete
                        ? 'border-green-600/30 bg-green-500/10 text-green-700'
                        : isDisabled
                          ? 'border-ink-200 bg-ink-100 text-ink-300'
                          : 'border-border-subtle bg-surface-row text-ink-500'
                  } disabled:cursor-not-allowed disabled:opacity-70 hover:enabled:opacity-80`}
                  onClick={() => {
                    attemptStepChange(currentStep);
                  }}
                >
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    isActive
                      ? 'bg-ink-700 text-gold-400'
                      : isComplete
                        ? 'bg-ink-600/60 text-parchment-50'
                        : 'bg-ink-400/40 text-ink-600'
                  }`}>
                    {isComplete ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : index + 1}
                  </span>
                  <span className="min-w-0 break-words">{stepDefinition.label}</span>
                </button>
                {index < arr.length - 1 ? (
                  <ChevronRight className={`mx-1 hidden h-4 w-4 flex-shrink-0 sm:block ${isComplete ? 'text-gold-500' : 'text-ink-300'}`} aria-hidden="true" />
                ) : null}
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="mb-8 flex flex-wrap gap-2 text-xs text-ink-400">
        {SETUP_STEPS.slice(0, 3).map((stepDefinition) => (
          <StatusPill key={stepDefinition.key} tone={validationByStep[stepDefinition.key].isValid ? 'success' : 'muted'}>
            {progressByStep[stepDefinition.key].label}
          </StatusPill>
        ))}
      </div>

      {error ? <Alert className="mb-4" tone="danger">{error}</Alert> : null}

      {step === 'territories' ? (
        <div className="space-y-4">
          <h2 id={STEP_HEADING_IDS.territories} tabIndex={-1} className="mb-4 text-2xl focus:outline-none">
            Define Territories
          </h2>
          <p className="mb-4 text-sm text-ink-300">
            Curated maps define the territory layout. You can still rename territories, adjust their role, and decide
            whether each becomes a player realm, NPC realm, or neutral territory.
          </p>
          <ValidationSummary
            id={VALIDATION_SUMMARY_IDS.territories}
            validation={territoryValidation}
            title="Territory validation"
          />
          <Card variant="panel">
            <CardContent>
              <div className="pt-4">
                <Select
                  label="Curated Map"
                  options={availableMaps.map((mapDefinition) => ({
                    value: mapDefinition.key,
                    label: `${mapDefinition.name} (${mapDefinition.territories.length} territories)`,
                  }))}
                  value={selectedMapKey}
                  onChange={(event) => selectMap(event.target.value)}
                  disabled={loadingMaps || saving}
                />
              </div>
            </CardContent>
          </Card>

          {territories.map((territory, index) => {
            const territoryMap = selectedMap?.territoryMaps[index];
            const entry = generatedMap.find((e) => e.territoryIndex === index);
            const territoryPlacements: TerritoryMapPlacement[] = entry
              ? entry.resources.map((resource) => ({
                  id: resource.id,
                  name: resource.settlement.name,
                  size: resource.settlement.size,
                  hexId: resource.hexKey,
                }))
              : [];

            return (
              <Card key={`${selectedMapKey}-${index}`} variant="panel">
                <CardContent className="pt-4">
                  <div className="grid min-w-0 gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
                    <div className="min-w-0 space-y-2">
                      {territoryMap ? <TerritoryHexMap data={territoryMap} placements={territoryPlacements} showContext /> : null}
                      <p className="text-xs text-ink-300">
                        {territoryMap?.selectableHexIds.length ?? 0} territory hexes
                      </p>
                    </div>

                    <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                      <div>
                        <Input
                          id={`territory-${index}-name`}
                          label="Territory Name"
                          value={territory.name}
                          aria-invalid={Boolean(territoryValidation.fieldErrors[`territories.${index}.name`])}
                          aria-describedby={`territory-${index}-name-error`}
                          onChange={(event) => updateTerritory(index, 'name', event.target.value)}
                        />
                        {territoryValidation.fieldErrors[`territories.${index}.name`] ? (
                          <p id={`territory-${index}-name-error`} className="mt-1 text-xs text-red-600">
                            {territoryValidation.fieldErrors[`territories.${index}.name`]}
                          </p>
                        ) : null}
                      </div>
                      <div>
                        <Select
                          id={`territory-${index}-type`}
                          label="Type"
                          options={TERRITORY_TYPE_OPTIONS}
                          value={territory.type}
                          aria-invalid={Boolean(territoryValidation.fieldErrors[`territories.${index}.type`])}
                          aria-describedby={`territory-${index}-type-error`}
                          onChange={(event) => updateTerritory(index, 'type', event.target.value)}
                        />
                        {territoryValidation.fieldErrors[`territories.${index}.type`] ? (
                          <p id={`territory-${index}-type-error`} className="mt-1 text-xs text-red-600">
                            {territoryValidation.fieldErrors[`territories.${index}.type`]}
                          </p>
                        ) : null}
                      </div>
                      <div className="sm:col-span-2">
                        <Input
                          label="Description"
                          value={territory.description}
                          onChange={(event) => updateTerritory(index, 'description', event.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : null}

      {step === 'map' ? (
        <div className="space-y-4">
          <h2 id={STEP_HEADING_IDS.map} tabIndex={-1} className="mb-4 text-2xl focus:outline-none">
            Generated Map
          </h2>
          <p className="mb-2 text-sm text-ink-300">
            Resources and settlements have been generated for each territory. Select a settlement row, then click a hex
            on the territory map to place it.
          </p>
          <ValidationSummary
            id={VALIDATION_SUMMARY_IDS.map}
            validation={mapValidation}
            title="Map placement validation"
          />

          {generatedMap.map((entry) => {
            const territory = territories[entry.territoryIndex];
            const territoryMap = selectedMap?.territoryMaps[entry.territoryIndex];
            const placements: TerritoryMapPlacement[] = entry.resources.map((resource) => ({
              id: resource.id,
              name: resource.settlement.name,
              size: resource.settlement.size,
              hexId: resource.hexKey,
            }));
            const placedCount = entry.resources.filter((resource) => resource.hexKey).length;
            const unplacedCount = entry.resources.length - placedCount;
            const territoryHasPlacementError = entry.resources.some((resource) => {
              const errorKey = `resources.${entry.territoryIndex}.${resource.id}.settlement.hexKey`;
              return Boolean(mapValidation.fieldErrors[errorKey]);
            });

            return (
              <Card key={entry.territoryIndex} variant={territory.type === 'Realm' ? 'emphasis' : 'panel'}>
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <CardTitle className="flex min-w-0 flex-wrap items-center gap-2">
                      {territory.name || `Territory ${entry.territoryIndex + 1}`}
                      <StatusPill tone={territory.type === 'Realm' ? 'active' : 'muted'}>
                        {territory.type}
                      </StatusPill>
                    </CardTitle>
                    <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                      <StatusPill tone={unplacedCount === 0 && !territoryHasPlacementError ? 'success' : 'danger'}>
                        {placedCount}/{entry.resources.length} placed
                      </StatusPill>
                      <Button className="w-full sm:w-auto" variant="outline" size="sm" leftIcon={<RotateCcw className="h-4 w-4" />} onClick={() => rerollTerritory(entry.territoryIndex)}>
                        Re-roll
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2 text-xs text-ink-400">
                    <Badge variant="outline">{entry.resources.length} resources</Badge>
                    <StatusPill tone={unplacedCount === 0 ? 'success' : 'danger'}>{unplacedCount} unplaced</StatusPill>
                    {territoryHasPlacementError ? <StatusPill tone="danger">Placement issue</StatusPill> : null}
                  </div>
                  {territory.type === 'Realm' ? (
                    <p className="text-sm text-ink-400">
                      Realm resource settlements start as villages during setup, but you still choose their exact hexes.
                    </p>
                  ) : null}

                  <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                    <div className="min-w-0 space-y-2">
                      {territoryMap ? (
                        <TerritoryHexMap
                          data={territoryMap}
                          placements={placements}
                          selectedPlacementId={activePlacementIds[entry.territoryIndex] ?? null}
                          onHexSelect={(hexId) => assignPlacementHex(entry.territoryIndex, hexId)}
                          variant="full"
                        />
                      ) : null}
                      <p className="text-xs text-ink-300">
                        Click a land hex to place the selected settlement.
                      </p>
                    </div>

                    <div className="min-w-0 space-y-3">
                      {entry.resources.some((resource) => !resource.hexKey) ? (
                        <Button
                          className="w-full sm:w-auto"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const nextUnplaced = entry.resources.find((resource) => !resource.hexKey);
                            if (nextUnplaced) {
                              setActivePlacement(entry.territoryIndex, nextUnplaced.id);
                            }
                          }}
                        >
                          Place next unplaced
                        </Button>
                      ) : null}
                      {entry.resources.map((resource, resourceIndex) => {
                        const isActive = activePlacementIds[entry.territoryIndex] === resource.id;
                        const resourcePrefix = `resources.${entry.territoryIndex}.${resource.id}`;
                        const resourceTypeError = mapValidation.fieldErrors[`${resourcePrefix}.resourceType`];
                        const settlementNameError = mapValidation.fieldErrors[`${resourcePrefix}.settlement.name`];
                        const hexError = mapValidation.fieldErrors[`${resourcePrefix}.settlement.hexKey`];

                        return (
                          <ListRow key={resource.id} selected={isActive} className="px-4 py-4">
                            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div className="min-w-0 flex flex-wrap items-center gap-2">
                                <Badge variant={resource.rarity === 'Luxury' ? 'gold' : 'default'}>
                                  {resource.resourceType}
                                </Badge>
                                <span className={`min-w-0 break-words text-sm ${hexError ? 'text-red-600' : 'text-ink-400'}`}>
                                  {getPlacementSummary(resource)}
                                  {hexError ? ` - ${hexError}` : ''}
                                </span>
                                {isActive && !resource.hexKey ? <StatusPill tone="danger">Active unplaced</StatusPill> : null}
                              </div>
                              <div className="grid grid-cols-1 gap-2 sm:flex sm:justify-end">
                                <Button
                                  variant={isActive ? 'accent' : 'outline'}
                                  size="sm"
                                  className="w-full sm:w-auto"
                                  onClick={() => setActivePlacement(entry.territoryIndex, resource.id)}
                                >
                                  {isActive ? 'Placing' : 'Place on map'}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="w-full sm:w-auto"
                                  onClick={() => removeResourceFromTerritory(entry.territoryIndex, resource.id)}
                                >
                                  Remove
                                </Button>
                              </div>
                            </div>

                            <div className="grid min-w-0 items-start gap-2 md:grid-cols-[1fr_1fr_auto]">
                              <div>
                                <Select
                                  id={`resource-${entry.territoryIndex}-${resource.id}-type`}
                                  label={resourceIndex === 0 ? 'Resource' : undefined}
                                  options={RESOURCE_OPTIONS}
                                  value={resource.resourceType}
                                  aria-invalid={Boolean(resourceTypeError)}
                                  aria-describedby={`resource-${entry.territoryIndex}-${resource.id}-type-error`}
                                  onChange={(event) => updateMapResource(
                                    entry.territoryIndex,
                                    resource.id,
                                    'resourceType',
                                    event.target.value
                                  )}
                                />
                                {resourceTypeError ? (
                                  <p id={`resource-${entry.territoryIndex}-${resource.id}-type-error`} className="mt-1 text-xs text-red-600">
                                    {resourceTypeError}
                                  </p>
                                ) : null}
                              </div>
                              <div className="flex gap-1 items-end">
                                <div className="min-w-0 flex-1">
                                  <Input
                                    id={`resource-${entry.territoryIndex}-${resource.id}-settlement-name`}
                                    label={resourceIndex === 0 ? 'Settlement Name' : undefined}
                                    value={resource.settlement.name}
                                    aria-invalid={Boolean(settlementNameError)}
                                    aria-describedby={`resource-${entry.territoryIndex}-${resource.id}-settlement-name-error`}
                                    onChange={(event) => updateMapResource(
                                      entry.territoryIndex,
                                      resource.id,
                                      'settlementName',
                                      event.target.value
                                    )}
                                  />
                                  {settlementNameError ? (
                                    <p id={`resource-${entry.territoryIndex}-${resource.id}-settlement-name-error`} className="mt-1 text-xs text-red-600">
                                      {settlementNameError}
                                    </p>
                                  ) : null}
                                </div>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="outline"
                                  iconOnly
                                  leftIcon={<Dice5 className="h-4 w-4" />}
                                  aria-label="Generate random settlement name"
                                  title="Generate random settlement name"
                                  onClick={() => updateMapResource(
                                    entry.territoryIndex,
                                    resource.id,
                                    'settlementName',
                                    generatePlaceName()
                                  )}
                                >
                                  Generate random settlement name
                                </Button>
                              </div>
                              <Select
                                label={resourceIndex === 0 ? 'Size' : undefined}
                                options={SETTLEMENT_SIZE_OPTIONS}
                                value={resource.settlement.size}
                                onChange={(event) => updateMapResource(
                                  entry.territoryIndex,
                                  resource.id,
                                  'settlementSize',
                                  event.target.value
                                )}
                              />
                            </div>
                          </ListRow>
                        );
                      })}

                      <Button className="w-full sm:w-auto" variant="outline" size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => addResourceToTerritory(entry.territoryIndex)}>
                        Add Resource
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

        </div>
      ) : null}

      {step === 'assignments' ? (
        <div className="space-y-6">
          <h2 id={STEP_HEADING_IDS.assignments} tabIndex={-1} className="mb-4 text-2xl focus:outline-none">
            Assign Ownership
          </h2>
          <p className="mb-4 text-sm text-ink-300">
            Assign each Realm territory to a player slot or NPC realm. Neutral territories have no owner.
          </p>
          <ValidationSummary
            id={VALIDATION_SUMMARY_IDS.assignments}
            validation={assignmentValidation}
            title="Assignment validation"
          />

          {territories.map((territory, index) => {
            const assignment = assignments[index];
            const ownerKind = territory.type === 'Neutral' ? 'neutral' : assignment?.kind || 'player';
            const ownerError = assignmentValidation.fieldErrors[`assignments.${index}.kind`];

            return (
              <Card key={index} variant={territory.type === 'Realm' ? 'emphasis' : 'panel'}>
                <CardHeader>
                  <CardTitle>{territory.name || `Territory ${index + 1}`}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <Select
                        id={`assignment-${index}-kind`}
                        label="Owner"
                        options={territory.type === 'Neutral'
                          ? [{ value: 'neutral', label: 'Neutral' }]
                          : OWNER_KIND_OPTIONS.filter((option) => option.value !== 'neutral')}
                        value={ownerKind}
                        aria-invalid={Boolean(ownerError)}
                        aria-describedby={`assignment-${index}-kind-error`}
                        onChange={(event) => updateAssignment(index, { kind: event.target.value as OwnerKind })}
                        disabled={territory.type === 'Neutral'}
                      />
                      {ownerError ? (
                        <p id={`assignment-${index}-kind-error`} className="mt-1 text-xs text-red-600">
                          {ownerError}
                        </p>
                      ) : null}
                    </div>

                    {ownerKind === 'player' ? (
                      <Input
                        label="Player Label"
                        placeholder="Optional, e.g. Alice"
                        value={assignment?.displayName || ''}
                        onChange={(event) => updateAssignment(index, { displayName: event.target.value })}
                      />
                    ) : null}

                    {ownerKind === 'npc' ? (
                      <Input
                        id={`assignment-${index}-realm-name`}
                        label="NPC Realm Name"
                        placeholder={`${territory.name || `Territory ${index + 1}`} NPC Realm`}
                        value={assignment?.realmName || ''}
                        onChange={(event) => updateAssignment(index, { realmName: event.target.value })}
                      />
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : null}

      {step === 'review' ? (
        <div className="space-y-6">
          <h2 id={STEP_HEADING_IDS.review} tabIndex={-1} className="text-2xl focus:outline-none">
            Review Setup
          </h2>
          <ValidationSummary
            id={VALIDATION_SUMMARY_IDS.review}
            validation={reviewValidation}
            title={reviewValidation.isValid ? 'Setup is ready to save' : 'Setup blockers'}
          />
          <Card variant="panel">
            <CardHeader>
              <CardTitle>Territories</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-5">
                {territories.map((territory, index) => {
                  const assignment = assignments[index];
                  const resources = generatedMap.find((entry) => entry.territoryIndex === index)?.resources || [];
                  const territoryMap = selectedMap?.territoryMaps[index];
                  const placements: TerritoryMapPlacement[] = resources.map((resource) => ({
                    id: resource.id,
                    name: resource.settlement.name,
                    size: resource.settlement.size,
                    hexId: resource.hexKey,
                  }));

                  return (
                    <div key={index} className="border-b border-ink-800 pb-5 last:border-0">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{territory.name || `Territory ${index + 1}`}</span>
                        <StatusPill tone={territory.type === 'Realm' ? 'active' : 'muted'}>{territory.type}</StatusPill>
                        <Badge>{getOwnerLabel(territory, assignment)}</Badge>
                      </div>

                      <div className="grid min-w-0 gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
                        <div className="min-w-0">
                          {territoryMap ? (
                            <TerritoryHexMap data={territoryMap} placements={placements} />
                          ) : null}
                        </div>

                        <div className="min-w-0 space-y-2">
                          {resources.map((resource) => (
                            <div key={resource.id} className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-ink-300">
                              <Badge variant={resource.rarity === 'Luxury' ? 'gold' : 'default'}>
                                {resource.resourceType}
                              </Badge>
                              <span className="min-w-0 break-words">
                                {resource.settlement.name} ({resource.settlement.size}) on {getPlacementSummary(resource)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <SetupWizardFooter
        step={step}
        stepIndex={getStepIndex(step)}
        stepCount={SETUP_STEPS.length}
        validation={validationByStep[step]}
        progress={progressByStep[step]}
        saving={saving}
        primaryLabel={{
          territories: 'Generate Map',
          map: 'Assign Owners',
          assignments: 'Review Setup',
          review: 'Finish Setup',
        }[step]}
        secondaryLabel={step === 'map' ? 'Re-roll All' : undefined}
        onBack={goBack}
        onPrimary={goNext}
        onSecondary={step === 'map' ? rerollAllTerritories : undefined}
        onFocusSummary={() => focusValidationSummary(step)}
      />
    </AppPage>
  );
}
