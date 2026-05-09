'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { GameShellHeader } from '@/components/app-shell/game-shell-header';
import { GameShellNav } from '@/components/app-shell/game-shell-nav';
import { MobileGameNav } from '@/components/app-shell/mobile-game-nav';
import { buildGameNavigation } from '@/lib/game-navigation';
import type { GameShellDto } from '@/types/shell';

interface GameAppShellProps {
  gameId: string;
  children: React.ReactNode;
}

export function GameAppShell({ gameId, children }: GameAppShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const realmId = searchParams.get('realmId');
  const [shell, setShell] = useState<GameShellDto | null>(null);
  const [loading, setLoading] = useState(true);

  const loadShell = useCallback(async () => {
    setLoading(true);
    const query = realmId ? `?realmId=${encodeURIComponent(realmId)}` : '';
    const response = await fetch(`/api/game/${gameId}/shell${query}`, { cache: 'no-store' });

    if (!response.ok) {
      setShell(null);
      setLoading(false);
      return;
    }

    setShell(await response.json());
    setLoading(false);
  }, [gameId, realmId]);

  useEffect(() => {
    void loadShell();
  }, [loadShell, pathname]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    if (!loading && shell?.session.role === null) {
      router.replace(`/game/${gameId}`);
    }
  }, [gameId, loading, router, shell?.session.role]);

  const navigation = useMemo(() => {
    if (!shell) return null;

    return buildGameNavigation({
      gameId,
      pathname,
      role: shell.session.role,
      initState: shell.game.initState,
      gamePhase: shell.game.gamePhase,
      activeRealmId: shell.activeRealmId,
      isGmManagingRealm: shell.session.role === 'gm' && Boolean(shell.activeRealmId),
    });
  }, [gameId, pathname, shell]);

  if (loading && !shell) {
    return (
      <div className="min-h-screen bg-parchment-50">
        <div className="flex min-h-screen items-center justify-center p-6">
          <p className="font-heading text-lg text-ink-300">Loading game...</p>
        </div>
      </div>
    );
  }

  if (!shell || shell.session.role === null || !navigation) {
    return (
      <div className="min-h-screen bg-parchment-50">
        <div className="flex min-h-screen items-center justify-center p-6">
          <p className="font-heading text-lg text-ink-300">Opening game...</p>
        </div>
      </div>
    );
  }

  const isMapRoute = pathname === `/game/${gameId}/map`;

  return (
    <div className="min-h-screen bg-parchment-50">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded focus:bg-gold-400 focus:px-4 focus:py-2 focus:font-bold focus:text-ink-700"
      >
        Skip to content
      </a>
      <GameShellHeader
        shell={shell}
        homeHref={navigation.homeHref}
        pathname={pathname}
        onRefresh={loadShell}
      />
      <MobileGameNav sections={navigation.sections} />
      <div className={isMapRoute ? 'lg:flex' : 'mx-auto max-w-[1680px] lg:flex'}>
        <aside className="hidden w-64 shrink-0 border-r border-ink-200 bg-parchment-50 px-4 py-6 lg:block">
          <GameShellNav sections={navigation.sections} />
        </aside>
        <div id="main-content" className={isMapRoute ? 'min-w-0 flex-1' : 'min-w-0 flex-1'}>
          {children}
        </div>
      </div>
    </div>
  );
}
