import { NextResponse } from 'next/server';
import { db } from '@/db';
import { resourceSites, territories } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { isAuthError, requireGM } from '@/lib/auth';
import { createResourceSite, isRuleValidationError } from '@/lib/rules-action-service';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  const url = new URL(request.url);
  const realmId = url.searchParams.get('realmId');

  const condition = realmId
    ? and(eq(territories.gameId, gameId), eq(territories.realmId, realmId))
    : eq(territories.gameId, gameId);

  const terrs = await db.select().from(territories).where(condition);
  const terrIds = terrs.map(t => t.id);

  if (terrIds.length === 0) return NextResponse.json([]);

  const list = await db.select().from(resourceSites).where(inArray(resourceSites.territoryId, terrIds));
  return NextResponse.json(list);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    await requireGM(gameId);
    const body = await request.json();
    const created = await createResourceSite(gameId, body);

    return NextResponse.json(created.row, { status: 201 });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (isRuleValidationError(error)) {
      return NextResponse.json({
        error: error.message,
        code: error.code,
        details: error.details ?? null,
      }, { status: error.status });
    }

    throw error;
  }
}
