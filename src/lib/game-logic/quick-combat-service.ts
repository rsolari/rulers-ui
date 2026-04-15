import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import { db as defaultDb, type DB, type DatabaseExecutor } from '@/db';
import { armies, buildings, realms, settlements, siegeUnits, territories, troops } from '@/db/schema';
import { resolveQuickCombat, type QuickCombatResolution, type QuickCombatSideInput, type QuickCombatUnit } from '@/lib/game-logic/combat';
import { TROOP_DEFS, type CombatBonusTarget } from '@/lib/game-logic/constants';
import { parseJson } from '@/lib/json';
import type { ArmourType, BuildingType, SiegeUnitType, Tradition, TroopType } from '@/types/game';


const SETTLEMENT_DEFENCE_BY_SIZE = {
  Village: 0,
  Town: 2,
  City: 4,
} as const;

const FORTIFICATION_DEFENCE: Partial<Record<BuildingType, number>> = {
  Walls: 1,
  Fort: 2,
  Castle: 4,
};

export class QuickCombatError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function isQuickCombatError(error: unknown): error is QuickCombatError {
  return error instanceof QuickCombatError;
}

function toQuickCombatTroopUnit(
  troop: typeof troops.$inferSelect,
  immortalTroopId: string | null | undefined,
): QuickCombatUnit {
  const troopDef = TROOP_DEFS[troop.type as TroopType];

  return {
    id: troop.id,
    kind: 'troop',
    type: troop.type as TroopType,
    class: troop.class as 'Basic' | 'Elite',
    armourTypes: troopDef?.armourTypes ?? [troop.armourType as ArmourType],
    condition: troop.condition as QuickCombatUnit['condition'],
    isImmortal: troop.id === immortalTroopId,
  };
}

function toQuickCombatSiegeUnit(unit: typeof siegeUnits.$inferSelect): QuickCombatUnit {
  return {
    id: unit.id,
    kind: 'siege',
    type: unit.type as SiegeUnitType,
    class: 'Basic',
    armourTypes: [],
  };
}

function getSettlementCombatTargets(buildingTypes: BuildingType[]) {
  const targets = new Set<CombatBonusTarget>();

  if (buildingTypes.some((type) => type === 'Gatehouse')) {
    targets.add('Gates');
  }

  if (buildingTypes.length > 0) {
    targets.add('Buildings');
  }

  if (buildingTypes.some((type) => type === 'Walls' || type === 'Fort' || type === 'Castle')) {
    targets.add('Walls');
  }

  return Array.from(targets);
}

function getSettlementDefenceBonus(
  settlement: Pick<typeof settlements.$inferSelect, 'size'>,
  buildingTypes: BuildingType[],
) {
  const base = SETTLEMENT_DEFENCE_BY_SIZE[settlement.size as keyof typeof SETTLEMENT_DEFENCE_BY_SIZE] ?? 0;
  const fortificationBonus = buildingTypes.reduce((sum, type) => sum + (FORTIFICATION_DEFENCE[type] ?? 0), 0);
  return base + fortificationBonus;
}

