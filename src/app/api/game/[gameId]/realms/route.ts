import { apiErrorResponse } from '@/lib/api-errors';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { games, realms } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { getGmCode, requireGM, requireInitState, requireRealmOwner } from '@/lib/auth';
import { getEconomyOverview } from '@/lib/economy-service';
import { sanitizeTechnicalKnowledge } from '@/lib/technical-knowledge';

const REALM_COLORS = [
  '#8b2020', '#2a4a7a', '#5a7a4a', '#8a5a24', '#7a3e6a',
  '#7a6a2a', '#4a667a', '#5f3f2b', '#576636', '#7a4b4b',
  '#3f5f66', '#6a4f2d',
];

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  const realmList = await db.select().from(realms).where(eq(realms.gameId, gameId));
  const overview = getEconomyOverview(gameId);
  const overviewByRealmId = new Map((overview?.realms ?? []).map((entry) => [entry.realmId, entry]));

  return NextResponse.json(realmList.map((realm) => ({
    ...realm,
    projectedTurmoil: overviewByRealmId.get(realm.id)?.projectedTurmoil ?? null,
    turmoilBreakdown: overviewByRealmId.get(realm.id)?.turmoilBreakdown ?? [],
    openTurmoilEventId: overviewByRealmId.get(realm.id)?.openTurmoilEventId ?? null,
    winterUnrestPending: overviewByRealmId.get(realm.id)?.winterUnrestPending ?? false,
  })));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    await requireGM(gameId);
    const body = await request.json();
    const technicalKnowledge = sanitizeTechnicalKnowledge(body.technicalKnowledge);

    const id = uuid();
    const existingRealms = await db.select().from(realms).where(eq(realms.gameId, gameId));
    const color = body.color ?? REALM_COLORS[existingRealms.length % REALM_COLORS.length];
    await db.insert(realms).values({
      id,
      gameId,
      name: body.name,
      governmentType: body.governmentType,
      traditions: JSON.stringify(body.traditions || []),
      isNPC: body.isNPC || false,
      treasury: body.treasury || 0,
      taxType: body.taxType || 'Tribute',
      levyExpiresYear: body.levyExpiresYear ?? null,
      levyExpiresSeason: body.levyExpiresSeason ?? null,
      foodBalance: body.foodBalance ?? 0,
      consecutiveFoodShortageSeasons: body.consecutiveFoodShortageSeasons ?? 0,
      consecutiveFoodRecoverySeasons: body.consecutiveFoodRecoverySeasons ?? 0,
      technicalKnowledge: JSON.stringify(technicalKnowledge),
      turmoilSources: '[]',
      color,
    });

    return NextResponse.json({ id, ...body, technicalKnowledge });
  } catch (error) {
    const errorResponse = apiErrorResponse(error);
    if (errorResponse) return errorResponse;
    throw error;
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const body = await request.json();

    if (!body.realmId) {
      return NextResponse.json({ error: 'realmId required' }, { status: 400 });
    }

    await requireRealmOwner(gameId, body.realmId);
    const game = await db.select().from(games).where(eq(games.id, gameId)).get();
    const gmCode = await getGmCode();
    const isGM = Boolean(game && gmCode && gmCode === game.gmCode);

    if (!isGM) {
      await requireInitState(gameId, 'parallel_final_setup', 'ready_to_start');
    }

    const allowedFields = isGM
      ? [
        'name',
        'governmentType',
        'traditions',
        'treasury',
        'taxType',
        'levyExpiresYear',
        'levyExpiresSeason',
        'foodBalance',
        'consecutiveFoodShortageSeasons',
        'consecutiveFoodRecoverySeasons',
        'technicalKnowledge',
      ]
      : ['name', 'governmentType', 'traditions'];

    const disallowedKeys = Object.keys(body).filter((key) => key !== 'realmId' && !allowedFields.includes(key));
    if (disallowedKeys.length > 0) {
      return NextResponse.json({ error: `Forbidden fields: ${disallowedKeys.join(', ')}` }, { status: 403 });
    }

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.governmentType !== undefined) updates.governmentType = body.governmentType;
    if (body.traditions !== undefined) updates.traditions = JSON.stringify(body.traditions);
    if (isGM && body.treasury !== undefined) updates.treasury = body.treasury;
    if (isGM && body.taxType !== undefined) updates.taxType = body.taxType;
    if (isGM && body.levyExpiresYear !== undefined) updates.levyExpiresYear = body.levyExpiresYear;
    if (isGM && body.levyExpiresSeason !== undefined) updates.levyExpiresSeason = body.levyExpiresSeason;
    if (isGM && body.foodBalance !== undefined) updates.foodBalance = body.foodBalance;
    if (isGM && body.consecutiveFoodShortageSeasons !== undefined) {
      updates.consecutiveFoodShortageSeasons = body.consecutiveFoodShortageSeasons;
    }
    if (isGM && body.consecutiveFoodRecoverySeasons !== undefined) {
      updates.consecutiveFoodRecoverySeasons = body.consecutiveFoodRecoverySeasons;
    }
    if (isGM && body.technicalKnowledge !== undefined) {
      updates.technicalKnowledge = JSON.stringify(sanitizeTechnicalKnowledge(body.technicalKnowledge));
    }

    await db.update(realms)
      .set(updates)
      .where(and(
        eq(realms.id, body.realmId),
        eq(realms.gameId, gameId),
      ));

    return NextResponse.json({ updated: true });
  } catch (error) {
    const errorResponse = apiErrorResponse(error);
    if (errorResponse) return errorResponse;
    throw error;
  }
}
