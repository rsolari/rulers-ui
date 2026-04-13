// Seasons and Turn Phases
export type Season = 'Spring' | 'Summer' | 'Autumn' | 'Winter';
export type TurnPhase = 'Submission' | 'Resolution' | 'Complete';
export type GamePhase = 'Setup' | 'RealmCreation' | 'Active' | 'Completed';
export type GameInitState =
  | 'gm_world_setup'
  | 'player_invites_open'
  | 'parallel_final_setup'
  | 'ready_to_start'
  | 'active'
  | 'completed';
export type GMSetupState = 'pending' | 'configuring' | 'ready';
export type PlayerSetupState = 'unclaimed' | 'claimed' | 'realm_created' | 'ruler_created' | 'ready';

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
  | 'Coliseum' | 'College' | 'Dockyard' | 'Fort' | 'Gatehouse' | 'Gunsmith'
  | 'Port' | 'PowderMill' | 'Shipwrights' | 'SiegeWorkshop' | 'Stables'
  | 'Theatre' | 'University' | 'Walls' | 'Watchtower' | 'Weaponsmith';

export type FortificationMaterial = 'Timber' | 'Stone';
export type BuildingLocationType = 'settlement' | 'territory';
export type BuildingMaintenanceState = 'active' | 'suspended-unpaid';

// Resource Types
export type ResourceType =
  | 'Timber' | 'Clay' | 'Ore' | 'Stone'
  | 'Gold' | 'Lacquer' | 'Porcelain' | 'Jewels' | 'Marble' | 'Silk'
  | 'Spices' | 'Tea' | 'Coffee' | 'Tobacco' | 'Opium' | 'Salt' | 'Sugar';
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

// Naval Units
export type ShipType =
  | 'Galley'
  | 'WarGalley'
  | 'Galleass'
  | 'Cog'
  | 'Holk'
  | 'Carrack'
  | 'Galleon'
  | 'Caravel';
export type ShipClass = 'Light' | 'Heavy';
export type ShipQuality = 'Basic' | 'Elite';
export type ShipCondition = 'Ready' | 'Damaged' | 'Routed' | 'Sunk';
export type WaterZoneType = 'river' | 'coast' | 'ocean';

// Siege Unit Types
export type SiegeUnitType = 'Catapult' | 'Trebuchet' | 'Ballista' | 'BatteringRam' | 'Cannon';

// Tax Types
export type TaxType = 'Tribute' | 'Levy';

// Noble Details
export type Gender = 'Male' | 'Female';
export type AgeCategory = 'Infant' | 'Adolescent' | 'Adult' | 'Elderly';
export type EstateLevel = 'Meagre' | 'Comfortable' | 'Ample' | 'Substantial' | 'Luxurious';
export type GovernanceState =
  | 'stable'
  | 'interregnum'
  | 'surrogate_rule'
  | 'succession_pending_gm'
  | 'realm_fallen';
export type NobleTitleType =
  | 'settlement_governor'
  | 'army_general'
  | 'fleet_admiral'
  | 'gos_leader'
  | 'heir_designation'
  | 'honorary'
  | 'custom';
export type GovernanceEventType =
  | 'ruler_appointed'
  | 'heir_designated'
  | 'office_assigned'
  | 'office_removed'
  | 'title_granted'
  | 'title_revoked'
  | 'noble_captured'
  | 'noble_released'
  | 'noble_died'
  | 'succession_triggered'
  | 'succession_resolved'
  | 'succession_disputed'
  | 'acting_ruler_set'
  | 'realm_fell'
  | 'noble_grievance';

// GOS Types
export type GOSType = 'Guild' | 'Order' | 'Society';

export interface GOSMetadata {
  treasury: number;
  creationSource?: string | null;
  monopolyProduct?: ResourceType | null;
  alcoveNames?: string[] | null;
  centreNames?: string[] | null;
  firstBuildingId?: string | null;
}

// Turn Report Status
export type ReportStatus = 'draft' | 'submitted' | 'resolved';
export type ActionKind = 'political' | 'financial';
export type TurnActionStatus = 'draft' | 'submitted' | 'executed';
export type TurnActionOutcome = 'pending' | 'success' | 'failure' | 'partial' | 'void';
export type ActionAuthorRole = 'player' | 'gm';
export type TurnEventKind = 'gm_event' | 'turmoil_review' | 'winter_unrest';
export type TurnEventStatus = 'open' | 'resolved' | 'dismissed';

