'use client';

import { startTransition, useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TurnActionCard } from '@/components/turn-actions/turn-action-card';
import type { CurrentTurnResponseDto, TurnActionRecord, TurnActionUpdateDto } from '@/types/game';

interface GmTurnReviewPanelProps {
  gameId: string;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : 'Request failed');
  }
  return data as T;
}

export function GmTurnReviewPanel({ gameId }: GmTurnReviewPanelProps) {
  const [currentTurn, setCurrentTurn] = useState<CurrentTurnResponseDto | null>(null);
  const [settlementOptions, setSettlementOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [realmOptions, setRealmOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [savingActionId, setSavingActionId] = useState<string | null>(null);
  const [commentActionId, setCommentActionId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [turnData, settlements, allRealms] = await Promise.all([
        parseResponse<CurrentTurnResponseDto>(await fetch(`/api/game/${gameId}/turn`, { cache: 'no-store' })),
        parseResponse<Array<{ id: string; name: string }>>(
          await fetch(`/api/game/${gameId}/settlements`, { cache: 'no-store' }),
        ),
        parseResponse<Array<{ id: string; name: string }>>(
          await fetch(`/api/game/${gameId}/realms`, { cache: 'no-store' }),
        ),
      ]);

      startTransition(() => {
        setCurrentTurn(turnData);
        setSettlementOptions(settlements.map((settlement) => ({ value: settlement.id, label: settlement.name })));
        setRealmOptions(allRealms.map((r) => ({ value: r.id, label: r.name })));
      });
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Failed to load current turn');
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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

  if (loading) {
    return (
      <Card className="mt-6">
        <CardContent>
          <p className="pt-4 text-sm text-ink-300">Loading current turn review...</p>
        </CardContent>
      </Card>
    );
  }

  const realms = currentTurn?.realms ?? [];

  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Turn Review</CardTitle>
          <div className="flex items-center gap-2">
            {currentTurn?.game ? (
              <Badge variant="gold">
                Year {currentTurn.game.currentYear}, {currentTurn.game.currentSeason}
              </Badge>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => void refresh()}>
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {realms.length === 0 ? (
          <p className="text-sm text-ink-300">No realms found for this game.</p>
        ) : (
          realms.map((realm) => (
            <Card key={realm.realmId} variant="gold">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle className="text-lg">{realm.realmName}</CardTitle>
                  {realm.report ? <Badge>{realm.report.status}</Badge> : <Badge>No report</Badge>}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {realm.actions.length === 0 ? (
                  <p className="text-sm text-ink-300">No actions submitted for this realm yet.</p>
                ) : (
                  realm.actions.map((action: TurnActionRecord) => (
                    <TurnActionCard
                      key={`${action.id}:${action.updatedAt ?? ''}`}
                      action={action}
                      settlementOptions={settlementOptions}
                      realmOptions={realmOptions}
                      gmExecutable={action.kind === 'political'}
                      commentable
                      saving={savingActionId === action.id}
                      commentSaving={commentActionId === action.id}
                      onSave={action.kind === 'political' ? (patch) => saveAction(action.id, patch) : undefined}
                      onComment={(body) => addComment(action.id, body)}
                    />
                  ))
                )}
              </CardContent>
            </Card>
          ))
        )}
      </CardContent>
    </Card>
  );
}
