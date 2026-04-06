import { NextResponse } from 'next/server';
import { getRealmId } from '@/lib/auth';
import { getEconomyProjection } from '@/lib/economy-service';

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

  const result = getEconomyProjection(gameId, requestedRealmId);
  if (!result) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  if (!result.projection) {
    return NextResponse.json({ error: 'Realm not found' }, { status: 404 });
  }

  return NextResponse.json(result.projection);
}
