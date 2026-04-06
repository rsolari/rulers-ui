import { NextResponse } from 'next/server';
import { getEconomyOverview } from '@/lib/economy-service';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  const result = getEconomyOverview(gameId);

  if (!result) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  return NextResponse.json({ realms: result.realms });
}
