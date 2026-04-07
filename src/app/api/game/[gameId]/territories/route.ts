import { NextResponse } from 'next/server';
import { db } from '@/db';
import { territories } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { isAuthError, requireGM } from '@/lib/auth';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  const list = await db.select().from(territories).where(eq(territories.gameId, gameId));
  return NextResponse.json(list);
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
    await db.insert(territories).values({
      id,
      gameId,
      name: body.name,
      realmId: body.realmId || null,
      description: body.description || null,
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
    await requireGM(gameId);
    const body = await request.json();

    if (!body.territoryId) {
      return NextResponse.json({ error: 'territoryId required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (body.realmId !== undefined) updates.realmId = body.realmId;
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;

    await db.update(territories)
      .set(updates)
      .where(and(
        eq(territories.id, body.territoryId),
        eq(territories.gameId, gameId),
      ));

    return NextResponse.json({ updated: true });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
