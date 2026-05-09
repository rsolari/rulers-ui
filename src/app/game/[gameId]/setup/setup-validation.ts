import type { TerritoryMapData } from '@/lib/maps/territory-map';
import type { GovernmentType, ResourceRarity, ResourceType, SettlementSize, Tradition } from '@/types/game';
import type { TerritoryType } from '@/lib/game-logic/map-generation';

export type SetupStep = 'territories' | 'map' | 'assignments' | 'review';
export type OwnerKind = 'player' | 'npc' | 'neutral';

export interface TerritoryDraftForValidation {
  name: string;
  description: string;
  type: TerritoryType;
}

export interface AssignmentDraftForValidation {
  kind: OwnerKind;
  displayName: string;
  realmName: string;
  governmentType: GovernmentType;
  traditions: Tradition[];
}

export interface GeneratedSetupResourceForValidation {
  id: string;
  resourceType?: ResourceType;
  rarity?: ResourceRarity;
  settlement?: {
    name?: string;
    size?: SettlementSize;
    type?: string;
  };
  hexKey: string | null;
}

export interface GeneratedTerritoryEntryForValidation {
  territoryIndex: number;
  resources: GeneratedSetupResourceForValidation[];
}

export interface SetupMapDefinitionForValidation {
  key: string;
  name: string;
  territories: Array<{
    key: string;
    name: string;
    description?: string;
  }>;
  territoryMaps: TerritoryMapData[];
}

export interface StepValidation {
  isValid: boolean;
  blockers: string[];
  warnings: string[];
  fieldErrors: Record<string, string>;
}

export interface StepProgress {
  completed: number;
  total: number;
  label: string;
}

export const SETUP_STEPS: Array<{ key: SetupStep; label: string }> = [
  { key: 'territories', label: 'Territories' },
  { key: 'map', label: 'Generated Map' },
  { key: 'assignments', label: 'Assignments' },
  { key: 'review', label: 'Review' },
];

const OWNER_KINDS = new Set<OwnerKind>(['player', 'npc', 'neutral']);

function createValidation(
  blockers: string[],
  fieldErrors: Record<string, string>,
  warnings: string[] = []
): StepValidation {
  return {
    isValid: blockers.length === 0 && Object.keys(fieldErrors).length === 0,
    blockers,
    warnings,
    fieldErrors,
  };
}

function addUnique(messages: string[], message: string) {
  if (!messages.includes(message)) {
    messages.push(message);
  }
}

export function getStepIndex(step: SetupStep) {
  return SETUP_STEPS.findIndex((entry) => entry.key === step);
}

export function getSelectedMap(
  selectedMapKey: string,
  availableMaps: SetupMapDefinitionForValidation[]
) {
  return availableMaps.find((entry) => entry.key === selectedMapKey) ?? null;
}

export function validateTerritories(args: {
  selectedMapKey: string;
  loadingMaps: boolean;
  territories: TerritoryDraftForValidation[];
  availableMaps: SetupMapDefinitionForValidation[];
}): StepValidation {
  const { selectedMapKey, loadingMaps, territories, availableMaps } = args;
  const blockers: string[] = [];
  const fieldErrors: Record<string, string> = {};
  const selectedMap = getSelectedMap(selectedMapKey, availableMaps);

  if (loadingMaps) {
    blockers.push('Loading curated maps...');
  }

  if (!selectedMapKey) {
    blockers.push('Select a curated map.');
  } else if (!selectedMap) {
    blockers.push('The selected curated map is no longer available.');
  }

  if (territories.length === 0) {
    blockers.push('Load at least one territory from a curated map.');
  }

  if (selectedMap && territories.length !== selectedMap.territories.length) {
    blockers.push(`The selected map expects ${selectedMap.territories.length} territories.`);
  }

  territories.forEach((territory, index) => {
    if (!territory.name.trim()) {
      fieldErrors[`territories.${index}.name`] = 'Territory name is required.';
      addUnique(blockers, 'Name every territory before generating the map.');
    }

    if (territory.type !== 'Realm' && territory.type !== 'Neutral') {
      fieldErrors[`territories.${index}.type`] = 'Choose Realm or Neutral.';
      addUnique(blockers, 'Every territory needs a valid type.');
    }
  });

  return createValidation(blockers, fieldErrors);
}

