import type {
  ProtectedProduct,
  ResourceType,
  Season,
  TaxType,
  TradeImportSelection,
} from '@/types/game';
import type { TradeRealmInput, TradeRouteInput } from './trade-types';
import {
  SEASONS,
  TAX_RATES,
  TRADE_BONUS_PER_PRODUCT,
  MERCANTILE_TRADE_BONUS,
  TRADE_PROTECTION_SEASONS,
} from './constants';
import { resolveIndustryProduct } from './products';

export function detectExportedProducts(
  producerProducts: ResourceType[],
  partnerProducts: ResourceType[],
): ResourceType[] {
  return producerProducts.filter((p) => !partnerProducts.includes(p));
}

export interface ProductSource {
  routeId: string;
  realmId: string;
  settlementId: string;
  resourceType: ResourceType;
  qualityTier: number;
  taxType: TaxType;
}

export interface TradeTieBreakRequest {
  importingRealmId: string;
  resourceType: ResourceType;
  candidates: ProductSource[];
}

export interface RealmTradeState {
  realmId: string;
  localProducts: ResourceType[];
  importedProducts: ResourceType[];
  exportedProductsBySettlement: Record<string, ResourceType[]>;
  unresolvedTieBreaks: TradeTieBreakRequest[];
}

interface RouteTradeState {
  routeId: string;
  productsExported1to2: ResourceType[];
  productsExported2to1: ResourceType[];
  protectedProducts: ProtectedProduct[];
  importSelectionState: TradeImportSelection[];
}

interface TradeResolution {
  realms: Record<string, RealmTradeState>;
  routes: Record<string, RouteTradeState>;
  importSelections: TradeImportSelection[];
  unresolvedTieBreaks: TradeTieBreakRequest[];
}

interface ResolveTradeNetworkOptions {
  currentSeason: Season;
  currentYear: number;
  maxIterations?: number;
  tieBreaker?: (request: TradeTieBreakRequest) => string | null | undefined;
}

interface PreviousTradeImportSelection extends TradeImportSelection {
  routeId: string;
}

interface RealmProductOffering {
  localProducts: ResourceType[];
  offerings: Map<ResourceType, { qualityTier: number }>;
}

function compareTurns(
  left: { year: number; season: Season },
  right: { year: number; season: Season },
) {
  if (left.year !== right.year) return left.year - right.year;
  return SEASONS.indexOf(left.season) - SEASONS.indexOf(right.season);
}

function isSelectionProtected(
  selection: TradeImportSelection,
  currentYear: number,
  currentSeason: Season,
) {
  return compareTurns(
    { year: currentYear, season: currentSeason },
    { year: selection.expiryYear, season: selection.expirySeason },
  ) <= 0;
}

function addSeasons(
  season: Season,
  year: number,
  seasonsToAdd: number,
) {
  let currentSeason = season;
  let currentYear = year;

  for (let index = 0; index < seasonsToAdd; index += 1) {
    const seasonIndex = SEASONS.indexOf(currentSeason);
    const nextIndex = (seasonIndex + 1) % SEASONS.length;
    currentSeason = SEASONS[nextIndex];
    if (nextIndex === 0) {
      currentYear += 1;
    }
  }

  return {
    season: currentSeason,
    year: currentYear,
  };
}

function dedupeProducts(products: Iterable<ResourceType>) {
  return [...new Set(products)];
}

function dedupeRoutes(realms: TradeRealmInput[]) {
  const routesById = new Map<string, TradeRouteInput>();

  for (const realm of realms) {
    for (const route of realm.tradeRoutes) {
      if (!routesById.has(route.id)) {
        routesById.set(route.id, route);
      }
    }
  }

  return [...routesById.values()];
}

function getPreviousSelections(routes: TradeRouteInput[]) {
  const selectionsByKey = new Map<string, PreviousTradeImportSelection>();

  for (const route of routes) {
    for (const selection of route.importSelectionState ?? []) {
      const key = `${selection.importingRealmId}:${selection.resourceType}`;
      if (!selectionsByKey.has(key)) {
        selectionsByKey.set(key, { ...selection, routeId: route.id });
      }
    }
  }

  return selectionsByKey;
}

