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
      treasury: 5000,
      taxType: 'Tribute',
    },
    {
      id: 'realm-2',
      gameId: 'game-1',
      name: 'Bastion',
      governmentType: 'Council',
      treasury: 5000,
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

  it('submits political actions while auto-resolving build and recruit actions', () => {
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
      buildingType: 'Theatre',
      settlementId: 'settlement-1',
      description: 'Raise a public theatre.',
      cost: 0,
    });

    service.createAction('game-1', 'realm-1', {
      kind: 'financial',
      financialType: 'recruit',
      troopType: 'Spearmen',
      settlementId: 'settlement-1',
      description: 'Muster the town militia.',
      cost: 0,
    });

    const result = service.submitTurn('game-1', 'realm-1', {
      role: 'player',
      label: 'Aster Player',
    });

    expect(result.report.status).toBe('submitted');
    expect(result.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'political',
        status: 'submitted',
      }),
      expect.objectContaining({
        financialType: 'build',
        status: 'executed',
        outcome: 'success',
        buildingSize: 'Medium',
        cost: 1500,
      }),
      expect.objectContaining({
        financialType: 'recruit',
        status: 'executed',
        outcome: 'success',
        cost: 250,
      }),
    ]));

    const building = db.select().from(schema.buildings).where(eq(schema.buildings.settlementId, 'settlement-1')).get();
    expect(building).toMatchObject({
      type: 'Theatre',
      constructionTurnsRemaining: 3,
    });

    const troop = db.select().from(schema.troops).where(eq(schema.troops.realmId, 'realm-1')).get();
    expect(troop).toMatchObject({
      type: 'Spearmen',
      garrisonSettlementId: 'settlement-1',
      recruitmentSettlementId: 'settlement-1',
      recruitmentTurnsRemaining: 1,
    });

    const realm = db.select().from(schema.realms).where(eq(schema.realms.id, 'realm-1')).get();
    expect(realm?.treasury).toBe(3250);

    sqlite.close();
  });

  it('rolls back submission when an auto-resolved financial action fails validation', () => {
    const { sqlite, db } = createTestDatabase();
    seedRealm(db);
    const service = createTurnActionService(db);

    db.update(schema.realms)
      .set({ treasury: 1000 })
      .where(eq(schema.realms.id, 'realm-1'))
      .run();

    service.createAction('game-1', 'realm-1', {
      kind: 'financial',
      financialType: 'build',
      buildingType: 'Theatre',
      settlementId: 'settlement-1',
      description: 'Raise a public theatre.',
      cost: 0,
    });

    expect(() => service.submitTurn('game-1', 'realm-1', {
      role: 'player',
      label: 'Aster Player',
    })).toThrow(TurnActionError);

    const building = db.select().from(schema.buildings).where(eq(schema.buildings.settlementId, 'settlement-1')).get();
    expect(building).toBeUndefined();

    const realm = db.select().from(schema.realms).where(eq(schema.realms.id, 'realm-1')).get();
    expect(realm?.treasury).toBe(1000);

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
