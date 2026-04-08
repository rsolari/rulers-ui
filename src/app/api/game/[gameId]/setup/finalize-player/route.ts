import { NextResponse } from 'next/server';
import { isAuthError, requirePlayerSlot } from '@/lib/auth';
import { getGameSetupReadiness, recomputeGameInitState } from '@/lib/game-init-state';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const slot = await requirePlayerSlot(gameId);

    // Recompute to ensure latest state
    await recomputeGameInitState(gameId);

    const readiness = await getGameSetupReadiness(gameId);
    if (!readiness) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    const playerStatus = readiness.playerStatuses.find(
      (status) => status.slotId === slot.id
    );

    if (!playerStatus) {
      return NextResponse.json({ error: 'Player slot not found' }, { status: 404 });
    }

    if (playerStatus.setupState !== 'ready') {
      return NextResponse.json({
        error: 'Setup is not complete',
        missingRequirements: playerStatus.missingRequirements,
        checklist: playerStatus.checklist,
      }, { status: 400 });
    }

    return NextResponse.json({
      setupState: playerStatus.setupState,
      checklist: playerStatus.checklist,
    });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
