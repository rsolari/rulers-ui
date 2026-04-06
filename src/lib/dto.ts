import type { games } from '@/db/schema';

type GameRecord = typeof games.$inferSelect;

export function toPublicGame(game: GameRecord, role: 'gm' | 'player' | null) {
  if (role === 'gm') {
    return game;
  }

  return {
    id: game.id,
    name: game.name,
    gamePhase: game.gamePhase,
    currentYear: game.currentYear,
    currentSeason: game.currentSeason,
    turnPhase: game.turnPhase,
    createdAt: game.createdAt,
  };
}
