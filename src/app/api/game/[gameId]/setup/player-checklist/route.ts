import { NextResponse } from 'next/server';
import { isAuthError, requirePlayerSlot } from '@/lib/auth';
import { getGameSetupReadiness } from '@/lib/game-init-state';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const slot = await requirePlayerSlot(gameId);

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

    return NextResponse.json({
      setupState: playerStatus.setupState,
      checklist: playerStatus.checklist,
      missingRequirements: playerStatus.missingRequirements,
    });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
