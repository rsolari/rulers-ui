'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
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

export default function TradePage() {
  const params = useParams();
  const gameId = params.gameId as string;
  const { realmId } = useRole();
  const [routes, setRoutes] = useState<TradeRoute[]>([]);
  const [allRealms, setAllRealms] = useState<Realm[]>([]);

  useEffect(() => {
    fetch(`/api/game/${gameId}/trade-routes`).then(r => r.json()).then(setRoutes);
    fetch(`/api/game/${gameId}/realms`).then(r => r.json()).then(setAllRealms);
  }, [gameId]);

  const myRoutes = routes.filter(r => r.realm1Id === realmId || r.realm2Id === realmId);
  const myRealm = allRealms.find(r => r.id === realmId);
  const hasMercantile = myRealm ? JSON.parse(myRealm.traditions || '[]').includes('Mercantile') : false;

  function getRealmName(id: string) {
    return allRealms.find(r => r.id === id)?.name || 'Unknown';
  }

  return (
    <main className="min-h-screen p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Trade Routes</h1>
      <p className="text-ink-300 mb-6">
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
