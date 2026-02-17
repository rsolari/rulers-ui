import { NextResponse } from 'next/server';
import { db } from '@/db';
import { turnReports, games } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  const url = new URL(_request.url);
  const realmId = url.searchParams.get('realmId');

  const game = await db.select().from(games).where(eq(games.id, gameId)).get();
  if (!game) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  if (realmId) {
    // Get current turn report for this realm
    const report = await db.select().from(turnReports)
      .where(and(
        eq(turnReports.gameId, gameId),
        eq(turnReports.realmId, realmId),
        eq(turnReports.year, game.currentYear),
        eq(turnReports.season, game.currentSeason),
      ))
      .get();

    return NextResponse.json({ game, report: report || null });
  }

  // GM view: get all turn reports for current season
  const reports = await db.select().from(turnReports)
    .where(and(
      eq(turnReports.gameId, gameId),
      eq(turnReports.year, game.currentYear),
      eq(turnReports.season, game.currentSeason),
    ));

  return NextResponse.json({ game, reports });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  const body = await request.json();

  const game = await db.select().from(games).where(eq(games.id, gameId)).get();
  if (!game) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  // Check if report already exists
  const existing = await db.select().from(turnReports)
    .where(and(
      eq(turnReports.gameId, gameId),
      eq(turnReports.realmId, body.realmId),
      eq(turnReports.year, game.currentYear),
      eq(turnReports.season, game.currentSeason),
    ))
    .get();

  if (existing) {
    // Update existing report
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
    realmId: body.realmId,
    year: game.currentYear,
    season: game.currentSeason,
    financialActions: JSON.stringify(body.financialActions || []),
    politicalActions: JSON.stringify(body.politicalActions || []),
    status: body.status || 'Draft',
  });

  return NextResponse.json({ id, created: true });
}