function buildRealmOfferings(
  realms: TradeRealmInput[],
  importedProductsByRealm: Map<string, Set<ResourceType>>,
) {
  const offeringsByRealm = new Map<string, RealmProductOffering>();

  for (const realm of realms) {
    const localResourceTypes = realm.settlements.flatMap((settlement) =>
      settlement.resourceSites.map((resourceSite) => resourceSite.resourceType),
    );
    const availableProducts = dedupeProducts([
      ...localResourceTypes,
      ...(importedProductsByRealm.get(realm.id) ?? new Set<ResourceType>()),
    ]);
    const localProducts = new Set<ResourceType>();
    const offerings = new Map<ResourceType, { qualityTier: number }>();

    for (const settlement of realm.settlements) {
      for (const resourceSite of settlement.resourceSites) {
        const product = resolveIndustryProduct({
          baseResourceType: resourceSite.resourceType,
          quality: resourceSite.industry?.quality ?? 'Basic',
          ingredients: resourceSite.industry?.ingredients ?? [],
          outputProduct: resourceSite.industry?.outputProduct,
        }, availableProducts);

        localProducts.add(product.outputProduct);

        const existing = offerings.get(product.outputProduct);
        if (!existing || existing.qualityTier < product.qualityTier) {
          offerings.set(product.outputProduct, { qualityTier: product.qualityTier });
        }
      }
    }

    offeringsByRealm.set(realm.id, {
      localProducts: [...localProducts],
      offerings,
    });
  }

  return offeringsByRealm;
}

function groupCandidatesByImport(
  realms: TradeRealmInput[],
  routes: TradeRouteInput[],
  offeringsByRealm: Map<string, RealmProductOffering>,
) {
  const candidatesByKey = new Map<string, ProductSource[]>();
  const realmById = new Map(realms.map((realm) => [realm.id, realm]));

  const addCandidates = (
    route: TradeRouteInput,
    exporterRealmId: string,
    importerRealmId: string,
    exporterSettlementId: string,
  ) => {
    const exporterRealm = realmById.get(exporterRealmId);
    const exporterOfferings = offeringsByRealm.get(exporterRealmId);
    const importerOfferings = offeringsByRealm.get(importerRealmId);

    if (!exporterRealm || !exporterOfferings || !importerOfferings) {
      return;
    }

    const importerLocalProducts = new Set(importerOfferings.localProducts);
    for (const [resourceType, offering] of exporterOfferings.offerings.entries()) {
      if (importerLocalProducts.has(resourceType)) {
        continue;
      }

      const key = `${importerRealmId}:${resourceType}`;
      const list = candidatesByKey.get(key) ?? [];
      list.push({
        routeId: route.id,
        realmId: exporterRealmId,
        settlementId: exporterSettlementId,
        resourceType,
        qualityTier: offering.qualityTier,
        taxType: exporterRealm.taxType,
      });
      candidatesByKey.set(key, list);
    }
  };

  for (const route of routes) {
    if (!route.isActive) continue;

    addCandidates(route, route.realm1Id, route.realm2Id, route.settlement1Id);
    addCandidates(route, route.realm2Id, route.realm1Id, route.settlement2Id);
  }

  return candidatesByKey;
}

function buildSelectionFromCandidate(
  candidate: ProductSource,
  importingRealmId: string,
  previous: PreviousTradeImportSelection | null,
  currentSeason: Season,
  currentYear: number,
) {
  if (
    previous &&
    previous.importingRealmId === importingRealmId &&
    previous.resourceType === candidate.resourceType &&
    previous.chosenExporterRealmId === candidate.realmId &&
    previous.routeId === candidate.routeId
  ) {
    return {
      routeId: candidate.routeId,
      selection: {
        importingRealmId,
        resourceType: candidate.resourceType,
        chosenExporterRealmId: candidate.realmId,
        expirySeason: previous.expirySeason,
        expiryYear: previous.expiryYear,
      },
    };
  }

  if (!previous) {
    return {
      routeId: candidate.routeId,
      selection: {
        importingRealmId,
        resourceType: candidate.resourceType,
        chosenExporterRealmId: candidate.realmId,
        expirySeason: currentSeason,
        expiryYear: currentYear,
      },
    };
  }

  const expiry = addSeasons(currentSeason, currentYear, TRADE_PROTECTION_SEASONS);
  return {
    routeId: candidate.routeId,
    selection: {
      importingRealmId,
      resourceType: candidate.resourceType,
      chosenExporterRealmId: candidate.realmId,
      expirySeason: expiry.season,
      expiryYear: expiry.year,
    },
  };
}

