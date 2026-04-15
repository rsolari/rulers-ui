import { apiErrorResponse } from '@/lib/api-errors';
import { NextResponse } from 'next/server';
import { requireGM, requireInitState } from '@/lib/auth';
import { getGameSetupReadiness, setGMSetupState, toLegacyGamePhase } from '@/lib/game-init-state';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    await requireGM(gameId);
    await requireInitState(gameId, 'player_invites_open', 'parallel_final_setup', 'ready_to_start');

    const game = await setGMSetupState(gameId, 'ready');
    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    return NextResponse.json({
      gameId,
      initState: game.initState,
      gmSetupState: game.gmSetupState,
      gamePhase: toLegacyGamePhase(game.initState),
      blockers: game.initState === 'ready_to_start'
        ? []
        : (await getGameSetupReadiness(gameId))?.blockers.map((blocker) => ({
          id: blocker.slotId,
          displayName: blocker.displayName,
          setupState: blocker.setupState,
          missingRequirements: blocker.missingRequirements,
        })) ?? [],
    });
  } catch (error) {
    const errorResponse = apiErrorResponse(error);
    if (errorResponse) return errorResponse;
    throw error;
  }
}
