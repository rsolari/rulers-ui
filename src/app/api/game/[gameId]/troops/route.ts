import { NextResponse } from 'next/server';
import { isAuthError, requireOwnedRealmAccess } from '@/lib/auth';
import { recomputeGameInitState } from '@/lib/game-init-state';
import { createTroopRecruitment, isRuleValidationError } from '@/lib/rules-action-service';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const body = await request.json();
    const { realmId } = await requireOwnedRealmAccess(gameId, body.realmId);
    const created = await createTroopRecruitment(gameId, {
      ...body,
      realmId,
    });

    await recomputeGameInitState(gameId);

    return NextResponse.json({
      id: created.row.id,
      realmId: created.row.realmId,
      type: created.row.type,
      class: created.row.class,
      cost: created.cost,
    }, { status: 201 });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (isRuleValidationError(error)) {
      return NextResponse.json({
        error: error.message,
        code: error.code,
        details: error.details ?? null,
      }, { status: error.status });
    }

    throw error;
  }
}
