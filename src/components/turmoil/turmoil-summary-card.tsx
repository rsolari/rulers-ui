import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TAX_TURMOIL } from '@/lib/game-logic/constants';
import type { TaxType, TurmoilSource } from '@/types/game';

interface TurmoilSummaryCardProps {
  title?: string;
  projectedTurmoil: number;
  buildingTurmoilReduction?: number;
  turmoilBreakdown: TurmoilSource[];
  taxType: TaxType;
  incidentLabel?: string | null;
}

export function TurmoilSummaryCard({
  title = 'Turmoil',
  projectedTurmoil,
  buildingTurmoilReduction = 0,
  turmoilBreakdown,
  taxType,
  incidentLabel,
}: TurmoilSummaryCardProps) {
  const variant = projectedTurmoil > 5 ? 'red' : projectedTurmoil > 2 ? 'gold' : 'green';
  const baseTurmoil = TAX_TURMOIL[taxType];

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
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-300">Base ({taxType} tax)</span>
            <strong>+{baseTurmoil}</strong>
          </div>
          {turmoilBreakdown.map((source) => (
            <div key={source.id} className="flex items-center justify-between text-sm">
              <span className="text-ink-300">{source.description}</span>
              <strong>{source.amount > 0 ? `+${source.amount}` : source.amount}</strong>
            </div>
          ))}
          {buildingTurmoilReduction > 0 ? (
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-300">Building reductions</span>
              <strong>-{buildingTurmoilReduction}</strong>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
