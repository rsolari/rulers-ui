import { NextResponse } from 'next/server';
import { db } from '@/db';
import { nobles } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { generateNoblePersonality, generateNobleGender, generateNobleAge } from '@/lib/tables';

export async function GET(
  _request: Request
) {
  const url = new URL(_request.url);
  const realmId = url.searchParams.get('realmId');

  if (!realmId) {
    return NextResponse.json({ error: 'realmId required' }, { status: 400 });
  }

  const nobleList = await db.select().from(nobles).where(eq(nobles.realmId, realmId));
  return NextResponse.json(nobleList);
}

export async function POST(
  request: Request
) {
  const body = await request.json();

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

  const id = uuid();
  await db.insert(nobles).values({
    id,
    familyId: body.familyId,
    realmId: body.realmId,
    name: body.name,
    gender,
    age,
    isRuler: body.isRuler || false,
    isHeir: body.isHeir || false,
    backstory: body.backstory ?? null,
    race: body.race ?? null,
    personality: personality?.personality ?? null,
    relationshipWithRuler: personality?.relationshipWithRuler ?? null,
    belief: personality?.belief ?? null,
    valuedObject: personality?.valuedObject ?? null,
    valuedPerson: personality?.valuedPerson ?? null,
    greatestDesire: personality?.greatestDesire ?? null,
    title: body.title || null,
    estateLevel: body.estateLevel || 'Meagre',
    reasonSkill: body.reasonSkill || 0,
    cunningSkill: body.cunningSkill || 0,
  });

  return NextResponse.json({
    id,
    name: body.name,
    gender,
    age,
    backstory: body.backstory ?? null,
    race: body.race ?? null,
    ...personality,
  });
}
