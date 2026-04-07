import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { db } from '@/db';
import { nobleFamilies, nobles } from '@/db/schema';
import { isAuthError, requireInitState, requireRealmOwner, resolveSessionFromCookies } from '@/lib/auth';
import { recomputeGameInitState } from '@/lib/game-init-state';

type RulerRecord = {
  id: string;
  familyId: string;
  realmId: string;
  name: string;
  gender: string;
  age: string;
  race: string | null;
  backstory: string | null;
  personality: string | null;
  relationshipWithRuler: string | null;
  belief: string | null;
  valuedObject: string | null;
  valuedPerson: string | null;
  greatestDesire: string | null;
  familyName: string;
};

async function getRulerByRealmId(realmId: string): Promise<RulerRecord | undefined> {
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
  })
    .from(nobles)
    .innerJoin(nobleFamilies, eq(nobles.familyId, nobleFamilies.id))
    .where(and(eq(nobles.realmId, realmId), eq(nobles.isRuler, true)))
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
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const body = await request.json();

    if (!body.name || !body.gender || !body.age || !body.personality) {
      return NextResponse.json(
        { error: 'name, gender, age, and personality are required' },
        { status: 400 }
      );
    }

    const hasExistingFamily = typeof body.familyId === 'string' && body.familyId.length > 0;
    const hasNewFamily = typeof body.newFamilyName === 'string' && body.newFamilyName.trim().length > 0;

    if (hasExistingFamily === hasNewFamily) {
      return NextResponse.json(
        { error: 'Provide exactly one of familyId or newFamilyName' },
        { status: 400 }
      );
    }

    const session = await resolveSessionFromCookies();
    const effectiveRealmId = session.gameId === gameId && session.role === 'player'
      ? session.realmId
      : body.realmId;

    if (session.gameId === gameId && session.role === 'player' && !effectiveRealmId) {
      return NextResponse.json({ error: 'Realm access required' }, { status: 403 });
    }

    if (!effectiveRealmId) {
      return NextResponse.json({ error: 'realmId required' }, { status: 400 });
    }

    await requireRealmOwner(gameId, effectiveRealmId);
    await requireInitState(gameId, 'parallel_final_setup', 'ready_to_start');

    const created = db.transaction((tx) => {
      const existingRuler = tx.select({ id: nobles.id })
        .from(nobles)
        .where(and(eq(nobles.realmId, effectiveRealmId), eq(nobles.isRuler, true)))
        .get();

      if (existingRuler) {
        return { error: 'Realm already has a ruler', status: 409 as const };
      }

      tx.update(nobleFamilies)
        .set({ isRulingFamily: false })
        .where(eq(nobleFamilies.realmId, effectiveRealmId))
        .run();

      let familyId = body.familyId as string | undefined;
      let familyName = '';

      if (hasNewFamily) {
        familyId = uuid();
        familyName = body.newFamilyName.trim();

        tx.insert(nobleFamilies).values({
          id: familyId,
          realmId: effectiveRealmId,
          name: familyName,
          isRulingFamily: true,
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

        tx.update(nobleFamilies)
          .set({ isRulingFamily: true })
          .where(eq(nobleFamilies.id, family.id))
          .run();
      }

      const rulerId = uuid();

      tx.insert(nobles).values({
        id: rulerId,
        familyId: familyId!,
        realmId: effectiveRealmId,
        name: body.name,
        gender: body.gender,
        age: body.age,
        isRuler: true,
        isHeir: false,
        race: body.race ?? null,
        backstory: body.backstory ?? null,
        personality: body.personality,
        relationshipWithRuler: null,
        belief: body.belief ?? null,
        valuedObject: body.valuedObject ?? null,
        valuedPerson: body.valuedPerson ?? null,
        greatestDesire: body.greatestDesire ?? null,
        title: body.title ?? null,
        estateLevel: body.estateLevel ?? 'Meagre',
        reasonSkill: body.reasonSkill ?? 0,
        cunningSkill: body.cunningSkill ?? 0,
      }).run();

      return {
        status: 201 as const,
        ruler: {
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

    return NextResponse.json(created.ruler, { status: created.status });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : 'Failed to create ruler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
