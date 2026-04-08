import { and, eq, inArray } from 'drizzle-orm';
import { nobles, nobleTitles, realms, settlements, armies, guildsOrdersSocieties } from '@/db/schema';
import type { EstateLevel, GovernanceState, Season, SettlementSize } from '@/types/game';
import {
  GovernanceError,
  type DatabaseExecutor,
  assertNobleCanHoldOffice,
  assertRealmNotFallen,
  clearNobleOffices,
  clearRealmOffices,
  createGovernanceEvent,
  grantTitle,
  requireNoble,
  requireRealm,
  requireRealmNoble,
  revokeTitles,
} from './nobles';

const ESTATE_LEVEL_ORDER: EstateLevel[] = ['Meagre', 'Comfortable', 'Ample', 'Substantial', 'Luxurious'];

export function getSettlementGovernorRequiredEstate(size: SettlementSize): EstateLevel {
  if (size === 'City') return 'Ample';
  if (size === 'Town') return 'Comfortable';
  return 'Meagre';
}

export function getHighestEstateLevel(levels: Array<EstateLevel | null | undefined>): EstateLevel {
  return levels.reduce<EstateLevel>((highest, level) => {
    if (!level) return highest;
    return ESTATE_LEVEL_ORDER.indexOf(level) > ESTATE_LEVEL_ORDER.indexOf(highest) ? level : highest;
  }, 'Meagre');
}

function collectSettlementEstateLevels(
  settlementsForRealm: Array<Pick<typeof settlements.$inferSelect, 'governingNobleId' | 'size'>>,
) {
  const levelsByNobleId = new Map<string, EstateLevel[]>();

  for (const settlement of settlementsForRealm) {
    if (!settlement.governingNobleId) continue;
    const levels = levelsByNobleId.get(settlement.governingNobleId) ?? [];
    levels.push(getSettlementGovernorRequiredEstate(settlement.size));
    levelsByNobleId.set(settlement.governingNobleId, levels);
  }

  return levelsByNobleId;
}

function resolveRulerVacancy(
  database: DatabaseExecutor,
  input: {
    gameId: string;
    realmId: string;
    year: number;
    season: Season;
    formerRulerId: string;
    description: string;
  },
): GovernanceState {
  const realm = requireRealm(database, input.gameId, input.realmId);

  createGovernanceEvent(database, {
    gameId: input.gameId,
    realmId: input.realmId,
    year: input.year,
    season: input.season,
    eventType: 'succession_triggered',
    nobleId: input.formerRulerId,
    description: input.description,
    createdByRole: 'system',
  });

  if (realm.governmentType === 'Monarch' && realm.heirNobleId) {
    const heir = database.select().from(nobles).where(eq(nobles.id, realm.heirNobleId)).get();

    if (heir && heir.isAlive && !heir.isPrisoner) {
      database.update(realms)
        .set({
          rulerNobleId: heir.id,
          heirNobleId: null,
          actingRulerNobleId: null,
          governanceState: 'stable',
        })
        .where(eq(realms.id, realm.id))
        .run();

      revokeTitles(database, {
        type: 'heir_designation',
        year: input.year,
        season: input.season,
      });

      createGovernanceEvent(database, {
        gameId: input.gameId,
        realmId: input.realmId,
        year: input.year,
        season: input.season,
        eventType: 'succession_resolved',
        nobleId: heir.id,
        relatedNobleId: input.formerRulerId,
        description: `${heir.name} succeeds as ruler.`,
        createdByRole: 'system',
      });

      return 'stable';
    }
  }

  const governanceState: GovernanceState =
    realm.governmentType === 'Monarch' ? 'surrogate_rule' : 'succession_pending_gm';

  database.update(realms)
    .set({
      rulerNobleId: null,
      heirNobleId: null,
      governanceState,
    })
    .where(eq(realms.id, realm.id))
    .run();

  revokeTitles(database, {
    type: 'heir_designation',
    year: input.year,
    season: input.season,
  });

  return governanceState;
}

