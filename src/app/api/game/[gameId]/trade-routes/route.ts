import { apiErrorResponse } from '@/lib/api-errors';
import { NextResponse } from 'next/server';
import { requireGM } from '@/lib/auth';
import { createTradeRoute } from '@/lib/rules-action-service';
import { getTradeRouteOverview } from '@/lib/economy-service';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  const list = getTradeRouteOverview(gameId) ?? [];
  return NextResponse.json(list);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    await requireGM(gameId);
    const body = await request.json();
    const created = await createTradeRoute(gameId, body);

    return NextResponse.json({
      id: created.row.id,
      realm1Id: created.row.realm1Id,
      realm2Id: created.row.realm2Id,
      settlement1Id: created.row.settlement1Id,
      settlement2Id: created.row.settlement2Id,
      pathMode: created.row.pathMode,
      isActive: created.row.isActive,
      productsExported1to2: created.exports.productsExported1to2,
      productsExported2to1: created.exports.productsExported2to1,
      protectedProducts: [],
    }, { status: 201 });
  } catch (error) {
    const errorResponse = apiErrorResponse(error);
    if (errorResponse) return errorResponse;
    throw error;
  }
}
