import { NextResponse } from 'next/server';
import { db } from '@/db';
import { games } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { isAuthError, requireGM, requireInitState } from '@/lib/auth';
import { getGameSetupReadiness } from '@/lib/game-init-state';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    await requireGM(gameId);
    await requireInitState(gameId, 'ready_to_start');

    const readiness = await getGameSetupReadiness(gameId);
    if (!readiness) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    if (!readiness.canStart) {
      return NextResponse.json({
        error: 'Game setup is incomplete',
        gmSetupState: readiness.game.gmSetupState,
        blockers: readiness.blockers.map((blocker) => ({
          id: blocker.slotId,
          displayName: blocker.displayName,
          setupState: blocker.setupState,
          missingRequirements: blocker.missingRequirements,
        })),
      }, { status: 409 });
    }

    await db.update(games)
      .set({ initState: 'active', gamePhase: 'Active' })
      .where(eq(games.id, gameId));

    return NextResponse.json({ gameId, gamePhase: 'Active', initState: 'active' });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
