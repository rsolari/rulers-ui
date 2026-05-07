import type { ActionAuthorRole } from '@/types/game';

export function getTurnActorLabel(role: ActionAuthorRole, displayName?: string | null) {
  if (role === 'gm') return 'GM';
  return displayName?.trim() || 'Player';
}
