'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { useRole } from '@/hooks/use-role';
import type { EconomyProjectionDto } from '@/lib/economy-dto';

export default function TreasuryPage() {
  const params = useParams();
  const gameId = params.gameId as string;
  const { role, realmId: sessionRealmId } = useRole();
  const searchParams = useSearchParams();
  const gmRealmIdParam = searchParams.get('realmId');
  const isGmManaging = role === 'gm' && Boolean(gmRealmIdParam);
  const realmId = isGmManaging ? gmRealmIdParam : sessionRealmId;
  const [projection, setProjection] = useState<EconomyProjectionDto | null>(null);

  useEffect(() => {
    if (!realmId) return;

    fetch(`/api/game/${gameId}/economy/projection?realmId=${realmId}`, { cache: 'no-store' })
      .then((response) => response.json())
      .then(setProjection);
  }, [gameId, realmId]);

  if (!projection) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="font-heading text-ink-300">Loading...</p>
      </main>
    );
  }

  const revenueEntries = projection.projectedLedgerEntries.filter((entry) => entry.kind === 'revenue');
  const costEntries = projection.projectedLedgerEntries.filter((entry) => entry.kind === 'cost');

  return (
    <main className="min-h-screen p-6 max-w-6xl mx-auto">
      <nav className="mb-4 text-sm text-ink-300">
        <Link href={`/game/${gameId}/realm${isGmManaging ? '?realmId=' + realmId : ''}`} className="hover:text-ink-100">← Realm</Link>
      </nav>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">Treasury</h1>
          <p className="text-ink-300">
            {projection.realm.taxTypeApplied} applied this turn
            {projection.realm.nextTaxType !== projection.realm.taxTypeApplied
              ? `, ${projection.realm.nextTaxType} next turn`
              : ''}
          </p>
        </div>
      </div>

      <div className="grid gap-4 mb-6 md:grid-cols-2">
        <Card variant="gold">
          <CardContent>
            <p className="text-sm text-ink-300 pt-4">Current Treasury</p>
            <p className="text-3xl font-bold font-heading">{projection.openingTreasury.toLocaleString()}gc</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-ink-300 pt-4">Net Change / Season</p>
            <p className={`text-3xl font-bold font-heading ${projection.netChange >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {projection.netChange >= 0 ? '+' : ''}{projection.netChange.toLocaleString()}gc
            </p>
          </CardContent>
        </Card>
      </div>

      {projection.warnings.length > 0 && (
        <Card className="mb-6 border-gold-500">
          <CardHeader>
            <CardTitle>Warnings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {projection.warnings.map((warning) => (
              <p key={warning} className="text-sm text-ink-400">{warning}</p>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Income</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {revenueEntries.map((entry, index) => (
                  <TableRow key={`${entry.category}-${index}`}>
                    <TableCell>{entry.label}</TableCell>
                    <TableCell className="text-right text-green-700">{entry.amount.toLocaleString()}gc</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell className="font-bold">Total Revenue</TableCell>
                  <TableCell className="text-right font-bold text-green-700">{projection.totalRevenue.toLocaleString()}gc</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Expenses</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {costEntries.map((entry, index) => (
                  <TableRow key={`${entry.category}-${index}`}>
                    <TableCell>{entry.label}</TableCell>
                    <TableCell className="text-right text-red-700">{entry.amount.toLocaleString()}gc</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell className="font-bold">Total Costs</TableCell>
                  <TableCell className="text-right font-bold text-red-700">{projection.totalCosts.toLocaleString()}gc</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Settlement Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Settlement</TableHead>
                <TableHead className="text-right">Resource GDP</TableHead>
                <TableHead className="text-right">Food GDP</TableHead>
                <TableHead className="text-right">Trade Bonus</TableHead>
                <TableHead className="text-right">Settlement GDP</TableHead>
                <TableHead className="text-right">Tax Rate</TableHead>
                <TableHead className="text-right">Tax Income</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projection.settlementBreakdown.map((settlement) => (
                <TableRow key={settlement.settlementId}>
                  <TableCell>{settlement.settlementName}</TableCell>
                  <TableCell className="text-right">{settlement.resourceWealth.toLocaleString()}gc</TableCell>
                  <TableCell className="text-right">{settlement.foodWealth.toLocaleString()}gc</TableCell>
                  <TableCell className="text-right">{(settlement.tradeBonusRate * 100).toFixed(0)}%</TableCell>
                  <TableCell className="text-right font-bold">{settlement.totalWealth.toLocaleString()}gc</TableCell>
                  <TableCell className="text-right">{(settlement.taxRate * 100).toFixed(0)}%</TableCell>
                  <TableCell className="text-right text-green-700">{settlement.taxRevenue.toLocaleString()}gc</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}
