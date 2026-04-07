import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { db } from '@/db';
import { armies, guildsOrdersSocieties, nobleFamilies, nobles, realms, settlements } from '@/db/schema';
import { recomputeGameInitState } from '@/lib/game-init-state';
import { generateNobleAge, generateNobleGender, generateNoblePersonality } from '@/lib/tables';
import { isAuthError, requireOwnedRealmAccess } from '@/lib/auth';

export async function GET(
  request: Request,
) {
  const url = new URL(request.url);
  const realmId = url.searchParams.get('realmId');

  if (!realmId) {
    return NextResponse.json({ error: 'realmId required' }, { status: 400 });
  }

  const [realm, nobleList, settlementList, armyList, gosList] = await Promise.all([
    db.select({
      rulerNobleId: realms.rulerNobleId,
      heirNobleId: realms.heirNobleId,
      actingRulerNobleId: realms.actingRulerNobleId,
    }).from(realms).where(eq(realms.id, realmId)).get(),
    db.select().from(nobles).where(eq(nobles.realmId, realmId)),
    db.select({
      id: settlements.id,
      name: settlements.name,
      governingNobleId: settlements.governingNobleId,
    }).from(settlements).where(eq(settlements.realmId, realmId)),
    db.select({
      id: armies.id,
      name: armies.name,
      generalId: armies.generalId,
    }).from(armies).where(eq(armies.realmId, realmId)),
    db.select({
      id: guildsOrdersSocieties.id,
      name: guildsOrdersSocieties.name,
      leaderId: guildsOrdersSocieties.leaderId,
    }).from(guildsOrdersSocieties).where(eq(guildsOrdersSocieties.realmId, realmId)),
  ]);

  const officeLabelByNobleId = new Map<string, string>();
  for (const settlement of settlementList) {
    if (settlement.governingNobleId) {
      officeLabelByNobleId.set(settlement.governingNobleId, `${settlement.name} Governor`);
    }
  }
  for (const army of armyList) {
    if (army.generalId) {
      officeLabelByNobleId.set(army.generalId, `${army.name} General`);
    }
  }
  for (const gos of gosList) {
    if (gos.leaderId) {
      officeLabelByNobleId.set(gos.leaderId, `${gos.name} Leader`);
    }
  }

  return NextResponse.json(nobleList.map((noble) => ({
    ...noble,
    isRuler: noble.id === realm?.rulerNobleId,
    isHeir: noble.id === realm?.heirNobleId,
    isActingRuler: noble.id === realm?.actingRulerNobleId,
    title: officeLabelByNobleId.get(noble.id) ?? null,
  })));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  try {
    const { gameId } = await params;
    const body = await request.json();
    const { realmId } = await requireOwnedRealmAccess(gameId, body.realmId);

    const family = await db.select({ id: nobleFamilies.id })
      .from(nobleFamilies)
      .where(eq(nobleFamilies.id, body.familyId))
      .get();

    if (!family) {
      return NextResponse.json({ error: 'Noble family not found for this realm' }, { status: 404 });
    }

    const hasManualPersonality = typeof body.personality === 'string';
    const generatedPersonality = hasManualPersonality ? null : generateNoblePersonality();
    const gender = body.gender || generateNobleGender();
    const age = body.age || generateNobleAge();
    const personality = hasManualPersonality
      ? {
        personality: body.personality,
        relationshipWithRuler: body.relationshipWithRuler ?? null,
        belief: body.belief ?? null,
        valuedObject: body.valuedObject ?? null,
        valuedPerson: body.valuedPerson ?? null,
        greatestDesire: body.greatestDesire ?? null,
      }
      : generatedPersonality;

    const noble = {
      id: uuid(),
      familyId: body.familyId,
      realmId,
      originRealmId: realmId,
      displacedFromRealmId: null,
      name: body.name,
      gender,
      age,
      backstory: body.backstory ?? null,
      race: body.race ?? null,
      personality: personality?.personality ?? null,
      relationshipWithRuler: personality?.relationshipWithRuler ?? null,
      belief: personality?.belief ?? null,
      valuedObject: personality?.valuedObject ?? null,
      valuedPerson: personality?.valuedPerson ?? null,
      greatestDesire: personality?.greatestDesire ?? null,
      estateLevel: body.estateLevel || 'Meagre',
      reasonSkill: body.reasonSkill || 0,
      cunningSkill: body.cunningSkill || 0,
      isAlive: true,
      deathYear: null,
      deathSeason: null,
      deathCause: null,
      isPrisoner: false,
      captorRealmId: null,
      capturedYear: null,
      capturedSeason: null,
      releasedYear: null,
      releasedSeason: null,
      gmStatusText: null,
      locationTerritoryId: null,
      locationHexId: null,
    };

    await db.insert(nobles).values(noble);

    await recomputeGameInitState(gameId);

    return NextResponse.json({ noble });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
