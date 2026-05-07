import type { MapHexKind, MapTerrainType, WaterHexKind } from '@/lib/maps/types';

export const TERRAIN_COLORS: Record<MapTerrainType | WaterHexKind, string> = {
  flat_grassland: '#9fbf68',
  flat_forest_deciduous_heavy: '#2f5f38',
  hills: '#b8a070',
  hills_forest_deciduous: '#6f8a4f',
  mountains_forest_deciduous: '#6f7565',
  flat_farmland: '#c8b870',
  flat_swamp: '#6a7a58',
  flat_desert_rocky: '#c59f61',
  flat_forest_deciduous: '#5a7a4a',
  mountains: '#8a8078',
  mountains_forest_jungle: '#4f6650',
  flat_desert_sandy: '#d4b868',
  hills_grassy: '#a6ad62',
  hills_forest_jungle: '#4e7644',
  flat_forest_jungle: '#3a6a3a',
  badlands: '#b07a58',
  sea: '#5a7a9a',
  lake: '#7a9ab0',
};

export interface TerrainFillHex {
  hexKind: MapHexKind;
  waterKind: WaterHexKind | null;
  terrainType: MapTerrainType | null;
}

export function terrainFill(hex: TerrainFillHex) {
  if (hex.hexKind === 'water') {
    return hex.waterKind === 'lake' ? TERRAIN_COLORS.lake : TERRAIN_COLORS.sea;
  }

  return hex.terrainType ? TERRAIN_COLORS[hex.terrainType] : TERRAIN_COLORS.flat_farmland;
}