export function appointRuler(
  database: DatabaseExecutor,
  input: {
    gameId: string;
    realmId: string;
    nobleId: string;
    year: number;
    season: Season;
    description: string;
  },
) {
  const realm = requireRealm(database, input.gameId, input.realmId);
  assertRealmNotFallen(realm);

  const noble = requireRealmNoble(database, input.realmId, input.nobleId);
  assertNobleCanHoldOffice(noble, input.realmId, 'the throne');

  database.update(realms)
    .set({
      rulerNobleId: noble.id,
      actingRulerNobleId: null,
      governanceState: 'stable',
    })
    .where(eq(realms.id, input.realmId))
    .run();

  createGovernanceEvent(database, {
    gameId: input.gameId,
    realmId: input.realmId,
    year: input.year,
    season: input.season,
    eventType: 'ruler_appointed',
    nobleId: noble.id,
    description: input.description,
  });

  return noble;
}

export function designateHeir(
  database: DatabaseExecutor,
  input: {
    gameId: string;
    realmId: string;
    nobleId: string | null;
    year: number;
    season: Season;
    notes?: string | null;
  },
) {
  const realm = requireRealm(database, input.gameId, input.realmId);
  assertRealmNotFallen(realm);

  revokeTitles(database, {
    type: 'heir_designation',
    year: input.year,
    season: input.season,
  });

  if (!input.nobleId) {
    database.update(realms)
      .set({ heirNobleId: null })
      .where(eq(realms.id, input.realmId))
      .run();

    createGovernanceEvent(database, {
      gameId: input.gameId,
      realmId: input.realmId,
      year: input.year,
      season: input.season,
      eventType: 'heir_designated',
      description: input.notes?.trim() || 'Heir designation cleared.',
    });

    return null;
  }

  if (realm.rulerNobleId === input.nobleId) {
    throw new GovernanceError('The current ruler cannot also be the heir', 400);
  }

  const noble = requireRealmNoble(database, input.realmId, input.nobleId);
  assertNobleCanHoldOffice(noble, input.realmId, 'the heirship');

  database.update(realms)
    .set({ heirNobleId: noble.id })
    .where(eq(realms.id, input.realmId))
    .run();

  grantTitle(database, {
    gameId: input.gameId,
    realmId: input.realmId,
    nobleId: noble.id,
    type: 'heir_designation',
    label: 'Designated Heir',
    year: input.year,
    season: input.season,
    notes: input.notes ?? null,
  });

  createGovernanceEvent(database, {
    gameId: input.gameId,
    realmId: input.realmId,
    year: input.year,
    season: input.season,
    eventType: 'heir_designated',
    nobleId: noble.id,
    description: input.notes?.trim() || `${noble.name} was designated as heir.`,
  });

  return noble;
}

