import { NextResponse } from 'next/server';
import { isAuthError, requireOwnedRealmAccess } from '@/lib/auth';
import { isTurnActionError, submitTurn } from '@/lib/turn-action-service';

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
    if (isAuthError(error) || isTurnActionError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