export function validateMapPlacements(args: {
  territories: TerritoryDraftForValidation[];
  generatedMap: GeneratedTerritoryEntryForValidation[];
  selectedMap: SetupMapDefinitionForValidation | null;
}): StepValidation {
  const { territories, generatedMap, selectedMap } = args;
  const blockers: string[] = [];
  const fieldErrors: Record<string, string> = {};
  const entryByTerritory = new Map(generatedMap.map((entry) => [entry.territoryIndex, entry]));

  territories.forEach((territory, territoryIndex) => {
    const entry = entryByTerritory.get(territoryIndex);
    const territoryLabel = territory.name.trim() || `Territory ${territoryIndex + 1}`;
    const territoryMap = selectedMap?.territoryMaps[territoryIndex];
    const selectableHexIds = territoryMap?.selectableHexIds ?? [];
    const selectableHexSet = new Set(selectableHexIds);
    const seenHexes = new Map<string, string>();

    if (!entry) {
      addUnique(blockers, `Generate resources for ${territoryLabel}.`);
      return;
    }

    if (entry.resources.length === 0) {
      addUnique(blockers, `${territoryLabel} needs at least one generated settlement.`);
    }

    if (entry.resources.length > selectableHexIds.length) {
      addUnique(blockers, `${territoryLabel} has more settlements than placeable hexes.`);
    }

    entry.resources.forEach((resource) => {
      const resourceLabel = resource.settlement?.name?.trim() || 'Settlement';
      const resourcePrefix = `resources.${territoryIndex}.${resource.id}`;

      if (!resource.resourceType) {
        fieldErrors[`${resourcePrefix}.resourceType`] = 'Resource type is required.';
        addUnique(blockers, 'Every generated settlement needs a resource type.');
      }

      if (!resource.settlement) {
        fieldErrors[`${resourcePrefix}.settlement.name`] = 'Settlement details are required.';
        addUnique(blockers, 'Every resource needs a starting settlement.');
        return;
      }

      if (!resource.settlement.name?.trim()) {
        fieldErrors[`${resourcePrefix}.settlement.name`] = 'Settlement name is required.';
        addUnique(blockers, 'Name every generated settlement.');
      }

      if (!resource.hexKey) {
        fieldErrors[`${resourcePrefix}.settlement.hexKey`] = 'Place this settlement on a territory hex.';
        addUnique(blockers, 'Place every generated settlement on the map.');
        return;
      }

      if (!selectableHexSet.has(resource.hexKey)) {
        fieldErrors[`${resourcePrefix}.settlement.hexKey`] = 'This hex is outside the territory land area.';
        addUnique(blockers, `${resourceLabel} is placed outside ${territoryLabel}.`);
      }

      const duplicateResourceId = seenHexes.get(resource.hexKey);
      if (duplicateResourceId) {
        fieldErrors[`${resourcePrefix}.settlement.hexKey`] = 'This hex is already used in this territory.';
        fieldErrors[`resources.${territoryIndex}.${duplicateResourceId}.settlement.hexKey`] =
          'This hex is already used in this territory.';
        addUnique(blockers, `${territoryLabel} has duplicate settlement hexes.`);
      } else {
        seenHexes.set(resource.hexKey, resource.id);
      }
    });
  });

  return createValidation(blockers, fieldErrors);
}

