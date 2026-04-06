import { NextResponse } from 'next/server';
import { db } from '@/db';
import { games } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { isAuthError, requireGM, requireGamePhase } from '@/lib/auth';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    await requireGM(gameId);
    await requireGamePhase(gameId, 'RealmCreation');

    await db.update(games)
      .set({ gamePhase: 'Active' })
      .where(eq(games.id, gameId));

    return NextResponse.json({ gameId, gamePhase: 'Active' });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
