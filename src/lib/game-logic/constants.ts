import type {
  BuildingType, BuildingCategory, BuildingSize, TroopType, TroopClass,
  ArmourType, SiegeUnitType, SettlementSize, ResourceType, ResourceRarity,
  TaxType, EstateLevel, GOSType, Tradition, Season, ShipClass, ShipCondition,
  ShipQuality, ShipType, WaterZoneType,
} from '@/types/game';

// --- Building Size Costs ---

export const BUILDING_SIZE_DATA: Record<BuildingSize, {
  buildTime: number;
  buildCost: number;
  maintenance: number;
}> = {
  Tiny:     { buildTime: 1, buildCost: 375,  maintenance: 250 },
  Small:    { buildTime: 2, buildCost: 750,  maintenance: 500 },
  Medium:   { buildTime: 3, buildCost: 1500, maintenance: 1000 },
  Large:    { buildTime: 4, buildCost: 3000, maintenance: 2000 },
  Colossal: { buildTime: 6, buildCost: 6000, maintenance: 4000 },
};

// --- Building Definitions ---

export interface BuildingDef {
  type: BuildingType;
  category: BuildingCategory;
  size: BuildingSize;
  prerequisites: string[];
  takesBuildingSlot?: boolean;
  turmoilEffect?: number;
  description: string;
}

export const BUILDING_DEFS: Record<BuildingType, BuildingDef> = {
  Academy:       { type: 'Academy',       category: 'Civic',         size: 'Small',  prerequisites: ['Society'],                        description: 'Increases income of Society. Provides education.' },
  Armoursmith:   { type: 'Armoursmith',   category: 'Military',      size: 'Medium', prerequisites: [],                                  description: 'Allows recruitment of Armoured Troops.' },
  Bank:          { type: 'Bank',          category: 'Civic',         size: 'Medium', prerequisites: ['Guild'],                           description: 'Allows Ruler to borrow money.' },
  BrickMakers:   { type: 'BrickMakers',   category: 'Industrial',    size: 'Medium', prerequisites: ['Clay'],                            description: 'Provides Bricks to substitute Stone.' },
  Bowyer:        { type: 'Bowyer',        category: 'Military',      size: 'Small',  prerequisites: ['Timber'],                          description: 'Allows recruitment of Crossbowmen.' },
  CannonFoundry: { type: 'CannonFoundry', category: 'Military',      size: 'Large',  prerequisites: ['Ore', 'TechnicalKnowledge'],       description: 'Allows construction of Cannons.' },
  Castle:        { type: 'Castle',        category: 'Fortification', size: 'Large',  prerequisites: ['Stone'],                           description: 'Formidable defensive fortification.' },
  Cathedral:     { type: 'Cathedral',     category: 'Civic',         size: 'Large',  prerequisites: ['Order'],           turmoilEffect: -3, description: 'Powerful religious building. Turmoil -3.' },
  Chapel:        { type: 'Chapel',        category: 'Civic',         size: 'Small',  prerequisites: ['Order'],           turmoilEffect: -1, description: 'Small place of worship. Turmoil -1.' },
  Church:        { type: 'Church',        category: 'Civic',         size: 'Medium', prerequisites: ['Order'],           turmoilEffect: -2, description: 'Place of worship. Turmoil -2.' },
  Coliseum:      { type: 'Coliseum',      category: 'Civic',         size: 'Large',  prerequisites: [],                  turmoilEffect: -4, description: 'Allows hosting sporting events. Turmoil -4.' },
  College:       { type: 'College',       category: 'Civic',         size: 'Medium', prerequisites: ['Society'],                          description: 'Increases income of Society. Allows advanced study.' },
  Dockyard:      { type: 'Dockyard',      category: 'Military',      size: 'Large',  prerequisites: ['Port', 'Timber'],                  description: 'Allows construction of capital ships.' },
  Fort:          { type: 'Fort',          category: 'Fortification', size: 'Medium', prerequisites: ['Timber'],                           description: 'Wooden defensive fortification.' },
  Gatehouse:     { type: 'Gatehouse',     category: 'Fortification', size: 'Small',  prerequisites: ['Timber|Stone'], takesBuildingSlot: false, description: 'Fortified gateway for walls.' },
  Gunsmith:      { type: 'Gunsmith',      category: 'Military',      size: 'Small',  prerequisites: ['Ore', 'TechnicalKnowledge'],       description: 'Allows recruitment of Harquebusiers.' },
  Port:          { type: 'Port',          category: 'Civic',         size: 'Medium', prerequisites: [],                                  description: 'Allows Trade Routes over water.' },
  PowderMill:    { type: 'PowderMill',    category: 'Military',      size: 'Medium', prerequisites: ['Ore', 'TechnicalKnowledge'],       description: 'Allows construction of powder-based ships.' },
  Shipwrights:   { type: 'Shipwrights',   category: 'Military',      size: 'Large',  prerequisites: ['Timber'],                          description: 'Allows advanced ship construction.' },
  SiegeWorkshop: { type: 'SiegeWorkshop', category: 'Military',      size: 'Large',  prerequisites: ['Timber'],                          description: 'Allows construction of Siege Weapons.' },
  Stables:       { type: 'Stables',       category: 'Military',      size: 'Medium', prerequisites: ['Food'],                            description: 'Allows recruitment of Cavalry.' },
  Theatre:       { type: 'Theatre',       category: 'Civic',         size: 'Medium', prerequisites: [],                  turmoilEffect: -2, description: 'Entertainment. Turmoil -2.' },
  University:    { type: 'University',    category: 'Civic',         size: 'Medium', prerequisites: ['Society'],                          description: 'Powerful academic building.' },
  Walls:         { type: 'Walls',         category: 'Fortification', size: 'Small',  prerequisites: ['Timber|Stone'], takesBuildingSlot: false, description: 'Defensive walls around a Settlement.' },
  Watchtower:    { type: 'Watchtower',    category: 'Fortification', size: 'Small',  prerequisites: ['Timber|Stone'], takesBuildingSlot: false, description: 'Observation and signaling tower.' },
  Weaponsmith:   { type: 'Weaponsmith',   category: 'Military',      size: 'Medium', prerequisites: ['Ore'],                              description: 'Allows recruitment of certain Troops.' },
};

