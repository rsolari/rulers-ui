import { NextResponse } from 'next/server';
import { db } from '@/db';
import { playerSlots, territories } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { isAuthError, requireGM } from '@/lib/auth';
import { getGameSetupReadiness } from '@/lib/game-init-state';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    await requireGM(gameId);

    const [slots, territoryList, readiness] = await Promise.all([
      db.select().from(playerSlots).where(eq(playerSlots.gameId, gameId)),
      db.select().from(territories).where(eq(territories.gameId, gameId)),
      getGameSetupReadiness(gameId),
    ]);
    const territoryById = new Map(territoryList.map((territory) => [territory.id, territory]));
    const setupStatusBySlotId = new Map((readiness?.playerStatuses ?? []).map((status) => [status.slotId, status]));

    return NextResponse.json(slots.map((slot) => ({
      ...slot,
      territoryName: territoryById.get(slot.territoryId)?.name ?? null,
      status: slot.setupState === 'unclaimed' ? 'unclaimed' : 'claimed',
      setupState: setupStatusBySlotId.get(slot.id)?.setupState ?? slot.setupState,
      checklist: setupStatusBySlotId.get(slot.id)?.checklist ?? null,
      missingRequirements: setupStatusBySlotId.get(slot.id)?.missingRequirements ?? [],
    })));
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
