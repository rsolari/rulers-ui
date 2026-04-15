import { apiErrorResponse } from '@/lib/api-errors';
import { NextResponse } from 'next/server';
import { requireOwnedRealmAccess, resolveSessionFromCookies } from '@/lib/auth';
import { getTurnHistory } from '@/lib/turn-action-service';

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
    const errorResponse = apiErrorResponse(error);
    if (errorResponse) return errorResponse;
    throw error;
  }
}