const BUILDING_SIZE_ORDER: BuildingSize[] = ['Tiny', 'Small', 'Medium', 'Large', 'Colossal'];

export const BUILDING_UPGRADE_PATHS: Partial<Record<BuildingType, BuildingType[]>> = {
  Academy: ['College', 'University'],
  Chapel: ['Church', 'Cathedral'],
  Church: ['Cathedral'],
  Fort: ['Castle'],
};

export function getEligibleBuildingUpgradeTargets(
  buildingType: BuildingType,
  currentSize: BuildingSize = BUILDING_DEFS[buildingType].size,
) {
  const currentRank = BUILDING_SIZE_ORDER.indexOf(currentSize);
  return (BUILDING_UPGRADE_PATHS[buildingType] ?? []).filter((targetType) => (
    BUILDING_SIZE_ORDER.indexOf(BUILDING_DEFS[targetType].size) > currentRank
  ));
}

// --- Troop Definitions ---

export interface TroopDef {
  type: TroopType;
  class: TroopClass;
  armourTypes: ArmourType[];
  requires: BuildingType[];
  upkeep: number;
  bonus: string;
  combatBonuses: CombatBonus[];
}

export type CombatBonusTarget =
  | 'Light'
  | 'Armoured'
  | 'Mounted'
  | 'Troops'
  | 'Walls'
  | 'Buildings'
  | 'Gates';

export interface CombatBonus {
  target: CombatBonusTarget;
  value: number;
}

export type NavalCombatBonusTarget = 'Light' | 'Heavy' | 'CoastalZone' | 'OpenSea';

export interface NavalCombatBonus {
  target: NavalCombatBonusTarget;
  value: number;
}

