import { describe, expect, it } from 'vitest';
import { buildGameNavigation, equivalentManagedRealmHref } from '@/lib/game-navigation';

describe('buildGameNavigation', () => {
  it('builds player navigation and marks nested realm routes active', () => {
    const nav = buildGameNavigation({
      gameId: 'game-1',
      pathname: '/game/game-1/realm/nobles',
      role: 'player',
      initState: 'active',
      gamePhase: 'Active',
      activeRealmId: 'realm-1',
      isGmManagingRealm: false,
    });

    const items = nav.sections.flatMap((section) => section.items);
    expect(nav.homeHref).toBe('/game/game-1/realm');
    expect(items.find((item) => item.id === 'realm-overview')?.active).toBe(false);
    expect(items.find((item) => item.id === 'nobles')?.active).toBe(true);
    expect(items.find((item) => item.id === 'turn-report')).toMatchObject({
      href: '/game/game-1/realm/report',
      disabled: false,
    });
  });

  it('marks ruler creation as part of ruler and nobles navigation', () => {
    const nav = buildGameNavigation({
      gameId: 'game-1',
      pathname: '/game/game-1/realm/ruler/create',
      role: 'player',
      initState: 'parallel_final_setup',
      gamePhase: 'RealmCreation',
      activeRealmId: 'realm-1',
      isGmManagingRealm: false,
    });

    const items = nav.sections.flatMap((section) => section.items);
    expect(items.find((item) => item.id === 'nobles')?.active).toBe(true);
  });

  it('does not confuse GM dashboard and realm slots active state', () => {
    const nav = buildGameNavigation({
      gameId: 'game-1',
      pathname: '/game/game-1/gm/realm-slots',
      role: 'gm',
      initState: 'player_invites_open',
      gamePhase: 'RealmCreation',
      activeRealmId: null,
      isGmManagingRealm: false,
    });

    const items = nav.sections.flatMap((section) => section.items);
    expect(items.find((item) => item.id === 'gm-dashboard')?.active).toBe(false);
    expect(items.find((item) => item.id === 'realm-slots')?.active).toBe(true);
  });

  it('marks the map route active for both roles', () => {
    const nav = buildGameNavigation({
      gameId: 'game-1',
      pathname: '/game/game-1/map',
      role: 'gm',
      initState: 'active',
      gamePhase: 'Active',
      activeRealmId: null,
      isGmManagingRealm: false,
    });

    expect(nav.sections.flatMap((section) => section.items).find((item) => item.id === 'world-map')?.active).toBe(true);
  });

  it('preserves GM managed realm query in realm links', () => {
    const nav = buildGameNavigation({
      gameId: 'game-1',
      pathname: '/game/game-1/realm/trade',
      role: 'gm',
      initState: 'active',
      gamePhase: 'Active',
      activeRealmId: 'realm-2',
      isGmManagingRealm: true,
    });

    const managedItems = nav.sections.find((section) => section.id === 'realm-management')?.items ?? [];
    expect(managedItems.find((item) => item.id === 'managed-trade')).toMatchObject({
      href: '/game/game-1/realm/trade?realmId=realm-2',
      active: true,
    });
  });

  it('disables player routes that require a realm when no realm exists', () => {
    const nav = buildGameNavigation({
      gameId: 'game-1',
      pathname: '/game/game-1/create-realm',
      role: 'player',
      initState: 'player_invites_open',
      gamePhase: 'RealmCreation',
      activeRealmId: null,
      isGmManagingRealm: false,
    });

    const items = nav.sections.flatMap((section) => section.items);
    expect(items.find((item) => item.id === 'create-realm')?.active).toBe(true);
    expect(items.find((item) => item.id === 'world-map')).toMatchObject({
      disabled: true,
      description: 'Create a realm before viewing the game map.',
    });
  });
});

describe('equivalentManagedRealmHref', () => {
  it('routes GM and map pages to managed realm overview', () => {
    expect(equivalentManagedRealmHref('game-1', '/game/game-1/gm', 'realm-1')).toBe('/game/game-1/realm?realmId=realm-1');
    expect(equivalentManagedRealmHref('game-1', '/game/game-1/map', 'realm-1')).toBe('/game/game-1/realm?realmId=realm-1');
  });

  it('preserves the current realm subroute', () => {
    expect(equivalentManagedRealmHref('game-1', '/game/game-1/realm/ruler/create', 'realm-2'))
      .toBe('/game/game-1/realm/ruler/create?realmId=realm-2');
  });
});
