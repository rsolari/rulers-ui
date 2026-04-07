'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRole } from '@/hooks/use-role';
import { TRADE_BONUS_PER_PRODUCT, MERCANTILE_TRADE_BONUS } from '@/lib/game-logic/constants';

interface TradeRoute {
  id: string;
  realm1Id: string;
  realm2Id: string;
  settlement1Id: string;
  settlement2Id: string;
  isActive: boolean;
  productsExported1to2: string;
  productsExported2to1: string;
  protectedProducts: string;
}

interface Realm {
  id: string;
  name: string;
  traditions: string;
}

interface Territory {
  id: string;
  name: string;
  realmId: string | null;
}

interface ResourceSite {
  id: string;
  territoryId: string;
  resourceType: string;
  rarity: string;
}

export default function TradePage() {
  const params = useParams();
  const gameId = params.gameId as string;
  const { realmId } = useRole();
  const [routes, setRoutes] = useState<TradeRoute[]>([]);
  const [allRealms, setAllRealms] = useState<Realm[]>([]);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [resources, setResources] = useState<ResourceSite[]>([]);

  useEffect(() => {
    fetch(`/api/game/${gameId}/trade-routes`).then(r => r.json()).then(setRoutes);
    fetch(`/api/game/${gameId}/realms`).then(r => r.json()).then(setAllRealms);
    fetch(`/api/game/${gameId}/territories`).then(r => r.json()).then(setTerritories);
    fetch(`/api/game/${gameId}/resources`).then(r => r.json()).then(setResources);
  }, [gameId]);

  const myRoutes = routes.filter(r => r.realm1Id === realmId || r.realm2Id === realmId);
  const myRealm = allRealms.find(r => r.id === realmId);
  const hasMercantile = myRealm ? JSON.parse(myRealm.traditions || '[]').includes('Mercantile') : false;

  function getRealmName(id: string) {
    return allRealms.find(r => r.id === id)?.name || 'Unknown';
  }

  const myTerritoryIds = territories.filter(t => t.realmId === realmId).map(t => t.id);
  const myResources = resources.filter(r => myTerritoryIds.includes(r.territoryId));

  const resourcesByType = myResources.reduce<Record<string, { count: number; rarity: string; territories: string[] }>>((acc, r) => {
    if (!acc[r.resourceType]) {
      acc[r.resourceType] = { count: 0, rarity: r.rarity, territories: [] };
    }
    acc[r.resourceType].count++;
    const terrName = territories.find(t => t.id === r.territoryId)?.name;
    if (terrName && !acc[r.resourceType].territories.includes(terrName)) {
      acc[r.resourceType].territories.push(terrName);
    }
    return acc;
  }, {});

  const commonResources = Object.entries(resourcesByType).filter(([, v]) => v.rarity === 'Common');
  const luxuryResources = Object.entries(resourcesByType).filter(([, v]) => v.rarity === 'Luxury');

  return (
    <main className="min-h-screen p-6 max-w-6xl mx-auto">
      <nav className="mb-4 text-sm text-ink-300">
        <Link href={`/game/${gameId}/realm`} className="hover:text-ink-100">← Realm</Link>
      </nav>
      <h1 className="text-3xl font-bold mb-2">Trade & Resources</h1>

      <h2 className="text-xl font-heading font-semibold mt-6 mb-3">Resources</h2>
      {myResources.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-ink-300 text-center py-6">No resource sites in your territories.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {commonResources.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Common Resources</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {commonResources.map(([type, info]) => (
                    <div key={type} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge>{type}</Badge>
                        {info.count > 1 && <span className="text-sm text-ink-300">×{info.count}</span>}
                      </div>
                      <span className="text-sm text-ink-300">{info.territories.join(', ')}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {luxuryResources.length > 0 && (
            <Card variant="gold">
              <CardHeader>
                <CardTitle>Luxury Resources</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {luxuryResources.map(([type, info]) => (
                    <div key={type} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="gold">{type}</Badge>
                        {info.count > 1 && <span className="text-sm text-ink-300">×{info.count}</span>}
                      </div>
                      <span className="text-sm text-ink-300">{info.territories.join(', ')}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <h2 className="text-xl font-heading font-semibold mt-6 mb-3">Trade Routes</h2>
      <p className="text-ink-300 mb-4">
        Each exported product gives +{(TRADE_BONUS_PER_PRODUCT * 100).toFixed(0)}% wealth bonus.
        {hasMercantile && ` Mercantile tradition: +${(MERCANTILE_TRADE_BONUS * 100).toFixed(0)}% bonus.`}
      </p>

      <div className="space-y-4">
        {myRoutes.map(route => {
          const isRealm1 = route.realm1Id === realmId;
          const partnerId = isRealm1 ? route.realm2Id : route.realm1Id;
          const exports = JSON.parse(isRealm1 ? route.productsExported1to2 : route.productsExported2to1);
          const imports = JSON.parse(isRealm1 ? route.productsExported2to1 : route.productsExported1to2);
          const protectedProducts = JSON.parse(route.protectedProducts || '[]');

          return (
            <Card key={route.id} variant={route.isActive ? 'gold' : 'default'}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Trade with {getRealmName(partnerId)}</CardTitle>
                  <Badge variant={route.isActive ? 'green' : 'red'}>
                    {route.isActive ? 'Active' : 'Closed'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="font-heading font-semibold mb-2">Exports</p>
                    <div className="flex flex-wrap gap-1">
                      {exports.map((p: string) => (
                        <Badge key={p} variant="gold">{p}</Badge>
                      ))}
                      {exports.length === 0 && <span className="text-ink-300 text-sm">None</span>}
                    </div>
                  </div>
                  <div>
                    <p className="font-heading font-semibold mb-2">Imports</p>
                    <div className="flex flex-wrap gap-1">
                      {imports.map((p: string) => (
                        <Badge key={p}>{p}</Badge>
                      ))}
                      {imports.length === 0 && <span className="text-ink-300 text-sm">None</span>}
                    </div>
                  </div>
                </div>

                {protectedProducts.length > 0 && (
                  <div className="mt-3">
                    <p className="font-heading text-sm font-semibold mb-1">Protected Products</p>
                    <div className="flex flex-wrap gap-1">
                      {protectedProducts.map((p: { resourceType: string; expirySeason: string; expiryYear: number }, i: number) => (
                        <Badge key={i} variant="red">
                          {p.resourceType} (until {p.expirySeason} Y{p.expiryYear})
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-sm text-ink-300 mt-3">
                  Trade bonus: +{(exports.length * TRADE_BONUS_PER_PRODUCT * 100).toFixed(0)}%
                  {hasMercantile && ` + ${(MERCANTILE_TRADE_BONUS * 100).toFixed(0)}%`}
                </p>
              </CardContent>
            </Card>
          );
        })}

        {myRoutes.length === 0 && (
          <Card>
            <CardContent>
              <p className="text-ink-300 text-center py-6">No trade routes established. Talk to the GM to set up trade with other realms.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
