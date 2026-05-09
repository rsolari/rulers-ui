import type { games } from '@/db/schema';
import type { GameDto } from '@/types/api';
import type { Season, TurnPhase } from '@/types/game';

type GameRecord = typeof games.$inferSelect;

export function toPublicGame(game: GameRecord, role: 'gm' | 'player' | null): GameDto {
  return {
    id: game.id,
    name: game.name,
    gamePhase: game.gamePhase,
    initState: game.initState,
    gmSetupState: game.gmSetupState,
    currentYear: game.currentYear,
    currentSeason: game.currentSeason as Season,
    turnPhase: game.turnPhase as TurnPhase,
    createdAt: game.createdAt,
    ...(role === 'gm' ? { gmCode: game.gmCode } : {}),
  };
}