export const TROOP_DEFS: Record<TroopType, TroopDef> = {
  Spearmen:      { type: 'Spearmen',      class: 'Basic', armourTypes: ['Light'],               requires: [],                                upkeep: 250,  bonus: '+1 vs Cavalry',               combatBonuses: [{ target: 'Mounted', value: 1 }] },
  Archers:       { type: 'Archers',       class: 'Basic', armourTypes: ['Light'],               requires: [],                                upkeep: 250,  bonus: '+2 vs Light',                 combatBonuses: [{ target: 'Light', value: 2 }] },
  Shieldbearers: { type: 'Shieldbearers', class: 'Basic', armourTypes: ['Light'],               requires: ['Armoursmith'],                   upkeep: 500,  bonus: '+1 vs Cavalry / +1 vs Light', combatBonuses: [{ target: 'Mounted', value: 1 }, { target: 'Light', value: 1 }] },
  Berserkers:    { type: 'Berserkers',    class: 'Basic', armourTypes: ['Light'],               requires: ['Weaponsmith'],                   upkeep: 500,  bonus: '+2 vs Light',                 combatBonuses: [{ target: 'Light', value: 2 }] },
  Crossbowmen:   { type: 'Crossbowmen',   class: 'Basic', armourTypes: ['Light'],               requires: ['Bowyer'],                        upkeep: 250,  bonus: '+1 vs Armoured',              combatBonuses: [{ target: 'Armoured', value: 1 }] },
  Harquebusiers: { type: 'Harquebusiers', class: 'Basic', armourTypes: ['Light'],               requires: ['Gunsmith'],                      upkeep: 250,  bonus: '+2 vs Armoured',              combatBonuses: [{ target: 'Armoured', value: 2 }] },
  LightCavalry:  { type: 'LightCavalry',  class: 'Basic', armourTypes: ['Light', 'Mounted'],    requires: ['Stables'],                       upkeep: 750,  bonus: '+2 vs Light',                 combatBonuses: [{ target: 'Light', value: 2 }] },
  Pikemen:       { type: 'Pikemen',       class: 'Elite', armourTypes: ['Armoured'],            requires: ['Armoursmith'],                   upkeep: 750,  bonus: '+2 vs Cavalry',               combatBonuses: [{ target: 'Mounted', value: 2 }] },
  Swordsmen:     { type: 'Swordsmen',     class: 'Elite', armourTypes: ['Armoured'],            requires: ['Armoursmith', 'Weaponsmith'],    upkeep: 750,  bonus: '+2 vs Light',                 combatBonuses: [{ target: 'Light', value: 2 }] },
  Fusiliers:     { type: 'Fusiliers',     class: 'Elite', armourTypes: ['Light'],               requires: ['Gunsmith'],                      upkeep: 500,  bonus: '+2 vs Armoured',              combatBonuses: [{ target: 'Armoured', value: 2 }] },
  Cavalry:       { type: 'Cavalry',       class: 'Elite', armourTypes: ['Armoured', 'Mounted'], requires: ['Armoursmith', 'Weaponsmith', 'Stables'], upkeep: 1000, bonus: '+2 vs Light',                 combatBonuses: [{ target: 'Light', value: 2 }] },
  MountedArchers:{ type: 'MountedArchers',class: 'Elite', armourTypes: ['Light', 'Mounted'],    requires: ['Stables'],                       upkeep: 750,  bonus: '+2 vs Light',                 combatBonuses: [{ target: 'Light', value: 2 }] },
  Dragoons:      { type: 'Dragoons',      class: 'Elite', armourTypes: ['Light', 'Mounted'],    requires: ['Gunsmith', 'Stables'],           upkeep: 750,  bonus: '+2 vs Armoured',              combatBonuses: [{ target: 'Armoured', value: 2 }] },
};

// --- Siege Unit Definitions ---

export interface SiegeUnitDef {
  type: SiegeUnitType;
  requires: BuildingType;
  upkeep: number;
  constructionTurns: number;
  bonus: string;
  combatBonuses: CombatBonus[];
}

