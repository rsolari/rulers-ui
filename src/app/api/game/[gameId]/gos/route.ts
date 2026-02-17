import { NextResponse } from 'next/server';
import { db } from '@/db';
import { guildsOrdersSocieties } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  const url = new URL(_request.url);
  const realmId = url.searchParams.get('realmId');

  if (!realmId) {
    return NextResponse.json({ error: 'realmId required' }, { status: 400 });
  }

  const list = await db.select().from(guildsOrdersSocieties).where(eq(guildsOrdersSocieties.realmId, realmId));
  return NextResponse.json(list);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  const body = await request.json();

  const id = uuid();
  await db.insert(guildsOrdersSocieties).values({
    id,
    realmId: body.realmId,
    name: body.name,
    type: body.type,
    focus: body.focus || null,
    leaderId: body.leaderId || null,
    income: body.income || 0,
  });

  return NextResponse.json({ id, ...body });
}
