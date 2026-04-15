import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/lib/api-errors';
import { resolveSessionFromCookies } from '@/lib/auth';
import { getCurrentTurn } from '@/lib/turn-action-service';

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
    const errorResponse = apiErrorResponse(error);
    if (errorResponse) return errorResponse;
    throw error;
  }
}
