'use client';

import { startTransition, useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TurnActionCard } from '@/components/turn-actions/turn-action-card';
import { TurnHistoryList } from '@/components/turn-actions/turn-history-list';
import { SEASONS } from '@/lib/game-logic/constants';
import type { EconomyProjectionDto } from '@/lib/economy-dto';
import type { CurrentTurnResponseDto, GOSType, TaxType, TurnActionCreateDto, TurnActionRecord, TurnActionUpdateDto, TurnHistoryEntry } from '@/types/game';

interface PlayerTurnReportPanelProps {
  gameId: string;
  realmId: string;
  compact?: boolean;
}

interface SelectOption {
  value: string;
  label: string;
}

interface GOSOption extends SelectOption {
  type: GOSType;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : 'Request failed');
  }
  return data as T;
}

async function parseOptionalResponse<T>(response: Response): Promise<T | null> {
  if (!response.ok) return null;
  return response.json() as Promise<T>;
}

function lookupLabel(options: SelectOption[], value: string | null | undefined): string | null {
  if (!value) return null;
  return options.find((option) => option.value === value)?.label ?? value;
}

function formatFinancialActionSummary(action: TurnActionRecord, settlementOptions: SelectOption[]) {
  const settlement = lookupLabel(settlementOptions, action.settlementId);

  if (action.financialType === 'build') {
    return `Build ${action.buildingType ?? 'building'}${settlement ? ` in ${settlement}` : ''}`;
  }

  if (action.financialType === 'recruit') {
    return `Recruit ${action.troopType ?? 'troops'}${settlement ? ` at ${settlement}` : ''}`;
  }

  if (action.financialType === 'constructShip') {
    return `Construct ${action.shipType ?? 'ship'}${settlement ? ` at ${settlement}` : ''}`;
  }

  if (action.financialType === 'taxChange') {
    return `Change tax to ${action.taxType ?? '?'}`;
  }

  return action.description || 'Spending';
}

