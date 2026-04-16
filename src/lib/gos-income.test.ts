import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { initializeDatabaseSchema } from '@/db/bootstrap';
import * as schema from '@/db/schema';
import { seedGosStartingTreasuries } from './gos-income';

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
