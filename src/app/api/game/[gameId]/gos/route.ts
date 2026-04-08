import { NextResponse } from 'next/server';
import { db } from '@/db';
import { guildsOrdersSocieties, nobles } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { isAuthError, requireOwnedRealmAccess } from '@/lib/auth';
import { recomputeGameInitState } from '@/lib/game-init-state';

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export async function GET(
  _request: Request
) {
  const url = new URL(_request.url);
  const realmId = url.searchParams.get('realmId');

  if (!realmId) {
    return NextResponse.json({ error: 'realmId required' }, { status: 400 });
  }

  const list = await db.select().from(guildsOrdersSocieties).where(eq(guildsOrdersSocieties.realmId, realmId));
  const leaderIds = [...new Set(
    list
      .map((gos) => gos.leaderId)
      .filter((leaderId): leaderId is string => Boolean(leaderId)),
  )];
  const leaders = leaderIds.length > 0
    ? await db.select({
      id: nobles.id,
      name: nobles.name,
      gmStatusText: nobles.gmStatusText,
    })
      .from(nobles)
      .where(inArray(nobles.id, leaderIds))
    : [];
  const leaderById = new Map(leaders.map((leader) => [leader.id, leader]));

  return NextResponse.json(list.map((gos) => ({
    ...gos,
    alcoveNames: parseJson<string[]>(gos.alcoveNames, []),
    centreNames: parseJson<string[]>(gos.centreNames, []),
    leader: gos.leaderId ? leaderById.get(gos.leaderId) ?? null : null,
  })));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const body = await request.json();
    await requireOwnedRealmAccess(gameId, body.realmId);

    const id = uuid();
    await db.insert(guildsOrdersSocieties).values({
      id,
      realmId: body.realmId,
      name: body.name,
      type: body.type,
      focus: body.focus || null,
      leaderId: body.leaderId || null,
      treasury: Number.isInteger(body.treasury) ? body.treasury : 0,
      creationSource: body.creationSource || null,
      monopolyProduct: body.monopolyProduct || null,
      alcoveNames: Array.isArray(body.alcoveNames) ? JSON.stringify(body.alcoveNames) : null,
      centreNames: Array.isArray(body.centreNames) ? JSON.stringify(body.centreNames) : null,
      firstBuildingId: body.firstBuildingId || null,
    });

    await recomputeGameInitState(gameId);

    return NextResponse.json({
      id,
      ...body,
      treasury: Number.isInteger(body.treasury) ? body.treasury : 0,
      alcoveNames: Array.isArray(body.alcoveNames) ? body.alcoveNames : [],
      centreNames: Array.isArray(body.centreNames) ? body.centreNames : [],
    });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