export const SIEGE_UNIT_DEFS: Record<SiegeUnitType, SiegeUnitDef> = {
  Catapult:     { type: 'Catapult',     requires: 'SiegeWorkshop',  upkeep: 750,  constructionTurns: 2, bonus: '+2 vs Walls',     combatBonuses: [{ target: 'Walls', value: 2 }] },
  Trebuchet:    { type: 'Trebuchet',    requires: 'SiegeWorkshop',  upkeep: 1250, constructionTurns: 3, bonus: '+2 vs Buildings', combatBonuses: [{ target: 'Walls', value: 2 }, { target: 'Buildings', value: 2 }] },
  Ballista:     { type: 'Ballista',     requires: 'SiegeWorkshop',  upkeep: 750,  constructionTurns: 2, bonus: '+4 vs Troops',    combatBonuses: [{ target: 'Troops', value: 4 }] },
  BatteringRam: { type: 'BatteringRam', requires: 'SiegeWorkshop',  upkeep: 500,  constructionTurns: 1, bonus: '+4 vs Gates',     combatBonuses: [{ target: 'Gates', value: 4 }] },
  Cannon:       { type: 'Cannon',       requires: 'CannonFoundry',  upkeep: 1500, constructionTurns: 3, bonus: '+2 vs Walls',     combatBonuses: [{ target: 'Walls', value: 2 }] },
};

// --- Naval Unit Definitions ---

export interface ShipDef {
  type: ShipType;
  class: ShipClass;
  quality: ShipQuality;
  condition: ShipCondition;
  requires: BuildingType[];
  buildCost: number;
  upkeep: number;
  buildTime: number;
  bonus: string;
  combatBonuses: NavalCombatBonus[];
  minimumWeather: number;
  supportedZones: WaterZoneType[];
  technicalKnowledgeKey?: ShipType;
}

export const SHIP_DEFS: Record<ShipType, ShipDef> = {
  Galley: {
    type: 'Galley',
    class: 'Light',
    quality: 'Basic',
    condition: 'Ready',
    requires: ['Port'],
    buildCost: 250,
    upkeep: 250,
    buildTime: 1,
    bonus: '+1 in Coastal Zones',
    combatBonuses: [{ target: 'CoastalZone', value: 1 }],
    minimumWeather: 5,
    supportedZones: ['river', 'coast'],
  },
  WarGalley: {
    type: 'WarGalley',
    class: 'Heavy',
    quality: 'Elite',
    condition: 'Ready',
    requires: ['Port', 'CannonFoundry'],
    buildCost: 500,
    upkeep: 500,
    buildTime: 1,
    bonus: '+1 in Coastal Zones',
    combatBonuses: [{ target: 'CoastalZone', value: 1 }],
    minimumWeather: 5,
    supportedZones: ['coast'],
  },
  Galleass: {
    type: 'Galleass',
    class: 'Heavy',
    quality: 'Elite',
    condition: 'Ready',
    requires: ['Port', 'CannonFoundry'],
    buildCost: 1000,
    upkeep: 1000,
    buildTime: 2,
    bonus: '+1 in Coastal Zones, +1 vs Light',
    combatBonuses: [{ target: 'CoastalZone', value: 1 }, { target: 'Light', value: 1 }],
    minimumWeather: 5,
    supportedZones: ['coast'],
  },
  Cog: {
    type: 'Cog',
    class: 'Heavy',
    quality: 'Basic',
    condition: 'Ready',
    requires: ['Port'],
    buildCost: 200,
    upkeep: 100,
    buildTime: 1,
    bonus: '-',
    combatBonuses: [],
    minimumWeather: 3,
    supportedZones: ['coast'],
  },
  Holk: {
    type: 'Holk',
    class: 'Heavy',
    quality: 'Basic',
    condition: 'Ready',
    requires: ['Port', 'PowderMill'],
    buildCost: 1000,
    upkeep: 500,
    buildTime: 2,
    bonus: '+1 vs Light',
    combatBonuses: [{ target: 'Light', value: 1 }],
    minimumWeather: 3,
    supportedZones: ['coast'],
  },
  Carrack: {
    type: 'Carrack',
    class: 'Heavy',
    quality: 'Elite',
    condition: 'Ready',
    requires: ['Port', 'Shipwrights', 'CannonFoundry'],
    buildCost: 1500,
    upkeep: 750,
    buildTime: 2,
    bonus: '+1 vs Light',
    combatBonuses: [{ target: 'Light', value: 1 }],
    minimumWeather: 2,
    supportedZones: ['coast', 'ocean'],
  },
  Galleon: {
    type: 'Galleon',
    class: 'Heavy',
    quality: 'Elite',
    condition: 'Ready',
    requires: ['Port', 'Shipwrights', 'Dockyard', 'CannonFoundry'],
    buildCost: 2000,
    upkeep: 1000,
    buildTime: 3,
    bonus: '+2 vs Light',
    combatBonuses: [{ target: 'Light', value: 2 }],
    minimumWeather: 2,
    supportedZones: ['coast', 'ocean'],
  },
  Caravel: {
    type: 'Caravel',
    class: 'Light',
    quality: 'Basic',
    condition: 'Ready',
    requires: ['Port', 'Shipwrights', 'CannonFoundry'],
    buildCost: 1500,
    upkeep: 750,
    buildTime: 2,
    bonus: '+1 in Open Seas',
    combatBonuses: [{ target: 'OpenSea', value: 1 }],
    minimumWeather: 3,
    supportedZones: ['river', 'coast', 'ocean'],
  },
};

