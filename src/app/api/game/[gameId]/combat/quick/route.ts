import { apiErrorResponse } from '@/lib/api-errors';
import { NextResponse } from 'next/server';
import { requireGM } from '@/lib/auth';
import { resolveArmyQuickCombat } from '@/lib/game-logic/quick-combat-service';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  try {
    const { gameId } = await params;
    await requireGM(gameId);
    const body = await request.json() as {
      attackerArmyId?: string;
      defenderArmyId?: string;
      defenderSettlementId?: string;
    };

    if (!body.attackerArmyId) {
      return NextResponse.json({ error: 'attackerArmyId required' }, { status: 400 });
    }

    const result = resolveArmyQuickCombat(gameId, {
      attackerArmyId: body.attackerArmyId,
      defenderArmyId: body.defenderArmyId,
      defenderSettlementId: body.defenderSettlementId,
    });

    return NextResponse.json(result);
  } catch (error) {
    const errorResponse = apiErrorResponse(error);
    if (errorResponse) return errorResponse;
    throw error;
  }
}
