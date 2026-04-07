'use client';

import { startTransition, useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TurnActionCard } from '@/components/turn-actions/turn-action-card';
import { TurnHistoryList } from '@/components/turn-actions/turn-history-list';
import type { CurrentTurnResponseDto, TurnActionCreateDto, TurnActionRecord, TurnActionUpdateDto, TurnHistoryEntry } from '@/types/game';

interface PlayerTurnReportPanelProps {
  gameId: string;
  realmId: string;
  compact?: boolean;
}

interface SettlementOption {
  value: string;
  label: string;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : 'Request failed');
  }
  return data as T;
}

export function PlayerTurnReportPanel({ gameId, realmId, compact = false }: PlayerTurnReportPanelProps) {
  const [currentTurn, setCurrentTurn] = useState<CurrentTurnResponseDto | null>(null);
  const [history, setHistory] = useState<TurnHistoryEntry[]>([]);
  const [settlementOptions, setSettlementOptions] = useState<SettlementOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingActionId, setSavingActionId] = useState<string | null>(null);
  const [commentActionId, setCommentActionId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [turnData, historyData, settlements] = await Promise.all([
        parseResponse<CurrentTurnResponseDto>(await fetch(`/api/game/${gameId}/turn`, { cache: 'no-store' })),
        parseResponse<{ history: TurnHistoryEntry[] }>(await fetch(`/api/game/${gameId}/turn/history`, { cache: 'no-store' })),
        parseResponse<Array<{ id: string; name: string }>>(
          await fetch(`/api/game/${gameId}/settlements?realmId=${realmId}`, { cache: 'no-store' }),
        ),
      ]);

      startTransition(() => {
        setCurrentTurn(turnData);
        setHistory(historyData.history);
        setSettlementOptions(settlements.map((settlement) => ({ value: settlement.id, label: settlement.name })));
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
                  editable={isEditable && action.status === 'draft'}
                  commentable
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

      {!compact ? (
        <div className="space-y-4">
          <h2 className="font-heading text-2xl font-semibold text-ink-600">Past Turns</h2>
          <TurnHistoryList history={history} settlementOptions={settlementOptions} />
        </div>
      ) : null}
    </div>
  );
}
