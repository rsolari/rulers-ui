import { apiErrorResponse } from '@/lib/api-errors';
import { NextResponse } from 'next/server';
import { requireRealmOwner, resolveSessionFromCookies } from '@/lib/auth';
import { getEconomyProjection } from '@/lib/economy-service';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const url = new URL(request.url);
    const session = await resolveSessionFromCookies();
    const requestedRealmId = url.searchParams.get('realmId');
    const effectiveRealmId = session.gameId === gameId && session.role === 'player'
      ? session.realmId
      : requestedRealmId;

    if (session.gameId === gameId && session.role === 'player' && !effectiveRealmId) {
      return NextResponse.json({ error: 'Realm access required' }, { status: 403 });
    }

    if (!effectiveRealmId) {
      return NextResponse.json({ error: 'realmId required' }, { status: 400 });
    }

    await requireRealmOwner(gameId, effectiveRealmId);

    const result = getEconomyProjection(gameId, effectiveRealmId);
    if (!result) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    if (!result.projection) {
      return NextResponse.json({ error: 'Realm not found' }, { status: 404 });
    }

    return NextResponse.json(result.projection);
  } catch (error) {
    const errorResponse = apiErrorResponse(error);
    if (errorResponse) return errorResponse;
    throw error;
  }
}
