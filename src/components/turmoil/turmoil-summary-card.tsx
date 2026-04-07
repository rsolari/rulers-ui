import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { TurmoilSource } from '@/types/game';

interface TurmoilSummaryCardProps {
  title?: string;
  projectedTurmoil: number;
  turmoilBreakdown: TurmoilSource[];
  incidentLabel?: string | null;
}

export function TurmoilSummaryCard({
  title = 'Turmoil',
  projectedTurmoil,
  turmoilBreakdown,
  incidentLabel,
}: TurmoilSummaryCardProps) {
  const variant = projectedTurmoil > 5 ? 'red' : projectedTurmoil > 2 ? 'gold' : 'green';

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span>Projected</span>
          <Badge variant={variant}>{projectedTurmoil}</Badge>
        </div>
        {incidentLabel ? (
          <div className="flex items-center justify-between">
            <span>Open incident</span>
            <Badge variant="gold">{incidentLabel}</Badge>
          </div>
        ) : null}
        <div className="space-y-2">
          {turmoilBreakdown.length > 0 ? turmoilBreakdown.map((source) => (
            <div key={source.id} className="flex items-center justify-between text-sm">
              <span className="text-ink-300">{source.description}</span>
              <strong>{source.amount > 0 ? `+${source.amount}` : source.amount}</strong>
            </div>
          )) : (
            <p className="text-sm text-ink-300">No active turmoil sources.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
