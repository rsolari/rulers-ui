import { eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { db } from '@/db';
import { buildings, realms, settlements, troops } from '@/db/schema';
import { generateRealmStartingPackage } from '@/lib/game-logic/map-generation';
import { getStartingSettlementFortifications } from '@/lib/game-logic/starting-fortifications';
import type { SettlementSize } from '@/types/game';

type RealmBootstrapDatabase = Pick<typeof db, 'insert' | 'update'>;

interface InitializeRealmCapitalOptions {
  capitalHexId: string;
  capitalName: string;
  capitalSettlementId?: string;
  capitalSize?: SettlementSize;
  realmId: string;
  territoryId: string;
}

export function initializeRealmCapital(
  database: RealmBootstrapDatabase,
  {
    capitalHexId,
    capitalName,
    capitalSettlementId = uuid(),
    capitalSize = 'Town',
    realmId,
    territoryId,
  }: InitializeRealmCapitalOptions,
) {
  database.insert(settlements).values({
    id: capitalSettlementId,
    territoryId,
    hexId: capitalHexId,
    realmId,
    name: capitalName,
    size: capitalSize,
    isCapital: true,
    governingNobleId: null,
  }).run();

  for (const fortification of getStartingSettlementFortifications(capitalSize)) {
    database.insert(buildings).values({
      id: uuid(),
      settlementId: capitalSettlementId,
      territoryId,
      hexId: capitalHexId,
      locationType: 'settlement',
      type: fortification.type,
      category: fortification.category,
      size: fortification.size,
      material: fortification.material,
      takesBuildingSlot: fortification.takesBuildingSlot,
    }).run();
  }

  for (const troop of generateRealmStartingPackage().troops) {
    database.insert(troops).values({
      id: uuid(),
      realmId,
      type: troop.type,
      class: troop.class,
      armourType: troop.armourType,
      condition: 'Healthy',
      armyId: null,
      garrisonSettlementId: capitalSettlementId,
      recruitmentTurnsRemaining: 0,
    }).run();
  }

  database.update(realms)
    .set({ capitalSettlementId })
    .where(eq(realms.id, realmId))
    .run();

  return { capitalSettlementId };
}
