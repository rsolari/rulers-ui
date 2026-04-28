import { NextResponse } from 'next/server';
import { requireGM } from '@/lib/auth';
import { apiErrorResponse } from '@/lib/api-errors';
import { updateAction } from '@/lib/turn-action-service';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string; actionId: string }> },
) {
  try {
    const { gameId, actionId } = await params;
    await requireGM(gameId);
    const body = await request.json().catch(() => ({})) as { realmId?: string };

    return NextResponse.json({
      action: updateAction(gameId, actionId, body.realmId ?? '', {
        role: 'gm',
        label: 'GM',
      }, {
        status: 'pending',
        outcome: 'pending',
      }),
    });
  } catch (error) {
    const errorResponse = apiErrorResponse(error);
    if (errorResponse) return errorResponse;
    throw error;
  }
}
