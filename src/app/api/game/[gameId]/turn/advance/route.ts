import { NextResponse } from 'next/server';
import { advanceGameTurn } from '@/lib/economy-service';
import { isAuthError, requireGM } from '@/lib/auth';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    await requireGM(gameId);
    const result = advanceGameTurn(gameId);
    if (!result) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