// --- Settlement Data ---

export const SETTLEMENT_DATA: Record<SettlementSize, {
  buildingSlots: number;
  foodNeed: number;
  maxTroops: number;
  recruitPerSeason: number;
}> = {
  Village: { buildingSlots: 4, foodNeed: 1, maxTroops: 6,  recruitPerSeason: 4 },
  Town:    { buildingSlots: 6, foodNeed: 2, maxTroops: 10, recruitPerSeason: 6 },
  City:    { buildingSlots: 8, foodNeed: 4, maxTroops: 20, recruitPerSeason: 8 },
};

// Food need for standalone fortifications
export const FORTIFICATION_FOOD_NEED: Record<string, number> = {
  Fort: 1,
  Castle: 2,
};

// Territory food production cap (before bonuses)
export const TERRITORY_FOOD_CAP = 30;

// Wealth per food produced
export const FOOD_WEALTH = 2000;

// --- Resource Wealth ---

export const RESOURCE_BASE_WEALTH: Record<ResourceRarity, number> = {
  Common: 10000,
  Luxury: 15000,
};

export const MAX_PRODUCT_INGREDIENTS = 3;

export const LUXURY_INGREDIENT_WEALTH_BONUS: Record<ResourceRarity, number> = {
  Common: 5000,
  Luxury: 10000,
};

// Common resources that can combine with luxuries
export const COMMON_LUXURY_COMBINATIONS: Record<string, ResourceType[]> = {
  Ore:    ['Gold', 'Jewels'],
  Timber: ['Gold', 'Lacquer', 'Jewels'],
  Clay:   ['Gold', 'Jewels'],
  Stone:  ['Gold', 'Jewels'],
};

export const LUXURY_RESOURCE_CAN_BE_BASE_MATERIAL: Partial<Record<ResourceType, boolean>> = {
  Gold: true,
  Lacquer: false,
  Porcelain: true,
  Jewels: false,
  Marble: true,
  Silk: true,
};

// Luxury resource dependencies (need these for full value)
export const LUXURY_DEPENDENCIES: Record<string, ResourceType[] | null> = {
  Gold:      null,       // base material, no dependency
  Lacquer:   ['Timber'], // needs Timber
  Porcelain: null,       // base material
  Jewels:    ['Gold', 'Lacquer', 'Porcelain'], // needs one of these
  Marble:    null,       // base material
  Silk:      null,       // base material
  Spices:    null,
  Tea:       null,
  Coffee:    null,
  Tobacco:   null,
  Opium:     null,
  Salt:      null,
  Sugar:     null,
};

export const RESOURCE_RARITY: Record<ResourceType, ResourceRarity> = {
  Timber: 'Common', Clay: 'Common', Ore: 'Common', Stone: 'Common',
  Gold: 'Luxury', Lacquer: 'Luxury', Porcelain: 'Luxury',
  Jewels: 'Luxury', Marble: 'Luxury', Silk: 'Luxury',
  Spices: 'Luxury', Tea: 'Luxury', Coffee: 'Luxury', Tobacco: 'Luxury',
  Opium: 'Luxury', Salt: 'Luxury', Sugar: 'Luxury',
};

// --- Tax Rates and Turmoil ---

