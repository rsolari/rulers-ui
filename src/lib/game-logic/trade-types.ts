import type {
  IndustryQuality,
  ProtectedProduct,
  ResourceType,
  TaxType,
  TradeImportSelection,
} from '@/types/game';

export interface TradeIndustryInput {
  quality: IndustryQuality;
  ingredients: ResourceType[];
  outputProduct?: ResourceType;
}

export interface TradeResourceSiteInput {
  resourceType: ResourceType;
  industry?: TradeIndustryInput | null;
}

export interface TradeSettlementInput {
  id: string;
  resourceSites: TradeResourceSiteInput[];
}

export interface TradeRouteInput {
  id: string;
  isActive: boolean;
  realm1Id: string;
  realm2Id: string;
  settlement1Id: string;
  settlement2Id: string;
  protectedProducts?: ProtectedProduct[];
  importSelectionState?: TradeImportSelection[];
}

export interface TradeRealmInput {
  id: string;
  taxType: TaxType;
  settlements: TradeSettlementInput[];
  tradeRoutes: TradeRouteInput[];
}
