import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { nobleFamilies, nobles, realms } from '@/db/schema';
import {
  isAuthError,
  requireGM,
  requireOwnedRealmAccess,
  resolveSessionFromCookies,
} from '@/lib/auth';

const GENDER_VALUES = new Set(['Male', 'Female']);
const AGE_VALUES = new Set(['Infant', 'Adolescent', 'Adult', 'Elderly']);
const PLAYER_EDITABLE_FIELDS = new Set(['name']);
const GM_EDITABLE_FIELDS = new Set([
  'familyId',
  'name',
  'gender',
  'age',
  'race',
  'backstory',
  'personality',
  'relationshipWithRuler',
  'belief',
  'valuedObject',
  'valuedPerson',
  'greatestDesire',
  'reasonSkill',
  'cunningSkill',
  'gmStatusText',
]);

function hasOwn(body: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(body, key);
}

function normalizeRequiredString(value: unknown, field: string) {
  if (typeof value !== 'string') {
    throw new Error(`${field} must be a string`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${field} is required`);
  }

  return trimmed;
}

function normalizeNullableString(value: unknown, field: string) {
  if (value !== null && typeof value !== 'string') {
    throw new Error(`${field} must be a string or null`);
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeSkill(value: unknown, field: string) {
  if (!Number.isInteger(value) || Number(value) < 0 || Number(value) > 5) {
    throw new Error(`${field} must be an integer between 0 and 5`);
  }

  return Number(value);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ gameId: string; nobleId: string }> },
) {
  try {
    const { gameId, nobleId } = await params;
    const body = await request.json();

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Request body must be an object' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    const session = await resolveSessionFromCookies();
    const isGmSession = session.role === 'gm' && session.gameId === gameId;
    const allowedFields = isGmSession ? GM_EDITABLE_FIELDS : PLAYER_EDITABLE_FIELDS;
    const disallowedField = Object.keys(body).find((field) => !allowedFields.has(field));

    if (disallowedField) {
      return NextResponse.json({
        error: isGmSession
          ? `Unsupported field: ${disallowedField}`
          : 'Players may only edit a noble name',
      }, { status: 403 });
    }

    if (isGmSession) {
      await requireGM(gameId);
    }

    const noble = await db.select({
      id: nobles.id,
      realmId: nobles.realmId,
    })
      .from(nobles)
      .innerJoin(realms, eq(nobles.realmId, realms.id))
      .where(and(
        eq(nobles.id, nobleId),
        eq(realms.gameId, gameId),
      ))
      .get();

    if (!noble) {
      return NextResponse.json({ error: 'Noble not found' }, { status: 404 });
    }

    if (!isGmSession) {
      await requireOwnedRealmAccess(gameId, noble.realmId);
    }

    try {
      if (hasOwn(body, 'name')) {
        updates.name = normalizeRequiredString(body.name, 'name');
      }

      if (isGmSession && hasOwn(body, 'familyId')) {
        if (typeof body.familyId !== 'string' || !body.familyId.trim()) {
          return NextResponse.json({ error: 'familyId is required' }, { status: 400 });
        }

        const family = await db.select({ id: nobleFamilies.id })
          .from(nobleFamilies)
          .where(and(
            eq(nobleFamilies.id, body.familyId),
            eq(nobleFamilies.realmId, noble.realmId),
          ))
          .get();

        if (!family) {
          return NextResponse.json({ error: 'Noble family not found for this realm' }, { status: 404 });
        }

        updates.familyId = body.familyId;
      }

      if (isGmSession && hasOwn(body, 'gender')) {
        if (typeof body.gender !== 'string' || !GENDER_VALUES.has(body.gender)) {
          return NextResponse.json({ error: 'gender must be Male or Female' }, { status: 400 });
        }

        updates.gender = body.gender;
      }

      if (isGmSession && hasOwn(body, 'age')) {
        if (typeof body.age !== 'string' || !AGE_VALUES.has(body.age)) {
          return NextResponse.json({ error: 'age must be Infant, Adolescent, Adult, or Elderly' }, { status: 400 });
        }

        updates.age = body.age;
      }

      if (isGmSession && hasOwn(body, 'race')) {
        updates.race = normalizeNullableString(body.race, 'race');
      }

      if (isGmSession && hasOwn(body, 'backstory')) {
        updates.backstory = normalizeNullableString(body.backstory, 'backstory');
      }

      if (isGmSession && hasOwn(body, 'personality')) {
        updates.personality = normalizeNullableString(body.personality, 'personality');
      }

      if (isGmSession && hasOwn(body, 'relationshipWithRuler')) {
        updates.relationshipWithRuler = normalizeNullableString(body.relationshipWithRuler, 'relationshipWithRuler');
      }

      if (isGmSession && hasOwn(body, 'belief')) {
        updates.belief = normalizeNullableString(body.belief, 'belief');
      }

      if (isGmSession && hasOwn(body, 'valuedObject')) {
        updates.valuedObject = normalizeNullableString(body.valuedObject, 'valuedObject');
      }

      if (isGmSession && hasOwn(body, 'valuedPerson')) {
        updates.valuedPerson = normalizeNullableString(body.valuedPerson, 'valuedPerson');
      }

      if (isGmSession && hasOwn(body, 'greatestDesire')) {
        updates.greatestDesire = normalizeNullableString(body.greatestDesire, 'greatestDesire');
      }

      if (isGmSession && hasOwn(body, 'reasonSkill')) {
        updates.reasonSkill = normalizeSkill(body.reasonSkill, 'reasonSkill');
      }

      if (isGmSession && hasOwn(body, 'cunningSkill')) {
        updates.cunningSkill = normalizeSkill(body.cunningSkill, 'cunningSkill');
      }

      if (isGmSession && hasOwn(body, 'gmStatusText')) {
        updates.gmStatusText = normalizeNullableString(body.gmStatusText, 'gmStatusText');
      }
    } catch (error) {
      return NextResponse.json({
        error: error instanceof Error ? error.message : 'Invalid noble update',
      }, { status: 400 });
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 });
    }

    await db.update(nobles)
      .set(updates)
      .where(eq(nobles.id, nobleId));

    return NextResponse.json({
      nobleId,
      updated: true,
    });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
