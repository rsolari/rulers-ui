'use client';

import { useRouter } from 'next/navigation';
import { Select } from '@/components/ui/select';
import { equivalentManagedRealmHref } from '@/lib/game-navigation';
import type { GameShellDto } from '@/types/shell';

interface GameContextSwitcherProps {
  shell: GameShellDto;
  pathname: string;
}

export function GameContextSwitcher({ shell, pathname }: GameContextSwitcherProps) {
  const router = useRouter();
  const { session, currentRealm, realms, game } = shell;

  if (session.role === 'gm') {
    const value = currentRealm?.id ?? 'gm';

    return (
      <Select
        aria-label="Game context"
        className="min-h-11 w-full min-w-0 py-2 text-sm sm:min-h-0 sm:min-w-44"
        value={value}
        options={[
          { value: 'gm', label: 'GM View' },
          ...realms.map((realm) => ({ value: realm.id, label: realm.name })),
        ]}
        onChange={(event) => {
          const nextValue = event.target.value;
          router.push(nextValue === 'gm'
            ? `/game/${game.id}/gm`
            : equivalentManagedRealmHref(game.id, pathname, nextValue));
        }}
      />
    );
  }

  if (currentRealm) {
    return (
      <div className="flex min-h-11 min-w-0 items-center gap-2 rounded border border-ink-200 bg-parchment-50 px-3 py-2 text-sm font-semibold text-ink-600 sm:min-h-0">
        <span
          aria-hidden="true"
          className="h-3 w-3 rounded-sm border border-ink-300"
          style={{ backgroundColor: currentRealm.color ?? 'transparent' }}
        />
        <span className="min-w-0 break-words">{currentRealm.name}</span>
      </div>
    );
  }

  return (
    <div className="flex min-h-11 items-center rounded border border-ink-200 bg-parchment-50 px-3 py-2 text-sm font-semibold text-ink-400 sm:min-h-0">
      No realm yet
    </div>
  );
}
