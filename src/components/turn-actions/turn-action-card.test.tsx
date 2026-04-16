import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TurnActionCard } from './turn-action-card';
import type { TurnActionRecord } from '@/types/game';

function createAction(overrides: Partial<TurnActionRecord> = {}): TurnActionRecord {
  return {
    id: 'action-1',
    turnReportId: 'report-1',
    gameId: 'game-1',
    realmId: 'realm-1',
    year: 1,
    season: 'Spring',
    kind: 'financial',
    status: 'submitted',
    outcome: 'pending',
    sortOrder: 0,
    description: '',
    actionWords: [],
    targetRealmId: null,
    assignedNobleId: null,
    triggerCondition: null,
    financialType: 'taxChange',
    buildingType: null,
    troopType: null,
    shipType: null,
    fleetId: null,
    settlementId: null,
    territoryId: null,
    material: null,
    wallSize: null,
    ownerGosId: null,
    allottedGosId: null,
    locationType: null,
    buildingSize: null,
    takesBuildingSlot: null,
    constructionTurns: null,
    taxType: 'Levy',
    technicalKnowledgeKey: null,
    cost: 0,
    resolutionSummary: null,
    submittedAt: null,
    submittedBy: null,
    executedAt: null,
    executedBy: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    comments: [],
    ...overrides,
  };
}

describe('TurnActionCard', () => {
  it('shows projected revenue, turmoil, and one-year duration for levy tax changes', () => {
    render(
      <TurnActionCard
        action={createAction()}
        settlementOptions={[]}
        taxProjectionContext={{
          currentTaxType: 'Tribute',
          grossSettlementWealth: 10000,
          currentYear: 1,
          currentSeason: 'Spring',
        }}
      />,
    );

    expect(screen.getByText('Revenue +1,500gc / season')).toBeInTheDocument();
    expect(screen.getByText('Turmoil +10')).toBeInTheDocument();
    expect(screen.getByText('Duration 1 year, expires Spring Y2')).toBeInTheDocument();
  });

  it('summarizes ship construction financial actions', () => {
    render(
      <TurnActionCard
        action={createAction({
          financialType: 'constructShip',
          shipType: 'Galley',
          settlementId: 'settlement-1',
          taxType: null,
          cost: 500,
        })}
        settlementOptions={[{ value: 'settlement-1', label: 'Harbor' }]}
      />,
    );

    expect(screen.getByText('Construct Galley at Harbor')).toBeInTheDocument();
  });
});
