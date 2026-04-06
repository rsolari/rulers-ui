import { NextResponse } from 'next/server';
import { isAuthError, requireRealmOwner, resolveSessionFromCookies } from '@/lib/auth';
import { getEconomyHistory } from '@/lib/economy-service';
import type { Season } from '@/types/game';

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

    const yearParam = url.searchParams.get('year');
    const seasonParam = url.searchParams.get('season');
    const year = yearParam ? Number(yearParam) : undefined;
    const season = seasonParam ? seasonParam as Season : undefined;

    const result = getEconomyHistory(gameId, effectiveRealmId, {
      year: Number.isFinite(year) ? year : undefined,
      season,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
