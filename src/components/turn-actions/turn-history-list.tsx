'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TurnActionCard } from '@/components/turn-actions/turn-action-card';
import type { TurnHistoryEntry } from '@/types/game';

interface TurnHistoryListProps {
  history: TurnHistoryEntry[];
  settlementOptions: Array<{ value: string; label: string }>;
  showRealmName?: boolean;
}

export function TurnHistoryList({ history, settlementOptions, showRealmName = false }: TurnHistoryListProps) {
  if (history.length === 0) {
    return (
      <Card>
        <CardContent>
          <p className="pt-4 text-sm text-ink-300">No past turn history yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {history.map((entry) => (
        <Card key={entry.report?.id ?? `${entry.realmId}-${entry.realmName}-${entry.report?.year}`}>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>
                Year {entry.report?.year}, {entry.report?.season}
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                {showRealmName ? <Badge>{entry.realmName}</Badge> : null}
                {entry.report ? <Badge variant="gold">{entry.report.status}</Badge> : null}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {entry.actions.length === 0 ? (
              <p className="text-sm text-ink-300">No actions were recorded for this turn.</p>
            ) : (
              entry.actions.map((action) => (
                <TurnActionCard
                  key={`${action.id}:${action.updatedAt ?? ''}`}
                  action={action}
                  settlementOptions={settlementOptions}
                />
              ))
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
