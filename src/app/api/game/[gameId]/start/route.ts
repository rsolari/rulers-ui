import { NextResponse } from 'next/server';
import { db } from '@/db';
import { games, playerSlots } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { isAuthError, requireGM, requireInitState } from '@/lib/auth';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    await requireGM(gameId);
    const game = await requireInitState(gameId, 'ready_to_start');

    const incompleteSlots = await db.select({
      id: playerSlots.id,
      displayName: playerSlots.displayName,
      setupState: playerSlots.setupState,
    }).from(playerSlots).where(eq(playerSlots.gameId, gameId));

    const blockers = incompleteSlots.filter((slot) => slot.setupState !== 'ready');
    if (game.gmSetupState !== 'ready' || blockers.length > 0) {
      return NextResponse.json({
        error: 'Game setup is incomplete',
        gmSetupState: game.gmSetupState,
        blockers,
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
