import { NextResponse } from 'next/server';
import { db } from '@/db';
import { turnReports, games } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { isAuthError, requireRealmOwner, resolveSessionFromCookies } from '@/lib/auth';
import { toPublicGame } from '@/lib/dto';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  const url = new URL(request.url);
  const requestedRealmId = url.searchParams.get('realmId');

  const game = await db.select().from(games).where(eq(games.id, gameId)).get();
  if (!game) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  const session = await resolveSessionFromCookies();
  const role = session.gameId === gameId ? session.role : null;
  const effectiveRealmId = role === 'player' ? session.realmId : requestedRealmId;

  if (role === 'player' && !effectiveRealmId) {
    return NextResponse.json({ error: 'Realm access required' }, { status: 403 });
  }

  if (effectiveRealmId) {
    // Get current turn report for this realm
    const report = await db.select().from(turnReports)
      .where(and(
        eq(turnReports.gameId, gameId),
        eq(turnReports.realmId, effectiveRealmId),
        eq(turnReports.year, game.currentYear),
        eq(turnReports.season, game.currentSeason),
      ))
      .get();

    return NextResponse.json({ game: toPublicGame(game, role), report: report || null });
  }

  if (role !== 'gm') {
    return NextResponse.json({ error: 'GM access required' }, { status: 403 });
  }

  // GM view: get all turn reports for current season
  const reports = await db.select().from(turnReports)
    .where(and(
      eq(turnReports.gameId, gameId),
      eq(turnReports.year, game.currentYear),
      eq(turnReports.season, game.currentSeason),
    ));

  return NextResponse.json({ game: toPublicGame(game, role), reports });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const body = await request.json();
    const session = await resolveSessionFromCookies();
    const realmId = session.gameId === gameId && session.role === 'player'
      ? session.realmId
      : body.realmId;

    if (!realmId) {
      return NextResponse.json({ error: 'realmId required' }, { status: 400 });
    }

    await requireRealmOwner(gameId, realmId);

    const game = await db.select().from(games).where(eq(games.id, gameId)).get();
    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    const existing = await db.select().from(turnReports)
      .where(and(
        eq(turnReports.gameId, gameId),
        eq(turnReports.realmId, realmId),
        eq(turnReports.year, game.currentYear),
        eq(turnReports.season, game.currentSeason),
      ))
      .get();

    if (existing) {
      await db.update(turnReports)
        .set({
          financialActions: JSON.stringify(body.financialActions || []),
          politicalActions: JSON.stringify(body.politicalActions || []),
          status: body.status || existing.status,
          gmNotes: body.gmNotes ?? existing.gmNotes,
        })
        .where(eq(turnReports.id, existing.id));

      return NextResponse.json({ id: existing.id, updated: true });
    }

    const id = uuid();
    await db.insert(turnReports).values({
      id,
      gameId,
      realmId,
      year: game.currentYear,
      season: game.currentSeason,
      financialActions: JSON.stringify(body.financialActions || []),
      politicalActions: JSON.stringify(body.politicalActions || []),
      status: body.status || 'Draft',
    });

    return NextResponse.json({ id, created: true });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
