import { NextResponse } from 'next/server';
import { db } from '@/db';
import { nobleFamilies } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { isAuthError, requireGM } from '@/lib/auth';

export async function GET(
  _request: Request
) {
  const url = new URL(_request.url);
  const realmId = url.searchParams.get('realmId');

  if (!realmId) {
    return NextResponse.json({ error: 'realmId required' }, { status: 400 });
  }

  const families = await db.select().from(nobleFamilies).where(eq(nobleFamilies.realmId, realmId));
  return NextResponse.json(families);
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
    await db.insert(nobleFamilies).values({
      id,
      realmId: body.realmId,
      name: body.name,
      isRulingFamily: body.isRulingFamily || false,
    });

    return NextResponse.json({ id, ...body });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
