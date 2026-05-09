import type { GameInitState, GamePhase } from '@/types/game';
import type { GameShellRole } from '@/types/shell';

export interface ShellNavItem {
  id: string;
  label: string;
  href: string;
  active: boolean;
  disabled: boolean;
  requiresRealm: boolean;
  description?: string;
}

export interface ShellNavSection {
  id: string;
  label: string;
  items: ShellNavItem[];
}

interface BuildGameNavigationInput {
  gameId: string;
  pathname: string;
  role: GameShellRole;
  initState: GameInitState;
  gamePhase: GamePhase;
  activeRealmId: string | null;
  isGmManagingRealm: boolean;
}

interface NavDefinition {
  id: string;
  label: string;
  path: string;
  requiresRealm?: boolean;
  disabled?: boolean;
  description?: string;
  activePaths?: string[];
}

function withRealm(href: string, realmId: string | null) {
  return realmId ? `${href}?realmId=${encodeURIComponent(realmId)}` : href;
}

function isActive(pathname: string, hrefPath: string, activePaths: string[] = []) {
  if (pathname === hrefPath) {
    return true;
  }

  return activePaths.some((candidate) => pathname === candidate || pathname.startsWith(`${candidate}/`));
}

function itemFromDefinition(
  gameId: string,
  pathname: string,
  definition: NavDefinition,
  activeRealmId: string | null,
  preserveRealm: boolean,
): ShellNavItem {
  const baseHref = `/game/${gameId}${definition.path}`;
  const href = preserveRealm ? withRealm(baseHref, activeRealmId) : baseHref;
  const activePaths = definition.activePaths?.map((path) => `/game/${gameId}${path}`);

  return {
    id: definition.id,
    label: definition.label,
    href,
    active: isActive(pathname, baseHref, activePaths),
    disabled: Boolean(definition.disabled),
    requiresRealm: Boolean(definition.requiresRealm),
    description: definition.description,
  };
}

export function equivalentManagedRealmHref(gameId: string, pathname: string, realmId: string) {
  const gameBase = `/game/${gameId}`;
  const realmBase = `${gameBase}/realm`;
  const encodedRealmId = encodeURIComponent(realmId);

  if (pathname === `${gameBase}/gm` || pathname === `${gameBase}/map` || !pathname.startsWith(realmBase)) {
    return `${realmBase}?realmId=${encodedRealmId}`;
  }

  return `${pathname}?realmId=${encodedRealmId}`;
}

export function buildGameNavigation(input: BuildGameNavigationInput): {
  sections: ShellNavSection[];
  homeHref: string;
} {
  const { gameId, pathname, role, initState, gamePhase, activeRealmId, isGmManagingRealm } = input;
  const activeOrCompleted = gamePhase === 'Active' || initState === 'completed';
  const hasRealm = Boolean(activeRealmId);

  if (role === 'gm') {
    const gmItems: NavDefinition[] = [
      { id: 'gm-dashboard', label: 'GM Dashboard', path: '/gm' },
      ...(initState === 'gm_world_setup'
        ? [{ id: 'world-setup', label: 'World Setup', path: '/setup' }]
        : []),
      { id: 'realm-slots', label: 'Realm Slots', path: '/gm/realm-slots' },
      { id: 'world-map', label: 'World Map', path: '/map' },
      ...(activeOrCompleted
        ? [{ id: 'review-turns', label: 'Review Turns', path: '/gm?tab=turns#turn-review', activePaths: ['/gm'] }]
        : []),
      { id: 'rulebook', label: 'Rulebook', path: '/rules' },
    ];

    const sections: ShellNavSection[] = [{
      id: 'gm',
      label: 'Game Master',
      items: gmItems.map((item) => item.id === 'rulebook'
        ? {
          id: item.id,
          label: item.label,
          href: '/rules',
          active: false,
          disabled: false,
          requiresRealm: false,
          description: item.description,
        }
        : itemFromDefinition(gameId, pathname, item, null, false)),
    }];

    if (isGmManagingRealm && activeRealmId) {
      const managedItems: NavDefinition[] = [
        { id: 'managed-overview', label: 'Managed Realm Overview', path: '/realm' },
      { id: 'managed-nobles', label: 'Nobles', path: '/realm/nobles', activePaths: ['/realm/ruler/create'] },
        { id: 'managed-settlements', label: 'Settlements', path: '/realm/settlements' },
        { id: 'managed-army', label: 'Armies & Fleets', path: '/realm/army' },
        { id: 'managed-treasury', label: 'Treasury', path: '/realm/treasury' },
        { id: 'managed-trade', label: 'Trade', path: '/realm/trade' },
        { id: 'managed-gos', label: 'Guilds, Orders & Societies', path: '/realm/gos' },
      ];

      sections.push({
        id: 'realm-management',
        label: 'Managed Realm',
        items: [
          ...managedItems.map((item) => itemFromDefinition(gameId, pathname, item, activeRealmId, true)),
          {
            id: 'exit-realm-view',
            label: 'Exit Realm View',
            href: `/game/${gameId}/gm`,
            active: false,
            disabled: false,
            requiresRealm: false,
          },
        ],
      });
    }

    return { sections, homeHref: `/game/${gameId}/gm` };
  }

  const playerBaseItems: NavDefinition[] = hasRealm
    ? [
      { id: 'realm-overview', label: 'Realm Overview', path: '/realm', requiresRealm: true },
      ...(activeOrCompleted
        ? [{ id: 'turn-report', label: 'Turn Report', path: '/realm/report', requiresRealm: true }]
        : []),
      { id: 'world-map', label: 'World Map', path: '/map' },
      { id: 'nobles', label: 'Ruler & Nobles', path: '/realm/nobles', requiresRealm: true, activePaths: ['/realm/ruler/create'] },
      { id: 'settlements', label: 'Settlements & Buildings', path: '/realm/settlements', requiresRealm: true },
      { id: 'army', label: 'Armies & Fleets', path: '/realm/army', requiresRealm: true },
      { id: 'treasury', label: 'Treasury', path: '/realm/treasury', requiresRealm: true },
      { id: 'trade', label: 'Trade & Resources', path: '/realm/trade', requiresRealm: true },
      { id: 'gos', label: 'Guilds, Orders & Societies', path: '/realm/gos', requiresRealm: true },
    ]
    : [
      { id: 'create-realm', label: 'Create Realm', path: '/create-realm' },
      {
        id: 'world-map',
        label: 'World Map',
        path: '/map',
        disabled: true,
        description: 'Create a realm before viewing the game map.',
      },
    ];

  return {
    homeHref: hasRealm ? `/game/${gameId}/realm` : `/game/${gameId}/create-realm`,
    sections: [{
      id: 'player',
      label: initState === 'active' || initState === 'completed' ? 'Realm' : 'Setup',
      items: playerBaseItems.map((item) => itemFromDefinition(gameId, pathname, item, null, false)),
    }],
  };
}
