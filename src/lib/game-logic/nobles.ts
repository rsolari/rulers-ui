import { and, eq, ne, or } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { type DB } from '@/db';
import {
  armies,
  fleets,
  governanceEvents,
  guildsOrdersSocieties,
  nobleTitles,
  nobles,
  realms,
  settlements,
} from '@/db/schema';
import type { GovernanceEventType, NobleTitleType, Season } from '@/types/game';

type Transaction = Parameters<Parameters<DB['transaction']>[0]>[0];
export type DatabaseExecutor = DB | Transaction;

export class GovernanceError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function isGovernanceError(error: unknown): error is GovernanceError {
  return error instanceof GovernanceError;
}

export function requireRealm(
  database: DatabaseExecutor,
  gameId: string,
  realmId: string,
) {
  const realm = database.select().from(realms)
    .where(and(eq(realms.id, realmId), eq(realms.gameId, gameId)))
    .get();

  if (!realm) {
    throw new GovernanceError('Realm not found', 404);
  }

  return realm;
}

export function requireNoble(
  database: DatabaseExecutor,
  nobleId: string,
) {
  const noble = database.select().from(nobles).where(eq(nobles.id, nobleId)).get();

  if (!noble) {
    throw new GovernanceError('Noble not found', 404);
  }

  return noble;
}

export function requireRealmNoble(
  database: DatabaseExecutor,
  realmId: string,
  nobleId: string,
) {
  const noble = database.select().from(nobles)
    .where(and(eq(nobles.id, nobleId), eq(nobles.realmId, realmId)))
    .get();

  if (!noble) {
    throw new GovernanceError('Noble not found for this realm', 404);
  }

  return noble;
}

export function assertNobleCanHoldOffice(
  noble: typeof nobles.$inferSelect,
  realmId: string,
  roleLabel = 'office',
) {
  if (noble.realmId !== realmId) {
    throw new GovernanceError(`${roleLabel} holder must belong to this realm`, 400);
  }

  if (!noble.isAlive) {
    throw new GovernanceError(`Dead nobles cannot hold ${roleLabel}`, 400);
  }

  if (noble.isPrisoner) {
    throw new GovernanceError(`Imprisoned nobles cannot hold ${roleLabel}`, 400);
  }
}

type ExclusiveOfficeScope = {
  settlementId?: string | null;
  armyId?: string | null;
  fleetId?: string | null;
  gosId?: string | null;
};

function getNobleExclusiveOfficeConflict(
  database: DatabaseExecutor,
  nobleId: string,
  scope: ExclusiveOfficeScope = {},
) {
  const settlementConflict = database.select({
    name: settlements.name,
  })
    .from(settlements)
    .where(scope.settlementId
      ? and(eq(settlements.governingNobleId, nobleId), ne(settlements.id, scope.settlementId))
      : eq(settlements.governingNobleId, nobleId))
    .get();

  if (settlementConflict) {
    return `governor of ${settlementConflict.name}`;
  }

  const armyConflict = database.select({
    name: armies.name,
  })
    .from(armies)
    .where(scope.armyId
      ? and(eq(armies.generalId, nobleId), ne(armies.id, scope.armyId))
      : eq(armies.generalId, nobleId))
    .get();

  if (armyConflict) {
    return `general of ${armyConflict.name}`;
  }

  const fleetConflict = database.select({
    name: fleets.name,
  })
    .from(fleets)
    .where(scope.fleetId
      ? and(eq(fleets.admiralId, nobleId), ne(fleets.id, scope.fleetId))
      : eq(fleets.admiralId, nobleId))
    .get();

  if (fleetConflict) {
    return `admiral of ${fleetConflict.name}`;
  }

  const gosConflict = database.select({
    name: guildsOrdersSocieties.name,
  })
    .from(guildsOrdersSocieties)
    .where(scope.gosId
      ? and(eq(guildsOrdersSocieties.leaderId, nobleId), ne(guildsOrdersSocieties.id, scope.gosId))
      : eq(guildsOrdersSocieties.leaderId, nobleId))
    .get();

  if (gosConflict) {
    return `leader of ${gosConflict.name}`;
  }

  return null;
}

export function assertNobleCanHoldExclusiveOffice(
  database: DatabaseExecutor,
  noble: typeof nobles.$inferSelect,
  realmId: string,
  roleLabel = 'office',
  scope: ExclusiveOfficeScope = {},
) {
  assertNobleCanHoldOffice(noble, realmId, roleLabel);

  const conflict = getNobleExclusiveOfficeConflict(database, noble.id, scope);

  if (conflict) {
    throw new GovernanceError(`${noble.name} already serves as ${conflict} and cannot also hold ${roleLabel}`, 400);
  }
}

export function assertRealmNotFallen(realm: typeof realms.$inferSelect) {
  if (realm.governanceState === 'realm_fallen') {
    throw new GovernanceError('Fallen realms cannot appoint offices', 400);
  }
}

