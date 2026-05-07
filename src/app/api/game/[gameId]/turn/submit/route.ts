import { apiErrorResponse } from '@/lib/api-errors';
import { NextResponse } from 'next/server';
import { requireOwnedRealmAccess } from '@/lib/auth';
import { submitTurn } from '@/lib/turn-action-service';
import { getTurnActorLabel } from '@/lib/turn-actors';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  try {
    const { gameId } = await params;
    const rawBody = await request.text();
    const body = rawBody ? JSON.parse(rawBody) as { realmId?: string; displayName?: string } : {};
    const { realmId, session } = await requireOwnedRealmAccess(gameId, body.realmId);
    const role = session.role === 'gm' ? 'gm' : 'player';

    return NextResponse.json(submitTurn(gameId, realmId, {
      role,
      label: getTurnActorLabel(role, session.displayName),
    }));
  } catch (error) {
    const errorResponse = apiErrorResponse(error);
    if (errorResponse) return errorResponse;
    throw error;
  }
}
