import { apiErrorResponse } from '@/lib/api-errors';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { playerSlots, realms, territories } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireGM } from '@/lib/auth';
import { getGameSetupReadiness } from '@/lib/game-init-state';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    await requireGM(gameId);

    const [slots, territoryList, realmList, readiness] = await Promise.all([
      db.select().from(playerSlots).where(eq(playerSlots.gameId, gameId)),
      db.select().from(territories).where(eq(territories.gameId, gameId)),
      db.select({ id: realms.id, name: realms.name }).from(realms).where(eq(realms.gameId, gameId)),
      getGameSetupReadiness(gameId),
    ]);
    const territoryById = new Map(territoryList.map((territory) => [territory.id, territory]));
    const realmById = new Map(realmList.map((realm) => [realm.id, realm]));
    const setupStatusBySlotId = new Map((readiness?.playerStatuses ?? []).map((status) => [status.slotId, status]));

    return NextResponse.json(slots.map((slot) => ({
      ...slot,
      territoryName: territoryById.get(slot.territoryId)?.name ?? null,
      realmName: slot.realmId ? realmById.get(slot.realmId)?.name ?? null : null,
      status: slot.setupState === 'unclaimed' ? 'unclaimed' : 'claimed',
      setupState: setupStatusBySlotId.get(slot.id)?.setupState ?? slot.setupState,
      checklist: setupStatusBySlotId.get(slot.id)?.checklist ?? null,
      missingRequirements: setupStatusBySlotId.get(slot.id)?.missingRequirements ?? [],
    })));
  } catch (error) {
    const errorResponse = apiErrorResponse(error);
    if (errorResponse) return errorResponse;
    throw error;
  }
}
