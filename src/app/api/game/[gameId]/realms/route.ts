import { NextResponse } from 'next/server';
import { db } from '@/db';
import { games, realms } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { getGmCode, isAuthError, requireGM, requireInitState, requireRealmOwner } from '@/lib/auth';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  const realmList = await db.select().from(realms).where(eq(realms.gameId, gameId));
  return NextResponse.json(realmList);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    await requireGM(gameId);
    const body = await request.json();

    const id = uuid();
    await db.insert(realms).values({
      id,
      gameId,
      name: body.name,
      governmentType: body.governmentType,
      traditions: JSON.stringify(body.traditions || []),
      isNPC: body.isNPC || false,
      treasury: body.treasury || 0,
      taxType: body.taxType || 'Tribute',
      turmoil: 0,
      turmoilSources: '[]',
    });

    return NextResponse.json({ id, ...body });
  } catch (error) {
    if (isAuthError(error)) {
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
    const body = await request.json();

    if (!body.realmId) {
      return NextResponse.json({ error: 'realmId required' }, { status: 400 });
    }

    await requireRealmOwner(gameId, body.realmId);
    const game = await db.select().from(games).where(eq(games.id, gameId)).get();
    const gmCode = await getGmCode();
    const isGM = Boolean(game && gmCode && gmCode === game.gmCode);

    if (!isGM) {
      await requireInitState(gameId, 'parallel_final_setup', 'ready_to_start');
    }

    const allowedFields = isGM
      ? ['name', 'governmentType', 'traditions', 'treasury', 'taxType', 'turmoil', 'turmoilSources']
      : ['name', 'governmentType', 'traditions'];

    const disallowedKeys = Object.keys(body).filter((key) => key !== 'realmId' && !allowedFields.includes(key));
    if (disallowedKeys.length > 0) {
      return NextResponse.json({ error: `Forbidden fields: ${disallowedKeys.join(', ')}` }, { status: 403 });
    }

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.governmentType !== undefined) updates.governmentType = body.governmentType;
    if (body.traditions !== undefined) updates.traditions = JSON.stringify(body.traditions);
    if (isGM && body.treasury !== undefined) updates.treasury = body.treasury;
    if (isGM && body.taxType !== undefined) updates.taxType = body.taxType;
    if (isGM && body.turmoil !== undefined) updates.turmoil = body.turmoil;
    if (isGM && body.turmoilSources !== undefined) updates.turmoilSources = JSON.stringify(body.turmoilSources);

    await db.update(realms)
      .set(updates)
      .where(and(
        eq(realms.id, body.realmId),
        eq(realms.gameId, gameId),
      ));

    return NextResponse.json({ updated: true });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
