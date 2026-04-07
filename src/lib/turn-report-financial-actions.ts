import { normalizeFinancialActions } from '@/lib/financial-actions';
import {
  RuleValidationError,
  prepareRealmBuildingCreation,
  prepareRealmTroopRecruitment,
  type PreparedBuildingCreation,
  type PreparedTroopRecruitment,
} from '@/lib/rules-action-service';
import type {
  BuildFinancialAction,
  FinancialAction,
  RecruitFinancialAction,
} from '@/types/game';

type DatabaseLike = NonNullable<Parameters<typeof prepareRealmBuildingCreation>[3]>['database'];

export interface PreparedTurnReportFinancialActions {
  actions: FinancialAction[];
  buildPreparations: Map<number, PreparedBuildingCreation>;
  troopPreparations: Map<number, PreparedTroopRecruitment>;
}

function withPreparedBuildingFields(
  action: BuildFinancialAction,
  prepared: PreparedBuildingCreation,
): BuildFinancialAction {
  return {
    ...action,
    settlementId: prepared.row.settlementId ?? null,
    territoryId: prepared.row.territoryId ?? null,
    material: (prepared.row.material ?? null) as BuildFinancialAction['material'],
    guildId: prepared.row.guildId ?? null,
    allottedGosId: prepared.row.allottedGosId ?? null,
    locationType: prepared.row.locationType,
    buildingSize: prepared.effectiveSize,
    takesBuildingSlot: prepared.row.takesBuildingSlot,
    constructionTurns: prepared.constructionTurns,
    cost: prepared.cost.total,
  };
}

function withPreparedRecruitmentFields(
  action: RecruitFinancialAction,
  prepared: PreparedTroopRecruitment,
): RecruitFinancialAction {
  return {
    ...action,
    cost: prepared.cost.total,
  };
}

export function prepareTurnReportFinancialActions(
  gameId: string,
  realmId: string,
  rawActions: unknown,
  options: { database?: DatabaseLike } = {},
): PreparedTurnReportFinancialActions {
  const database = options.database;
  const normalizedActions = normalizeFinancialActions(rawActions);
  if (Array.isArray(rawActions) && normalizedActions.length !== rawActions.length) {
    throw new RuleValidationError(
      'One or more financial actions are malformed.',
      400,
      'financial_action_invalid',
    );
  }
  const actions: FinancialAction[] = [];
  const buildPreparations = new Map<number, PreparedBuildingCreation>();
  const troopPreparations = new Map<number, PreparedTroopRecruitment>();

  for (const [index, action] of normalizedActions.entries()) {
    if (action.type === 'build') {
      const prepared = prepareRealmBuildingCreation(gameId, realmId, {
        settlementId: action.settlementId ?? null,
        territoryId: action.territoryId ?? null,
        type: action.buildingType,
        material: action.material ?? null,
        isGuildOwned: action.isGuildOwned ?? false,
        guildId: action.guildId ?? null,
        allottedGosId: action.allottedGosId ?? null,
        wallSize: action.wallSize ?? null,
      }, { database });
      buildPreparations.set(index, prepared);
      actions.push(withPreparedBuildingFields(action, prepared));
      continue;
    }

    if (action.type === 'recruit') {
      const prepared = prepareRealmTroopRecruitment(gameId, realmId, {
        realmId,
        type: action.troopType,
        recruitmentSettlementId: action.settlementId ?? null,
        garrisonSettlementId: action.settlementId ?? null,
      }, { database });
      troopPreparations.set(index, prepared);
      actions.push(withPreparedRecruitmentFields(action, prepared));
      continue;
    }

    if (action.type === 'taxChange') {
      actions.push({ ...action, cost: 0 });
      continue;
    }

    actions.push({ ...action, cost: Math.max(action.cost, 0) });
  }

  return {
    actions,
    buildPreparations,
    troopPreparations,
  };
}