export function createGovernanceEvent(
  database: DatabaseExecutor,
  input: {
    gameId: string;
    realmId: string;
    year: number;
    season: Season;
    eventType: GovernanceEventType;
    description: string;
    createdByRole?: 'gm' | 'system';
    nobleId?: string | null;
    relatedNobleId?: string | null;
    settlementId?: string | null;
    armyId?: string | null;
    fleetId?: string | null;
    gosId?: string | null;
    payload?: Record<string, unknown>;
  },
) {
  const event = {
    id: uuid(),
    gameId: input.gameId,
    realmId: input.realmId,
    year: input.year,
    season: input.season,
    eventType: input.eventType,
    nobleId: input.nobleId ?? null,
    relatedNobleId: input.relatedNobleId ?? null,
    settlementId: input.settlementId ?? null,
    armyId: input.armyId ?? null,
    fleetId: input.fleetId ?? null,
    gosId: input.gosId ?? null,
    payload: JSON.stringify(input.payload ?? {}),
    description: input.description,
    createdByRole: input.createdByRole ?? 'gm',
  };

  database.insert(governanceEvents).values(event).run();
  return event;
}

export function grantTitle(
  database: DatabaseExecutor,
  input: {
    gameId: string;
    realmId: string;
    nobleId: string;
    type: NobleTitleType;
    label: string;
    year: number;
    season: Season;
    notes?: string | null;
    settlementId?: string | null;
    armyId?: string | null;
    fleetId?: string | null;
    gosId?: string | null;
  },
) {
  const title = {
    id: uuid(),
    gameId: input.gameId,
    realmId: input.realmId,
    nobleId: input.nobleId,
    type: input.type,
    label: input.label,
    settlementId: input.settlementId ?? null,
    armyId: input.armyId ?? null,
    fleetId: input.fleetId ?? null,
    gosId: input.gosId ?? null,
    isActive: true,
    grantedYear: input.year,
    grantedSeason: input.season,
    revokedYear: null,
    revokedSeason: null,
    notes: input.notes ?? null,
  };

  database.insert(nobleTitles).values(title).run();
  return title;
}

export function revokeTitles(
  database: DatabaseExecutor,
  params: {
    year: number;
    season: Season;
    nobleId?: string;
    type?: NobleTitleType;
    settlementId?: string;
    armyId?: string;
    fleetId?: string;
    gosId?: string;
  },
) {
  const predicates = [eq(nobleTitles.isActive, true)];

  if (params.nobleId) predicates.push(eq(nobleTitles.nobleId, params.nobleId));
  if (params.type) predicates.push(eq(nobleTitles.type, params.type));
  if (params.settlementId) predicates.push(eq(nobleTitles.settlementId, params.settlementId));
  if (params.armyId) predicates.push(eq(nobleTitles.armyId, params.armyId));
  if (params.fleetId) predicates.push(eq(nobleTitles.fleetId, params.fleetId));
  if (params.gosId) predicates.push(eq(nobleTitles.gosId, params.gosId));

  database.update(nobleTitles)
    .set({
      isActive: false,
      revokedYear: params.year,
      revokedSeason: params.season,
    })
    .where(and(...predicates))
    .run();
}

export function clearNobleOffices(
  database: DatabaseExecutor,
  nobleId: string,
) {
  database.update(realms)
    .set({
      rulerNobleId: null,
      heirNobleId: null,
      actingRulerNobleId: null,
    })
    .where(or(
      eq(realms.rulerNobleId, nobleId),
      eq(realms.heirNobleId, nobleId),
      eq(realms.actingRulerNobleId, nobleId),
    ))
    .run();

  database.update(settlements)
    .set({ governingNobleId: null })
    .where(eq(settlements.governingNobleId, nobleId))
    .run();

  database.update(armies)
    .set({ generalId: null })
    .where(eq(armies.generalId, nobleId))
    .run();

  database.update(fleets)
    .set({ admiralId: null })
    .where(eq(fleets.admiralId, nobleId))
    .run();

  database.update(guildsOrdersSocieties)
    .set({ leaderId: null })
    .where(eq(guildsOrdersSocieties.leaderId, nobleId))
    .run();
}

export function clearRealmOffices(
  database: DatabaseExecutor,
  realmId: string,
) {
  database.update(realms)
    .set({
      rulerNobleId: null,
      heirNobleId: null,
      actingRulerNobleId: null,
    })
    .where(eq(realms.id, realmId))
    .run();

  database.update(settlements)
    .set({ governingNobleId: null })
    .where(eq(settlements.realmId, realmId))
    .run();

  database.update(armies)
    .set({ generalId: null })
    .where(eq(armies.realmId, realmId))
    .run();

  database.update(fleets)
    .set({ admiralId: null })
    .where(eq(fleets.realmId, realmId))
    .run();

  database.update(guildsOrdersSocieties)
    .set({ leaderId: null })
    .where(eq(guildsOrdersSocieties.realmId, realmId))
    .run();
}
