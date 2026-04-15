import { NextResponse } from 'next/server';
import { isAuthError } from '@/lib/auth';
import { isTurnActionError } from '@/lib/turn-action-service';
import { isGovernanceError } from '@/lib/game-logic/nobles';
import { isRuleValidationError } from '@/lib/rules-action-service';
import { isEconomyResolutionError } from '@/lib/economy-service';
import { isQuickCombatError } from '@/lib/game-logic/quick-combat-service';

export function apiErrorResponse(error: unknown): NextResponse | null {
  if (isAuthError(error) || isGovernanceError(error)) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  if (isTurnActionError(error) || isRuleValidationError(error) || isEconomyResolutionError(error)) {
    return NextResponse.json(
      { error: error.message, code: error.code, details: error.details ?? null },
      { status: error.status },
    );
  }

  if (isQuickCombatError(error)) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }

  return null;
}
