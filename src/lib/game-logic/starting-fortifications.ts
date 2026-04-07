import { BUILDING_DEFS } from '@/lib/game-logic/constants';
import type { BuildingType, FortificationMaterial, SettlementSize } from '@/types/game';

const STARTING_FORTIFICATION_TYPES: BuildingType[] = ['Walls', 'Gatehouse'];

const STARTING_FORTIFICATION_MATERIAL_BY_SIZE: Partial<Record<SettlementSize, FortificationMaterial>> = {
  Town: 'Timber',
  City: 'Stone',
};

export function getStartingSettlementFortifications(size: SettlementSize) {
  const material = STARTING_FORTIFICATION_MATERIAL_BY_SIZE[size];

  if (!material) {
    return [];
  }

  return STARTING_FORTIFICATION_TYPES.map((type) => {
    const def = BUILDING_DEFS[type];

    return {
      type,
      category: def.category,
      size: def.size,
      material,
      takesBuildingSlot: def.takesBuildingSlot ?? true,
    };
  });
}
