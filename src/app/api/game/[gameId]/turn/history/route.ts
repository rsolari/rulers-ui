import { NextResponse } from 'next/server';
import { isAuthError, requireOwnedRealmAccess, resolveSessionFromCookies } from '@/lib/auth';
import { getTurnHistory, isTurnActionError } from '@/lib/turn-action-service';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  try {
    const { gameId } = await params;
    const session = await resolveSessionFromCookies();
    const url = new URL(request.url);
    const requestedRealmId = url.searchParams.get('realmId');

    if (session.gameId !== gameId || !session.role) {
      return NextResponse.json({ error: 'Game access required' }, { status: 403 });
    }

    if (session.role === 'gm') {
      return NextResponse.json(getTurnHistory(gameId, requestedRealmId ?? undefined));
    }

    const { realmId } = await requireOwnedRealmAccess(gameId, requestedRealmId);
    return NextResponse.json(getTurnHistory(gameId, realmId));
  } catch (error) {
    if (isAuthError(error) || isTurnActionError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
