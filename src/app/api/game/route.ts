import { NextResponse } from 'next/server';
import { db } from '@/db';
import { games } from '@/db/schema';
import { generateGameCode, sessionCookieOptions } from '@/lib/auth';
import { v4 as uuid } from 'uuid';

export async function POST(request: Request) {
  const body = await request.json();
  const { name } = body;

  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'Game name is required' }, { status: 400 });
  }

  const id = uuid();
  const gmCode = generateGameCode();
  const playerCode = generateGameCode();

  await db.insert(games).values({
    id,
    name,
    gmCode,
    playerCode,
    gamePhase: 'Setup',
    initState: 'gm_world_setup',
    gmSetupState: 'pending',
    currentYear: 1,
    currentSeason: 'Spring',
    turnPhase: 'Submission',
  });

  const response = NextResponse.json({
    id,
    name,
    gmCode,
    playerCode,
    gamePhase: 'Setup',
    initState: 'gm_world_setup',
    gmSetupState: 'pending',
  });
  response.cookies.set('rulers-gm-code', gmCode, sessionCookieOptions);
  response.cookies.set('rulers-game-id', id, sessionCookieOptions);
  response.cookies.delete('rulers-claim-code');

  return response;
}
