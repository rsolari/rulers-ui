import type { ProductSource } from '@/lib/game-logic/trade';

export function createProductSource(
  overrides?: Partial<ProductSource> & { qualityTier?: number },
): ProductSource {
  const { qualityTier, ...rest } = overrides ?? {};

  return {
    realmId: 'r-1',
    routeId: 'route-1',
    settlementId: 'settlement-1',
    resourceType: 'Ore',
    qualityTier: qualityTier ?? 1,
    taxType: 'Tribute',
    ...rest,
  };
}
