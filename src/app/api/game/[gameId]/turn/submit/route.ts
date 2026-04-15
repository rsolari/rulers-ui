import { apiErrorResponse } from '@/lib/api-errors';
import { NextResponse } from 'next/server';
import { requireOwnedRealmAccess } from '@/lib/auth';
import { submitTurn } from '@/lib/turn-action-service';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  try {
    const { gameId } = await params;
    const rawBody = await request.text();
    const body = rawBody ? JSON.parse(rawBody) as { realmId?: string; displayName?: string } : {};
    const { realmId, session } = await requireOwnedRealmAccess(gameId, body.realmId);
    const label = session.role === 'gm' ? 'GM' : session.displayName?.trim() || 'Player';

    return NextResponse.json(submitTurn(gameId, realmId, {
      role: session.role === 'gm' ? 'gm' : 'player',
      label,
    }));
  } catch (error) {
    const errorResponse = apiErrorResponse(error);
    if (errorResponse) return errorResponse;
    throw error;
  }
}
