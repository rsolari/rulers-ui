import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { initializeDatabaseSchema } from '@/db/bootstrap';
import * as schema from '@/db/schema';
import { createQuickCombatService } from './quick-combat-service';

function createTestDatabase() {
  const sqlite = new Database(':memory:');
  initializeDatabaseSchema(sqlite);
  return {
    sqlite,
    db: drizzle(sqlite, { schema }),
  };
}

function createSequenceRoller(values: number[]) {
  let index = 0;
  return (count: number) => Array.from({ length: count }, () => values[index++] ?? 1);
}

describe('createQuickCombatService.resolveArmyQuickCombat', () => {
  it('removes non-surviving troops and clears immortals state', () => {
    const { sqlite, db } = createTestDatabase();
    const service = createQuickCombatService(db, createSequenceRoller([6, 1]));

    db.insert(schema.games).values({
      id: 'game-1',
      name: 'Combat Test',
      gmCode: 'gm-combat',
      playerCode: 'player-combat',
    }).run();

    db.insert(schema.realms).values([
      {
        id: 'realm-a',
        gameId: 'game-1',
        name: 'Aster',
        governmentType: 'Monarch',
      },
      {
        id: 'realm-b',
        gameId: 'game-1',
        name: 'Bastion',
        governmentType: 'Monarch',
        immortalsTroopId: 'troop-b-1',
      },
    ]).run();

    db.insert(schema.territories).values([
      { id: 'territory-a', gameId: 'game-1', name: 'Aster Vale', realmId: 'realm-a' },
      { id: 'territory-b', gameId: 'game-1', name: 'Bastion Reach', realmId: 'realm-b' },
    ]).run();

    db.insert(schema.armies).values([
      {
        id: 'army-a',
        realmId: 'realm-a',
        name: 'First Banner',
        locationTerritoryId: 'territory-a',
      },
      {
        id: 'army-b',
        realmId: 'realm-b',
        name: 'Black Guard',
        locationTerritoryId: 'territory-b',
      },
    ]).run();

    db.insert(schema.troops).values([
      {
        id: 'troop-a-1',
        realmId: 'realm-a',
        type: 'Spearmen',
        class: 'Basic',
        armourType: 'Light',
        condition: 'Healthy',
        armyId: 'army-a',
      },
      {
        id: 'troop-b-1',
        realmId: 'realm-b',
        type: 'Spearmen',
        class: 'Basic',
        armourType: 'Light',
        condition: 'Wounded2',
        armyId: 'army-b',
      },
    ]).run();

    const result = service.resolveArmyQuickCombat('game-1', {
      attackerArmyId: 'army-a',
      defenderArmyId: 'army-b',
    });

    expect(result.resolution.winner).toBe('attacker');
    expect(result.persistence.removedTroops).toEqual(['troop-b-1']);
    expect(db.select().from(schema.troops).where(eq(schema.troops.id, 'troop-b-1')).get()).toBeUndefined();
    expect(
      db.select({ immortalsTroopId: schema.realms.immortalsTroopId })
        .from(schema.realms)
        .where(eq(schema.realms.id, 'realm-b'))
        .get(),
    ).toEqual({ immortalsTroopId: null });

    sqlite.close();
  });

  it('includes settlement and fortification defence bonuses for garrison battles', () => {
    const { sqlite, db } = createTestDatabase();
    const service = createQuickCombatService(db, createSequenceRoller([1, 1, 1, 1, 1]));

    db.insert(schema.games).values({
      id: 'game-1',
      name: 'Combat Test',
      gmCode: 'gm-combat',
      playerCode: 'player-combat',
    }).run();

    db.insert(schema.realms).values([
      {
        id: 'realm-a',
        gameId: 'game-1',
        name: 'Aster',
        governmentType: 'Monarch',
      },
      {
        id: 'realm-b',
        gameId: 'game-1',
        name: 'Bastion',
        governmentType: 'Monarch',
      },
    ]).run();

    db.insert(schema.territories).values([
      { id: 'territory-a', gameId: 'game-1', name: 'Aster Vale', realmId: 'realm-a' },
      { id: 'territory-b', gameId: 'game-1', name: 'Bastion Reach', realmId: 'realm-b' },
    ]).run();

    db.insert(schema.settlements).values({
      id: 'settlement-b',
      territoryId: 'territory-b',
      realmId: 'realm-b',
      name: 'Bastion Keep',
      size: 'Town',
    }).run();

    db.insert(schema.buildings).values({
      id: 'walls-b',
      settlementId: 'settlement-b',
      locationType: 'settlement',
      type: 'Walls',
      category: 'Fortification',
      size: 'Medium',
    }).run();

    db.insert(schema.armies).values({
      id: 'army-a',
      realmId: 'realm-a',
      name: 'First Banner',
      locationTerritoryId: 'territory-a',
    }).run();

    db.insert(schema.troops).values([
      {
        id: 'troop-a-1',
        realmId: 'realm-a',
        type: 'Spearmen',
        class: 'Basic',
        armourType: 'Light',
        condition: 'Healthy',
        armyId: 'army-a',
      },
      {
        id: 'troop-b-1',
        realmId: 'realm-b',
        type: 'Spearmen',
        class: 'Basic',
        armourType: 'Light',
        condition: 'Healthy',
        garrisonSettlementId: 'settlement-b',
      },
    ]).run();

    const result = service.resolveArmyQuickCombat('game-1', {
      attackerArmyId: 'army-a',
      defenderSettlementId: 'settlement-b',
    });

    expect(result.resolution.defender.settlementDefenceBonus).toBe(3);
    expect(result.resolution.defender.totalDice).toBe(4);

    sqlite.close();
  });
});