// Industry Quality
export type IndustryQuality = 'Basic' | 'HighQuality';
export type TradeRoutePathMode = 'land' | 'river' | 'sea' | 'mixed';
export type TechnicalKnowledgeKey = string;

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
  kind: 'food_shortage' | 'noble_grievance' | 'gos_unrest' | 'gm_event' | 'gm_manual';
  description: string;
  amount: number;
  durationType: 'permanent' | 'seasonal';
  seasonsRemaining?: number;
  originYear: number;
  originSeason: Season;
  linkedEntityType?: 'noble' | 'gos' | 'event' | 'settlement';
  linkedEntityId?: string;
  autoGenerated: boolean;
  notes?: string | null;
}

export interface WinterUnrestLocationOption {
  settlementId: string;
  settlementName: string;
  territoryId: string;
  territoryName: string;
}

export interface WinterUnrestPayload {
  realmId: string;
  turmoil: number;
  turmoilSources: TurmoilSource[];
  unrestKind: 'protest' | 'riot' | 'revolt';
  locationOptions: WinterUnrestLocationOption[];
  selectedSettlementId?: string | null;
  gmNotes?: string | null;
  manualSources?: TurmoilSource[];
}

export interface TurmoilReviewPayload {
  realmId: string;
  projectedTurmoil: number;
  buildingReduction: number;
  turmoilBreakdown: TurmoilSource[];
  gmNotes?: string | null;
  manualSources?: TurmoilSource[];
}

export interface EconomicModifierInput {
  id?: string;
  description?: string;
  treasuryDelta?: number;
  foodProducedDelta?: number;
  foodNeededDelta?: number;
  grantedTechnicalKnowledge?: TechnicalKnowledgeKey[];
  turmoilSources?: TurmoilSource[];
}

// Political Action in Turn Report
export interface PoliticalAction {
  actionWords: ActionWord[];
  description: string;
  targetRealmId?: string;
  assignedNobleId?: string;
  triggerCondition?: string;
}

// Financial Actions in Turn Report
export interface BuildFinancialAction {
  type: 'build';
  buildingType: BuildingType;
  settlementId?: string | null;
  territoryId?: string | null;
  material?: FortificationMaterial | null;
  wallSize?: BuildingSize | null;
  ownerGosId?: string | null;
  allottedGosId?: string | null;
  locationType?: BuildingLocationType;
  buildingSize?: BuildingSize;
  takesBuildingSlot?: boolean;
  constructionTurns?: number;
  technicalKnowledgeKey?: TechnicalKnowledgeKey;
  description?: string;
  cost?: number;
}

export interface RecruitFinancialAction {
  type: 'recruit';
  troopType: TroopType;
  settlementId?: string | null;
  technicalKnowledgeKey?: TechnicalKnowledgeKey;
  description?: string;
  cost?: number;
}

export interface ConstructShipFinancialAction {
  type: 'constructShip';
  shipType: ShipType;
  settlementId?: string | null;
  fleetId?: string | null;
  technicalKnowledgeKey?: TechnicalKnowledgeKey;
  description?: string;
  cost?: number;
}

export interface TaxChangeFinancialAction {
  type: 'taxChange';
  taxType: TaxType;
  description?: string;
  cost?: number;
}

export interface SpendingFinancialAction {
  type: 'spending';
  description?: string;
  cost: number;
}

export type FinancialAction =
  | BuildFinancialAction
  | RecruitFinancialAction
  | ConstructShipFinancialAction
  | TaxChangeFinancialAction
  | SpendingFinancialAction;

export interface ActionCommentRecord {
  id: string;
  actionId: string;
  authorRole: ActionAuthorRole;
  authorLabel: string;
  body: string;
  createdAt: string | null;
}

