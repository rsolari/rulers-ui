import { apiErrorResponse } from '@/lib/api-errors';
import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { db } from '@/db';
import { gameMaps, mapHexes, mapLandmarks } from '@/db/schema';
import { requireGM } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  const url = new URL(request.url);
  const hexId = url.searchParams.get('hexId');

  const landmarks = hexId
    ? await db.select().from(mapLandmarks).where(and(
      eq(mapLandmarks.gameId, gameId),
      eq(mapLandmarks.hexId, hexId),
    ))
    : await db.select().from(mapLandmarks).where(eq(mapLandmarks.gameId, gameId));

  return NextResponse.json(landmarks);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    await requireGM(gameId);
    const body = await request.json();

    if (!body.hexId || !body.name || !body.kind) {
      return NextResponse.json({ error: 'hexId, name, and kind are required' }, { status: 400 });
    }

    const gameMap = await db.select().from(gameMaps).where(eq(gameMaps.gameId, gameId)).get();
    if (!gameMap) {
      return NextResponse.json({ error: 'Map not found for game' }, { status: 404 });
    }

    const landHex = await db.select({
      id: mapHexes.id,
    }).from(mapHexes).where(and(
      eq(mapHexes.id, body.hexId),
      eq(mapHexes.gameMapId, gameMap.id),
      eq(mapHexes.hexKind, 'land'),
    )).get();

    if (!landHex) {
      return NextResponse.json({ error: 'Landmark must target a land hex on this game map' }, { status: 400 });
    }

    const id = uuid();
    await db.insert(mapLandmarks).values({
      id,
      gameId,
      hexId: landHex.id,
      name: body.name,
      kind: body.kind,
      description: body.description ?? null,
    });

    return NextResponse.json({
      id,
      gameId,
      hexId: landHex.id,
      name: body.name,
      kind: body.kind,
      description: body.description ?? null,
    }, { status: 201 });
  } catch (error) {
    const errorResponse = apiErrorResponse(error);
    if (errorResponse) return errorResponse;
    throw error;
  }
}
