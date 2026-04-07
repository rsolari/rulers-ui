'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRole } from '@/hooks/use-role';
import { TurnReportFinancialActionsEditor } from '@/components/turn-report-financial-actions-editor';
import { normalizeFinancialActions } from '@/lib/financial-actions';
import { ACTION_WORDS } from '@/types/game';
import type { PoliticalAction, FinancialAction, ActionWord } from '@/types/game';
import { MAX_ACTION_WORDS_PER_TURN } from '@/lib/game-logic/constants';

interface Game {
  id: string;
  currentYear: number;
  currentSeason: string;
  turnPhase: string;
}

interface TurnReport {
  id: string;
  status: string;
  financialActions: string;
  politicalActions: string;
}

interface Settlement {
  id: string;
  name: string;
}

interface Territory {
  id: string;
  name: string;
  realmId: string | null;
}

interface Gos {
  id: string;
  name: string;
  type: string;
}

export default function ReportPage() {
  const params = useParams();
  const gameId = params.gameId as string;
  const { realmId } = useRole();
  const [game, setGame] = useState<Game | null>(null);
  const [report, setReport] = useState<TurnReport | null>(null);
  const [politicalActions, setPoliticalActions] = useState<PoliticalAction[]>([]);
  const [financialActions, setFinancialActions] = useState<FinancialAction[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [gos, setGos] = useState<Gos[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!realmId) return;

    async function loadReport() {
      const [turnResponse, settlementsResponse, territoriesResponse, gosResponse] = await Promise.all([
        fetch(`/api/game/${gameId}/turn?realmId=${realmId}`),
        fetch(`/api/game/${gameId}/settlements?realmId=${realmId}`),
        fetch(`/api/game/${gameId}/territories`),
        fetch(`/api/game/${gameId}/gos?realmId=${realmId}`),
      ]);

      const turnData = await turnResponse.json();
      setGame(turnData.game);
      setSettlements(settlementsResponse.ok ? await settlementsResponse.json() : []);
      setTerritories(
        territoriesResponse.ok
          ? (await territoriesResponse.json()).filter((territory: Territory) => territory.realmId === realmId)
          : [],
      );
      setGos(gosResponse.ok ? await gosResponse.json() : []);

      if (turnData.report) {
        setReport(turnData.report);
        setPoliticalActions(JSON.parse(turnData.report.politicalActions || '[]'));
        setFinancialActions(normalizeFinancialActions(JSON.parse(turnData.report.financialActions || '[]')));
      }
    }

    void loadReport();
  }, [gameId, realmId]);

  const usedActionWords = politicalActions.reduce((sum, a) => sum + a.actionWords.length, 0);

  function addPoliticalAction() {
    setPoliticalActions([...politicalActions, { actionWords: [], description: '' }]);
  }

  function updatePoliticalAction(idx: number, field: keyof PoliticalAction, value: unknown) {
    const updated = [...politicalActions];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (updated[idx] as any)[field] = value;
    setPoliticalActions(updated);
  }

  function toggleActionWord(actionIdx: number, word: ActionWord) {
    const updated = [...politicalActions];
    const action = updated[actionIdx];
    if (action.actionWords.includes(word)) {
      action.actionWords = action.actionWords.filter(w => w !== word);
    } else if (usedActionWords < MAX_ACTION_WORDS_PER_TURN) {
      action.actionWords = [...action.actionWords, word];
    }
    setPoliticalActions(updated);
  }

  async function saveReport(status: 'Draft' | 'Submitted') {
    if (!realmId) return;
    setError('');
    setSaving(true);
    const response = await fetch(`/api/game/${gameId}/turn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        realmId,
        politicalActions,
        financialActions,
        status,
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error || 'Failed to save report');
      setSaving(false);
      return;
    }

    const savedReport = await response.json();
    if (Array.isArray(savedReport.financialActions)) {
      setFinancialActions(normalizeFinancialActions(savedReport.financialActions));
    }

    setSaving(false);
    if (status === 'Submitted') {
      window.location.reload();
    }
  }

  if (!game) {
    return <main className="min-h-screen flex items-center justify-center">
      <p className="font-heading text-ink-300">Loading...</p>
    </main>;
  }

  const isSubmitted = report?.status === 'Submitted' || report?.status === 'Resolved';

  return (
    <main className="min-h-screen p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Turn Report</h1>
        <Badge variant="gold">Year {game.currentYear}, {game.currentSeason}</Badge>
      </div>

      {isSubmitted && (
        <Card className="mb-6" variant="gold">
          <CardContent>
            <p className="font-heading font-bold pt-4">Report {report?.status}</p>
            <p className="text-sm text-ink-300">Your report has been submitted. Await the GM&apos;s resolution.</p>
          </CardContent>
        </Card>
      )}

      {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

      {/* Political Actions */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Political Actions</CardTitle>
            <Badge>Action Words: {usedActionWords}/{MAX_ACTION_WORDS_PER_TURN}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {politicalActions.map((action, aIdx) => (
              <div key={aIdx} className="p-3 medieval-border rounded space-y-3">
                <div>
                  <p className="text-sm font-semibold mb-1">Action Words ({action.actionWords.length})</p>
                  <div className="flex flex-wrap gap-1">
                    {ACTION_WORDS.map(word => (
                      <Badge
                        key={word}
                        variant={action.actionWords.includes(word) ? 'gold' : 'default'}
                        className="cursor-pointer text-xs"
                        onClick={() => !isSubmitted && toggleActionWord(aIdx, word)}
                      >
                        {word}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Input
                  label="Description"
                  value={action.description}
                  onChange={e => updatePoliticalAction(aIdx, 'description', e.target.value)}
                  disabled={isSubmitted}
                />
              </div>
            ))}
          </div>
          {!isSubmitted && (
            <Button variant="outline" size="sm" className="mt-3" onClick={addPoliticalAction}>
              + Add Political Action
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Financial Actions */}
      <Card className="mb-6">
        <CardHeader><CardTitle>Financial Actions</CardTitle></CardHeader>
        <CardContent>
          <TurnReportFinancialActionsEditor
            actions={financialActions}
            settlements={settlements}
            territories={territories}
            gos={gos}
            isSubmitted={isSubmitted}
            onChange={setFinancialActions}
          />
        </CardContent>
      </Card>

      {!isSubmitted && (
        <div className="flex justify-between">
          <Button variant="ghost" onClick={() => saveReport('Draft')} disabled={saving}>
            {saving ? 'Saving...' : 'Save Draft'}
          </Button>
          <Button variant="accent" size="lg" onClick={() => saveReport('Submitted')} disabled={saving}>
            {saving ? 'Submitting...' : 'Submit Report'}
          </Button>
        </div>
      )}
    </main>
  );
}
