export type MapHexKind = 'land' | 'water';
export type WaterHexKind = 'sea' | 'lake';
export type MapTerrainType =
  | 'plains'
  | 'forest'
  | 'hills'
  | 'mountains'
  | 'desert'
  | 'swamp'
  | 'jungle'
  | 'tundra';
export type MapFeatureType = 'river' | 'volcano' | 'coast' | 'reef' | 'ford';

export interface HexCoordinate {
  q: number;
  r: number;
}

export interface CuratedMapFeatureDefinition {
  type: MapFeatureType;
  name?: string;
  metadata?: Record<string, unknown>;
}

export interface CuratedMapTerritoryDefinition {
  key: string;
  name: string;
  description?: string;
}

export interface CuratedMapSuggestedStart {
  territoryKey: string;
  hex: HexCoordinate;
}

export interface CuratedLandHexDefinition extends HexCoordinate {
  kind: 'land';
  terrainType: MapTerrainType;
  territoryKey: string;
  features?: CuratedMapFeatureDefinition[];
}

export interface CuratedWaterHexDefinition extends HexCoordinate {
  kind: 'water';
  waterKind: WaterHexKind;
  features?: CuratedMapFeatureDefinition[];
}

export type CuratedMapHexDefinition = CuratedLandHexDefinition | CuratedWaterHexDefinition;

export interface CuratedMapDefinition {
  key: string;
  name: string;
  version: number;
  territories: CuratedMapTerritoryDefinition[];
  hexes: CuratedMapHexDefinition[];
  suggestedStarts?: CuratedMapSuggestedStart[];
}