export interface TurnActionRecord {
  id: string;
  turnReportId: string;
  gameId: string;
  realmId: string;
  year: number;
  season: Season;
  kind: ActionKind;
  status: TurnActionStatus;
  outcome: TurnActionOutcome;
  sortOrder: number;
  description: string;
  actionWords: ActionWord[];
  targetRealmId: string | null;
  assignedNobleId: string | null;
  triggerCondition: string | null;
  financialType: FinancialAction['type'] | null;
  buildingType: BuildingType | null;
  troopType: TroopType | null;
  shipType: ShipType | null;
  fleetId: string | null;
  settlementId: string | null;
  territoryId: string | null;
  material: FortificationMaterial | null;
  wallSize: BuildingSize | null;
  ownerGosId: string | null;
  allottedGosId: string | null;
  locationType: BuildingLocationType | null;
  buildingSize: BuildingSize | null;
  takesBuildingSlot: boolean | null;
  constructionTurns: number | null;
  taxType: TaxType | null;
  technicalKnowledgeKey: TechnicalKnowledgeKey | null;
  cost: number;
  resolutionSummary: string | null;
  submittedAt: string | null;
  submittedBy: string | null;
  executedAt: string | null;
  executedBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  comments: ActionCommentRecord[];
}

export interface TurnReportRecord {
  id: string;
  gameId: string;
  realmId: string;
  year: number;
  season: Season;
  status: ReportStatus;
  gmNotes: string | null;
}

export interface TurnReportBundle {
  realmId: string;
  realmName: string;
  report: TurnReportRecord | null;
  actions: TurnActionRecord[];
}

export type TurnHistoryEntry = TurnReportBundle;

export interface CurrentTurnResponseDto {
  game: {
    id: string;
    currentYear: number;
    currentSeason: Season;
    turnPhase: TurnPhase;
  };
  realm?: TurnReportBundle;
  realms?: TurnReportBundle[];
}

export interface TurnActionCreateDto {
  kind: ActionKind;
  description?: string;
  actionWords?: ActionWord[];
  targetRealmId?: string | null;
  assignedNobleId?: string | null;
  triggerCondition?: string | null;
  financialType?: FinancialAction['type'];
  buildingType?: BuildingType | null;
  troopType?: TroopType | null;
  shipType?: ShipType | null;
  fleetId?: string | null;
  settlementId?: string | null;
  territoryId?: string | null;
  material?: FortificationMaterial | null;
  wallSize?: BuildingSize | null;
  ownerGosId?: string | null;
  allottedGosId?: string | null;
  locationType?: BuildingLocationType | null;
  buildingSize?: BuildingSize | null;
  takesBuildingSlot?: boolean | null;
  constructionTurns?: number | null;
  taxType?: TaxType | null;
  technicalKnowledgeKey?: TechnicalKnowledgeKey | null;
  cost?: number;
}

export interface TurnActionUpdateDto {
  description?: string;
  actionWords?: ActionWord[];
  targetRealmId?: string | null;
  assignedNobleId?: string | null;
  triggerCondition?: string | null;
  financialType?: FinancialAction['type'];
  buildingType?: BuildingType | null;
  troopType?: TroopType | null;
  shipType?: ShipType | null;
  fleetId?: string | null;
  settlementId?: string | null;
  territoryId?: string | null;
  material?: FortificationMaterial | null;
  wallSize?: BuildingSize | null;
  ownerGosId?: string | null;
  allottedGosId?: string | null;
  locationType?: BuildingLocationType | null;
  buildingSize?: BuildingSize | null;
  takesBuildingSlot?: boolean | null;
  constructionTurns?: number | null;
  taxType?: TaxType | null;
  technicalKnowledgeKey?: TechnicalKnowledgeKey | null;
  cost?: number;
  outcome?: TurnActionOutcome;
  resolutionSummary?: string | null;
  status?: TurnActionStatus;
}

export interface TurnSubmitResponseDto {
  report: TurnReportRecord;
  actions: TurnActionRecord[];
}

export interface ActionCommentCreateDto {
  body: string;
}

export interface TurnHistoryResponseDto {
  history: TurnHistoryEntry[];
}

// Protected Product in Trade
export interface ProtectedProduct {
  resourceType: ResourceType;
  expirySeason: Season;
  expiryYear: number;
}

export interface TradeImportSelection {
  importingRealmId: string;
  resourceType: ResourceType;
  chosenExporterRealmId: string;
  expirySeason: Season;
  expiryYear: number;
}
