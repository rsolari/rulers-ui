'use client';

import { Badge } from '@/components/ui/badge';
import type { ActionKind, TurnActionOutcome, TurnActionStatus } from '@/types/game';

const STATUS_VARIANTS: Record<TurnActionStatus, 'default' | 'gold' | 'green'> = {
  draft: 'default',
  submitted: 'gold',
  executed: 'green',
};

const OUTCOME_VARIANTS: Record<TurnActionOutcome, 'default' | 'gold' | 'green' | 'red'> = {
  pending: 'default',
  success: 'green',
  failure: 'red',
  partial: 'gold',
  void: 'default',
};

export function ActionKindBadge({ kind }: { kind: ActionKind }) {
  return <Badge variant={kind === 'political' ? 'gold' : 'default'}>{kind}</Badge>;
}

export function ActionStatusBadge({ status }: { status: TurnActionStatus }) {
  return <Badge variant={STATUS_VARIANTS[status]}>{status}</Badge>;
}

export function ActionOutcomeBadge({ outcome }: { outcome: TurnActionOutcome }) {
  return <Badge variant={OUTCOME_VARIANTS[outcome]}>{outcome}</Badge>;
}
