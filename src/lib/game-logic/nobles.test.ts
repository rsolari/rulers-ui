import { describe, expect, it } from 'vitest';
import { assertNobleCanHoldExclusiveOffice } from './nobles';

function createDatabase(conflicts: {
  settlement?: { name: string } | null;
  army?: { name: string } | null;
  fleet?: { name: string } | null;
  gos?: { name: string } | null;
}) {
  const results = [
    conflicts.settlement ?? null,
    conflicts.army ?? null,
    conflicts.fleet ?? null,
    conflicts.gos ?? null,
  ];

  return {
    select() {
      return {
        from() {
          return {
            where() {
              return {
                get() {
                  return results.shift() ?? null;
                },
              };
            },
          };
        },
      };
    },
  };
}

const noble = {
  id: 'noble-1',
  realmId: 'realm-1',
  name: 'Lady Rowan',
  isAlive: true,
  isPrisoner: false,
} as const;

describe('assertNobleCanHoldExclusiveOffice', () => {
  it('allows nobles with no conflicting office', () => {
    const database = createDatabase({});

    expect(() => assertNobleCanHoldExclusiveOffice(database as never, noble as never, 'realm-1', 'the governorship'))
      .not.toThrow();
  });

  it('rejects nobles who already govern another settlement', () => {
    const database = createDatabase({
      settlement: { name: 'Stonewatch' },
    });

    expect(() => assertNobleCanHoldExclusiveOffice(database as never, noble as never, 'realm-1', 'the generalship'))
      .toThrow('Lady Rowan already serves as governor of Stonewatch and cannot also hold the generalship');
  });

  it('rejects admirals and gos leaders from taking another office', () => {
    const admiralDatabase = createDatabase({
      fleet: { name: 'Western Fleet' },
    });
    expect(() => assertNobleCanHoldExclusiveOffice(admiralDatabase as never, noble as never, 'realm-1', 'leadership'))
      .toThrow('Lady Rowan already serves as admiral of Western Fleet and cannot also hold leadership');

    const gosDatabase = createDatabase({
      gos: { name: 'Silver Guild' },
    });
    expect(() => assertNobleCanHoldExclusiveOffice(gosDatabase as never, noble as never, 'realm-1', 'the admiralty'))
      .toThrow('Lady Rowan already serves as leader of Silver Guild and cannot also hold the admiralty');
  });
});
