import { cookies } from 'next/headers';

export function generateGameCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function getGameRole(): Promise<'gm' | 'player' | null> {
  const cookieStore = await cookies();
  const role = cookieStore.get('rulers-role')?.value;
  if (role === 'gm' || role === 'player') return role;
  return null;
}

export async function getGameId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get('rulers-game-id')?.value ?? null;
}

export async function getRealmId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get('rulers-realm-id')?.value ?? null;
}
