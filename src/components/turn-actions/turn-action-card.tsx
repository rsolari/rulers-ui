'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  ACTION_WORDS,
  type Season,
  type TaxType,
  type TurnActionRecord,
  type TurnActionUpdateDto,
  type TurnActionOutcome,
  type TurnActionResolutionRoll,
  type TurnActionStatus,
} from '@/types/game';
import { BUILDING_DEFS, LEVY_DURATION_SEASONS, SEASONS, TAX_RATES, TAX_TURMOIL, TROOP_DEFS } from '@/lib/game-logic/constants';
import { ActionComments } from '@/components/turn-actions/action-comments';
import { ActionKindBadge, ActionOutcomeBadge, ActionStatusBadge } from '@/components/turn-actions/action-status-badge';
import { Badge } from '@/components/ui/badge';

const BUILDING_OPTIONS = Object.keys(BUILDING_DEFS).map((value) => ({ value, label: value }));
const TROOP_OPTIONS = Object.keys(TROOP_DEFS).map((value) => ({ value, label: value }));
const FINANCIAL_TYPE_OPTIONS = [
  { value: 'build', label: 'Build' },
  { value: 'recruit', label: 'Recruit' },
  { value: 'taxChange', label: 'Tax Change' },
  { value: 'spending', label: 'Spending' },
];
const TAX_OPTIONS = [
  { value: 'Tribute', label: 'Tribute' },
  { value: 'Levy', label: 'Levy' },
];
const OUTCOME_OPTIONS = [
  { value: 'success', label: 'Success' },
  { value: 'failure', label: 'Failure' },
  { value: 'partial', label: 'Partial' },
  { value: 'void', label: 'Void' },
];
const EXECUTION_STATUS_OPTIONS = [
  { value: 'submitted', label: 'Submitted' },
  { value: 'executed', label: 'Executed' },
];

const DICE_POOL_SIZE = 5;
const DICE_SUCCESS_THRESHOLD = 5;
const DICE_SIDES = 6;

interface TurnActionCardProps {
  action: TurnActionRecord;
  settlementOptions: Array<{ value: string; label: string }>;
  realmOptions?: Array<{ value: string; label: string }>;
  nobleOptions?: Array<{ value: string; label: string }>;
  taxProjectionContext?: TaxProjectionContext | null;
  editable?: boolean;
  gmExecutable?: boolean;
  commentable?: boolean;
  saving?: boolean;
  commentSaving?: boolean;
  onSave?: (patch: TurnActionUpdateDto) => Promise<void>;
  onDelete?: () => Promise<void>;
  onComment?: (body: string) => Promise<void>;
}

interface TaxProjectionContext {
  currentTaxType: TaxType;
  grossSettlementWealth: number;
  currentYear: number;
  currentSeason: Season;
}

function createDraftState(action: TurnActionRecord): TurnActionUpdateDto {
  return {
    description: action.description,
    actionWords: action.actionWords,
    targetRealmId: action.targetRealmId,
    assignedNobleId: action.assignedNobleId,
    triggerCondition: action.triggerCondition,
    financialType: action.financialType ?? undefined,
    buildingType: action.buildingType,
    troopType: action.troopType,
    settlementId: action.settlementId,
    territoryId: action.territoryId,
    material: action.material,
    wallSize: action.wallSize,
    ownerGosId: action.ownerGosId,
    allottedGosId: action.allottedGosId,
    locationType: action.locationType,
    buildingSize: action.buildingSize,
    takesBuildingSlot: action.takesBuildingSlot,
    constructionTurns: action.constructionTurns,
    taxType: action.taxType,
    technicalKnowledgeKey: action.technicalKnowledgeKey,
    cost: action.cost,
    status: action.status,
    outcome: action.outcome,
    resolutionSummary: action.resolutionSummary,
    resolutionRolls: action.resolutionRolls,
  };
}

function lookupLabel(options: Array<{ value: string; label: string }>, value: string | null | undefined): string | null {
  if (!value) return null;
  return options.find((o) => o.value === value)?.label ?? value;
}

