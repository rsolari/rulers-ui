import { NextResponse } from 'next/server';
import { advanceGameTurn, isEconomyResolutionError } from '@/lib/economy-service';
import { isAuthError, requireGM } from '@/lib/auth';
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
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (isEconomyResolutionError(error)) {
      return NextResponse.json({
        error: error.message,
        code: error.code,
        details: error.details ?? null,
      }, { status: error.status });
    }

    throw error;
  }
}
