import { and, eq, inArray } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { db as defaultDb, type DB } from '@/db';
import { actionComments, games, realms, settlements, territories, turnActions, turnReports } from '@/db/schema';
import { BUILDING_DEFS, MAX_ACTION_WORDS_PER_TURN, SEASONS, SHIP_DEFS, TROOP_DEFS } from '@/lib/game-logic/constants';
import { createBuilding, createTroopRecruitment, isRuleValidationError } from '@/lib/rules-action-service';
import type {
  ActionCommentCreateDto,
  ActionCommentRecord,
  ActionKind,
  ActionWord,
  BuildFinancialAction,
  BuildingLocationType,
  BuildingSize,
  BuildingType,
  ConstructShipFinancialAction,
  CurrentTurnResponseDto,
  FinancialAction,
  FortificationMaterial,
  ReportStatus,
  RecruitFinancialAction,
  Season,
  ShipType,
  TaxChangeFinancialAction,
  TaxType,
  TurnPhase,
  TurnActionCreateDto,
  TurnActionOutcome,
  TurnActionRecord,
  TurnActionStatus,
  TurnActionUpdateDto,
  TurnHistoryEntry,
  TurnReportBundle,
  TurnReportRecord,
  TurnSubmitResponseDto,
  TroopType,
} from '@/types/game';
import { ACTION_WORDS } from '@/types/game';

type Transaction = Parameters<Parameters<DB['transaction']>[0]>[0];
type DatabaseExecutor = DB | Transaction;
type TurnReportRow = typeof turnReports.$inferSelect;
type TurnActionRow = typeof turnActions.$inferSelect;
type ActionCommentRow = typeof actionComments.$inferSelect;

export interface TurnActor {
  role: 'player' | 'gm';
  label: string;
}

export class TurnActionError extends Error {
  status: number;
  code: string;
  details?: Record<string, unknown>;

