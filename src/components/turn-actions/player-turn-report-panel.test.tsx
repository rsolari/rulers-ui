import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlayerTurnReportPanel } from './player-turn-report-panel';
import type { EconomyProjectionDto } from '@/lib/economy-dto';
import type { CurrentTurnResponseDto, TurnHistoryEntry } from '@/types/game';

function jsonResponse(body: unknown, init?: { ok?: boolean; status?: number }) {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

const currentTurn: CurrentTurnResponseDto = {
  game: {
    id: 'game-1',
    currentYear: 2,
    currentSeason: 'Summer',
    turnPhase: 'Submission',
  },
  realm: {
    realmId: 'realm-1',
    realmName: 'Aster',
    report: null,
    actions: [],
    events: [],
  },
};

const history: { history: TurnHistoryEntry[] } = {
  history: [
    {
      realmId: 'realm-1',
      realmName: 'Aster',
      report: {
        id: 'report-1',
        gameId: 'game-1',
        realmId: 'realm-1',
        year: 2,
        season: 'Spring',
        status: 'resolved',
        gmNotes: null,
      },
      actions: [
        {
          id: 'action-build',
          turnReportId: 'report-1',
          gameId: 'game-1',
          realmId: 'realm-1',
          year: 2,
          season: 'Spring',
          kind: 'financial',
          status: 'executed',
          outcome: 'success',
          sortOrder: 0,
          description: 'Raise a public theatre.',
          actionWords: [],
          targetRealmId: null,
          assignedNobleId: null,
          triggerCondition: null,
          financialType: 'build',
          buildingType: 'Theatre',
          troopType: null,
          shipType: null,
          fleetId: null,
          settlementId: 'settlement-1',
          territoryId: null,
          material: null,
          wallSize: null,
          ownerGosId: null,
          allottedGosId: null,
          locationType: 'settlement',
          buildingSize: 'Medium',
          takesBuildingSlot: true,
          constructionTurns: 3,
          taxType: null,
          technicalKnowledgeKey: null,
          cost: 1500,
          spawnedEventId: null,
          resolutionSummary: null,
          resolutionRolls: [],
          submittedAt: null,
          submittedBy: null,
          executedAt: null,
          executedBy: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          comments: [],
        },
        {
          id: 'action-recruit',
          turnReportId: 'report-1',
          gameId: 'game-1',
          realmId: 'realm-1',
          year: 2,
          season: 'Spring',
          kind: 'financial',
          status: 'executed',
          outcome: 'success',
          sortOrder: 1,
          description: 'Muster town militia.',
          actionWords: [],
          targetRealmId: null,
          assignedNobleId: null,
          triggerCondition: null,
          financialType: 'recruit',
          buildingType: null,
          troopType: 'Spearmen',
          shipType: null,
          fleetId: null,
          settlementId: 'settlement-1',
          territoryId: null,
          material: null,
          wallSize: null,
          ownerGosId: null,
          allottedGosId: null,
          locationType: null,
          buildingSize: null,
          takesBuildingSlot: null,
          constructionTurns: null,
          taxType: null,
          technicalKnowledgeKey: null,
          cost: 250,
          spawnedEventId: null,
          resolutionSummary: null,
          resolutionRolls: [],
          submittedAt: null,
          submittedBy: null,
          executedAt: null,
          executedBy: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          comments: [],
        },
      ],
      events: [],
    },
  ],
};

const projection: EconomyProjectionDto = {
  realm: {
    id: 'realm-1',
    name: 'Aster',
    taxType: 'Tribute',
    taxTypeApplied: 'Tribute',
    nextTaxType: 'Tribute',
  },
  openingTreasury: 1000,
  projectedTreasury: 1200,
  totalRevenue: 200,
  totalCosts: 0,
  netChange: 200,
  foodProduced: 0,
  foodNeeded: 0,
  foodSurplus: 0,
  projectedTurmoil: 0,
  buildingTurmoilReduction: 0,
  turmoilBreakdown: [],
  warnings: [],
  settlementBreakdown: [],
  projectedLedgerEntries: [],
};

describe('PlayerTurnReportPanel', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(jsonResponse(currentTurn))
      .mockResolvedValueOnce(jsonResponse(history))
	      .mockResolvedValueOnce(jsonResponse([{ id: 'settlement-1', name: 'Aster Keep' }]))
	      .mockResolvedValueOnce(jsonResponse([{ id: 'realm-1', name: 'Aster' }]))
	      .mockResolvedValueOnce(jsonResponse([]))
	      .mockResolvedValueOnce(jsonResponse([]))
	      .mockResolvedValueOnce(jsonResponse(projection)));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows resolved construction and recruit orders in the compact financial ledger', async () => {
    render(<PlayerTurnReportPanel gameId="game-1" realmId="realm-1" compact />);

    expect((await screen.findAllByText('Build Theatre in Aster Keep')).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Recruit Spearmen at Aster Keep').length).toBeGreaterThanOrEqual(1);
    expect(fetch).toHaveBeenCalledWith('/api/game/game-1/turn?realmId=realm-1', { cache: 'no-store' });
    expect(fetch).toHaveBeenCalledWith('/api/game/game-1/turn/history?realmId=realm-1', { cache: 'no-store' });
  });
});