export function assignSettlementGovernor(
  database: DatabaseExecutor,
  input: {
    gameId: string;
    settlementId: string;
    nobleId: string | null;
    year: number;
    season: Season;
    notes?: string | null;
    grievanceNobleId?: string | null;
  },
) {
  const settlement = database.select().from(settlements).where(eq(settlements.id, input.settlementId)).get();

  if (!settlement || !settlement.realmId) {
    throw new GovernanceError('Settlement not found', 404);
  }

  const realm = requireRealm(database, input.gameId, settlement.realmId);
  assertRealmNotFallen(realm);

  revokeTitles(database, {
    type: 'settlement_governor',
    settlementId: settlement.id,
    year: input.year,
    season: input.season,
  });

  if (!input.nobleId) {
    database.update(settlements)
      .set({ governingNobleId: null })
      .where(eq(settlements.id, settlement.id))
      .run();

    createGovernanceEvent(database, {
      gameId: input.gameId,
      realmId: settlement.realmId,
      year: input.year,
      season: input.season,
      eventType: 'office_removed',
      settlementId: settlement.id,
      description: input.notes?.trim() || `Governorship of ${settlement.name} was vacated.`,
    });

    return settlement.realmId;
  }

  const noble = requireRealmNoble(database, settlement.realmId, input.nobleId);
  assertNobleCanHoldOffice(noble, settlement.realmId, 'the governorship');

  database.update(settlements)
    .set({ governingNobleId: noble.id })
    .where(eq(settlements.id, settlement.id))
    .run();

  grantTitle(database, {
    gameId: input.gameId,
    realmId: settlement.realmId,
    nobleId: noble.id,
    type: 'settlement_governor',
    label: `${settlement.name} Governor`,
    settlementId: settlement.id,
    year: input.year,
    season: input.season,
    notes: input.notes ?? null,
  });

  createGovernanceEvent(database, {
    gameId: input.gameId,
    realmId: settlement.realmId,
    year: input.year,
    season: input.season,
    eventType: 'office_assigned',
    nobleId: noble.id,
    settlementId: settlement.id,
    description: input.notes?.trim() || `${noble.name} was appointed governor of ${settlement.name}.`,
  });

  if (input.grievanceNobleId) {
    createGovernanceEvent(database, {
      gameId: input.gameId,
      realmId: settlement.realmId,
      year: input.year,
      season: input.season,
      eventType: 'noble_grievance',
      nobleId: input.grievanceNobleId,
      relatedNobleId: noble.id,
      settlementId: settlement.id,
      description: `Appointment of ${noble.name} caused resentment.`,
    });
  }

  return noble.id;
}

export function assignArmyGeneral(
  database: DatabaseExecutor,
  input: {
    gameId: string;
    armyId: string;
    nobleId: string | null;
    year: number;
    season: Season;
    notes?: string | null;
  },
) {
  const army = database.select().from(armies).where(eq(armies.id, input.armyId)).get();

  if (!army) {
    throw new GovernanceError('Army not found', 404);
  }

  const realm = requireRealm(database, input.gameId, army.realmId);
  assertRealmNotFallen(realm);

  revokeTitles(database, {
    type: 'army_general',
    armyId: army.id,
    year: input.year,
    season: input.season,
  });

  if (!input.nobleId) {
    database.update(armies).set({ generalId: null }).where(eq(armies.id, army.id)).run();

    createGovernanceEvent(database, {
      gameId: input.gameId,
      realmId: army.realmId,
      year: input.year,
      season: input.season,
      eventType: 'office_removed',
      armyId: army.id,
      description: input.notes?.trim() || `Command of ${army.name} was vacated.`,
    });

    return null;
  }

  const noble = requireRealmNoble(database, army.realmId, input.nobleId);
  assertNobleCanHoldOffice(noble, army.realmId, 'the generalship');

  database.update(armies).set({ generalId: noble.id }).where(eq(armies.id, army.id)).run();

  grantTitle(database, {
    gameId: input.gameId,
    realmId: army.realmId,
    nobleId: noble.id,
    type: 'army_general',
    label: `${army.name} General`,
    armyId: army.id,
    year: input.year,
    season: input.season,
    notes: input.notes ?? null,
  });

  createGovernanceEvent(database, {
    gameId: input.gameId,
    realmId: army.realmId,
    year: input.year,
    season: input.season,
    eventType: 'office_assigned',
    nobleId: noble.id,
    armyId: army.id,
    description: input.notes?.trim() || `${noble.name} took command of ${army.name}.`,
  });

  return noble.id;
}

