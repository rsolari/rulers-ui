import { apiErrorResponse } from '@/lib/api-errors';
import { NextResponse } from 'next/server';
import { requireOwnedRealmAccess, resolveSessionFromCookies } from '@/lib/auth';
import { createComment, listComments } from '@/lib/turn-action-service';
import { getTurnActorLabel } from '@/lib/turn-actors';
import type { ActionCommentCreateDto } from '@/types/game';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ gameId: string; actionId: string }> },
) {
  try {
    const { gameId, actionId } = await params;
    const session = await resolveSessionFromCookies();

    if (session.gameId !== gameId || !session.role) {
      return NextResponse.json({ error: 'Game access required' }, { status: 403 });
    }

    if (session.role === 'gm') {
      return NextResponse.json({ comments: listComments(gameId, actionId) });
    }

    const { realmId } = await requireOwnedRealmAccess(gameId, session.realmId);
    return NextResponse.json({ comments: listComments(gameId, actionId, realmId) });
  } catch (error) {
    const errorResponse = apiErrorResponse(error);
    if (errorResponse) return errorResponse;
    throw error;
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string; actionId: string }> },
) {
  try {
    const { gameId, actionId } = await params;
    const session = await resolveSessionFromCookies();
    const body = await request.json() as ActionCommentCreateDto;

    if (session.gameId !== gameId || !session.role) {
      return NextResponse.json({ error: 'Game access required' }, { status: 403 });
    }

    if (session.role === 'gm') {
      return NextResponse.json({
        comment: createComment(gameId, actionId, {
          role: 'gm',
          label: getTurnActorLabel('gm'),
        }, body.body),
      });
    }

    const { realmId } = await requireOwnedRealmAccess(gameId, session.realmId);
    return NextResponse.json({
      comment: createComment(gameId, actionId, {
        role: 'player',
        label: getTurnActorLabel('player', session.displayName),
      }, body.body, realmId),
    });
  } catch (error) {
    const errorResponse = apiErrorResponse(error);
    if (errorResponse) return errorResponse;
    throw error;
  }
}
