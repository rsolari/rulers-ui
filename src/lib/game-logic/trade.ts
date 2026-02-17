import type { ResourceType, IndustryQuality, TaxType } from '@/types/game';
import { QUALITY_TIERS, TAX_RATES, TRADE_BONUS_PER_PRODUCT, MERCANTILE_TRADE_BONUS } from './constants';

export function detectExportedProducts(
  producerProducts: ResourceType[],
  partnerProducts: ResourceType[],
): ResourceType[] {
  return producerProducts.filter((p) => !partnerProducts.includes(p));
}

export function calculateQualityTier(
  quality: IndustryQuality,
  ingredientCount: number,
): number {
  const clampedIngredients = Math.min(ingredientCount, 3);
  const key = `${quality}${clampedIngredients > 0 ? `+${clampedIngredients}` : ''}`;
  return QUALITY_TIERS[key as keyof typeof QUALITY_TIERS] ?? 1;
}

export interface ProductSource {
  realmId: string;
  resourceType: ResourceType;
  quality: IndustryQuality;
  ingredientCount: number;
  taxType: TaxType;
}

export function resolveCompetition(sources: ProductSource[]): ProductSource | null {
  if (sources.length === 0) return null;
  if (sources.length === 1) return sources[0];

  return sources.sort((a, b) => {
    const tierA = calculateQualityTier(a.quality, a.ingredientCount);
    const tierB = calculateQualityTier(b.quality, b.ingredientCount);
    if (tierA !== tierB) return tierB - tierA; // higher tier wins
    // If tied, lower tax rate wins
    const taxA = TAX_RATES[a.taxType];
    const taxB = TAX_RATES[b.taxType];
    return taxA - taxB;
  })[0];
}

export function calculateTradeWealthBonus(
  exportedProductCount: number,
  hasMercantile: boolean,
): number {
  let bonus = exportedProductCount * TRADE_BONUS_PER_PRODUCT;
  if (hasMercantile && exportedProductCount > 0) bonus += MERCANTILE_TRADE_BONUS;
  return bonus;
}
