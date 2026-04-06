import { NextResponse } from 'next/server';
import { db } from '@/db';
import { turnEvents } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { isAuthError, requireGM } from '@/lib/auth';
import { normalizeEconomicModifiers } from '@/lib/game-logic/economic-modifiers';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  const list = await db.select().from(turnEvents)
    .where(eq(turnEvents.gameId, gameId))
    .orderBy(desc(turnEvents.year));
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
    const modifiers = normalizeEconomicModifiers(body.modifiers ?? body.mechanicalEffect, {
      description: body.description,
      idPrefix: id,
    });
    const mechanicalEffect =
      modifiers.length > 0
        ? JSON.stringify(modifiers)
        : typeof body.mechanicalEffect === 'string'
          ? body.mechanicalEffect
          : null;

    await db.insert(turnEvents).values({
      id,
      gameId,
      year: body.year,
      season: body.season,
      realmId: body.realmId || null,
      description: body.description,
      mechanicalEffect,
    });

    return NextResponse.json({ id, ...body, mechanicalEffect });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