function persistCasualties(
  tx: DatabaseExecutor,
  resolution: QuickCombatResolution,
  realmIdsByUnitId: Map<string, string>,
) {
  const allCasualties = [...resolution.attackerCasualties, ...resolution.defenderCasualties];
  const woundedTroops = allCasualties.filter((casualty) => casualty.kind === 'troop' && casualty.survives && casualty.nextCondition);
  const deadTroopIds = allCasualties.filter((casualty) => casualty.kind === 'troop' && !casualty.survives).map((casualty) => casualty.unitId);
  const deadSiegeUnitIds = allCasualties.filter((casualty) => casualty.kind === 'siege' && !casualty.survives).map((casualty) => casualty.unitId);
  const immortalRealmIds = Array.from(new Set(
    allCasualties
      .filter((casualty) => casualty.clearsImmortals)
      .map((casualty) => realmIdsByUnitId.get(casualty.unitId))
      .filter((realmId): realmId is string => Boolean(realmId)),
  ));

  for (const casualty of woundedTroops) {
    tx.update(troops)
      .set({ condition: casualty.nextCondition! })
      .where(eq(troops.id, casualty.unitId))
      .run();
  }

  if (deadTroopIds.length > 0) {
    tx.delete(troops)
      .where(inArray(troops.id, deadTroopIds))
      .run();
  }

  if (deadSiegeUnitIds.length > 0) {
    tx.delete(siegeUnits)
      .where(inArray(siegeUnits.id, deadSiegeUnitIds))
      .run();
  }

  for (const realmId of immortalRealmIds) {
    tx.update(realms)
      .set({ immortalsTroopId: null })
      .where(eq(realms.id, realmId))
      .run();
  }

  return {
    updatedTroops: woundedTroops.map((casualty) => casualty.unitId),
    removedTroops: deadTroopIds,
    removedSiegeUnits: deadSiegeUnitIds,
    clearedImmortalsRealmIds: immortalRealmIds,
  };
}

export interface ResolveQuickCombatInput {
  attackerArmyId: string;
  defenderArmyId?: string;
  defenderSettlementId?: string;
}

export interface ResolveQuickCombatResult {
  resolution: QuickCombatResolution;
  persistence: {
    updatedTroops: string[];
    removedTroops: string[];
    removedSiegeUnits: string[];
    clearedImmortalsRealmIds: string[];
  };
}

