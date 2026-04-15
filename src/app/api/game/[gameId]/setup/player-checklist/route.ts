import { apiErrorResponse } from '@/lib/api-errors';
import { NextResponse } from 'next/server';
import { requirePlayerSlot } from '@/lib/auth';
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
    const errorResponse = apiErrorResponse(error);
    if (errorResponse) return errorResponse;
    throw error;
  }
}
