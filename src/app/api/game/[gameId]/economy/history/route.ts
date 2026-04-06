import { NextResponse } from 'next/server';
import { getRealmId } from '@/lib/auth';
import { getEconomyHistory } from '@/lib/economy-service';
import type { Season } from '@/types/game';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  const url = new URL(request.url);
  const requestedRealmId = url.searchParams.get('realmId') || await getRealmId();

  if (!requestedRealmId) {
    return NextResponse.json({ error: 'realmId required' }, { status: 400 });
  }

  const yearParam = url.searchParams.get('year');
  const seasonParam = url.searchParams.get('season');
  const year = yearParam ? Number(yearParam) : undefined;
  const season = seasonParam ? seasonParam as Season : undefined;

  const result = getEconomyHistory(gameId, requestedRealmId, {
    year: Number.isFinite(year) ? year : undefined,
    season,
  });

  return NextResponse.json(result);
}
