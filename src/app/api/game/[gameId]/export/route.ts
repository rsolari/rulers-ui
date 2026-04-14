import { NextResponse } from 'next/server';
import fs from 'fs';
import { resolveDatabasePath } from '@/db/path';
import { requireGM, isAuthError } from '@/lib/auth';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    await requireGM(gameId);

    const dbPath = resolveDatabasePath();

    if (!fs.existsSync(dbPath)) {
      return NextResponse.json({ error: 'Database file not found' }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(dbPath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `rulers-backup-${timestamp}.db`;

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(fileBuffer.length),
      },
    });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: (error as Error).message }, { status: 403 });
    }
    throw error;
  }
}
