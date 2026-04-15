import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { realms, territories } from '@/db/schema';
import { apiErrorResponse } from '@/lib/api-errors';
import { requireGM } from '@/lib/auth';
import { isSettlementHexAvailable } from '@/lib/game-logic/maps';
import { initializeRealmCapital } from '@/lib/game-logic/realm-bootstrap';
import { parseJson } from '@/lib/json';
import type { Tradition } from '@/types/game';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  try {
    const { gameId } = await params;
    await requireGM(gameId);
    const body = await request.json();

    const { realmId, territoryId, hexId, capitalName, capitalSize } = body;

    if (!realmId || !territoryId || !hexId || !capitalName) {
      return NextResponse.json(
        { error: 'realmId, territoryId, hexId, and capitalName are required' },
        { status: 400 },
      );
    }

    const realm = await db.select({
      id: realms.id,
      isNPC: realms.isNPC,
      capitalSettlementId: realms.capitalSettlementId,
      traditions: realms.traditions,
    })
      .from(realms)
      .where(and(eq(realms.id, realmId), eq(realms.gameId, gameId)))
      .get();

    if (!realm) {
      return NextResponse.json({ error: 'Realm not found' }, { status: 404 });
    }

    if (!realm.isNPC) {
      return NextResponse.json({ error: 'Capital placement is only available for NPC realms' }, { status: 400 });
    }

    if (realm.capitalSettlementId) {
      return NextResponse.json({ error: 'Realm already has a capital' }, { status: 409 });
    }

    const territory = await db.select({
      id: territories.id,
      realmId: territories.realmId,
    })
      .from(territories)
      .where(and(eq(territories.id, territoryId), eq(territories.gameId, gameId)))
      .get();

    if (!territory) {
      return NextResponse.json({ error: 'Territory not found' }, { status: 404 });
    }

    if (territory.realmId !== realmId) {
      return NextResponse.json({ error: 'Territory does not belong to this realm' }, { status: 400 });
    }

    const isValidHex = await isSettlementHexAvailable(db, territoryId, hexId);
    if (!isValidHex) {
      return NextResponse.json(
        { error: 'Capital must be placed on an unoccupied land hex in the territory' },
        { status: 400 },
      );
    }

    const traditions = parseJson<Tradition[]>(realm.traditions, []);

    const result = db.transaction((tx) => {
      return initializeRealmCapital(tx, {
        realmId,
        territoryId,
        capitalHexId: hexId,
        capitalName: capitalName.trim(),
        capitalSize: capitalSize || 'Town',
        traditions,
      });
    });

    return NextResponse.json({
      capitalSettlementId: result.capitalSettlementId,
      capitalName: capitalName.trim(),
    }, { status: 201 });
  } catch (error) {
    const errorResponse = apiErrorResponse(error);
    if (errorResponse) return errorResponse;
    throw error;
  }
}
