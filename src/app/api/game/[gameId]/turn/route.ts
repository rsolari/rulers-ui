import { NextResponse } from 'next/server';
import { isAuthError, resolveSessionFromCookies } from '@/lib/auth';
import { getCurrentTurn, isTurnActionError } from '@/lib/turn-action-service';
import { isRuleValidationError } from '@/lib/rules-action-service';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  try {
    const { gameId } = await params;
    const url = new URL(request.url);
    const requestedRealmId = url.searchParams.get('realmId');
    const session = await resolveSessionFromCookies();

    if (session.gameId === gameId && session.role === 'player') {
      if (!session.realmId) {
        return NextResponse.json({ error: 'Realm access required' }, { status: 403 });
      }

      return NextResponse.json(getCurrentTurn(gameId, session.realmId));
    }

    if (session.gameId === gameId && session.role === 'gm') {
      return NextResponse.json(getCurrentTurn(gameId, requestedRealmId ?? undefined));
    }

    return NextResponse.json({ error: 'Game access required' }, { status: 403 });
  } catch (error) {
    if (isAuthError(error) || isTurnActionError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (isRuleValidationError(error)) {
      return NextResponse.json({
        error: error.message,
        code: error.code,
        details: error.details ?? null,
      }, { status: error.status });
    }

    throw error;
  }
}