export const TAX_RATES: Record<TaxType, number> = {
  Tribute: 0.15,
  Levy: 0.30,
};

export const TAX_TURMOIL: Record<TaxType, number> = {
  Tribute: 0,
  Levy: 10,
};

// --- Estate Costs ---

export const ESTATE_COSTS: Record<EstateLevel, number> = {
  Meagre:      125,
  Comfortable: 250,
  Ample:       500,
  Substantial: 1000,
  Luxurious:   2000,
};

// --- Trade Constants ---

export const TRADE_BONUS_PER_PRODUCT = 0.05;     // 5% per product exported
export const MERCANTILE_TRADE_BONUS = 0.10;       // additional 10%
export const TRADED_RESOURCE_SURCHARGE = 0.25;    // 25% extra cost
export const TRADE_PROTECTION_SEASONS = 2;
export const TRADE_ROUTE_CLOSE_TURMOIL = 1;

// Quality tiers for price competition (1-8, higher wins)
export const QUALITY_TIERS = {
  'Basic': 1,
  'HighQuality': 2,
  'Basic+1': 3,
  'HighQuality+1': 4,
  'Basic+2': 5,
  'HighQuality+2': 6,
  'Basic+3': 7,
  'HighQuality+3': 8,
} as const;

// --- GOS Income ---

export const GUILD_INCOME: Record<string, number> = {
  Common: 1200,
  Luxury: 1500,
  Food: 200, // per food produced
};

export const ORDER_INCOME: Record<BuildingSize, number> = {
  Tiny: 125, Small: 250, Medium: 500, Large: 1000, Colossal: 2000,
};

export const SOCIETY_INCOME: Record<BuildingSize, number> = {
  Tiny: 100, Small: 200, Medium: 400, Large: 800, Colossal: 1600,
};

// --- Fortification Defence Ratings ---

export const FORTIFICATION_DEFENCE: Record<string, number> = {
  'Wooden Walls': 2, 'Wooden Gatehouse': 4, 'Wooden Watchtower': 3,
  'Stone Walls': 4, 'Stone Gatehouse': 6, 'Stone Watchtower': 5,
  'Fort': 6, 'Castle': 8,
};

// --- Noble Personality Generation Tables ---

export const PERSONALITY_TABLE = [
  'Quiet and Thoughtful', 'Nervous and Pensive', 'Headstrong and Reckless',
  'Intelligent and Subtle', 'Deceitful and Sly', 'Stoic and Reserved',
  'Stubborn and Arrogant', 'Frantic and Obsessive', 'Confident and Charismatic',
  'Jovial and Friendly',
];

export const RELATIONSHIP_TABLE = [
  'Loyal', 'Fearful', 'Contemptuous', 'Love', 'Disgust',
  'Admiration', 'Rivalry', 'Hatred', 'Respect', 'Fondness',
];

export const BELIEF_TABLE = [
  'Everyone has their role in society and they should fulfil it',
  'You can only rely on yourself, and the sweat from your own brow',
  'Trust in others and they will trust in you',
  'Some are made to Rule, others are made to be Ruled',
  'Those who have wealth and power must share it with those who do not',
  'Decisions should not be made without careful deliberation of all the facts',
  'The pursuit of knowledge is the only thing worth pursuing',
  'Money comes first, everything else can be bought with it',
  'Power comes from sincerity; if you can fake that, you\'ve got it made',
  'Only through war and conflict can we truly understand ourselves',
];

export const VALUED_OBJECT_TABLE = [
  'A piece of Jewellery', 'A Weapon', 'A Tool', 'A Book',
  'A piece of Clothing', 'A piece of Art', 'A Musical Instrument',
  'A Toy', 'A Mount', 'An Ancestral Artefact',
];

export const VALUED_PERSON_TABLE = [
  'A Parent', 'A Mentor', 'A Student', 'A Rival', 'A Pet',
  'A Lover', 'A Friend', 'A Sibling/Cousin', 'No one', 'Themselves',
];

export const GREATEST_DESIRE_TABLE = [
  'Wealth', 'Power', 'Love', 'Knowledge', 'Popularity',
  'Glory', 'Vengeance', 'Travel', 'Fame', 'Harmony',
];

