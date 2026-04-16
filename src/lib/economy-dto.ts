import type { ResourceType, TaxType, TurmoilSource } from '@/types/game';

export interface EconomyLedgerEntryDto {
  kind: 'revenue' | 'cost' | 'adjustment';
  category: string;
  label: string;
  amount: number;
  settlementId?: string | null;
  buildingId?: string | null;
  troopId?: string | null;
  shipId?: string | null;
  siegeUnitId?: string | null;
  tradeRouteId?: string | null;
  reportId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface SettlementEconomyBreakdownDto {
  settlementId: string;
  settlementName: string;
  resourceWealth: number;
  foodWealth: number;
  totalWealth: number;
  tradeBonusRate: number;
  taxRate: number;
  taxRevenue: number;
  foodProduced: number;
  foodNeeded: number;
  emptyBuildingSlots: number;
  exportedProducts: ResourceType[];
}

export interface EconomyProjectionDto {
  realm: {
    id: string;
    name: string;
    taxType: string;
    taxTypeApplied: TaxType;
    nextTaxType: TaxType;
  };
  openingTreasury: number;
  projectedTreasury: number;
  totalRevenue: number;
  totalCosts: number;
  netChange: number;
  foodProduced: number;
  foodNeeded: number;
  foodSurplus: number;
  projectedTurmoil: number;
  buildingTurmoilReduction: number;
  turmoilBreakdown: TurmoilSource[];
  openTurmoilEventId?: string | null;
  winterUnrestPending?: boolean;
  warnings: string[];
  settlementBreakdown: SettlementEconomyBreakdownDto[];
  projectedLedgerEntries: EconomyLedgerEntryDto[];
}

export interface EconomyOverviewRealmDto {
  realmId: string;
  realmName: string;
  openingTreasury: number;
  projectedRevenue: number;
  projectedCosts: number;
  projectedTreasury: number;
  foodSurplus: number;
  projectedTurmoil: number;
  buildingTurmoilReduction: number;
  turmoilBreakdown: TurmoilSource[];
  openTurmoilEventId?: string | null;
  winterUnrestPending?: boolean;
  warnings: string[];
  warningCount: number;
}
