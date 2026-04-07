import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { initializeDatabaseSchema } from '@/db/bootstrap';
import * as schema from '@/db/schema';
import { createTurnActionService, TurnActionError } from '@/lib/turn-action-service';

function createTestDatabase() {
  const sqlite = new Database(':memory:');
  initializeDatabaseSchema(sqlite);
  return {
    sqlite,
    db: drizzle(sqlite, { schema }),
  };
}

function seedRealm(db: ReturnType<typeof createTestDatabase>['db']) {
  db.insert(schema.games).values({
    id: 'game-1',
    name: 'Turn Action Test',
    gmCode: 'gm-code',
    playerCode: 'player-code',
    currentYear: 2,
    currentSeason: 'Spring',
    turnPhase: 'Submission',
  }).run();

  db.insert(schema.realms).values([
    {
      id: 'realm-1',
      gameId: 'game-1',
      name: 'Aster',
      governmentType: 'Monarch',
      treasury: 1000,
      taxType: 'Tribute',
    },
    {
      id: 'realm-2',
      gameId: 'game-1',
      name: 'Bastion',
      governmentType: 'Council',
      treasury: 1000,
      taxType: 'Tribute',
    },
  ]).run();

  db.insert(schema.territories).values([
    { id: 'territory-1', gameId: 'game-1', name: 'Aster Vale', realmId: 'realm-1' },
    { id: 'territory-2', gameId: 'game-1', name: 'Bastion Reach', realmId: 'realm-2' },
  ]).run();

  db.insert(schema.settlements).values([
    { id: 'settlement-1', territoryId: 'territory-1', realmId: 'realm-1', name: 'Aster Keep', size: 'Village' },
    { id: 'settlement-2', territoryId: 'territory-2', realmId: 'realm-2', name: 'Bastion Port', size: 'Town' },
  ]).run();
}

describe('turn action service', () => {
  it('creates canonical actions, auto-creates the report container, and enforces aggregate validation', () => {
    const { sqlite, db } = createTestDatabase();
    seedRealm(db);
    const service = createTurnActionService(db);

    const firstAction = service.createAction('game-1', 'realm-1', {
      kind: 'financial',
      financialType: 'taxChange',
      taxType: 'Levy',
      cost: 0,
    });

    expect(firstAction.kind).toBe('financial');

    const report = db.select().from(schema.turnReports).where(eq(schema.turnReports.realmId, 'realm-1')).get();
    expect(report).toMatchObject({
      gameId: 'game-1',
      realmId: 'realm-1',
      status: 'draft',
    });

    expect(() => service.createAction('game-1', 'realm-1', {
      kind: 'financial',
      financialType: 'taxChange',
      taxType: 'Tribute',
      cost: 0,
    })).toThrow(TurnActionError);

    const totalReports = db.select().from(schema.turnReports).all();
    expect(totalReports).toHaveLength(1);

    sqlite.close();
  });

  it('submits draft actions and blocks invalid settlement ownership', () => {
    const { sqlite, db } = createTestDatabase();
    seedRealm(db);
    const service = createTurnActionService(db);

    expect(() => service.createAction('game-1', 'realm-1', {
      kind: 'financial',
      financialType: 'build',
      buildingType: 'Fort',
      settlementId: 'settlement-2',
      cost: 100,
    })).toThrow(TurnActionError);

    service.createAction('game-1', 'realm-1', {
      kind: 'political',
      actionWords: ['Discuss', 'Offer'],
      description: 'Open negotiations with our neighbors.',
    });

    service.createAction('game-1', 'realm-1', {
      kind: 'financial',
      financialType: 'build',
      buildingType: 'Fort',
      settlementId: 'settlement-1',
      description: 'Raise a fort on the border.',
      cost: 200,
    });

    const result = service.submitTurn('game-1', 'realm-1', {
      role: 'player',
      label: 'Aster Player',
    });

    expect(result.report.status).toBe('submitted');
    expect(result.actions.every((action) => action.status === 'submitted')).toBe(true);

    sqlite.close();
  });

  it('lets the GM execute submitted political actions and resolves the report once all actions are executed', () => {
    const { sqlite, db } = createTestDatabase();
    seedRealm(db);
    const service = createTurnActionService(db);

    const action = service.createAction('game-1', 'realm-1', {
      kind: 'political',
      actionWords: ['Declare', 'Send'],
      description: 'Send a declaration to Bastion.',
    });

    service.submitTurn('game-1', 'realm-1', {
      role: 'player',
      label: 'Aster Player',
    });

    const updated = service.updateAction('game-1', action.id, 'realm-1', {
      role: 'gm',
      label: 'GM',
    }, {
      status: 'executed',
      outcome: 'success',
      resolutionSummary: 'The message was delivered without incident.',
    });

    expect(updated.status).toBe('executed');
    expect(updated.outcome).toBe('success');

    const report = db.select().from(schema.turnReports).where(eq(schema.turnReports.realmId, 'realm-1')).get();
    expect(report?.status).toBe('resolved');

    sqlite.close();
  });

  it('returns read-only history scoped to the requested realm with comments attached', () => {
    const { sqlite, db } = createTestDatabase();
    seedRealm(db);
    const service = createTurnActionService(db);

    const action = service.createAction('game-1', 'realm-1', {
      kind: 'political',
      actionWords: ['Search'],
      description: 'Search for spies in the port.',
    });

    service.createComment('game-1', action.id, {
      role: 'player',
      label: 'Aster Player',
    }, 'We suspect activity near the docks.', 'realm-1');

    service.submitTurn('game-1', 'realm-1', {
      role: 'player',
      label: 'Aster Player',
    });

    db.update(schema.games).set({ currentSeason: 'Summer' }).where(eq(schema.games.id, 'game-1')).run();

    const history = service.getTurnHistory('game-1', 'realm-1');
    expect(history.history).toHaveLength(1);
    expect(history.history[0]).toMatchObject({
      realmId: 'realm-1',
      realmName: 'Aster',
    });
    expect(history.history[0].actions[0].comments[0].body).toContain('docks');

    sqlite.close();
  });
});