function resolveImportSelections(
  candidatesByKey: Map<string, ProductSource[]>,
  previousSelections: Map<string, PreviousTradeImportSelection>,
  options: ResolveTradeNetworkOptions,
) {
  const importSelections = new Map<string, { routeId: string; selection: TradeImportSelection }>();
  const unresolvedTieBreaks: TradeTieBreakRequest[] = [];

  for (const [key, candidates] of candidatesByKey.entries()) {
    const [importingRealmId, resourceType] = key.split(':') as [string, ResourceType];
    const previous = previousSelections.get(key) ?? null;
    const protectedPrevious = previous && isSelectionProtected(previous, options.currentYear, options.currentSeason)
      ? candidates.find((candidate) =>
        candidate.routeId === previous.routeId &&
        candidate.realmId === previous.chosenExporterRealmId,
      ) ?? null
      : null;

    if (protectedPrevious) {
      importSelections.set(key, buildSelectionFromCandidate(
        protectedPrevious,
        importingRealmId,
        previous,
        options.currentSeason,
        options.currentYear,
      ));
      continue;
    }

    const highestQuality = Math.max(...candidates.map((candidate) => candidate.qualityTier));
    const qualityWinners = candidates.filter((candidate) => candidate.qualityTier === highestQuality);
    const lowestTax = Math.min(...qualityWinners.map((candidate) => TAX_RATES[candidate.taxType]));
    const rankedWinners = qualityWinners.filter((candidate) => TAX_RATES[candidate.taxType] === lowestTax);

    if (rankedWinners.length === 1) {
      importSelections.set(key, buildSelectionFromCandidate(
        rankedWinners[0],
        importingRealmId,
        previous,
        options.currentSeason,
        options.currentYear,
      ));
      continue;
    }

    const previousWinner = previous
      ? rankedWinners.find((candidate) =>
        candidate.routeId === previous.routeId &&
        candidate.realmId === previous.chosenExporterRealmId,
      ) ?? null
      : null;

    if (previousWinner) {
      importSelections.set(key, buildSelectionFromCandidate(
        previousWinner,
        importingRealmId,
        previous,
        options.currentSeason,
        options.currentYear,
      ));
      continue;
    }

    const tieBreakRequest: TradeTieBreakRequest = {
      importingRealmId,
      resourceType,
      candidates: rankedWinners,
    };

    const chosenRouteId = options.tieBreaker?.(tieBreakRequest) ?? null;
    if (chosenRouteId) {
      const chosenCandidate = rankedWinners.find((candidate) => candidate.routeId === chosenRouteId);
      if (chosenCandidate) {
        importSelections.set(key, buildSelectionFromCandidate(
          chosenCandidate,
          importingRealmId,
          previous,
          options.currentSeason,
          options.currentYear,
        ));
        continue;
      }
    }

    unresolvedTieBreaks.push(tieBreakRequest);
  }

  return {
    importSelections,
    unresolvedTieBreaks,
  };
}

function buildImportedProductsByRealm(
  realms: TradeRealmInput[],
  importSelections: Map<string, { routeId: string; selection: TradeImportSelection }>,
) {
  const importedProductsByRealm = new Map<string, Set<ResourceType>>();

  for (const realm of realms) {
    importedProductsByRealm.set(realm.id, new Set<ResourceType>());
  }

  for (const { selection } of importSelections.values()) {
    importedProductsByRealm.get(selection.importingRealmId)?.add(selection.resourceType);
  }

  return importedProductsByRealm;
}

