'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRole } from '@/hooks/use-role';
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

export default function ReportPage() {
  const params = useParams();
  const gameId = params.gameId as string;
  const { realmId } = useRole();
  const [game, setGame] = useState<Game | null>(null);
  const [report, setReport] = useState<TurnReport | null>(null);
  const [politicalActions, setPoliticalActions] = useState<PoliticalAction[]>([]);
  const [financialActions, setFinancialActions] = useState<FinancialAction[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!realmId) return;
    fetch(`/api/game/${gameId}/turn?realmId=${realmId}`).then(r => r.json()).then(data => {
      setGame(data.game);
      if (data.report) {
        setReport(data.report);
        setPoliticalActions(JSON.parse(data.report.politicalActions || '[]'));
        setFinancialActions(JSON.parse(data.report.financialActions || '[]'));
      }
    });
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

  function addFinancialAction() {
    setFinancialActions([...financialActions, { type: 'spending', description: '', cost: 0 }]);
  }

  async function saveReport(status: 'Draft' | 'Submitted') {
    if (!realmId) return;
    setSaving(true);
    await fetch(`/api/game/${gameId}/turn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        realmId,
        politicalActions,
        financialActions,
        status,
      }),
    });
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
          <div className="space-y-3">
            {financialActions.map((action, fIdx) => (
              <div key={fIdx} className="grid grid-cols-3 gap-3 p-3 medieval-border rounded">
                <Select
                  label="Type"
                  options={[
                    { value: 'build', label: 'Build' },
                    { value: 'recruit', label: 'Recruit' },
                    { value: 'taxChange', label: 'Tax Change' },
                    { value: 'spending', label: 'Spending' },
                  ]}
                  value={action.type}
                  onChange={e => {
                    const updated = [...financialActions];
                    updated[fIdx].type = e.target.value as FinancialAction['type'];
                    setFinancialActions(updated);
                  }}
                  disabled={isSubmitted}
                />
                <Input
                  label="Description"
                  value={action.description || ''}
                  onChange={e => {
                    const updated = [...financialActions];
                    updated[fIdx].description = e.target.value;
                    setFinancialActions(updated);
                  }}
                  disabled={isSubmitted}
                />
                <Input
                  label="Cost"
                  type="number"
                  value={String(action.cost)}
                  onChange={e => {
                    const updated = [...financialActions];
                    updated[fIdx].cost = parseInt(e.target.value) || 0;
                    setFinancialActions(updated);
                  }}
                  disabled={isSubmitted}
                />
              </div>
            ))}
          </div>
          {!isSubmitted && (
            <Button variant="outline" size="sm" className="mt-3" onClick={addFinancialAction}>
              + Add Financial Action
            </Button>
          )}
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
