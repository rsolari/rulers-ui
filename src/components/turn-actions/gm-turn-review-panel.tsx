'use client';

import { startTransition, useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TurnActionCard } from '@/components/turn-actions/turn-action-card';
import { TurnEventCard } from '@/components/turn-actions/turn-event-card';
import type { CurrentTurnResponseDto, ResolutionQueueItem, TurnActionRecord, TurnActionUpdateDto } from '@/types/game';

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
  const [nobleOptionsByRealm, setNobleOptionsByRealm] = useState<Record<string, Array<{ value: string; label: string }>>>({});
  const [resolutionQueue, setResolutionQueue] = useState<ResolutionQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingActionId, setSavingActionId] = useState<string | null>(null);
  const [commentActionId, setCommentActionId] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [advanceConfirm, setAdvanceConfirm] = useState(false);
  const [collapsedRealms, setCollapsedRealms] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    setAdvanceConfirm(false);

    try {
      const [turnData, settlements, allRealms, queueData] = await Promise.all([
        parseResponse<CurrentTurnResponseDto>(await fetch(`/api/game/${gameId}/turn`, { cache: 'no-store' })),
        parseResponse<Array<{ id: string; name: string; kind?: string }>>(
          await fetch(`/api/game/${gameId}/settlements`, { cache: 'no-store' }),
        ),
        parseResponse<Array<{ id: string; name: string }>>(
          await fetch(`/api/game/${gameId}/realms`, { cache: 'no-store' }),
        ),
        parseResponse<{ queue: ResolutionQueueItem[] }>(
          await fetch(`/api/game/${gameId}/resolutions-queue`, { cache: 'no-store' }),
        ),
      ]);

      const noblesByRealm: Record<string, Array<{ value: string; label: string }>> = {};
      const realmIds = (turnData.realms ?? []).map((r) => r.realmId);
      const nobleResponses = await Promise.all(
        realmIds.map((rId) =>
          fetch(`/api/game/${gameId}/nobles?realmId=${rId}`, { cache: 'no-store' })
            .then((res) => res.ok ? res.json() as Promise<Array<{ id: string; name: string; reasonSkill: number; cunningSkill: number }>> : [])
        ),
      );
      for (let i = 0; i < realmIds.length; i++) {
        noblesByRealm[realmIds[i]] = (nobleResponses[i] ?? []).map((n) => ({ value: n.id, label: `${n.name} (R${n.reasonSkill} / C${n.cunningSkill})` }));
      }

      startTransition(() => {
        setCurrentTurn(turnData);
        setSettlementOptions(settlements
          .filter((settlement) => !settlement.kind || settlement.kind === 'settlement')
          .map((settlement) => ({ value: settlement.id, label: settlement.name })));
        setRealmOptions(allRealms.map((r) => ({ value: r.id, label: r.name })));
        setNobleOptionsByRealm(noblesByRealm);
        setResolutionQueue(queueData.queue);
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

  async function advanceTurn() {
    setAdvancing(true);
    setError('');

    try {
      await parseResponse(
        await fetch(`/api/game/${gameId}/turn/advance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            expectedYear: currentTurn?.game.currentYear,
            expectedSeason: currentTurn?.game.currentSeason,
          }),
        }),
      );
      setAdvanceConfirm(false);
      await refresh();
    } catch (advanceError) {
      setError(advanceError instanceof Error ? advanceError.message : 'Failed to advance turn');
    } finally {
      setAdvancing(false);
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
  const unsubmittedRealms = realms.filter((r) => !r.report || r.report.status !== 'submitted');
  const allSubmitted = unsubmittedRealms.length === 0;

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
        {realms.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-card-border bg-parchment-100/40 p-3">
            <div className="text-sm">
              <span className="font-semibold">Submissions: </span>
              {realms.length - unsubmittedRealms.length}/{realms.length} realms submitted
              {unsubmittedRealms.length > 0 && (
                <span className="ml-2 text-ink-300">
                  (waiting: {unsubmittedRealms.map((r) => r.realmName).join(', ')})
                </span>
              )}
            </div>
            {advanceConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-ink-400">
                  {allSubmitted
                    ? 'Advance to next turn?'
                    : 'Not all realms submitted. Advance anyway?'}
                </span>
                <Button variant="accent" size="sm" onClick={() => void advanceTurn()} disabled={advancing}>
                  {advancing ? 'Advancing...' : 'Confirm'}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setAdvanceConfirm(false)} disabled={advancing}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button variant="accent" size="sm" onClick={() => setAdvanceConfirm(true)}>
                Advance Turn
              </Button>
            )}
          </div>
        )}
        <Card variant="gold">
          <CardHeader>
            <CardTitle>Resolutions Queue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {resolutionQueue.length === 0 ? (
              <p className="text-sm text-ink-300">No submitted actions or open events need resolution.</p>
            ) : (
              resolutionQueue.map((item) => {
                const action = item.action;
                const event = item.event;
                const audienceNames = item.audienceRealmIds
                  .map((id) => realmOptions.find((realm) => realm.value === id)?.label ?? id)
                  .join(', ');
                return (
                  <div key={`${item.type}-${item.id}`} className="rounded border border-ink-100 bg-parchment-50 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={item.type === 'action' ? 'gold' : 'default'}>
                            {item.type === 'action' ? 'Action' : 'GM Event'}
                          </Badge>
                          {item.realmName ? <Badge>{item.realmName}</Badge> : null}
                          {action?.cost ? <Badge>Cost {action.cost.toLocaleString()}gc</Badge> : null}
                        </div>
                        <p className="text-sm font-semibold text-ink-600">
                          {action ? action.description || action.actionWords.join(', ') || action.kind : event?.title ?? event?.kind}
                        </p>
                        {item.assignedNoble ? (
                          <p className="text-xs text-ink-400">
                            {item.assignedNoble.name} | Reason {item.assignedNoble.reasonSkill} / Cunning {item.assignedNoble.cunningSkill}
                          </p>
                        ) : null}
                      </div>
                      <Badge variant="default">Audience: {audienceNames || 'none'}</Badge>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
        {realms.length === 0 ? (
          <p className="text-sm text-ink-300">No realms found for this game.</p>
        ) : (
          realms.map((realm) => {
            const isCollapsed = collapsedRealms.has(realm.realmId);
            return (
              <Card key={realm.realmId} variant="gold">
                <CardHeader>
                  <button
                    type="button"
                    className="flex w-full flex-wrap items-center justify-between gap-3 text-left cursor-pointer"
                    onClick={() => setCollapsedRealms((prev) => {
                      const next = new Set(prev);
                      if (next.has(realm.realmId)) next.delete(realm.realmId);
                      else next.add(realm.realmId);
                      return next;
                    })}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-ink-300 text-sm">{isCollapsed ? '▶' : '▼'}</span>
                      <CardTitle className="text-lg">{realm.realmName}</CardTitle>
                      <Badge variant="default">{realm.actions.length} action{realm.actions.length !== 1 ? 's' : ''}</Badge>
                    </div>
                    {realm.report ? <Badge>{realm.report.status}</Badge> : <Badge>No report</Badge>}
                  </button>
                </CardHeader>
                {!isCollapsed && (
                  <CardContent className="space-y-4">
                    {realm.events.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Events</p>
                        {realm.events.map((event) => (
                          <TurnEventCard key={event.id} event={event} />
                        ))}
                      </div>
                    ) : null}
                    {realm.actions.length === 0 ? (
                      <p className="text-sm text-ink-300">No actions submitted for this realm yet.</p>
                    ) : (
                      realm.actions.map((action: TurnActionRecord) => (
                        <TurnActionCard
                          key={`${action.id}:${action.updatedAt ?? ''}`}
                          action={action}
                          settlementOptions={settlementOptions}
                          realmOptions={realmOptions}
                          nobleOptions={nobleOptionsByRealm[realm.realmId] ?? []}
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
                )}
              </Card>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