export function createQuickCombatService(
  database: DB = defaultDb,
  roller?: (count: number) => number[],
) {
  function resolveArmyQuickCombat(gameId: string, input: ResolveQuickCombatInput): ResolveQuickCombatResult {
    return database.transaction((tx) => {
      const attackerArmy = tx.select({
        id: armies.id,
        realmId: realms.id,
        traditions: realms.traditions,
        immortalsTroopId: realms.immortalsTroopId,
      })
        .from(armies)
        .innerJoin(realms, eq(armies.realmId, realms.id))
        .where(and(
          eq(armies.id, input.attackerArmyId),
          eq(realms.gameId, gameId),
        ))
        .get();

      if (!attackerArmy) {
        throw new QuickCombatError('Attacking army not found for this game.', 404, 'attacker_army_not_found');
      }

      const defenderArmy = input.defenderArmyId
        ? tx.select({
          id: armies.id,
          realmId: realms.id,
          traditions: realms.traditions,
          immortalsTroopId: realms.immortalsTroopId,
        })
          .from(armies)
          .innerJoin(realms, eq(armies.realmId, realms.id))
          .where(and(
            eq(armies.id, input.defenderArmyId),
            eq(realms.gameId, gameId),
          ))
          .get()
        : null;

      if (input.defenderArmyId && !defenderArmy) {
        throw new QuickCombatError('Defending army not found for this game.', 404, 'defender_army_not_found');
      }

      if (!defenderArmy && !input.defenderSettlementId) {
        throw new QuickCombatError('A defender army or defender settlement is required.', 400, 'defender_required');
      }

      const defenderSettlement = input.defenderSettlementId
        ? tx.select({
          id: settlements.id,
          size: settlements.size,
          realmId: settlements.realmId,
          territoryId: settlements.territoryId,
        })
          .from(settlements)
          .innerJoin(territories, eq(settlements.territoryId, territories.id))
          .where(and(
            eq(settlements.id, input.defenderSettlementId),
            eq(territories.gameId, gameId),
          ))
          .get()
        : null;

      if (input.defenderSettlementId && !defenderSettlement) {
        throw new QuickCombatError('Defender settlement not found for this game.', 404, 'defender_settlement_not_found');
      }

      const defenderRealm = !defenderArmy && defenderSettlement?.realmId
        ? tx.select({
          id: realms.id,
          traditions: realms.traditions,
          immortalsTroopId: realms.immortalsTroopId,
        })
          .from(realms)
          .where(and(
            eq(realms.id, defenderSettlement.realmId),
            eq(realms.gameId, gameId),
          ))
          .get()
        : null;

      const attackerTroops = tx.select().from(troops).where(and(
        eq(troops.armyId, attackerArmy.id),
        eq(troops.realmId, attackerArmy.realmId),
      )).all();
      const attackerSiegeUnits = tx.select().from(siegeUnits).where(and(
        eq(siegeUnits.armyId, attackerArmy.id),
        eq(siegeUnits.realmId, attackerArmy.realmId),
      )).all();

      const defenderTroops = defenderArmy
        ? tx.select().from(troops).where(and(
          eq(troops.armyId, defenderArmy.id),
          eq(troops.realmId, defenderArmy.realmId),
        )).all()
        : defenderSettlement
          ? tx.select().from(troops).where(and(
            eq(troops.garrisonSettlementId, defenderSettlement.id),
            isNull(troops.armyId),
          )).all()
          : [];

      const defenderSiegeUnits = defenderArmy
        ? tx.select().from(siegeUnits).where(and(
          eq(siegeUnits.armyId, defenderArmy.id),
          eq(siegeUnits.realmId, defenderArmy.realmId),
        )).all()
        : [];

      const defenderBuildingTypes = defenderSettlement
        ? tx.select({ type: buildings.type })
          .from(buildings)
          .where(or(
            eq(buildings.settlementId, defenderSettlement.id),
            eq(buildings.territoryId, defenderSettlement.territoryId),
          ))
          .all()
          .map((building) => building.type as BuildingType)
        : [];

      const attackerSide: QuickCombatSideInput = {
        units: [
          ...attackerTroops.map((troop) => toQuickCombatTroopUnit(troop, attackerArmy.immortalsTroopId)),
          ...attackerSiegeUnits.map(toQuickCombatSiegeUnit),
        ],
        traditions: parseJson<Tradition[]>(attackerArmy.traditions, []),
      };

      const defenderSide: QuickCombatSideInput = {
        units: [
          ...defenderTroops.map((troop) => toQuickCombatTroopUnit(
            troop,
            defenderArmy?.immortalsTroopId ?? defenderRealm?.immortalsTroopId,
          )),
          ...defenderSiegeUnits.map(toQuickCombatSiegeUnit),
        ],
        traditions: parseJson<Tradition[]>(defenderArmy?.traditions ?? defenderRealm?.traditions, []),
        settlementDefenceBonus: defenderSettlement
          ? getSettlementDefenceBonus(defenderSettlement, defenderBuildingTypes)
          : 0,
        extraTargets: defenderSettlement ? getSettlementCombatTargets(defenderBuildingTypes) : [],
      };

      if (attackerSide.units.length === 0) {
        throw new QuickCombatError('Attacking side has no units available for combat.', 400, 'attacker_units_required');
      }

      if (defenderSide.units.length === 0 && (defenderSide.settlementDefenceBonus ?? 0) === 0) {
        throw new QuickCombatError('Defending side has no units or fortifications available for combat.', 400, 'defender_units_required');
      }

      const resolution = resolveQuickCombat(attackerSide, defenderSide, roller);
      const realmIdsByUnitId = new Map<string, string>();

      for (const troop of attackerTroops) realmIdsByUnitId.set(troop.id, troop.realmId);
      for (const troop of defenderTroops) realmIdsByUnitId.set(troop.id, troop.realmId);
      for (const unit of attackerSiegeUnits) realmIdsByUnitId.set(unit.id, unit.realmId);
      for (const unit of defenderSiegeUnits) realmIdsByUnitId.set(unit.id, unit.realmId);

      const persistence = persistCasualties(tx, resolution, realmIdsByUnitId);
      return { resolution, persistence };
    });
  }

  return {
    resolveArmyQuickCombat,
  };
}

const quickCombatService = createQuickCombatService();

export const resolveArmyQuickCombat = quickCombatService.resolveArmyQuickCombat;
