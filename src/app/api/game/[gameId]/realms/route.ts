import { NextResponse } from 'next/server';
import { db } from '@/db';
import { realms } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

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
  const { gameId } = await params;
  const body = await request.json();

  const id = uuid();
  await db.insert(realms).values({
    id,
    gameId,
    name: body.name,
    governmentType: body.governmentType,
    traditions: JSON.stringify(body.traditions || []),
    treasury: body.treasury || 0,
    taxType: body.taxType || 'Tribute',
    turmoil: 0,
    turmoilSources: '[]',
  });

  return NextResponse.json({ id, ...body });
}

export async function PATCH(
  request: Request
) {
  const body = await request.json();

  if (!body.realmId) {
    return NextResponse.json({ error: 'realmId required' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.governmentType !== undefined) updates.governmentType = body.governmentType;
  if (body.traditions !== undefined) updates.traditions = JSON.stringify(body.traditions);
  if (body.treasury !== undefined) updates.treasury = body.treasury;
  if (body.taxType !== undefined) updates.taxType = body.taxType;
  if (body.turmoil !== undefined) updates.turmoil = body.turmoil;
  if (body.turmoilSources !== undefined) updates.turmoilSources = JSON.stringify(body.turmoilSources);

  await db.update(realms)
    .set(updates)
    .where(eq(realms.id, body.realmId));

  return NextResponse.json({ updated: true });
}
