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

export interface MapRealm {
  id: string;
  name: string;
  color: string;
}

export interface MapTerritory {
  id: string;
  name: string;
  realmId: string | null;
}

export interface MapHexFeature {
  featureType: MapFeatureType;
  name: string | null;
  riverIndex: number | null;
}

export interface MapHexLandmark {
  name: string;
  kind: string;
  description: string | null;
}

export interface MapHexSettlement {
  name: string;
  size: string;
  realmId: string | null;
}

export interface MapHexArmy {
  id: string;
  name: string;
  realmId: string;
}

export interface MapHexFleet {
  id: string;
  name: string;
  realmId: string;
}

export interface MapHexData {
  id: string;
  q: number;
  r: number;
  hexKind: MapHexKind;
  waterKind: WaterHexKind | null;
  terrainType: MapTerrainType | null;
  territoryId: string | null;
  features: MapHexFeature[];
  landmarks: MapHexLandmark[];
  settlement: MapHexSettlement | null;
  armies: MapHexArmy[];
  fleets: MapHexFleet[];
}

export interface GameMapData {
  mapName: string | null;
  realms: MapRealm[];
  territories: MapTerritory[];
  hexes: MapHexData[];
}

export interface HoveredHexData extends MapHexData {
  territoryName: string | null;
  realmName: string | null;
}
