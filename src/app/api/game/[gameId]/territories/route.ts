import { NextResponse } from 'next/server';
import { db } from '@/db';
import { territories } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

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
  const { gameId } = await params;
  const body = await request.json();

  const id = uuid();
  await db.insert(territories).values({
    id,
    gameId,
    name: body.name,
    realmId: body.realmId || null,
    climate: body.climate || null,
    description: body.description || null,
  });

  return NextResponse.json({ id, ...body });
}