  constructor(message: string, status: number, code: string, details?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function isTurnActionError(error: unknown): error is TurnActionError {
  return error instanceof TurnActionError;
}

function toIsoString(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function sortTurnsDescending(a: { year: number; season: Season }, b: { year: number; season: Season }) {
  if (a.year !== b.year) return b.year - a.year;
  return SEASONS.indexOf(b.season) - SEASONS.indexOf(a.season);
}

function serializeReport(report: TurnReportRow | null): TurnReportRecord | null {
  if (!report) return null;

  return {
    id: report.id,
    gameId: report.gameId,
    realmId: report.realmId,
    year: report.year,
    season: report.season as Season,
    status: report.status as ReportStatus,
    gmNotes: report.gmNotes ?? null,
  };
}

function serializeComment(comment: ActionCommentRow): ActionCommentRecord {
  return {
    id: comment.id,
    actionId: comment.actionId,
    authorRole: comment.authorRole as 'player' | 'gm',
    authorLabel: comment.authorLabel,
    body: comment.body,
    createdAt: toIsoString(comment.createdAt),
  };
}

function serializeAction(action: TurnActionRow, comments: ActionCommentRecord[]): TurnActionRecord {
  return {
    id: action.id,
    turnReportId: action.turnReportId,
    gameId: action.gameId,
    realmId: action.realmId,
    year: action.year,
    season: action.season as Season,
    kind: action.kind as ActionKind,
    status: action.status as TurnActionStatus,
    outcome: action.outcome as TurnActionOutcome,
    sortOrder: action.sortOrder,
    description: action.description,
    actionWords: parseJson<ActionWord[]>(action.actionWords, []),
    targetRealmId: action.targetRealmId ?? null,
    assignedNobleId: action.assignedNobleId ?? null,
    triggerCondition: action.triggerCondition ?? null,
    financialType: (action.financialType as FinancialAction['type'] | null) ?? null,
    buildingType: (action.buildingType as BuildingType | null) ?? null,
    troopType: (action.troopType as TroopType | null) ?? null,
    shipType: (action.shipType as ShipType | null) ?? null,
    fleetId: action.fleetId ?? null,
    settlementId: action.settlementId ?? null,
    territoryId: action.territoryId ?? null,
    material: (action.material as FortificationMaterial | null) ?? null,
    wallSize: (action.wallSize as BuildingSize | null) ?? null,
    ownerGosId: action.ownerGosId ?? null,
    allottedGosId: action.allottedGosId ?? null,
    locationType: (action.locationType as BuildingLocationType | null) ?? null,
    buildingSize: (action.buildingSize as BuildingSize | null) ?? null,
    takesBuildingSlot: action.takesBuildingSlot ?? null,
    constructionTurns: action.constructionTurns ?? null,
    taxType: (action.taxType as TaxType | null) ?? null,
    technicalKnowledgeKey: action.technicalKnowledgeKey ?? null,
    cost: action.cost,
    resolutionSummary: action.resolutionSummary ?? null,
    submittedAt: toIsoString(action.submittedAt),
    submittedBy: action.submittedBy ?? null,
    executedAt: toIsoString(action.executedAt),
    executedBy: action.executedBy ?? null,
    createdAt: toIsoString(action.createdAt),
    updatedAt: toIsoString(action.updatedAt),
    comments,
  };
}

function mapCommentsByAction(commentRows: ActionCommentRow[]) {
  const byAction = new Map<string, ActionCommentRecord[]>();

  for (const comment of commentRows) {
    const existing = byAction.get(comment.actionId) ?? [];
    existing.push(serializeComment(comment));
    byAction.set(comment.actionId, existing);
  }

  for (const comments of byAction.values()) {
    comments.sort((a, b) => {
      const left = a.createdAt ? Date.parse(a.createdAt) : 0;
      const right = b.createdAt ? Date.parse(b.createdAt) : 0;
      return left - right;
    });
  }

  return byAction;
}

function deriveReportStatus(actions: TurnActionRow[]): ReportStatus {
  if (actions.length === 0) return 'draft';
  if (actions.every((action) => action.status === 'executed')) return 'resolved';
  if (actions.some((action) => action.status === 'submitted' || action.status === 'executed')) return 'submitted';
  return 'draft';
}

function getFinancialActionType(value: string | null | undefined): FinancialAction['type'] | null {
  if (value === 'build' || value === 'recruit' || value === 'constructShip' || value === 'taxChange' || value === 'spending') {
    return value;
  }
  return null;
}

function assertValidActionWords(words: unknown): ActionWord[] {
  if (!Array.isArray(words)) {
    throw new TurnActionError('Political actions must use an action word array.', 400, 'invalid_action_words');
  }

  const normalized = Array.from(new Set(words.map((value) => String(value)))) as ActionWord[];
  const validWords = new Set(ACTION_WORDS);

  for (const word of normalized) {
    if (!validWords.has(word)) {
      throw new TurnActionError('Political actions contain an unknown action word.', 400, 'invalid_action_word', {
        word,
      });
    }
  }

  return normalized;
}

function assertValidBuildingType(value: string | null | undefined) {
  if (!value) return null;
  if (!(value in BUILDING_DEFS)) {
    throw new TurnActionError('Unknown building type.', 400, 'invalid_building_type', { buildingType: value });
  }
  return value as BuildingType;
}

function assertValidBuildingLocationType(value: string | null | undefined) {
  if (!value) return null;
  if (value !== 'settlement' && value !== 'territory') {
    throw new TurnActionError('Unknown building location type.', 400, 'invalid_location_type', { locationType: value });
  }
  return value as BuildingLocationType;
}

function assertValidBuildingSize(value: string | null | undefined) {
  if (!value) return null;
  if (!['Tiny', 'Small', 'Medium', 'Large', 'Colossal'].includes(value)) {
    throw new TurnActionError('Unknown building size.', 400, 'invalid_building_size', { buildingSize: value });
  }
  return value as BuildingSize;
}

function assertValidMaterial(value: string | null | undefined) {
  if (!value) return null;
  if (value !== 'Timber' && value !== 'Stone') {
    throw new TurnActionError('Unknown fortification material.', 400, 'invalid_material', { material: value });
  }
  return value as FortificationMaterial;
}

function assertValidTroopType(value: string | null | undefined) {
  if (!value) return null;
  if (!(value in TROOP_DEFS)) {
    throw new TurnActionError('Unknown troop type.', 400, 'invalid_troop_type', { troopType: value });
  }
  return value as TroopType;
}

function assertValidShipType(value: string | null | undefined) {
  if (!value) return null;
  if (!(value in SHIP_DEFS)) {
    throw new TurnActionError('Unknown ship type.', 400, 'invalid_ship_type', { shipType: value });
  }
  return value as ShipType;
}

function assertValidTaxType(value: string | null | undefined) {
  if (!value) return null;
  if (value !== 'Tribute' && value !== 'Levy') {
    throw new TurnActionError('Unknown tax type.', 400, 'invalid_tax_type', { taxType: value });
  }
  return value as TaxType;
}

function normalizeDescription(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeNullableString(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeNullableBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : null;
}

function normalizeNullableInteger(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(numeric) || numeric < 0) {
    throw new TurnActionError('Action values must use non-negative integers.', 400, 'invalid_integer_value');
  }
  return numeric;
}

function normalizeCost(value: unknown) {
  if (value === undefined) return 0;
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(numeric) || numeric < 0) {
    throw new TurnActionError('Action cost must be a non-negative integer.', 400, 'invalid_cost');
  }
  return numeric;
}

function mapTurnActionRowToFinancialAction(action: TurnActionRow): FinancialAction {
  const type = getFinancialActionType(action.financialType);
  if (action.kind !== 'financial' || !type) {
    throw new TurnActionError('Cannot map a non-financial turn action into a financial action.', 500, 'invalid_financial_action_row');
  }

  if (type === 'build') {
    return {
      type,
      buildingType: action.buildingType as BuildFinancialAction['buildingType'],
      settlementId: action.settlementId ?? undefined,
      territoryId: action.territoryId ?? undefined,
      material: (action.material as BuildFinancialAction['material']) ?? undefined,
      wallSize: (action.wallSize as BuildFinancialAction['wallSize']) ?? undefined,
      ownerGosId: action.ownerGosId ?? undefined,
      allottedGosId: action.allottedGosId ?? undefined,
      locationType: (action.locationType as BuildFinancialAction['locationType']) ?? undefined,
      buildingSize: (action.buildingSize as BuildFinancialAction['buildingSize']) ?? undefined,
      takesBuildingSlot: action.takesBuildingSlot ?? undefined,
      constructionTurns: action.constructionTurns ?? undefined,
      technicalKnowledgeKey: action.technicalKnowledgeKey ?? undefined,
      description: action.description || undefined,
      cost: action.cost,
    };
  }

  if (type === 'recruit') {
    return {
      type,
      troopType: action.troopType as RecruitFinancialAction['troopType'],
      settlementId: action.settlementId ?? undefined,
      technicalKnowledgeKey: action.technicalKnowledgeKey ?? undefined,
      description: action.description || undefined,
      cost: action.cost,
    };
  }

  if (type === 'constructShip') {
    return {
      type,
      shipType: action.shipType as ConstructShipFinancialAction['shipType'],
      settlementId: action.settlementId ?? undefined,
      fleetId: action.fleetId ?? undefined,
      technicalKnowledgeKey: action.technicalKnowledgeKey ?? undefined,
      description: action.description || undefined,
      cost: action.cost,
    };
  }

  if (type === 'taxChange') {
    return {
      type,
      taxType: action.taxType as TaxChangeFinancialAction['taxType'],
      description: action.description || undefined,
      cost: action.cost,
    };
  }

  return {
    type,
    description: action.description || undefined,
    cost: action.cost,
  };
}

function getSettlementIdsForRealm(database: DatabaseExecutor, realmId: string) {
  return new Set(
    database
      .select({ id: settlements.id })
      .from(settlements)
      .where(eq(settlements.realmId, realmId))
      .all()
      .map((settlement) => settlement.id),
  );
}

function getTerritoryIdsForRealm(database: DatabaseExecutor, realmId: string) {
  return new Set(
    database
      .select({ id: territories.id })
      .from(territories)
      .where(eq(territories.realmId, realmId))
      .all()
      .map((territory) => territory.id),
  );
}

function assertSettlementOwnership(validSettlementIds: Set<string>, settlementId: string | null | undefined) {
  if (!settlementId) return;
  if (!validSettlementIds.has(settlementId)) {
    throw new TurnActionError(
      'Actions must target settlements owned by the acting realm.',
      400,
      'invalid_settlement_ownership',
      { settlementId },
    );
  }
}

function assertTerritoryOwnership(validTerritoryIds: Set<string>, territoryId: string | null | undefined) {
  if (!territoryId) return;
  if (!validTerritoryIds.has(territoryId)) {
    throw new TurnActionError(
      'Actions must target territories owned by the acting realm.',
      400,
      'invalid_territory_ownership',
      { territoryId },
    );
  }
}

function buildDraftFields(
  kind: ActionKind,
  input: TurnActionCreateDto | TurnActionUpdateDto,
  validSettlementIds: Set<string>,
  validTerritoryIds: Set<string>,
) {
  const description = normalizeDescription(input.description);

  if (kind === 'political') {
    const actionWords = input.actionWords ? assertValidActionWords(input.actionWords) : [];

    return {
      description,
      actionWords: JSON.stringify(actionWords),
      targetRealmId: normalizeNullableString(input.targetRealmId),
      assignedNobleId: normalizeNullableString(input.assignedNobleId),
      triggerCondition: normalizeNullableString(input.triggerCondition),
      financialType: null,
      buildingType: null,
      troopType: null,
      shipType: null,
      fleetId: null,
      settlementId: null,
      territoryId: null,
      material: null,
      wallSize: null,
      ownerGosId: null,
      allottedGosId: null,
      locationType: null,
      buildingSize: null,
      takesBuildingSlot: null,
      constructionTurns: null,
      taxType: null,
      technicalKnowledgeKey: null,
      cost: 0,
    };
  }

  const financialType = getFinancialActionType(input.financialType);
  if (!financialType) {
    throw new TurnActionError('Financial actions require a valid type.', 400, 'invalid_financial_type');
  }

  const buildingType = assertValidBuildingType(input.buildingType);
  const troopType = assertValidTroopType(input.troopType);
  const shipType = assertValidShipType(input.shipType);
  const settlementId = normalizeNullableString(input.settlementId);
  const fleetId = normalizeNullableString(input.fleetId);
  const territoryId = normalizeNullableString(input.territoryId);
  const material = assertValidMaterial(normalizeNullableString(input.material));
  const wallSize = assertValidBuildingSize(normalizeNullableString(input.wallSize));
  const locationType = assertValidBuildingLocationType(normalizeNullableString(input.locationType))
    ?? (territoryId ? 'territory' : 'settlement');
  const buildingSize = assertValidBuildingSize(normalizeNullableString(input.buildingSize));
  const taxType = assertValidTaxType(input.taxType);
  assertSettlementOwnership(validSettlementIds, settlementId);
  assertTerritoryOwnership(validTerritoryIds, territoryId);

  return {
    description,
    actionWords: JSON.stringify([]),
    targetRealmId: null,
    assignedNobleId: null,
    triggerCondition: null,
    financialType,
    buildingType: financialType === 'build' ? buildingType : null,
    troopType: financialType === 'recruit' ? troopType : null,
    shipType: financialType === 'constructShip' ? shipType : null,
    fleetId: financialType === 'constructShip' ? fleetId : null,
    settlementId: financialType === 'build' || financialType === 'recruit' || financialType === 'constructShip' ? settlementId : null,
    territoryId: financialType === 'build' ? territoryId : null,
    material: financialType === 'build' ? material : null,
    wallSize: financialType === 'build' ? wallSize : null,
    ownerGosId: financialType === 'build' ? normalizeNullableString(input.ownerGosId) : null,
    allottedGosId: financialType === 'build' ? normalizeNullableString(input.allottedGosId) : null,
    locationType: financialType === 'build' ? locationType : null,
    buildingSize: financialType === 'build' ? buildingSize : null,
    takesBuildingSlot: financialType === 'build' ? normalizeNullableBoolean(input.takesBuildingSlot) : null,
    constructionTurns: financialType === 'build' ? normalizeNullableInteger(input.constructionTurns) : null,
    taxType: financialType === 'taxChange' ? taxType : null,
    technicalKnowledgeKey: financialType === 'build' || financialType === 'recruit' || financialType === 'constructShip'
      ? normalizeNullableString(input.technicalKnowledgeKey)
      : null,
    cost: normalizeCost(input.cost),
  };
}

function assertDraftEditable(action: TurnActionRow, game: typeof games.$inferSelect, realmId: string) {
  if (action.realmId !== realmId) {
    throw new TurnActionError('Action not found.', 404, 'action_not_found');
  }

  if (action.year !== game.currentYear || action.season !== game.currentSeason) {
    throw new TurnActionError('Only current-turn actions can be edited.', 409, 'stale_turn_action');
  }

  if (action.status !== 'draft') {
    throw new TurnActionError('Only draft actions can be edited.', 409, 'action_not_editable');
  }
}

function assertCurrentPoliticalAction(action: TurnActionRow, game: typeof games.$inferSelect) {
  if (action.kind !== 'political') {
    throw new TurnActionError('Only political actions can be executed by the GM.', 409, 'invalid_action_kind');
  }

  if (action.year !== game.currentYear || action.season !== game.currentSeason) {
    throw new TurnActionError('Only current-turn political actions can be executed.', 409, 'stale_turn_action');
  }

  if (action.status === 'draft') {
    throw new TurnActionError('Political actions must be submitted before GM execution.', 409, 'action_not_submitted');
  }
}

function assertTurnAggregateRules(actions: TurnActionRow[]) {
  const totalActionWords = actions
    .filter((action) => action.kind === 'political')
    .reduce((sum, action) => sum + parseJson<ActionWord[]>(action.actionWords, []).length, 0);

  if (totalActionWords > MAX_ACTION_WORDS_PER_TURN) {
    throw new TurnActionError(
      `A realm may only submit ${MAX_ACTION_WORDS_PER_TURN} total political action words per turn.`,
      400,
      'too_many_action_words',
    );
  }

  const taxChanges = actions.filter(
    (action) => action.kind === 'financial' && action.financialType === 'taxChange',
  ).length;

  if (taxChanges > 1) {
    throw new TurnActionError('A realm may only submit one tax change per turn.', 400, 'too_many_tax_changes');
  }
}

function assertSubmittableAction(
  action: TurnActionRow,
  validSettlementIds: Set<string>,
  validTerritoryIds: Set<string>,
) {
  if (action.kind === 'political') {
    if (parseJson<ActionWord[]>(action.actionWords, []).length === 0) {
      throw new TurnActionError('Political actions require at least one action word before submission.', 400, 'political_action_missing_words');
    }
    if (!action.description.trim()) {
      throw new TurnActionError('Political actions require a description before submission.', 400, 'political_action_missing_description');
    }
    return;
  }

  const financialType = getFinancialActionType(action.financialType);
  if (!financialType) {
    throw new TurnActionError('Financial actions require a valid type before submission.', 400, 'financial_action_missing_type');
  }

  assertSettlementOwnership(validSettlementIds, action.settlementId);
  assertTerritoryOwnership(validTerritoryIds, action.territoryId);

  if (financialType === 'build') {
    if (!assertValidBuildingType(action.buildingType)) {
      throw new TurnActionError('Build actions require a valid building type.', 400, 'build_action_missing_building');
    }
    const locationType = assertValidBuildingLocationType(action.locationType)
      ?? (action.territoryId ? 'territory' : 'settlement');

    if (locationType === 'territory') {
      if (!action.territoryId) {
        throw new TurnActionError('Territory build actions require a territory.', 400, 'build_action_missing_territory');
      }
      return;
    }

    if (!action.settlementId) {
      throw new TurnActionError('Settlement build actions require a settlement.', 400, 'build_action_missing_settlement');
    }
    return;
  }

  if (financialType === 'recruit') {
    if (!assertValidTroopType(action.troopType)) {
      throw new TurnActionError('Recruit actions require a valid troop type.', 400, 'recruit_action_missing_troop');
    }
    if (!action.settlementId) {
      throw new TurnActionError('Recruit actions require a settlement.', 400, 'recruit_action_missing_settlement');
    }
    return;
  }

  if (financialType === 'constructShip') {
    if (!assertValidShipType(action.shipType)) {
      throw new TurnActionError('Ship construction actions require a valid ship type.', 400, 'construct_ship_missing_ship');
    }
    if (!action.settlementId) {
      throw new TurnActionError('Ship construction actions require a settlement.', 400, 'construct_ship_missing_settlement');
    }
    return;
  }

  if (financialType === 'taxChange') {
    if (!assertValidTaxType(action.taxType)) {
      throw new TurnActionError('Tax change actions require Tribute or Levy.', 400, 'tax_change_missing_tax_type');
    }
    return;
  }

  if (!action.description.trim()) {
    throw new TurnActionError('Spending actions require a description before submission.', 400, 'spending_action_missing_description');
  }
}

function syncReportStatus(database: DatabaseExecutor, reportId: string) {
  const actions = database.select().from(turnActions).where(eq(turnActions.turnReportId, reportId)).all();
  const status = deriveReportStatus(actions);
  database.update(turnReports).set({ status }).where(eq(turnReports.id, reportId)).run();
  return status;
}

function toTurnActionError(error: unknown) {
  if (isRuleValidationError(error)) {
    return new TurnActionError(error.message, error.status, error.code, error.details);
  }

  if (isTurnActionError(error)) {
    return error;
  }

  return null;
}

function resolveAutomatedFinancialAction(
  database: DatabaseExecutor,
  gameId: string,
  action: TurnActionRow,
  actor: TurnActor,
) {
  const financialType = getFinancialActionType(action.financialType);
  if (action.kind !== 'financial' || (financialType !== 'build' && financialType !== 'recruit')) {
    return false;
  }

  const now = new Date();

  try {
    if (financialType === 'build') {
      const created = createBuilding(gameId, {
        settlementId: action.settlementId,
        territoryId: action.territoryId,
        type: action.buildingType as string,
        technicalKnowledgeKey: action.technicalKnowledgeKey,
        material: action.material,
        ownerGosId: action.ownerGosId,
        allottedGosId: action.allottedGosId,
        wallSize: action.wallSize as BuildingSize | null,
      }, {
        database,
        chargeTreasury: true,
      });

      database.update(turnActions)
        .set({
          status: 'executed',
          outcome: 'success',
          settlementId: created.row.settlementId,
          territoryId: created.row.territoryId,
          material: created.row.material as FortificationMaterial | null,
          ownerGosId: created.row.ownerGosId,
          allottedGosId: created.row.allottedGosId,
          locationType: created.row.locationType,
          buildingSize: created.effectiveSize,
          takesBuildingSlot: created.row.takesBuildingSlot,
          constructionTurns: created.constructionTurns,
          cost: created.cost.total,
          resolutionSummary: action.resolutionSummary ?? 'Construction began automatically on submission.',
          submittedAt: action.submittedAt ?? now,
          submittedBy: action.submittedBy ?? actor.label,
          executedAt: now,
          executedBy: actor.label,
          updatedAt: now,
        })
        .where(eq(turnActions.id, action.id))
        .run();

      return true;
    }

    const created = createTroopRecruitment(gameId, {
      realmId: action.realmId,
      type: action.troopType as string,
      recruitmentSettlementId: action.settlementId,
      garrisonSettlementId: action.settlementId,
    }, {
      database,
    });

    database.update(turnActions)
      .set({
        status: 'executed',
        outcome: 'success',
        cost: created.cost.total,
        resolutionSummary: action.resolutionSummary ?? 'Recruitment began automatically on submission.',
        submittedAt: action.submittedAt ?? now,
        submittedBy: action.submittedBy ?? actor.label,
        executedAt: now,
        executedBy: actor.label,
        updatedAt: now,
      })
      .where(eq(turnActions.id, action.id))
      .run();

    return true;
  } catch (error) {
    throw toTurnActionError(error) ?? error;
  }
}

function getGame(database: DatabaseExecutor, gameId: string) {
  const game = database.select().from(games).where(eq(games.id, gameId)).get();
  if (!game) {
    throw new TurnActionError('Game not found.', 404, 'game_not_found');
  }
  return game;
}

function ensureCurrentTurnReport(
  database: DatabaseExecutor,
  gameId: string,
  realmId: string,
  currentYear: number,
  currentSeason: Season,
) {
  const existing = database
    .select()
    .from(turnReports)
    .where(and(
      eq(turnReports.gameId, gameId),
      eq(turnReports.realmId, realmId),
      eq(turnReports.year, currentYear),
      eq(turnReports.season, currentSeason),
    ))
    .get();

  if (existing) return existing;

  const report = {
    id: uuid(),
    gameId,
    realmId,
    year: currentYear,
    season: currentSeason,
    status: 'draft' as const,
    gmNotes: null,
  };

  database.insert(turnReports).values(report).run();
  return database.select().from(turnReports).where(eq(turnReports.id, report.id)).get()!;
}

function getActionOrThrow(database: DatabaseExecutor, gameId: string, actionId: string) {
  const action = database
    .select()
    .from(turnActions)
    .where(and(eq(turnActions.id, actionId), eq(turnActions.gameId, gameId)))
    .get();

  if (!action) {
    throw new TurnActionError('Action not found.', 404, 'action_not_found');
  }

  return action;
}

function loadBundlesForReports(
  realmRows: Array<typeof realms.$inferSelect>,
  reportRows: TurnReportRow[],
  actionRows: TurnActionRow[],
  commentRows: ActionCommentRow[],
): TurnReportBundle[] {
  const reportByRealm = new Map<string, TurnReportRow>();
  for (const report of reportRows) {
    reportByRealm.set(report.realmId, report);
  }

  const commentsByAction = mapCommentsByAction(commentRows);
  const actionsByReport = new Map<string, TurnActionRecord[]>();
  for (const action of actionRows) {
    const existing = actionsByReport.get(action.turnReportId) ?? [];
    existing.push(serializeAction(action, commentsByAction.get(action.id) ?? []));
    actionsByReport.set(action.turnReportId, existing);
  }

  for (const actions of actionsByReport.values()) {
    actions.sort((left, right) => left.sortOrder - right.sortOrder || left.createdAt!.localeCompare(right.createdAt!));
  }

  return realmRows.map((realm) => {
    const report = reportByRealm.get(realm.id) ?? null;
    return {
      realmId: realm.id,
      realmName: realm.name,
      report: serializeReport(report),
      actions: report ? (actionsByReport.get(report.id) ?? []) : [],
    };
  });
}

function loadTurnBundles(
  database: DatabaseExecutor,
  gameId: string,
  year: number,
  season: Season,
  realmId?: string,
) {
  const realmQuery = realmId
    ? database.select().from(realms).where(and(eq(realms.gameId, gameId), eq(realms.id, realmId)))
    : database.select().from(realms).where(eq(realms.gameId, gameId));
  const realmRows = realmQuery.all();

  if (realmRows.length === 0) {
    return [];
  }

  const realmIds = realmRows.map((realm) => realm.id);
  const reportRows = database
    .select()
    .from(turnReports)
    .where(and(
      eq(turnReports.gameId, gameId),
      inArray(turnReports.realmId, realmIds),
      eq(turnReports.year, year),
      eq(turnReports.season, season),
    ))
    .all();

  const reportIds = reportRows.map((report) => report.id);
  const actionRows = reportIds.length > 0
    ? database.select().from(turnActions).where(inArray(turnActions.turnReportId, reportIds)).all()
    : [];
  const actionIds = actionRows.map((action) => action.id);
  const commentRows = actionIds.length > 0
    ? database.select().from(actionComments).where(inArray(actionComments.actionId, actionIds)).all()
    : [];

  return loadBundlesForReports(realmRows, reportRows, actionRows, commentRows);
}

export function createTurnActionService(database: DB = defaultDb) {
  function getCurrentTurn(gameId: string, realmId?: string): CurrentTurnResponseDto {
    const game = getGame(database, gameId);
    const bundles = loadTurnBundles(database, gameId, game.currentYear, game.currentSeason as Season, realmId);

    if (realmId) {
      const [realmBundle] = bundles;
      return {
        game: {
          id: game.id,
          currentYear: game.currentYear,
          currentSeason: game.currentSeason as Season,
          turnPhase: game.turnPhase as TurnPhase,
        },
        realm: realmBundle ?? {
          realmId,
          realmName: '',
          report: null,
          actions: [],
        },
      };
    }

    return {
      game: {
        id: game.id,
        currentYear: game.currentYear,
        currentSeason: game.currentSeason as Season,
        turnPhase: game.turnPhase as TurnPhase,
      },
      realms: bundles,
    };
  }

  function listCurrentActions(gameId: string, realmId: string) {
    const current = getCurrentTurn(gameId, realmId);
    if (!current.realm) {
      throw new TurnActionError('Realm not found.', 404, 'realm_not_found');
    }

    return current.realm;
  }

  function createAction(gameId: string, realmId: string, input: TurnActionCreateDto) {
    return database.transaction((tx) => {
      const game = getGame(tx, gameId);
      const report = ensureCurrentTurnReport(tx, gameId, realmId, game.currentYear, game.currentSeason as Season);
      const validSettlementIds = getSettlementIdsForRealm(tx, realmId);
      const validTerritoryIds = getTerritoryIdsForRealm(tx, realmId);
      const fields = buildDraftFields(input.kind, input, validSettlementIds, validTerritoryIds);
      const existingActions = tx.select().from(turnActions).where(eq(turnActions.turnReportId, report.id)).all();
      const sortOrder = existingActions.length === 0
        ? 0
        : Math.max(...existingActions.map((action) => action.sortOrder)) + 1;

      const created: typeof turnActions.$inferInsert = {
        id: uuid(),
        turnReportId: report.id,
        gameId,
        realmId,
        year: game.currentYear,
        season: game.currentSeason as Season,
        kind: input.kind,
        status: 'draft' as const,
        outcome: 'pending' as const,
        sortOrder,
        ...fields,
        resolutionSummary: null,
        submittedAt: null,
        submittedBy: null,
        executedAt: null,
        executedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      tx.insert(turnActions).values(created).run();
      const postActions = [...existingActions, created as TurnActionRow];
      assertTurnAggregateRules(postActions);
      syncReportStatus(tx, report.id);

      const action = tx.select().from(turnActions).where(eq(turnActions.id, created.id)).get()!;
      return serializeAction(action, []);
    });
  }

  function updateAction(gameId: string, actionId: string, realmId: string, actor: TurnActor, input: TurnActionUpdateDto) {
    return database.transaction((tx) => {
      const game = getGame(tx, gameId);
      const action = getActionOrThrow(tx, gameId, actionId);

      if (actor.role === 'player') {
        assertDraftEditable(action, game, realmId);
        const validSettlementIds = getSettlementIdsForRealm(tx, realmId);
        const validTerritoryIds = getTerritoryIdsForRealm(tx, realmId);
        const fields = buildDraftFields(action.kind as ActionKind, input, validSettlementIds, validTerritoryIds);

        tx.update(turnActions)
          .set({
            ...fields,
            updatedAt: new Date(),
          })
          .where(eq(turnActions.id, action.id))
          .run();

        const reportActions = tx.select().from(turnActions).where(eq(turnActions.turnReportId, action.turnReportId)).all();
        assertTurnAggregateRules(reportActions);
        syncReportStatus(tx, action.turnReportId);
      } else {
        assertCurrentPoliticalAction(action, game);

        const allowedKeys = new Set(['status', 'outcome', 'resolutionSummary']);
        for (const key of Object.keys(input)) {
          if (!allowedKeys.has(key)) {
            throw new TurnActionError('GM updates may only change execution fields.', 400, 'invalid_gm_action_update');
          }
        }

        const nextStatus = input.status ?? action.status;
        const nextOutcome = input.outcome ?? action.outcome;
        if (nextStatus === 'executed' && nextOutcome === 'pending') {
          throw new TurnActionError('Executed political actions require a non-pending outcome.', 400, 'missing_outcome');
        }

        tx.update(turnActions)
          .set({
            status: nextStatus,
            outcome: nextOutcome,
            resolutionSummary: normalizeNullableString(input.resolutionSummary) ?? null,
            executedAt: nextStatus === 'executed' ? new Date() : action.executedAt,
            executedBy: nextStatus === 'executed' ? actor.label : action.executedBy,
            updatedAt: new Date(),
          })
          .where(eq(turnActions.id, action.id))
          .run();

        syncReportStatus(tx, action.turnReportId);
      }

      const updated = tx.select().from(turnActions).where(eq(turnActions.id, action.id)).get()!;
      const comments = tx.select().from(actionComments).where(eq(actionComments.actionId, updated.id)).all();
      return serializeAction(updated, comments.map(serializeComment));
    });
  }

  function deleteAction(gameId: string, actionId: string, realmId: string) {
    return database.transaction((tx) => {
      const game = getGame(tx, gameId);
      const action = getActionOrThrow(tx, gameId, actionId);
      assertDraftEditable(action, game, realmId);

      tx.delete(actionComments).where(eq(actionComments.actionId, action.id)).run();
      tx.delete(turnActions).where(eq(turnActions.id, action.id)).run();
      syncReportStatus(tx, action.turnReportId);
    });
  }

  function listComments(gameId: string, actionId: string, realmId?: string) {
    const action = getActionOrThrow(database, gameId, actionId);
    if (realmId && action.realmId !== realmId) {
      throw new TurnActionError('Action not found.', 404, 'action_not_found');
    }

    return database
      .select()
      .from(actionComments)
      .where(eq(actionComments.actionId, action.id))
      .all()
      .map(serializeComment)
      .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));
  }

  function createComment(gameId: string, actionId: string, actor: TurnActor, body: ActionCommentCreateDto['body'], realmId?: string) {
    return database.transaction((tx) => {
      const action = getActionOrThrow(tx, gameId, actionId);
      if (realmId && action.realmId !== realmId) {
        throw new TurnActionError('Action not found.', 404, 'action_not_found');
      }

      const trimmedBody = normalizeDescription(body);
      if (!trimmedBody) {
        throw new TurnActionError('Comments may not be empty.', 400, 'empty_comment');
      }

      const created = {
        id: uuid(),
        actionId: action.id,
        authorRole: actor.role,
        authorLabel: actor.label,
        body: trimmedBody,
        createdAt: new Date(),
      };

      tx.insert(actionComments).values(created).run();
      return serializeComment(created as ActionCommentRow);
    });
  }

  function submitTurn(gameId: string, realmId: string, actor: TurnActor): TurnSubmitResponseDto {
    return database.transaction((tx) => {
      const game = getGame(tx, gameId);
      const report = ensureCurrentTurnReport(tx, gameId, realmId, game.currentYear, game.currentSeason as Season);
      const actions = tx.select().from(turnActions).where(eq(turnActions.turnReportId, report.id)).all();
      const validSettlementIds = getSettlementIdsForRealm(tx, realmId);
      const validTerritoryIds = getTerritoryIdsForRealm(tx, realmId);

      assertTurnAggregateRules(actions);
      for (const action of actions) {
        if (action.status === 'executed') continue;
        assertSubmittableAction(action, validSettlementIds, validTerritoryIds);
      }

      for (const action of actions) {
        if (action.status === 'executed') continue;
        resolveAutomatedFinancialAction(tx, gameId, action, actor);
      }

      tx.update(turnActions)
        .set({
          status: 'submitted',
          submittedAt: new Date(),
          submittedBy: actor.label,
          updatedAt: new Date(),
        })
        .where(and(
          eq(turnActions.turnReportId, report.id),
          eq(turnActions.status, 'draft'),
        ))
        .run();

      syncReportStatus(tx, report.id);

      const updatedActions = tx.select().from(turnActions).where(eq(turnActions.turnReportId, report.id)).all();
      const actionIds = updatedActions.map((action) => action.id);
      const comments = actionIds.length > 0
        ? tx.select().from(actionComments).where(inArray(actionComments.actionId, actionIds)).all()
        : [];
      const commentsByAction = mapCommentsByAction(comments);
      const updatedReport = tx.select().from(turnReports).where(eq(turnReports.id, report.id)).get()!;

      return {
        report: serializeReport(updatedReport)!,
        actions: updatedActions
          .sort((left, right) => left.sortOrder - right.sortOrder)
          .map((action) => serializeAction(action, commentsByAction.get(action.id) ?? [])),
      };
    });
  }

  function getTurnHistory(gameId: string, realmId?: string) {
    const game = getGame(database, gameId);
    const reportConditions = [eq(turnReports.gameId, gameId)];
    if (realmId) {
      reportConditions.push(eq(turnReports.realmId, realmId));
    }

    const reportRows = database.select().from(turnReports).where(and(...reportConditions)).all()
      .filter((report) => report.year !== game.currentYear || report.season !== game.currentSeason);

    if (reportRows.length === 0) {
      return { history: [] as TurnHistoryEntry[] };
    }

    const reportIds = reportRows.map((report) => report.id);
    const realmIds = Array.from(new Set(reportRows.map((report) => report.realmId)));
    const realmRows = database.select().from(realms).where(inArray(realms.id, realmIds)).all();
    const actionRows = database.select().from(turnActions).where(inArray(turnActions.turnReportId, reportIds)).all();
    const actionIds = actionRows.map((action) => action.id);
    const commentRows = actionIds.length > 0
      ? database.select().from(actionComments).where(inArray(actionComments.actionId, actionIds)).all()
      : [];

    const realmById = new Map(realmRows.map((realm) => [realm.id, realm]));
    const commentsByAction = mapCommentsByAction(commentRows);
    const actionsByReport = new Map<string, TurnActionRecord[]>();
    for (const action of actionRows) {
      const existing = actionsByReport.get(action.turnReportId) ?? [];
      existing.push(serializeAction(action, commentsByAction.get(action.id) ?? []));
      actionsByReport.set(action.turnReportId, existing);
    }

    const history = reportRows
      .slice()
      .sort((left, right) => sortTurnsDescending(
        { year: left.year, season: left.season as Season },
        { year: right.year, season: right.season as Season },
      ))
      .map((report) => ({
        realmId: report.realmId,
        realmName: realmById.get(report.realmId)?.name ?? 'Unknown Realm',
        report: serializeReport(report),
        actions: (actionsByReport.get(report.id) ?? []).sort((left, right) => left.sortOrder - right.sortOrder),
      }));

    return { history };
  }

  return {
    getCurrentTurn,
    listCurrentActions,
    createAction,
    updateAction,
    deleteAction,
    listComments,
    createComment,
    submitTurn,
    getTurnHistory,
  };
}

const turnActionService = createTurnActionService();

export const getCurrentTurn = turnActionService.getCurrentTurn;
export const listCurrentActions = turnActionService.listCurrentActions;
export const createAction = turnActionService.createAction;
export const updateAction = turnActionService.updateAction;
export const deleteAction = turnActionService.deleteAction;
export const listComments = turnActionService.listComments;
export const createComment = turnActionService.createComment;
export const submitTurn = turnActionService.submitTurn;
export const getTurnHistory = turnActionService.getTurnHistory;
export { mapTurnActionRowToFinancialAction };
