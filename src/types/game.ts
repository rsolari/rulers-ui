// Seasons and Turn Phases
export type Season = 'Spring' | 'Summer' | 'Autumn' | 'Winter';
export type TurnPhase = 'Submission' | 'Resolution' | 'Complete';

// Government Types
export type GovernmentType = 'Monarch' | 'ElectedMonarch' | 'Council' | 'Ecclesiastical' | 'Consortium' | 'Magistrate' | 'Warlord';

// Traditions
export type Tradition =
  | 'Academic' | 'Diplomatic' | 'Sporting' | 'Outrider' | 'Pious'
  | 'Mercantile' | 'Artisanal' | 'BornInTheSaddle' | 'Architectural'
  | 'MastersOfVillainy' | 'Pathfinder' | 'Militaristic'
  | 'HordeTactics' | 'Chivalric' | 'TheImmortals' | 'EncouragedLabour';

// Settlement Sizes
export type SettlementSize = 'Village' | 'Town' | 'City';

// Building Types and Categories
export type BuildingCategory = 'Civic' | 'Industrial' | 'Military' | 'Fortification';
export type BuildingSize = 'Tiny' | 'Small' | 'Medium' | 'Large' | 'Colossal';
export type BuildingType =
  | 'Academy' | 'Armoursmith' | 'Bank' | 'BrickMakers' | 'Bowyer'
  | 'CannonFoundry' | 'Castle' | 'Cathedral' | 'Chapel' | 'Church'
  | 'Coliseum' | 'College' | 'Fort' | 'Gatehouse' | 'Gunsmith'
  | 'Port' | 'SiegeWorkshop' | 'Stables' | 'Theatre' | 'University'
  | 'Walls' | 'Watchtower' | 'Weaponsmith';

export type FortificationMaterial = 'Timber' | 'Stone';

// Resource Types
export type ResourceType =
  | 'Timber' | 'Clay' | 'Ore' | 'Stone'
  | 'Gold' | 'Lacquer' | 'Porcelain' | 'Jewels' | 'Marble' | 'Silk';
export type ResourceRarity = 'Common' | 'Luxury';

// Troop Types
export type TroopType =
  | 'Spearmen' | 'Archers' | 'Shieldbearers' | 'Berserkers'
  | 'Crossbowmen' | 'Harquebusiers' | 'LightCavalry'
  | 'Pikemen' | 'Swordsmen' | 'Fusiliers' | 'Cavalry'
  | 'MountedArchers' | 'Dragoons';
export type TroopClass = 'Basic' | 'Elite';
export type ArmourType = 'Light' | 'Armoured' | 'Mounted';
export type TroopCondition = 'Healthy' | 'Wounded1' | 'Wounded2' | 'Routed1' | 'Routed2' | 'Defeated' | 'Crushed';

// Siege Unit Types
export type SiegeUnitType = 'Catapult' | 'Trebuchet' | 'Ballista' | 'BatteringRam' | 'Cannon';

// Tax Types
export type TaxType = 'Tribute' | 'Levy';

// Noble Details
export type Gender = 'Male' | 'Female';
export type AgeCategory = 'Infant' | 'Adolescent' | 'Adult' | 'Elderly';
export type EstateLevel = 'Meagre' | 'Comfortable' | 'Ample' | 'Substantial' | 'Luxurious';

// GOS Types
export type GOSType = 'Guild' | 'Order' | 'Society';

// Turn Report Status
export type ReportStatus = 'Draft' | 'Submitted' | 'Resolved';

// Industry Quality
export type IndustryQuality = 'Basic' | 'HighQuality';

// Action Words (all 35)
export const ACTION_WORDS = [
  'Accuse', 'Arrange', 'Attack', 'Ban', 'Begin', 'Capture', 'Close',
  'Condemn', 'Convert', 'Declare', 'Defend', 'Deliver', 'Discuss',
  'Draft', 'End', 'Expel', 'Explore', 'Give', 'Guard', 'Hold',
  'Imprison', 'Intercept', 'Investigate', 'Invite', 'Move', 'Negotiate',
  'Offer', 'Open', 'Pardon', 'Propose', 'Remove', 'Request', 'Search',
  'Send', 'Take',
] as const;
export type ActionWord = (typeof ACTION_WORDS)[number];

// Turmoil Source Tracking
export interface TurmoilSource {
  id: string;
  description: string;
  amount: number;
  durationType: 'permanent' | 'seasonal';
  seasonsRemaining?: number;
}

// Political Action in Turn Report
export interface PoliticalAction {
  actionWords: ActionWord[];
  description: string;
  targetRealmId?: string;
  assignedNobleId?: string;
  triggerCondition?: string;
}

// Financial Action in Turn Report
export interface FinancialAction {
  type: 'build' | 'recruit' | 'taxChange' | 'spending';
  buildingType?: BuildingType;
  troopType?: TroopType;
  settlementId?: string;
  taxType?: TaxType;
  description?: string;
  cost: number;
}

// Protected Product in Trade
export interface ProtectedProduct {
  resourceType: ResourceType;
  expirySeason: Season;
  expiryYear: number;
}