function selectionsSignature(importSelections: Map<string, { routeId: string; selection: TradeImportSelection }>) {
  return [...importSelections.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}:${value.routeId}:${value.selection.chosenExporterRealmId}`)
    .join('|');
}

function importedSignature(importedProductsByRealm: Map<string, Set<ResourceType>>) {
  return [...importedProductsByRealm.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([realmId, products]) => `${realmId}:${[...products].sort().join(',')}`)
    .join('|');
}

export function resolveCompetition(sources: ProductSource[]): ProductSource | null {
  if (sources.length === 0) return null;
  if (sources.length === 1) return sources[0];

  return [...sources].sort((a, b) => {
    if (a.qualityTier !== b.qualityTier) return b.qualityTier - a.qualityTier;
    return TAX_RATES[a.taxType] - TAX_RATES[b.taxType];
  })[0];
}

export function resolveTradeNetwork(
  realms: TradeRealmInput[],
  options: ResolveTradeNetworkOptions,
): TradeResolution {
  const routes = dedupeRoutes(realms);
  const previousSelections = getPreviousSelections(routes);
  const maxIterations = options.maxIterations ?? 5;
  let importedProductsByRealm = buildImportedProductsByRealm(realms, new Map(
    [...previousSelections.entries()].map(([key, selection]) => [key, {
      routeId: selection.routeId,
      selection,
    }]),
  ));
  let previousImportedState = '';
  let previousSelectionState = '';
  let finalOfferings = buildRealmOfferings(realms, importedProductsByRealm);
  let finalSelections = new Map<string, { routeId: string; selection: TradeImportSelection }>();
  let finalUnresolvedTieBreaks: TradeTieBreakRequest[] = [];

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    finalOfferings = buildRealmOfferings(realms, importedProductsByRealm);
    const candidatesByKey = groupCandidatesByImport(realms, routes, finalOfferings);
    const resolvedSelections = resolveImportSelections(candidatesByKey, previousSelections, options);
    finalSelections = resolvedSelections.importSelections;
    finalUnresolvedTieBreaks = resolvedSelections.unresolvedTieBreaks;

    const nextImportedProductsByRealm = buildImportedProductsByRealm(realms, finalSelections);
    const nextImportedState = importedSignature(nextImportedProductsByRealm);
    const nextSelectionState = selectionsSignature(finalSelections);

    importedProductsByRealm = nextImportedProductsByRealm;

    if (
      nextImportedState === previousImportedState &&
      nextSelectionState === previousSelectionState
    ) {
      break;
    }

    previousImportedState = nextImportedState;
    previousSelectionState = nextSelectionState;
  }

  finalOfferings = buildRealmOfferings(realms, importedProductsByRealm);
  const routesState = Object.fromEntries(routes.map((route) => [route.id, {
    routeId: route.id,
    productsExported1to2: [] as ResourceType[],
    productsExported2to1: [] as ResourceType[],
    protectedProducts: [] as ProtectedProduct[],
    importSelectionState: [] as TradeImportSelection[],
  }])) as Record<string, RouteTradeState>;

  const exportedProductsBySettlement = new Map<string, Set<ResourceType>>();
  const unresolvedByRealm = new Map<string, TradeTieBreakRequest[]>();

  for (const realm of realms) {
    unresolvedByRealm.set(realm.id, []);
  }

  for (const tieBreak of finalUnresolvedTieBreaks) {
    const importerList = unresolvedByRealm.get(tieBreak.importingRealmId) ?? [];
    importerList.push(tieBreak);
    unresolvedByRealm.set(tieBreak.importingRealmId, importerList);
  }

  for (const { routeId, selection } of finalSelections.values()) {
    const route = routes.find((candidate) => candidate.id === routeId);
    if (!route) continue;

    const routeState = routesState[routeId];
    routeState.importSelectionState.push(selection);

    const isProtected = isSelectionProtected(selection, options.currentYear, options.currentSeason);
    if (isProtected) {
      routeState.protectedProducts.push({
        resourceType: selection.resourceType,
        expirySeason: selection.expirySeason,
        expiryYear: selection.expiryYear,
      });
    }

    if (selection.importingRealmId === route.realm2Id) {
      routeState.productsExported1to2.push(selection.resourceType);
      const exported = exportedProductsBySettlement.get(route.settlement1Id) ?? new Set<ResourceType>();
      exported.add(selection.resourceType);
      exportedProductsBySettlement.set(route.settlement1Id, exported);
    } else if (selection.importingRealmId === route.realm1Id) {
      routeState.productsExported2to1.push(selection.resourceType);
      const exported = exportedProductsBySettlement.get(route.settlement2Id) ?? new Set<ResourceType>();
      exported.add(selection.resourceType);
      exportedProductsBySettlement.set(route.settlement2Id, exported);
    }
  }

  const realmStates = Object.fromEntries(realms.map((realm) => {
    const importedProducts = [...(importedProductsByRealm.get(realm.id) ?? new Set<ResourceType>())];
    const localProducts = finalOfferings.get(realm.id)?.localProducts ?? [];
    const settlementExports = Object.fromEntries(realm.settlements.map((settlement) => [
      settlement.id,
      [...(exportedProductsBySettlement.get(settlement.id) ?? new Set<ResourceType>())],
    ]));

    return [realm.id, {
      realmId: realm.id,
      localProducts,
      importedProducts,
      exportedProductsBySettlement: settlementExports,
      unresolvedTieBreaks: unresolvedByRealm.get(realm.id) ?? [],
    }];
  })) as Record<string, RealmTradeState>;

  for (const routeState of Object.values(routesState)) {
    routeState.productsExported1to2 = dedupeProducts(routeState.productsExported1to2);
    routeState.productsExported2to1 = dedupeProducts(routeState.productsExported2to1);
  }

  return {
    realms: realmStates,
    routes: routesState,
    importSelections: [...finalSelections.values()].map((entry) => entry.selection),
    unresolvedTieBreaks: finalUnresolvedTieBreaks,
  };
}

export function calculateTradeWealthBonus(
  exportedProductCount: number,
  hasMercantile: boolean,
): number {
  let bonus = exportedProductCount * TRADE_BONUS_PER_PRODUCT;
  if (hasMercantile && exportedProductCount > 0) bonus += MERCANTILE_TRADE_BONUS;
  return bonus;
}
