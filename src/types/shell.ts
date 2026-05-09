import type { GameDto } from '@/types/api';
import type { GameInitState, GamePhase, GMSetupState, PlayerSetupState } from '@/types/game';

export type GameShellRole = 'gm' | 'player' | null;

export interface GameShellSessionDto {
  role: GameShellRole;
  gameId: string | null;
  realmId: string | null;
  gamePhase: GamePhase | null;
  initState: GameInitState | null;
  gmSetupState: GMSetupState | null;
  playerSetupState: PlayerSetupState | null;
  displayName: string | null;
  territoryId: string | null;
  claimCode: string | null;
}

export interface GameShellRealmDto {
  id: string;
  name: string;
  color: string | null;
  isNPC: boolean;
}

export interface GameShellSetupDto {
  canStartGame: boolean;
  claimedPlayerCount: number;
  readyPlayerCount: number;
  totalPlayerCount: number;
}

export interface GameShellDto {
  game: GameDto;
  session: GameShellSessionDto;
  activeRealmId: string | null;
  currentRealm: GameShellRealmDto | null;
  realms: GameShellRealmDto[];
  setup: GameShellSetupDto | null;
}