export function PlayerTurnReportPanel({ gameId, realmId, compact = false }: PlayerTurnReportPanelProps) {
  const [currentTurn, setCurrentTurn] = useState<CurrentTurnResponseDto | null>(null);
  const [history, setHistory] = useState<TurnHistoryEntry[]>([]);
  const [settlementOptions, setSettlementOptions] = useState<SelectOption[]>([]);
  const [realmOptions, setRealmOptions] = useState<SelectOption[]>([]);
  const [nobleOptions, setNobleOptions] = useState<SelectOption[]>([]);
  const [gosOptions, setGosOptions] = useState<GOSOption[]>([]);
  const [economyProjection, setEconomyProjection] = useState<EconomyProjectionDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingActionId, setSavingActionId] = useState<string | null>(null);
  const [commentActionId, setCommentActionId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const realmQuery = `realmId=${encodeURIComponent(realmId)}`;
      const [
        turnResponse,
        historyResponse,
        settlementsResponse,
        realmsResponse,
        noblesResponse,
        gosResponse,
        projectionResponse,
      ] = await Promise.all([
        fetch(`/api/game/${gameId}/turn?${realmQuery}`, { cache: 'no-store' }),
        fetch(`/api/game/${gameId}/turn/history?${realmQuery}`, { cache: 'no-store' }),
        fetch(`/api/game/${gameId}/settlements?${realmQuery}`, { cache: 'no-store' }),
        fetch(`/api/game/${gameId}/realms`, { cache: 'no-store' }),
        fetch(`/api/game/${gameId}/nobles?${realmQuery}`, { cache: 'no-store' }),
        fetch(`/api/game/${gameId}/gos?${realmQuery}`, { cache: 'no-store' }),
        fetch(`/api/game/${gameId}/economy/projection?${realmQuery}`, { cache: 'no-store' }),
      ]);

      const [turnData, historyData, settlements, allRealms, realmNobles, gosList, projection] = await Promise.all([
        parseResponse<CurrentTurnResponseDto>(turnResponse),
        parseResponse<{ history: TurnHistoryEntry[] }>(historyResponse),
        parseResponse<Array<{ id: string; name: string }>>(settlementsResponse),
        parseResponse<Array<{ id: string; name: string }>>(realmsResponse),
        parseResponse<Array<{ id: string; name: string; reasonSkill: number; cunningSkill: number }>>(noblesResponse),
        parseResponse<Array<{ id: string; name: string; type: GOSType }>>(gosResponse),
        parseOptionalResponse<EconomyProjectionDto>(projectionResponse),
      ]);

      startTransition(() => {
        setCurrentTurn(turnData);
        setHistory(historyData.history);
        setSettlementOptions(settlements.map((s) => ({ value: s.id, label: s.name })));
        setRealmOptions(allRealms.map((r) => ({ value: r.id, label: r.name })));
        setNobleOptions(realmNobles.map((n) => ({ value: n.id, label: `${n.name} (R${n.reasonSkill} / C${n.cunningSkill})` })));
        setGosOptions(gosList.map((gos) => ({ value: gos.id, label: `${gos.name} (${gos.type})`, type: gos.type })));
        setEconomyProjection(projection);
      });
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Failed to load turn data');
    } finally {
      setLoading(false);
    }
  }, [gameId, realmId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function createNewAction(kind: TurnActionCreateDto['kind']) {
    setError('');
    try {
      await parseResponse(
        await fetch(`/api/game/${gameId}/turn/actions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(kind === 'political'
            ? { kind, description: '', actionWords: [] }
            : { kind, description: '', financialType: 'spending', cost: 0 }),
        }),
      );
      await refresh();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create action');
    }
  }

  async function saveAction(actionId: string, patch: TurnActionUpdateDto) {
    setSavingActionId(actionId);
    setError('');

    try {
      await parseResponse(
        await fetch(`/api/game/${gameId}/turn/actions/${actionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        }),
      );
      await refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to update action');
    } finally {
      setSavingActionId(null);
    }
  }

  async function removeAction(actionId: string) {
    setSavingActionId(actionId);
    setError('');

    try {
      await parseResponse(await fetch(`/api/game/${gameId}/turn/actions/${actionId}`, { method: 'DELETE' }));
      await refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete action');
    } finally {
      setSavingActionId(null);
    }
  }

  async function addComment(actionId: string, body: string) {
    setCommentActionId(actionId);
    setError('');

    try {
      await parseResponse(
        await fetch(`/api/game/${gameId}/turn/actions/${actionId}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body }),
        }),
      );
      await refresh();
    } catch (commentError) {
      setError(commentError instanceof Error ? commentError.message : 'Failed to post comment');
    } finally {
      setCommentActionId(null);
    }
  }

  async function submitAll() {
    setSubmitting(true);
    setError('');

    try {
      await parseResponse(await fetch(`/api/game/${gameId}/turn/submit`, { method: 'POST' }));
      await refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to submit turn');
    } finally {
      setSubmitting(false);
    }
  }

  const realm = currentTurn?.realm;
  const isEditable = realm?.report?.status !== 'submitted' && realm?.report?.status !== 'resolved';
  const actions = realm?.actions ?? [];
  const taxProjectionContext = currentTurn?.game && economyProjection
    ? {
      currentTaxType: economyProjection.realm.taxType as TaxType,
      grossSettlementWealth: economyProjection.settlementBreakdown.reduce((sum, settlement) => sum + settlement.totalWealth, 0),
      currentYear: currentTurn.game.currentYear,
      currentSeason: currentTurn.game.currentSeason,
    }
    : null;
  const financialActionsTaken = [
    ...actions,
    ...history.flatMap((entry) => entry.actions),
  ]
    .filter((action) =>
      action.kind === 'financial'
      && (action.status === 'submitted' || action.status === 'executed'),
    )
    .sort((left, right) => {
      if (left.year !== right.year) return right.year - left.year;
      if (left.season !== right.season) return SEASONS.indexOf(right.season) - SEASONS.indexOf(left.season);
      return left.sortOrder - right.sortOrder;
    });

  if (loading) {
    return (
      <Card>
        <CardContent>
          <p className="pt-4 text-sm text-ink-300">Loading turn actions...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Turn Actions</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              {currentTurn?.game ? (
                <Badge variant="gold">
                  Year {currentTurn.game.currentYear}, {currentTurn.game.currentSeason}
                </Badge>
              ) : null}
              {realm?.report ? <Badge>{realm.report.status}</Badge> : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => void createNewAction('political')} disabled={!isEditable}>
              Add Political Action
            </Button>
            <Button variant="outline" size="sm" onClick={() => void createNewAction('financial')} disabled={!isEditable}>
              Add Financial Action
            </Button>
            <Button variant="accent" size="sm" onClick={() => void submitAll()} disabled={!isEditable || submitting}>
              {submitting ? 'Submitting...' : 'Submit All'}
            </Button>
          </div>

          {actions.length === 0 ? (
            <p className="text-sm text-ink-300">No actions added yet for this turn.</p>
          ) : (
            <div className="space-y-4">
              {actions.map((action: TurnActionRecord) => (
                <TurnActionCard
                  key={`${action.id}:${action.updatedAt ?? ''}`}
                  action={action}
                  settlementOptions={settlementOptions}
                  realmOptions={realmOptions}
                  nobleOptions={nobleOptions}
                  gosOptions={gosOptions}
                  editable={isEditable && action.status === 'draft'}
                  commentable
                  taxProjectionContext={taxProjectionContext}
                  saving={savingActionId === action.id}
                  commentSaving={commentActionId === action.id}
                  onSave={(patch) => saveAction(action.id, patch)}
                  onDelete={action.status === 'draft' ? async () => removeAction(action.id) : undefined}
                  onComment={(body) => addComment(action.id, body)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {compact ? (
        <Card>
          <CardHeader>
            <CardTitle>Financial Actions Taken</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {financialActionsTaken.length === 0 ? (
              <p className="text-sm text-ink-300">No submitted financial actions yet.</p>
            ) : (
              financialActionsTaken.map((action) => (
                <div key={`financial-${action.id}:${action.updatedAt ?? ''}`} className="rounded border border-ink-100 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="gold">Y{action.year} {action.season}</Badge>
                        <Badge>{action.financialType ?? 'financial'}</Badge>
                        <Badge>{action.status}</Badge>
                      </div>
                      <p className="text-sm font-medium text-ink-600">
                        {formatFinancialActionSummary(action, settlementOptions)}
                      </p>
                      {action.description ? (
                        <p className="text-sm text-ink-400">{action.description}</p>
                      ) : null}
                    </div>
                    {action.cost > 0 ? (
                      <Badge>Cost {action.cost.toLocaleString()}gc</Badge>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}

      {!compact ? (
        <div className="space-y-4">
          <h2 className="font-heading text-2xl font-semibold text-ink-600">Past Turns</h2>
          <TurnHistoryList history={history} settlementOptions={settlementOptions} realmOptions={realmOptions} nobleOptions={nobleOptions} />
        </div>
      ) : null}
    </div>
  );
}
