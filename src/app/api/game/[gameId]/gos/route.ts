import { NextResponse } from 'next/server';
import { db } from '@/db';
import { gosRealms, guildsOrdersSocieties, nobles, realms } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { isAuthError, requireGM, requireRealmOwner } from '@/lib/auth';
import { recomputeGameInitState } from '@/lib/game-init-state';
import { assertNobleCanHoldExclusiveOffice, isGovernanceError } from '@/lib/game-logic/nobles';

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeRealmIds(body: Record<string, unknown>) {
  const requestedRealmIds = Array.isArray(body.realmIds)
    ? body.realmIds
    : typeof body.realmId === 'string'
      ? [body.realmId]
      : [];

  return [...new Set(
    requestedRealmIds
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
  )];
}

export async function GET(
  _request: Request
) {
  const url = new URL(_request.url);
  const realmId = url.searchParams.get('realmId');

  if (!realmId) {
    return NextResponse.json({ error: 'realmId required' }, { status: 400 });
  }

  const list = await db.select({
    id: guildsOrdersSocieties.id,
    realmId: guildsOrdersSocieties.realmId,
    name: guildsOrdersSocieties.name,
    type: guildsOrdersSocieties.type,
    focus: guildsOrdersSocieties.focus,
    leaderId: guildsOrdersSocieties.leaderId,
    treasury: guildsOrdersSocieties.treasury,
    creationSource: guildsOrdersSocieties.creationSource,
    monopolyProduct: guildsOrdersSocieties.monopolyProduct,
    alcoveNames: guildsOrdersSocieties.alcoveNames,
    centreNames: guildsOrdersSocieties.centreNames,
    firstBuildingId: guildsOrdersSocieties.firstBuildingId,
  })
    .from(guildsOrdersSocieties)
    .innerJoin(gosRealms, eq(gosRealms.gosId, guildsOrdersSocieties.id))
    .where(eq(gosRealms.realmId, realmId));
  const gosIds = list.map((gos) => gos.id);
  const membershipRows = gosIds.length > 0
    ? await db.select({
      gosId: gosRealms.gosId,
      realmId: realms.id,
      realmName: realms.name,
    })
      .from(gosRealms)
      .innerJoin(realms, eq(gosRealms.realmId, realms.id))
      .where(inArray(gosRealms.gosId, gosIds))
    : [];
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
  const primaryRealmByGosId = new Map(list.map((gos) => [gos.id, gos.realmId]));
  const membershipsByGosId = new Map<string, Array<{ id: string; name: string; isPrimary: boolean }>>();

  for (const membership of membershipRows) {
    const memberships = membershipsByGosId.get(membership.gosId) ?? [];
    memberships.push({
      id: membership.realmId,
      name: membership.realmName,
      isPrimary: primaryRealmByGosId.get(membership.gosId) === membership.realmId,
    });
    membershipsByGosId.set(membership.gosId, memberships);
  }

  return NextResponse.json(list.map((gos) => ({
    ...gos,
    alcoveNames: parseJson<string[]>(gos.alcoveNames, []),
    centreNames: parseJson<string[]>(gos.centreNames, []),
    leader: gos.leaderId ? leaderById.get(gos.leaderId) ?? null : null,
    realmIds: (membershipsByGosId.get(gos.id) ?? []).map((membership) => membership.id),
    realms: (membershipsByGosId.get(gos.id) ?? []).sort((left, right) => {
      if (left.isPrimary !== right.isPrimary) {
        return left.isPrimary ? -1 : 1;
      }
      return left.name.localeCompare(right.name);
    }),
    isShared: (membershipsByGosId.get(gos.id) ?? []).length > 1,
  })));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const body = await request.json();
    const realmIds = normalizeRealmIds(body);

    if (realmIds.length === 0) {
      return NextResponse.json({ error: 'At least one realm is required' }, { status: 400 });
    }

    await Promise.all(realmIds.map((realmId) => requireRealmOwner(gameId, realmId)));
    const requestedPrimaryRealmId = typeof body.realmId === 'string' ? body.realmId.trim() : '';
    const primaryRealmId = realmIds.includes(requestedPrimaryRealmId) ? requestedPrimaryRealmId : realmIds[0];
    const leaderId = typeof body.leaderId === 'string' && body.leaderId.trim()
      ? body.leaderId.trim()
      : null;

    if (leaderId) {
      const leader = await db.select().from(nobles)
        .where(eq(nobles.id, leaderId))
        .get();

      if (!leader || leader.realmId !== primaryRealmId) {
        return NextResponse.json({ error: 'Leader not found for this realm' }, { status: 404 });
      }

      assertNobleCanHoldExclusiveOffice(db, leader, primaryRealmId, 'leadership');
    }

    const id = uuid();
    db.transaction((tx) => {
      tx.insert(guildsOrdersSocieties).values({
        id,
        realmId: primaryRealmId,
        name: body.name,
        type: body.type,
        focus: body.focus || null,
        leaderId,
        treasury: Number.isInteger(body.treasury) ? body.treasury : 0,
        creationSource: body.creationSource || null,
        monopolyProduct: body.monopolyProduct || null,
        alcoveNames: Array.isArray(body.alcoveNames) ? JSON.stringify(body.alcoveNames) : null,
        centreNames: Array.isArray(body.centreNames) ? JSON.stringify(body.centreNames) : null,
        firstBuildingId: body.firstBuildingId || null,
      }).run();

      tx.insert(gosRealms).values(realmIds.map((realmId) => ({
        gosId: id,
        realmId,
      }))).run();
    });

    await recomputeGameInitState(gameId);

    return NextResponse.json({
      id,
      ...body,
      realmId: primaryRealmId,
      realmIds,
      treasury: Number.isInteger(body.treasury) ? body.treasury : 0,
      alcoveNames: Array.isArray(body.alcoveNames) ? body.alcoveNames : [],
      centreNames: Array.isArray(body.centreNames) ? body.centreNames : [],
    });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (isGovernanceError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    await requireGM(gameId);
    const body = await request.json();

    if (!body.gosId) {
      return NextResponse.json({ error: 'gosId required' }, { status: 400 });
    }

    const gos = await db.select().from(guildsOrdersSocieties)
      .where(eq(guildsOrdersSocieties.id, body.gosId))
      .get();

    if (!gos) {
      return NextResponse.json({ error: 'GOS not found' }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.type !== undefined) updates.type = body.type;
    if (body.focus !== undefined) updates.focus = body.focus || null;
    if (body.treasury !== undefined) updates.treasury = Number(body.treasury) || 0;
    if (body.monopolyProduct !== undefined) updates.monopolyProduct = body.monopolyProduct || null;
    if (body.alcoveNames !== undefined) updates.alcoveNames = Array.isArray(body.alcoveNames) ? JSON.stringify(body.alcoveNames) : null;
    if (body.centreNames !== undefined) updates.centreNames = Array.isArray(body.centreNames) ? JSON.stringify(body.centreNames) : null;
    if (body.firstBuildingId !== undefined) updates.firstBuildingId = body.firstBuildingId || null;

    db.transaction((tx) => {
      if (Object.keys(updates).length > 0) {
        tx.update(guildsOrdersSocieties)
          .set(updates)
          .where(eq(guildsOrdersSocieties.id, body.gosId))
          .run();
      }

      if (Array.isArray(body.realmIds)) {
        const filtered = (body.realmIds as unknown[])
          .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
          .map((v) => v.trim());
        const newRealmIds = [...new Set(filtered)];

        if (newRealmIds.length > 0) {
          tx.delete(gosRealms).where(eq(gosRealms.gosId, body.gosId)).run();
          tx.insert(gosRealms).values(
            newRealmIds.map((realmId) => ({ gosId: body.gosId as string, realmId })),
          ).run();
        }
      }
    });

    return NextResponse.json({ updated: true });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
