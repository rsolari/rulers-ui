import { NextResponse } from 'next/server';
import { isAuthError, requireGM } from '@/lib/auth';
import { isQuickCombatError, resolveArmyQuickCombat } from '@/lib/game-logic/quick-combat-service';

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
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (isQuickCombatError(error)) {
      return NextResponse.json({
        error: error.message,
        code: error.code,
      }, { status: error.status });
    }

    throw error;
  }
}
