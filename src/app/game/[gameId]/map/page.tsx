'use client';

import Link from 'next/link';
import { startTransition, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { HexMap } from '@/components/map/HexMap';
import type { GameMapData } from '@/components/map/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRole } from '@/hooks/use-role';

export default function GameMapPage() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.gameId as string;
  const { role, loading } = useRole();
  const [mapData, setMapData] = useState<GameMapData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMap, setLoadingMap] = useState(true);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (role !== 'gm' && role !== 'player') {
      router.replace(`/game/${gameId}`);
    }
  }, [gameId, loading, role, router]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadMap() {
      try {
        setLoadingMap(true);
        setError(null);

        const response = await fetch(`/api/game/${gameId}/map`, {
          cache: 'no-store',
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error('Failed to load map');
        }

        const payload = await response.json() as GameMapData;
        startTransition(() => {
          setMapData(payload);
          setLoadingMap(false);
        });
      } catch (caughtError) {
        if (controller.signal.aborted) {
          return;
        }

        setError(caughtError instanceof Error ? caughtError.message : 'Failed to load map');
        setLoadingMap(false);
      }
    }

    void loadMap();

    return () => controller.abort();
  }, [gameId]);

  const backHref = role === 'gm' ? `/game/${gameId}/gm` : `/game/${gameId}/realm`;

  if (loading || loadingMap) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-lg text-ink-300">Loading map...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto min-h-screen max-w-5xl p-6">
        <Card variant="gold">
          <CardHeader>
            <CardTitle>Map unavailable</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-ink-300">{error}</p>
            <Link href={backHref}>
              <Button variant="outline">Return to dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!mapData?.mapName) {
    return (
      <main className="mx-auto min-h-screen max-w-5xl p-6">
        <Card variant="gold">
          <CardHeader>
            <CardTitle>No world map imported</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-ink-300">
              This game does not have an imported map yet. Finish world setup first.
            </p>
            <Link href={backHref}>
              <Button variant="outline">Return to dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-[110rem] p-6">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-heading text-sm uppercase tracking-[0.2em] text-ink-300">World Map</p>
          <h1 className="text-4xl font-bold">{mapData.mapName}</h1>
          <p className="max-w-2xl text-ink-300">
            Survey territories, borders, settlements, and field armies from a single strategic view.
          </p>
        </div>
        <div className="flex gap-3">
          <Link href={backHref}>
            <Button variant="outline">Back to dashboard</Button>
          </Link>
        </div>
      </div>

      <HexMap data={mapData} />
    </main>
  );
}
