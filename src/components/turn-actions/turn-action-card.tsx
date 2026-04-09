'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ACTION_WORDS, type TurnActionRecord, type TurnActionUpdateDto, type TurnActionOutcome, type TurnActionStatus } from '@/types/game';
import { BUILDING_DEFS, TROOP_DEFS } from '@/lib/game-logic/constants';
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

interface TurnActionCardProps {
  action: TurnActionRecord;
  settlementOptions: Array<{ value: string; label: string }>;
  realmOptions?: Array<{ value: string; label: string }>;
  nobleOptions?: Array<{ value: string; label: string }>;
  editable?: boolean;
  gmExecutable?: boolean;
  commentable?: boolean;
  saving?: boolean;
  commentSaving?: boolean;
  onSave?: (patch: TurnActionUpdateDto) => Promise<void>;
  onDelete?: () => Promise<void>;
  onComment?: (body: string) => Promise<void>;
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
  };
}

export function TurnActionCard({
  action,
  settlementOptions,
  realmOptions = [],
  nobleOptions = [],
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
        {action.kind === 'political' ? (
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
              <Select
                label="Tax Type"
                options={TAX_OPTIONS}
                value={draft.taxType ?? 'Tribute'}
                onChange={(event) => setDraft((current) => ({ ...current, taxType: event.target.value as TurnActionUpdateDto['taxType'] }))}
                disabled={!editable}
              />
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
              label="Resolution Summary"
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
