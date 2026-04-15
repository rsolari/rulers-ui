import { apiErrorResponse } from '@/lib/api-errors';
import { NextResponse } from 'next/server';
import { requireOwnedRealmAccess } from '@/lib/auth';
import { createAction, listCurrentActions } from '@/lib/turn-action-service';
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
    const errorResponse = apiErrorResponse(error);
    if (errorResponse) return errorResponse;
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
    const errorResponse = apiErrorResponse(error);
    if (errorResponse) return errorResponse;
    throw error;
  }
}
