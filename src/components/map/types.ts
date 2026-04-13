import type { MapFeatureType, MapHexKind, MapTerrainType, WaterHexKind } from '@/lib/maps/types';

export interface MapRealm {
  id: string;
  name: string;
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
