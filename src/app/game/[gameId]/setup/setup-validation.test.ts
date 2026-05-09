import { describe, expect, it } from 'vitest';
import {
  canNavigateToStep,
  combineValidation,
  validateAssignments,
  validateMapPlacements,
  validateTerritories,
  type AssignmentDraftForValidation,
  type GeneratedTerritoryEntryForValidation,
  type SetupMapDefinitionForValidation,
  type TerritoryDraftForValidation,
} from './setup-validation';

const mapDefinition: SetupMapDefinitionForValidation = {
  key: 'test-map',
  name: 'Test Map',
  territories: [
    { key: 'north', name: 'North' },
    { key: 'south', name: 'South' },
  ],
  territoryMaps: [
    {
      territoryId: 'north',
      territoryName: 'North',
      suggestedStartHexId: '0,0',
      selectableHexIds: ['0,0', '1,0'],
      hexes: [],
    },
    {
      territoryId: 'south',
      territoryName: 'South',
      suggestedStartHexId: '0,0',
      selectableHexIds: ['0,0'],
      hexes: [],
    },
  ],
};

const territories: TerritoryDraftForValidation[] = [
  { name: 'North', description: '', type: 'Realm' },
  { name: 'South', description: '', type: 'Neutral' },
];

const validGeneratedMap: GeneratedTerritoryEntryForValidation[] = [
  {
    territoryIndex: 0,
    resources: [
      {
        id: 'north-timber',
        resourceType: 'Timber',
        rarity: 'Common',
        settlement: { name: 'North Village', size: 'Village', type: 'Realm Settlement' },
        hexKey: '0,0',
      },
    ],
  },
  {
    territoryIndex: 1,
    resources: [
      {
        id: 'south-stone',
        resourceType: 'Stone',
        rarity: 'Common',
        settlement: { name: 'South Village', size: 'Village', type: 'Realm Settlement' },
        hexKey: '0,0',
      },
    ],
  },
];

const validAssignments: AssignmentDraftForValidation[] = [
  { kind: 'player', displayName: '', realmName: '', governmentType: 'Monarch', traditions: [] },
  { kind: 'neutral', displayName: '', realmName: '', governmentType: 'Monarch', traditions: [] },
];

function buildValidations(args: {
  nextTerritories?: TerritoryDraftForValidation[];
  generatedMap?: GeneratedTerritoryEntryForValidation[];
  assignments?: AssignmentDraftForValidation[];
} = {}) {
  const nextTerritories = args.nextTerritories ?? territories;
  const territoryValidation = validateTerritories({
    selectedMapKey: mapDefinition.key,
    loadingMaps: false,
    territories: nextTerritories,
    availableMaps: [mapDefinition],
  });
  const mapValidation = validateMapPlacements({
    territories: nextTerritories,
    generatedMap: args.generatedMap ?? validGeneratedMap,
    selectedMap: mapDefinition,
  });
  const assignmentValidation = validateAssignments({
    territories: nextTerritories,
    assignments: args.assignments ?? validAssignments,
  });
  const reviewValidation = combineValidation([territoryValidation, mapValidation, assignmentValidation]);

  return {
    territories: territoryValidation,
    map: mapValidation,
    assignments: assignmentValidation,
    review: reviewValidation,
  };
}

describe('setup wizard validation', () => {
  it('blocks territory progression until names and map shape are valid', () => {
    const validation = validateTerritories({
      selectedMapKey: mapDefinition.key,
      loadingMaps: false,
      territories: [{ ...territories[0], name: '  ' }],
      availableMaps: [mapDefinition],
    });

    expect(validation.isValid).toBe(false);
    expect(validation.fieldErrors['territories.0.name']).toBe('Territory name is required.');
    expect(validation.blockers).toContain('The selected map expects 2 territories.');
  });

  it('blocks map progression for unplaced, invalid, and duplicate settlement hexes', () => {
    const generatedMap: GeneratedTerritoryEntryForValidation[] = [
      {
        territoryIndex: 0,
        resources: [
          { ...validGeneratedMap[0].resources[0], id: 'first', hexKey: '0,0' },
          { ...validGeneratedMap[0].resources[0], id: 'second', hexKey: '0,0' },
          { ...validGeneratedMap[0].resources[0], id: 'third', hexKey: '9,9' },
        ],
      },
      {
        territoryIndex: 1,
        resources: [
          { ...validGeneratedMap[1].resources[0], id: 'unplaced', hexKey: null },
        ],
      },
    ];

    const validation = validateMapPlacements({
      territories,
      generatedMap,
      selectedMap: mapDefinition,
    });

    expect(validation.isValid).toBe(false);
    expect(validation.blockers).toContain('North has duplicate settlement hexes.');
    expect(validation.blockers).toContain('Place every generated settlement on the map.');
    expect(validation.fieldErrors['resources.0.third.settlement.hexKey']).toBe('This hex is outside the territory land area.');
    expect(validation.fieldErrors['resources.1.unplaced.settlement.hexKey']).toBe('Place this settlement on a territory hex.');
  });

  it('keeps future stepper targets locked until prerequisite steps validate', () => {
    const generatedMap = validGeneratedMap.map((entry) => entry.territoryIndex === 0
      ? {
        ...entry,
        resources: entry.resources.map((resource) => ({ ...resource, hexKey: null })),
      }
      : entry);
    const validations = buildValidations({ generatedMap });

    expect(canNavigateToStep('assignments', 'territories', validations)).toEqual({
      allowed: false,
      reason: 'Place every generated settlement on the map.',
    });
    expect(canNavigateToStep('map', 'territories', validations)).toEqual({ allowed: true });
  });

  it('validates assignment compatibility while preserving optional NPC fallback names', () => {
    const validation = validateAssignments({
      territories,
      assignments: [
        { kind: 'neutral', displayName: '', realmName: '', governmentType: 'Monarch', traditions: [] },
        { kind: 'player', displayName: '', realmName: '', governmentType: 'Monarch', traditions: [] },
      ],
    });

    expect(validation.isValid).toBe(false);
    expect(validation.fieldErrors['assignments.0.kind']).toBe('Realm territories need a player slot or NPC realm.');
    expect(validation.fieldErrors['assignments.1.kind']).toBe('Neutral territories must stay neutral.');

    const npcValidation = validateAssignments({
      territories: [territories[0]],
      assignments: [
        { kind: 'npc', displayName: '', realmName: ' ', governmentType: 'Monarch', traditions: [] },
      ],
    });
    expect(npcValidation.isValid).toBe(true);
    expect(npcValidation.warnings).toEqual(['North will use the default NPC realm name.']);
  });
});
