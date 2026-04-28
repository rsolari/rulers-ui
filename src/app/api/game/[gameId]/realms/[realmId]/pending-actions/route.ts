import { NextResponse } from 'next/server';
import { requireOwnedRealmAccess, resolveSessionFromCookies } from '@/lib/auth';
import { apiErrorResponse } from '@/lib/api-errors';
import { getPendingFinancialActionsForRealm } from '@/lib/turn-event-service';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ gameId: string; realmId: string }> },
) {
  try {
    const { gameId, realmId } = await params;
    const session = await resolveSessionFromCookies();
    if (session.gameId !== gameId || !session.role) {
      return NextResponse.json({ error: 'Game access required' }, { status: 403 });
    }
    if (session.role !== 'gm') {
      await requireOwnedRealmAccess(gameId, realmId);
    }

    return NextResponse.json({
      pendingFinancial: getPendingFinancialActionsForRealm(realmId),
    });
  } catch (error) {
    const errorResponse = apiErrorResponse(error);
    if (errorResponse) return errorResponse;
    throw error;
  }
}
