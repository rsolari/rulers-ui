'use client';

import { Badge } from '@/components/ui/badge';
import { deriveNobleActivity, type NobleActivityInput, type ActivityKind } from '@/lib/noble-activity';

const KIND_VARIANT: Record<ActivityKind, 'default' | 'gold' | 'red' | 'green'> = {
  ruler: 'gold',
  heir: 'gold',
  acting_ruler: 'gold',
  office: 'default',
  gm_status: 'default',
  prisoner: 'red',
  deceased: 'red',
  idle: 'default',
};

interface NobleActivityBadgeProps {
  noble: NobleActivityInput;
  /** Show only the summary as a single badge (default: false = show all lines). */
  compact?: boolean;
}

export function NobleActivityBadge({ noble, compact }: NobleActivityBadgeProps) {
  const activity = deriveNobleActivity(noble);

  if (compact) {
    const primaryKind = activity.lines[0]?.kind ?? 'idle';
    return <Badge variant={KIND_VARIANT[primaryKind]}>{activity.summary}</Badge>;
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {activity.lines.map((line, i) => (
        <Badge key={i} variant={KIND_VARIANT[line.kind]}>{line.label}</Badge>
      ))}
    </span>
  );
}
