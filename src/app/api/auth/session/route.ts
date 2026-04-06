import { NextResponse } from 'next/server';
import { resolveSessionFromCookies } from '@/lib/auth';

export async function GET() {
  const session = await resolveSessionFromCookies();
  return NextResponse.json(session);
}
