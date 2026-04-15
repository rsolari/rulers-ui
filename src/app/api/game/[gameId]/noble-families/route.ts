import { apiErrorResponse } from '@/lib/api-errors';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { nobleFamilies, nobles, realms } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { requireOwnedRealmAccess } from '@/lib/auth';

export async function GET(
  _request: Request
) {
  const url = new URL(_request.url);
  const realmId = url.searchParams.get('realmId');

  if (!realmId) {
    return NextResponse.json({ error: 'realmId required' }, { status: 400 });
  }

  const families = await db.select().from(nobleFamilies).where(eq(nobleFamilies.realmId, realmId));
  const realm = await db.select({
    rulerNobleId: realms.rulerNobleId,
  }).from(realms).where(eq(realms.id, realmId)).get();

  const ruler = realm?.rulerNobleId
    ? await db.select({
      familyId: nobles.familyId,
    }).from(nobles).where(eq(nobles.id, realm.rulerNobleId)).get()
    : null;

  return NextResponse.json(families.map((family) => ({
    ...family,
    isRulingFamily: family.id === ruler?.familyId,
  })));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const body = await request.json();
    const { realmId } = await requireOwnedRealmAccess(gameId, body.realmId);

    const id = uuid();
    await db.insert(nobleFamilies).values({
      id,
      realmId,
      name: body.name,
    });

    return NextResponse.json({
      id,
      realmId,
      name: body.name,
      isRulingFamily: Boolean(body.isRulingFamily),
    });
  } catch (error) {
    const errorResponse = apiErrorResponse(error);
    if (errorResponse) return errorResponse;
    throw error;
  }
}
