import { NextResponse } from 'next/server';
import { isAuthError, requireOwnedRealmAccess } from '@/lib/auth';
import { createAction, isTurnActionError, listCurrentActions } from '@/lib/turn-action-service';
import type { TurnActionCreateDto } from '@/types/game';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  try {
    const { gameId } = await params;
    const url = new URL(request.url);
    const requestedRealmId = url.searchParams.get('realmId');
    const { realmId } = await requireOwnedRealmAccess(gameId, requestedRealmId);
    return NextResponse.json(listCurrentActions(gameId, realmId));
  } catch (error) {
    if (isAuthError(error) || isTurnActionError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  try {
    const { gameId } = await params;
    const body = await request.json() as TurnActionCreateDto & { realmId?: string };
    const { realmId } = await requireOwnedRealmAccess(gameId, body.realmId);
    return NextResponse.json({ action: createAction(gameId, realmId, body) });
  } catch (error) {
    if (isAuthError(error) || isTurnActionError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