function addSeasons(season: Season, year: number, seasonsToAdd: number) {
  let nextSeasonIndex = SEASONS.indexOf(season);
  let nextYear = year;

  for (let index = 0; index < seasonsToAdd; index += 1) {
    nextSeasonIndex += 1;
    if (nextSeasonIndex >= SEASONS.length) {
      nextSeasonIndex = 0;
      nextYear += 1;
    }
  }

  return {
    season: SEASONS[nextSeasonIndex],
    year: nextYear,
  };
}

function formatSignedGc(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toLocaleString()}gc`;
}

function formatSignedInteger(value: number) {
  return `${value >= 0 ? '+' : ''}${value}`;
}

function getTaxImpact(taxType: TaxType | null | undefined, context: TaxProjectionContext | null | undefined) {
  if (!taxType || !context) return null;

  const currentRevenue = Math.floor(context.grossSettlementWealth * TAX_RATES[context.currentTaxType]);
  const projectedRevenue = Math.floor(context.grossSettlementWealth * TAX_RATES[taxType]);
  const revenueDelta = projectedRevenue - currentRevenue;
  const turmoilDelta = TAX_TURMOIL[taxType] - TAX_TURMOIL[context.currentTaxType];
  const expiresAt = taxType === 'Levy'
    ? addSeasons(context.currentSeason, context.currentYear, LEVY_DURATION_SEASONS)
    : null;

  return {
    revenueDelta,
    turmoilDelta,
    expiresAt,
  };
}

function TaxImpactBadges({
  taxType,
  context,
}: {
  taxType: TaxType | null | undefined;
  context?: TaxProjectionContext | null;
}) {
  const impact = getTaxImpact(taxType, context);
  if (!impact) return null;

  return (
    <div className="flex flex-wrap gap-2 text-xs">
      <Badge variant={impact.revenueDelta >= 0 ? 'green' : 'red'}>
        Revenue {formatSignedGc(impact.revenueDelta)} / season
      </Badge>
      <Badge variant={impact.turmoilDelta > 0 ? 'red' : impact.turmoilDelta < 0 ? 'green' : 'default'}>
        Turmoil {formatSignedInteger(impact.turmoilDelta)}
      </Badge>
      {impact.expiresAt ? (
        <Badge variant="gold">
          Duration 1 year, expires {impact.expiresAt.season} Y{impact.expiresAt.year}
        </Badge>
      ) : null}
    </div>
  );
}

function createResolutionRoll(): TurnActionResolutionRoll {
  const dice = Array.from({ length: DICE_POOL_SIZE }, () => Math.floor(Math.random() * DICE_SIDES) + 1);

  return {
    dice,
    sides: DICE_SIDES,
    target: DICE_SUCCESS_THRESHOLD,
    successes: dice.filter((d) => d >= DICE_SUCCESS_THRESHOLD).length,
    failures: dice.filter((d) => d <= 2).length,
    rolledAt: new Date().toISOString(),
  };
}

function DiceRollRows({ rolls }: { rolls: TurnActionResolutionRoll[] }) {
  if (rolls.length === 0) return null;

  return (
    <div className="space-y-2">
      {rolls.map((roll, rollIndex) => (
        <div key={`${roll.rolledAt ?? 'roll'}-${rollIndex}`} className="flex flex-wrap items-center gap-2">
          <span className="flex gap-1">
            {roll.dice.map((d, dieIndex) => (
              <span
                key={`${rollIndex}-${dieIndex}`}
                className={`inline-flex h-7 w-7 items-center justify-center rounded border text-sm font-mono font-bold ${
                  d >= roll.target
                    ? 'border-green-600 bg-green-50 text-green-700'
                    : 'border-ink-200 bg-parchment-100 text-ink-400'
                }`}
              >
                {d}
              </span>
            ))}
          </span>
          <Badge variant={roll.successes > 0 ? 'green' : 'default'}>
            {roll.successes} {roll.successes === 1 ? 'success' : 'successes'}
          </Badge>
          <span className="text-xs text-ink-300">{roll.dice.length}d{roll.sides}, target {roll.target}+</span>
        </div>
      ))}
    </div>
  );
}

function DiceRoller({
  rolls,
  onChange,
}: {
  rolls: TurnActionResolutionRoll[];
  onChange: (rolls: TurnActionResolutionRoll[]) => void;
}) {
  function roll() {
    onChange([...rolls, createResolutionRoll()]);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={roll}>
          Roll {DICE_POOL_SIZE}d{DICE_SIDES}
        </Button>
        {rolls.length > 0 ? (
          <Button variant="ghost" size="sm" onClick={() => onChange([])}>
            Clear Rolls
          </Button>
        ) : null}
      </div>
      <DiceRollRows rolls={rolls} />
    </div>
  );
}

function ResolutionMetadata({
  action,
}: {
  action: TurnActionRecord;
}) {
  const hasResolution = action.status !== 'draft' || action.outcome !== 'pending' || action.resolutionSummary || action.resolutionRolls.length > 0;
  if (!hasResolution) return null;

  return (
    <div className="space-y-2 rounded border border-ink-100 bg-parchment-50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-ink-500">Resolution</span>
        <ActionStatusBadge status={action.status} />
        <ActionOutcomeBadge outcome={action.outcome} />
      </div>
      <DiceRollRows rolls={action.resolutionRolls} />
      {action.resolutionSummary ? (
        <p className="whitespace-pre-wrap text-sm text-ink-600">{action.resolutionSummary}</p>
      ) : null}
    </div>
  );
}

function ReadOnlySummary({
  action,
  settlementOptions,
  realmOptions,
  nobleOptions,
  taxProjectionContext,
}: {
  action: TurnActionRecord;
  settlementOptions: Array<{ value: string; label: string }>;
  realmOptions: Array<{ value: string; label: string }>;
  nobleOptions: Array<{ value: string; label: string }>;
  taxProjectionContext?: TaxProjectionContext | null;
}) {
  if (action.kind === 'political') {
    const words = action.actionWords ?? [];
    const targetRealm = lookupLabel(realmOptions, action.targetRealmId);
    const noble = lookupLabel(nobleOptions, action.assignedNobleId);

    return (
      <div className="space-y-2">
        {words.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {words.map((word) => (
              <Badge key={word} variant="gold">{word}</Badge>
            ))}
          </div>
        )}
        {action.description && <p className="text-sm text-ink-600 whitespace-pre-wrap">{action.description}</p>}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-400">
          {targetRealm && <span>Target: <span className="text-ink-600">{targetRealm}</span></span>}
          {noble && <span>Noble: <span className="text-ink-600">{noble}</span></span>}
          {action.triggerCondition && <span>Trigger: <span className="text-ink-600">{action.triggerCondition}</span></span>}
        </div>
      </div>
    );
  }

  // Financial action summary
  const settlement = lookupLabel(settlementOptions, action.settlementId);
  const lines: string[] = [];

  if (action.financialType === 'build') {
    lines.push(`Build ${action.buildingType ?? 'building'}${settlement ? ` in ${settlement}` : ''}`);
  } else if (action.financialType === 'recruit') {
    lines.push(`Recruit ${action.troopType ?? 'troops'}${settlement ? ` at ${settlement}` : ''}`);
  } else if (action.financialType === 'constructShip') {
    lines.push(`Construct ${action.shipType ?? 'ship'}${settlement ? ` at ${settlement}` : ''}`);
  } else if (action.financialType === 'taxChange') {
    lines.push(`Change tax to ${action.taxType ?? '?'}`);
  } else if (action.financialType === 'spending') {
    lines.push('Spending');
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Badge variant="default">{action.financialType ?? 'spending'}</Badge>
        <span className="text-ink-600">{lines[0]}</span>
        {action.cost > 0 && <Badge>Cost: {action.cost}</Badge>}
      </div>
      {action.financialType === 'taxChange' ? (
        <TaxImpactBadges taxType={action.taxType} context={taxProjectionContext} />
      ) : null}
      {action.description && <p className="text-sm text-ink-600 whitespace-pre-wrap">{action.description}</p>}
    </div>
  );
}

export function TurnActionCard({
  action,
  settlementOptions,
  realmOptions = [],
  nobleOptions = [],
  taxProjectionContext = null,
  editable = false,
  gmExecutable = false,
  commentable = false,
  saving = false,
  commentSaving = false,
  onSave,
  onDelete,
  onComment,
}: TurnActionCardProps) {
  const [draft, setDraft] = useState<TurnActionUpdateDto>(() => createDraftState(action));

  function toggleActionWord(word: typeof ACTION_WORDS[number]) {
    const actionWords = new Set(draft.actionWords ?? []);
    if (actionWords.has(word)) {
      actionWords.delete(word);
    } else {
      actionWords.add(word);
    }

    setDraft((current) => ({ ...current, actionWords: Array.from(actionWords) }));
  }

  function updateFinancialType(value: string) {
    setDraft((current) => ({
      ...current,
      financialType: value as TurnActionUpdateDto['financialType'],
      buildingType: value === 'build' ? current.buildingType : null,
      troopType: value === 'recruit' ? current.troopType : null,
      territoryId: value === 'build' ? current.territoryId : null,
      material: value === 'build' ? current.material : null,
      wallSize: value === 'build' ? current.wallSize : null,
      ownerGosId: value === 'build' ? current.ownerGosId : null,
      allottedGosId: value === 'build' ? current.allottedGosId : null,
      locationType: value === 'build' ? current.locationType : null,
      buildingSize: value === 'build' ? current.buildingSize : null,
      takesBuildingSlot: value === 'build' ? current.takesBuildingSlot : null,
      constructionTurns: value === 'build' ? current.constructionTurns : null,
      taxType: value === 'taxChange' ? current.taxType : null,
    }));
  }

  const showReadOnlySummary = !editable;

  return (
    <Card className="border border-ink-100">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-lg">Action #{action.sortOrder + 1}</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <ActionKindBadge kind={action.kind} />
            <ActionStatusBadge status={action.status} />
            <ActionOutcomeBadge outcome={action.outcome} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showReadOnlySummary ? (
          <>
            <ReadOnlySummary
              action={action}
              settlementOptions={settlementOptions}
              realmOptions={realmOptions}
              nobleOptions={nobleOptions}
              taxProjectionContext={taxProjectionContext}
            />
            <ResolutionMetadata action={action} />
          </>
        ) : action.kind === 'political' ? (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-semibold text-ink-500">Action Words</p>
              <div className="flex flex-wrap gap-2">
                {ACTION_WORDS.map((word) => {
                  const selected = (draft.actionWords ?? []).includes(word);
                  return (
                    <Badge
                      key={word}
                      variant={selected ? 'gold' : 'default'}
                      className={editable ? 'cursor-pointer' : ''}
                      onClick={() => editable && toggleActionWord(word)}
                    >
                      {word}
                    </Badge>
                  );
                })}
              </div>
            </div>
            <Textarea
              label="Description"
              rows={3}
              value={draft.description ?? ''}
              onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
              disabled={!editable}
            />
            <div className="grid gap-3 md:grid-cols-2">
              <Select
                label="Target Realm"
                options={[{ value: '', label: 'None' }, ...realmOptions]}
                value={draft.targetRealmId ?? ''}
                onChange={(event) => setDraft((current) => ({ ...current, targetRealmId: event.target.value || null }))}
                disabled={!editable}
              />
              <Select
                label="Assigned Noble"
                options={[{ value: '', label: 'None' }, ...nobleOptions]}
                value={draft.assignedNobleId ?? ''}
                onChange={(event) => setDraft((current) => ({ ...current, assignedNobleId: event.target.value || null }))}
                disabled={!editable}
              />
            </div>
            <Input
              label="Trigger Condition"
              value={draft.triggerCondition ?? ''}
              onChange={(event) => setDraft((current) => ({ ...current, triggerCondition: event.target.value }))}
              disabled={!editable}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Select
                label="Financial Type"
                options={FINANCIAL_TYPE_OPTIONS}
                value={draft.financialType ?? 'spending'}
                onChange={(event) => updateFinancialType(event.target.value)}
                disabled={!editable}
              />
              <Input
                label="Cost"
                type="number"
                min={0}
                value={String(draft.cost ?? 0)}
                onChange={(event) => setDraft((current) => ({ ...current, cost: Number(event.target.value) || 0 }))}
                disabled={!editable}
              />
            </div>
            {draft.financialType === 'build' ? (
              <div className="grid gap-3 md:grid-cols-2">
                <Select
                  label="Building Type"
                  options={BUILDING_OPTIONS}
                  value={draft.buildingType ?? ''}
                  onChange={(event) => setDraft((current) => ({
                    ...current,
                    buildingType: event.target.value as TurnActionUpdateDto['buildingType'],
                  }))}
                  disabled={!editable}
                />
                <Select
                  label="Settlement"
                  options={settlementOptions}
                  value={draft.settlementId ?? ''}
                  onChange={(event) => setDraft((current) => ({ ...current, settlementId: event.target.value }))}
                  disabled={!editable}
                />
              </div>
            ) : null}
            {draft.financialType === 'recruit' ? (
              <div className="grid gap-3 md:grid-cols-2">
                <Select
                  label="Troop Type"
                  options={TROOP_OPTIONS}
                  value={draft.troopType ?? ''}
                  onChange={(event) => setDraft((current) => ({
                    ...current,
                    troopType: event.target.value as TurnActionUpdateDto['troopType'],
                  }))}
                  disabled={!editable}
                />
                <Select
                  label="Settlement"
                  options={settlementOptions}
                  value={draft.settlementId ?? ''}
                  onChange={(event) => setDraft((current) => ({ ...current, settlementId: event.target.value }))}
                  disabled={!editable}
                />
              </div>
            ) : null}
            {draft.financialType === 'taxChange' ? (
              <div className="space-y-2">
                <Select
                  label="Tax Type"
                  options={TAX_OPTIONS}
                  value={draft.taxType ?? 'Tribute'}
                  onChange={(event) => setDraft((current) => ({ ...current, taxType: event.target.value as TurnActionUpdateDto['taxType'] }))}
                  disabled={!editable}
                />
                <TaxImpactBadges taxType={draft.taxType ?? 'Tribute'} context={taxProjectionContext} />
              </div>
            ) : null}
            <Textarea
              label="Description"
              rows={3}
              value={draft.description ?? ''}
              onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
              disabled={!editable}
            />
          </div>
        )}

        {gmExecutable ? (
          <div className="space-y-3 border-t border-ink-100 pt-3">
            <p className="text-sm font-semibold text-ink-500">Noble Action Check</p>
            <DiceRoller
              rolls={draft.resolutionRolls ?? []}
              onChange={(resolutionRolls) => setDraft((current) => ({ ...current, resolutionRolls }))}
            />
            <div className="grid gap-3 md:grid-cols-2">
              <Select
                label="Workflow Status"
                options={EXECUTION_STATUS_OPTIONS}
                value={(draft.status as TurnActionStatus) ?? 'submitted'}
                onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as TurnActionStatus }))}
              />
              <Select
                label="Outcome"
                options={OUTCOME_OPTIONS}
                value={(draft.outcome as TurnActionOutcome) === 'pending' ? 'success' : (draft.outcome as TurnActionOutcome)}
                onChange={(event) => setDraft((current) => ({ ...current, outcome: event.target.value as TurnActionOutcome }))}
              />
            </div>
            <Textarea
              label="Resolution Notes"
              rows={3}
              value={draft.resolutionSummary ?? ''}
              onChange={(event) => setDraft((current) => ({ ...current, resolutionSummary: event.target.value }))}
            />
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-3">
          <div className="text-xs text-ink-300">
            Created {action.createdAt ? new Date(action.createdAt).toLocaleString() : 'unknown'}
          </div>
          <div className="flex flex-wrap gap-2">
            {editable && onDelete ? (
              <Button variant="destructive" size="sm" onClick={() => void onDelete()} disabled={saving}>
                Delete
              </Button>
            ) : null}
            {(editable || gmExecutable) && onSave ? (
              <Button variant="outline" size="sm" onClick={() => void onSave(draft)} disabled={saving}>
                {saving ? 'Saving...' : gmExecutable ? 'Save Resolution' : 'Save Changes'}
              </Button>
            ) : null}
          </div>
        </div>

        <ActionComments
          comments={action.comments}
          canComment={commentable}
          saving={commentSaving}
          onCreateComment={onComment}
        />
      </CardContent>
    </Card>
  );
}
