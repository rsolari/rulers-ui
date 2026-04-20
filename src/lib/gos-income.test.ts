import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { initializeDatabaseSchema } from '@/db/bootstrap';
import * as schema from '@/db/schema';
import { computeGuildIncomeMap, creditGosTurnIncome, seedGosStartingTreasuries } from './gos-income';

function createTestDatabase() {
  const sqlite = new Database(':memory:');
  initializeDatabaseSchema(sqlite);
  return drizzle(sqlite, { schema });
}

describe('seedGosStartingTreasuries', () => {
  it('sets each GOS treasury to at least one turn of current asset income', () => {
    const db = createTestDatabase();

    db.insert(schema.games).values({
      id: 'game-1',
      name: 'Game',
      gmCode: 'GM1234',
      playerCode: 'PL1234',
    }).run();
    db.insert(schema.realms).values({
      id: 'realm-1',
      gameId: 'game-1',
      name: 'Albion',
      governmentType: 'Monarch',
    }).run();
    db.insert(schema.territories).values({
      id: 'territory-1',
      gameId: 'game-1',
      name: 'Coreland',
      realmId: 'realm-1',
    }).run();
    db.insert(schema.settlements).values({
      id: 'settlement-1',
      territoryId: 'territory-1',
      realmId: 'realm-1',
      name: 'Capital',
      size: 'Town',
    }).run();
    db.insert(schema.guildsOrdersSocieties).values([
      {
        id: 'guild-1',
        realmId: 'realm-1',
        name: 'Masons Guild',
        type: 'Guild',
        treasury: 0,
      },
      {
        id: 'order-1',
        realmId: 'realm-1',
        name: 'Order of Stone',
        type: 'Order',
        treasury: 2000,
      },
    ]).run();
    db.insert(schema.gosRealms).values([
      { gosId: 'guild-1', realmId: 'realm-1' },
      { gosId: 'order-1', realmId: 'realm-1' },
    ]).run();
    db.insert(schema.resourceSites).values({
      id: 'resource-1',
      territoryId: 'territory-1',
      settlementId: 'settlement-1',
      resourceType: 'Stone',
      rarity: 'Common',
      ownerGosId: 'guild-1',
    }).run();
    db.insert(schema.buildings).values({
      id: 'church-1',
      settlementId: 'settlement-1',
      territoryId: 'territory-1',
      locationType: 'settlement',
      type: 'Church',
      category: 'Civic',
      size: 'Medium',
      allottedGosId: 'order-1',
      isOperational: true,
      constructionTurnsRemaining: 0,
    }).run();

    expect(seedGosStartingTreasuries(db, 'game-1')).toBe(1);

    const guild = db.select().from(schema.guildsOrdersSocieties)
      .where(eq(schema.guildsOrdersSocieties.id, 'guild-1'))
      .get();
    const order = db.select().from(schema.guildsOrdersSocieties)
      .where(eq(schema.guildsOrdersSocieties.id, 'order-1'))
      .get();

    expect(guild?.treasury).toBe(1200);
    expect(order?.treasury).toBe(2000);
  });
});

type TestDB = ReturnType<typeof createTestDatabase>;

function seedGame(db: TestDB) {
  db.insert(schema.games).values({
    id: 'g1', name: 'Game', gmCode: 'GM', playerCode: 'PL',
  }).run();
  db.insert(schema.realms).values([
    { id: 'r1', gameId: 'g1', name: 'Alpha', governmentType: 'Monarch' },
    { id: 'r2', gameId: 'g1', name: 'Beta', governmentType: 'Monarch' },
  ]).run();
  db.insert(schema.territories).values([
    { id: 't1', gameId: 'g1', name: 'T1', realmId: 'r1' },
    { id: 't2', gameId: 'g1', name: 'T2', realmId: 'r2' },
  ]).run();
  db.insert(schema.settlements).values([
    { id: 's1', territoryId: 't1', realmId: 'r1', name: 'S1', size: 'Town' },
    { id: 's2', territoryId: 't2', realmId: 'r2', name: 'S2', size: 'Town' },
  ]).run();
}

function createGuild(db: TestDB, id: string, realmId: string, monopolyProduct: string | null, realmIds: string[] = [realmId]) {
  db.insert(schema.guildsOrdersSocieties).values({
    id, realmId, name: id, type: 'Guild', treasury: 0, monopolyProduct: monopolyProduct as never,
  }).run();
  for (const rid of realmIds) {
    db.insert(schema.gosRealms).values({ gosId: id, realmId: rid }).run();
  }
}