export function assignGosLeader(
  database: DatabaseExecutor,
  input: {
    gameId: string;
    gosId: string;
    nobleId: string | null;
    year: number;
    season: Season;
    notes?: string | null;
  },
) {
  const gos = database.select().from(guildsOrdersSocieties).where(eq(guildsOrdersSocieties.id, input.gosId)).get();

  if (!gos) {
    throw new GovernanceError('Guild, order, or society not found', 404);
  }

  const realm = requireRealm(database, input.gameId, gos.realmId);
  assertRealmNotFallen(realm);

  revokeTitles(database, {
    type: 'gos_leader',
    gosId: gos.id,
    year: input.year,
    season: input.season,
  });

  if (!input.nobleId) {
    database.update(guildsOrdersSocieties).set({ leaderId: null }).where(eq(guildsOrdersSocieties.id, gos.id)).run();

    createGovernanceEvent(database, {
      gameId: input.gameId,
      realmId: gos.realmId,
      year: input.year,
      season: input.season,
      eventType: 'office_removed',
      gosId: gos.id,
      description: input.notes?.trim() || `Leadership of ${gos.name} was vacated.`,
    });

    return null;
  }

  const noble = requireRealmNoble(database, gos.realmId, input.nobleId);
  assertNobleCanHoldOffice(noble, gos.realmId, 'leadership');

  database.update(guildsOrdersSocieties).set({ leaderId: noble.id }).where(eq(guildsOrdersSocieties.id, gos.id)).run();

  grantTitle(database, {
    gameId: input.gameId,
    realmId: gos.realmId,
    nobleId: noble.id,
    type: 'gos_leader',
    label: `${gos.name} Leader`,
    gosId: gos.id,
    year: input.year,
    season: input.season,
    notes: input.notes ?? null,
  });

  createGovernanceEvent(database, {
    gameId: input.gameId,
    realmId: gos.realmId,
    year: input.year,
    season: input.season,
    eventType: 'office_assigned',
    nobleId: noble.id,
    gosId: gos.id,
    description: input.notes?.trim() || `${noble.name} now leads ${gos.name}.`,
  });

  return noble.id;
}

export function captureNoble(
  database: DatabaseExecutor,
  input: {
    gameId: string;
    nobleId: string;
    captorRealmId: string;
    year: number;
    season: Season;
    notes?: string | null;
  },
) {
  const noble = requireNoble(database, input.nobleId);
  const realm = requireRealm(database, input.gameId, noble.realmId);
  requireRealm(database, input.gameId, input.captorRealmId);
  const wasRuler = realm.rulerNobleId === noble.id;

  clearNobleOffices(database, noble.id);
  revokeTitles(database, { nobleId: noble.id, type: 'settlement_governor', year: input.year, season: input.season });
  revokeTitles(database, { nobleId: noble.id, type: 'army_general', year: input.year, season: input.season });
  revokeTitles(database, { nobleId: noble.id, type: 'gos_leader', year: input.year, season: input.season });
  revokeTitles(database, { nobleId: noble.id, type: 'heir_designation', year: input.year, season: input.season });

  database.update(nobles)
    .set({
      isPrisoner: true,
      captorRealmId: input.captorRealmId,
      capturedYear: input.year,
      capturedSeason: input.season,
      releasedYear: null,
      releasedSeason: null,
    })
    .where(eq(nobles.id, noble.id))
    .run();

  createGovernanceEvent(database, {
    gameId: input.gameId,
    realmId: noble.realmId,
    year: input.year,
    season: input.season,
    eventType: 'noble_captured',
    nobleId: noble.id,
    payload: { captorRealmId: input.captorRealmId },
    description: input.notes?.trim() || `${noble.name} was captured.`,
  });

  const governanceState = wasRuler
    ? resolveRulerVacancy(database, {
      gameId: input.gameId,
      realmId: noble.realmId,
      year: input.year,
      season: input.season,
      formerRulerId: noble.id,
      description: `${noble.name} was captured, triggering a succession crisis.`,
    })
    : realm.governanceState;

  return { nobleId: noble.id, realmId: noble.realmId, governanceState };
}

export function releaseNoble(
  database: DatabaseExecutor,
  input: {
    gameId: string;
    nobleId: string;
    year: number;
    season: Season;
    notes?: string | null;
  },
) {
  const noble = requireNoble(database, input.nobleId);
  requireRealm(database, input.gameId, noble.realmId);

  database.update(nobles)
    .set({
      isPrisoner: false,
      releasedYear: input.year,
      releasedSeason: input.season,
    })
    .where(eq(nobles.id, noble.id))
    .run();

  createGovernanceEvent(database, {
    gameId: input.gameId,
    realmId: noble.realmId,
    year: input.year,
    season: input.season,
    eventType: 'noble_released',
    nobleId: noble.id,
    description: input.notes?.trim() || `${noble.name} was released from captivity.`,
  });

  return noble;
}

