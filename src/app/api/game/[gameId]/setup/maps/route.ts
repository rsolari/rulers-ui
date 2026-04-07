import { NextResponse } from 'next/server';
import { isAuthError, requireGM } from '@/lib/auth';
import { listCuratedMapDefinitions } from '@/lib/game-logic/maps';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    await requireGM(gameId);

    return NextResponse.json(listCuratedMapDefinitions());
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
