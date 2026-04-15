import { apiErrorResponse } from '@/lib/api-errors';
import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { nobles, realms } from '@/db/schema';
import { requireGM } from '@/lib/auth';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ gameId: string; nobleId: string }> },
) {
  try {
    const { gameId, nobleId } = await params;
    const body = await request.json();

    await requireGM(gameId);

    if (
      !Object.prototype.hasOwnProperty.call(body, 'gmStatusText')
      || (body.gmStatusText !== null && typeof body.gmStatusText !== 'string')
    ) {
      return NextResponse.json({ error: 'gmStatusText must be a string or null' }, { status: 400 });
    }

    const noble = await db.select({ id: nobles.id })
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

    await db.update(nobles)
      .set({ gmStatusText: body.gmStatusText })
      .where(eq(nobles.id, nobleId));

    return NextResponse.json({
      nobleId,
      gmStatusText: body.gmStatusText,
    });
  } catch (error) {
    const errorResponse = apiErrorResponse(error);
    if (errorResponse) return errorResponse;
    throw error;
  }
}
