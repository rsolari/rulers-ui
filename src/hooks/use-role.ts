'use client';

export type GameRole = 'gm' | 'player' | null;

interface RoleState {
  role: GameRole;
  gameId: string | null;
  realmId: string | null;
}

function readRoleState(): RoleState {
  if (typeof document === 'undefined') {
    return { role: null, gameId: null, realmId: null };
  }

  const cookies = document.cookie.split(';').reduce((acc, cookie) => {
    const [key, val] = cookie.trim().split('=');
    acc[key] = val;
    return acc;
  }, {} as Record<string, string>);

  return {
    role: (cookies['rulers-role'] as GameRole) || null,
    gameId: cookies['rulers-game-id'] || null,
    realmId: cookies['rulers-realm-id'] || null,
  };
}

export function useRole(): RoleState {
  return readRoleState();
}
