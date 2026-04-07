import { NextResponse } from 'next/server';
import { db } from '@/db';
import { games } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { isAuthError, requireGM } from '@/lib/auth';
import { getGameSetupReadiness, recomputeGameInitState } from '@/lib/game-init-state';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    await requireGM(gameId);

    const game = await recomputeGameInitState(gameId);
    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    if (game.initState === 'active' || game.initState === 'completed') {
      return NextResponse.json({ error: 'Game has already started' }, { status: 409 });
    }

    const readiness = await getGameSetupReadiness(gameId);
    if (!readiness) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    if (game.initState !== 'ready_to_start' || !readiness.canStart) {
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