export function recordNobleDeath(
  database: DatabaseExecutor,
  input: {
    gameId: string;
    nobleId: string;
    year: number;
    season: Season;
    cause: string;
    notes?: string | null;
  },
) {
  const noble = requireNoble(database, input.nobleId);
  const realm = requireRealm(database, input.gameId, noble.realmId);
  const wasRuler = realm.rulerNobleId === noble.id;

  clearNobleOffices(database, noble.id);
  database.update(nobleTitles)
    .set({
      isActive: false,
      revokedYear: input.year,
      revokedSeason: input.season,
    })
    .where(and(eq(nobleTitles.nobleId, noble.id), eq(nobleTitles.isActive, true)))
    .run();

  database.update(nobles)
    .set({
      isAlive: false,
      deathYear: input.year,
      deathSeason: input.season,
      deathCause: input.cause,
      isPrisoner: false,
      captorRealmId: null,
    })
    .where(eq(nobles.id, noble.id))
    .run();

  createGovernanceEvent(database, {
    gameId: input.gameId,
    realmId: noble.realmId,
    year: input.year,
    season: input.season,
    eventType: 'noble_died',
    nobleId: noble.id,
    description: input.notes?.trim() || `${noble.name} died: ${input.cause}.`,
    payload: { cause: input.cause },
  });

  const governanceState = wasRuler
    ? resolveRulerVacancy(database, {
      gameId: input.gameId,
      realmId: noble.realmId,
      year: input.year,
      season: input.season,
      formerRulerId: noble.id,
      description: `${noble.name} died, triggering a succession crisis.`,
    })
    : realm.governanceState;

  return { noble, governanceState };
}

export function resolveSuccession(
  database: DatabaseExecutor,
  input: {
    gameId: string;
    realmId: string;
    newRulerNobleId: string;
    newHeirNobleId?: string | null;
    actingRulerNobleId?: string | null;
    year: number;
    season: Season;
    description: string;
  },
) {
  const realm = requireRealm(database, input.gameId, input.realmId);

  if (!['interregnum', 'surrogate_rule', 'succession_pending_gm'].includes(realm.governanceState)) {
    throw new GovernanceError('Realm is not in a resolvable succession state', 400);
  }

  const newRuler = requireRealmNoble(database, input.realmId, input.newRulerNobleId);
  assertNobleCanHoldOffice(newRuler, input.realmId, 'the throne');

  const newHeirId = input.newHeirNobleId ?? null;
  if (newHeirId) {
    if (newHeirId === newRuler.id) {
      throw new GovernanceError('The heir cannot be the new ruler', 400);
    }

    const newHeir = requireRealmNoble(database, input.realmId, newHeirId);
    assertNobleCanHoldOffice(newHeir, input.realmId, 'the heirship');
  }

  let actingRulerId = input.actingRulerNobleId ?? null;
  if (actingRulerId) {
    const actingRuler = requireRealmNoble(database, input.realmId, actingRulerId);
    assertNobleCanHoldOffice(actingRuler, input.realmId, 'the regency');
    if (actingRuler.id === newRuler.id) actingRulerId = null;
  }

  revokeTitles(database, {
    type: 'heir_designation',
    year: input.year,
    season: input.season,
  });

  if (newHeirId) {
    grantTitle(database, {
      gameId: input.gameId,
      realmId: input.realmId,
      nobleId: newHeirId,
      type: 'heir_designation',
      label: 'Designated Heir',
      year: input.year,
      season: input.season,
    });
  }

  database.update(realms)
    .set({
      rulerNobleId: newRuler.id,
      heirNobleId: newHeirId,
      actingRulerNobleId: actingRulerId,
      governanceState: 'stable',
    })
    .where(eq(realms.id, input.realmId))
    .run();

  createGovernanceEvent(database, {
    gameId: input.gameId,
    realmId: input.realmId,
    year: input.year,
    season: input.season,
    eventType: 'succession_resolved',
    nobleId: newRuler.id,
    relatedNobleId: newHeirId,
    description: input.description,
  });

  return {
    rulerNobleId: newRuler.id,
    heirNobleId: newHeirId,
    actingRulerNobleId: actingRulerId,
  };
}

