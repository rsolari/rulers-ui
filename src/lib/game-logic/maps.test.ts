import { describe, expect, it } from 'vitest';
import { db } from '@/db';
import { gameMaps, mapHexFeatures, mapHexes } from '@/db/schema';
import {
  getCuratedMapDefinition,
  importCuratedGameMap,
  validateCuratedMapDefinition,
} from './maps';

describe('validateCuratedMapDefinition', () => {
  it('rejects invalid land hexes', () => {
    expect(() => validateCuratedMapDefinition({
      key: 'broken-map',
      name: 'Broken Map',
      version: 1,
      territories: [{ key: 'territory-1', name: 'Territory 1' }],
      hexes: [{
        q: 0,
        r: 0,
        kind: 'land',
        terrainType: 'flat_farmland',
        territoryKey: 'missing-territory',
      }],
    })).toThrow(/unknown territory/);
  });
});

describe('importCuratedGameMap', () => {
  it('imports one selected territory plus its water and features', () => {
    const operations: Array<{ table: unknown; values: Record<string, unknown> }> = [];
    const fakeDatabase = {
      insert: (table: unknown) => ({
        values: (values: Record<string, unknown>) => ({
          run: () => {
            operations.push({ table, values });
          },
        }),
      }),
    };

    const result = importCuratedGameMap(fakeDatabase as Pick<typeof db, 'insert'>, {
      gameId: 'game-1',
      mapKey: 'world-v1',
      territoryIdsByKey: {
        'kingdom-1': 'territory-1',
      },
    });

    const definition = getCuratedMapDefinition('world-v1');
    const importedGameMaps = operations.filter((operation) => operation.table === gameMaps);
    const importedHexes = operations.filter((operation) => operation.table === mapHexes);
    const importedFeatures = operations.filter((operation) => operation.table === mapHexFeatures);
    const landHexes = importedHexes.filter((operation) => operation.values.hexKind === 'land');
    const waterHexes = importedHexes.filter((operation) => operation.values.hexKind === 'water');
    const kingdomOneHexes = definition.hexes.filter((hex) => hex.kind === 'land' && hex.territoryKey === 'kingdom-1');

    expect(importedGameMaps).toHaveLength(1);
    expect(importedHexes.length).toBeGreaterThan(result.territoryHexIds.get('kingdom-1')?.length ?? 0);
    expect(landHexes).toHaveLength(kingdomOneHexes.length);
    expect(waterHexes.length).toBeGreaterThan(0);
    expect(importedFeatures.length).toBeGreaterThan(0);
    expect(result.territoryHexIds.get('kingdom-1')).toHaveLength(kingdomOneHexes.length);
    expect(definition.suggestedStarts).toHaveLength(12);
    expect(landHexes.every((operation) => operation.values.territoryId === 'territory-1')).toBe(true);
  });
});
