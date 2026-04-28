'use client';

import { Badge } from '@/components/ui/badge';
import type { TurnEventRecord } from '@/types/game';

const KIND_LABELS: Record<TurnEventRecord['kind'], string> = {
  gm_event: 'Event',
  turmoil_review: 'Turmoil Review',
  winter_unrest: 'Winter Unrest',
  action_resolution: 'Action Resolution',
  construction_complete: 'Construction Complete',
  recruit_complete: 'Recruitment Complete',
  ship_complete: 'Ship Complete',
  cross_realm_effect: 'Cross-Realm Effect',
};

const STATUS_VARIANTS: Record<TurnEventRecord['status'], 'default' | 'gold' | 'green'> = {
  open: 'gold',
  resolved: 'green',
  dismissed: 'default',
};

const OUTCOME_VARIANTS: Record<NonNullable<TurnEventRecord['outcome']>, 'default' | 'gold' | 'green' | 'red'> = {
  pending: 'default',
  success: 'green',
  failure: 'red',
  partial: 'gold',
  void: 'default',
  informational: 'default',
};

export function TurnEventCard({ event }: { event: TurnEventRecord }) {
  return (
    <div className="rounded border border-ink-100 bg-parchment-50/60 p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="gold">{KIND_LABELS[event.kind]}</Badge>
        <Badge variant={STATUS_VARIANTS[event.status]}>{event.status}</Badge>
        {event.outcome ? <Badge variant={OUTCOME_VARIANTS[event.outcome]}>{event.outcome}</Badge> : null}
        {event.abilityUsed && event.abilityModifier !== null ? (
          <Badge>{event.abilityUsed} {event.abilityModifier >= 0 ? '+' : ''}{event.abilityModifier}</Badge>
        ) : null}
        {event.title ? (
          <span className="text-sm font-semibold text-ink-600">{event.title}</span>
        ) : null}
      </div>
      {event.actionId ? (
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">
          Resolution of action {event.actionId.slice(0, 8)}
        </p>
      ) : null}
      {event.description ? (
        <p className="whitespace-pre-wrap text-sm text-ink-600">{event.description}</p>
      ) : null}
      {event.rolls.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {event.rolls.map((roll, index) => (
            <Badge key={`${roll.rolledAt ?? index}-${roll.dice.join('-')}`} variant="default">
              {roll.dice.join(', ')} | {roll.successes} success{roll.successes === 1 ? '' : 'es'}
            </Badge>
          ))}
        </div>
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