// --- Tradition Effects ---

export interface TraditionDef {
  name: Tradition;
  displayName: string;
  category: 'Civic' | 'Industrial' | 'Military';
  effect: string;
  grantsBuilding?: BuildingType;
  grantsGOS?: GOSType;
}

export const TRADITION_DEFS: Record<Tradition, TraditionDef> = {
  Academic:          { name: 'Academic',          displayName: 'Academic',           category: 'Civic',      effect: 'Grants a University. Academic Society.',                grantsBuilding: 'University',  grantsGOS: 'Society' },
  Diplomatic:        { name: 'Diplomatic',        displayName: 'Diplomatic',         category: 'Civic',      effect: '+1 to all Diplomacy rolls.' },
  Sporting:          { name: 'Sporting',          displayName: 'Sporting',           category: 'Civic',      effect: 'Grants a Coliseum. Annual sporting events.',            grantsBuilding: 'Coliseum' },
  Outrider:          { name: 'Outrider',          displayName: 'Outrider',           category: 'Civic',      effect: '+1 to Message Speed.' },
  Pious:             { name: 'Pious',             displayName: 'Pious',              category: 'Civic',      effect: 'Grants a Cathedral. Religious Order.',                  grantsBuilding: 'Cathedral',   grantsGOS: 'Order' },
  Mercantile:        { name: 'Mercantile',        displayName: 'Mercantile',         category: 'Industrial', effect: '+10% Wealth creation from Trade.' },
  Artisanal:         { name: 'Artisanal',         displayName: 'Artisanal',          category: 'Industrial', effect: 'Grants High Quality bonus to one industry.' },
  BornInTheSaddle:   { name: 'BornInTheSaddle',   displayName: 'Born in the Saddle', category: 'Industrial', effect: 'Grants Stables. +1 Morale to all Cavalry.',            grantsBuilding: 'Stables' },
  Architectural:     { name: 'Architectural',     displayName: 'Architectural',      category: 'Industrial', effect: 'Civic Buildings take 1 less turn to build (min 1).' },
  MastersOfVillainy: { name: 'MastersOfVillainy', displayName: 'Masters of Villainy',category: 'Military',   effect: '+1 to all Subterfuge rolls.' },
  Pathfinder:        { name: 'Pathfinder',        displayName: 'Pathfinder',         category: 'Military',   effect: '+1 movement speed to all Armies.' },
  Militaristic:      { name: 'Militaristic',      displayName: 'Militaristic',       category: 'Military',   effect: '+1 to all Military rolls.' },
  HordeTactics:      { name: 'HordeTactics',      displayName: 'Horde Tactics',      category: 'Military',   effect: '+2 Morale for all Basic Troops.' },
  Chivalric:         { name: 'Chivalric',         displayName: 'Chivalric',          category: 'Military',   effect: '+2 Morale for all Elite Troops.' },
  TheImmortals:      { name: 'TheImmortals',      displayName: 'The Immortals',      category: 'Military',   effect: '+3 Combat, +2 Morale for one specific Troop.' },
  EncouragedLabour:  { name: 'EncouragedLabour',  displayName: 'Encouraged Labour',  category: 'Military',   effect: 'Fortifications take 1 less turn to build (min 1).' },
};

export function getTraditionGrantedBuildings(traditions: readonly Tradition[]) {
  return [...new Set(traditions.flatMap((tradition) => {
    const buildingType = TRADITION_DEFS[tradition].grantsBuilding;
    return buildingType ? [buildingType] : [];
  }))];
}

// --- Seasons order ---

export const SEASONS: Season[] = ['Spring', 'Summer', 'Autumn', 'Winter'];

export function getNextSeason(season: Season): { season: Season; yearIncrement: number } {
  const idx = SEASONS.indexOf(season);
  if (idx === 3) return { season: 'Spring', yearIncrement: 1 };
  return { season: SEASONS[idx + 1], yearIncrement: 0 };
}

// Max action words per turn
export const MAX_ACTION_WORDS_PER_TURN = 6;

// Prisoner upkeep
export const PRISONER_NOBLE_UPKEEP = 125;
