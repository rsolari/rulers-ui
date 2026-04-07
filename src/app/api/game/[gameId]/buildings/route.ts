import { NextResponse } from 'next/server';
import { isAuthError, requireGM } from '@/lib/auth';
import { createBuilding, isRuleValidationError } from '@/lib/rules-action-service';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    await requireGM(gameId);
    const body = await request.json();
    const created = await createBuilding(gameId, body);

    return NextResponse.json({
      id: created.row.id,
      type: created.row.type,
      size: created.effectiveSize,
      locationType: created.row.locationType,
      settlementId: created.row.settlementId,
      territoryId: created.row.territoryId,
      hexId: created.row.hexId,
      constructionTurns: created.constructionTurns,
      cost: created.cost,
      notes: created.notes,
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