export function validateAssignments(args: {
  territories: TerritoryDraftForValidation[];
  assignments: AssignmentDraftForValidation[];
}): StepValidation {
  const { territories, assignments } = args;
  const blockers: string[] = [];
  const warnings: string[] = [];
  const fieldErrors: Record<string, string> = {};

  territories.forEach((territory, index) => {
    const assignment = assignments[index];

    if (!assignment) {
      fieldErrors[`assignments.${index}.kind`] = 'Choose an owner.';
      addUnique(blockers, 'Every territory needs an owner selection.');
      return;
    }

    if (!OWNER_KINDS.has(assignment.kind)) {
      fieldErrors[`assignments.${index}.kind`] = 'Choose Player Slot, NPC Realm, or Neutral.';
      addUnique(blockers, 'Every territory needs a valid owner type.');
      return;
    }

    if (territory.type === 'Neutral' && assignment.kind !== 'neutral') {
      fieldErrors[`assignments.${index}.kind`] = 'Neutral territories must stay neutral.';
      addUnique(blockers, 'Neutral territories cannot be assigned to player or NPC realms.');
    }

    if (territory.type === 'Realm' && assignment.kind === 'neutral') {
      fieldErrors[`assignments.${index}.kind`] = 'Realm territories need a player slot or NPC realm.';
      addUnique(blockers, 'Realm territories cannot be neutral.');
    }

    if (territory.type === 'Realm' && assignment.kind === 'npc' && !assignment.realmName.trim()) {
      warnings.push(`${territory.name.trim() || `Territory ${index + 1}`} will use the default NPC realm name.`);
    }
  });

  return createValidation(blockers, fieldErrors, warnings);
}

export function combineValidation(validations: StepValidation[]): StepValidation {
  const blockers = validations.flatMap((validation) => validation.blockers);
  const warnings = validations.flatMap((validation) => validation.warnings);
  const fieldErrors = validations.reduce<Record<string, string>>((merged, validation) => ({
    ...merged,
    ...validation.fieldErrors,
  }), {});

  return createValidation(blockers, fieldErrors, warnings);
}

export function getFirstInvalidStep(validations: Record<SetupStep, StepValidation>): SetupStep {
  return SETUP_STEPS.find((entry) => !validations[entry.key].isValid)?.key ?? 'review';
}

export function canNavigateToStep(
  targetStep: SetupStep,
  currentStep: SetupStep,
  validations: Record<SetupStep, StepValidation>
): { allowed: boolean; reason?: string } {
  const currentIndex = getStepIndex(currentStep);
  const targetIndex = getStepIndex(targetStep);

  if (targetIndex <= currentIndex) {
    return { allowed: true };
  }

  for (const stepDefinition of SETUP_STEPS.slice(0, targetIndex)) {
    const validation = validations[stepDefinition.key];
    if (!validation.isValid) {
      return {
        allowed: false,
        reason: validation.blockers[0] ?? Object.values(validation.fieldErrors)[0] ?? 'Complete earlier setup steps first.',
      };
    }
  }

  return { allowed: true };
}

export function getStepProgress(
  step: SetupStep,
  args: {
    territories: TerritoryDraftForValidation[];
    generatedMap: GeneratedTerritoryEntryForValidation[];
    assignments: AssignmentDraftForValidation[];
  }
): StepProgress {
  const { territories, generatedMap, assignments } = args;

  if (step === 'territories') {
    const namedCount = territories.filter((territory) => territory.name.trim()).length;
    return { completed: namedCount, total: territories.length, label: `Territories: ${namedCount}/${territories.length} named` };
  }

  if (step === 'map') {
    const resources = generatedMap.flatMap((entry) => entry.resources);
    const placedCount = resources.filter((resource) => resource.hexKey).length;
    return { completed: placedCount, total: resources.length, label: `Map: ${placedCount}/${resources.length} settlements placed` };
  }

  if (step === 'assignments') {
    const ownerCount = territories.filter((territory, index) => {
      const assignment = assignments[index];
      if (!assignment) {
        return false;
      }
      return territory.type === 'Neutral' ? assignment.kind === 'neutral' : assignment.kind === 'player' || assignment.kind === 'npc';
    }).length;
    return { completed: ownerCount, total: territories.length, label: `Assignments: ${ownerCount}/${territories.length} owners assigned` };
  }

  const completeCount = SETUP_STEPS.slice(0, 3).reduce((count, setupStep) => {
    const progress = getStepProgress(setupStep.key, args);
    return count + (progress.total > 0 && progress.completed === progress.total ? 1 : 0);
  }, 0);
  return { completed: completeCount, total: 3, label: `Review: ${completeCount}/3 checks complete` };
}
