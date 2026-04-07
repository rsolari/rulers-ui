import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { db } from '@/db';
import { nobleFamilies, nobles, realms } from '@/db/schema';
import { isAuthError, requireInitState, requireRealmOwner, resolveSessionFromCookies } from '@/lib/auth';
import { recomputeGameInitState } from '@/lib/game-init-state';
import { appointRuler } from '@/lib/game-logic/governance';
import { isGovernanceError } from '@/lib/game-logic/nobles';

async function getRulerByRealmId(realmId: string) {
  return db.select({
    id: nobles.id,
    familyId: nobles.familyId,
    realmId: nobles.realmId,
    name: nobles.name,
    gender: nobles.gender,
    age: nobles.age,
    race: nobles.race,
    backstory: nobles.backstory,
    personality: nobles.personality,
    relationshipWithRuler: nobles.relationshipWithRuler,
    belief: nobles.belief,
    valuedObject: nobles.valuedObject,
    valuedPerson: nobles.valuedPerson,
    greatestDesire: nobles.greatestDesire,
    familyName: nobleFamilies.name,
    governanceState: realms.governanceState,
  })
    .from(nobles)
    .innerJoin(nobleFamilies, eq(nobles.familyId, nobleFamilies.id))
    .innerJoin(realms, eq(realms.rulerNobleId, nobles.id))
    .where(eq(realms.id, realmId))
    .get();
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const realmId = url.searchParams.get('realmId');

  if (!realmId) {
    return NextResponse.json({ error: 'realmId required' }, { status: 400 });
  }

  const ruler = await getRulerByRealmId(realmId);
  return NextResponse.json(ruler ?? null);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  try {
    const { gameId } = await params;
    const body = await request.json();

    if (!body.name || !body.gender || !body.age || !body.personality) {
      return NextResponse.json(
        { error: 'name, gender, age, and personality are required' },
        { status: 400 },
      );
    }

    const hasExistingFamily = typeof body.familyId === 'string' && body.familyId.length > 0;
    const hasNewFamily = typeof body.newFamilyName === 'string' && body.newFamilyName.trim().length > 0;

    if (hasExistingFamily === hasNewFamily) {
      return NextResponse.json(
        { error: 'Provide exactly one of familyId or newFamilyName' },
        { status: 400 },
      );
    }

    const session = await resolveSessionFromCookies();
    const effectiveRealmId = session.gameId === gameId && session.role === 'player'
      ? session.realmId
      : body.realmId;

    if (!effectiveRealmId) {
      return NextResponse.json({ error: 'realmId required' }, { status: 400 });
    }

    await requireRealmOwner(gameId, effectiveRealmId);
    await requireInitState(gameId, 'parallel_final_setup', 'ready_to_start');

    const created = db.transaction((tx) => {
      const existingRuler = tx.select({ rulerNobleId: realms.rulerNobleId })
        .from(realms)
        .where(eq(realms.id, effectiveRealmId))
        .get();

      if (existingRuler?.rulerNobleId) {
        return { error: 'Realm already has a ruler', status: 409 as const };
      }

      let familyId = body.familyId as string | undefined;
      let familyName = '';

      if (hasNewFamily) {
        familyId = uuid();
        familyName = body.newFamilyName.trim();

        tx.insert(nobleFamilies).values({
          id: familyId,
          realmId: effectiveRealmId,
          name: familyName,
        }).run();
      } else if (familyId) {
        const family = tx.select({
          id: nobleFamilies.id,
          name: nobleFamilies.name,
        })
          .from(nobleFamilies)
          .where(and(eq(nobleFamilies.id, familyId), eq(nobleFamilies.realmId, effectiveRealmId)))
          .get();

        if (!family) {
          return { error: 'Noble family not found for this realm', status: 404 as const };
        }

        familyName = family.name;
      }

      const rulerId = uuid();
      tx.insert(nobles).values({
        id: rulerId,
        familyId: familyId!,
        realmId: effectiveRealmId,
        originRealmId: effectiveRealmId,
        displacedFromRealmId: null,
        name: body.name,
        gender: body.gender,
        age: body.age,
        race: body.race ?? null,
        backstory: body.backstory ?? null,
        personality: body.personality,
        relationshipWithRuler: null,
        belief: body.belief ?? null,
        valuedObject: body.valuedObject ?? null,
        valuedPerson: body.valuedPerson ?? null,
        greatestDesire: body.greatestDesire ?? null,
        estateLevel: 'Luxurious',
        reasonSkill: body.reasonSkill ?? 0,
        cunningSkill: body.cunningSkill ?? 0,
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
        locationTerritoryId: null,
        locationHexId: null,
      }).run();

      appointRuler(tx, {
        gameId,
        realmId: effectiveRealmId,
        nobleId: rulerId,
        year: 1,
        season: 'Spring',
        description: `${body.name} was appointed as ruler.`,
      });

      return {
        status: 201 as const,
        realmId: effectiveRealmId,
        rulerNobleId: rulerId,
        governanceState: 'stable' as const,
        noble: {
          id: rulerId,
          familyId: familyId!,
          realmId: effectiveRealmId,
          name: body.name,
          gender: body.gender,
          age: body.age,
          race: body.race ?? null,
          backstory: body.backstory ?? null,
          personality: body.personality,
          relationshipWithRuler: null,
          belief: body.belief ?? null,
          valuedObject: body.valuedObject ?? null,
          valuedPerson: body.valuedPerson ?? null,
          greatestDesire: body.greatestDesire ?? null,
          familyName,
        },
      };
    });

    if ('error' in created) {
      return NextResponse.json({ error: created.error }, { status: created.status });
    }

    await recomputeGameInitState(gameId);
    return NextResponse.json(created, { status: created.status });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (isGovernanceError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : 'Failed to create ruler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