export function markRealmFallen(
  database: DatabaseExecutor,
  input: {
    gameId: string;
    realmId: string;
    year: number;
    season: Season;
    survivingRulerNobleId?: string | null;
    treasuryEscapePercent?: number;
    notes?: string | null;
  },
) {
  const realm = requireRealm(database, input.gameId, input.realmId);
  const escapePercent = Math.max(0, Math.min(input.treasuryEscapePercent ?? 10, 100));

  if (input.survivingRulerNobleId) {
    const survivingRuler = requireRealmNoble(database, input.realmId, input.survivingRulerNobleId);
    assertNobleCanHoldOffice(survivingRuler, input.realmId, 'survival');
  }

  clearRealmOffices(database, input.realmId);
  database.update(nobleTitles)
    .set({
      isActive: false,
      revokedYear: input.year,
      revokedSeason: input.season,
    })
    .where(and(eq(nobleTitles.realmId, input.realmId), eq(nobleTitles.isActive, true)))
    .run();

  database.update(nobles)
    .set({ displacedFromRealmId: input.realmId })
    .where(and(eq(nobles.realmId, input.realmId), eq(nobles.isAlive, true)))
    .run();

  database.update(realms)
    .set({
      governanceState: 'realm_fallen',
      rulerNobleId: null,
      heirNobleId: null,
      actingRulerNobleId: null,
      treasury: Math.floor(realm.treasury * (escapePercent / 100)),
    })
    .where(eq(realms.id, input.realmId))
    .run();

  createGovernanceEvent(database, {
    gameId: input.gameId,
    realmId: input.realmId,
    year: input.year,
    season: input.season,
    eventType: 'realm_fell',
    nobleId: input.survivingRulerNobleId ?? null,
    description: input.notes?.trim() || `${realm.name} has fallen.`,
    payload: { treasuryEscapePercent: escapePercent },
  });

  return realm.id;
}

export function getDisplayEstateLevelsForRealm(
  input: {
    realmRulerNobleId?: string | null;
    settlements: Array<Pick<typeof settlements.$inferSelect, 'governingNobleId' | 'size'>>;
  },
) {
  const levelsByNobleId = collectSettlementEstateLevels(input.settlements);

  if (input.realmRulerNobleId) {
    const rulerLevels = levelsByNobleId.get(input.realmRulerNobleId) ?? [];
    rulerLevels.push('Luxurious');
    levelsByNobleId.set(input.realmRulerNobleId, rulerLevels);
  }

  return new Map(
    [...levelsByNobleId.entries()].map(([nobleId, levels]) => [nobleId, getHighestEstateLevel(levels)]),
  );
}

export function getPaidEstateLevelsForRealm(
  input: {
    realmRulerNobleId?: string | null;
    settlements: Array<Pick<typeof settlements.$inferSelect, 'governingNobleId' | 'size'>>;
  },
) {
  return new Map(
    [...collectSettlementEstateLevels(input.settlements).entries()]
      .filter(([nobleId]) => nobleId !== input.realmRulerNobleId)
      .map(([nobleId, levels]) => [nobleId, getHighestEstateLevel(levels)]),
  );
}

export function revokeStructuralTitlesForNoble(
  database: DatabaseExecutor,
  nobleId: string,
  year: number,
  season: Season,
) {
  const structuralTypes = ['settlement_governor', 'army_general', 'gos_leader', 'heir_designation'] as const;

  database.update(nobleTitles)
    .set({
      isActive: false,
      revokedYear: year,
      revokedSeason: season,
    })
    .where(and(
      eq(nobleTitles.nobleId, nobleId),
      eq(nobleTitles.isActive, true),
      inArray(nobleTitles.type, [...structuralTypes]),
    ))
    .run();
}
