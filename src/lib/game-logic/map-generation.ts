import type { ResourceType, SettlementSize } from '@/types/game';
import { RESOURCE_RARITY } from './constants';

// ============================================================
// Territory Types
// ============================================================

export type TerritoryType = 'Realm' | 'Neutral';

// ============================================================
// Roll Tables (from rules/08-territories-and-resources.md)
// ============================================================

// Common Resources (1d10)
// 1-3 Timber, 4-6 Clay, 7-8 Iron(Ore), 9 Stone, 10 Luxury*
function rollCommonResource(): ResourceType {
  const roll = Math.ceil(Math.random() * 10);
  if (roll <= 3) return 'Timber';
  if (roll <= 6) return 'Clay';
  if (roll <= 8) return 'Ore';
  if (roll === 9) return 'Stone';
  // 10 -> roll on luxury table
  return rollLuxuryResource();
}

function rollGuaranteedCommonResource(): ResourceType {
  let resourceType = rollCommonResource();

  while (RESOURCE_RARITY[resourceType] !== 'Common') {
    resourceType = rollCommonResource();
  }

  return resourceType;
}

// Luxury Resources (1d10)
// 1-2 Silver→Gold, 3-4 Porcelain, 5-6 Lacquer, 7 Jewels, 8 Cotton→Silk, 9 Marble, 10 Expanded*
function rollLuxuryResource(): ResourceType {
  const roll = Math.ceil(Math.random() * 10);
  if (roll <= 2) return 'Gold';
  if (roll <= 4) return 'Porcelain';
  if (roll <= 6) return 'Lacquer';
  if (roll === 7) return 'Jewels';
  if (roll === 8) return 'Silk';
  if (roll === 9) return 'Marble';
  // 10 -> expanded luxury
  return rollExpandedLuxury();
}

// Expanded Luxury (1d10)
// 1 Gold, 2 Spices, 3 Tea, 4 Coffee, 5 Tobacco, 6 Opium, 7 Silk, 8 Salt, 9 Sugar, 10 Roll Twice (pick first)
function rollExpandedLuxury(): ResourceType {
  const roll = Math.ceil(Math.random() * 10);
  if (roll === 1) return 'Gold';
  if (roll === 2) return 'Spices';
  if (roll === 3) return 'Tea';
  if (roll === 4) return 'Coffee';
  if (roll === 5) return 'Tobacco';
  if (roll === 6) return 'Opium';
  if (roll === 7) return 'Silk';
  if (roll === 8) return 'Salt';
  if (roll === 9) return 'Sugar';
  // 10 -> roll twice, pick first
  return rollLuxuryResource();
}

// ============================================================
// Settlement Generation (1d10)
// ============================================================

// 1-2 Nomad Camps (Village), 3-4 Tribal Village (Village),
// 5-6 Bandit Camp (Village), 7 Monastic Enclave (Village),
// 8-9 Trading Post (Town), 10 City State (City)

export interface GeneratedSettlement {
  name: string;
  size: SettlementSize;
  type: string;
}

function createRealmSettlement(index: number, size: SettlementSize): GeneratedSettlement {
  return {
    name: `Settlement ${index + 1}`,
    size,
    type: 'Realm Settlement',
  };
}

const SETTLEMENT_ROLL_TABLE: Array<{ type: string; size: SettlementSize; minRoll: number; maxRoll: number }> = [
  { type: 'Nomad Camp', size: 'Village', minRoll: 1, maxRoll: 2 },
  { type: 'Tribal Village', size: 'Village', minRoll: 3, maxRoll: 4 },
  { type: 'Bandit Camp', size: 'Village', minRoll: 5, maxRoll: 6 },
  { type: 'Monastic Enclave', size: 'Village', minRoll: 7, maxRoll: 7 },
  { type: 'Trading Post', size: 'Town', minRoll: 8, maxRoll: 9 },
  { type: 'City State', size: 'City', minRoll: 10, maxRoll: 10 },
];

function rollSettlement(): GeneratedSettlement {
  const roll = Math.ceil(Math.random() * 10);
  const entry = SETTLEMENT_ROLL_TABLE.find((e) => roll >= e.minRoll && roll <= e.maxRoll)!;
  return {
    name: entry.type,
    size: entry.size,
    type: entry.type,
  };
}

// ============================================================
// Resource Site Generation
// ============================================================

export interface GeneratedResource {
  resourceType: ResourceType;
  rarity: 'Common' | 'Luxury';
  settlement: GeneratedSettlement;
}

/**
 * Generate resources for a territory based on its type.
 *
 * Realm territories: 3 common rolls + 1 luxury roll
 * Neutral territories: 2 common rolls + 2 luxury rolls
 *
 * Each resource site gets a settlement (per rules).
 */
export function generateTerritoryResources(type: TerritoryType): GeneratedResource[] {
  const resources: GeneratedResource[] = [];

  if (type === 'Realm') {
    // 3 common + 1 luxury, with exactly one player-selected town.
    for (let i = 0; i < 3; i++) {
      const resourceType = rollGuaranteedCommonResource();
      resources.push({
        resourceType,
        rarity: RESOURCE_RARITY[resourceType],
        settlement: createRealmSettlement(i, i === 0 ? 'Town' : 'Village'),
      });
    }
    const luxuryType = rollLuxuryResource();
    resources.push({
      resourceType: luxuryType,
      rarity: RESOURCE_RARITY[luxuryType],
      settlement: createRealmSettlement(resources.length, 'Village'),
    });
  } else {
    // Neutral: 2 common + 2 luxury
    for (let i = 0; i < 2; i++) {
      const resourceType = rollGuaranteedCommonResource();
      resources.push({
        resourceType,
        rarity: RESOURCE_RARITY[resourceType],
        settlement: rollSettlement(),
      });
    }
    for (let i = 0; i < 2; i++) {
      const luxuryType = rollLuxuryResource();
      resources.push({
        resourceType: luxuryType,
        rarity: RESOURCE_RARITY[luxuryType],
        settlement: rollSettlement(),
      });
    }
  }

  return resources;
}

/**
 * Generate the full map: resources and settlements for all territories.
 */
export function generateMap(
  territories: Array<{ name: string; climate: string; description: string; type: TerritoryType }>
): Array<{ territoryIndex: number; resources: GeneratedResource[] }> {
  return territories.map((t, idx) => ({
    territoryIndex: idx,
    resources: generateTerritoryResources(t.type),
  }));
}
