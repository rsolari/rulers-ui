import { apiErrorResponse } from '@/lib/api-errors';
import { NextResponse } from 'next/server';
import { advanceGameTurn } from '@/lib/economy-service';
import { requireGM } from '@/lib/auth';
import type { Season } from '@/types/game';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    await requireGM(gameId);
    const rawBody = await request.text();
    const body = rawBody.length > 0 ? JSON.parse(rawBody) as {
      expectedYear?: number;
      expectedSeason?: Season;
      idempotencyKey?: string;
    } : {};
    const result = advanceGameTurn(gameId, {
      expectedYear: body.expectedYear,
      expectedSeason: body.expectedSeason,
      idempotencyKey: body.idempotencyKey ?? request.headers.get('Idempotency-Key'),
    });
    if (!result) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    const errorResponse = apiErrorResponse(error);
    if (errorResponse) return errorResponse;
    throw error;
  }
}
