import { NextResponse } from 'next/server';
import { db } from '@/db';
import { tradeRoutes } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { isAuthError, requireGM } from '@/lib/auth';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  const list = await db.select().from(tradeRoutes).where(eq(tradeRoutes.gameId, gameId));
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
    await db.insert(tradeRoutes).values({
      id,
      gameId,
      realm1Id: body.realm1Id,
      realm2Id: body.realm2Id,
      settlement1Id: body.settlement1Id,
      settlement2Id: body.settlement2Id,
      isActive: true,
      productsExported1to2: JSON.stringify(body.productsExported1to2 || []),
      productsExported2to1: JSON.stringify(body.productsExported2to1 || []),
      protectedProducts: JSON.stringify(body.protectedProducts || []),
    });

    return NextResponse.json({ id, ...body });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
