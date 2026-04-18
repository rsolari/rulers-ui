'use client';

import { Badge } from '@/components/ui/badge';
import type { TurnEventRecord } from '@/types/game';

const KIND_LABELS: Record<TurnEventRecord['kind'], string> = {
  gm_event: 'Event',
  turmoil_review: 'Turmoil Review',
  winter_unrest: 'Winter Unrest',
};

const STATUS_VARIANTS: Record<TurnEventRecord['status'], 'default' | 'gold' | 'green'> = {
  open: 'gold',
  resolved: 'green',
  dismissed: 'default',
};

export function TurnEventCard({ event }: { event: TurnEventRecord }) {
  return (
    <div className="rounded border border-ink-100 bg-parchment-50/60 p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="gold">{KIND_LABELS[event.kind]}</Badge>
        <Badge variant={STATUS_VARIANTS[event.status]}>{event.status}</Badge>
        {event.title ? (
          <span className="text-sm font-semibold text-ink-600">{event.title}</span>
        ) : null}
      </div>
      {event.description ? (
        <p className="whitespace-pre-wrap text-sm text-ink-600">{event.description}</p>
      ) : null}
      {event.resolution ? (
        <div className="rounded border border-ink-100 bg-parchment-50 p-2">
          <p className="text-xs font-semibold text-ink-400 mb-1">Resolution</p>
          <p className="whitespace-pre-wrap text-sm text-ink-600">{event.resolution}</p>
        </div>
      ) : null}
    </div>
  );
}
