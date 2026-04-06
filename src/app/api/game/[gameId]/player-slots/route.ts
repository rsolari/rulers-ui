import { NextResponse } from 'next/server';
import { db } from '@/db';
import { playerSlots, territories } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { isAuthError, requireGM } from '@/lib/auth';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    await requireGM(gameId);

    const slots = await db.select().from(playerSlots).where(eq(playerSlots.gameId, gameId));
    const territoryList = await db.select().from(territories).where(eq(territories.gameId, gameId));
    const territoryById = new Map(territoryList.map((territory) => [territory.id, territory]));

    return NextResponse.json(slots.map((slot) => ({
      ...slot,
      territoryName: territoryById.get(slot.territoryId)?.name ?? null,
      status: slot.setupState === 'unclaimed' ? 'unclaimed' : 'claimed',
    })));
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
