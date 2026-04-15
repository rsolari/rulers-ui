import { apiErrorResponse } from '@/lib/api-errors';
import { NextResponse } from 'next/server';
import { requireGM } from '@/lib/auth';
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
    const errorResponse = apiErrorResponse(error);
    if (errorResponse) return errorResponse;
    throw error;
  }
}
