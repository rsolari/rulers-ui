import { apiErrorResponse } from '@/lib/api-errors';
import { NextResponse } from 'next/server';
import { generateMap } from '@/lib/game-logic/map-generation';
import { requireGM } from '@/lib/auth';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    await requireGM(gameId);

    const body = await request.json();
    const territories = Array.isArray(body.territories) ? body.territories : [];

    return NextResponse.json(generateMap(territories));
  } catch (error) {
    const errorResponse = apiErrorResponse(error);
    if (errorResponse) return errorResponse;
    throw error;
  }
}
