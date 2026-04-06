import { NextResponse } from 'next/server';
import { isAuthError, requireGM } from '@/lib/auth';
import { getEconomyOverview } from '@/lib/economy-service';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    await requireGM(gameId);

    const result = getEconomyOverview(gameId);

    if (!result) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    return NextResponse.json({ realms: result.realms });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
