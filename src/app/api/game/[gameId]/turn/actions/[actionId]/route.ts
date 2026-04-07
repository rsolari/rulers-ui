import { NextResponse } from 'next/server';
import { isAuthError, requireOwnedRealmAccess, resolveSessionFromCookies } from '@/lib/auth';
import { deleteAction, isTurnActionError, updateAction } from '@/lib/turn-action-service';
import type { TurnActionUpdateDto } from '@/types/game';

function getActorLabel(role: 'player' | 'gm', displayName?: string | null) {
  if (role === 'gm') return 'GM';
  return displayName?.trim() || 'Player';
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ gameId: string; actionId: string }> },
) {
  try {
    const { gameId, actionId } = await params;
    const session = await resolveSessionFromCookies();
    const body = await request.json() as TurnActionUpdateDto & { realmId?: string };

    if (session.gameId !== gameId || !session.role) {
      return NextResponse.json({ error: 'Game access required' }, { status: 403 });
    }

    if (session.role === 'gm') {
      return NextResponse.json({
        action: updateAction(gameId, actionId, body.realmId ?? '', {
          role: 'gm',
          label: getActorLabel('gm'),
        }, body),
      });
    }

    const { realmId } = await requireOwnedRealmAccess(gameId, body.realmId);
    return NextResponse.json({
      action: updateAction(gameId, actionId, realmId, {
        role: 'player',
        label: getActorLabel('player', session.displayName),
      }, body),
    });
  } catch (error) {
    if (isAuthError(error) || isTurnActionError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ gameId: string; actionId: string }> },
) {
  try {
    const { gameId, actionId } = await params;
    const url = new URL(request.url);
    const requestedRealmId = url.searchParams.get('realmId');
    const session = await resolveSessionFromCookies();

    if (session.gameId !== gameId || session.role !== 'player') {
      return NextResponse.json({ error: 'Player access required' }, { status: 403 });
    }

    const { realmId } = await requireOwnedRealmAccess(gameId, requestedRealmId);
    deleteAction(gameId, actionId, realmId);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    if (isAuthError(error) || isTurnActionError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