describe('computeGuildIncomeMap', () => {
  it('pays a guild 10% on monopoly-matching sites inside its operating realms', () => {
    const db = createTestDatabase();
    seedGame(db);
    createGuild(db, 'brewers', 'r1', 'Timber');
    db.insert(schema.resourceSites).values({
      id: 'rs1', territoryId: 't1', settlementId: 's1',
      resourceType: 'Timber', rarity: 'Common',
    }).run();

    const income = computeGuildIncomeMap(db, 'g1');

    expect(income.get('brewers')).toBe(1200);
  });

  it('pays ownership income for non-matching product', () => {
    const db = createTestDatabase();
    seedGame(db);
    createGuild(db, 'brewers', 'r1', 'Timber');
    db.insert(schema.resourceSites).values({
      id: 'rs1', territoryId: 't1', settlementId: 's1',
      resourceType: 'Marble', rarity: 'Luxury', ownerGosId: 'brewers',
    }).run();

    const income = computeGuildIncomeMap(db, 'g1');

    expect(income.get('brewers')).toBe(1500);
  });

  it('does not double-pay when both monopoly and ownership apply', () => {
    const db = createTestDatabase();
    seedGame(db);
    createGuild(db, 'brewers', 'r1', 'Timber');
    db.insert(schema.resourceSites).values({
      id: 'rs1', territoryId: 't1', settlementId: 's1',
      resourceType: 'Timber', rarity: 'Common', ownerGosId: 'brewers',
    }).run();

    const income = computeGuildIncomeMap(db, 'g1');

    expect(income.get('brewers')).toBe(1200);
  });

  it('ignores monopoly-matching sites outside the guild`s operating realms', () => {
    const db = createTestDatabase();
    seedGame(db);
    createGuild(db, 'brewers', 'r1', 'Timber', ['r1']);
    db.insert(schema.resourceSites).values({
      id: 'rs2', territoryId: 't2', settlementId: 's2',
      resourceType: 'Timber', rarity: 'Common',
    }).run();

    const income = computeGuildIncomeMap(db, 'g1');

    expect(income.get('brewers')).toBe(0);
  });

  it('pays the industry separately from its resource site under the same monopoly', () => {
    const db = createTestDatabase();
    seedGame(db);
    createGuild(db, 'brewers', 'r1', 'Timber');
    db.insert(schema.resourceSites).values({
      id: 'rs1', territoryId: 't1', settlementId: 's1',
      resourceType: 'Timber', rarity: 'Common',
    }).run();
    db.insert(schema.industries).values({
      id: 'ind1', resourceSiteId: 'rs1', outputProduct: 'Timber', isOperational: true,
    }).run();

    const income = computeGuildIncomeMap(db, 'g1');

    // 1200 (site) + 1200 (industry)
    expect(income.get('brewers')).toBe(2400);
  });

  it('pays food monopolies per food produced in its operating realms', () => {
    const db = createTestDatabase();
    seedGame(db);
    createGuild(db, 'bakers', 'r1', 'Food', ['r1']);
    // Town has 6 empty building slots → 6 food produced in r1
    const income = computeGuildIncomeMap(db, 'g1');

    // 6 food × 200 = 1200
    expect(income.get('bakers')).toBe(1200);
  });

  it('food guild operating in both realms earns food income from both', () => {
    const db = createTestDatabase();
    seedGame(db);
    createGuild(db, 'bakers', 'r1', 'Food', ['r1', 'r2']);

    const income = computeGuildIncomeMap(db, 'g1');

    // 6 food per town × 2 towns × 200 = 2400
    expect(income.get('bakers')).toBe(2400);
  });
});

describe('creditGosTurnIncome', () => {
  it('adds computed income to each guild`s treasury', () => {
    const db = createTestDatabase();
    seedGame(db);
    createGuild(db, 'brewers', 'r1', 'Timber');
    db.insert(schema.resourceSites).values({
      id: 'rs1', territoryId: 't1', settlementId: 's1',
      resourceType: 'Timber', rarity: 'Common',
    }).run();

    creditGosTurnIncome(db, 'g1');
    const after = db.select().from(schema.guildsOrdersSocieties)
      .where(eq(schema.guildsOrdersSocieties.id, 'brewers')).get();

    expect(after?.treasury).toBe(1200);
  });
});
